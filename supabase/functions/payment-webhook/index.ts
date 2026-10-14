import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
Deno.serve(async req=>{
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 try{
  const secret=Deno.env.get('FLUTTERWAVE_SECRET_HASH');const signature=req.headers.get('verif-hash');if(!secret||!signature||signature!==secret)return json({error:'Invalid signature'},401);
  const event=await req.json();if(event?.event!=='charge.completed'||event?.data?.status!=='successful')return json({received:true});
  const transactionId=String(event.data.id);const providerSecret=Deno.env.get('FLUTTERWAVE_SECRET_KEY');if(!providerSecret)return json({error:'Gateway not configured'},500);
  const verify=await fetch(`https://api.flutterwave.com/v3/transactions/${encodeURIComponent(transactionId)}/verify`,{headers:{Authorization:`Bearer ${providerSecret}`}});const verified=await verify.json();const tx=verified?.data;
  if(!verify.ok||verified.status!=='success'||tx?.status!=='successful')return json({error:'Transaction verification failed'},400);
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);const ref=String(tx.tx_ref||'');const {data:payment,error}=await db.from('payments').select('*').eq('provider_reference',ref).maybeSingle();if(error)throw error;if(!payment)return json({error:'Payment reference not found'},404);
  if(Number(tx.amount)!==Number(payment.amount)||String(tx.currency).toUpperCase()!==String(payment.currency).toUpperCase())return json({error:'Amount or currency mismatch'},400);
  await db.from('payments').update({status:'Successful',provider_transaction_id:transactionId,verified_at:new Date().toISOString(),metadata:{flutterwave_transaction_id:transactionId}}).eq('id',payment.id);
  await db.from('orders').update({payment_status:'Paid'}).eq('id',payment.order_id);await db.from('order_updates').insert({order_id:payment.order_id,status:'Paid',message:'Payment was confirmed by the payment provider.',visible_to_customer:true});return json({received:true});
 }catch(e){console.error(e);return json({error:'Webhook processing failed'},500);}
});
