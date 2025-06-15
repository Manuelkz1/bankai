import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.7";
import { MercadoPagoConfig, Payment, MerchantOrder } from "npm:mercadopago@2.0.8";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const accessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
    if (!accessToken) {
      throw new Error('MERCADOPAGO_ACCESS_TOKEN not configured');
    }

    // Configure MercadoPago
    const client = new MercadoPagoConfig({
      accessToken: accessToken
    });

    const paymentClient = new Payment(client);
    const merchantOrderClient = new MerchantOrder(client);

    const body = await req.text();
    console.log('Received webhook payload (raw):', body);

    let payload: any;
    try {
      payload = JSON.parse(body);
      console.log('Parsed webhook payload:', JSON.stringify(payload, null, 2));
    } catch (e) {
      console.error('Error parsing JSON payload. Raw body:', body, 'Error:', e);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON payload received from webhook.' }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      );
    }

    const type = payload.type || payload.topic;
    let data_id = payload.data?.id;

    console.log('Extracted from payload:', { type, data_id });

    let orderId: string | undefined;
    let paymentStatus: string | undefined;

    if (type === 'payment') {
      if (!data_id) {
        console.error('Missing data.id for payment type webhook:', { type, data_id });
        return new Response(
          JSON.stringify({ error: 'Missing data.id for payment type webhook.' }),
          {
            status: 400,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          }
        );
      }
      const paymentInfo = await paymentClient.get({ id: Number(data_id) });
      console.log('Payment info received from Mercado Pago API (payment type):', JSON.stringify(paymentInfo, null, 2));
      orderId = paymentInfo.external_reference;
      paymentStatus = paymentInfo.status;

    } else if (type === 'merchant_order') {
      const resourceUrl = payload.resource;
      if (!resourceUrl) {
        console.error('Missing resource URL for merchant_order type webhook:', { type, resourceUrl });
        return new Response(
          JSON.stringify({ error: 'Missing resource URL for merchant_order type webhook.' }),
          {
            status: 400,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          }
        );
      }
      const merchantOrderId = resourceUrl.split('/').pop();
      if (!merchantOrderId) {
        console.error('Could not extract merchant order ID from resource URL:', resourceUrl);
        return new Response(
          JSON.stringify({ error: 'Could not extract merchant order ID from resource URL.' }),
          {
            status: 400,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          }
        );
      }

      const merchantOrderInfo = await merchantOrderClient.get({ id: Number(merchantOrderId) });
      console.log('Merchant Order info received from Mercado Pago API:', JSON.stringify(merchantOrderInfo, null, 2));

      orderId = merchantOrderInfo.external_reference;
      // Find the approved payment within the merchant order
      const approvedPayment = merchantOrderInfo.payments?.find(p => p.status === 'approved');
      if (approvedPayment) {
        paymentStatus = approvedPayment.status;
      } else {
        // If no approved payment, check if there's any pending payment
        const pendingPayment = merchantOrderInfo.payments?.find(p => p.status === 'pending');
        if (pendingPayment) {
          paymentStatus = pendingPayment.status;
        } else {
          paymentStatus = 'failed'; // Default to failed if no approved or pending payments
        }
      }

    } else {
      console.log('Unhandled webhook type:', type);
      return new Response(
        JSON.stringify({ success: true, message: 'Unhandled webhook type.' }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      );
    }

    if (!orderId || !paymentStatus) {
      console.error('Could not determine orderId or paymentStatus from webhook:', { orderId, paymentStatus });
      return new Response(
        JSON.stringify({ error: 'Could not determine orderId or paymentStatus.' }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      );
    }

    console.log('Final determined status for order:', { orderId, paymentStatus });

    let newPaymentStatus;
    let newOrderStatus;

    if (paymentStatus === 'approved') {
      newPaymentStatus = 'paid';
      newOrderStatus = 'processing';
    } else if (paymentStatus === 'pending') {
      newPaymentStatus = 'pending';
      newOrderStatus = 'pending';
    } else {
      newPaymentStatus = 'failed';
      newOrderStatus = 'failed';
    }

    console.log(`Attempting to update order ${orderId}: payment_status=${newPaymentStatus}, status=${newOrderStatus}`);

    // Update order status in Supabase
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        payment_status: newPaymentStatus,
        status: newOrderStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId);

    if (updateError) {
      console.error('Error updating order in Supabase:', updateError);
      throw updateError;
    } else {
      console.log(`Order ${orderId} updated successfully in Supabase.`);
    }

    // Send notification if payment was successful
    if (paymentStatus === 'approved') {
      const notificationUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/order-notifications`;

      const { data: order } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (order) {
        await fetch(notificationUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ record: order })
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (error) {
    console.error('Webhook processing error:', error);

    return new Response(
      JSON.stringify({
        error: error.message,
        stack: error.stack
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }
});

