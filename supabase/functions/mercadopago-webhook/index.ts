import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

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

    const body = await req.json();

    console.log("Mercado Pago webhook received:", body);

    const { type, data } = body;

    if (type === "payment") {
      const paymentId = data.id;

      const { data: existingTransaction } = await supabase
        .from("transactions")
        .select("*")
        .eq("gateway_transaction_id", paymentId)
        .single();

      if (existingTransaction) {
        const accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");

        const paymentResponse = await fetch(
          `https://api.mercadopago.com/v1/payments/${paymentId}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        const payment = await paymentResponse.json();

        let status = "pending";
        if (payment.status === "approved") {
          status = "completed";
        } else if (payment.status === "rejected" || payment.status === "cancelled") {
          status = "failed";
        }

        await supabase
          .from("transactions")
          .update({
            status: status,
            gateway_response: payment,
            completed_at: payment.status === "approved" ? new Date().toISOString() : null,
          })
          .eq("id", existingTransaction.id);

        if (existingTransaction.payment_request_id) {
          const confirmUrl = `${supabaseUrl}/functions/v1/confirm-payment`;
          await fetch(confirmUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              payment_request_id: existingTransaction.payment_request_id,
              transaction_id: existingTransaction.id,
              status: status,
            }),
          });
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, received: true }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error processing Mercado Pago webhook:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Error procesando webhook",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
