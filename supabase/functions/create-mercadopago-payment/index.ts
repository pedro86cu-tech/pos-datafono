import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CreatePaymentRequest {
  amount: number;
  currency?: string;
  description?: string;
  customer_email?: string;
  customer_name?: string;
  external_reference?: string;
  access_token: string;
  is_sandbox?: boolean;
  payment_request_id?: string;
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

    const body: CreatePaymentRequest = await req.json();
    const {
      amount,
      currency = "UYU",
      description = "Pago POS Mobile",
      customer_email,
      customer_name,
      external_reference,
      access_token,
      is_sandbox = true,
      payment_request_id,
      transaction_id,
    } = body;

    if (!amount || !access_token) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "amount y access_token son requeridos",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const mercadoPagoUrl = "https://api.mercadopago.com/checkout/preferences";

    const preferenceData: any = {
      items: [
        {
          title: description,
          quantity: 1,
          unit_price: amount,
          currency_id: currency,
        },
      ],
      notification_url: `${supabaseUrl}/functions/v1/mercadopago-webhook`,
      back_urls: {
        success: `${supabaseUrl}/payment-success`,
        failure: `${supabaseUrl}/payment-failure`,
        pending: `${supabaseUrl}/payment-pending`,
      },
      auto_return: "approved",
      payment_methods: {
        installments: 1,
      },
    };

    if (customer_email) {
      preferenceData.payer = {
        email: customer_email,
      };
      if (customer_name) {
        const [firstName, ...lastNameParts] = customer_name.split(" ");
        preferenceData.payer.name = firstName;
        if (lastNameParts.length > 0) {
          preferenceData.payer.surname = lastNameParts.join(" ");
        }
      }
    }

    if (external_reference || payment_request_id) {
      preferenceData.external_reference = external_reference || payment_request_id;
    }

    console.log("Creating Mercado Pago preference:", preferenceData);

    const mpResponse = await fetch(mercadoPagoUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${access_token}`,
      },
      body: JSON.stringify(preferenceData),
    });

    const mpResult = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error("Mercado Pago error:", mpResult);
      return new Response(
        JSON.stringify({
          success: false,
          error: mpResult.message || "Error al crear el pago en Mercado Pago",
          details: mpResult,
        }),
        {
          status: mpResponse.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Generate QR code from init_point
    const qrData = mpResult.init_point;

    // Generate a simple QR code using a free API
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=512x512&data=${encodeURIComponent(qrData)}`;

    // Update transaction with Mercado Pago preference ID
    if (transaction_id) {
      await supabase
        .from("transactions")
        .update({
          gateway_transaction_id: mpResult.id.toString(),
          gateway_response: mpResult,
        })
        .eq("id", transaction_id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        payment_id: mpResult.id,
        status: "pending",
        payment_link: mpResult.init_point,
        sandbox_init_point: mpResult.sandbox_init_point,
        qr_code: qrData,
        qr_code_base64: null,
        qr_image_url: qrApiUrl,
        preference_id: mpResult.id,
        full_response: mpResult,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error creating Mercado Pago payment:", error);

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
