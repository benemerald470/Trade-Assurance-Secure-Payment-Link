import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
const hash=async(v:string)=>{const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v));return Array.from(new Uint8Array(d)).map(x=>x.toString(16).padStart(2,'0')).join('');};
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});if(req.method!=='POST')return json({error:'Method not allowed'},405);
 try{
  const auth=req.headers.get('Authorization');if(!auth)return json({error:'Unauthorized'},401);
  const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}}});const {data:{user},error:userErr}=await userClient.auth.getUser();if(userErr||!user)return json({error:'Unauthorized'},401);
  const db=createClient(url,service);const {data:profile}=await db.from('profiles').select('role').eq('id',user.id).maybeSingle();if(profile?.role!=='admin')return json({error:'Admin access required.'},403);
  const {order_id}=await req.json();if(typeof order_id!=='string')return json({error:'Order ID required.'},400);
  const token=`${crypto.randomUUID().replaceAll('-','')}${crypto.randomUUID().replaceAll('-','')}`;const tokenHash=await hash(token);const expiry=new Date(Date.now()+1000*60*60*24*30).toISOString();const {error}=await db.from('orders').update({access_token_hash:tokenHash,access_token_expires_at:expiry}).eq('id',order_id);if(error)throw error;
  return json({token,expires_at:expiry});
 }catch(e){console.error(e);return json({error:'Unable to generate a buyer link.'},500);}
});
