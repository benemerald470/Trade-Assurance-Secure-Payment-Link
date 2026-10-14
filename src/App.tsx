import { useEffect, useMemo, useState } from 'react';
import { supabase, configured, money, dateLabel, shortId } from './lib';
import { Activity, ArrowDownLeft, ArrowUpRight, Banknote, Box, CheckCircle2, ChevronRight, ShoppingCart, MapPin, Flag, Plane, CircleDollarSign, Clipboard, ExternalLink, FileText, Globe, Timer, LayoutDashboard, Link2, LogOut, Package, Plus, Search, Settings, ShieldCheck, Users, Wallet, Hourglass,ClipboardList, CreditCard, Truck, PackageCheck, Star, MessagesSquare, Store } from 'lucide-react';

type Product = { id:string; name:string; supplier_url:string|null; supplier_name:string|null; supplier_cost:number; default_price:number; currency:string; sku:string|null; stock_status:string; created_at:string };
type Order = { id:string; order_number:string; customer_name:string; customer_email:string|null; currency:string; total_amount:number; supplier_total:number; payment_status:string; fulfillment_status:string; access_token_hash:string|null; created_at:string; tracking_number:string|null; shipping_carrier:string|null; notes:string|null };
type Tab = 'Overview'|'Orders'|'Products'|'Customers'|'Supplier payments'|'Settings';
const tabs: {label:Tab;icon:any}[] = [{label:'Overview',icon:LayoutDashboard},{label:'Orders',icon:FileText},{label:'Products',icon:Package},{label:'Customers',icon:Users},{label:'Supplier payments',icon:Wallet},{label:'Settings',icon:Settings}];
const moneyCurrency = (value:number,currency:string) => money(value,currency || 'USD');
const statusClass = (status:string) => `status status-${(status||'pending').toLowerCase().replaceAll(' ','-')}`;
async function sha256(value:string) { const bytes = new TextEncoder().encode(value); const digest = await crypto.subtle.digest('SHA-256', bytes); return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join(''); }
function makeToken(){ return `${crypto.randomUUID().replaceAll('-','')}${crypto.randomUUID().replaceAll('-','')}`; }

export default function App(){
  const params = new URLSearchParams(window.location.search);
  const publicToken = params.get('order');
  const publicLookup = params.get('track') === '1';
  const [session,setSession] = useState<any>(null);
  const [loading,setLoading] = useState(true);
  const [tab,setTab] = useState<Tab>('Overview');
  const [products,setProducts] = useState<Product[]>([]);
  const [orders,setOrders] = useState<Order[]>([]);
  const [supplierPayments,setSupplierPayments] = useState<any[]>([]);
  const [search,setSearch] = useState('');
  const [notice,setNotice] = useState('');
  const [busy,setBusy] = useState(false);
  const [email,setEmail] = useState(''); const [password,setPassword] = useState('');
  const [showProduct,setShowProduct] = useState(false); const [showOrder,setShowOrder] = useState(false);
  const [publicOrder,setPublicOrder] = useState<any>(null); const [publicError,setPublicError] = useState(''); const [lookupCode,setLookupCode] = useState(''); const [lookupEmail,setLookupEmail] = useState('');
  
const [settings,setSettings] = useState<any>({
  business_name: 'OrderDesk',
  currency: 'USD',
  bank_name: '',
  account_name: '',
  account_number: '',
  bank_instructions: '',
  support_email: '',
  supplier_name: '',
  supplier_contact_name: '',
  supplier_address: '',
  supplier_email: '',
    supplier_chat_url: '',
  supplier_store_url: '',
  shipment_address: '',
  shipment_origin: '',
  shipment_method: '',
  shipment_incoterms: ''
});

  const [productForm,setProductForm] = useState<any>({name:'',supplier_url:'',supplier_name:'Alibaba supplier',supplier_cost:'',default_price:'',currency:'USD',sku:'',stock_status:'Available'});
  const [orderForm,setOrderForm] = useState<any>({customer_name:'',customer_email:'',currency:'USD',product_id:'',quantity:'1',unit_price:'',supplier_unit_cost:'',shipping_charge:'0',notes:''});
  const [orderDetail,setOrderDetail] = useState<Order|null>(null);

  useEffect(()=>{ if(!configured){setLoading(false);return;} supabase.auth.getSession().then(({data})=>{setSession(data.session);setLoading(false);}); const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,s)=>{setSession(s);}); return ()=>subscription.unsubscribe(); },[]);
  useEffect(()=>{ if(session) loadData(); },[session]);
  useEffect(()=>{ if(publicToken) loadPublicOrder(publicToken); },[publicToken]);
  async function loadData(){
    setBusy(true); const [p,o,sp,st] = await Promise.all([
      supabase.from('products').select('*').order('created_at',{ascending:false}),
      supabase.from('orders').select('*').order('created_at',{ascending:false}),
      supabase.from('supplier_payments').select('*, orders(order_number,customer_name)').order('created_at',{ascending:false}),
      supabase.from('app_settings').select('*').limit(1).maybeSingle()
    ]);
    if(p.error||o.error){setNotice((p.error||o.error)?.message||'Unable to load data.');}
    setProducts((p.data||[]) as Product[]); setOrders((o.data||[]) as Order[]); setSupplierPayments(sp.data||[]); if(st.data) setSettings(st.data); setBusy(false);
  }
  async function loadPublicOrder(token:string){ setLoading(true); setPublicError(''); try{ const {data,error}=await supabase.functions.invoke('public-order',{body:{token}}); if(error) throw error; if(!data?.order) throw new Error('This order link is invalid or has expired.'); setPublicOrder(data); }catch(e:any){setPublicError(e.message||'Could not load this order.');}finally{setLoading(false);} }
  async function login(e:any){e.preventDefault();setBusy(true);setNotice('');const {error}=await supabase.auth.signInWithPassword({email,password});if(error)setNotice(error.message);setBusy(false);}
  async function logout(){await supabase.auth.signOut();setSession(null);}
  async function addProduct(e:any){e.preventDefault();setBusy(true);setNotice('');const row={name:productForm.name.trim(),supplier_url:productForm.supplier_url||null,supplier_name:productForm.supplier_name||null,supplier_cost:Number(productForm.supplier_cost||0),default_price:Number(productForm.default_price||0),currency:productForm.currency,sku:productForm.sku||null,stock_status:productForm.stock_status};const {error}=await supabase.from('products').insert(row);if(error)setNotice(error.message);else{setShowProduct(false);setProductForm({name:'',supplier_url:'',supplier_name:'Alibaba supplier',supplier_cost:'',default_price:'',currency:'USD',sku:'',stock_status:'Available'});await loadData();setNotice('Product added.');}setBusy(false);}
  async function addOrder(e:any){e.preventDefault();setBusy(true);setNotice('');try{
    const product=products.find(p=>p.id===orderForm.product_id); if(!product)throw new Error('Choose a product.');
    const quantity=Math.max(1,Number(orderForm.quantity||1));const unitPrice=Number(orderForm.unit_price||product.default_price);const supplierCost=Number(orderForm.supplier_unit_cost||product.supplier_cost);const shipping=Number(orderForm.shipping_charge||0);const total=unitPrice*quantity+shipping;const supplierTotal=supplierCost*quantity;
    const token=makeToken();const tokenHash=await sha256(token);const orderNumber=`OD-${new Date().getFullYear()}-${Math.random().toString(36).slice(2,8).toUpperCase()}`;
    const {data,error}=await supabase.from('orders').insert({order_number:orderNumber,customer_name:orderForm.customer_name,customer_email:orderForm.customer_email||null,currency:orderForm.currency,total_amount:total,supplier_total:supplierTotal,payment_status:'Awaiting Payment',fulfillment_status:'Order Placed',access_token_hash:tokenHash,access_token_expires_at:new Date(Date.now()+1000*60*60*24*30).toISOString(),notes:orderForm.notes||null}).select().single();if(error)throw error;
    const {error:itemError}=await supabase.from('order_items').insert({order_id:data.id,product_id:product.id,product_name:product.name,quantity,unit_price:unitPrice,supplier_unit_cost:supplierCost,line_total:unitPrice*quantity});if(itemError)throw itemError;
    const {error:payError}=await supabase.from('supplier_payments').insert({order_id:data.id,supplier_name:product.supplier_name||'Alibaba supplier',amount:supplierTotal,currency:orderForm.currency,status:'Unpaid'});if(payError)throw payError;
    const link=`${window.location.origin}${window.location.pathname}?order=${encodeURIComponent(token)}`;setShowOrder(false);setOrderForm({customer_name:'',customer_email:'',currency:'USD',product_id:'',quantity:'1',unit_price:'',supplier_unit_cost:'',shipping_charge:'0',notes:''});await loadData();setOrderDetail({...data,access_token_hash:null} as Order);setNotice(`Order ${orderNumber} created. The private buyer link has been copied to your clipboard (if browser permissions allow). Save it now; it cannot be recovered from the stored hash.`);setTimeout(()=>{void GenCopyHint(link);},0);
    }catch(err:any){setNotice(err.message||'Unable to create order.');}finally{setBusy(false);}}
  async function saveSettings(e:any){e.preventDefault();setBusy(true);const payload={...settings};delete payload.id;const {data:existing}=await supabase.from('app_settings').select('id').limit(1).maybeSingle();const result=existing?await supabase.from('app_settings').update(payload).eq('id',existing.id):await supabase.from('app_settings').insert(payload);setNotice(result.error?.message||'Settings saved.');setBusy(false);}
  async function lookupOrder(e:any){e.preventDefault();setPublicError('');setBusy(true);try{const {data,error}=await supabase.functions.invoke('public-order',{body:{order_number:lookupCode.trim(),email:lookupEmail.trim()}});if(error)throw error;if(!data?.order)throw new Error('We could not find an order matching those details.');setPublicOrder(data);}catch(e:any){setPublicError(e.message||'Could not find your order.');}finally{setBusy(false);}}
  const filteredOrders=useMemo(()=>orders.filter(o=>`${o.order_number} ${o.customer_name} ${o.customer_email||''}`.toLowerCase().includes(search.toLowerCase())),[orders,search]);
  const totalRevenue=orders.filter(o=>o.payment_status==='Paid').reduce((a,o)=>a+Number(o.total_amount),0);const receivable=orders.filter(o=>o.payment_status!=='Paid'&&o.payment_status!=='Cancelled').reduce((a,o)=>a+Number(o.total_amount),0);const margin=orders.filter(o=>o.payment_status==='Paid').reduce((a,o)=>a+Number(o.total_amount)-Number(o.supplier_total),0);


if (publicToken || publicLookup) {
  return (
    <PublicPage
      loading={publicToken ? loading : false}
      data={publicToken ? publicOrder : null}
      error={publicError}
      settings={settings}
      onReload={() => {
        if (publicToken) {
          void loadPublicOrder(publicToken);
        }
      }}
    />
  );
}
  if(!configured) return <SetupScreen />;
  if(loading) return <div className="loading-screen"><div className="brand-mark">OD</div><p>Loading your workspace…</p></div>;
  if(!session) return <div className="auth-shell"><div className="auth-visual"><div className="brand brand-light"><span className="brand-mark">OD</span><span>OrderDesk</span></div><div className="auth-copy"><span className="eyebrow">YOUR SOURCING, SIMPLIFIED</span><h1>Every order.<br/>One clear view.</h1><p>Manage products, payments, suppliers and deliveries from one private workspace.</p><div className="auth-stats"><div><strong>01</strong><span>Orders</span></div><div><strong>02</strong><span>Payments</span></div><div><strong>03</strong><span>Fulfilment</span></div></div></div><div className="auth-foot">Private operations workspace · Built for your business</div></div><div className="auth-panel"><form className="login-form" onSubmit={login}><span className="eyebrow">ADMIN ACCESS</span><h2>Welcome back</h2><p>Sign in to manage your orders and customers.</p><label>Email address<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@company.com" autoComplete="username"/></label><label>Password<input type="password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password" autoComplete="current-password"/></label>{notice&&<div className="alert error">{notice}</div>}<button className="btn primary full" disabled={busy}>{busy?'Signing in…':'Sign in securely'}<ChevronRight size={17}/></button><div className="secure-note"><ShieldCheck size={15}/> Only authorized administrators can access this area.</div></form></div></div>;



  return <div className="app-shell"><aside className="sidebar"><div className="brand"><span className="brand-mark">OD</span><span>{settings.business_name||'OrderDesk'}<small>ORDER MANAGEMENT</small></span></div><div className="side-label">WORKSPACE</div><nav>{tabs.map(({label,icon:Icon})=><button key={label} className={`nav-item ${tab===label?'active':''}`} onClick={()=>setTab(label)}><Icon size={18}/><span>{label}</span>{label==='Orders'&&orders.filter(o=>o.payment_status==='Awaiting Payment').length>0&&<i>{orders.filter(o=>o.payment_status==='Awaiting Payment').length}</i>}</button>)}</nav><div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><ShieldCheck size={17}/></div><strong>Your workspace is private</strong><p>Customer links reveal only the order they belong to.</p></div><button className="profile-row" onClick={logout}><div className="avatar">{(session.user.email||'A').slice(0,1).toUpperCase()}</div><div className="profile-copy"><strong>Administrator</strong><span>{session.user.email}</span></div><LogOut size={16}/></button></div></aside>
    <main className="main-area"><header className="topbar"><div className="breadcrumbs"><span>Workspace</span><ChevronRight size={14}/><strong>{tab}</strong></div><div className="top-actions"><span className="live-dot">Workspace active</span><button className="icon-button" title="Refresh data" onClick={loadData}><Activity size={17}/></button><button className="btn primary small" onClick={()=>setShowOrder(true)}><Plus size={16}/> Create order</button></div></header>
      <div className="page-content"><div className="page-heading"><div><span className="eyebrow">OPERATIONS / {tab.toUpperCase()}</span><h1>{tab==='Overview'?'Good work starts with clarity.':tab}</h1><p>{tab==='Overview'?'A live snapshot of your orders, collections and supplier commitments.':tab==='Orders'?'Create and track customer orders from purchase to delivery.':tab==='Products'?'Keep your Alibaba sourcing links, costs and selling prices organized.':tab==='Customers'?'Customers appear here as you create orders.':'Keep your supplier settlements and business preferences up to date.'}</p></div>{tab==='Orders'&&<button className="btn primary" onClick={()=>setShowOrder(true)}><Plus size={16}/> Create order</button>}{tab==='Products'&&<button className="btn primary" onClick={()=>setShowProduct(true)}><Plus size={16}/> Add product</button>}</div>
      {notice&&<div className="notice"><CheckCircle2 size={16}/><span>{notice}</span><button onClick={()=>setNotice('')}>×</button></div>}
      {tab==='Overview'&&<><div className="metrics-grid"><Metric icon={CircleDollarSign} label="Collected revenue" value={moneyCurrency(totalRevenue,settings.currency)} sub="Paid customer orders" trend="Received" positive/><Metric icon={ArrowDownLeft} label="Awaiting payment" value={moneyCurrency(receivable,settings.currency)} sub="Open customer balances" trend={`${orders.filter(o=>o.payment_status!=='Paid'&&o.payment_status!=='Cancelled').length} orders`} /><Metric icon={Package} label="Active orders" value={String(orders.filter(o=>!['Delivered','Cancelled'].includes(o.fulfillment_status)).length).padStart(2,'0')} sub="Not yet delivered" trend="In progress"/><Metric icon={ArrowUpRight} label="Gross margin · paid" value={moneyCurrency(margin,settings.currency)} sub="Revenue less recorded supplier cost" trend="Estimated" positive/></div><div className="content-grid"><section className="panel recent-panel"><div className="panel-heading"><div><h3>Recent orders</h3><p>Your latest customer activity</p></div><button className="text-button" onClick={()=>setTab('Orders')}>View all <ChevronRight size={15}/></button></div><OrdersTable orders={orders.slice(0,6)} onSelect={setOrderDetail}/></section><section className="panel quick-panel"><div className="panel-heading"><div><h3>Quick actions</h3><p>Keep work moving</p></div></div><button className="quick-action" onClick={()=>setShowOrder(true)}><span className="quick-icon green"><Plus size={18}/></span><span><strong>Create customer order</strong><small>Set price, cost and payment link</small></span><ChevronRight size={17}/></button><button className="quick-action" onClick={()=>setShowProduct(true)}><span className="quick-icon sand"><Package size={18}/></span><span><strong>Add sourced product</strong><small>Save an Alibaba product URL</small></span><ChevronRight size={17}/></button><button className="quick-action" onClick={()=>setTab('Supplier payments')}><span className="quick-icon blue"><Wallet size={18}/></span><span><strong>Review supplier payments</strong><small>See what you still need to pay</small></span><ChevronRight size={17}/></button><div className="tip-card"><Globe size={18}/><div><strong>Buyer-friendly order links</strong><p>Share a private order link with each customer. They won't see your supplier costs.</p></div></div></section></div><div className="bottom-grid"><section className="panel"><div className="panel-heading"><div><h3>Payment overview</h3><p>Current order status breakdown</p></div></div><div className="payment-breakdown">{['Paid','Awaiting Payment','Pending Verification','Partially Paid','Failed'].map(s=><div className="break-row" key={s}><span className={`legend-dot ${s==='Paid'?'dot-green':s==='Awaiting Payment'?'dot-orange':s==='Pending Verification'?'dot-blue':'dot-gray'}`}/><span>{s}</span><strong>{orders.filter(o=>o.payment_status===s).length}</strong></div>)}</div></section><section className="panel"><div className="panel-heading"><div><h3>Supplier commitments</h3><p>Recorded cost for orders not yet settled</p></div><button className="text-button" onClick={()=>setTab('Supplier payments')}>Manage <ChevronRight size={15}/></button></div><div className="supplier-summary"><span className="supplier-summary-icon"><Truck size={19}/></span><div><small>Unpaid supplier total</small><strong>{moneyCurrency(supplierPayments.filter(p=>p.status!=='Paid').reduce((a,p)=>a+Number(p.amount),0),settings.currency)}</strong></div><span className="supplier-count">{supplierPayments.filter(p=>p.status!=='Paid').length} open</span></div></section></div></>}
      {tab==='Orders'&&<section className="panel table-panel"><div className="panel-heading"><div><h3>All orders <span className="count-pill">{orders.length}</span></h3><p>Customer orders and private payment pages</p></div><div className="table-tools"><div className="search-box"><Search size={16}/><input placeholder="Search orders or customers" value={search} onChange={e=>setSearch(e.target.value)}/></div><button className="btn primary small" onClick={()=>setShowOrder(true)}><Plus size={15}/> New order</button></div></div><OrdersTable orders={filteredOrders} onSelect={setOrderDetail}/></section>}
      {tab==='Products'&&<section className="panel table-panel"><div className="panel-heading"><div><h3>Product library <span className="count-pill">{products.length}</span></h3><p>Supplier source links and your pricing</p></div><button className="btn primary small" onClick={()=>setShowProduct(true)}><Plus size={15}/> Add product</button></div>{products.length===0?<Empty icon={Box} title="No products yet" body="Add a product and save its Alibaba source URL to begin." action="Add your first product" onAction={()=>setShowProduct(true)}/>:<div className="table-wrap"><table><thead><tr><th>PRODUCT</th><th>SUPPLIER</th><th>SUPPLIER COST</th><th>SELLING PRICE</th><th>STOCK</th><th>SOURCE</th></tr></thead><tbody>{products.map(p=><tr key={p.id}><td><div className="product-cell"><span className="product-thumb"><Package size={18}/></span><span><strong>{p.name}</strong><small>{p.sku||'No SKU'}</small></span></div></td><td>{p.supplier_name||'—'}</td><td>{moneyCurrency(p.supplier_cost,p.currency)}</td><td><strong>{moneyCurrency(p.default_price,p.currency)}</strong></td><td><span className={statusClass(p.stock_status)}>{p.stock_status}</span></td><td>{p.supplier_url?<a className="source-link" href={p.supplier_url} target="_blank" rel="noreferrer">Open Alibaba <ExternalLink size={13}/></a>:'—'}</td></tr>)}</tbody></table></div>}</section>}
      {tab==='Customers'&&<section className="panel table-panel"><div className="panel-heading"><div><h3>Customers</h3><p>Customer records are created from your orders</p></div></div>{orders.length===0?<Empty icon={Users} title="No customers yet" body="Create your first order to start building your customer list."/>:<div className="table-wrap"><table><thead><tr><th>CUSTOMER</th><th>EMAIL</th><th>ORDERS</th><th>PAID TOTAL</th><th>LATEST ORDER</th></tr></thead><tbody>{Array.from(new Map(orders.map(o=>[o.customer_email||o.customer_name,o])).values()).map(o=><tr key={o.customer_email||o.customer_name}><td><div className="customer-cell"><span className="avatar">{o.customer_name.slice(0,1).toUpperCase()}</span><strong>{o.customer_name}</strong></div></td><td>{o.customer_email||'—'}</td><td>{orders.filter(x=>(x.customer_email||x.customer_name)===(o.customer_email||o.customer_name)).length}</td><td>{moneyCurrency(orders.filter(x=>(x.customer_email||x.customer_name)===(o.customer_email||o.customer_name)&&x.payment_status==='Paid').reduce((a,x)=>a+Number(x.total_amount),0),o.currency)}</td><td>{dateLabel(o.created_at)}</td></tr>)}</tbody></table></div>}</section>}
      {tab==='Supplier payments'&&<section className="panel table-panel"><div className="panel-heading"><div><h3>Supplier payments</h3><p>Separate from customer payments — mark paid only after paying your supplier.</p></div><div className="supplier-total"><small>Outstanding</small><strong>{moneyCurrency(supplierPayments.filter(p=>p.status!=='Paid').reduce((a,p)=>a+Number(p.amount),0),settings.currency)}</strong></div></div>{supplierPayments.length===0?<Empty icon={Wallet} title="No supplier payments recorded" body="Supplier payment entries are created with each new order."/>:<div className="table-wrap"><table><thead><tr><th>SUPPLIER</th><th>ORDER</th><th>AMOUNT</th><th>STATUS</th><th>PAID DATE</th><th>ACTION</th></tr></thead><tbody>{supplierPayments.map(p=><tr key={p.id}><td><strong>{p.supplier_name}</strong></td><td>{p.orders?.order_number||'—'}<small className="cell-sub">{p.orders?.customer_name||''}</small></td><td><strong>{moneyCurrency(p.amount,p.currency||settings.currency)}</strong></td><td><span className={statusClass(p.status)}>{p.status}</span></td><td>{dateLabel(p.paid_at)}</td><td>{p.status==='Paid'?<span className="muted">Settled</span>:<button className="btn subtle small" onClick={async()=>{const {error}=await supabase.from('supplier_payments').update({status:'Paid',paid_at:new Date().toISOString()}).eq('id',p.id);setNotice(error?.message||'Supplier payment marked paid.');loadData();}}>Mark paid</button>}</td></tr>)}</tbody></table></div>}</section>}

{tab==='Settings'&&<form className="settings-layout" onSubmit={saveSettings}>
  <section className="panel settings-panel">
    <div className="panel-heading"><div><h3>Business profile</h3><p>Branding and default currency for your workspace</p></div></div>
    <div className="form-grid">
      <label>Business name<input value={settings.business_name||''} onChange={e=>setSettings({...settings,business_name:e.target.value})} placeholder="Your business name"/></label>
      <label>Default currency<select value={settings.currency||'USD'} onChange={e=>setSettings({...settings,currency:e.target.value})}><option value="USD">USD — US Dollar</option><option value="NGN">NGN — Nigerian Naira</option><option value="GBP">GBP — Pound Sterling</option><option value="EUR">EUR — Euro</option><option value="CNY">CNY — Chinese Yuan</option></select></label>
      <label>Support email<input type="email" value={settings.support_email||''} onChange={e=>setSettings({...settings,support_email:e.target.value})} placeholder="support@yourbusiness.com"/></label>
    </div>
  </section>

  <section className="panel settings-panel">
    <div className="panel-heading"><div><h3>Bank transfer instructions</h3><p>Shown to buyers on their private order page. Verify transfers manually.</p></div><span className="status status-pending-verification">Manual verification</span></div>
    <div className="form-grid">
      <label>Bank name<input value={settings.bank_name||''} onChange={e=>setSettings({...settings,bank_name:e.target.value})} placeholder="Bank name"/></label>
      <label>Account name<input value={settings.account_name||''} onChange={e=>setSettings({...settings,account_name:e.target.value})} placeholder="Account holder"/></label>
      <label>Account number / IBAN<input value={settings.account_number||''} onChange={e=>setSettings({...settings,account_number:e.target.value})} placeholder="Account number"/></label>
      <label className="span-2">Transfer instructions<textarea value={settings.bank_instructions||''} onChange={e=>setSettings({...settings,bank_instructions:e.target.value})} placeholder="Include the order number in the transfer narration…" rows={3}/></label>
    </div>
    <div className="security-callout"><ShieldCheck size={18}/><p><strong>Payment security</strong><br/>Bank transfers remain pending until you verify the funds and update the order payment status. Never treat a receipt upload alone as proof of payment.</p></div>
    <button type="submit" className="btn primary" disabled={busy}>{busy?'Saving…':'Save settings'}</button>
  </section>

  <section className="panel settings-panel">
    <div className="panel-heading"><div><h3>Supplier information</h3><p>Details shown on buyer order pages.</p></div></div>
    <div className="form-grid">
      <label>Supplier name<input value={settings.supplier_name||''} onChange={e=>setSettings({...settings,supplier_name:e.target.value})} placeholder="Supplier business name"/></label>
      <label>Contact name<input value={settings.supplier_contact_name||''} onChange={e=>setSettings({...settings,supplier_contact_name:e.target.value})} placeholder="Contact person"/></label>
      <label className="span-2">Supplier address<textarea value={settings.supplier_address||''} onChange={e=>setSettings({...settings,supplier_address:e.target.value})} placeholder="Full supplier address" rows={3}/></label>
      <label>Supplier email<input type="email" value={settings.supplier_email||''} onChange={e=>setSettings({...settings,supplier_email:e.target.value})} placeholder="supplier@example.com"/></label>
      <label>Alibaba Chat URL<input type="url" value={settings.supplier_chat_url||''} onChange={e=>setSettings({...settings,supplier_chat_url:e.target.value})} placeholder="https://..."/></label>
      <label className="span-2">Alibaba Store URL<input type="url" value={settings.supplier_store_url||''} onChange={e=>setSettings({...settings,supplier_store_url:e.target.value})} placeholder="https://..."/></label>
    </div>
    <button type="submit" className="btn primary" disabled={busy}>{busy?'Saving…':'Save settings'}</button>
  </section>

  
<section className="panel settings-panel">
  <div className="panel-heading">
    <div>
      <h3>Shipment details</h3>
      <p>Manage the default shipping information shown on buyer order pages.</p>
    </div>
  </div>

  <div className="form-grid">
    <label className="span-2">
      Shipping address
      <input
        value={settings.shipment_address || ''}
        onChange={e =>
          setSettings({ ...settings, shipment_address: e.target.value })
        }
        placeholder="Enter shipping address"
      />
    </label>

    <label>
      Shipping origin
      <input
        value={settings.shipment_origin || ''}
        onChange={e =>
          setSettings({ ...settings, shipment_origin: e.target.value })
        }
        placeholder="e.g. China"
      />
    </label>

    <label>
      Shipping method
      <input
        value={settings.shipment_method || ''}
        onChange={e =>
          setSettings({ ...settings, shipment_method: e.target.value })
        }
        placeholder="e.g. Sea Freight, Air Freight"
      />
    </label>

    <label>
      Incoterms
      <select
        value={settings.shipment_incoterms || ''}
        onChange={e =>
          setSettings({ ...settings, shipment_incoterms: e.target.value })
        }
      >
        <option value="">Select Incoterms</option>
        <option value="EXW">EXW</option>
        <option value="FCA">FCA</option>
        <option value="FOB">FOB</option>
        <option value="CFR">CFR</option>
        <option value="CIF">CIF</option>
        <option value="CPT">CPT</option>
        <option value="CIP">CIP</option>
        <option value="DAP">DAP</option>
        <option value="DPU">DPU</option>
        <option value="DDP">DDP</option>
      </select>
    </label>
  </div>
</section>

<section className="panel settings-panel">
  <div className="panel-heading">
    <div>
      <h3>Online payments</h3>
      <p>
        Card and Apple Pay need a supported payment gateway configured on the server.
      </p>
    </div>
  </div>

  <div className="gateway-note">
    <div className="gateway-logo">FW</div>
    <div>
      <strong>Flutterwave integration</strong>
      <p>
        Starter backend functions are included. Add your secret key in
        Supabase Edge Function secrets and configure your webhook before
        accepting live payments.
      </p>
      <span className="status status-awaiting-payment">
        Not configured until keys are added
      </span>
    </div>
  </div>
</section>

</form>}
      
      <footer className="page-footer"><span>OrderDesk · Private business workspace</span><span><ShieldCheck size={13}/> Customer data is access-controlled</span></footer></div></main>
    {showProduct&&<Modal title="Add a sourced product" subtitle="Save product details and the original supplier listing." onClose={()=>setShowProduct(false)}><form onSubmit={addProduct} className="modal-form"><label>Product name<input required value={productForm.name} onChange={e=>setProductForm({...productForm,name:e.target.value})} placeholder="e.g. Wireless headphones"/></label><label>Alibaba product URL<input type="url" value={productForm.supplier_url} onChange={e=>setProductForm({...productForm,supplier_url:e.target.value})} placeholder="https://www.alibaba.com/product-detail/…"/></label><label>Supplier name<input value={productForm.supplier_name} onChange={e=>setProductForm({...productForm,supplier_name:e.target.value})} placeholder="Supplier or company name"/></label><div className="form-grid"><label>Supplier cost<input type="number" min="0" step="0.01" required value={productForm.supplier_cost} onChange={e=>setProductForm({...productForm,supplier_cost:e.target.value})}/></label><label>Customer price<input type="number" min="0" step="0.01" required value={productForm.default_price} onChange={e=>setProductForm({...productForm,default_price:e.target.value})}/></label><label>Currency<select value={productForm.currency} onChange={e=>setProductForm({...productForm,currency:e.target.value})}><option>USD</option><option>NGN</option><option>GBP</option><option>EUR</option><option>CNY</option></select></label><label>SKU / internal code<input value={productForm.sku} onChange={e=>setProductForm({...productForm,sku:e.target.value})} placeholder="Optional"/></label></div><label>Availability<select value={productForm.stock_status} onChange={e=>setProductForm({...productForm,stock_status:e.target.value})}><option>Available</option><option>Check with supplier</option><option>Out of stock</option></select></label><div className="modal-actions"><button type="button" className="btn subtle" onClick={()=>setShowProduct(false)}>Cancel</button><button className="btn primary" disabled={busy}>{busy?'Saving…':'Save product'}</button></div></form></Modal>}
    {showOrder&&<Modal title="Create customer order" subtitle="Create a buyer order and generate a private access link." onClose={()=>setShowOrder(false)} wide><form onSubmit={addOrder} className="modal-form"><div className="form-grid"><label>Customer name<input required value={orderForm.customer_name} onChange={e=>setOrderForm({...orderForm,customer_name:e.target.value})} placeholder="Customer full name"/></label><label>Customer email<input type="email" value={orderForm.customer_email} onChange={e=>setOrderForm({...orderForm,customer_email:e.target.value})} placeholder="customer@example.com"/></label><label className="span-2">Product<select required value={orderForm.product_id} onChange={e=>{const p=products.find(x=>x.id===e.target.value);setOrderForm({...orderForm,product_id:e.target.value,unit_price:p?.default_price??'',supplier_unit_cost:p?.supplier_cost??'',currency:p?.currency||'USD'});}}><option value="">Choose a product</option>{products.map(p=><option key={p.id} value={p.id}>{p.name} — {moneyCurrency(p.default_price,p.currency)}</option>)}</select>{products.length===0&&<small className="field-hint">Add a product first to create an order.</small>}</label><label>Quantity<input type="number" min="1" step="1" required value={orderForm.quantity} onChange={e=>setOrderForm({...orderForm,quantity:e.target.value})}/></label><label>Currency<select value={orderForm.currency} onChange={e=>setOrderForm({...orderForm,currency:e.target.value})}><option>USD</option><option>NGN</option><option>GBP</option><option>EUR</option><option>CNY</option></select></label><label>Unit selling price<input type="number" min="0" step="0.01" required value={orderForm.unit_price} onChange={e=>setOrderForm({...orderForm,unit_price:e.target.value})}/></label><label>Supplier unit cost<input type="number" min="0" step="0.01" required value={orderForm.supplier_unit_cost} onChange={e=>setOrderForm({...orderForm,supplier_unit_cost:e.target.value})}/></label><label>Shipping charged to customer<input type="number" min="0" step="0.01" value={orderForm.shipping_charge} onChange={e=>setOrderForm({...orderForm,shipping_charge:e.target.value})}/></label><label className="span-2">Internal notes<textarea rows={2} value={orderForm.notes} onChange={e=>setOrderForm({...orderForm,notes:e.target.value})} placeholder="Optional internal notes"/></label></div><div className="order-estimate"><div><small>Customer total</small><strong>{moneyCurrency((Number(orderForm.unit_price||0)*Number(orderForm.quantity||1))+Number(orderForm.shipping_charge||0),orderForm.currency)}</strong></div><div><small>Supplier cost</small><strong>{moneyCurrency(Number(orderForm.supplier_unit_cost||0)*Number(orderForm.quantity||1),orderForm.currency)}</strong></div><div><small>Gross margin estimate</small><strong>{moneyCurrency((Number(orderForm.unit_price||0)-Number(orderForm.supplier_unit_cost||0))*Number(orderForm.quantity||1)+Number(orderForm.shipping_charge||0),orderForm.currency)}</strong></div></div><div className="modal-actions"><button type="button" className="btn subtle" onClick={()=>setShowOrder(false)}>Cancel</button><button className="btn primary" disabled={busy||products.length===0}>{busy?'Creating…':'Create order'}</button></div></form></Modal>}
    {orderDetail&&<OrderDetailModal order={orderDetail} onClose={()=>setOrderDetail(null)} onUpdated={loadData} settings={settings}/>}



  </div>;
}

function GenCopyHint(link:string){ try { navigator.clipboard.writeText(link); } catch {} }
function SetupScreen(){return <div className="setup-screen"><div className="setup-card"><div className="brand-mark">OD</div><span className="eyebrow">ONE-TIME SETUP</span><h1>Connect your workspace</h1><p>The frontend is ready. Add your Supabase project URL and anon key to a local <code>.env</code> file to connect the database and sign-in.</p><pre>VITE_SUPABASE_URL=https://your-project.supabase.co{`\n`}VITE_SUPABASE_ANON_KEY=your-anon-key</pre><p className="muted">Then run <code>npm install</code> and <code>npm run dev</code>. Follow SETUP.md to create the database and deploy the secure Edge Functions.</p></div></div>}
function Metric({icon:Icon,label,value,sub,trend,positive}:any){return <div className="metric-card"><div className="metric-top"><span className="metric-icon"><Icon size={18}/></span><span className={`metric-tag ${positive?'tag-green':''}`}>{trend}</span></div><span className="metric-label">{label}</span><strong className="metric-value">{value}</strong><span className="metric-sub">{sub}</span></div>}
function OrdersTable({orders,onSelect}:{orders:Order[];onSelect:(o:Order)=>void}){if(!orders.length)return <div className="empty-inline"><FileText size={23}/><span>No orders match yet.</span></div>;return <div className="table-wrap"><table><thead><tr><th>ORDER</th><th>CUSTOMER</th><th>DATE</th><th>AMOUNT</th><th>PAYMENT</th><th>FULFILMENT</th><th></th></tr></thead><tbody>{orders.map(o=><tr key={o.id} className="click-row" onClick={()=>onSelect(o)}><td><strong className="order-number">{o.order_number}</strong><small className="cell-sub">{shortId(o.id)}</small></td><td><div className="customer-cell"><span className="avatar">{o.customer_name.slice(0,1).toUpperCase()}</span><span><strong>{o.customer_name}</strong><small>{o.customer_email||'No email provided'}</small></span></div></td><td>{dateLabel(o.created_at)}</td><td><strong>{moneyCurrency(o.total_amount,o.currency)}</strong></td><td><span className={statusClass(o.payment_status)}>{o.payment_status}</span></td><td><span className={statusClass(o.fulfillment_status)}>{o.fulfillment_status}</span></td><td><ChevronRight size={16} className="row-chevron"/></td></tr>)}</tbody></table></div>}
function Empty({icon:Icon,title,body,action,onAction}:any){return <div className="empty-state"><span className="empty-icon"><Icon size={23}/></span><h3>{title}</h3><p>{body}</p>{action&&<button className="btn primary" onClick={onAction}><Plus size={15}/>{action}</button>}</div>}
function Modal({title,subtitle,onClose,children,wide}:any){return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><div className={`modal ${wide?'modal-wide':''}`}><div className="modal-header"><div><h2>{title}</h2><p>{subtitle}</p></div><button className="close-button" onClick={onClose}>×</button></div>{children}</div></div>}
function OrderDetailModal({order,onClose,onUpdated,settings}:any){const [detail,setDetail]=useState<any>(null);const [status,setStatus]=useState(order.payment_status);const [fulfillment,setFulfillment]=useState(order.fulfillment_status);const [tracking,setTracking]=useState(order.tracking_number||'');const [carrier,setCarrier]=useState(order.shipping_carrier||'');const [busy,setBusy]=useState(false);const [err,setErr]=useState('');const [link,setLink]=useState('');useEffect(()=>{(async()=>{const [items,events]=await Promise.all([supabase.from('order_items').select('*').eq('order_id',order.id),supabase.from('order_updates').select('*').eq('order_id',order.id).order('created_at',{ascending:false})]);setDetail({items:items.data||[],events:events.data||[]});})();},[order.id]);
 useEffect(()=>{(async()=>{const {data}=await supabase.from('orders').select('access_token_hash').eq('id',order.id).maybeSingle(); if(data?.access_token_hash){/* original token cannot be reconstructed from hash; links are generated once at creation */setLink('');}})();},[order.id]);
 async function save(){setBusy(true);const {error}=await supabase.from('orders').update({payment_status:status,fulfillment_status:fulfillment,tracking_number:tracking||null,shipping_carrier:carrier||null}).eq('id',order.id);if(error)setErr(error.message);else{setErr('');onUpdated();onClose();}setBusy(false);}
 async function copyOrder(){try{await navigator.clipboard.writeText(order.order_number);setErr('Order number copied.');}catch{setErr(order.order_number);}}
 async function generateLink(){setBusy(true);setErr('');try{const {data,error}=await supabase.functions.invoke('generate-order-link',{body:{order_id:order.id}});if(error)throw error;if(!data?.token)throw new Error('Could not generate link.');const url=`${window.location.origin}${window.location.pathname}?order=${encodeURIComponent(data.token)}`;await navigator.clipboard.writeText(url);setErr('New private buyer link copied. It expires in 30 days; share it only with this customer.');}catch(e:any){setErr(e.message||'Could not generate link.');}finally{setBusy(false);}}
 return <Modal title={order.order_number} subtitle={`Created ${dateLabel(order.created_at)} · ${order.customer_name}`} onClose={onClose} wide><div className="detail-content"><div className="detail-summary"><div><small>Customer total</small><strong>{moneyCurrency(order.total_amount,order.currency)}</strong></div><div><small>Supplier cost</small><strong>{moneyCurrency(order.supplier_total,order.currency)}</strong></div><div><small>Payment status</small><span className={statusClass(order.payment_status)}>{order.payment_status}</span></div></div><div className="detail-two-col"><section><h4>Order items</h4>{detail?.items?.length?detail.items.map((i:any)=><div className="detail-item" key={i.id}><span className="product-thumb"><Package size={17}/></span><div><strong>{i.product_name}</strong><small>{i.quantity} × {moneyCurrency(i.unit_price,order.currency)}</small></div><b>{moneyCurrency(i.line_total,order.currency)}</b></div>):<p className="muted">Loading items…</p>}<h4>Buyer details</h4><div className="detail-info"><span>Name</span><strong>{order.customer_name}</strong><span>Email</span><strong>{order.customer_email||'Not provided'}</strong><span>Order reference</span><strong>{order.order_number} <button className="inline-icon" onClick={copyOrder}><Clipboard size={13}/></button></strong></div></section><section><h4>Update order</h4><div className="modal-form"><label>Payment status<select value={status} onChange={e=>setStatus(e.target.value)}>{['Awaiting Payment','Pending Verification','Partially Paid','Paid','Failed','Cancelled','Refunded'].map(s=><option key={s}>{s}</option>)}</select></label><label>Fulfilment status<select value={fulfillment} onChange={e=>setFulfillment(e.target.value)}>{['Order Placed','Supplier Ordered','Processing','Shipped','In Transit','Delivered','On Hold','Cancelled'].map(s=><option key={s}>{s}</option>)}</select></label><label>Shipping carrier<input value={carrier} onChange={e=>setCarrier(e.target.value)} placeholder="e.g. DHL, FedEx"/></label><label>Tracking number<input value={tracking} onChange={e=>setTracking(e.target.value)} placeholder="Shipment tracking number"/></label></div><div className="security-callout"><ShieldCheck size={17}/><p>Only mark a customer order as <strong>Paid</strong> after verifying funds in your account or receiving a verified payment-provider webhook.</p></div>{err&&<div className="alert">{err}</div>}<button className="btn primary full" onClick={save} disabled={busy}>{busy?'Saving…':'Save order updates'}</button></section></div><div className="detail-bottom"><div><h4>Private buyer page</h4><p>Generate a fresh private link and copy it to send to this customer. Creating a new link invalidates the previous link. The link expires after 30 days.</p>{err&&<div className="alert">{err}</div>}</div><div className="detail-link-actions"><button className="btn primary" onClick={generateLink} disabled={busy}><Link2 size={14}/>{busy?'Generating…':'Generate & copy link'}</button><button className="btn subtle" onClick={()=>window.open(`mailto:${order.customer_email||''}?subject=${encodeURIComponent(`Your order ${order.order_number}`)}&body=${encodeURIComponent(`Hello ${order.customer_name},\n\nYour order reference is ${order.order_number}. I will send your private order link separately.\n\nThank you.`)}`,'_blank')}>Prepare email <ExternalLink size={14}/></button></div></div></div></Modal>}
function PublicPage({loading,data,error,settings,onReload}:any){
  const [email,setEmail]=useState('');
  const [reference,setReference]=useState('');
  const [receipt,setReceipt]=useState('');
  const [submitting,setSubmitting]=useState(false);
  const [message,setMessage]=useState('');
  const order=data?.order;
  const config=data?.settings||settings;
  const items=data?.items||[];
  const updates=data?.updates||[];
  const subtotal=items.reduce((sum:number,item:any)=>sum+Number(item.line_total||0),0);
  const shipping=Math.max(0,Number(order?.total_amount||0)-subtotal);

async function payOnline() {
  try {
    setMessage("Preparing secure payment...");

    const token =
      new URLSearchParams(window.location.search).get("order") || "";

    if (!token) {
      throw new Error("Order link is missing. Please reopen your order link.");
    }

    if (!order?.id) {
      throw new Error("Order details are not loaded yet. Please try again.");
    }

    const { data, error } = await supabase.functions.invoke(
      "create-payment",
      {
        body: { order_id: order.id },
        headers: { "x-order-token": token },
      },
    );

    if (error) {
      throw error;
    }

    if (!data?.checkout_url) {
      throw new Error(
        data?.error || "Could not start payment. Please try again.",
      );
    }

    window.location.href = data.checkout_url;
  } catch (error) {
    console.error("Pay Online error:", error);

    setMessage(
      error instanceof Error
        ? error.message
        : "Unable to start payment. Please try again.",
    );
  }
}
  async function submitTransfer(e:any){e.preventDefault();setSubmitting(true);setMessage('');try{const {error}=await supabase.functions.invoke('public-order',{body:{action:'submit-transfer',token:new URLSearchParams(window.location.search).get('order'),reference:receipt}});if(error)throw error;setMessage('Transfer reference submitted. Your order will remain pending until the payment is verified.');}catch(e:any){setMessage(e.message||'Could not submit transfer reference.');}finally{setSubmitting(false);}}
  if(!order&&!loading)return <div className="buyer-shell"><header className="buyer-top"><div className="brand">


<ShoppingCart size={30} strokeWidth={2.5} color="#ff6a00" />
<span className="brand-name">Alibaba.com</span>

</div></header><div className="lookup-card"><div className="lookup-icon"><Package size={25}/></div><span className="eyebrow">ORDER LOOKUP</span><h1>Track your order</h1><p>Enter your order reference and the email address used when the order was created.</p><form onSubmit={async e=>{e.preventDefault();setSubmitting(true);setMessage('');try{const {data:d,error:err}=await supabase.functions.invoke('public-order',{body:{order_number:reference,email}});if(err)throw err;if(!d?.order)throw new Error('We could not find an order with those details.');window.location.href=`${window.location.pathname}?order=${encodeURIComponent(d.access_token)}`;}catch(err:any){setMessage(err.message||'Unable to find order.');}finally{setSubmitting(false);}}} className="lookup-form"><label>Order reference<input required value={reference} onChange={e=>setReference(e.target.value)} placeholder="e.g. OD-2026-ABC123"/></label><label>Email address<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label><button className="btn primary full" disabled={submitting}>{submitting?'Looking up…':'Find my order'}<ChevronRight size={17}/></button></form>{(message||error)&&<div className="alert error">{message||error}</div>}<div className="lookup-foot"><ShieldCheck size={15}/> Your order information is private.</div></div><footer className="buyer-footer">Need help? Contact {config?.support_email||'the business that placed your order'}.</footer></div>;
  if(loading)return <div className="loading-screen"><div className="brand-mark">OD</div><p>Loading order details…</p></div>;
  const stages=['Order','Payment','Dispatch','Delivery','Review'];
  
const stageIndex = Math.max(
  1,
  order?.fulfillment_status === 'Delivered' ? 3 :
  order?.fulfillment_status === 'Shipped' ||
  order?.fulfillment_status === 'In Transit' ? 2 :
  order?.payment_status === 'Paid' ? 1 : 0
);

  return <div className="buyer-shell alibaba-order-page"><header className="buyer-top"><div className="brand">

<ShoppingCart size={30} strokeWidth={2.5} color="#ff6a00" />
<span className="brand-name">Alibaba.com</span>

</div><span className="secure-pill"><ShieldCheck size={14}/> Secure order page</span></header>
  <main className="buyer-main alibaba-main"><div className="buyer-breadcrumb">Home / Orders / Order details</div><div className="buyer-title"><h1>Order details</h1><p><strong># {order.order_number}</strong> <span>│</span> ◷ {dateLabel(order.created_at)} <span>│</span> <span className={statusClass(order.payment_status)}>{order.payment_status}</span></p></div>
  

<div className="order-progress">
  {stages.map((stage: string, i: number) => (
    <div
      className={`progress-step ${i < stageIndex ? 'completed' : ''} ${i === stageIndex ? 'current' : ''}`}
      key={stage}
    >
     
<span className="progress-icon">
  {i === 0 ? <ClipboardList size={16} /> :
   i === 1 ? <CreditCard size={16} /> :
   i === 2 ? <Truck size={16} /> :
   i === 3 ? <PackageCheck size={16} /> :
   <Star size={16} />}
</span>

      <span>{stage}</span>
    </div>
  ))}
</div>


  <section className="order-payment-alert"><div className="payment-alert-title">
  
<Hourglass
  size={16}
  strokeWidth={5}
  color="#222222"
/>

  {order.payment_status === 'Paid'
    ? 'Payment confirmed'
    : order.payment_status === 'Pending Verification'
      ? 'Payment under verification'
      : 'Waiting for payment'}

</div>
<div className="payment-alert-amount">
  <Banknote
  size={22}
  strokeWidth={3.5}
/>
  <span>Amount due:</span>
  <strong>{moneyCurrency(order.total_amount, order.currency)}</strong>
</div>

<div className="payment-validation-note">
  <span className="payment-validation-icon">ℹ</span>
  <span>Payment validates order</span>
</div>
<div className="payment-note">
<p>
  <span className="payment-validation-icon">ℹ</span>{' '}
  If you are concerned about the order terms or Trade Assurance terms (shown below), please contact your supplier to modify the order.
</p>  <p>⬟  Please make sure to make payment to the bank account designated by Alibaba.com to get protection from Alibaba.com.</p>
</div><div className="payment-alert-actions"><button className="btn primary" onClick={payOnline}>$ Make payment</button><button
  type="button"
  className="btn subtle"
  onClick={() => {
   window.location.href = `${window.location.pathname}?track=1`;
  }}
>
  ⌕ Track another order
</button></div>{message&&<div className="alert">{message}</div>}</section>
  <section className="reference-section"><h2>▣ Product details</h2><div className="order-table-wrap"><table className="buyer-product-table"><thead><tr><th>Product</th><th>Price</th><th>Qty</th><th>Total</th></tr></thead><tbody>{items.map((i:any)=><tr key={i.id}><td><div className="reference-product">{i.image_url?<img src={i.image_url} alt={i.product_name}/>:<span className="reference-product-placeholder"><Package size={22}/></span>}<strong>{i.product_name}</strong></div></td><td>{moneyCurrency(i.unit_price,order.currency)}</td><td>{i.quantity}</td><td><strong>{moneyCurrency(i.line_total,order.currency)}</strong></td></tr>)}</tbody></table></div>
  <div className="buyer-contact-strip"><div>♟ <strong>{order.customer_name}</strong></div><div>✉ {order.customer_email||'No email provided'}</div><div>▣ Order reference: {order.order_number}</div><div>▰ Shipping: {moneyCurrency(shipping,order.currency)}</div></div></section>
  <section className="reference-section"><h2>♧ Tracking history</h2>{updates.length? <div className="tracking-history">{updates.map((u:any)=><div className="history-item" key={u.id}><span className="history-dot"/><div><strong>{u.status||'Order update'}</strong><p>{u.message}</p><small>{dateLabel(u.created_at)}</small></div></div>)}</div>:<div className="tracking-history"><div className="history-item"><span className="history-dot"/><div><strong>Order placed</strong><p>Your order has been created and is awaiting payment.</p><small>{dateLabel(order.created_at)} · Order stage</small></div></div></div>}</section>


<section className="reference-section">
  <h2>▰ Shipment details</h2>

  <p className="shipment-state">
    ◷ {order.tracking_number
      ? 'Tracking information available'
      : 'Waiting for shipment'}
  </p>

 
<div className="shipment-grid">
  <div>
    <span>
      <MapPin size={20} fill="currentColor" />
    </span>
    <strong>Address</strong>
    <p>{config?.shipment_address || 'Not provided'}</p>
  </div>

  <div>
    <span>
      <Flag size={20} fill="currentColor" />
    </span>
    <strong>From</strong>
    <p>{config?.shipment_origin || 'Not provided'}</p>
  </div>

  <div>
    <span>
      <Plane size={20} fill="currentColor" />
    </span>
    <strong>Method</strong>
    <p>{config?.shipment_method || 'Not provided'}</p>
  </div>

  <div>
    <span>
      <FileText size={20} fill="currentColor" />
    </span>
    <strong>Incoterms</strong>
    <p>{config?.shipment_incoterms || 'Not provided'}</p>
  </div>
</div>


  <div className="shipment-tracking-box">
    <div>
      <ClipboardList
        size={16}
        style={{ display: 'inline', verticalAlign: 'middle' }}
      />{' '}
      Tracking: {order.tracking_number || 'Generates after payment'}
    </div>

    <div>
      <Truck
        size={18}
        fill="currentColor"
        style={{ display: 'inline', verticalAlign: 'middle' }}
      />{' '}
      Carrier: {order.shipping_carrier || 'To be confirmed'}
    </div>
  </div>
</section>

<section className="reference-section payment-details-section">
  <h2>▤ Payment details</h2>

  <div className="payment-detail-layout">
    <div className="payment-method-summary">
      <div>▤ Bank transfer</div>
      <p>◷ {order.payment_status}</p>
    </div>

    <div className="reference-totals">
      <div>
        <span>Subtotal</span>
        <strong>{moneyCurrency(subtotal, order.currency)}</strong>
      </div>

      <div>
        <span>Shipping</span>
        <strong>{moneyCurrency(shipping, order.currency)}</strong>
      </div>

      <div className="reference-grand-total">
        <span>Total</span>
        <strong>
          {moneyCurrency(order.total_amount, order.currency)}
        </strong>
      </div>

      <p>
        A payment processing fee may be charged depending on the payment method.
      </p>
    </div>
  </div>
</section>  
<section className="reference-section">
  <h2><Store size={18} strokeWidth={4} /> Supplier</h2>

  <strong className="supplier-name">
  {config?.supplier_name || 'Supplier information not provided'}
</strong>

{config?.supplier_contact_name && (
  <div className="supplier-info-card">
    <strong>
      <Users size={16} strokeWidth={4} /> Contact Name
    </strong>
    <p style={{ fontWeight: 700 }}>{config.supplier_contact_name}</p>
  </div>
)}

{config?.supplier_address && (
  <div className="supplier-info-card">
    <strong>
      <Globe size={16} strokeWidth={4} /> Address
    </strong>
    <p style={{ fontWeight: 700 }}>{config.supplier_address}</p>
  </div>
)}

{config?.supplier_email && (
  <div className="supplier-info-card">
    <strong>
      <MessagesSquare size={16} strokeWidth={4} /> Email
    </strong>
    <p style={{ fontWeight: 700 }}>{config.supplier_email}</p>
    <a href={`mailto:${config.supplier_email}`}>
      Contact by email
    </a>
  </div>
)}
  

<div
  className="supplier-actions"
  style={{
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
    marginTop: '16px',
  }}
>
  <button
    type="button"
    className="supplier-action-btn"
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      padding: '12px 20px',
      backgroundColor: '#ffffff',
      color: '#222222',
      border: '1px solid #d0d0d0',
      borderRadius: '28px',
      cursor: 'pointer',
    }}
  >
    <MessagesSquare
      size={20}
      color="#222222"
      strokeWidth={2}
    />
    <span>Chat</span>
  </button>

  <button
    type="button"
    className="supplier-action-btn"
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      padding: '12px 20px',
      backgroundColor: '#ffffff',
      color: '#222222',
      border: '1px solid #d0d0d0',
      borderRadius: '28px',
      cursor: 'pointer',
    }}
  >
    <Store
      size={20}
      color="#222222"
      strokeWidth={2}
    />
    <span>Store</span>
  </button>
</div>


</section>

  <section className="reference-section protection-section"><h2>⬟ Protection</h2><div className="protection-grid"><article><span className="protection-icon">▰</span><h3>On-time Dispatch Guarantee</h3><p>Dispatched within 60 days of payment or receive a 10% delay compensation.</p><button type="button" onClick={()=>setMessage('On-time Dispatch Guarantee: eligible orders are dispatched within 60 days of payment or qualify for 10% delay compensation.')}>View details</button></article><article><span className="protection-icon">⬟</span><h3>Secure payments</h3><p>Every payment you make on OrderDesk is secured with strict SSL encryption and PCI DSS data protection protocols.</p><button type="button" onClick={()=>setMessage('Secure payments: use the payment instructions on this page and verify the recipient before transferring funds.')}>View details</button></article><article><span className="protection-icon">↻</span><h3>Standard refund policy</h3><p>Claim a refund if your order doesn't ship, is missing, or arrives with product issues.</p><button type="button" onClick={()=>setMessage('Standard refund policy: contact OrderDesk support with your order reference and details of the issue to request a review.')}>View details</button></article></div></section>
  </main><footer className="buyer-footer">{config?.support_email?<>Questions? <a href={`mailto:${config.support_email}`}>{config.support_email}</a></>:'Thank you for your order.'}<span>·</span> OrderDesk order support</footer></div>;
}
