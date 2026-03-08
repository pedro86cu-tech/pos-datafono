import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, X-API-Key',
};

interface PaymentRequestBody {
  external_sale_id?: string;
  amount: number;
  currency?: string;
  customer_name?: string;
  customer_email?: string;
  note?: string;
  items?: any[];
  callback_url?: string;
  metadata?: Record<string, any>;
  expires_in_minutes?: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get and validate API Key from header
    const apiKey = req.headers.get('X-API-Key');

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'API Key is required. Provide X-API-Key header.',
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate API Key and get user_id
    const { data: apiKeyData, error: apiKeyError } = await supabase
      .from('api_keys')
      .select('user_id, is_active, name')
      .eq('key', apiKey)
      .maybeSingle();

    if (apiKeyError || !apiKeyData) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid API Key',
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!apiKeyData.is_active) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'API Key is inactive',
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Update last_used_at
    await supabase
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('key', apiKey);

    const body: PaymentRequestBody = await req.json();

    // Validate required fields
    if (!body.amount || body.amount <= 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'amount (> 0) is required',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const user_id = apiKeyData.user_id;

    // Calculate expiration time (default 30 minutes)
    const expiresInMinutes = body.expires_in_minutes || 30;
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + expiresInMinutes);

    // Create payment request
    const { data: paymentRequest, error } = await supabase
      .from('payment_requests')
      .insert({
        user_id: user_id,
        external_sale_id: body.external_sale_id,
        amount: body.amount,
        currency: body.currency || 'USD',
        customer_name: body.customer_name,
        customer_email: body.customer_email,
        note: body.note,
        items: body.items || [],
        callback_url: body.callback_url,
        metadata: body.metadata || {},
        status: 'pending',
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating payment request:', error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        payment_request: paymentRequest,
        message: 'Payment request created successfully',
      }),
      {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error in create-payment-request:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
