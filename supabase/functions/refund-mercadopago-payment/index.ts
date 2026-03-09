import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey, X-API-Key",
};

interface RefundRequest {
  payment_id?: string | number;
  transaction_id?: string;
  amount?: number;
  reason?: string;
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
      .select("user_id, is_active")
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

    // Update last_used_at
    await supabase
      .from("api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("key", apiKey);

    // Get Mercado Pago access token from payment_gateways
    const { data: gatewayData, error: gatewayError } = await supabase
      .from("payment_gateways")
      .select("api_key, is_active")
      .eq("user_id", apiKeyData.user_id)
      .eq("gateway_name", "mercadopago")
      .eq("is_active", true)
      .maybeSingle();

    if (gatewayError) {
      console.error("Error querying payment gateway:", gatewayError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Error getting Mercado Pago configuration: " + gatewayError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!gatewayData) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            "Mercado Pago is not configured or is inactive. Please configure it in the app settings.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const body: RefundRequest = await req.json();
    const { payment_id, amount, reason, transaction_id } = body;

    if (!payment_id && !transaction_id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "payment_id o transaction_id es requerido",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let mercadoPagoPaymentId: number;
    let localTransactionId: string | undefined = transaction_id;

    // If transaction_id is provided, get the Mercado Pago payment_id from database
    if (transaction_id) {
      console.log("Looking up transaction:", transaction_id);

      const { data: transactionData, error: transactionError } = await supabase
        .from("transactions")
        .select("transaction_reference, metadata")
        .eq("id", transaction_id)
        .eq("user_id", apiKeyData.user_id)
        .maybeSingle();

      if (transactionError) {
        console.error("Error querying transaction:", transactionError);
        return new Response(
          JSON.stringify({
            success: false,
            error: "Error getting transaction: " + transactionError.message,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (!transactionData) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Transaction not found",
          }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Try to get payment_id from metadata or transaction_reference
      const mpPaymentId = transactionData.metadata?.mercadopago_payment_id ||
                          transactionData.transaction_reference;

      if (!mpPaymentId) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Mercado Pago payment_id not found in transaction",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      mercadoPagoPaymentId = parseInt(mpPaymentId);
      console.log("Found Mercado Pago payment_id:", mercadoPagoPaymentId);
    } else {
      // Use provided payment_id directly
      mercadoPagoPaymentId = typeof payment_id === 'string' ? parseInt(payment_id) : payment_id!;
      console.log("Using provided payment_id:", mercadoPagoPaymentId);
    }

    if (isNaN(mercadoPagoPaymentId)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid payment_id format. Must be a number.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const access_token = gatewayData.api_key;

    console.log("Processing refund for Mercado Pago payment:", mercadoPagoPaymentId);

    // Build refund request
    const refundData: any = {};
    if (amount) {
      refundData.amount = amount;
      console.log("Partial refund requested:", amount);
    } else {
      console.log("Full refund requested");
    }

    // Call Mercado Pago refund API
    const mercadoPagoUrl = `https://api.mercadopago.com/v1/payments/${mercadoPagoPaymentId}/refunds`;

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
      payment_id: mercadoPagoPaymentId.toString(),
      refund_id: mpResult.id,
      amount: mpResult.amount || 0,
      status: mpResult.status,
      reason: reason || "Refund requested",
      gateway_response: mpResult,
      created_at: new Date().toISOString(),
    };

    if (localTransactionId) {
      refundRecord.transaction_id = localTransactionId;
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
    if (localTransactionId) {
      const { error: updateError } = await supabase
        .from("transactions")
        .update({
          status: "refunded",
          updated_at: new Date().toISOString(),
        })
        .eq("id", localTransactionId);

      if (updateError) {
        console.error("Error updating transaction:", updateError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        refund_id: mpResult.id,
        payment_id: mercadoPagoPaymentId,
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
