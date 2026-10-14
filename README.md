# OrderDesk — Alibaba-sourced order management

A starter full-stack app for a business that sources goods from Alibaba and resells them to individual customers. It includes a React/Vite admin workspace, Supabase database/authentication, private buyer order pages, manual bank-transfer references, a Flutterwave checkout Edge Function, and a payment webhook verifier.

## Included

- Admin sign-in and private workspace
- Product library with Alibaba supplier URL, supplier cost, customer price and availability
- Create customer orders with quantities, prices, shipping charges, and separate supplier-cost records
- Private buyer links and order-number + matching-email lookup
- Buyer order page with payment and fulfilment status, shipping tracking, and configured bank-transfer instructions
- Manual transfer-reference submission that stays **Pending Verification** until the business verifies funds
- Supplier payment ledger, customer summary, settings, and dashboard estimates
- Flutterwave checkout starter and signature + transaction verification webhook
- Row Level Security (RLS) policies and service-role Edge Functions

## Important limitations before production

This is a working starter, not a fully audited payment or logistics product. You must configure Supabase and a payment merchant account, test with sandbox transactions, and review access rules before going live. It does **not** automatically import Alibaba catalogues or pay Alibaba suppliers. Product records are entered by an administrator from supplier URLs, and supplier payments are recorded separately after you pay the supplier yourself.

- Apple Pay availability depends on the payment gateway, your merchant eligibility, supported currency, domain verification, and customer device/browser. This starter shows a general online-payment button through Flutterwave; do not advertise Apple Pay until your enabled gateway checkout actually offers it.
- The starter has manual bank transfer details and reference submission, not automatic bank reconciliation or receipt OCR.
- Do not use Alibaba's logo in production in a way that implies an official partnership. Replace the OrderDesk placeholder with your own brand or use Alibaba branding only if you have permission.
- Configure the business's real legal name, privacy notice, terms, refund policy, shipping/returns rules, and support contact before taking payments.
- All orders currently have a single currency per order. Ensure supplier costs, shipping, FX, taxes, duties, and payment fees are properly accounted for before relying on the gross-margin estimate.

## 1. Prerequisites

- Node.js 20 or newer and npm
- A Supabase project
- A Flutterwave merchant account for online payments (optional for initial manual-transfer testing)

## 2. Configure Supabase

1. Create a new Supabase project.
2. In **SQL Editor**, run `supabase/migrations/0001_initial_schema.sql`.
3. In **Authentication → Providers / Sign In**, disable public user sign-up for production. Create the administrator user yourself in Supabase Authentication. The SQL trigger creates an admin profile for newly created auth users; keep sign-up disabled so strangers cannot register as administrators.
4. If you already created users before running the migration, add a profile for your own user in SQL Editor, replacing the UUID and email:

```sql
insert into public.profiles (id, email, role)
values ('YOUR_AUTH_USER_UUID', 'you@example.com', 'admin')
on conflict (id) do update set role = 'admin';
```

5. Copy the Project URL and anon/public key from **Project Settings → API**.
6. Create `.env` in the project root based on `.env.example`:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

Never put the Supabase service-role key or payment-provider secret in a `VITE_` variable or frontend source code.

## 3. Install and run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite and sign in with the admin account you created.

## 4. Deploy Edge Functions

Install the Supabase CLI, log in, link this project, and set secrets:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
supabase secrets set FLUTTERWAVE_SECRET_KEY=YOUR_FLUTTERWAVE_SECRET_KEY
supabase secrets set FLUTTERWAVE_SECRET_HASH=YOUR_FLUTTERWAVE_WEBHOOK_SECRET_HASH
supabase secrets set APP_BASE_URL=https://your-deployed-site.example
supabase functions deploy public-order --no-verify-jwt
supabase functions deploy create-payment --no-verify-jwt
supabase functions deploy generate-order-link
supabase functions deploy payment-webhook --no-verify-jwt
```

`public-order` and `create-payment` need to be deployed with JWT verification disabled because they support buyer requests. They independently validate private tokens or signed-in admin sessions. Do not disable the checks inside the functions. `payment-webhook` uses Flutterwave's webhook secret hash and verifies the transaction against Flutterwave's API before marking an order paid.

Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` are normally supplied by Supabase to Edge Functions. If your project does not inject them automatically, set them as function secrets as well.

## 5. Configure Flutterwave

1. Create/configure your Flutterwave merchant account and start in test mode.
2. Add the secret key and webhook secret hash as Supabase Edge Function secrets; never put them in the frontend.
3. Configure Flutterwave's webhook URL as `https://YOUR_PROJECT_REF.supabase.co/functions/v1/payment-webhook` and select charge-completed events according to Flutterwave's current dashboard/API documentation.
4. Configure your deployed frontend URL in `APP_BASE_URL`.
5. Run successful, failed, duplicate, wrong-amount, wrong-currency, and invalid-signature webhook tests before switching to live mode.
6. Apple Pay is not guaranteed by adding this integration alone. Check current Flutterwave account eligibility and checkout behavior for your country, currency, device, and merchant profile.

## 6. Deployment

Deploy the Vite frontend to Vercel, Netlify, Cloudflare Pages, or another static host. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the host's environment variables and build with `npm run build`. The output directory is `dist`. Set `APP_BASE_URL` to the exact public origin. Deploy the Supabase SQL schema and Edge Functions separately as described above.

## 7. Test checklist before real customers

- Sign in as the admin; verify another non-admin user cannot read or write admin tables.
- Create a product and a test order; confirm the private link opens only that order.
- Try a random token and expired/revoked token; they must not expose customer information.
- Test order lookup with the wrong email and wrong order number.
- Submit a fake bank transfer reference; status must remain Pending Verification until manually checked.
- Test Flutterwave checkout and webhook signature/amount/currency checks in sandbox.
- Verify a buyer cannot see supplier costs, internal notes, or other customers' orders.
- Check mobile layout, accessibility, backups, privacy/terms pages, refund process, and notification delivery.

## Known starter improvements to complete before production

- The order-detail panel can generate and copy a fresh buyer link. This rotates the access token and invalidates the previous link; only a token hash is stored. Link generation requires a signed-in admin.
- Add email delivery for order links and status updates using a transactional email provider.
- Add pagination, audit logs, rate limiting / CAPTCHA for lookup, and a dedicated admin-only user provisioning process.
- Add verified partial-payment/refund reconciliation and FX/fees/tax accounting if required by your business.
- Review all security policies and webhook behavior with a developer before processing live customer money.
