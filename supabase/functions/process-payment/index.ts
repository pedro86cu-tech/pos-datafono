import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface PaymentRequest {
  transaction_id: string;
  amount: number;
  currency: string;
  gateway_name: string;
  api_key: string;
  api_secret?: string;
  is_sandbox: boolean;
}

async function processMercadoPago(
  amount: number,
  currency: string,
  apiKey: string,
  isSandbox: boolean
) {
  const baseUrl = isSandbox
    ? "https://api.mercadopago.com/v1"
    : "https://api.mercadopago.com/v1";

  const response = await fetch(`${baseUrl}/payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      transaction_amount: amount,
      description: "Payment via POS Mobile",
      payment_method_id: "credit_card",
      payer: {
        email: "customer@example.com",
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "MercadoPago payment failed");
  }

  const data = await response.json();
  return {
    success: true,
    transaction_reference: data.id,
    gateway_response: data,
  };
}

async function processDLocal(
  amount: number,
  currency: string,
  apiKey: string,
  apiSecret: string,
  isSandbox: boolean
) {
  const baseUrl = isSandbox
    ? "https://sandbox.dlocal.com"
    : "https://api.dlocal.com";

  const response = await fetch(`${baseUrl}/payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": apiKey,
      "X-Api-Secret": apiSecret,
    },
    body: JSON.stringify({
      amount: amount,
      currency: currency,
      country: "US",
      payment_method_id: "CARD",
      notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/payment-webhook`,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "dLocal payment failed");
  }

  const data = await response.json();
  return {
    success: true,
    transaction_reference: data.id,
    gateway_response: data,
  };
}

async function processStripe(
  amount: number,
  currency: string,
  apiKey: string,
  isSandbox: boolean
) {
  const baseUrl = "https://api.stripe.com/v1";

  const amountInCents = Math.round(amount * 100);

  const paymentIntentResponse = await fetch(`${baseUrl}/payment_intents`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Bearer ${apiKey}`,
    },
    body: new URLSearchParams({
      amount: amountInCents.toString(),
      currency: currency.toLowerCase(),
      "payment_method_types[]": "card",
      confirm: "false",
    }).toString(),
  });

  if (!paymentIntentResponse.ok) {
    const error = await paymentIntentResponse.json();
    throw new Error(error.error?.message || "Stripe payment intent creation failed");
  }

  const paymentIntent = await paymentIntentResponse.json();

  return {
    success: true,
    transaction_reference: paymentIntent.id,
    gateway_response: {
      payment_intent_id: paymentIntent.id,
      client_secret: paymentIntent.client_secret,
      status: paymentIntent.status,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
    },
  };
}

async function simulatePayment(amount: number, currency: string) {
  await new Promise((resolve) => setTimeout(resolve, 2000));

  const isSuccess = Math.random() > 0.1;

  if (isSuccess) {
    return {
      success: true,
      transaction_reference: `SIM-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      gateway_response: {
        status: "approved",
        amount,
        currency,
        timestamp: new Date().toISOString(),
      },
    };
  } else {
    throw new Error("Payment declined - Insufficient funds");
  }
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 200,
        headers: corsHeaders,
      });
    }

    const {
      transaction_id,
      amount,
      currency,
      gateway_name,
      api_key,
      api_secret,
      is_sandbox,
    }: PaymentRequest = await req.json();

    if (!transaction_id || !amount || !currency || !gateway_name) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    let result;

    switch (gateway_name.toLowerCase()) {
      case "stripe":
        result = await processStripe(amount, currency, api_key, is_sandbox);
        break;

      case "mercadopago":
        result = await processMercadoPago(amount, currency, api_key, is_sandbox);
        break;

      case "dlocal":
        if (!api_secret) {
          throw new Error("API Secret is required for dLocal");
        }
        result = await processDLocal(amount, currency, api_key, api_secret, is_sandbox);
        break;

      case "simulate":
      default:
        result = await simulatePayment(amount, currency);
        break;
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error: any) {
    console.error("Payment processing error:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Payment processing failed",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
