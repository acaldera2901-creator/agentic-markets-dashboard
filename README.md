# BetRedge — Customer App (`betredge.com`)

The customer-facing Next.js app: public landing, the **`/app` signal desk** (predictions, bets,
live odds, Match Builder, history), `/world-cup`, `/community`. Final production domain: **betredge.com**.

This is **one project, three parts**, all sharing a single Supabase DB (`agentic-markets`):

| Part | What | Where |
|---|---|---|
| **Customer app** (this repo) | What subscribers see → `betredge.com` | repo root `app/` |
| **Admin console** | Operator backoffice (analytics, profiles, plans, notifications, affiliates) | separate `agentic-backoffice` repo → `betredge-backoffice.vercel.app` |
| **Prediction pipeline** | Python agents that compute predictions and write them to the DB | `agents/`, `core/`, `models/`, `risk/` |

> The frontend team owns the **Customer app**. You do **not** need the admin console or the Python
> pipeline running to develop the UI — the app reads whatever predictions are already in the DB.

---

## Quick start (frontend)

Prereqs: **Node 20+** and npm.

```bash
npm install
cp .env.example .env          # fill the minimal vars below
npm run dev                   # http://localhost:3000
```

Build / production check:

```bash
npm run build
npm run start
```

### Minimal env to run the UI

Only these are needed to boot the app and talk to the DB (everything else in `.env.example`
is for the Python pipeline or live trading and is **not** required for frontend dev):

| Var | Why |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side DB access (see Data access below). **Server-only.** |
| `SESSION_SECRET` | Signs the `am_session` customer cookie (≥16 chars; `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"`) |

Optional, per feature:
- `ADMIN_SECRET` — the root `/admin` login (note: admin work is moving to the `agentic-backoffice` console).
- `RESEND_API_KEY`, `RESEND_FROM` — transactional email (OTP/activation/plan emails).
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, price IDs — only to test the paid checkout flow.
- `CRON_SECRET`, `FOUNDER_ACCESS_KEY` — server routes (`/api/cron/*`, `/api/founder/grant`).

Get `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` from the Supabase dashboard (project
`agentic-markets`). ⚠️ When pasting env on Windows/Vercel, use the dashboard UI or a no-BOM file —
PowerShell can inject a BOM/`\r` that breaks the key.

---

## How it's wired

- **Auth:** email + password → signed **`am_session`** httpOnly cookie (30-day), see `lib/session.ts`
  / `lib/auth.ts`. Activation + OTP email via Resend (`lib/email.ts`). Plan is always re-read from
  `profiles` server-side — never trusted from the cookie.
- **Plan gating:** `free` / `base` / `premium` / `admin_full`; enforced in `lib/access-projection.ts`
  + `lib/use-has-access.ts` (free sees 1 pick/sport, base 5, premium ∞). Paid plans expire at
  `profiles.plan_expires_at` (downgrade to free at runtime).
- **Data access:** all DB I/O is **server-side via the service-role key** through
  `lib/db.ts` → `exec_sql` RPC (`dbQuery` / `dbQueryStrict` / `dbExecute`). The browser never holds
  the service-role key. The public anon key can read exactly one table: **`affiliate_links`** (active rows).
- **Payments:** crypto checkout writes `plan='pending_payment'` + `tx_hash`; an operator activates it
  in the admin console, or Stripe webhook activates automatically.

Key dirs: `app/` (routes), `lib/` (auth/session/db/access/email), `supabase/` (migrations),
`components/`.

---

## Working alongside the admin console (don't break these)

The admin console reads the **same DB**. Safe to add columns/tables; do **not** rename or drop what
it depends on:

1. **`events`** — keep `event_type`, `country`, `language`, `plan`, `partner_id`, `value`, `meta`,
   `created_at`. Fire **`partner_click`** (with `partner_id`) when a user clicks a sportsbook/partner
   button — the admin analytics + the affiliate redirect both rely on it.
2. **`profiles`** — keep `identifier`, `plan`, `requested_plan`, `plan_expires_at`, `tx_hash`,
   `password_hash`, `language`. The admin changes `plan` / `plan_expires_at`; don't fight it.
3. **Keys & RLS:** never ship the service-role key to the browser. RLS is ON for all tables
   (deny-all to anon) — that's the safety net. For any **new client-side read**, add an explicit
   **RLS policy** per table (don't just `GRANT`).

---

## Security note (worth hardening)

`lib/db.ts` builds SQL by **string interpolation** (`interpolate()` doubles quotes) and runs it via
`exec_sql`. It's injection-adjacent. As you add API routes, prefer parameterized/typed queries and
treat any user-supplied value as hostile. `exec_sql` is service-role-locked — keep it that way.

---

## Deploy

Vercel (Tommy has dev control — confirm the target project). Set the same env vars in
Production/Preview via the dashboard. The Python pipeline deploys separately (Fly / cron); the Next
app does not depend on it being up to serve already-computed predictions.
