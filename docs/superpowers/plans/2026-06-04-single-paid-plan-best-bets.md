# Single Paid Plan + Best Bets Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace public Base/Premium packaging with one paid Signal Desk plan at 49.50 USDT/month, while keeping Free unchanged and ensuring Best Bets never looks broken when no +EV markets are active.

**Architecture:** Keep the database enum stable by using `base` as the single public paid plan. Move commercial plan constants and Best Bets ranking/fallback rules into small pure modules under `lib/`, then wire `app/page.tsx` to those helpers. Admin-only `premium/admin_full` remains available internally.

**Tech Stack:** Next.js App Router, React client component, TypeScript helper modules, tsx verification scripts, ESLint, Next build.

---

### Task 1: Commercial Plan Contract

**Files:**
- Create: `lib/commercial-plan.ts`
- Create: `scripts/verify-commercial-plan.ts`
- Modify: `app/page.tsx`
- Modify: `app/api/auth/route.ts`

- [ ] Write a failing tsx verification script that asserts there is one public paid plan, it uses `base`, and the checkout amount is `49.5` USDT.
- [ ] Run `npx tsx scripts/verify-commercial-plan.ts` and verify it fails because the module does not exist.
- [ ] Create `lib/commercial-plan.ts` with `PUBLIC_PAID_PLAN`, `PUBLIC_PLAN_KEYS`, `planPriceCopy`, and `normalizeCheckoutPlan`.
- [ ] Wire `app/page.tsx` to show only the single paid plan card and submit only `base`.
- [ ] Keep `/api/auth` compatible with old `premium` requests but normalize public checkout to `base`.
- [ ] Run `npx tsx scripts/verify-commercial-plan.ts` and verify it passes.

### Task 2: Best Bets Fallback

**Files:**
- Create: `lib/best-bets.ts`
- Create: `scripts/verify-best-bets.ts`
- Modify: `app/page.tsx`

- [ ] Write a failing tsx verification script that asserts +EV rows are classified as `value`, no-odds/high-confidence rows are classified as `model_signal`, and empty inputs produce an empty state.
- [ ] Run `npx tsx scripts/verify-best-bets.ts` and verify it fails because the module does not exist.
- [ ] Create `lib/best-bets.ts` with pure classification/ranking helpers for football and tennis.
- [ ] Wire `BestBetsBoard` to show +EV first, then Top Model Signals when no +EV exists.
- [ ] Update the empty copy so it only appears when there are no future model signals either.
- [ ] Run `npx tsx scripts/verify-best-bets.ts` and verify it passes.

### Task 3: Verification + Deploy

**Files:**
- Modify: `reports/data_sources_deep_research_2026-06-04.md`

- [ ] Run the two tsx verification scripts.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Deploy to Vercel production.
- [ ] Canary `/api/health`, `/api/predictions`, `/api/tennis`.
