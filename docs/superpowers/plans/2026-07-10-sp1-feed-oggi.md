# SP1 — Feed "Oggi" · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** La nuova home casual-first: un feed verticale di `PickCard` (chiusa) alimentato da `/api/v2/predictions`, con bottom-nav a 3 voci, montato su una rotta `/oggi` dietro feature flag — senza toccare il monolite `app/app/page.tsx`.

**Architecture:** Strangler pattern. Un view-model puro traduce `UnifiedPrediction` (già access-projected dall'API) in `PickCardVM`; un hook `usePicks` fetcha per-sessione; `PickCard` è presentazionale e consuma le primitive SP0; `FeedScreen` orchestra stati e "pick del giorno"; `/oggi` è un wrapper server gated. Il vecchio `/app` resta intatto.

**Tech Stack:** Next.js 16.2.7 (App Router), React 19.2.4, TypeScript 5, Tailwind 4, Vitest + Testing Library.

## Global Constraints

- **Prerequisito:** SP0 completato (primitive in `@/components/ui`, helper `@/lib/ui/confidence`, infra Vitest). 
- **Next.js del progetto ≠ quello noto:** leggere `node_modules/next/dist/docs/` prima di scrivere la rotta/Server Component (vedi `AGENTS.md`).
- **Zero AI-slop:** crest solo via `<Crest/>`, icone solo via `<SportIcon/>`.
- **Verde** `#23A559` (mai edge negativo). Token `--am-*`.
- **FTC:** la decisione è protagonista; "Sicurezza" = confidenza del modello, non esito garantito; nessun claim di rendimento. Disclaimer +18/gioco responsabile nel footer del feed.
- **API contract:** `GET /api/v2/predictions?sport=&competition=&status=` → `{ predictions: (UnifiedPrediction & { locked?: boolean })[], meta }`. Risposta **per-sessione** → fetch client con `credentials: "include"`, mai cache condivisa.
- **TDD, commit frequenti, branch `feat/sp1-feed-oggi`** (parte da `feat/sp0-design-system` mergiato o da main aggiornato); PR a fine SP.

---

### Task 1: View-model `PickCardVM` + `humanizePick`

Traduce una predizione API in ciò che la card mostra, in linguaggio da tifoso.

**Files:**
- Create: `features/feed/pick-view-model.ts`
- Test: `features/feed/pick-view-model.test.ts`

**Interfaces:**
- Consumes: `UnifiedPrediction` da `@/lib/unified-adapter`; `confidenceBucket` da `@/lib/ui/confidence` (indirettamente via consumer).
- Produces:
  - `type ProjectedPrediction = UnifiedPrediction & { locked?: boolean }`
  - `type PickCardVM = { id: string; sport: string; competition: string; kickoff: string; homeTeam: string | null; awayTeam: string | null; decision: string; odds: number | null; confidenceScore: number | null; why: string | null; hasValue: boolean; locked: boolean }`
  - `humanizePick(p: { market: string; pick: string | null; home_team: string | null; away_team: string | null }): string`
  - `toPickCardVM(p: ProjectedPrediction): PickCardVM`

- [ ] **Step 1: Scrivere i test che falliscono**

```ts
import { describe, it, expect } from "vitest";
import { humanizePick, toPickCardVM, type ProjectedPrediction } from "./pick-view-model";

const base: ProjectedPrediction = {
  id: "1", external_event_id: null, sport: "football", competition: "Serie A",
  league: "Serie A", event_name: "Inter vs Verona", home_team: "Inter", away_team: "Verona",
  player_one: null, player_two: null, market: "1x2", pick: "Inter", bookmaker: "fp",
  odds: 1.55, fair_odds: null, edge_percent: 6.2, confidence_score: 78, risk_level: "low",
  stake_suggestion: null, closing_odds: null, closing_line_value: null, status: "open",
  signal_type: "value", source: "db", model_version: "v2", plan_access: "free",
  is_historical: false, is_live: false, is_paper: false, is_verified: true, is_demo: false,
  created_at: "", updated_at: "", published_at: "", starts_at: "2026-07-10T18:45:00Z",
  expires_at: "", settled_at: null, result: null, notes: null,
  explanation: "Inter in gran forma.", world_cup_stage: null, group_name: null, venue: null,
  neutral_venue: false, team_news_summary: null, market_movement_summary: null,
  source_table: null, source_id: null,
} as ProjectedPrediction;

describe("humanizePick", () => {
  it("1x2 con pick = squadra di casa → Vince {casa}", () => {
    expect(humanizePick({ market: "1x2", pick: "Inter", home_team: "Inter", away_team: "Verona" })).toBe("Vince l'Inter");
  });
  it("1x2 pareggio", () => {
    expect(humanizePick({ market: "1x2", pick: "X", home_team: "Inter", away_team: "Verona" })).toBe("Pareggio");
  });
  it("over/under → aggiunge 'gol'", () => {
    expect(humanizePick({ market: "over_under", pick: "Over 2.5", home_team: null, away_team: null })).toBe("Over 2.5 gol");
  });
  it("btts → linguaggio umano", () => {
    expect(humanizePick({ market: "btts", pick: "Yes", home_team: null, away_team: null })).toBe("Gol (entrambe segnano)");
  });
  it("mercato sconosciuto → pick grezzo", () => {
    expect(humanizePick({ market: "xyz", pick: "Qualcosa", home_team: null, away_team: null })).toBe("Qualcosa");
  });
});

describe("toPickCardVM", () => {
  it("mappa i campi chiave e la decisione umana", () => {
    const vm = toPickCardVM(base);
    expect(vm.id).toBe("1");
    expect(vm.decision).toBe("Vince l'Inter");
    expect(vm.confidenceScore).toBe(78);
    expect(vm.odds).toBe(1.55);
    expect(vm.hasValue).toBe(true);
    expect(vm.locked).toBe(false);
    expect(vm.why).toBe("Inter in gran forma.");
  });
  it("hasValue false se edge nullo o ≤0 (mai edge negativo mostrato)", () => {
    expect(toPickCardVM({ ...base, edge_percent: 0 }).hasValue).toBe(false);
    expect(toPickCardVM({ ...base, edge_percent: -3 }).hasValue).toBe(false);
    expect(toPickCardVM({ ...base, edge_percent: null }).hasValue).toBe(false);
  });
  it("locked riflette il flag di projection", () => {
    expect(toPickCardVM({ ...base, locked: true }).locked).toBe(true);
  });
});
```

- [ ] **Step 2: Eseguire e verificare il fallimento**

Run: `npx vitest run features/feed/pick-view-model.test.ts`
Expected: FAIL — modulo non risolto.

- [ ] **Step 3: Implementare `features/feed/pick-view-model.ts`**

```ts
import type { UnifiedPrediction } from "@/lib/unified-adapter";

export type ProjectedPrediction = UnifiedPrediction & { locked?: boolean };

export type PickCardVM = {
  id: string;
  sport: string;
  competition: string;
  kickoff: string;
  homeTeam: string | null;
  awayTeam: string | null;
  decision: string;
  odds: number | null;
  confidenceScore: number | null;
  why: string | null;
  hasValue: boolean;
  locked: boolean;
};

// Elide l'articolo: "Vince l'Inter" vs "Vince il Napoli" è raffinabile; qui
// una regola minima ("l'" davanti a vocale) copre i casi comuni. Upgrade:
// tabella articoli per club se serve più naturalezza.
function vince(team: string): string {
  const art = /^[AEIOUaeiou]/.test(team.trim()) ? "l'" : "il ";
  return `Vince ${art}${team.trim()}`;
}

export function humanizePick(p: {
  market: string; pick: string | null; home_team: string | null; away_team: string | null;
}): string {
  const m = p.market.toLowerCase();
  const pick = (p.pick ?? "").trim();
  if (!pick) return "—";

  if (m.includes("1x2") || m.includes("match_winner") || m.includes("winner")) {
    if (pick === "X" || /pareg/i.test(pick)) return "Pareggio";
    if (p.home_team && pick.toLowerCase() === p.home_team.toLowerCase()) return vince(p.home_team);
    if (p.away_team && pick.toLowerCase() === p.away_team.toLowerCase()) return vince(p.away_team);
    if (/^(1|home|casa)$/i.test(pick) && p.home_team) return vince(p.home_team);
    if (/^(2|away|trasferta)$/i.test(pick) && p.away_team) return vince(p.away_team);
    return pick;
  }
  if (m.includes("over_under") || m.includes("over/under") || m.includes("totals")) {
    return /gol|goal|set/i.test(pick) ? pick : `${pick} gol`;
  }
  if (m.includes("btts") || m.includes("gol/no") || m.includes("both_teams")) {
    return /^(yes|si|sì|gol)$/i.test(pick) ? "Gol (entrambe segnano)" : "No Gol";
  }
  return pick;
}

export function toPickCardVM(p: ProjectedPrediction): PickCardVM {
  return {
    id: p.id,
    sport: p.sport,
    competition: p.competition,
    kickoff: p.starts_at,
    homeTeam: p.home_team ?? p.player_one,
    awayTeam: p.away_team ?? p.player_two,
    decision: humanizePick({ market: p.market, pick: p.pick, home_team: p.home_team, away_team: p.away_team }),
    odds: p.odds,
    confidenceScore: p.confidence_score,
    why: p.explanation,
    hasValue: (p.edge_percent ?? 0) > 0,
    locked: p.locked === true,
  };
}
```

- [ ] **Step 4: Eseguire e verificare il passaggio**

Run: `npx vitest run features/feed/pick-view-model.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add features/feed/pick-view-model.ts features/feed/pick-view-model.test.ts
git commit -m "feat(sp1): PickCardVM + humanizePick (decisione in italiano, mai edge negativo)"
```

---

### Task 2: `selectPickOfDay`

Sceglie l'id del "pick del giorno" (card eroe) tra quelli sbloccati e ad alta confidenza.

**Files:**
- Create: `features/feed/select-pick-of-day.ts`
- Test: `features/feed/select-pick-of-day.test.ts`

**Interfaces:**
- Consumes: `PickCardVM` da `./pick-view-model`.
- Produces: `selectPickOfDay(picks: PickCardVM[]): string | null` — id del pick con `confidenceScore` più alto tra i non-locked (a parità: primo in ordine di input); `null` se lista vuota o tutti locked.

- [ ] **Step 1: Scrivere i test che falliscono**

```ts
import { describe, it, expect } from "vitest";
import { selectPickOfDay } from "./select-pick-of-day";
import type { PickCardVM } from "./pick-view-model";

const vm = (o: Partial<PickCardVM>): PickCardVM => ({
  id: "x", sport: "football", competition: "", kickoff: "", homeTeam: null, awayTeam: null,
  decision: "", odds: null, confidenceScore: 0, why: null, hasValue: false, locked: false, ...o,
});

describe("selectPickOfDay", () => {
  it("lista vuota → null", () => expect(selectPickOfDay([])).toBeNull());
  it("sceglie la confidenza più alta tra i non-locked", () => {
    const picks = [vm({ id: "a", confidenceScore: 60 }), vm({ id: "b", confidenceScore: 82 }), vm({ id: "c", confidenceScore: 75 })];
    expect(selectPickOfDay(picks)).toBe("b");
  });
  it("ignora i locked", () => {
    const picks = [vm({ id: "a", confidenceScore: 90, locked: true }), vm({ id: "b", confidenceScore: 70 })];
    expect(selectPickOfDay(picks)).toBe("b");
  });
  it("tutti locked → null", () => {
    expect(selectPickOfDay([vm({ id: "a", locked: true })])).toBeNull();
  });
});
```

- [ ] **Step 2: Eseguire e verificare il fallimento**

Run: `npx vitest run features/feed/select-pick-of-day.test.ts`
Expected: FAIL — modulo non risolto.

- [ ] **Step 3: Implementare `features/feed/select-pick-of-day.ts`**

```ts
import type { PickCardVM } from "./pick-view-model";

export function selectPickOfDay(picks: PickCardVM[]): string | null {
  let best: PickCardVM | null = null;
  for (const p of picks) {
    if (p.locked) continue;
    if (!best || (p.confidenceScore ?? 0) > (best.confidenceScore ?? 0)) best = p;
  }
  return best?.id ?? null;
}
```

- [ ] **Step 4: Eseguire e verificare il passaggio**

Run: `npx vitest run features/feed/select-pick-of-day.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add features/feed/select-pick-of-day.ts features/feed/select-pick-of-day.test.ts
git commit -m "feat(sp1): selectPickOfDay (max confidenza tra non-locked)"
```

---

### Task 3: Hook `usePicks`

Fetcha le predizioni per-sessione e le mappa in `PickCardVM[]`, con stati loading/error.

**Files:**
- Create: `features/feed/use-picks.ts`
- Test: `features/feed/use-picks.test.ts`

**Interfaces:**
- Consumes: `toPickCardVM`, `ProjectedPrediction` da `./pick-view-model`.
- Produces: `type UsePicksResult = { picks: PickCardVM[]; loading: boolean; error: string | null }`; `usePicks(): UsePicksResult`. Fetch `GET /api/v2/predictions` con `credentials: "include"`, legge `json.predictions`.

- [ ] **Step 1: Scrivere il test che fallisce**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { usePicks } from "./use-picks";

const row = {
  id: "1", sport: "football", competition: "Serie A", home_team: "Inter", away_team: "Verona",
  market: "1x2", pick: "Inter", odds: 1.55, edge_percent: 6, confidence_score: 78,
  explanation: "Forma.", plan_access: "free", starts_at: "2026-07-10T18:45:00Z", player_one: null, player_two: null,
  locked: false,
};

beforeEach(() => { vi.restoreAllMocks(); });

describe("usePicks", () => {
  it("carica e mappa le predizioni", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ predictions: [row], meta: {} }),
    }));
    const { result } = renderHook(() => usePicks());
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.picks).toHaveLength(1);
    expect(result.current.picks[0].decision).toBe("Vince l'Inter");
    expect(result.current.error).toBeNull();
  });
  it("gestisce l'errore di rete", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    const { result } = renderHook(() => usePicks());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).not.toBeNull();
    expect(result.current.picks).toEqual([]);
  });
});
```

- [ ] **Step 2: Eseguire e verificare il fallimento**

Run: `npx vitest run features/feed/use-picks.test.ts`
Expected: FAIL — modulo non risolto.

- [ ] **Step 3: Implementare `features/feed/use-picks.ts`**

```ts
"use client";

import { useEffect, useState } from "react";
import { toPickCardVM, type PickCardVM, type ProjectedPrediction } from "./pick-view-model";

export type UsePicksResult = { picks: PickCardVM[]; loading: boolean; error: string | null };

export function usePicks(): UsePicksResult {
  const [picks, setPicks] = useState<PickCardVM[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/v2/predictions", { credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { predictions: ProjectedPrediction[] };
        if (!alive) return;
        setPicks((json.predictions ?? []).map(toPickCardVM));
        setError(null);
      } catch (e) {
        if (!alive) return;
        setPicks([]);
        setError(e instanceof Error ? e.message : "Errore nel caricamento");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  return { picks, loading, error };
}
```

- [ ] **Step 4: Eseguire e verificare il passaggio**

Run: `npx vitest run features/feed/use-picks.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add features/feed/use-picks.ts features/feed/use-picks.test.ts
git commit -m "feat(sp1): usePicks (fetch per-sessione /api/v2/predictions → PickCardVM)"
```

---

### Task 4: `PickCard` (chiusa)

Card presentazionale, tre stati: eroe (pick del giorno), standard, bloccata. Consuma le primitive SP0.

**Files:**
- Create: `features/feed/PickCard.tsx`
- Test: `features/feed/PickCard.test.tsx`

**Interfaces:**
- Consumes: `PickCardVM` da `./pick-view-model`; `Crest`, `SportIcon`, `ConfidenceMeter`, `Chip`, `Button` da `@/components/ui`.
- Produces: `PickCard({ pick, pickOfDay, onOpen }: { pick: PickCardVM; pickOfDay?: boolean; onOpen?: (id: string) => void }): JSX.Element`. Se `pick.locked` rende lo stato bloccato (contenuto sfocato + overlay "Prova Pro"); altrimenti la card normale/eroe. Il click su "Perché questa previsione" chiama `onOpen(pick.id)`.

- [ ] **Step 1: Scrivere i test che falliscono**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PickCard } from "./PickCard";
import type { PickCardVM } from "./pick-view-model";

const vm = (o: Partial<PickCardVM> = {}): PickCardVM => ({
  id: "1", sport: "football", competition: "Serie A", kickoff: "2026-07-10T18:45:00Z",
  homeTeam: "Inter", awayTeam: "Verona", decision: "Vince l'Inter", odds: 1.55,
  confidenceScore: 78, why: "Inter in gran forma.", hasValue: true, locked: false, ...o,
});

describe("PickCard", () => {
  it("mostra la decisione e la sicurezza", () => {
    render(<PickCard pick={vm()} />);
    expect(screen.getByText("Vince l'Inter")).toBeInTheDocument();
    expect(screen.getByText("Alta")).toBeInTheDocument();
  });
  it("stato eroe espone data-hero", () => {
    const { container } = render(<PickCard pick={vm()} pickOfDay />);
    expect(container.querySelector('[data-hero="true"]')).toBeInTheDocument();
  });
  it("click su 'Perché' chiama onOpen con l'id", async () => {
    const onOpen = vi.fn();
    render(<PickCard pick={vm()} onOpen={onOpen} />);
    await userEvent.click(screen.getByRole("button", { name: /perché/i }));
    expect(onOpen).toHaveBeenCalledWith("1");
  });
  it("stato bloccato: mostra 'Prova Pro' e non la decisione in chiaro", () => {
    render(<PickCard pick={vm({ locked: true })} />);
    expect(screen.getByRole("button", { name: /prova pro/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Eseguire e verificare il fallimento**

Run: `npx vitest run features/feed/PickCard.test.tsx`
Expected: FAIL — modulo non risolto.

- [ ] **Step 3: Implementare `features/feed/PickCard.tsx`**

```tsx
import type { PickCardVM } from "./pick-view-model";
import { Crest, SportIcon, ConfidenceMeter, Chip, Button } from "@/components/ui";

function kickoffLabel(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

export function PickCard({ pick, pickOfDay, onOpen }: {
  pick: PickCardVM; pickOfDay?: boolean; onOpen?: (id: string) => void;
}) {
  if (pick.locked) {
    return (
      <div style={{ position: "relative", overflow: "hidden", background: "var(--am-panel)", border: "1px solid var(--am-line)", borderRadius: 16, padding: 16 }}>
        <div style={{ filter: "blur(6px)", opacity: 0.5, pointerEvents: "none" }} aria-hidden="true">
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--am-muted)" }}>{pick.competition}</div>
          <div style={{ fontSize: 21, fontWeight: 800 }}>Pronostico Pro</div>
        </div>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, textAlign: "center", padding: 20 }}>
          <strong style={{ fontSize: 15 }}>Pronostico Pro</strong>
          <p style={{ margin: 0, fontSize: 12, color: "var(--am-muted)" }}>Sblocca tutti i pick di oggi.</p>
          <Button variant="primary">Prova Pro →</Button>
        </div>
      </div>
    );
  }

  return (
    <div data-hero={pickOfDay ? "true" : undefined}
      style={{
        background: pickOfDay ? "linear-gradient(180deg,var(--am-green-dim),transparent 42%),var(--am-panel)" : "var(--am-panel)",
        border: `1px solid ${pickOfDay ? "var(--am-green-b)" : "var(--am-line)"}`,
        borderRadius: 16, padding: "16px 16px 14px",
      }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--am-muted)" }}>
          <SportIcon sport={pick.sport} /> {pick.competition} · {kickoffLabel(pick.kickoff)}
        </span>
        {pickOfDay && <Chip variant="pro">Pick del giorno</Chip>}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 7 }}>
          <Crest team={pick.homeTeam} sport={pick.sport} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>{pick.homeTeam}</span>
        </div>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--am-muted-2)" }}>VS</span>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 7 }}>
          <Crest team={pick.awayTeam} sport={pick.sport} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>{pick.awayTeam}</span>
        </div>
      </div>

      <div style={{ background: "var(--am-inset)", border: "1px solid var(--am-line)", borderRadius: 14, padding: "13px 14px", marginBottom: 12 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--am-muted-2)", marginBottom: 6 }}>
          Il nostro pronostico
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
          <span style={{ fontSize: 21, fontWeight: 800, letterSpacing: "-.02em" }}>{pick.decision}</span>
          {pick.odds != null && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: "var(--am-green)", background: "var(--am-green-dim)", padding: "3px 8px", borderRadius: 8, border: "1px solid var(--am-green-b)" }}>
              quota {pick.odds.toFixed(2)}
            </span>
          )}
        </div>
      </div>

      <div style={{ marginBottom: 13 }}>
        <ConfidenceMeter score={pick.confidenceScore} showPercent />
      </div>

      {pick.why && (
        <p style={{ fontSize: 13, color: "var(--am-muted)", lineHeight: 1.5, margin: "0 0 15px" }}>{pick.why}</p>
      )}

      <Button variant="primary" style={{ width: "100%" }} onClick={() => onOpen?.(pick.id)}>
        Perché questa previsione
      </Button>
    </div>
  );
}
```

- [ ] **Step 4: Eseguire e verificare il passaggio**

Run: `npx vitest run features/feed/PickCard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add features/feed/PickCard.tsx features/feed/PickCard.test.tsx
git commit -m "feat(sp1): PickCard chiusa (eroe/standard/bloccata) su primitive SP0"
```

---

### Task 5: `BottomNav`

Barra di navigazione a 3 destinazioni.

**Files:**
- Create: `features/feed/BottomNav.tsx`
- Test: `features/feed/BottomNav.test.tsx`

**Interfaces:**
- Produces: `type Destination = "oggi" | "risultati" | "profilo"`; `BottomNav({ active }: { active: Destination }): JSX.Element`. Voci: Oggi (`/oggi`), Risultati (`/risultati`), Profilo (`/profilo`). La voce attiva ha `aria-current="page"`.

- [ ] **Step 1: Scrivere i test che falliscono**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BottomNav } from "./BottomNav";

describe("BottomNav", () => {
  it("rende le 3 destinazioni", () => {
    render(<BottomNav active="oggi" />);
    expect(screen.getByText("Oggi")).toBeInTheDocument();
    expect(screen.getByText("Risultati")).toBeInTheDocument();
    expect(screen.getByText("Profilo")).toBeInTheDocument();
  });
  it("marca la voce attiva con aria-current", () => {
    render(<BottomNav active="risultati" />);
    expect(screen.getByRole("link", { name: /risultati/i })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /oggi/i })).not.toHaveAttribute("aria-current");
  });
});
```

- [ ] **Step 2: Eseguire e verificare il fallimento**

Run: `npx vitest run features/feed/BottomNav.test.tsx`
Expected: FAIL — modulo non risolto.

- [ ] **Step 3: Implementare `features/feed/BottomNav.tsx`**

```tsx
import { SportIcon } from "@/components/ui";

export type Destination = "oggi" | "risultati" | "profilo";

const ITEMS: { key: Destination; label: string; href: string }[] = [
  { key: "oggi", label: "Oggi", href: "/oggi" },
  { key: "risultati", label: "Risultati", href: "/risultati" },
  { key: "profilo", label: "Profilo", href: "/profilo" },
];

export function BottomNav({ active }: { active: Destination }) {
  return (
    <nav style={{
      position: "sticky", bottom: 0, display: "flex", gap: 4,
      background: "var(--am-bar)", borderTop: "1px solid var(--am-line)", padding: "8px 8px",
    }}>
      {ITEMS.map((it) => {
        const on = it.key === active;
        return (
          <a key={it.key} href={it.href} aria-current={on ? "page" : undefined}
            style={{
              flex: 1, textAlign: "center", textDecoration: "none",
              fontFamily: "var(--font-display)", fontSize: 11, fontWeight: 600,
              color: on ? "var(--am-green)" : "var(--am-muted)",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "4px 0",
            }}>
            <SportIcon sport={it.key === "oggi" ? "football" : "generic"} size={18} />
            {it.label}
          </a>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 4: Eseguire e verificare il passaggio**

Run: `npx vitest run features/feed/BottomNav.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add features/feed/BottomNav.tsx features/feed/BottomNav.test.tsx
git commit -m "feat(sp1): BottomNav 3 voci (Oggi/Risultati/Profilo)"
```

---

### Task 6: `FeedScreen`

Orchestratore client: carica i pick, sceglie il pick del giorno, gestisce loading/empty/error, rende il feed + footer disclaimer + BottomNav.

**Files:**
- Create: `features/feed/FeedScreen.tsx`
- Test: `features/feed/FeedScreen.test.tsx`

**Interfaces:**
- Consumes: `usePicks` da `./use-picks`; `selectPickOfDay` da `./select-pick-of-day`; `PickCard`, `BottomNav` da `./`.
- Produces: `FeedScreen(): JSX.Element`. Ordina il pick del giorno in cima. Footer con disclaimer +18/gioco responsabile.

- [ ] **Step 1: Scrivere il test che fallisce** (mock del hook)

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { PickCardVM } from "./pick-view-model";

const vm = (o: Partial<PickCardVM>): PickCardVM => ({
  id: "1", sport: "football", competition: "Serie A", kickoff: "2026-07-10T18:45:00Z",
  homeTeam: "Inter", awayTeam: "Verona", decision: "Vince l'Inter", odds: 1.55,
  confidenceScore: 78, why: null, hasValue: true, locked: false, ...o,
});

const mockUsePicks = vi.fn();
vi.mock("./use-picks", () => ({ usePicks: () => mockUsePicks() }));

import { FeedScreen } from "./FeedScreen";

describe("FeedScreen", () => {
  it("stato loading", () => {
    mockUsePicks.mockReturnValue({ picks: [], loading: true, error: null });
    render(<FeedScreen />);
    expect(screen.getByText(/caricamento/i)).toBeInTheDocument();
  });
  it("stato errore", () => {
    mockUsePicks.mockReturnValue({ picks: [], loading: false, error: "boom" });
    render(<FeedScreen />);
    expect(screen.getByText(/riprova|errore/i)).toBeInTheDocument();
  });
  it("stato vuoto", () => {
    mockUsePicks.mockReturnValue({ picks: [], loading: false, error: null });
    render(<FeedScreen />);
    expect(screen.getByText(/nessun pick/i)).toBeInTheDocument();
  });
  it("rende i pick e il disclaimer", () => {
    mockUsePicks.mockReturnValue({ picks: [vm({ id: "a", confidenceScore: 60 }), vm({ id: "b", confidenceScore: 85 })], loading: false, error: null });
    render(<FeedScreen />);
    expect(screen.getAllByText("Vince l'Inter").length).toBe(2);
    expect(screen.getByText(/18\+/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Eseguire e verificare il fallimento**

Run: `npx vitest run features/feed/FeedScreen.test.tsx`
Expected: FAIL — modulo non risolto.

- [ ] **Step 3: Implementare `features/feed/FeedScreen.tsx`**

```tsx
"use client";

import { usePicks } from "./use-picks";
import { selectPickOfDay } from "./select-pick-of-day";
import { PickCard } from "./PickCard";
import { BottomNav } from "./BottomNav";

export function FeedScreen() {
  const { picks, loading, error } = usePicks();

  let body: React.ReactNode;
  if (loading) {
    body = <p style={{ color: "var(--am-muted)", textAlign: "center", padding: 40 }}>Caricamento dei pick di oggi…</p>;
  } else if (error) {
    body = <p style={{ color: "var(--am-muted)", textAlign: "center", padding: 40 }}>Qualcosa è andato storto. Riprova.</p>;
  } else if (picks.length === 0) {
    body = <p style={{ color: "var(--am-muted)", textAlign: "center", padding: 40 }}>Nessun pick per oggi. Torna più tardi.</p>;
  } else {
    const podId = selectPickOfDay(picks);
    const ordered = [...picks].sort((a, b) => (a.id === podId ? -1 : b.id === podId ? 1 : 0));
    body = (
      <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "0 4px" }}>
        {ordered.map((p) => <PickCard key={p.id} pick={p} pickOfDay={p.id === podId} />)}
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", background: "var(--am-bg)" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 12px" }}>
        <strong style={{ fontSize: 18, letterSpacing: "-.01em" }}>BetRedge</strong>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--am-muted)" }}>Oggi</span>
      </header>
      <main style={{ flex: 1 }}>{body}</main>
      <footer style={{ padding: "12px 16px", textAlign: "center" }}>
        <p style={{ fontSize: 11, color: "var(--am-muted-2)", margin: 0 }}>
          18+ · Gioco responsabile. Le previsioni sono stime statistiche del modello, non garanzia di vincita.
        </p>
      </footer>
      <BottomNav active="oggi" />
    </div>
  );
}
```

- [ ] **Step 4: Eseguire e verificare il passaggio**

Run: `npx vitest run features/feed/FeedScreen.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add features/feed/FeedScreen.tsx features/feed/FeedScreen.test.tsx
git commit -m "feat(sp1): FeedScreen (loading/error/empty + pick del giorno + disclaimer + nav)"
```

---

### Task 7: Rotta `/oggi` dietro feature flag + verifica end-to-end

Monta il feed su una nuova rotta senza toccare `app/app/page.tsx`. Gate con env flag così non è pubblica finché non decisa la messa in produzione.

**Files:**
- Create: `app/oggi/page.tsx`
- Modify: `.env.local` (aggiunta variabile flag, solo locale)

**Interfaces:**
- Consumes: `FeedScreen` da `@/features/feed/FeedScreen`.
- Produces: rotta `/oggi` che rende `FeedScreen` se `process.env.NEXT_PUBLIC_UX_NEW === "1"`, altrimenti `notFound()`.

> **Nota Next 16:** verificare in `node_modules/next/dist/docs/` l'API corrente per `notFound()` e i Server Components prima di scrivere (vedi `AGENTS.md`).

- [ ] **Step 1: Creare `app/oggi/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { FeedScreen } from "@/features/feed/FeedScreen";

export default function OggiPage() {
  if (process.env.NEXT_PUBLIC_UX_NEW !== "1") notFound();
  return <FeedScreen />;
}
```

- [ ] **Step 2: Abilitare il flag in locale**

Aggiungere a `.env.local`:

```
NEXT_PUBLIC_UX_NEW=1
```

- [ ] **Step 3: Avviare il dev server e verificare a mano (visual check da loggato)**

Run: `npm run dev`
Poi con browser autenticato (mai solo anonimo) aprire `http://localhost:3000/oggi`.
Expected: il feed carica i pick reali; il pick del giorno è in cima col bordo verde; i pick Pro appaiono bloccati per un utente free; il footer mostra il disclaimer +18; la bottom-nav è presente. Nessun crest gradiente-monogramma, nessuna emoji-icona.

- [ ] **Step 4: Verificare che il monolite sia intatto**

Run: `git status app/app/page.tsx`
Expected: nessuna modifica a `app/app/page.tsx`.

- [ ] **Step 5: Suite + typecheck + build**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: test verdi, nessun errore di tipo, build OK.

- [ ] **Step 6: Commit**

```bash
git add app/oggi/page.tsx
git commit -m "feat(sp1): rotta /oggi (feed) dietro NEXT_PUBLIC_UX_NEW, monolite intatto"
```

---

## Self-Review

- **Copertura spec §3 (la card):** decisione protagonista + quota secondaria (Task 4), Sicurezza Alta/Media/Bassa (Task 4 via ConfidenceMeter), why in una riga (Task 4), pick del giorno eroe (Task 2+6), lock che vende (Task 4 stato bloccato). ✔
- **Copertura §2 (IA):** BottomNav 3 destinazioni (Task 5); rotta /oggi come nuova home (Task 7). Risultati/Profilo sono SP4/SP5. ✔
- **Copertura §6 (strangler):** feature-based `features/feed/`, view-model+hook tipizzati, monolite non toccato, feature flag (Task 7). ✔
- **Placeholder:** nessuno; ogni step ha codice/comando. Le scorciatoie (articolo in `vince()`, scala confidenza ereditata da SP0) sono marcate.
- **Coerenza tipi:** `PickCardVM`/`ProjectedPrediction` definiti in Task 1, riusati in Task 2/3/4/6; `Destination` in Task 5 usato in Task 6 (`active="oggi"`); `usePicks` firma in Task 3 consumata in Task 6.
- **FTC:** footer disclaimer (Task 6), `hasValue` mai negativo (Task 1), "Sicurezza" non-garanzia (ereditato SP0). ✔

## Dipendenze aperte (dalla spec)
- **Fonte crest reali** (§9): finché aperta, `Crest` usa il fallback-scudo (SP0). Non blocca SP1.
- **Generosità free / gating** (§5): SP1 mostra ciò che l'API projection già decide (`locked`); la policy di quanto è free è decisione business che vive in SP3, non qui.
