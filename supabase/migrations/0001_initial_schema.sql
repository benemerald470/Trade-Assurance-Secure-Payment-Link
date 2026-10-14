create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'admin' check (role in ('admin')),
  created_at timestamptz not null default now()
);
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  supplier_url text,
  supplier_name text,
  supplier_cost numeric(14,2) not null default 0 check (supplier_cost >= 0),
  default_price numeric(14,2) not null default 0 check (default_price >= 0),
  currency text not null default 'USD',
  sku text,
  stock_status text not null default 'Available',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_name text not null,
  customer_email text,
  currency text not null default 'USD',
  total_amount numeric(14,2) not null default 0 check (total_amount >= 0),
  supplier_total numeric(14,2) not null default 0 check (supplier_total >= 0),
  payment_status text not null default 'Awaiting Payment' check (payment_status in ('Awaiting Payment','Pending Verification','Partially Paid','Paid','Failed','Cancelled','Refunded')),
  fulfillment_status text not null default 'Order Placed' check (fulfillment_status in ('Order Placed','Supplier Ordered','Processing','Shipped','In Transit','Delivered','On Hold','Cancelled')),
  access_token_hash text,
  access_token_expires_at timestamptz,
  tracking_number text,
  shipping_carrier text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orders_email_idx on public.orders(lower(customer_email));
create index if not exists orders_created_at_idx on public.orders(created_at desc);
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  quantity integer not null default 1 check (quantity > 0),
  unit_price numeric(14,2) not null default 0 check (unit_price >= 0),
  supplier_unit_cost numeric(14,2) not null default 0 check (supplier_unit_cost >= 0),
  line_total numeric(14,2) not null default 0 check (line_total >= 0),
  created_at timestamptz not null default now()
);
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null default 'bank_transfer',
  provider_transaction_id text,
  provider_reference text unique,
  amount numeric(14,2) not null check (amount >= 0),
  currency text not null default 'USD',
  status text not null default 'Pending' check (status in ('Pending','Pending Verification','Successful','Failed','Cancelled','Refunded')),
  transfer_reference text,
  metadata jsonb not null default '{}'::jsonb,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.supplier_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  supplier_name text not null,
  amount numeric(14,2) not null check (amount >= 0),
  currency text not null default 'USD',
  status text not null default 'Unpaid' check (status in ('Unpaid','Paid','Partially Paid','Cancelled')),
  payment_reference text,
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);
create table if not exists public.order_updates (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status text not null,
  message text,
  visible_to_customer boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.app_settings (
  id uuid primary key default gen_random_uuid(),
  business_name text not null default 'OrderDesk',
  currency text not null default 'USD',
  bank_name text,
  account_name text,
  account_number text,
  bank_instructions text,
  support_email text,
  updated_at timestamptz not null default now()
);
insert into public.app_settings (business_name) select 'OrderDesk' where not exists (select 1 from public.app_settings);

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin');
$$;
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,email,role) values(new.id,new.email,'admin') on conflict(id) do nothing;
  return new;
end; $$;
-- This starter makes newly registered users admins. For production, disable public sign-up and create admin accounts only yourself.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.supplier_payments enable row level security;
alter table public.order_updates enable row level security;
alter table public.app_settings enable row level security;
create policy "Admins manage own profile" on public.profiles for select to authenticated using (id=auth.uid() and role='admin');
create policy "Admins manage products" on public.products for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage orders" on public.orders for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage order items" on public.order_items for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage payments" on public.payments for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage supplier payments" on public.supplier_payments for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage order updates" on public.order_updates for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage settings" on public.app_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant usage on schema public to anon, authenticated;
grant select,insert,update,delete on public.products,public.orders,public.order_items,public.payments,public.supplier_payments,public.order_updates,public.app_settings to authenticated;
grant select on public.profiles to authenticated;
