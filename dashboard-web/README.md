# Agentic Markets Dashboard Web

Next.js customer-facing Sportsbook Edge Desk for Agentic Markets.

## Current beta scope

- Public homepage is visible without login and shows product structure, sponsor placeholders, support/FAQ placeholders and past public bet history only.
- Local profile flow supports login/create profile via browser `localStorage`; new profiles start on `free`.
- Free shows profile/product preview only, without operational predictions.
- Level 1 and Level 2 plans are crypto-only.
- Checkout opens only after login and shows the USDT TRC20 wallet.
- Submitted TX hash moves the client to `pending_payment`; it does not unlock the plan automatically.
- Level 1 unlocks Best Bets, explanations and Sports board after payment/internal activation.
- Level 2 unlocks portfolio, execution log, agent health, bet slip and risk controls.
- UI language switch supports Italian and English.
- Future sports are rendered as disabled roadmap placeholders until real models/data exist.
- Founder access route exists at `/api/founder/grant` and requires server env `FOUNDER_ACCESS_KEY`.

## Important implementation notes

This beta is still UI/local-state based. Client profile, plan state and TX hash are stored in `localStorage`, so they are useful for demo and onboarding flow only. Production needs server-side accounts, sessions, payment verification and database-backed plan activation.

Do not expose real P&L, real wallet, execution data or Betfair credentials before the user has an active plan. The main dashboard currently uses:

- `profileHasAccess(profile)` for Level 1/Level 2/Admin signal access.
- `profileHasPremium(profile)` for portfolio, execution, agents and bet slip.
- `free` for logged-in preview only. It must not reveal live prediction-sensitive data.
- `pending_payment` to show a waiting screen after TX submission.

## Recent debug notes

The issue reported on May 18 was caused by an inconsistent access contract:

- The modal copy suggested a free unlock.
- The created profile was saved as `unpaid`.
- The gate correctly required `base`, `premium` or `admin_full`, so the page stayed locked after profile creation.
- Portfolio/P&L was visible in nav/topbar before login.
- History was implemented but removed from the rendered navigation during the Claude pass.

Fixes applied:

- Login and create profile are separate flows.
- Create profile sends the user to Plans instead of pretending to unlock predictions.
- Checkout submission now saves `plan: "pending_payment"` and `requestedPlan`, instead of activating Base/Premium immediately.
- Portfolio/P&L/bets/history/agents are gated before active access.
- History was removed from the client nav and folded into the public homepage as past-only proof.
- The profile name placeholder no longer defaults to Andrea.
- Public homepage now uses `/api/history` and refreshes history alongside football/tennis data.
- The client nav uses `FREE`, `BASE` and `PRO` status labels so the selected package is visible.

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Verification

```bash
npm run build
```

Expected result: Next.js production build completes successfully and lists the app routes, including `/api/founder/grant`, `/api/history`, `/api/predictions`, `/api/tennis`, and `/api/tennis-bets`.
