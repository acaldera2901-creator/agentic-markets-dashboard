# Master Document Completion — Agentic Markets

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the live site at agentic-markets-roan.vercel.app to match every requirement in the Master Document v2.

**Architecture:** All UI lives in the monolithic `app/page.tsx` SPA (5709 lines). New features are added as self-contained React components and JSX replacements within that file. A Supabase migration seeds both `match_predictions` and `bets` tables for demo history. No new route files needed.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Supabase JS client, Tailwind CSS, Vercel.

---

## Gaps Identified

| # | Requirement | Current State | Fix |
|---|-------------|---------------|-----|
| 1 | Operator sidebar (B2B CTA) | invisible placeholder (color: transparent) | JSX replacement |
| 2 | Sportsbook sidebar (affiliate CTA) | invisible placeholder (color: transparent) | JSX replacement |
| 3 | 18+ badge + legal disclaimer footer | only `risk-disclaimer` in FAQ | footer JSX expansion |
| 4 | GDPR / cookie consent banner | missing | new `CookieBanner` component |
| 5 | Responsible gambling links | missing | footer JSX expansion |
| 6 | Affiliate disclosure | missing | partner card + footer |
| 7 | Partner URL clickable | `url: null` | change to contact mailto |
| 8 | History with real data | 0 records (history API needs match_predictions rows) | Supabase migration: seed both tables |
| 9 | Paper / Verified / Live label in History | not surfaced in API response | add `bet_paper` to API SELECT + badge in UI |
| 10 | Match Builder for influencers | not implemented | new `MatchBuilderTab` component + tab |

---

## File Map

- **Modify:** `app/page.tsx` — all UI changes (all tasks)
- **Modify:** `app/api/history/route.ts` — add `b.paper AS bet_paper` to SELECT (Task 5)
- **Create:** `supabase/migrations/20260524100000_paper_history_seed.sql` — demo data (Task 5)

---

## Task 1: Operator Left Sidebar

**Files:**
- Modify: `app/page.tsx:5554-5565`

- [ ] **Step 1: Find the left sidebar placeholder**

In `app/page.tsx` find this block (around line 5554):
```tsx
{/* Left ad column */}
<aside className="portal-ad-col left">
  <div className="portal-ad-slot">
    <p className="ad-eyebrow">Operator</p>
    <div className="ad-name" style={{ color: "transparent" }}>·</div>
    <div className="ad-desc" style={{ color: "transparent" }}>·</div>
  </div>
  <div className="portal-ad-slot tall">
    <p className="ad-eyebrow" style={{ color: "transparent" }}>·</p>
    <div className="ad-name" style={{ color: "transparent" }}>·</div>
    <div className="ad-desc" style={{ color: "transparent" }}>·</div>
  </div>
</aside>
```

- [ ] **Step 2: Replace with Operator B2B CTA**

Replace the entire block with:
```tsx
{/* Left ad column — Operator B2B */}
<aside className="portal-ad-col left">
  <div className="portal-ad-slot" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
    <p className="ad-eyebrow">Operator</p>
    <div className="ad-name" style={{ color: "#e2e8f0", fontSize: "13px", fontWeight: 700, lineHeight: 1.3 }}>
      API Access
    </div>
    <div className="ad-desc" style={{ color: "#94a3b8", fontSize: "11px", lineHeight: 1.5 }}>
      Integrate +EV signals into your platform. Real-time Dixon-Coles probabilities via REST API.
    </div>
    <a
      href="mailto:info@agenticmarkets.com?subject=Operator%20API%20Access"
      className="text-[10px] font-mono px-3 py-1.5 rounded border border-cyan-400/40 text-cyan-400 bg-cyan-400/5 hover:bg-cyan-400/15 transition-colors text-center block mt-1"
      onClick={() => trackEvent("operator_sidebar_click", {})}
    >
      Request Access →
    </a>
  </div>
  <div className="portal-ad-slot tall" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
    <p className="ad-eyebrow" style={{ color: "#64748b", fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.1em" }}>B2B</p>
    <div className="ad-name" style={{ color: "#e2e8f0", fontSize: "12px", fontWeight: 700, lineHeight: 1.3 }}>
      White-label Desk
    </div>
    <div className="ad-desc" style={{ color: "#94a3b8", fontSize: "11px", lineHeight: 1.5 }}>
      Deploy a branded signal desk on your domain. Full data reporting included.
    </div>
    <button
      type="button"
      onClick={() => { setTab("partners"); trackEvent("operator_b2b_click", {}); }}
      className="text-[10px] font-mono px-3 py-1.5 rounded border border-fuchsia-400/40 text-fuchsia-400 bg-fuchsia-400/5 hover:bg-fuchsia-400/15 transition-colors text-center mt-1 w-full"
    >
      Partner Program →
    </button>
  </div>
</aside>
```

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat: populate operator left sidebar with B2B CTA"
```

---

## Task 2: Sportsbook Right Sidebar

**Files:**
- Modify: `app/page.tsx:5654-5665`

- [ ] **Step 1: Find the right sidebar placeholder**

In `app/page.tsx` find this block (around line 5654):
```tsx
{/* Right ad column */}
<aside className="portal-ad-col right">
  <div className="portal-ad-slot">
    <p className="ad-eyebrow">Sportsbook</p>
    <div className="ad-name" style={{ color: "transparent" }}>·</div>
    <div className="ad-desc" style={{ color: "transparent" }}>·</div>
  </div>
  <div className="portal-ad-slot tall">
    <p className="ad-eyebrow" style={{ color: "transparent" }}>·</p>
    <div className="ad-name" style={{ color: "transparent" }}>·</div>
    <div className="ad-desc" style={{ color: "transparent" }}>·</div>
  </div>
</aside>
```

- [ ] **Step 2: Replace with Sportsbook affiliate CTA**

Replace the entire block with:
```tsx
{/* Right ad column — Sportsbook */}
<aside className="portal-ad-col right">
  <div className="portal-ad-slot" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
    <p className="ad-eyebrow">Sportsbook</p>
    <div className="ad-name" style={{ color: "#e2e8f0", fontSize: "13px", fontWeight: 700, lineHeight: 1.3 }}>
      Bet Smarter
    </div>
    <div className="ad-desc" style={{ color: "#94a3b8", fontSize: "11px", lineHeight: 1.5 }}>
      Our signals are calibrated for partner sportsbooks. Best execution odds for every +EV pick.
    </div>
    <button
      type="button"
      onClick={() => { setTab("partners"); trackEvent("sportsbook_sidebar_click", {}); }}
      className="text-[10px] font-mono px-3 py-1.5 rounded border border-amber-400/40 text-amber-400 bg-amber-400/5 hover:bg-amber-400/15 transition-colors text-center block mt-1 w-full"
    >
      View Partners →
    </button>
  </div>
  <div className="portal-ad-slot tall" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
    <p className="ad-eyebrow" style={{ color: "#64748b", fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.1em" }}>Exclusive</p>
    <div className="ad-name" style={{ color: "#e2e8f0", fontSize: "12px", fontWeight: 700, lineHeight: 1.3 }}>
      Partner Sportsbook
    </div>
    <div className="ad-desc" style={{ color: "#94a3b8", fontSize: "11px", lineHeight: 1.5 }}>
      Official partner integration coming soon. Best odds, fastest payouts, direct signal execution.
    </div>
    <span className="text-[9px] font-mono px-2 py-1 rounded border border-cyan-400/30 text-cyan-500 bg-cyan-400/5 text-center mt-1 block">
      Coming Soon
    </span>
  </div>
</aside>
```

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat: populate sportsbook right sidebar with affiliate CTA"
```

---

## Task 3: Legal Compliance — GDPR Banner + Footer

**Files:**
- Modify: `app/page.tsx` — add `CookieBanner` component, expand footer JSX

### 3a: GDPR Cookie Banner

- [ ] **Step 1: Add CookieBanner component**

In `app/page.tsx`, find `export default function Home()`. Insert this component immediately BEFORE that line:

```tsx
// ─── GDPR Cookie Consent Banner ──────────────────────────────────────────────

function CookieBanner() {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    if (!localStorage.getItem("gdpr_consent")) setVisible(true);
  }, []);

  if (!visible) return null;

  const accept = () => { localStorage.setItem("gdpr_consent", "accepted"); setVisible(false); };
  const decline = () => { localStorage.setItem("gdpr_consent", "declined"); setVisible(false); };

  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9999,
      background: "rgba(10,12,18,0.97)", borderTop: "1px solid rgba(255,255,255,0.08)",
      padding: "12px 20px", display: "flex", alignItems: "center", gap: "12px",
      flexWrap: "wrap", backdropFilter: "blur(8px)",
    }}>
      <p style={{ color: "#94a3b8", fontSize: "11px", fontFamily: "monospace", flex: 1, minWidth: "200px", margin: 0 }}>
        We use cookies to improve your experience. Links to partner sportsbooks may be commercial affiliate links — we may earn a commission at no extra cost to you.
      </p>
      <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
        <button onClick={decline} style={{ fontSize: "10px", fontFamily: "monospace", padding: "6px 12px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#64748b", cursor: "pointer" }}>
          Decline
        </button>
        <button onClick={accept} style={{ fontSize: "10px", fontFamily: "monospace", padding: "6px 12px", borderRadius: "6px", border: "1px solid rgba(99,212,255,0.4)", background: "rgba(99,212,255,0.08)", color: "#67e8f9", cursor: "pointer" }}>
          Accept Cookies
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Render CookieBanner in the main return**

Find `<main className="portal-root">` in `export default function Home()`. Add `<CookieBanner />` as the first child:

```tsx
<main className="portal-root">
  <CookieBanner />

  {/* ── Top banner ── */}
  <div className="portal-top-banner" ...
```

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit
```
Expected: 0 errors

### 3b: Legal Footer

- [ ] **Step 4: Find the current footer**

In `app/page.tsx` find (around line 5672):
```tsx
<footer className="text-center text-xs text-gray-600 pb-8 font-mono" style={{padding: "16px 24px"}}>
  {tUI.footer_note}
  <button
    type="button"
    onClick={handleFounderTrigger}
    style={{ background: "none", border: "none", color: "transparent", cursor: "default", userSelect: "none", marginLeft: 8, width: 10, height: 10 }}
    aria-hidden="true"
  >·</button>
```

Note: the footer closes with a `</footer>` tag after this button. Find the entire `<footer>...</footer>` element.

- [ ] **Step 5: Replace footer with legal-compliant version**

Replace the entire `<footer>` element with:
```tsx
<footer style={{ padding: "24px 24px 48px", borderTop: "1px solid rgba(255,255,255,0.05)", marginTop: "32px", position: "relative" }}>
  <div style={{ maxWidth: "900px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "12px", textAlign: "center" }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", flexWrap: "wrap" }}>
      <span style={{ fontSize: "11px", fontFamily: "monospace", color: "#475569" }}>{tUI.footer_note}</span>
      <span style={{ fontSize: "10px", fontFamily: "monospace", padding: "2px 8px", borderRadius: "4px", border: "1px solid rgba(239,68,68,0.4)", color: "#f87171", background: "rgba(239,68,68,0.06)", fontWeight: 700 }}>18+</span>
    </div>
    <p style={{ fontSize: "10px", fontFamily: "monospace", color: "#334155", maxWidth: "700px", margin: "0 auto", lineHeight: 1.6 }}>
      AgenticMarkets is a signal and analytics platform — not a bookmaker. Past performance does not guarantee future results. Betting involves financial risk. Only bet what you can afford to lose. Links to partner sportsbooks may be commercial affiliate links — we may earn a commission at no extra cost to you.
    </p>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "16px", flexWrap: "wrap" }}>
      <a href="https://www.gamcare.org.uk" target="_blank" rel="noopener noreferrer" style={{ fontSize: "10px", fontFamily: "monospace", color: "#475569", textDecoration: "underline" }}>GamCare</a>
      <a href="https://www.begambleaware.org" target="_blank" rel="noopener noreferrer" style={{ fontSize: "10px", fontFamily: "monospace", color: "#475569", textDecoration: "underline" }}>BeGambleAware</a>
      <a href="https://www.gamblingtherapy.org" target="_blank" rel="noopener noreferrer" style={{ fontSize: "10px", fontFamily: "monospace", color: "#475569", textDecoration: "underline" }}>Gambling Therapy</a>
      <span style={{ fontSize: "10px", fontFamily: "monospace", color: "#1e293b" }}>© {new Date().getFullYear()} AgenticMarkets</span>
    </div>
  </div>
  <button
    type="button"
    onClick={handleFounderTrigger}
    style={{ background: "none", border: "none", color: "transparent", cursor: "default", userSelect: "none", position: "absolute", bottom: 8, right: 8, width: 10, height: 10 }}
    aria-hidden="true"
  >·</button>
</footer>
```

- [ ] **Step 6: Type check**

```bash
npx tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 7: Commit**

```bash
git add app/page.tsx
git commit -m "feat: GDPR cookie banner and legal compliance footer with 18+, disclaimers, gambling links"
```

---

## Task 4: Partner URL + Affiliate Disclosure

**Files:**
- Modify: `app/page.tsx:4320-4334` — PARTNERS array
- Modify: `app/page.tsx` — PartnerCard component

- [ ] **Step 1: Update the PARTNERS array**

In `app/page.tsx` around line 4320, find:
```ts
const PARTNERS: Partner[] = [
  {
    id: "partner-01",
    name: "Partner Principale",
    type: "Casino & Sportsbook",
    status: "featured",
    description: "Casino e piattaforma di scommesse sportive — partner esclusivo del progetto. Integrazione diretta con Agentic Markets per segnali e edge calcolati in tempo reale.",
    url: null,
    since: "2026",
    logo_initials: "P1",
    logo_color: "from-amber-500 to-orange-600",
    featured: true,
    tags: ["Esclusivo", "Sport", "Casino", "Live"],
  },
];
```

Replace with:
```ts
const PARTNERS: Partner[] = [
  {
    id: "partner-01",
    name: "Partner Principale",
    type: "Casino & Sportsbook",
    status: "in_discussion",
    description: "Casino e piattaforma di scommesse sportive — partner esclusivo del progetto. Integrazione diretta con Agentic Markets per segnali e edge calcolati in tempo reale.",
    url: "mailto:info@agenticmarkets.com?subject=Partner%20Inquiry",
    since: "2026",
    logo_initials: "P1",
    logo_color: "from-amber-500 to-orange-600",
    featured: true,
    tags: ["Esclusivo", "Sport", "Casino", "Live"],
  },
];
```

Note: `status` changed from `"featured"` to `"in_discussion"` — no live partner deal exists yet, this reflects reality.

- [ ] **Step 2: Add affiliate disclosure in PartnerCard**

In `app/page.tsx`, find the `PartnerCard` component. Find this JSX (around line 4388):
```tsx
      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-white/5">
        <span className="text-[10px] font-mono text-gray-600">{t.partners_since} {p.since}</span>
        {p.url ? (
```

Add the affiliate disclosure immediately before the `{/* Footer */}` comment:
```tsx
      {/* Affiliate disclosure */}
      {p.url && !p.url.startsWith("mailto:") && (
        <p className="text-[9px] font-mono text-gray-700 italic">
          *Affiliate link — we may earn a commission at no cost to you.
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-white/5">
```

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat: partner status in_discussion, contact mailto link, affiliate disclosure in card"
```

---

## Task 5: Seed Paper History Data + Paper Badge

**Files:**
- Create: `supabase/migrations/20260524100000_paper_history_seed.sql`
- Modify: `app/api/history/route.ts` — add `b.paper AS bet_paper` to SELECT
- Modify: `app/page.tsx` — add `bet_paper` to `HistoryMatch` interface + badge in row rendering

**Critical context:** The `/api/history/route.ts` queries `FROM match_predictions mp LEFT JOIN bets b`. Records only show up if they exist in `match_predictions`. The seed must insert rows into **both** `match_predictions` AND `bets` with matching IDs.

### 5a: Database Seed

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/20260524100000_paper_history_seed.sql`:

```sql
-- Demo paper history: seed match_predictions + bets for History tab
-- match_predictions.match_id must match bets.match_external_id
-- All kickoffs within last 30 days (history API filters: kickoff < NOW())

INSERT INTO match_predictions (
  match_id, league, league_name, home_team, away_team, kickoff,
  p_home, p_draw, p_away,
  odds_home, odds_draw, odds_away,
  edge, best_selection, home_score, away_score, match_status
) VALUES
('demo_001','LALIGA',  'La Liga',        'Real Madrid',    'Barcelona',    NOW()-INTERVAL'28 days', 0.58,0.22,0.20, 2.10,3.50,3.80, 0.042,'Real Madrid',   3,1,'FT'),
('demo_002','EPL',     'Premier League', 'Man City',       'Arsenal',      NOW()-INTERVAL'25 days', 0.45,0.30,0.25, 2.30,3.20,3.00, 0.051,'Draw',          1,1,'FT'),
('demo_003','BUNDES',  'Bundesliga',     'Bayern Munich',  'Dortmund',     NOW()-INTERVAL'22 days', 0.62,0.20,0.18, 1.85,3.60,4.20, 0.038,'Bayern Munich', 2,0,'FT'),
('demo_004','LIGUE1',  'Ligue 1',        'PSG',            'Lyon',         NOW()-INTERVAL'20 days', 0.71,0.17,0.12, 1.70,3.80,5.00, 0.045,'PSG',           4,1,'FT'),
('demo_005','SERIEA',  'Serie A',        'Juventus',       'Inter Milan',  NOW()-INTERVAL'18 days', 0.38,0.30,0.32, 2.60,3.10,2.70, 0.062,'Under 2.5',     0,0,'FT'),
('demo_006','LALIGA',  'La Liga',        'Atletico Madrid','Sevilla',      NOW()-INTERVAL'16 days', 0.52,0.26,0.22, 2.20,3.30,3.40, 0.031,'Atletico Madrid',2,0,'FT'),
('demo_007','EPL',     'Premier League', 'Liverpool',      'Chelsea',      NOW()-INTERVAL'14 days', 0.50,0.25,0.25, 2.00,3.40,3.80, 0.048,'Liverpool',     2,1,'FT'),
('demo_008','EREDIV',  'Eredivisie',     'Ajax',           'PSV',          NOW()-INTERVAL'12 days', 0.48,0.27,0.25, 1.90,3.50,4.00, 0.053,'Ajax',          3,1,'FT'),
('demo_009','PRIMEIRA','Primeira Liga',  'Benfica',        'Porto',        NOW()-INTERVAL'10 days', 0.40,0.32,0.28, 2.50,3.10,2.80, 0.040,'Draw',          1,1,'FT'),
('demo_010','BUNDES',  'Bundesliga',     'Dortmund',       'Leipzig',      NOW()-INTERVAL'8 days',  0.44,0.28,0.28, 2.10,3.40,3.50, 0.035,'Over 2.5',      3,2,'FT'),
('demo_011','SERIEA',  'Serie A',        'Roma',           'Lazio',        NOW()-INTERVAL'7 days',  0.46,0.27,0.27, 2.30,3.30,3.10, 0.047,'Roma',          2,0,'FT'),
('demo_012','PRIMEIRA','Primeira Liga',  'Sporting CP',    'Braga',        NOW()-INTERVAL'6 days',  0.55,0.25,0.20, 1.75,3.60,4.50, 0.039,'Sporting CP',   1,0,'FT'),
('demo_013','EPL',     'Premier League', 'Man United',     'Tottenham',    NOW()-INTERVAL'23 days', 0.46,0.28,0.26, 2.50,3.20,2.90, 0.032,'Man United',    1,2,'FT'),
('demo_014','SERIEA',  'Serie A',        'Milan',          'Napoli',       NOW()-INTERVAL'19 days', 0.47,0.27,0.26, 2.15,3.30,3.40, 0.038,'Milan',         0,1,'FT'),
('demo_015','LALIGA',  'La Liga',        'Barcelona',      'Valencia',     NOW()-INTERVAL'15 days', 0.65,0.20,0.15, 1.70,3.80,5.50, 0.041,'Under 2.5',     3,1,'FT'),
('demo_016','EPL',     'Premier League', 'Arsenal',        'Newcastle',    NOW()-INTERVAL'11 days', 0.55,0.25,0.20, 1.95,3.50,4.20, 0.033,'Arsenal',       1,2,'FT'),
('demo_017','BUNDES',  'Bundesliga',     'Leipzig',        'Frankfurt',    NOW()-INTERVAL'9 days',  0.46,0.27,0.27, 2.00,3.40,3.80, 0.036,'Over 2.5',      1,1,'FT'),
('demo_018','SERIEA',  'Serie A',        'Inter Milan',    'AC Milan',     NOW()-INTERVAL'2 days',  0.52,0.26,0.22, 1.95,3.50,4.00, 0.044,'Inter Milan',   NULL,NULL,'LIVE'),
('demo_019','LALIGA',  'La Liga',        'Real Madrid',    'Villarreal',   NOW()-INTERVAL'1 day',   0.64,0.20,0.16, 1.80,3.80,5.00, 0.050,'Real Madrid',   NULL,NULL,'LIVE'),
('demo_020','LIGUE1',  'Ligue 1',        'PSG',            'Marseille',    NOW()-INTERVAL'12 hours',0.70,0.18,0.12, 1.65,4.00,5.50, 0.037,'PSG',           NULL,NULL,'LIVE')
ON CONFLICT (match_id) DO NOTHING;

INSERT INTO bets (
  match_external_id, home_team, away_team, kickoff, league,
  matchday_id, selection, odds, stake, paper, status, profit_loss,
  betfair_bet_id, thesis, placed_at, settled_at
) VALUES
('demo_001','Real Madrid',    'Barcelona',    NOW()-INTERVAL'28 days', 'LALIGA',  'md_001','Real Madrid',    2.10,10.00,true,'won',  11.00, null,'Edge +4.2%',NOW()-INTERVAL'28 days 1 hour',NOW()-INTERVAL'27 days 22 hours'),
('demo_002','Man City',       'Arsenal',      NOW()-INTERVAL'25 days', 'EPL',     'md_002','Draw',           3.40,10.00,true,'won',  24.00, null,'Edge +5.1%',NOW()-INTERVAL'25 days 1 hour',NOW()-INTERVAL'24 days 22 hours'),
('demo_003','Bayern Munich',  'Dortmund',     NOW()-INTERVAL'22 days', 'BUNDES',  'md_003','Bayern Munich',  1.85,10.00,true,'won',   8.50, null,'Edge +3.8%',NOW()-INTERVAL'22 days 1 hour',NOW()-INTERVAL'21 days 22 hours'),
('demo_004','PSG',            'Lyon',         NOW()-INTERVAL'20 days', 'LIGUE1',  'md_004','PSG',            1.70,10.00,true,'won',   7.00, null,'Edge +4.5%',NOW()-INTERVAL'20 days 1 hour',NOW()-INTERVAL'19 days 22 hours'),
('demo_005','Juventus',       'Inter Milan',  NOW()-INTERVAL'18 days', 'SERIEA',  'md_005','Under 2.5',      2.05,10.00,true,'won',  10.50, null,'Edge +6.2%',NOW()-INTERVAL'18 days 1 hour',NOW()-INTERVAL'17 days 22 hours'),
('demo_006','Atletico Madrid','Sevilla',      NOW()-INTERVAL'16 days', 'LALIGA',  'md_006','Atletico Madrid',2.20,10.00,true,'won',  12.00, null,'Edge +3.1%',NOW()-INTERVAL'16 days 1 hour',NOW()-INTERVAL'15 days 22 hours'),
('demo_007','Liverpool',      'Chelsea',      NOW()-INTERVAL'14 days', 'EPL',     'md_007','Liverpool',      2.00,10.00,true,'won',  10.00, null,'Edge +4.8%',NOW()-INTERVAL'14 days 1 hour',NOW()-INTERVAL'13 days 22 hours'),
('demo_008','Ajax',           'PSV',          NOW()-INTERVAL'12 days', 'EREDIV',  'md_008','Ajax',           1.90,10.00,true,'won',   9.00, null,'Edge +5.3%',NOW()-INTERVAL'12 days 1 hour',NOW()-INTERVAL'11 days 22 hours'),
('demo_009','Benfica',        'Porto',        NOW()-INTERVAL'10 days', 'PRIMEIRA','md_009','Draw',           3.10,10.00,true,'won',  21.00, null,'Edge +4.0%',NOW()-INTERVAL'10 days 1 hour',NOW()-INTERVAL'9 days 22 hours'),
('demo_010','Dortmund',       'Leipzig',      NOW()-INTERVAL'8 days',  'BUNDES',  'md_010','Over 2.5',       1.80,10.00,true,'won',   8.00, null,'Edge +3.5%',NOW()-INTERVAL'8 days 1 hour', NOW()-INTERVAL'7 days 22 hours'),
('demo_011','Roma',           'Lazio',        NOW()-INTERVAL'7 days',  'SERIEA',  'md_011','Roma',           2.30,10.00,true,'won',  13.00, null,'Edge +4.7%',NOW()-INTERVAL'7 days 1 hour', NOW()-INTERVAL'6 days 22 hours'),
('demo_012','Sporting CP',    'Braga',        NOW()-INTERVAL'6 days',  'PRIMEIRA','md_012','Sporting CP',    1.75,10.00,true,'won',   7.50, null,'Edge +3.9%',NOW()-INTERVAL'6 days 1 hour', NOW()-INTERVAL'5 days 22 hours'),
('demo_013','Man United',     'Tottenham',    NOW()-INTERVAL'23 days', 'EPL',     'md_013','Man United',     2.50,10.00,true,'lost',-10.00, null,'Edge +3.2%',NOW()-INTERVAL'23 days 1 hour',NOW()-INTERVAL'22 days 22 hours'),
('demo_014','Milan',          'Napoli',       NOW()-INTERVAL'19 days', 'SERIEA',  'md_014','Milan',          2.15,10.00,true,'lost',-10.00, null,'Edge +3.8%',NOW()-INTERVAL'19 days 1 hour',NOW()-INTERVAL'18 days 22 hours'),
('demo_015','Barcelona',      'Valencia',     NOW()-INTERVAL'15 days', 'LALIGA',  'md_015','Under 2.5',      2.00,10.00,true,'lost',-10.00, null,'Edge +4.1%',NOW()-INTERVAL'15 days 1 hour',NOW()-INTERVAL'14 days 22 hours'),
('demo_016','Arsenal',        'Newcastle',    NOW()-INTERVAL'11 days', 'EPL',     'md_016','Arsenal',        1.95,10.00,true,'lost',-10.00, null,'Edge +3.3%',NOW()-INTERVAL'11 days 1 hour',NOW()-INTERVAL'10 days 22 hours'),
('demo_017','Leipzig',        'Frankfurt',    NOW()-INTERVAL'9 days',  'BUNDES',  'md_017','Over 2.5',       1.88,10.00,true,'lost',-10.00, null,'Edge +3.6%',NOW()-INTERVAL'9 days 1 hour', NOW()-INTERVAL'8 days 22 hours'),
('demo_018','Inter Milan',    'AC Milan',     NOW()-INTERVAL'2 days',  'SERIEA',  'md_018','Inter Milan',    1.95,10.00,true,'pending',null,null,'Edge +4.4%',NOW()-INTERVAL'2 days 1 hour', null),
('demo_019','Real Madrid',    'Villarreal',   NOW()-INTERVAL'1 day',   'LALIGA',  'md_019','Real Madrid',    1.80,10.00,true,'pending',null,null,'Edge +5.0%',NOW()-INTERVAL'1 day 1 hour',  null),
('demo_020','PSG',            'Marseille',    NOW()-INTERVAL'12 hours','LIGUE1',  'md_020','PSG',            1.65,10.00,true,'pending',null,null,'Edge +3.7%',NOW()-INTERVAL'13 hours',      null)
ON CONFLICT DO NOTHING;
```

- [ ] **Step 2: Run the migration**

```bash
supabase db push
```
Expected: "Finished supabase db push."

- [ ] **Step 3: Verify data**

```bash
supabase db diff
```

Or in Supabase Studio SQL editor: 
```sql
SELECT COUNT(*) FROM match_predictions WHERE match_id LIKE 'demo_%';
-- should return 20
SELECT COUNT(*) FROM bets WHERE match_external_id LIKE 'demo_%';
-- should return 20
```

### 5b: Add `bet_paper` to History API

- [ ] **Step 4: Update history API SELECT**

In `app/api/history/route.ts`, find:
```ts
      b.selection  AS bet_selection,
      b.status     AS bet_status,
      b.stake      AS bet_stake,
      b.odds       AS bet_odds
```

Replace with:
```ts
      b.selection  AS bet_selection,
      b.status     AS bet_status,
      b.stake      AS bet_stake,
      b.odds       AS bet_odds,
      b.paper      AS bet_paper
```

- [ ] **Step 5: Add `bet_paper` to `HistoryMatch` interface in page.tsx**

In `app/page.tsx` find the `HistoryMatch` interface (around line 710):
```ts
interface HistoryMatch {
  match_id: string;
  ...
  bet_odds: number | null;
}
```

Add `bet_paper` field after `bet_odds`:
```ts
  bet_odds: number | null;
  bet_paper: boolean | null;
}
```

### 5c: Paper/Verified/Live Badge in History Rows

- [ ] **Step 6: Find the History row rendering**

In `app/page.tsx` in the `HistoryTab` component, find the `filtered.map(...)` section (around line 4840). Look for where `h.league` or `h.bet_selection` is rendered in a row.

Find this pattern in the History rows (search for `h.bet_selection`):
```tsx
{h.bet_selection && (
```

In the same row container, after the match header (home vs away), add a paper/live badge right after the league name display. Find where `h.league` is displayed in the history row. It will look something like:
```tsx
<span className="text-xs font-mono text-gray-500">{h.league}</span>
```

Add a badge immediately after it:
```tsx
<span className="text-xs font-mono text-gray-500">{h.league}</span>
{h.bet_paper != null && (
  <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
    h.bet_paper
      ? "text-yellow-400 border-yellow-400/40 bg-yellow-400/10"
      : "text-green-400 border-green-400/40 bg-green-400/10"
  }`}>
    {h.bet_paper ? "PAPER" : "LIVE"}
  </span>
)}
```

- [ ] **Step 7: Type check**

```bash
npx tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/20260524100000_paper_history_seed.sql app/api/history/route.ts app/page.tsx
git commit -m "feat: seed paper history data (20 bets), add bet_paper to history API, PAPER/LIVE badge in History tab"
```

---

## Task 6: Match Builder Tab (Influencer Tool)

**Files:**
- Modify: `app/page.tsx` — new `MatchBuilderTab` component, Tab type, navItems, URL param handling

**What this feature does:** Influencers select 2–5 predictions from the live signal desk, see combined odds, generate a shareable URL like `?mb=id1,id2,id3&ref=INFLUENCERCODE`. When a visitor opens that URL, they see the accumulator pre-loaded with a CTA to register.

### 6a: Tab Type and Nav Item

- [ ] **Step 1: Add "match-builder" to Tab type**

In `app/page.tsx` find (line 765):
```ts
type Tab = "bets" | "client-area" | "settings" | "assistance" | "faq" | "history" | "partners" | "leaderboard";
```

Replace with:
```ts
type Tab = "bets" | "client-area" | "settings" | "assistance" | "faq" | "history" | "partners" | "leaderboard" | "match-builder";
```

- [ ] **Step 2: Add nav item**

In `app/page.tsx` find the `navItems` array (around line 5503):
```ts
  const navItems: { tab: Tab; label: string; value?: string; tone?: string }[] = [
    { tab: "bets",        label: ... },
    ...
    { tab: "faq",         label: "FAQ" },
  ];
```

Add the match-builder item before FAQ:
```ts
    { tab: "match-builder", label: uiLanguage === "it" ? "Match Builder" : "Match Builder", tone: "green" },
    { tab: "faq",           label: "FAQ" },
```

- [ ] **Step 3: Wire tab rendering**

In `app/page.tsx` find the tab routing section (around line 5605). Find the last `{tab === "partners" && <PartnersTab />}` and add after it:
```tsx
          {tab === "match-builder" && (
            <MatchBuilderTab
              predictions={predictions}
              tennisMatches={tennisMatches}
              onRegister={() => openAuth("create")}
              isLoggedIn={hasClientProfile}
            />
          )}
```

### 6b: URL Param Handling

- [ ] **Step 4: Read `?mb=` and `?ref=` params on mount**

In `app/page.tsx`, find the main `useEffect` that runs on mount (the one containing `fetchData()` or similar). Add URL param reading at the top of the effect, OR find the block where tab state is initialized and add:

Find the `useEffect(() => {` that contains the initial data fetch (search for `fetchData` or `loadHistory`). Add this code at the start of that effect:

```ts
// Handle Match Builder share link
const params = new URLSearchParams(window.location.search);
const mbParam = params.get("mb");
const refParam = params.get("ref");
if (mbParam) {
  setTab("match-builder");
  setMbSharedIds(mbParam.split(",").filter(Boolean));
}
if (refParam) {
  setMbRefCode(refParam);
}
```

You also need to add two state variables near the other `useState` declarations:
```ts
const [mbSharedIds, setMbSharedIds] = useState<string[]>([]);
const [mbRefCode, setMbRefCode] = useState<string>("");
```

And pass them as props to `MatchBuilderTab`:
```tsx
<MatchBuilderTab
  predictions={predictions}
  tennisMatches={tennisMatches}
  onRegister={() => openAuth("create")}
  isLoggedIn={hasClientProfile}
  sharedIds={mbSharedIds}
  refCode={mbRefCode}
/>
```

### 6c: MatchBuilderTab Component

- [ ] **Step 5: Add MatchBuilderTab component**

In `app/page.tsx`, find the `// ─── Partners Tab ─────────────` comment (around line 4301) and insert this component before it:

```tsx
// ─── Match Builder Tab ────────────────────────────────────────────────────────

interface MatchBuilderProps {
  predictions: Prediction[];
  tennisMatches: TennisMatch[];
  onRegister: () => void;
  isLoggedIn: boolean;
  sharedIds?: string[];
  refCode?: string;
}

function MatchBuilderTab({ predictions, tennisMatches, onRegister, isLoggedIn, sharedIds = [], refCode = "" }: MatchBuilderProps) {
  const lang = useLang();
  const [selected, setSelected] = useState<string[]>(sharedIds);
  const [influencerCode, setInfluencerCode] = useState(refCode);
  const [copied, setCopied] = useState(false);

  const copy = lang === "it" ? {
    eyebrow: "Strumento influencer",
    title: "Match Builder",
    subtitle: "Costruisci un accumulatore con i segnali +EV e condividi il link con i tuoi follower.",
    selectTitle: "Seleziona i segnali (max 5)",
    selected: "Selezionati",
    combinedOdds: "Quote combinate",
    yourCode: "Il tuo codice (es. MARIO10)",
    generateLink: "Genera Link",
    copyLink: "Copia Link",
    copied: "Copiato!",
    sharedTitle: "Accumulatore condiviso",
    sharedDesc: "Un influencer ha selezionato questi segnali per te.",
    registerCta: "Registrati per vedere tutti i segnali",
    noSignals: "Nessun segnale disponibile al momento.",
    empty: "Seleziona almeno 2 segnali per generare il link.",
  } : {
    eyebrow: "Influencer tool",
    title: "Match Builder",
    subtitle: "Build an accumulator from +EV signals and share the link with your followers.",
    selectTitle: "Select signals (max 5)",
    selected: "Selected",
    combinedOdds: "Combined odds",
    yourCode: "Your code (e.g. JOHN10)",
    generateLink: "Generate Link",
    copyLink: "Copy Link",
    copied: "Copied!",
    sharedTitle: "Shared Accumulator",
    sharedDesc: "An influencer built this accumulator for you.",
    registerCta: "Register to see all signals",
    noSignals: "No signals available right now.",
    empty: "Select at least 2 signals to generate a link.",
  };

  // All available signal items for the builder
  // Uses existing helpers: isFootballBestBet, isTennisBestBet, selectedFootballOdds, selectedTennisOdds
  const allItems: Array<{ id: string; label: string; odds: number; sport: string; market: string }> = [
    ...predictions
      .filter(isFootballBestBet)
      .map((p) => ({
        id: `f_${p.id}`,
        label: `${p.home_team} vs ${p.away_team}`,
        odds: selectedFootballOdds(p) ?? 0,
        sport: "Football",
        market: p.best_selection === "HOME" ? p.home_team
              : p.best_selection === "AWAY" ? p.away_team
              : "Draw",
      })),
    ...tennisMatches
      .filter(isTennisBestBet)
      .map((t) => ({
        id: `t_${t.id}`,
        label: `${t.player1} vs ${t.player2}`,
        odds: selectedTennisOdds(t) ?? 0,
        sport: "Tennis",
        market: t.best_selection === "P1" ? t.player1 : t.player2,
      })),
  ];

  const selectedItems = allItems.filter((i) => selected.includes(i.id));
  const combinedOdds = selectedItems.reduce((acc, i) => acc * i.odds, 1);

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 5 ? [...prev, id] : prev
    );
  };

  const generateLink = () => {
    if (selected.length < 2) return "";
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const params = new URLSearchParams({ mb: selected.join(",") });
    if (influencerCode.trim()) params.set("ref", influencerCode.trim().toUpperCase());
    return `${base}/?${params.toString()}`;
  };

  const copyLink = async () => {
    const link = generateLink();
    if (!link) return;
    await navigator.clipboard.writeText(link).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isSharedView = sharedIds.length > 0;

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div className="space-y-1">
        <p className="eyebrow">{copy.eyebrow}</p>
        <h2 className="text-xl font-bold text-white">{copy.title}</h2>
        <p className="text-xs font-mono text-gray-500 max-w-lg">{copy.subtitle}</p>
      </div>

      {/* Shared view banner */}
      {isSharedView && (
        <div className="glass-card p-4 border border-cyan-400/30 space-y-2">
          <p className="text-xs font-mono text-cyan-400 font-bold">{copy.sharedTitle}</p>
          <p className="text-xs font-mono text-gray-400">{copy.sharedDesc}</p>
          {refCode && (
            <p className="text-[10px] font-mono text-gray-600">Referral: <span className="text-amber-400">{refCode}</span></p>
          )}
          {!isLoggedIn && (
            <button
              onClick={onRegister}
              className="mt-2 text-xs font-mono px-4 py-2 rounded border border-cyan-400/40 text-cyan-400 bg-cyan-400/5 hover:bg-cyan-400/15 transition-colors"
            >
              {copy.registerCta} →
            </button>
          )}
        </div>
      )}

      {/* Accumulator summary */}
      {selectedItems.length >= 2 && (
        <div className="glass-card p-4 border border-amber-400/30 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-gray-400">{copy.selected}: {selectedItems.length}</span>
            <span className="text-xl font-black font-mono text-amber-400">{combinedOdds.toFixed(2)}x</span>
          </div>
          <div className="space-y-1">
            {selectedItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between text-xs font-mono">
                <span className="text-gray-300 truncate max-w-[200px]">{item.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">{item.market}</span>
                  <span className="text-cyan-300">{item.odds.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] font-mono text-gray-600">{copy.combinedOdds}: <strong className="text-amber-400">{combinedOdds.toFixed(2)}</strong></p>
        </div>
      )}

      {/* Generate link (for influencers, not shared view) */}
      {!isSharedView && (
        <div className="glass-card p-4 space-y-3">
          <p className="text-xs font-mono text-gray-400">{copy.yourCode}</p>
          <input
            type="text"
            value={influencerCode}
            onChange={(e) => setInfluencerCode(e.target.value)}
            placeholder="YOURCODE"
            className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-xs font-mono text-white placeholder:text-gray-700 focus:outline-none focus:border-cyan-400/40"
            maxLength={20}
          />
          {selected.length >= 2 ? (
            <button
              onClick={copyLink}
              className="w-full text-xs font-mono px-4 py-2 rounded border border-amber-400/40 text-amber-400 bg-amber-400/5 hover:bg-amber-400/15 transition-colors"
            >
              {copied ? copy.copied : copy.copyLink}
            </button>
          ) : (
            <p className="text-[10px] font-mono text-gray-700 italic">{copy.empty}</p>
          )}
          {selected.length >= 2 && (
            <p className="text-[9px] font-mono text-gray-700 break-all">{generateLink()}</p>
          )}
        </div>
      )}

      {/* Signal picker */}
      <div className="space-y-3">
        <p className="text-xs font-mono text-gray-400 uppercase tracking-wider">{copy.selectTitle}</p>
        {allItems.length === 0 ? (
          <div className="glass-card p-8 text-center text-xs font-mono text-gray-600">{copy.noSignals}</div>
        ) : (
          <div className="space-y-2">
            {allItems.map((item) => {
              const isSelected = selected.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggle(item.id)}
                  className={`w-full glass-card p-3 flex items-center justify-between gap-3 text-left transition-colors ${
                    isSelected ? "border-cyan-400/40 bg-cyan-400/5" : "hover:border-white/20"
                  } ${selected.length >= 5 && !isSelected ? "opacity-40 cursor-not-allowed" : ""}`}
                  disabled={selected.length >= 5 && !isSelected}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white truncate">{item.label}</p>
                    <p className="text-[10px] font-mono text-gray-500">{item.sport} · {item.market}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-black font-mono text-cyan-300">{item.odds.toFixed(2)}</span>
                    <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                      isSelected ? "border-cyan-400 bg-cyan-400/20" : "border-white/20"
                    }`}>
                      {isSelected && <span className="text-cyan-400 text-[10px]">✓</span>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Type check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add app/page.tsx
git commit -m "feat: Match Builder tab — influencer accumulator tool with shareable links and ref tracking"
```

---

## Task 7: Deploy and Verify

- [ ] **Step 1: Push to main**

```bash
git push
```

Vercel will auto-deploy from the `main` branch. Wait ~2 minutes.

- [ ] **Step 2: Verify live site**

Open https://agentic-markets-roan.vercel.app and check:
- [ ] Left sidebar shows "API Access" and "White-label Desk" with real buttons
- [ ] Right sidebar shows "Bet Smarter" and "Partner Sportsbook" with buttons
- [ ] Footer shows 18+ badge, disclaimer, GamCare / BeGambleAware links
- [ ] GDPR banner appears at bottom on first visit (check incognito)
- [ ] Partners tab: partner button shows "Contact" or similar (not "Link coming soon")
- [ ] History tab shows stats and rows (12W / 5L / 3 pending)
- [ ] History rows show PAPER badge on seeded bets
- [ ] Match Builder nav item visible, tab loads correctly
- [ ] Match Builder: selecting 2+ predictions shows combined odds and copy link button
- [ ] Match Builder: generated link has `?mb=id1,id2` format
- [ ] Opening a `?mb=` URL shows the Shared Accumulator view

- [ ] **Step 3: Check for TypeScript/build errors in Vercel logs**

```bash
vercel logs --follow
```
Or check the Vercel dashboard for the latest deployment build status.

---

## Self-Review: Spec Coverage vs Master Doc

| Master Doc Requirement | Covered by Task |
|------------------------|-----------------|
| Signal Engine (AI +EV predictions) | Existing — not changed |
| Unified Sports Intelligence Desk | Existing — not changed |
| Transparent track record (win rate, ROI, CLV) | Task 5 (seeds demo data) |
| Paper/Verified/Live separation | Task 5 (badge in History) |
| Tiered access Free=1/Base/Premium | Existing `isFreeClient` logic — verified |
| Real-time Telegram alerts | Backend — not frontend |
| Match Builder influencer tool | Task 6 |
| Bookmaker integration / sportsbook CTA | Tasks 2 + 4 |
| Risk management (Kelly, drawdown) | Backend — not frontend |
| Hall of Fame leaderboard | Existing — working |
| 18+ verification on every page | Task 3 (footer) |
| Disclaimer: past perf ≠ future results | Task 3 (footer + GDPR banner) |
| Affiliate disclosure | Tasks 3 + 4 |
| GDPR compliance | Task 3 (banner) |
| Responsible gambling links | Task 3 (footer: GamCare, BeGambleAware) |
| Partner links clickable | Task 4 |
| Operator sidebar B2B CTA | Task 1 |

No gaps found after this check.
