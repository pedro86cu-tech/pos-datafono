import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RefundRequest {
  payment_id: number;
  amount?: number;
  access_token: string;
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

    const body: RefundRequest = await req.json();
    const { payment_id, amount, access_token, reason, transaction_id } = body;

    if (!payment_id || !access_token) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "payment_id y access_token son requeridos",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

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
