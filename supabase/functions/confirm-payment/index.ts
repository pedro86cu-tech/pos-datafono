import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ConfirmPaymentBody {
  payment_request_id: string;
  transaction_id: string;
  status: 'completed' | 'failed';
  error_message?: string;
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

    const body: ConfirmPaymentBody = await req.json();

    if (!body.payment_request_id || !body.status) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'payment_request_id and status are required',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get payment request
    const { data: paymentRequest, error: fetchError } = await supabase
      .from('payment_requests')
      .select('*, transactions(*)')
      .eq('id', body.payment_request_id)
      .single();

    if (fetchError || !paymentRequest) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Payment request not found',
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Update payment request status
    const { error: updateError } = await supabase
      .from('payment_requests')
      .update({
        status: body.status,
        transaction_id: body.transaction_id,
        processed_at: new Date().toISOString(),
      })
      .eq('id', body.payment_request_id);

    if (updateError) {
      console.error('Error updating payment request:', updateError);
      return new Response(
        JSON.stringify({
          success: false,
          error: updateError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // If there's a callback URL, notify the external system
    if (paymentRequest.callback_url) {
      console.log('Sending webhook to:', paymentRequest.callback_url);

      try {
        const callbackPayload = {
          payment_request_id: body.payment_request_id,
          external_sale_id: paymentRequest.external_sale_id,
          status: body.status,
          amount: paymentRequest.amount,
          currency: paymentRequest.currency,
          transaction_id: body.transaction_id,
          error_message: body.error_message,
          processed_at: new Date().toISOString(),
          customer_name: paymentRequest.customer_name,
          customer_email: paymentRequest.customer_email,
          note: paymentRequest.note,
        };

        console.log('Webhook payload:', JSON.stringify(callbackPayload, null, 2));

        const callbackResponse = await fetch(paymentRequest.callback_url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(callbackPayload),
        });

        const responseText = await callbackResponse.text();
        console.log('Webhook response status:', callbackResponse.status);
        console.log('Webhook response body:', responseText);

        if (!callbackResponse.ok) {
          console.error('Callback failed with status:', callbackResponse.status);
          console.error('Callback error response:', responseText);
        } else {
          console.log('Webhook sent successfully to:', paymentRequest.callback_url);
        }
      } catch (callbackError) {
        console.error('Error calling webhook:', callbackError);
        console.error('Callback URL was:', paymentRequest.callback_url);
      }
    } else {
      console.log('No callback_url provided in payment request');
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Payment confirmed successfully',
        payment_request: {
          id: paymentRequest.id,
          status: body.status,
          amount: paymentRequest.amount,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error in confirm-payment:', error);
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
