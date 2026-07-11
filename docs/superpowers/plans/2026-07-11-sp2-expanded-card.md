# SP2 — La scheda espansa (tutti i mercati) · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Al tap su una `PickCard`, aprire una scheda espansa (bottom sheet) che mostra — per quel match — spiegazione, readout **Modello vs Mercato** (numerico, no barre) e **tutti i mercati** raggruppati (Esiti · Gol · Marcatori · Soft Pro-locked), caricati **on-demand** all'apertura.

**Architecture:** Il feed resta su `/api/v2/predictions` (SP1). All'apertura, un hook `useMatchDetail(externalEventId)` fetcha la lista ricca `/api/predictions` e filtra la riga per `match_id === externalEventId` (correlazione confermata: club-league sync 1:1, WC via fallback). La logica di raggruppamento mercati viene **estratta** dal monolite (`app/app/page.tsx` mdsData IIFE + `components/MatchDetailSheet.tsx` tipi) in un modulo puro testato `features/feed/market-groups.ts`. La scheda vive in un `Sheet` (primitiva UI rimandata da SP0, costruita qui).

**Tech Stack:** Next.js 16, React 19, TypeScript 5, Tailwind 4, Vitest + Testing Library.

## Global Constraints

- **Prerequisito:** SP0 + SP1 su `main`. Branch `feat/sp2-expanded-card` da `main` aggiornato.
- **Decisioni approvate (Andrea):** (1) dati mercati **fetch on-demand** all'apertura, il feed resta su v2; (2) **estrarre e riusare** la logica di grouping esistente (non ricostruire).
- **Correlazione feed↔mercati:** chiave = `external_event_id` (v2) === `match_predictions.match_id` (v1). `/api/predictions` non ha param per singolo match → **shortcut marcato**: fetch della lista (≤120) + filtro client per id; upgrade path = endpoint dedicato `/api/predictions/[id]` in un SP futuro.
- **Gating Pro (già server-side):** `1X2` e `Over/Under` fino a **base**; `Marcatori` (`enrichment.goalscorer_markets`) e `Soft` (`enrichment.soft`) sono **Pro-only** — per non-Pro il server manda `enrichment.soft_locked = true` e omette `goalscorer_markets`. Anonimo/free non-PotD: riga `locked` senza dati. La scheda deve rispettare questi stati (mai inventare dati assenti).
- **FTC:** "Sicurezza" = confidenza del modello, non garanzia; edge mai negativo mostrato; nessun claim "battiamo il mercato". Corner **esclusi** dalla UI ("nessuna skill validata", come nel monolite).
- **Zero AI-slop:** icone via `SportIcon`/SVG a tratto consistente, crest via `Crest`, mai emoji. Modello-vs-Mercato in numeri, **mai barre** (standard scheda).
- **Next 16:** leggere `node_modules/next/dist/docs/` prima di codice che tocca API Next (portal/Sheet, event handling). Vedi `AGENTS.md`.
- **TDD, commit frequenti; PR a fine SP.**

### Tipi di riferimento (dal codice reale — usare questi campi verbatim)
```ts
// da app/api/predictions/route.ts:66-88 (PredictionRow, v1 ricco)
type RichPrediction = {
  match_id: string; league: string; league_name: string;
  home_team: string; away_team: string; kickoff: string;
  p_home: number; p_draw: number; p_away: number;
  odds_home: number | null; odds_draw: number | null; odds_away: number | null;
  edge: number | null; best_selection: string | null;
  confidence_score?: number | null;
  match_type?: string | null; is_estimate?: boolean;
  locked?: boolean;
  enrichment?: {
    extra_markets?: ExtraMarket[];
    goalscorer_markets?: GoalscorerMarket[];
    goals_summary?: { expected_goals: number };
    soft?: { cards?: SoftLine; fouls?: SoftLine; corners?: SoftLine };
    soft_locked?: boolean;
    explanation?: string | null; research?: string | null;
  } | null;
};
// da lib/poisson-model.ts:156
type ExtraMarket = { key: string; label: string; p: number; model_odds: number; market_odds: number | null; edge: number | null };
// da lib/goalscorer-model.ts:21
type GoalscorerMarket = { playerId: string; name: string; side: "home" | "away"; pScores: number; marketImplied: number | null; bestPrice: number | null; bookmaker: string | null; edge: number | null; confidence: "alta" | "media" };
// da app/api/predictions/route.ts:290
type SoftLine = { expected: number; main_line: number; p_over: number; is_generic: boolean };
```

---

### Task 1: `Sheet` primitiva (rimandata da SP0)

Bottom sheet/overlay riusabile per la scheda espansa (e futuri SP3).

**Files:**
- Create: `components/ui/Sheet.tsx`
- Modify: `components/ui/index.ts` (export)
- Test: `components/ui/Sheet.test.tsx`

**Interfaces:**
- Produces: `Sheet({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: React.ReactNode; title?: string }): JSX.Element | null`. Quando `open=false` ritorna `null`. `role="dialog"`, `aria-modal="true"`, `aria-label={title}`. Chiusura su: click backdrop, tasto `Escape`. Non chiude sul click interno.

- [ ] **Step 1: Test che falliscono**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Sheet } from "./Sheet";

describe("Sheet", () => {
  it("non rende nulla se chiuso", () => {
    const { container } = render(<Sheet open={false} onClose={() => {}}>x</Sheet>);
    expect(container).toBeEmptyDOMElement();
  });
  it("rende i children e ruolo dialog se aperto", () => {
    render(<Sheet open onClose={() => {}} title="Dettaglio">contenuto</Sheet>);
    expect(screen.getByRole("dialog", { name: "Dettaglio" })).toBeInTheDocument();
    expect(screen.getByText("contenuto")).toBeInTheDocument();
  });
  it("chiude su Escape", async () => {
    const onClose = vi.fn();
    render(<Sheet open onClose={onClose}>x</Sheet>);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });
  it("chiude su click backdrop ma non su click interno", async () => {
    const onClose = vi.fn();
    render(<Sheet open onClose={onClose}><button>dentro</button></Sheet>);
    await userEvent.click(screen.getByText("dentro"));
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.click(screen.getByTestId("sheet-backdrop"));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Verificare RED**

Run: `npx vitest run components/ui/Sheet.test.tsx`
Expected: FAIL — modulo non risolto.

- [ ] **Step 3: Implementare `components/ui/Sheet.tsx`**

```tsx
"use client";

import { useEffect, type ReactNode } from "react";

export function Sheet({ open, onClose, children, title }: {
  open: boolean; onClose: () => void; children: ReactNode; title?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      data-testid="sheet-backdrop"
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center",
        background: "rgba(0,0,0,.55)" }}
    >
      <div
        role="dialog" aria-modal="true" aria-label={title}
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 480, maxHeight: "92dvh", overflowY: "auto",
          background: "var(--am-bg)", borderTopLeftRadius: 20, borderTopRightRadius: 20,
          border: "1px solid var(--am-line)", boxShadow: "0 -20px 60px -20px rgba(0,0,0,.6)" }}
      >
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verificare GREEN + export**

Run: `npx vitest run components/ui/Sheet.test.tsx`
Expected: PASS. Poi aggiungere a `components/ui/index.ts`: `export { Sheet } from "./Sheet";`

- [ ] **Step 5: Commit**

```bash
git add components/ui/Sheet.tsx components/ui/Sheet.test.tsx components/ui/index.ts
git commit -m "feat(sp2): Sheet primitive (bottom sheet, Escape/backdrop close, a11y dialog)"
```

---

### Task 2: `market-groups.ts` — tipi + Esiti/Gol + ModelVsMarket (estratto dal monolite)

Porta la logica di grouping da `app/app/page.tsx` (mdsData IIFE ~4820-4856) e i tipi da `components/MatchDetailSheet.tsx:17-35`, in forma **pura e testata**. Questa task copre i tipi, il gruppo Esiti (1X2), il gruppo Gol (Over/Under) e il readout Modello-vs-Mercato.

**Files:**
- Create: `features/feed/market-groups.ts`
- Test: `features/feed/market-groups.test.ts`

**Interfaces:**
- Produces:
  - `type MarketChip = { id: string; market: string; selection: string; prob: number | null; odds: number | null; hasValue: boolean; recommended: boolean }`
  - `type MarketGroup = { key: "esiti" | "gol" | "marcatori" | "soft"; title: string; locked?: boolean; chips: MarketChip[]; note?: string }`
  - `type ModelVsMarket = { modelProb: number | null; impliedProb: number | null; bestOdds: number | null; edgePct: number | null }`
  - `buildModelVsMarket(row: RichPrediction): ModelVsMarket`
  - `buildMainGroups(row: RichPrediction): MarketGroup[]` — restituisce i gruppi **esiti** e (se disponibile) **gol**.

Note di porting (dal monolite): pick = `best_selection ?? argmax(p_home,p_draw,p_away)`; implied = `1/odds` dell'esito scelto; `edgePct = edge>0 ? edge*100 : null` (mai negativo); over/under si seleziona da `extra_markets` per label contenente `over`/`under` + la linea (Over/Under si mostra solo se esiste una linea nel modello). `hasValue = (chip.edge ?? 0) > 0`.

- [ ] **Step 1: Test che falliscono**

```ts
import { describe, it, expect } from "vitest";
import { buildModelVsMarket, buildMainGroups, type RichPrediction } from "./market-groups";

const row: RichPrediction = {
  match_id: "1", league: "SA", league_name: "Serie A", home_team: "Inter", away_team: "Verona",
  kickoff: "2026-07-11T18:45:00Z", p_home: 0.72, p_draw: 0.18, p_away: 0.10,
  odds_home: 1.55, odds_draw: 4.2, odds_away: 6.0, edge: 0.08, best_selection: "HOME",
  confidence_score: 78,
  enrichment: {
    extra_markets: [
      { key: "over_2_5", label: "Over 2.5", p: 0.61, model_odds: 1.64, market_odds: 1.72, edge: 0.05 },
      { key: "under_2_5", label: "Under 2.5", p: 0.39, model_odds: 2.56, market_odds: 2.10, edge: null },
    ],
    goals_summary: { expected_goals: 2.9 },
  },
};

describe("buildModelVsMarket", () => {
  it("modello vs implicita vs quota + edge mai negativo", () => {
    const mvm = buildModelVsMarket(row);
    expect(mvm.modelProb).toBeCloseTo(0.72, 5);
    expect(mvm.impliedProb).toBeCloseTo(1 / 1.55, 4);
    expect(mvm.bestOdds).toBe(1.55);
    expect(mvm.edgePct).toBeCloseTo(8, 5);
    expect(buildModelVsMarket({ ...row, edge: -0.03 }).edgePct).toBeNull();
  });
});

describe("buildMainGroups", () => {
  it("gruppo esiti con 3 chip e il pick raccomandato", () => {
    const g = buildMainGroups(row).find((x) => x.key === "esiti")!;
    expect(g.chips).toHaveLength(3);
    expect(g.chips.find((c) => c.recommended)!.selection).toContain("Inter");
  });
  it("gruppo gol da extra_markets (Over/Under)", () => {
    const g = buildMainGroups(row).find((x) => x.key === "gol")!;
    expect(g.chips.map((c) => c.selection)).toEqual(["Over 2.5", "Under 2.5"]);
    expect(g.chips[0].hasValue).toBe(true);
  });
  it("niente gruppo gol se non ci sono extra_markets over/under", () => {
    expect(buildMainGroups({ ...row, enrichment: {} }).find((x) => x.key === "gol")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Verificare RED**

Run: `npx vitest run features/feed/market-groups.test.ts`
Expected: FAIL — modulo non risolto.

- [ ] **Step 3: Implementare `features/feed/market-groups.ts`** (tipi + Esiti + Gol + ModelVsMarket)

```ts
export type ExtraMarket = { key: string; label: string; p: number; model_odds: number; market_odds: number | null; edge: number | null };
export type GoalscorerMarket = { playerId: string; name: string; side: "home" | "away"; pScores: number; marketImplied: number | null; bestPrice: number | null; bookmaker: string | null; edge: number | null; confidence: "alta" | "media" };
export type SoftLine = { expected: number; main_line: number; p_over: number; is_generic: boolean };

export type RichPrediction = {
  match_id: string; league: string; league_name: string;
  home_team: string; away_team: string; kickoff: string;
  p_home: number; p_draw: number; p_away: number;
  odds_home: number | null; odds_draw: number | null; odds_away: number | null;
  edge: number | null; best_selection: string | null;
  confidence_score?: number | null;
  match_type?: string | null; is_estimate?: boolean; locked?: boolean;
  enrichment?: {
    extra_markets?: ExtraMarket[]; goalscorer_markets?: GoalscorerMarket[];
    goals_summary?: { expected_goals: number };
    soft?: { cards?: SoftLine; fouls?: SoftLine; corners?: SoftLine };
    soft_locked?: boolean; explanation?: string | null; research?: string | null;
  } | null;
};

export type MarketChip = { id: string; market: string; selection: string; prob: number | null; odds: number | null; hasValue: boolean; recommended: boolean };
export type MarketGroup = { key: "esiti" | "gol" | "marcatori" | "soft"; title: string; locked?: boolean; chips: MarketChip[]; note?: string };
export type ModelVsMarket = { modelProb: number | null; impliedProb: number | null; bestOdds: number | null; edgePct: number | null };

type PickKey = "HOME" | "DRAW" | "AWAY";
function topKey(r: RichPrediction): PickKey {
  return r.p_home >= r.p_draw && r.p_home >= r.p_away ? "HOME" : r.p_draw >= r.p_away ? "DRAW" : "AWAY";
}
function pickKey(r: RichPrediction): PickKey {
  const bs = (r.best_selection ?? "").toUpperCase();
  return bs === "HOME" || bs === "DRAW" || bs === "AWAY" ? (bs as PickKey) : topKey(r);
}
function oddsFor(r: RichPrediction, k: PickKey): number | null {
  return k === "HOME" ? r.odds_home : k === "AWAY" ? r.odds_away : r.odds_draw;
}
function probFor(r: RichPrediction, k: PickKey): number {
  return k === "HOME" ? r.p_home : k === "AWAY" ? r.p_away : r.p_draw;
}

export function buildModelVsMarket(r: RichPrediction): ModelVsMarket {
  const k = pickKey(r);
  const bestOdds = oddsFor(r, k);
  return {
    modelProb: probFor(r, k),
    impliedProb: bestOdds && bestOdds > 0 ? 1 / bestOdds : null,
    bestOdds,
    edgePct: r.edge != null && r.edge > 0 ? r.edge * 100 : null,
  };
}

export function buildMainGroups(r: RichPrediction): MarketGroup[] {
  const groups: MarketGroup[] = [];
  const k = pickKey(r);

  // Esiti 1X2
  const esiti: { key: PickKey; sel: string; prob: number }[] = [
    { key: "HOME", sel: r.home_team, prob: r.p_home },
    { key: "DRAW", sel: "Pareggio", prob: r.p_draw },
    { key: "AWAY", sel: r.away_team, prob: r.p_away },
  ];
  groups.push({
    key: "esiti", title: "Esiti principali",
    chips: esiti.map((o) => {
      const odds = oddsFor(r, o.key);
      const edge = odds && odds > 0 ? o.prob - 1 / odds : null;
      return { id: `esiti-${o.key}`, market: "Esito 1X2", selection: o.key === "HOME" ? `Vince ${o.sel}` : o.key === "AWAY" ? `Vince ${o.sel}` : "Pareggio",
        prob: o.prob, odds, hasValue: (edge ?? 0) > 0, recommended: o.key === k };
    }),
  });

  // Gol Over/Under (da extra_markets)
  const em = r.enrichment?.extra_markets ?? [];
  const over = em.find((x) => x.label.toLowerCase().includes("over"));
  const under = em.find((x) => x.label.toLowerCase().includes("under"));
  if (over || under) {
    const chips: MarketChip[] = [];
    if (over) chips.push({ id: "gol-over", market: "Over/Under", selection: over.label, prob: over.p, odds: over.market_odds, hasValue: (over.edge ?? 0) > 0, recommended: (over.p ?? 0) >= (under?.p ?? 0) });
    if (under) chips.push({ id: "gol-under", market: "Over/Under", selection: under.label, prob: under.p, odds: under.market_odds, hasValue: (under.edge ?? 0) > 0, recommended: (under.p ?? 0) > (over?.p ?? 0) });
    const eg = r.enrichment?.goals_summary?.expected_goals;
    groups.push({ key: "gol", title: "Gol", chips, note: eg != null ? `Gol attesi dal modello: ~${eg.toFixed(1)}` : undefined });
  }
  return groups;
}
```

- [ ] **Step 4: Verificare GREEN**

Run: `npx vitest run features/feed/market-groups.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add features/feed/market-groups.ts features/feed/market-groups.test.ts
git commit -m "feat(sp2): market-groups core (tipi + esiti + gol + ModelVsMarket, estratto)"
```

---

### Task 3: `market-groups.ts` — gruppi premium (Marcatori + Soft) con Pro-lock

Aggiunge `buildPremiumGroups(row)` allo stesso modulo: gruppo **Marcatori** (da `goalscorer_markets`, top 4, dedup lato/cognome) e gruppo **Soft** (cards/fouls da `enrichment.soft`, corner esclusi). Se `enrichment.soft_locked` → gruppo soft con `locked:true` e nessun dato. Se `goalscorer_markets` assente (non-Pro) → nessun gruppo marcatori.

**Files:**
- Modify: `features/feed/market-groups.ts`
- Modify: `features/feed/market-groups.test.ts`

**Interfaces:**
- Produces: `buildPremiumGroups(row: RichPrediction): MarketGroup[]` (0–2 gruppi). E `buildAllGroups(row) = [...buildMainGroups(row), ...buildPremiumGroups(row)]`.

- [ ] **Step 1: Test che falliscono**

```ts
import { buildPremiumGroups, buildAllGroups } from "./market-groups";
// (riusa il `row` del test precedente + varianti)

describe("buildPremiumGroups", () => {
  const gsRow = { ...row, enrichment: { ...row.enrichment,
    goalscorer_markets: [
      { playerId: "1", name: "Lautaro Martinez", side: "home", pScores: 0.42, marketImplied: null, bestPrice: 2.1, bookmaker: "x", edge: 0.06, confidence: "media" },
      { playerId: "2", name: "Thuram", side: "home", pScores: 0.31, marketImplied: null, bestPrice: 2.6, bookmaker: "x", edge: null, confidence: "media" },
    ] } } as const;

  it("gruppo marcatori con chip ordinati per pScores", () => {
    const g = buildPremiumGroups(gsRow as any).find((x) => x.key === "marcatori")!;
    expect(g.chips[0].selection).toContain("Lautaro");
    expect(g.chips[0].recommended).toBe(true); // top pScores con bestPrice
  });
  it("soft locked se soft_locked=true → group locked senza chip dati", () => {
    const g = buildPremiumGroups({ ...row, enrichment: { soft_locked: true } } as any).find((x) => x.key === "soft")!;
    expect(g.locked).toBe(true);
  });
  it("soft con cards/fouls non-generici (corner esclusi)", () => {
    const g = buildPremiumGroups({ ...row, enrichment: { soft: {
      cards: { expected: 4.2, main_line: 3.5, p_over: 0.58, is_generic: false },
      corners: { expected: 10, main_line: 9.5, p_over: 0.6, is_generic: false },
    } } } as any).find((x) => x.key === "soft")!;
    expect(g.chips.map((c) => c.market)).toContain("Cartellini");
    expect(g.chips.map((c) => c.market)).not.toContain("Corner");
  });
  it("nessun gruppo marcatori se goalscorer_markets assente", () => {
    expect(buildPremiumGroups({ ...row, enrichment: {} } as any).find((x) => x.key === "marcatori")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Verificare RED** — `npx vitest run features/feed/market-groups.test.ts` → FAIL (buildPremiumGroups non definito).

- [ ] **Step 3: Implementare `buildPremiumGroups` + `buildAllGroups`** in `features/feed/market-groups.ts`

```ts
export function buildPremiumGroups(r: RichPrediction): MarketGroup[] {
  const groups: MarketGroup[] = [];
  const e = r.enrichment ?? {};

  // Marcatori (Pro): top 4 per pScores, dedup lato|cognome
  const gs = e.goalscorer_markets ?? [];
  if (gs.length) {
    const key = (m: GoalscorerMarket) => {
      const parts = m.name.trim().toLowerCase().split(/\s+/);
      return `${m.side}|${parts[parts.length - 1]}|${parts[0]?.[0] ?? ""}`;
    };
    const map = new Map<string, GoalscorerMarket>();
    for (const m of gs) {
      const prev = map.get(key(m));
      if (!prev || m.pScores > prev.pScores || (m.pScores === prev.pScores && m.bestPrice != null && prev.bestPrice == null)) map.set(key(m), m);
    }
    const top = [...map.values()].sort((a, b) => b.pScores - a.pScores).slice(0, 4);
    const topP = Math.max(...top.map((m) => m.pScores));
    groups.push({
      key: "marcatori", title: "Marcatori",
      chips: top.map((m, i) => ({ id: `gs-${i}`, market: "Marcatore", selection: m.name, prob: m.pScores, odds: m.bestPrice, hasValue: (m.edge ?? 0) > 0, recommended: m.pScores === topP && m.bestPrice != null })),
      note: "La nostra probabilità che ogni giocatore segni almeno un gol.",
    });
  }

  // Soft (Pro): cards/fouls non-generici; corner esclusi (nessuna skill validata)
  if (e.soft_locked) {
    groups.push({ key: "soft", title: "Mercati soft", locked: true, chips: [], note: "Corner, cartellini e falli — riservati a Pro." });
  } else if (e.soft) {
    const chips: MarketChip[] = [];
    const s = e.soft;
    if (s.cards && !s.cards.is_generic) chips.push({ id: "soft-cards", market: "Cartellini", selection: `Over ${s.cards.main_line} cartellini`, prob: s.cards.p_over, odds: null, hasValue: false, recommended: false });
    if (s.fouls && !s.fouls.is_generic) chips.push({ id: "soft-fouls", market: "Falli", selection: `Over ${s.fouls.main_line} falli`, prob: s.fouls.p_over, odds: null, hasValue: false, recommended: false });
    if (chips.length) groups.push({ key: "soft", title: "Mercati soft", chips, note: "Cartellini e falli: probabilità Over dal modello (Pro)." });
  }
  return groups;
}

export function buildAllGroups(r: RichPrediction): MarketGroup[] {
  return [...buildMainGroups(r), ...buildPremiumGroups(r)];
}
```

- [ ] **Step 4: Verificare GREEN** — `npx vitest run features/feed/market-groups.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add features/feed/market-groups.ts features/feed/market-groups.test.ts
git commit -m "feat(sp2): premium market groups (marcatori + soft con Pro-lock)"
```

---

### Task 4: Hook `useMatchDetail(externalEventId)`

Carica on-demand la riga ricca del match dalla lista v1 e la filtra per id.

**Files:**
- Create: `features/feed/use-match-detail.ts`
- Test: `features/feed/use-match-detail.test.ts`

**Interfaces:**
- Consumes: `RichPrediction` da `./market-groups`.
- Produces: `type MatchDetailResult = { detail: RichPrediction | null; loading: boolean; error: string | null }`; `useMatchDetail(externalEventId: string | null): MatchDetailResult`. Se `externalEventId` è null → nessun fetch, `{detail:null, loading:false, error:null}`. Fetch `GET /api/predictions` (`credentials:"include"`), legge `json.predictions`, trova la riga con `match_id === externalEventId`.

> **Nota scorciatoia (marcata):** fetch della lista intera (≤120) e filtro client per un solo match. Upgrade path: endpoint dedicato `/api/predictions/[id]` che idrata+proietta una riga. Il feed (v2) e i mercati ricchi (v1) correlano per `external_event_id`; match non presenti in v1 (es. alcuni tennis) → `detail=null` (la scheda degrada al recap, vedi Task 5).

- [ ] **Step 1: Test che falliscono**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useMatchDetail } from "./use-match-detail";

beforeEach(() => vi.restoreAllMocks());

describe("useMatchDetail", () => {
  it("id null → nessun fetch", () => {
    const fetchSpy = vi.stubGlobal("fetch", vi.fn());
    const { result } = renderHook(() => useMatchDetail(null));
    expect(result.current.loading).toBe(false);
    expect(result.current.detail).toBeNull();
  });
  it("trova la riga per match_id", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({
      predictions: [{ match_id: "A", home_team: "X" }, { match_id: "B", home_team: "Inter" }] }) }));
    const { result } = renderHook(() => useMatchDetail("B"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.detail?.home_team).toBe("Inter");
  });
  it("match non presente in v1 → detail null, no error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ predictions: [{ match_id: "A" }] }) }));
    const { result } = renderHook(() => useMatchDetail("Z"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.detail).toBeNull();
    expect(result.current.error).toBeNull();
  });
  it("errore rete → error valorizzato", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    const { result } = renderHook(() => useMatchDetail("B"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).not.toBeNull();
  });
});
```

- [ ] **Step 2: Verificare RED** — `npx vitest run features/feed/use-match-detail.test.ts` → FAIL.

- [ ] **Step 3: Implementare `features/feed/use-match-detail.ts`**

```ts
"use client";

import { useEffect, useState } from "react";
import type { RichPrediction } from "./market-groups";

export type MatchDetailResult = { detail: RichPrediction | null; loading: boolean; error: string | null };

export function useMatchDetail(externalEventId: string | null): MatchDetailResult {
  const [detail, setDetail] = useState<RichPrediction | null>(null);
  const [loading, setLoading] = useState<boolean>(externalEventId != null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (externalEventId == null) { setDetail(null); setLoading(false); setError(null); return; }
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch("/api/predictions", { credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { predictions?: RichPrediction[] };
        if (!alive) return;
        setDetail((json.predictions ?? []).find((p) => p.match_id === externalEventId) ?? null);
        setError(null);
      } catch (e) {
        if (!alive) return;
        setDetail(null);
        setError(e instanceof Error ? e.message : "Errore nel caricamento");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [externalEventId]);

  return { detail, loading, error };
}
```

- [ ] **Step 4: Verificare GREEN** — `npx vitest run features/feed/use-match-detail.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add features/feed/use-match-detail.ts features/feed/use-match-detail.test.ts
git commit -m "feat(sp2): useMatchDetail (fetch on-demand lista v1, filtro per external_event_id)"
```

---

### Task 5: Estendere `PickCardVM` con `externalEventId`

La scheda ha bisogno dell'id di correlazione. Aggiunta chirurgica al view-model di SP1.

**Files:**
- Modify: `features/feed/pick-view-model.ts`
- Modify: `features/feed/pick-view-model.test.ts`

**Interfaces:**
- Produces: `PickCardVM` con campo aggiuntivo `externalEventId: string | null`; `toPickCardVM` popola `externalEventId: p.external_event_id ?? null`.

- [ ] **Step 1: Test che fallisce** — aggiungere a `pick-view-model.test.ts`:

```ts
it("mappa externalEventId da external_event_id", () => {
  expect(toPickCardVM({ ...base, external_event_id: "EVT-9" }).externalEventId).toBe("EVT-9");
  expect(toPickCardVM({ ...base, external_event_id: null }).externalEventId).toBeNull();
});
```

- [ ] **Step 2: Verificare RED** — `npx vitest run features/feed/pick-view-model.test.ts` → FAIL (proprietà assente).

- [ ] **Step 3: Implementare** — in `features/feed/pick-view-model.ts` aggiungere a `PickCardVM` il campo `externalEventId: string | null;` e in `toPickCardVM` la riga `externalEventId: p.external_event_id ?? null,`.

- [ ] **Step 4: Verificare GREEN** — `npx vitest run features/feed/pick-view-model.test.ts` → PASS (tutti, inclusi i pre-esistenti).

- [ ] **Step 5: Commit**

```bash
git add features/feed/pick-view-model.ts features/feed/pick-view-model.test.ts
git commit -m "feat(sp2): PickCardVM.externalEventId per correlare la scheda espansa"
```

---

### Task 6: `PickCardExpanded` — la scheda

Rende recap + Perché + Modello vs Mercato + tutti i gruppi mercato, con stati loading/error/degradato e Pro-lock soft.

**Files:**
- Create: `features/feed/PickCardExpanded.tsx`
- Test: `features/feed/PickCardExpanded.test.tsx`

**Interfaces:**
- Consumes: `PickCardVM` (`./pick-view-model`), `useMatchDetail` (`./use-match-detail`), `buildAllGroups`/`buildModelVsMarket` (`./market-groups`), primitive `@/components/ui` (`Crest`, `SportIcon`, `Chip`, `ConfidenceMeter`, `Button`).
- Produces: `PickCardExpanded({ pick }: { pick: PickCardVM }): JSX.Element`. Usa `useMatchDetail(pick.externalEventId)`. Stati: loading (skeleton/testo), error, **degradato** (detail null → mostra solo recap + `pick.why`), completo (recap + Perché + ModelVsMarket numerico + gruppi). Gruppo `soft` con `locked` → blur + "Prova Pro" (Button). `Modello vs Mercato` in numeri (mai barre). Ogni chip: `market · selection · prob(Sicurezza via bucket) · odds`, pallino verde se `hasValue`.

- [ ] **Step 1: Test che falliscono** (mock di `useMatchDetail`)

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { PickCardVM } from "./pick-view-model";

const vm: PickCardVM = { id: "1", sport: "football", competition: "Serie A", kickoff: "2026-07-11T18:45:00Z",
  homeTeam: "Inter", awayTeam: "Verona", decision: "Vince l'Inter", odds: 1.55, confidenceScore: 78,
  why: "Inter in forma.", hasValue: true, locked: false, externalEventId: "B" };

const mockDetail = vi.fn();
vi.mock("./use-match-detail", () => ({ useMatchDetail: () => mockDetail() }));
import { PickCardExpanded } from "./PickCardExpanded";

const richDetail = {
  match_id: "B", league: "SA", league_name: "Serie A", home_team: "Inter", away_team: "Verona",
  kickoff: vm.kickoff, p_home: 0.72, p_draw: 0.18, p_away: 0.10, odds_home: 1.55, odds_draw: 4.2, odds_away: 6,
  edge: 0.08, best_selection: "HOME", confidence_score: 78,
  enrichment: { extra_markets: [{ key: "over_2_5", label: "Over 2.5", p: 0.61, model_odds: 1.64, market_odds: 1.72, edge: 0.05 }], soft_locked: true },
};

describe("PickCardExpanded", () => {
  it("loading", () => {
    mockDetail.mockReturnValue({ detail: null, loading: true, error: null });
    render(<PickCardExpanded pick={vm} />);
    expect(screen.getByText(/caricamento/i)).toBeInTheDocument();
  });
  it("degradato: detail null → mostra recap + perché, nessun gruppo", () => {
    mockDetail.mockReturnValue({ detail: null, loading: false, error: null });
    render(<PickCardExpanded pick={vm} />);
    expect(screen.getByText("Vince l'Inter")).toBeInTheDocument();
    expect(screen.getByText(/Inter in forma/)).toBeInTheDocument();
    expect(screen.queryByText("Esiti principali")).toBeNull();
  });
  it("completo: mostra gruppi + Modello vs Mercato + soft Pro-lock", () => {
    mockDetail.mockReturnValue({ detail: richDetail, loading: false, error: null });
    render(<PickCardExpanded pick={vm} />);
    expect(screen.getByText("Esiti principali")).toBeInTheDocument();
    expect(screen.getByText("Gol")).toBeInTheDocument();
    expect(screen.getByText(/Modello vs Mercato/i)).toBeInTheDocument();
    expect(screen.getByText(/Prova Pro/i)).toBeInTheDocument(); // soft locked
  });
});
```

- [ ] **Step 2: Verificare RED** — `npx vitest run features/feed/PickCardExpanded.test.tsx` → FAIL.

- [ ] **Step 3: Implementare `features/feed/PickCardExpanded.tsx`**

Requisiti di rendering (usare token `--am-coral*`/`--am-*`, mai `--am-green`; stile inline coerente con `PickCard`):
- Header recap: `Crest` home/away + `SportIcon` + `competition · kickoff`, decisione (`pick.decision`) grande + `ConfidenceMeter score={pick.confidenceScore} showPercent`.
- Sezione **Perché**: `detail.enrichment?.explanation ?? pick.why` (se presente).
- Sezione **Modello vs Mercato** (solo se `detail` e non locked): righe numeriche da `buildModelVsMarket(detail)` — "Probabilità modello", "Probabilità implicita nella quota", "Quota migliore". **Nessuna barra.**
- Sezioni gruppi: `buildAllGroups(detail).map(...)`; per ogni gruppo titolo + chips (`market` label, `selection`, Sicurezza via `confidenceBucket(chip.prob*100)` → `Chip`, `odds` in mono, pallino verde se `hasValue`). Gruppo con `locked` → contenuto blur + overlay "Prova Pro" (`Button variant="primary"`).
- Stati: `loading` → testo "Caricamento della scheda…"; `error` → "Qualcosa è andato storto."; `detail==null && !loading` → degradato (solo recap + Perché).

```tsx
"use client";

import type { PickCardVM } from "./pick-view-model";
import { useMatchDetail } from "./use-match-detail";
import { buildAllGroups, buildModelVsMarket } from "./market-groups";
import { Crest, SportIcon, Chip, ConfidenceMeter, Button } from "@/components/ui";
import { confidenceBucket } from "@/lib/ui/confidence";

// ... implementazione secondo i requisiti sopra (recap, perché, MvM numerico, gruppi, soft-lock, stati)
```
(L'implementer completa il JSX seguendo i requisiti elencati; ogni ramo deve essere coperto dai test dello Step 1.)

- [ ] **Step 4: Verificare GREEN** — `npx vitest run features/feed/PickCardExpanded.test.tsx` → PASS. Poi `npx tsc --noEmit`.

- [ ] **Step 5: Commit**

```bash
git add features/feed/PickCardExpanded.tsx features/feed/PickCardExpanded.test.tsx
git commit -m "feat(sp2): PickCardExpanded (recap + perché + ModelVsMarket + tutti i mercati + soft Pro-lock)"
```

---

### Task 7: Cablaggio in `FeedScreen` + verifica end-to-end

Apre la scheda al tap su una card, dentro un `Sheet`.

**Files:**
- Modify: `features/feed/PickCard.tsx` (già ha `onOpen?(id)`; nessun cambiamento se la firma basta)
- Modify: `features/feed/FeedScreen.tsx`
- Test: `features/feed/FeedScreen.test.tsx` (estendere)

**Interfaces:**
- `FeedScreen` mantiene uno stato `openPickId: string | null`; passa `onOpen={setOpenPickId}` a ogni `PickCard`; quando `openPickId` è valorizzato, rende `<Sheet open onClose={() => setOpenPickId(null)}><PickCardExpanded pick={openPick} /></Sheet>` dove `openPick` è la VM con quell'id.

- [ ] **Step 1: Test che fallisce** (estendere `FeedScreen.test.tsx`): mock di `usePicks` con un pick sbloccato; simulare click su "Perché questa previsione"; il mock di `useMatchDetail`/`PickCardExpanded` non è necessario se si asserisce solo l'apertura del dialog. Asserire che dopo il click compare `role="dialog"`.

```tsx
it("apre la scheda (Sheet) al click su 'Perché questa previsione'", async () => {
  mockUsePicks.mockReturnValue({ picks: [vm({ id: "a", locked: false })], loading: false, error: null });
  render(<FeedScreen />);
  await userEvent.click(screen.getByRole("button", { name: /perché questa previsione/i }));
  expect(screen.getByRole("dialog")).toBeInTheDocument();
});
```
(Se `PickCardExpanded` fa un fetch reale in test, mockare `./use-match-detail` a livello di file per restituire `{detail:null, loading:false, error:null}`.)

- [ ] **Step 2: Verificare RED** — `npx vitest run features/feed/FeedScreen.test.tsx` → FAIL (nessun dialog).

- [ ] **Step 3: Implementare** — aggiungere a `FeedScreen.tsx`: `const [openPickId, setOpenPickId] = useState<string|null>(null)`; `onOpen={setOpenPickId}` sulle `PickCard`; render condizionale del `Sheet` con `PickCardExpanded` per la VM selezionata (`picks.find(p => p.id === openPickId)`).

- [ ] **Step 4: Verificare GREEN + suite + build**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: tutto verde, build OK.

- [ ] **Step 5: Visual check (da loggato, non solo anonimo)**

Run: `npm run dev` (flag `NEXT_PUBLIC_UX_NEW=1` già in `.env.local`). Aprire `/oggi`, tap su una card sbloccata → la scheda si apre come bottom sheet: recap, Perché, Modello vs Mercato (numeri), gruppi Esiti/Gol/(Marcatori se Pro)/Soft (Pro-lock se non Pro). Verificare da utente Pro (mercati soft/marcatori visibili) e non-Pro (soft blur + "Prova Pro"). Nessuna barra nel readout, nessuna emoji/crest-monogramma.

- [ ] **Step 6: Commit**

```bash
git add features/feed/FeedScreen.tsx features/feed/FeedScreen.test.tsx
git commit -m "feat(sp2): apri PickCardExpanded in un Sheet dal feed (tap su card)"
```

---

## Self-Review

- **Copertura spec §4 (scheda espansa):** stessa superficie che si apre (Sheet) = Task 1+7; recap+Perché+ModelVsMarket = Task 6; tutti i mercati raggruppati = Task 2+3; soft Pro-lock = Task 3+6; numeri non barre = Task 6 requisito. ✔
- **Decisioni approvate:** on-demand fetch = Task 4 (con shortcut marcato); estrai-e-riusa = Task 2/3 (porting dal monolite, non ricostruzione da zero). ✔
- **Placeholder:** i Task 1–5 hanno codice completo; Task 6 elenca requisiti puntuali + scheletro import (il JSX è guidato dai test dello Step 1 che coprono ogni ramo) — accettabile perché ogni comportamento è vincolato da un test. Se l'implementer trova ambiguità nel JSX, deve fermarsi e chiedere.
- **Tipi coerenti:** `RichPrediction`/`MarketGroup`/`MarketChip`/`ModelVsMarket` definiti in Task 2, usati in Task 3/4/6; `PickCardVM.externalEventId` (Task 5) consumato in Task 6; `useMatchDetail` firma (Task 4) usata in Task 6.
- **FTC/gating:** corner esclusi, edge mai negativo, soft/marcatori Pro-only rispettati (mai inventare dati assenti), disclaimer resta nel footer del feed (SP1). ✔

## Rischi / questioni aperte
1. **Shortcut fetch-lista-intera** (Task 4): accettabile per ora (≤120 righe, lista già cachata per anonimo). Upgrade = endpoint `/api/predictions/[id]`.
2. **Tennis / match non in v1**: `detail=null` → scheda degradata (recap + Perché). Documentato; i mercati ricchi tennis sono fuori scope SP2.
3. **Doppia sorgente v1/v2**: la scheda mostra i numeri v1 (`p_home/…`, `edge`) che possono differire leggermente dal recap v2 (`confidence_score`); il recap resta dalla VM (v2) per coerenza col feed, i mercati dalla v1. Se emergesse dissonanza visibile, valutare in SP7 la normalizzazione a una sola sorgente.
4. **Task 6 JSX non completamente codificato**: unico task "descrittivo"; se preoccupa, si può splittare in 6a (recap+Perché+MvM) e 6b (gruppi+soft-lock) con test separati.

## Prossimo passo
Gate: SP2 è codice prodotto = medium/high → serve `APPROVE SP2` prima di eseguire (subagent-driven).
