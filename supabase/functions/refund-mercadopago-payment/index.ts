import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey, X-API-Key",
};

interface RefundRequest {
  payment_id: number;
  amount?: number;
  reason?: string;
  transaction_id?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get and validate API Key from header
    const apiKey = req.headers.get("X-API-Key");

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "API Key is required. Provide X-API-Key header.",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate API Key and get user_id
    console.log("Validating API key:", apiKey.substring(0, 10) + "...");

    const { data: apiKeyData, error: apiKeyError } = await supabase
      .from("api_keys")
      .select("user_id, is_active, mercadopago_access_token")
      .eq("key", apiKey)
      .maybeSingle();

    if (apiKeyError) {
      console.error("Error querying API key:", apiKeyError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Error validating API Key: " + apiKeyError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!apiKeyData) {
      console.log("API key not found in database");
      return new Response(
        JSON.stringify({
          success: false,
          error:
            "Invalid API Key. Make sure you copied the complete key from the app.",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("API key validated successfully for user:", apiKeyData.user_id);

    if (!apiKeyData.is_active) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "API Key is inactive",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!apiKeyData.mercadopago_access_token) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            "Mercado Pago access token not configured. Please configure it in the app settings.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Update last_used_at
    await supabase
      .from("api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("key", apiKey);

    const body: RefundRequest = await req.json();
    const { payment_id, amount, reason, transaction_id } = body;

    if (!payment_id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "payment_id es requerido",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const access_token = apiKeyData.mercadopago_access_token;

    console.log("Processing refund for payment:", payment_id);

    // Build refund request
    const refundData: any = {};
    if (amount) {
      refundData.amount = amount;
      console.log("Partial refund requested:", amount);
    } else {
      console.log("Full refund requested");
    }

    // Call Mercado Pago refund API
    const mercadoPagoUrl = `https://api.mercadopago.com/v1/payments/${payment_id}/refunds`;

    console.log("Calling Mercado Pago refund API:", mercadoPagoUrl);

    const mpResponse = await fetch(mercadoPagoUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${access_token}`,
      },
      body: JSON.stringify(refundData),
    });

    const mpResult = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error("Mercado Pago refund error:", mpResult);
      return new Response(
        JSON.stringify({
          success: false,
          error: mpResult.message || "Error al procesar la anulación",
          details: mpResult,
        }),
        {
          status: mpResponse.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Refund successful:", mpResult);

    // Register refund in database
    const refundRecord: any = {
      payment_id: payment_id.toString(),
      refund_id: mpResult.id,
      amount: mpResult.amount || 0,
      status: mpResult.status,
      reason: reason || "Refund requested",
      gateway_response: mpResult,
      created_at: new Date().toISOString(),
    };

    if (transaction_id) {
      refundRecord.transaction_id = transaction_id;
    }

    // Store refund information
    const { error: insertError } = await supabase
      .from("refunds")
      .insert(refundRecord);

    if (insertError) {
      console.error("Error storing refund:", insertError);
      // Don't fail the request if we can't store it - the refund was successful
    }

    // Update transaction status if transaction_id provided
    if (transaction_id) {
      const { error: updateError } = await supabase
        .from("transactions")
        .update({
          status: "refunded",
          updated_at: new Date().toISOString(),
        })
        .eq("id", transaction_id);

      if (updateError) {
        console.error("Error updating transaction:", updateError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        refund_id: mpResult.id,
        payment_id: payment_id,
        amount_refunded: mpResult.amount,
        status: mpResult.status,
        refund_type: amount ? "partial" : "total",
        details: mpResult,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error processing refund:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Error interno del servidor",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
