import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type, x-order-token','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
const hash=async(v:string)=>{const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v));return Array.from(new Uint8Array(d)).map(x=>x.toString(16).padStart(2,'0')).join('');};
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});if(req.method!=='POST')return json({error:'Method not allowed'},405);
 try{
  const {order_id}=await req.json();const auth=req.headers.get('Authorization');if(!auth)return json({error:'Unauthorized'},401);
  const url=Deno.env.get('SUPABASE_URL')!, anon=Deno.env.get('SUPABASE_ANON_KEY')!, service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}}});const {data:{user}}=await userClient.auth.getUser();
  const db=createClient(url,service);let order:any=null;
  if(user){const {data}=await db.from('orders').select('*').eq('id',order_id).maybeSingle();order=data;}
  else { // Public page requests must carry its private access token; the client supplies it in x-order-token.
   const token=req.headers.get('x-order-token');if(token){const tokenHash=await hash(token);const {data}=await db.from('orders').select('*').eq('id',order_id).eq('access_token_hash',tokenHash).maybeSingle();order=data;}
  }
  if(!order)return json({error:'Order not found or access denied.'},404);if(order.payment_status==='Paid'||order.payment_status==='Cancelled')return json({error:'This order cannot accept payment in its current status.'},409);
  const secret=Deno.env.get('FLUTTERWAVE_SECRET_KEY');if(!secret)return json({error:'Online payment is not configured yet. Please use bank transfer or contact support.'},503);
  const ref=`od_${order.order_number}_${crypto.randomUUID().slice(0,8)}`;const {data:settings}=await db.from('app_settings').select('business_name').limit(1).maybeSingle();
  const body={tx_ref:ref,amount:Number(order.total_amount),currency:order.currency||'USD',redirect_url:`${Deno.env.get('APP_BASE_URL')||req.headers.get('origin')||''}/?order=${encodeURIComponent(req.headers.get('x-order-token')||'')}`,customer:{email:order.customer_email||'orders@example.com',name:order.customer_name},customizations:{title:settings?.business_name||'OrderDesk',description:`Payment for order ${order.order_number}`},meta:{order_id:order.id}};
  const response=await fetch('https://api.flutterwave.com/v3/payments',{method:'POST',headers:{Authorization:`Bearer ${secret}`,'Content-Type':'application/json'},body:JSON.stringify(body)});const result=await response.json();if(!response.ok||result.status!=='success')throw new Error('Payment provider could not start checkout.');
  await db.from('payments').insert({order_id:order.id,provider:'flutterwave',provider_reference:ref,amount:order.total_amount,currency:order.currency,status:'Pending',metadata:{checkout_link:result.data.link}});return json({checkout_url:result.data.link});
 }catch(e){console.error(e);return json({error:e instanceof Error?e.message:'Could not create checkout.'},500);}
});
