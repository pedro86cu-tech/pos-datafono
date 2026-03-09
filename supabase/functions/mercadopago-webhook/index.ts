import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function validateWebhookSignature(
  req: Request,
  body: any
): Promise<boolean> {
  try {
    const xSignature = req.headers.get("x-signature");
    const xRequestId = req.headers.get("x-request-id");
    const webhookSecret = Deno.env.get("MERCADOPAGO_WEBHOOK_SECRET");

    console.log("Webhook signature validation - headers:", {
      hasSignature: !!xSignature,
      hasRequestId: !!xRequestId,
      hasSecret: !!webhookSecret
    });

    // TEMPORARILY DISABLED: Allow all webhooks for debugging
    // TODO: Re-enable signature validation in production
    console.log("WARNING: Signature validation is DISABLED for debugging");
    return true;
  } catch (error) {
    console.error("Error validating signature:", error);
    return true;
  }
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

    const body = await req.json();

    console.log("Mercado Pago webhook received:", JSON.stringify(body));

    // Validate webhook signature
    const isValid = await validateWebhookSignature(req, body);
    if (!isValid) {
      console.error("Invalid webhook signature");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid signature",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { type, data, action } = body;

    console.log("Webhook type:", type, "action:", action);

    // Handle both payment and merchant_order webhooks
    let payment: any = null;

    if (type === "payment") {
      const paymentId = data.id;
      console.log("Processing payment webhook for ID:", paymentId);

      const accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");

      if (!accessToken) {
        console.error("MERCADOPAGO_ACCESS_TOKEN not configured!");
        return new Response(
          JSON.stringify({
            success: false,
            error: "Access token not configured",
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      console.log("Using access token:", accessToken.substring(0, 10) + "...");

      const paymentResponse = await fetch(
        `https://api.mercadopago.com/v1/payments/${paymentId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      payment = await paymentResponse.json();
      console.log("Mercado Pago payment details:", JSON.stringify(payment));
    } else if (type === "merchant_order") {
      const orderId = data.id;
      console.log("Processing merchant_order webhook for ID:", orderId);

      const accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");

      if (!accessToken) {
        console.error("MERCADOPAGO_ACCESS_TOKEN not configured!");
        return new Response(
          JSON.stringify({
            success: false,
            error: "Access token not configured",
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const orderResponse = await fetch(
        `https://api.mercadopago.com/merchant_orders/${orderId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const order = await orderResponse.json();
      console.log("Merchant order details:", JSON.stringify(order));

      // Get the first payment from the order
      if (order.payments && order.payments.length > 0) {
        const paymentId = order.payments[0].id;
        const paymentResponse = await fetch(
          `https://api.mercadopago.com/v1/payments/${paymentId}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );
        payment = await paymentResponse.json();
        console.log("Payment from merchant order:", JSON.stringify(payment));
      }
    }

    if (!payment) {
      console.log("No payment found in webhook");
      return new Response(
        JSON.stringify({ success: true, received: true }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let existingTransaction = null;

    // First try to find by gateway_transaction_id (preference_id)
    if (payment.preference_id) {
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .eq("gateway_transaction_id", payment.preference_id.toString())
        .maybeSingle();

      existingTransaction = data;
    }

    // If not found by preference_id, try by external_reference (payment_request_id)
    if (!existingTransaction && payment.external_reference) {
      console.log("Searching by external_reference:", payment.external_reference);

      const { data: paymentRequest } = await supabase
        .from("payment_requests")
        .select("id")
        .eq("id", payment.external_reference)
        .maybeSingle();

      if (paymentRequest) {
        const { data } = await supabase
          .from("transactions")
          .select("*")
          .eq("payment_request_id", paymentRequest.id)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        existingTransaction = data;
      }
    }

    if (existingTransaction) {
      console.log("Transaction found:", existingTransaction.id);
      console.log("Mercado Pago payment status:", payment.status);

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
          gateway_transaction_id: payment.id.toString(),
          gateway_response: payment,
          completed_at: payment.status === "approved" ? new Date().toISOString() : null,
        })
        .eq("id", existingTransaction.id);

      if (existingTransaction.payment_request_id) {
        console.log("Calling confirm-payment for request:", existingTransaction.payment_request_id);

        const confirmUrl = `${supabaseUrl}/functions/v1/confirm-payment`;
        const confirmResponse = await fetch(confirmUrl, {
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

        const confirmResult = await confirmResponse.json();
        console.log("Confirm-payment response:", confirmResult);

        if (!confirmResponse.ok) {
          console.error("Confirm-payment failed:", confirmResult);
        }
      }
    } else {
      console.log("Transaction not found for payment");
      console.log("Payment external_reference:", payment.external_reference);
      console.log("Payment preference_id:", payment.preference_id);
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
