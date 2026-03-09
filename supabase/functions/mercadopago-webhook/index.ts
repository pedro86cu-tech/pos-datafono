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

    if (!xSignature || !xRequestId) {
      console.log("Missing signature headers");
      return false;
    }

    // If no webhook secret is configured, skip validation (not recommended for production)
    if (!webhookSecret) {
      console.warn("WARNING: MERCADOPAGO_WEBHOOK_SECRET not configured, skipping signature validation");
      return true;
    }

    // Extract ts and hash from x-signature header
    // Format: "ts=1234567890,v1=hash"
    const parts = xSignature.split(",");
    let ts = "";
    let hash = "";

    for (const part of parts) {
      const [key, value] = part.split("=");
      if (key === "ts") ts = value;
      if (key === "v1") hash = value;
    }

    if (!ts || !hash) {
      console.log("Invalid signature format");
      return false;
    }

    // Create the manifest string
    const dataId = body.data?.id || "";
    const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;

    // Generate HMAC SHA256
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(webhookSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signature = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(manifest)
    );

    // Convert to hex string
    const hexSignature = Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const isValid = hexSignature === hash;

    if (!isValid) {
      console.log("Signature mismatch");
      console.log("Expected:", hash);
      console.log("Got:", hexSignature);
    }

    return isValid;
  } catch (error) {
    console.error("Error validating signature:", error);
    return false;
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

    console.log("Mercado Pago webhook received:", body);

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

    const { type, data } = body;

    if (type === "payment") {
      const paymentId = data.id;

      console.log("Processing payment webhook for ID:", paymentId);

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
      console.log("Mercado Pago payment details:", payment);

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
      } else {
        console.log("Transaction not found for payment ID:", paymentId);
        console.log("Payment external_reference:", payment.external_reference);
        console.log("Payment preference_id:", payment.preference_id);
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
