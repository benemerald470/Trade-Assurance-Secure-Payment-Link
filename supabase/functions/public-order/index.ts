import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors });

const hash = async (value: string) => {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

const newToken = () =>
  `${crypto.randomUUID().replaceAll('-', '')}${crypto.randomUUID().replaceAll('-', '')}`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const { token, order_number, email, action, reference } =
      await req.json();

    const url = Deno.env.get('SUPABASE_URL')!;
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const db = createClient(url, key);

    // Submit a bank-transfer reference
    if (action === 'submit-transfer') {
      if (
        typeof token !== 'string' ||
        typeof reference !== 'string' ||
        reference.trim().length < 3
      ) {
        return json(
          { error: 'Enter a valid transfer reference.' },
          400,
        );
      }

      const tokenHash = await hash(token);

      const { data: order, error } = await db
        .from('orders')
        .select(
          'id,payment_status,access_token_expires_at',
        )
        .eq('access_token_hash', tokenHash)
        .maybeSingle();

      if (error || !order) {
        return json(
          { error: 'Invalid or expired order link.' },
          404,
        );
      }

      if (
        order.access_token_expires_at &&
        new Date(order.access_token_expires_at) < new Date()
      ) {
        return json(
          { error: 'Invalid or expired order link.' },
          404,
        );
      }

      if (order.payment_status === 'Paid') {
        return json(
          { error: 'This order is already marked paid.' },
          409,
        );
      }

      const { error: updateError } = await db
        .from('orders')
        .update({
          transfer_reference: reference.trim(),
          transfer_submitted_at: new Date().toISOString(),
          payment_status: 'Pending Verification',
        })
        .eq('id', order.id);

      if (updateError) throw updateError;

      const { error: historyError } = await db
        .from('order_updates')
        .insert({
          order_id: order.id,
          status: 'Pending Verification',
          message:
            'Buyer submitted a bank transfer reference. Awaiting manual verification.',
          visible_to_customer: true,
        });

      if (historyError) throw historyError;

      return json({ ok: true });
    }

    // Find an order using its secure access token or order number and email
    let row: any = null;
    let accessToken = token;

    if (typeof token === 'string' && token.length >= 32) {
      const tokenHash = await hash(token);

      const { data, error } = await db
        .from('orders')
        .select(
          'id,order_number,customer_name,customer_email,currency,total_amount,supplier_total,payment_status,fulfillment_status,tracking_number,shipping_carrier,created_at,access_token_expires_at,transfer_reference,transfer_submitted_at',
        )
        .eq('access_token_hash', tokenHash)
        .maybeSingle();

      if (error) throw error;

      row = data;

      if (
        row?.access_token_expires_at &&
        new Date(row.access_token_expires_at) < new Date()
      ) {
        row = null;
      }
    } else if (
      typeof order_number === 'string' &&
      typeof email === 'string'
    ) {
      const { data, error } = await db
        .from('orders')
        .select(
          'id,order_number,customer_name,customer_email,currency,total_amount,supplier_total,payment_status,fulfillment_status,tracking_number,shipping_carrier,created_at,transfer_reference,transfer_submitted_at',
        )
        .eq('order_number', order_number.trim())
        .ilike('customer_email', email.trim())
        .maybeSingle();

      if (error) throw error;

      row = data;

      if (row) {
        accessToken = newToken();
        const tokenHash = await hash(accessToken);

        const { error: tokenError } = await db
          .from('orders')
          .update({
            access_token_hash: tokenHash,
            access_token_expires_at: new Date(
              Date.now() + 1000 * 60 * 60 * 24 * 30,
            ).toISOString(),
          })
          .eq('id', row.id);

        if (tokenError) throw tokenError;
      }
    }

    if (!row) {
      return json(
        {
          error:
            'We could not find an order matching those details, or the link is invalid.',
        },
        404,
      );
    }

    // Load products, customer-visible updates, and business settings
    const [items, updates, settings] = await Promise.all([
      db
        .from('order_items')
        .select(
          'id,product_name,quantity,unit_price,line_total,image_url',
        )
        .eq('order_id', row.id),

      db
        .from('order_updates')
        .select('status,message,created_at')
        .eq('order_id', row.id)
        .eq('visible_to_customer', true)
        .order('created_at', { ascending: false }),

      db
        
db
  .from('app_settings')
  .select(
    'business_name,currency,bank_name,account_name,account_number,bank_instructions,support_email,supplier_name,supplier_contact_name,supplier_address,supplier_email,supplier_chat_url,supplier_store_url,shipment_address,shipment_origin,shipment_method,shipment_incoterms',
  )
  .limit(1)
  .maybeSingle(),


    if (items.error) throw items.error;
    if (updates.error) throw updates.error;
    if (settings.error) throw settings.error;

    return json({
      order: row,
      items: items.data || [],
      updates: updates.data || [],
      settings: settings.data || {},
      access_token: accessToken,
    });
  } catch (error) {
    console.error(error);

    return json(
      {
        error:
          'Unable to process this request. Please try again later.',
      },
      500,
    );
  }
});