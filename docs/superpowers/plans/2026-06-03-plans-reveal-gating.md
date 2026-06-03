# Reveal Gating & Plan Tiers — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the all-or-nothing 403 prediction gate with a per-state projection so the public/free see a populated-but-blurred board (+CTA), while base/premium see full reveals — across football and tennis — with affiliate bonus/odds scaffolding and a daily free Pick of the Day.

**Architecture:** A new state resolver (`lib/auth.ts`) maps the session to one of `anonymous|free|pending_payment|base|premium|admin_full` and never denies reads. A pure projection layer (`lib/access-projection.ts`) returns, per state, the visible fields plus a `locked` flag the frontend uses to blur. Prediction read endpoints return 200 with the projected rows. Affiliate enrichment and Pick-of-the-Day are pure helpers attached to revealed rows. Frontend blurs locked cards and shows register/upgrade CTAs.

**Tech Stack:** Next.js (TS) on Vercel, Supabase (PostgREST via `lib/db`), existing session in `lib/session.ts`. No TS test runner exists → projection is verified with a `tsx` harness script.

**Spec:** `docs/superpowers/specs/2026-06-03-plans-monetization-design.md`

---

### Task 1: Access-state resolver (no deny for reads)

**Files:**
- Modify: `lib/auth.ts` (add `AccessState`, `resolveAccessState`; keep `requireAccess`/`requirePremium` for writes)

- [ ] **Step 1: Add the state type + resolver**

Append to `lib/auth.ts`:

```typescript
// Read-side access state — never denies. Writes still use requireAccess/requirePremium.
export type AccessState =
  | "anonymous" | "free" | "pending_payment" | "base" | "premium" | "admin_full";

export async function resolveAccessState(
  req: Request
): Promise<{ ctx: SessionContext | null; state: AccessState }> {
  const ctx = await getSessionPlan(req);
  if (!ctx) return { ctx: null, state: "anonymous" };
  return { ctx, state: ctx.plan as AccessState };
}
```

- [ ] **Step 2: Verify it compiles (typecheck)**

Run: `npx tsc --noEmit lib/auth.ts 2>&1 | head` (expect no new errors from this file; pre-existing project errors elsewhere are out of scope).

- [ ] **Step 3: Commit**

```bash
git add lib/auth.ts
git commit -m "feat(auth): add resolveAccessState (read-side, never denies)"
```

---

### Task 2: Projection layer (per-state field reveal + locked flag)

**Files:**
- Create: `lib/access-projection.ts`
- Create (verify): `scripts/verify-projection.ts`

- [ ] **Step 1: Write the projection module**

Create `lib/access-projection.ts`:

```typescript
import type { AccessState } from "@/lib/auth";

// Fields that are ALWAYS visible (the populated board: who plays, when).
const PUBLIC_FIELDS = [
  "id", "sport", "competition", "league", "event_name",
  "home_team", "away_team", "starts_at", "status",
] as const;

// Fields revealed only when a row is "unlocked" for the state.
const REVEAL_FIELDS = [
  "pick", "p_home", "p_draw", "p_away", "confidence_score",
  "fair_odds", "market", "signal_type", "explanation", "model_version",
  "is_paper", "affiliate",
] as const;

// Premium-only extra fields (advanced depth).
const PREMIUM_FIELDS = ["closing_line_value", "stake_suggestion", "edge_percent"] as const;

export type ProjectedPrediction = Record<string, unknown> & { locked: boolean };

// A row is unlocked when the state pays (base/premium/admin) OR the row is the
// free Pick of the Day (revealed to free + anonymous teaser).
export function isUnlocked(state: AccessState, isPickOfDay: boolean): boolean {
  if (state === "base" || state === "premium" || state === "admin_full") return true;
  if (state === "free" && isPickOfDay) return true;
  return false; // anonymous, pending_payment, free(non-PotD)
}

export function projectPrediction(
  row: Record<string, unknown>,
  state: AccessState,
  isPickOfDay: boolean
): ProjectedPrediction {
  const out: Record<string, unknown> = {};
  for (const f of PUBLIC_FIELDS) out[f] = row[f];
  out.pick_of_day = isPickOfDay;

  const unlocked = isUnlocked(state, isPickOfDay);
  if (unlocked) {
    for (const f of REVEAL_FIELDS) if (f in row) out[f] = row[f];
    if (state === "premium" || state === "admin_full") {
      for (const f of PREMIUM_FIELDS) if (f in row) out[f] = row[f];
    }
  }
  return { ...out, locked: !unlocked } as ProjectedPrediction;
}
```

- [ ] **Step 2: Write the verification harness (the "test")**

Create `scripts/verify-projection.ts`:

```typescript
import { projectPrediction, isUnlocked } from "@/lib/access-projection";

const row = {
  id: "x", sport: "tennis", competition: "Roland Garros", league: "RG",
  event_name: "A vs B", home_team: "A", away_team: "B",
  starts_at: "2026-06-03T22:00:00+00:00", status: "open",
  pick: "A", p_home: 0.6, confidence_score: 60, explanation: "because",
  closing_line_value: 0.1, stake_suggestion: 2,
};
let fail = 0;
function check(name: string, cond: boolean) { if (!cond) { console.error("FAIL", name); fail++; } }

const anon = projectPrediction(row, "anonymous", false);
check("anon locked", anon.locked === true);
check("anon shows teams", anon.home_team === "A");
check("anon hides pick", !("pick" in anon));

const freePotD = projectPrediction(row, "free", true);
check("free PotD unlocked", freePotD.locked === false);
check("free PotD shows pick", freePotD.pick === "A");
check("free PotD hides premium", !("closing_line_value" in freePotD));

const freeOther = projectPrediction(row, "free", false);
check("free non-PotD locked", freeOther.locked === true && !("pick" in freeOther));

const base = projectPrediction(row, "base", false);
check("base unlocked", base.locked === false && base.pick === "A");
check("base hides premium", !("closing_line_value" in base));

const prem = projectPrediction(row, "premium", false);
check("premium shows clv", prem.closing_line_value === 0.1);

check("isUnlocked pending false", isUnlocked("pending_payment", false) === false);
console.log(fail === 0 ? "ALL PROJECTION CHECKS PASS" : `${fail} FAILED`);
process.exit(fail === 0 ? 0 : 1);
```

- [ ] **Step 3: Run it — expect FAIL first if module stubbed, then PASS**

Run: `npx tsx scripts/verify-projection.ts`
Expected: `ALL PROJECTION CHECKS PASS`
(If `tsx` is missing: `npm i -D tsx` first.)

- [ ] **Step 4: Commit**

```bash
git add lib/access-projection.ts scripts/verify-projection.ts
git commit -m "feat(access): per-state prediction projection + locked flag (verified)"
```

---

### Task 3: Pick of the Day (deterministic daily)

**Files:**
- Create: `lib/pick-of-day.ts`

- [ ] **Step 1: Write the helper**

Create `lib/pick-of-day.ts`:

```typescript
// Deterministic daily Pick of the Day: the single highest-confidence upcoming
// prediction. Stable within a UTC day given the same row set. Returns the chosen
// row id (or null). Ties broken by earliest starts_at then id, so it never flickers.
export function pickOfDayId(
  rows: Array<{ id: string; confidence_score?: number | null; starts_at?: string | null }>
): string | null {
  let best: { id: string; c: number; t: string } | null = null;
  for (const r of rows) {
    const c = r.confidence_score ?? -1;
    const t = r.starts_at ?? "9999";
    if (!best || c > best.c || (c === best.c && (t < best.t || (t === best.t && r.id < best.id)))) {
      best = { id: r.id, c, t };
    }
  }
  return best ? best.id : null;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit` (expect no new errors from this file).

- [ ] **Step 3: Commit**

```bash
git add lib/pick-of-day.ts
git commit -m "feat(potd): deterministic daily Pick of the Day selector"
```

---

### Task 4: Affiliate scaffolding (placeholder partners)

**Files:**
- Create: `lib/affiliate.ts`

- [ ] **Step 1: Write the module**

Create `lib/affiliate.ts`:

```typescript
// Affiliate scaffolding. Real partner links/odds arrive once bookmaker deals are
// signed (Andrea/Maven). Until then a single placeholder partner is emitted from
// env so the UI + revenue plumbing exist. NEVER fabricates an "edge".
export type AffiliateOffer = {
  bookmaker: string;
  bonus: string;
  url: string;
  odds: number | null; // populated later from partner feed; null for now
};

export function affiliateOffer(): AffiliateOffer | null {
  const bookmaker = process.env.AFFILIATE_BOOKMAKER || "";
  const url = process.env.AFFILIATE_URL || "";
  const bonus = process.env.AFFILIATE_BONUS || "";
  if (!bookmaker || !url) return null; // not configured yet -> no CTA
  return { bookmaker, bonus, url, odds: null };
}

// Attach the offer to a revealed prediction row (no-op if not configured).
export function withAffiliate<T extends Record<string, unknown>>(row: T): T {
  const offer = affiliateOffer();
  return offer ? ({ ...row, affiliate: offer } as T) : row;
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit`

```bash
git add lib/affiliate.ts
git commit -m "feat(affiliate): partner offer scaffolding (env-driven placeholder)"
```

---

### Task 5: Wire /api/v2/predictions to 200 + projection

**Files:**
- Modify: `app/api/v2/predictions/route.ts`

- [ ] **Step 1: Replace deny with state resolution + projection**

In `app/api/v2/predictions/route.ts`:
- Change import: `import { resolveAccessState } from "@/lib/auth";` (remove `requireAccess`), add `import { projectPrediction } from "@/lib/access-projection"; import { pickOfDayId } from "@/lib/pick-of-day"; import { withAffiliate } from "@/lib/affiliate";` (keep `UnifiedPrediction` import; `applyAccessControl` no longer used here).
- Replace the top of `GET`:

```typescript
export async function GET(req: Request) {
  const { state } = await resolveAccessState(req); // never denies (read)

  const { searchParams } = new URL(req.url);
  const sport       = searchParams.get("sport");
  const competition = searchParams.get("competition");
  const status      = searchParams.get("status");
```

- Keep the existing `conditions` + `dbQuery` SELECT unchanged.
- Replace the `.map(applyAccessControl...)` line with:

```typescript
  const potd = pickOfDayId(rows as Array<{ id: string; confidence_score?: number | null; starts_at?: string | null }>);
  const predictions = rows.map((row) => {
    const projected = projectPrediction(row as unknown as Record<string, unknown>, state, (row as { id: string }).id === potd);
    return projected.locked ? projected : withAffiliate(projected);
  });
```

- [ ] **Step 2: Manual verify (anonymous gets 200 + locked board)**

After deploy/preview, run:
`curl -s "$BASE/api/v2/predictions?sport=tennis" | head -c 400`
Expected: HTTP 200, JSON with predictions where `locked:true`, teams present, `pick` absent.

- [ ] **Step 3: Commit**

```bash
git add app/api/v2/predictions/route.ts
git commit -m "feat(api): v2/predictions returns 200 + per-state projection (no 403 for reads)"
```

---

### Task 6: Wire /api/tennis to 200 + projection

**Files:**
- Modify: `app/api/tennis/route.ts`

- [ ] **Step 1: Replace deny with state resolution**

In `app/api/tennis/route.ts` `GET`:
- Change import to `resolveAccessState` (remove `requireAccess`); add `projectPrediction`, `pickOfDayId`, `withAffiliate`.
- Replace the first two lines of `GET`:

```typescript
  const { state } = await resolveAccessState(req); // never denies (read)
  const now = new Date().toISOString();
```

- After building the `matches` array (from redis or db), project each. Tennis `match` fields differ (player1/player2, p1/p2, best_selection). Add a normalizer to the projection input so the same `projectPrediction` reveal/lock applies. Concretely, after `const matches = ... .map(normalizePrediction);` build the response matches as:

```typescript
  const projInput = matches.map((m) => ({
    id: m.id, sport: "tennis", competition: m.tournament, league: m.tournament,
    event_name: `${m.player1} vs ${m.player2}`, home_team: m.player1, away_team: m.player2,
    starts_at: m.scheduled, status: "open",
    pick: m.best_selection ?? (m.p1 >= m.p2 ? m.player1 : m.player2),
    p_home: m.p1, p_away: m.p2, confidence_score: Math.round(Math.max(m.p1, m.p2) * 100),
    market: "ML", signal_type: "paper", model_version: m.model,
  }));
  const potd = pickOfDayId(projInput);
  const projected = projInput.map((r) => {
    const p = projectPrediction(r, state, r.id === potd);
    return p.locked ? p : withAffiliate(p);
  });
```

Return `projected` as `matches` in the JSON (keep `summary`, `computed_at`, `source`). Apply this in BOTH the redis branch and the db branch.

- [ ] **Step 2: Manual verify**

`curl -s "$BASE/api/tennis" | head -c 400` → 200; anonymous sees locked tennis cards with players + `locked:true`.

- [ ] **Step 3: Commit**

```bash
git add app/api/tennis/route.ts
git commit -m "feat(api): tennis returns 200 + per-state projection (populated+blurred for public)"
```

---

### Task 7: Frontend — per-card blur + CTA + PotD highlight + bonus

**Files:**
- Modify: `app/page.tsx` (the sportsbook board card renderer — locate where predictions/tennis matches are mapped to cards; the `locked_*` i18n keys already exist around lines 149-155)

**Context:** Today the desk locks as a whole. Change to per-card: render every card (populated), but when `card.locked === true` blur the numeric fields and overlay a compact CTA; when `card.pick_of_day` and unlocked, badge it "Pick of the Day"; when `card.affiliate` present, render the bonus CTA.

- [ ] **Step 1: Add a blur helper + locked card treatment**

Locate the board card map (search `sportsbook-board` and the `.map(` that renders predictions). For each card:

```tsx
// inside the card render, where pick/probability/confidence are shown:
{card.locked ? (
  <div className="locked-overlay" role="button" onClick={() => goToAuthOrPlans()}>
    <span className="blurred">▒▒▒ %</span>
    <span className="locked-cta">{t.locked_title}</span>
  </div>
) : (
  <>
    <span className="pick">{card.pick}</span>
    <span className="confidence">{card.confidence_score}%</span>
    {card.explanation && <p className="insight">{card.explanation}</p>}
    {card.affiliate && (
      <a className="bonus-cta" href={card.affiliate.url} target="_blank" rel="nofollow sponsored noopener">
        {card.affiliate.bonus} · {card.affiliate.bookmaker} →
      </a>
    )}
  </>
)}
{card.pick_of_day && !card.locked && <span className="badge-potd">Pick of the Day</span>}
```

`goToAuthOrPlans()` = existing handler that opens the auth/plans modal (reuse the one behind `locked_btn`).

- [ ] **Step 2: Add CSS for `.blurred` / `.locked-overlay` / `.bonus-cta` / `.badge-potd`**

Add to the existing stylesheet/`<style>` block:

```css
.blurred { filter: blur(6px); user-select: none; }
.locked-overlay { cursor: pointer; display: flex; flex-direction: column; gap: 4px; align-items: center; }
.bonus-cta { display: inline-block; margin-top: 6px; font-weight: 600; }
.badge-potd { background: #1f7a3d; color: #fff; border-radius: 6px; padding: 2px 8px; font-size: 12px; }
```

- [ ] **Step 3: Add an 18+/responsible-gambling + affiliate-disclosure footer line**

Near the existing footer i18n: add a short line, e.g. `t.rg_footer = "18+. Gioca responsabilmente. Contenuti informativi; le quote/bonus sono offerte di partner affiliati."` and render it on the board.

- [ ] **Step 4: Visual verify (browse tool or local)**

Load the homepage logged-out: board is POPULATED with blurred numbers + CTA; one card badged Pick of the Day is readable. Logged-in base/premium: all numbers visible.

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx
git commit -m "feat(ui): per-card blur + register/upgrade CTA + PotD badge + bonus CTA + RG footer"
```

---

### Task 8: Set Andrea's profile to admin_full (unblock real testing)

**Files:** none (DB op)

- [ ] **Step 1: Confirm current plan**

`curl -s "$SUPABASE_URL/rest/v1/profiles?select=identifier,plan&identifier=eq.<andrea-id>" -H "apikey: $KEY" -H "Authorization: Bearer $KEY"`

- [ ] **Step 2: Promote to admin_full (with Andrea's confirmation — privileged)**

`curl -s -X PATCH "$SUPABASE_URL/rest/v1/profiles?identifier=eq.<andrea-id>" -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" -d '{"plan":"admin_full"}'`

- [ ] **Step 3: Verify** Andrea logs in → sees full reveals on the board.

---

## Self-Review

- **Spec coverage:** ✅ 4-state ladder (Task 2 projection), public 200 not 403 (Tasks 5/6), PotD (Task 3), affiliate scaffolding+CTA (Tasks 4/7), no-paper (no profit claims; signal_type stays internal), RG/disclosure (Task 7 step 3), Andrea account (Task 8). Out of scope honored: no pricing/payments, no advanced gamification, no real odds (affiliate.odds=null until partners).
- **Placeholder scan:** none — all steps have concrete code/commands.
- **Type consistency:** `AccessState`, `projectPrediction`, `isUnlocked`, `pickOfDayId`, `affiliateOffer`/`withAffiliate` consistent across tasks.
- **Frontend caveat:** Task 7 requires locating the card map in the `app/page.tsx` monolith; the pattern + i18n keys + CSS are specified, exact line numbers must be found at implementation time.
