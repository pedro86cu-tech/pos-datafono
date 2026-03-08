import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface PaymentRequestBody {
  user_id: string;
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

    const body: PaymentRequestBody = await req.json();

    // Validate required fields
    if (!body.user_id || !body.amount || body.amount <= 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'user_id and amount (> 0) are required',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Calculate expiration time (default 30 minutes)
    const expiresInMinutes = body.expires_in_minutes || 30;
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + expiresInMinutes);

    // Create payment request
    const { data: paymentRequest, error } = await supabase
      .from('payment_requests')
      .insert({
        user_id: body.user_id,
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
