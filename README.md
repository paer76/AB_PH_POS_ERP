# Aqua Best — POS & Remote Monitoring

Web app for a water refilling station. Counter staff (secretaries) use it as a POS on a phone or tablet,
and the owner monitors sales, cash and deliveries live from anywhere.

**Stack:** Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind v4 · shadcn/ui · Supabase (Postgres, Auth, Realtime)

## Features

| Counter (secretary) | Owner |
|---|---|
| Open/close shift with cash count (expected vs counted, variance) | Live dashboard: sales, collections, receivables, open drawers |
| POS: walk-in & delivery, client prices, cash/GCash/card, utang | Reports: daily sales chart/table, client volume, CSV export |
| Deliveries board: pending → out (rider) → completed (containers) | Approve/reject voids |
| Record payments, request voids, print receipts | Monthly SOA generation, printing, payment allocation |
| Client balances & container tracking | Products/prices, client terms & custom prices, riders |
| Expenses / cash in / cash out per shift | Staff accounts, shift history, audit log |

Works on phones (bottom tabs, bottom-sheet dialogs), tablets (side-by-side POS cart) and desktops.
Can be added to the home screen. Online-only (no offline mode).

## How the data is protected

- All writes to sales, payments, shifts, containers, cash and voids go through **Postgres functions**
  (`create_order`, `record_payment`, `close_shift`, …). Each one is a single transaction and checks the caller's role.
  App users have **no direct UPDATE/DELETE** on those tables, and nothing is ever deleted.
- **Row Level Security** on every table. Secretaries can't see the audit log, SOAs, other people's shifts,
  or the owner reports, and can't change prices or credit terms.
- Every change is written to `audit_log` by trigger.
- Public sign-up is disabled. The owner creates accounts from **Staff**.

See [supabase/migrations/20261029000000_init.sql](supabase/migrations/20261029000000_init.sql).

## Local development

Requires Node 22+, the Supabase CLI and Docker or Podman.

```bash
npm install
supabase start          # local Postgres/Auth/Realtime (prints the keys)
supabase db reset       # applies migration + seed
cp .env.example .env.local   # fill in the keys printed by `supabase start`
npm run dev
```

Seed logins (local only): `owner@aquabest.local` / `secretary@aquabest.local`, password `password123`.

```bash
supabase test db        # 41 database tests: business rules + permissions
npm run lint && npx tsc --noEmit
supabase gen types typescript --local > src/lib/types/database.ts   # after schema changes
```

On this Bazzite machine: Node and the CLI are in Homebrew (`/home/linuxbrew/.linuxbrew/opt/node@22/bin`,
`/home/linuxbrew/.linuxbrew/bin`). Supabase talks to Podman through
`DOCKER_HOST=unix:///run/user/1000/podman/podman.sock`.

## Going live

1. Create a Supabase project. Use **Pro ($25/mo)** for daily backups; the free tier has none and pauses when idle.
2. `supabase link --project-ref <ref>` then `supabase db push` (do **not** run `seed.sql` in production).
3. In the dashboard, under **Authentication → Sign In / Providers**, turn off "Allow new users to sign up".
4. Create the owner account: **Authentication → Users → Add user**, then in the SQL editor run
   `update profiles set role = 'owner' where id = (select id from auth.users where email = 'OWNER_EMAIL');`
5. Deploy the Next.js app. **Vercel Hobby doesn't allow commercial use**, so use Vercel Pro, or Netlify/Cloudflare.
   Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY`
   (secret key is server-only and only used to create staff accounts).
6. Set the Supabase **Site URL** to your app's URL.
7. Sign in as the owner, add products/prices, riders and staff accounts.

## Notes

- Times and day boundaries use **Asia/Manila**.
- Printed receipts say "This is not an official receipt". If you need BIR official receipts, use your registered OR booklet/POS.
