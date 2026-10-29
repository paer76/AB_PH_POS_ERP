# Aqua Best — POS & Remote Monitoring

Web app for a water refilling station. Counter staff (secretaries) use it as a POS on a phone or tablet,
and the owner monitors sales, cash and deliveries live from anywhere.

**Stack:** Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind v4 · shadcn/ui · Supabase (Postgres, Auth, Realtime)

## Contents

- [Features](#features)
- [How the data is protected](#how-the-data-is-protected)
- [Part 1 — Run it on your computer](#part-1--run-it-on-your-computer)
- [Part 2 — Put it online for the store](#part-2--put-it-online-for-the-store)
- [Part 3 — First-day setup in the app](#part-3--first-day-setup-in-the-app)
- [Everyday commands](#everyday-commands)
- [Troubleshooting](#troubleshooting)
- [Notes](#notes)

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

---

## Part 1 — Run it on your computer

This gives you a complete private copy (app + database) with sample data, for testing and development.
Nothing you do here affects the live store.

### 1.1 Install the tools

You need four things. Install each one, then check it with the command shown.

| Tool | Why | Install | Check |
|---|---|---|---|
| **Git** | Download the code | https://git-scm.com/downloads | `git --version` |
| **Node.js 22 or newer** | Runs the app | https://nodejs.org (LTS) | `node -v` → `v22.x` or higher |
| **Docker Desktop** (or Podman) | Runs the local database | https://www.docker.com/products/docker-desktop | `docker info` (no error) |
| **Supabase CLI** | Starts and manages the local database | see below | `supabase --version` |

Supabase CLI:

- **macOS / Linux (Homebrew):** `brew install supabase/tap/supabase`
- **Windows (Scoop):** `scoop bucket add supabase https://github.com/supabase/scoop-bucket.git` then `scoop install supabase`
- Other options: https://supabase.com/docs/guides/local-development/cli/getting-started

> Make sure **Docker Desktop is open and running** before continuing. The Supabase CLI needs it.

<details>
<summary><b>Linux with Podman instead of Docker (e.g. Bazzite, Fedora Silverblue)</b></summary>

```bash
brew install node@22 supabase/tap/supabase
systemctl --user enable --now podman.socket
export DOCKER_HOST=unix:///run/user/$(id -u)/podman/podman.sock   # add to ~/.bashrc to make it permanent
export PATH="/home/linuxbrew/.linuxbrew/opt/node@22/bin:$PATH"     # node@22 is keg-only in Homebrew
```

If you use VS Code installed as a **Flatpak**, run the `supabase` and `git push` commands from a normal host
terminal (Konsole/Ptyxis), not the VS Code terminal. The sandbox can't reach Podman or show the GitHub login.
</details>

### 1.2 Download the code

```bash
git clone https://github.com/paer76/AB_PH_POS_ERP.git
cd AB_PH_POS_ERP
npm install
```

`npm install` takes a minute or two and creates a `node_modules` folder.

### 1.3 Start the local database

```bash
supabase start
```

The first run downloads the database images (a few GB). Later runs take seconds. When it finishes it prints a
summary like this. Keep it open, because you need it in the next step:

```
Project URL │ http://127.0.0.1:54321
Publishable │ sb_publishable_...
Secret      │ sb_secret_...
Studio      │ http://127.0.0.1:54323
```

You can show it again at any time with `supabase status`.

Now create the tables and load the sample data:

```bash
supabase db reset
```

This applies [the migration](supabase/migrations/20261029000000_init.sql) and [seed.sql](supabase/seed.sql),
which adds sample products, clients, riders and two test logins.

> ⚠️ `supabase db reset` **erases the local database** and starts it fresh. That's fine locally, but never run it against the live project.

### 1.4 Connect the app to the database

Copy the example settings file:

```bash
cp .env.example .env.local        # Windows (PowerShell): Copy-Item .env.example .env.local
```

Open `.env.local` and paste the values from `supabase start`:

```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...   # "Publishable" line
SUPABASE_SECRET_KEY=sb_secret_...                         # "Secret" line
```

`.env.local` is ignored by git, so your keys never get uploaded.

### 1.5 Start the app

```bash
npm run dev
```

Open **http://localhost:3000** and sign in with a test account (password `password123` for both):

| Email | Role | Lands on |
|---|---|---|
| `owner@aquabest.local` | Owner | Dashboard |
| `secretary@aquabest.local` | Secretary | POS |

**Quick test:** sign in as the secretary in one browser window and as the owner in a private/incognito window.
As the secretary, open a shift (**Shift**), then make a sale (**POS**). The owner's dashboard updates on its own within a second.

**Try it on your phone:** connect the phone to the same Wi-Fi and find your computer's local IP address
(e.g. `192.168.1.20`). Then:

1. In `.env.local`, set `NEXT_PUBLIC_SUPABASE_URL=http://192.168.1.20:54321`. The phone can't reach `127.0.0.1`, which on the phone means the phone itself.
2. Stop `npm run dev` and run a production build instead: `npm run build && npm start`.
   The dev server blocks requests from other devices, and `NEXT_PUBLIC_` values are baked in at build time.
3. On the phone, open `http://192.168.1.20:3000`. If it doesn't load, allow ports 3000 and 54321 in your computer's firewall.

### 1.6 Stop everything

- Stop the app: press `Ctrl + C` in the terminal running `npm run dev`.
- Stop the database: `supabase stop` (your local data is kept for next time).

---

## Part 2 — Put it online for the store

The store needs a hosted database (Supabase) and a hosted app (e.g. Vercel). Do these steps once.

### 2.1 Costs to plan for

| Service | Plan | Why |
|---|---|---|
| Supabase | **Pro, ~$25/month** recommended | Daily backups. The free plan has **no backups** and pauses after a week without use. |
| Vercel | **Pro, ~$20/month** | The free Hobby plan **does not allow commercial use**. Netlify or Cloudflare Pages are alternatives with commercial-friendly free tiers. |

### 2.2 Create the Supabase project

1. Sign up at https://supabase.com and click **New project**.
2. Choose a name (e.g. `aqua-best`), set a strong **database password** and save it somewhere safe.
3. Pick the region **closest to the store**, e.g. *Southeast Asia (Singapore)* for the Philippines.
4. Wait a minute for the project to finish setting up.

### 2.3 Load the database structure

From the project folder on your computer:

```bash
supabase login                              # opens the browser to authorize the CLI
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

- `YOUR_PROJECT_REF` is the code in your project's URL: `https://supabase.com/dashboard/project/`**`abcdxyz...`**.
- `supabase link` asks for the database password from step 2.2.
- `supabase db push` creates all tables, rules and functions. It does **not** load the sample data, which is what you want.

### 2.4 Lock down sign-ups

In the Supabase dashboard:

1. **Authentication → Sign In / Providers**: turn **off** "Allow new users to sign up". Keep the **Email** provider **enabled**, because staff sign in with it.
2. **Authentication → Sign In / Providers → Email**: you can turn off "Confirm email", since the owner creates every account.

### 2.5 Create the owner account

1. **Authentication → Users → Add user → Create new user**: enter the owner's email and a strong password, and tick **Auto Confirm User**.
2. **SQL Editor → New query**: paste this, replacing the email, and click **Run**:

   ```sql
   update profiles
      set role = 'owner', full_name = 'Owner Name'
    where id = (select id from auth.users where email = 'owner@example.com');
   ```

   It should say `1 row affected`. Every other account (the secretaries) is created later from inside the app.

### 2.6 Get the API keys

**Project Settings → API Keys**: copy the **Publishable key** and the **Secret key**.
**Project Settings → Data API** (or the **Connect** button): copy the **Project URL** (`https://xxxx.supabase.co`).

> 🔒 The **Secret key** bypasses all security rules. Only ever put it in the hosting provider's environment
> variables, never in the code, a chat, or anything starting with `NEXT_PUBLIC_`.

### 2.7 Deploy the app on Vercel

1. Make sure the code is on GitHub (this repository).
2. Go to https://vercel.com → **Add New → Project**, then import `AB_PH_POS_ERP`.
3. Framework is detected as **Next.js**. Leave the build settings as they are.
4. Under **Environment Variables**, add:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...` |
   | `SUPABASE_SECRET_KEY` | `sb_secret_...` |

5. Click **Deploy**. After a couple of minutes you get a URL like `https://aqua-best.vercel.app`.
   You can add your own domain later under **Settings → Domains**.

### 2.8 Tell Supabase the app's address

Supabase dashboard → **Authentication → URL Configuration**: set **Site URL** to your Vercel URL
(e.g. `https://aqua-best.vercel.app`) and save.

### 2.9 Check it works

Open the app URL, sign in as the owner, and you should land on the **Dashboard**. 🎉

---

## Part 3 — First-day setup in the app

Signed in as the owner:

1. **Products**: add your refills, containers, caps etc. with prices. Turn on **Track stock** only for items you physically count (containers, caps, seals), not refills.
2. **Riders**: add delivery riders (they don't need logins).
3. **Staff → Add staff**: create one account per secretary (a shared login makes the audit log useless). Give them the email and temporary password.
4. **Clients**: add regular and commercial clients. Open a client → **Edit** to set credit limit, billing (*Monthly SOA* for commercial accounts) and payment terms. The **Prices** tab sets negotiated prices.
5. **On each counter phone/tablet**: open the app URL, sign in, then use **Add to Home Screen**
   (Safari: Share → Add to Home Screen; Chrome: ⋮ → Add to Home screen / Install app).

Daily routine for secretaries: **Shift → Open shift** (count the starting cash) → sell all day → **Shift → Close shift** (count the drawer). The owner sees any shortage under **Shifts**.

---

## Everyday commands

| Command | What it does |
|---|---|
| `npm run dev` | Run the app locally with live reload |
| `npm run build && npm start` | Run a production build locally |
| `npm run lint` / `npx tsc --noEmit` | Check code style / types |
| `supabase start` / `supabase stop` | Start / stop the local database |
| `supabase status` | Show local URLs and keys again |
| `supabase db reset` | Rebuild the **local** database from scratch with sample data |
| `supabase test db` | Run the 41 database tests (business rules + permissions) |
| `supabase migration new <name>` | Create a new migration file for a schema change |
| `supabase db push` | Apply new migrations to the **linked live** project |
| `supabase gen types typescript --local > src/lib/types/database.ts` | Refresh TypeScript types after a schema change |

**Changing the database later:** create a migration (`supabase migration new ...`), write the SQL, test it with
`supabase db reset` and `supabase test db`, regenerate types, then `supabase db push` and redeploy the app.
Never edit the live database by hand for structural changes.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `supabase start` says it can't connect to Docker | Open Docker Desktop and wait until it says "running". With Podman, check `DOCKER_HOST` is set (see 1.1). |
| Port already in use (54321, 54322, 3000…) | Another copy is running. Run `supabase stop`, or close the other `npm run dev`. |
| Login says **"Email logins are disabled"** | The Email provider was turned off. Turn it back on (Part 2.4); only "Allow new users to sign up" should be off. Locally, check `[auth.email] enable_signup = true` in `supabase/config.toml`. |
| Login says "Wrong email or password" for the test accounts | Run `supabase db reset` to reload the seed accounts (local only). |
| Signed in but immediately sent back to login | The account has no profile or is deactivated. For the owner, rerun the SQL in 2.5. For staff, re-enable them under **Staff**. Also check the env variables point to the right project. |
| Owner dashboard doesn't update live | Refresh once. Check the browser can reach the Supabase URL. Realtime is enabled by the migration; if you created the database another way, rerun `supabase db push`. |
| "Open a shift before making sales" | Expected: each secretary must open their own shift under **Shift** first. |
| "Credit limit exceeded" | The client owes more than their limit. Collect payment, or the owner raises the limit on the client page. |
| Staff page shows an error / can't create accounts | `SUPABASE_SECRET_KEY` is missing or wrong in the hosting environment variables. Redeploy after fixing it. |
| Phone on Wi-Fi can't sign in during local testing | Use your computer's IP in `NEXT_PUBLIC_SUPABASE_URL` (see 1.5), not `127.0.0.1`. |

## Notes

- Times and day boundaries use **Asia/Manila**.
- Printed receipts say "This is not an official receipt". If you need BIR official receipts, use your registered OR booklet/POS.
- Back up regularly. Supabase Pro does daily backups; on the free plan, export from **Database → Backups** or `supabase db dump` yourself.
