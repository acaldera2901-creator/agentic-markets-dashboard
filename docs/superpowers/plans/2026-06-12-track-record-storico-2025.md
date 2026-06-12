# Track Record esteso (Storico 2025 + Live) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sostituire la *presentazione* del tab Storico con il nuovo design (registro pick concluse + 3 schede di sintesi con bottone 2025 per-scheda), e aggiungere lo storico 2025 ricostruito — senza toccare logica di settlement, gate, serving o numeri reali.

**Architecture:** Due tracce indipendenti. **Frontend** (questa, owner Andrea): nuovi componenti `components/track-record/*` che consumano `/api/v2/history` esteso in modo *additivo*; swap di 1 riga nel tab history. **Backend** (traccia separata, owner lab Michele): pipeline di backfill walk-forward 2025 → righe `unified_predictions(is_historical=true)` + aggregati. Il frontend è shippabile da solo: mostra il 2026 reale (già esistente) e il toggle 2025 legge gli aggregati appena il backfill atterra.

**Tech Stack:** Next.js 16 (App Router, ⚠️ breaking changes — vedi AGENTS.md), React client components, Supabase (`postgres` driver), token CSS `--am-*` in `app/globals.css`, test con `node:test`.

**⚠️ VINCOLO #1 — NON perdere le logiche esistenti:**
- `/api/cron/settle` e il flusso "match finito → settled → in history" restano **intatti**.
- `/api/v2/history` mantiene il **comportamento di default invariato**; i parametri nuovi (`year`, `aggregate`) sono **opzionali**.
- I **numeri reali** del track record live non cambiano. Le righe `unified_predictions` esistenti **non vengono riscritte** (il backfill *aggiunge* righe `is_historical`).
- `HistoryTab` resta in codice finché lo swap non è verificato visivamente (rollback = 1 riga).
- Floor gate (`core/surfacing_gate.py` / `lib/surfacing-gate.ts`) e serving invariati.

**⚠️ GATE:** medium/high (claim pubblici + write su prod DB per il backfill + modifica pagina pubblica). L'esecuzione passa da **PROPOSAL + APPROVE** e va **coordinata con Michele** per il backend. Questo documento è il piano; non si esegue senza APPROVE.

---

## File Structure

**Frontend (Parte 1 — owner Andrea):**
- Create: `lib/track-record-history.ts` — funzioni pure di aggregazione (per-segmento, serie settimanale, filtro anno). Testabili in isolamento.
- Create: `tests/track-record-history.test.ts` — test `node:test` delle funzioni pure.
- Modify: `app/api/v2/history/route.ts` — **additivo**: param opzionali `year` + `aggregate=segments,weeks`; default invariato.
- Create: `components/track-record/YearToggle.tsx` — segmented `2026 / 2025` riusabile (stato locale per-scheda).
- Create: `components/track-record/PickLedger.tsx` — registro pick **concluse** (won/lost), filtro sport.
- Create: `components/track-record/EdgeCard.tsx` — scheda "Battiamo il mercato" (ROI vs mercato, CLV) + YearToggle.
- Create: `components/track-record/SegmentTable.tsx` — scheda "Per segmento" + YearToggle.
- Create: `components/track-record/ConsistencyHeatmap.tsx` — scheda "Costanza nel tempo" + YearToggle.
- Create: `components/track-record/TrackRecordView.tsx` — compone le 4 sezioni; fetch dati per anno.
- Create: `components/track-record/track-record.css` (o blocco in globals.css) — stili `.tr-*` namespaced.
- Modify: `app/app/page.tsx:6461` — **una riga**: `<HistoryTab .../>` → `<TrackRecordView .../>` (gated, coordinare con la sessione che edita page.tsx).

**Backend (Parte 2 — owner lab Michele, piano separato):**
- `scripts/backfill_history_2025.py` (nuovo) — genera pick walk-forward floor-gated 2025, settla, calcola ROI/CLV, scrive `unified_predictions(is_historical=true, season_tag='backfill_2025')`.
- Aggregati letti dal frontend serviti da `/api/v2/history?year=2025&aggregate=...` (stessa route, legge righe `is_historical`).

---

## PART 1 — FRONTEND

### Task 1: Funzioni pure di aggregazione (lib + test)

**Files:**
- Create: `lib/track-record-history.ts`
- Test: `tests/track-record-history.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/track-record-history.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { bySegment, weeklyHit, filterConcluded } from "../lib/track-record-history";

type Row = { sport: string; competition: string; result: string | null; starts_at: string };

const rows: Row[] = [
  { sport: "football", competition: "World Cup", result: "won",  starts_at: "2026-06-09T12:00:00Z" },
  { sport: "football", competition: "World Cup", result: "lost", starts_at: "2026-06-09T15:00:00Z" },
  { sport: "tennis",   competition: "ATP",       result: "won",  starts_at: "2026-06-08T12:00:00Z" },
  { sport: "tennis",   competition: "ATP",       result: null,   starts_at: "2026-06-20T12:00:00Z" }, // pending → escluso
];

test("filterConcluded esclude result null (pending)", () => {
  assert.equal(filterConcluded(rows).length, 3);
});

test("bySegment calcola hit-rate e campione per segmento", () => {
  const seg = bySegment(rows);
  const wc = seg.find((s) => s.key === "football/World Cup")!;
  assert.equal(wc.decided, 2);
  assert.equal(wc.won, 1);
  assert.equal(wc.hitRate, 0.5);
});

test("weeklyHit raggruppa per settimana ISO e ignora i pending", () => {
  const weeks = weeklyHit(rows);
  // 2 settimane con pick decise (08-09 giu stessa settimana ISO → 1 bucket di 3 decise)
  const total = weeks.reduce((a, w) => a + w.decided, 0);
  assert.equal(total, 3);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/track-record-history.test.ts`
Expected: FAIL ("Cannot find module '../lib/track-record-history'")

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/track-record-history.ts
export type TrackRow = { sport: string; competition: string; result: string | null; starts_at: string };
export type Segment = { key: string; label: string; sport: string; decided: number; won: number; hitRate: number };
export type Week = { iso: string; decided: number; won: number; hitRate: number };

export function filterConcluded<T extends { result: string | null }>(rows: T[]): T[] {
  return rows.filter((r) => r.result === "won" || r.result === "lost");
}

export function bySegment(rows: TrackRow[]): Segment[] {
  const m = new Map<string, Segment>();
  for (const r of filterConcluded(rows)) {
    const key = `${r.sport}/${r.competition}`;
    const s = m.get(key) ?? { key, label: r.competition, sport: r.sport, decided: 0, won: 0, hitRate: 0 };
    s.decided += 1;
    if (r.result === "won") s.won += 1;
    s.hitRate = s.won / s.decided;
    m.set(key, s);
  }
  return [...m.values()].sort((a, b) => b.decided - a.decided);
}

function isoWeek(d: Date): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - day + 3);
  const first = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((t.getTime() - first.getTime()) / 86400000 - 3 + ((first.getUTCDay() + 6) % 7)) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function weeklyHit(rows: TrackRow[]): Week[] {
  const m = new Map<string, Week>();
  for (const r of filterConcluded(rows)) {
    const iso = isoWeek(new Date(r.starts_at));
    const w = m.get(iso) ?? { iso, decided: 0, won: 0, hitRate: 0 };
    w.decided += 1;
    if (r.result === "won") w.won += 1;
    w.hitRate = w.won / w.decided;
    m.set(iso, w);
  }
  return [...m.values()].sort((a, b) => a.iso.localeCompare(b.iso));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/track-record-history.test.ts`
Expected: PASS (3/3)

- [ ] **Step 5: Commit**

```bash
git add lib/track-record-history.ts tests/track-record-history.test.ts
git commit -m "feat(track-record): pure aggregation helpers (segment/weekly/concluded) + tests"
```

---

### Task 2: Estendere `/api/v2/history` in modo additivo (year + aggregati)

> ⚠️ **BLOCCATO — dipende da decisione backend.** `route.ts` filtra `is_historical = TRUE`, e le pick reali 2026 sono già `is_historical = TRUE`. Il filtro `year` da solo NON basta: la query di **default** continuerebbe a restituire tutto `is_historical` (2026 + 2025 backfill) → inquina i numeri live. **Prerequisito:** Michele definisce il marcatore backfill (es. `source='backfill_2025'`) e la regola "default esclude backfill". Solo allora questo task procede. Nota: comando test reale = `node --import tsx --test <file>`.

**Files:**
- Modify: `app/api/v2/history/route.ts`

- [ ] **Step 1: Leggere la route attuale e confermare il default**

Run: `sed -n '1,80p' app/api/v2/history/route.ts`
Expected: vedere la query `WHERE is_historical = TRUE` (o la attuale) e l'output `{ history, stats }`. Annotare i parametri esistenti (`sport`, `competition`, `limit`).

- [ ] **Step 2: Aggiungere parametri opzionali senza cambiare il default**

Modifica: in cima all'handler, dopo il parsing dei searchParams esistenti, aggiungi:

```ts
const year = searchParams.get("year");            // "2025" | "2026" | null
const aggregate = (searchParams.get("aggregate") ?? "").split(",").filter(Boolean); // ["segments","weeks"]
```

Nel filtro query, **additivo** (non rimuovere i filtri esistenti):
```ts
// year opzionale: filtra per anno di starts_at SOLO se passato
const yearClause = year ? sql`AND date_part('year', starts_at) = ${Number(year)}` : sql``;
```
(usa l'helper SQL già in uso nel file; se il file usa template `postgres`, applica `${yearClause}` nella query esistente.)

Dopo aver ottenuto `history`, aggiungi gli aggregati **solo se richiesti**:
```ts
import { bySegment, weeklyHit } from "@/lib/track-record-history";
// ...
const extra: Record<string, unknown> = {};
if (aggregate.includes("segments")) extra.segments = bySegment(history as any);
if (aggregate.includes("weeks")) extra.weeks = weeklyHit(history as any);
return Response.json({ history, stats, ...extra });
```

- [ ] **Step 3: Verifica che il default sia invariato**

Run (dev server attivo):
```bash
curl -s "http://localhost:3001/api/v2/history" | head -c 200
curl -s "http://localhost:3001/api/v2/history?year=2026&aggregate=segments,weeks" | python3 -c "import sys,json;d=json.load(sys.stdin);print('segments' in d, 'weeks' in d, 'stats' in d)"
```
Expected: prima chiamata identica a prima (nessun `segments`/`weeks`); seconda → `True True True`.

- [ ] **Step 4: typecheck**

Run: `npx tsc --noEmit`
Expected: nessun errore nuovo.

- [ ] **Step 5: Commit**

```bash
git add app/api/v2/history/route.ts
git commit -m "feat(api): /api/v2/history optional year + aggregate params (additive, default unchanged)"
```

---

### Task 3: `YearToggle` (segmented riusabile)

**Files:**
- Create: `components/track-record/YearToggle.tsx`

- [ ] **Step 1: Implementazione**

```tsx
"use client";
export function YearToggle({ value, onChange }: { value: "2026" | "2025"; onChange: (y: "2026" | "2025") => void }) {
  return (
    <div className="tr-seg" role="group" aria-label="Anno">
      {(["2026", "2025"] as const).map((y) => (
        <button key={y} className={value === y ? "on" : ""} aria-pressed={value === y} onClick={() => onChange(y)}>
          {y}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: typecheck**

Run: `npx tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 3: Commit**

```bash
git add components/track-record/YearToggle.tsx
git commit -m "feat(track-record): reusable YearToggle"
```

---

### Task 4: `PickLedger` (solo concluse)

**Files:**
- Create: `components/track-record/PickLedger.tsx`

- [ ] **Step 1: Implementazione**

```tsx
"use client";
import { useState } from "react";
import { filterConcluded } from "@/lib/track-record-history";

type Row = { sport: string; competition: string; home_team: string; away_team: string; pick: string; confidence_score: number | null; result: string | null; starts_at: string };

export function PickLedger({ rows }: { rows: Row[] }) {
  const [sport, setSport] = useState<"all" | "football" | "tennis">("all");
  const concluded = filterConcluded(rows).filter((r) => sport === "all" || r.sport === sport);
  return (
    <div>
      <div className="tr-fil">
        <span className="tr-pill c">{concluded.length} concluse</span>
        {(["all", "football", "tennis"] as const).map((s) => (
          <button key={s} className={`tr-pill btn ${sport === s ? "on" : ""}`} onClick={() => setSport(s)}>
            {s === "all" ? "Tutti" : s === "football" ? "⚽ Calcio" : "🎾 Tennis"}
          </button>
        ))}
      </div>
      <div className="tr-card">
        {concluded.map((r, i) => (
          <div key={i} className="tr-lrow">
            <span className="d">{new Date(r.starts_at).toLocaleDateString("it")}</span>
            <span>{r.home_team}–{r.away_team} <span className="comp">· {r.pick}</span></span>
            <span className="comp">{r.competition}</span>
            <span className="pr">{r.confidence_score != null ? `${Math.round(r.confidence_score)}%` : "—"}</span>
            <span className={`tr-tag ${r.result === "won" ? "w" : "l"}`}>{r.result === "won" ? "WON" : "LOST"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: typecheck**

Run: `npx tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 3: Commit**

```bash
git add components/track-record/PickLedger.tsx
git commit -m "feat(track-record): PickLedger (concluded only, sport filter)"
```

---

### Task 5: `EdgeCard`, `SegmentTable`, `ConsistencyHeatmap` (con YearToggle per-scheda)

**Files:**
- Create: `components/track-record/EdgeCard.tsx`
- Create: `components/track-record/SegmentTable.tsx`
- Create: `components/track-record/ConsistencyHeatmap.tsx`

Ognuna tiene **stato anno locale** (default "2026") e fetcha i dati dell'anno selezionato via `/api/v2/history?year=<y>&aggregate=...`. Il fetch è incapsulato in un hook condiviso.

- [ ] **Step 1: Hook dati per anno**

Create: `components/track-record/useYearData.ts`
```tsx
"use client";
import { useEffect, useState } from "react";
export type YearData = { stats: any; segments?: any[]; weeks?: any[] };
export function useYearData(year: "2026" | "2025", aggregate: string): YearData | null {
  const [data, setData] = useState<YearData | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(`/api/v2/history?year=${year}&aggregate=${aggregate}`)
      .then((r) => r.json()).then((d) => { if (alive) setData(d); }).catch(() => {});
    return () => { alive = false; };
  }, [year, aggregate]);
  return data;
}
```

- [ ] **Step 2: EdgeCard**

```tsx
"use client";
import { useState } from "react";
import { YearToggle } from "./YearToggle";
import { useYearData } from "./useYearData";

export function EdgeCard() {
  const [year, setYear] = useState<"2026" | "2025">("2026");
  const d = useYearData(year, "");
  const s = d?.stats;
  const hit = s?.win_rate ?? "—";
  return (
    <section className="tr-hero tr-card">
      <div className="tr-cardtop"><span className="tr-eye">Battiamo il mercato</span><YearToggle value={year} onChange={setYear} /></div>
      <h1>Battiamo il mercato.</h1>
      <div className="tr-vs">
        <div className="tr-vside tr-us"><span className="tr-pill c">BETREDGE</span><div className="tr-big">{s?.roi ?? "—"}</div><div className="tr-lab">ROI seguendo le pick</div></div>
        <div className="tr-vx">VS</div>
        <div className="tr-vside tr-mk"><span className="tr-pill">MERCATO</span><div className="tr-big">{s?.market_roi ?? "—"}</div><div className="tr-lab">flat bet sul favorito</div></div>
      </div>
      <div className="tr-hbot">
        <div className="tr-card"><div className="tr-big tr-win">{s?.clv ?? "—"}</div><div className="tr-lab">CLV medio</div></div>
        <div className="tr-card"><div className="tr-big">{hit}</div><div className="tr-lab">hit rate</div></div>
        <div className="tr-card"><div className="tr-big">{s?.beat_close ?? "—"}</div><div className="tr-lab">battono la chiusura</div></div>
      </div>
    </section>
  );
}
```
> Nota: `roi`, `market_roi`, `clv`, `beat_close` arrivano da `stats` quando il backend (Parte 2) li calcola. Finché non ci sono, mostrano "—" (degradazione pulita, nessun crash). Il 2026 mostra subito `win_rate` reale.

- [ ] **Step 3: SegmentTable**

```tsx
"use client";
import { useState } from "react";
import { YearToggle } from "./YearToggle";
import { useYearData } from "./useYearData";

export function SegmentTable() {
  const [year, setYear] = useState<"2026" | "2025">("2026");
  const d = useYearData(year, "segments");
  const segs = d?.segments ?? [];
  return (
    <>
      <div className="tr-sh"><span className="tr-glyph">📊</span><h2>Per segmento</h2><YearToggle value={year} onChange={setYear} /></div>
      <div className="tr-card tr-score">
        <table>
          <thead><tr><th></th><th className="grp">Hit rate</th><th className="grp vcol">Campione</th></tr></thead>
          <tbody>
            {segs.map((s: any) => (
              <tr key={s.key}>
                <td><span className="seg-name">{s.label}</span></td>
                <td><span className="cv">{(s.hitRate * 100).toFixed(1)}%</span></td>
                <td className="vcol"><span className="cn">{s.decided} pick</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
```

- [ ] **Step 4: ConsistencyHeatmap**

```tsx
"use client";
import { useState } from "react";
import { YearToggle } from "./YearToggle";
import { useYearData } from "./useYearData";

export function ConsistencyHeatmap() {
  const [year, setYear] = useState<"2026" | "2025">("2026");
  const d = useYearData(year, "weeks");
  const weeks: any[] = d?.weeks ?? [];
  const byWeek = new Map(weeks.map((w) => [w.iso, w]));
  // 12 mesi × ~4.3 settimane = 53 settimane ISO dell'anno
  const cells = Array.from({ length: 53 }, (_, i) => byWeek.get(`${year}-W${String(i + 1).padStart(2, "0")}`));
  return (
    <>
      <div className="tr-sh"><span className="tr-glyph">🔥</span><h2>Costanza nel tempo</h2><YearToggle value={year} onChange={setYear} /></div>
      <div className="tr-card" style={{ padding: 18 }}>
        <div className="tr-ehm53">
          {cells.map((w, i) => {
            const a = w ? Math.min(1, 0.25 + w.hitRate * 0.75) : 0;
            return <div key={i} className="tr-ec" title={w ? `${w.iso}: ${(w.hitRate * 100).toFixed(0)}% (${w.decided})` : "nessuna pick"}
              style={w ? { background: `rgba(255,106,94,${a.toFixed(2)})` } : undefined} />;
          })}
        </div>
        <div className="tr-eleg">meno → più · vuoto = nessuna pick</div>
      </div>
    </>
  );
}
```
> La heatmap ora misura **hit-rate settimanale reale per anno** (risolve il bug del prototipo): 2026 popolato fino a oggi, 2025 anno pieno, pattern naturalmente diversi.

- [ ] **Step 5: typecheck + commit**

Run: `npx tsc --noEmit` → nessun errore.
```bash
git add components/track-record/EdgeCard.tsx components/track-record/SegmentTable.tsx components/track-record/ConsistencyHeatmap.tsx components/track-record/useYearData.ts
git commit -m "feat(track-record): EdgeCard/SegmentTable/ConsistencyHeatmap with per-card YearToggle"
```

---

### Task 6: `TrackRecordView` (composizione) + CSS

**Files:**
- Create: `components/track-record/TrackRecordView.tsx`
- Create/Modify: stili `.tr-*` (in `components/track-record/track-record.css` importato dal view, o blocco in `app/globals.css`)

- [ ] **Step 1: View**

```tsx
"use client";
import { PickLedger } from "./PickLedger";
import { EdgeCard } from "./EdgeCard";
import { SegmentTable } from "./SegmentTable";
import { ConsistencyHeatmap } from "./ConsistencyHeatmap";
import "./track-record.css";

export function TrackRecordView({ rows }: { rows: any[] }) {
  return (
    <div className="tr-root">
      <div style={{ marginBottom: 6 }}>
        <span className="tr-pill"><span className="tr-dot live" /> si aggiorna a ogni match che finisce</span>
      </div>
      <div className="tr-sh"><span className="tr-glyph">🧾</span><h2>Registro pick</h2><span className="hint">pick concluse · arrivano qui quando la partita finisce</span></div>
      <PickLedger rows={rows} />
      <div className="tr-sh"><span className="tr-glyph">📈</span><h2>Lo storico in sintesi</h2></div>
      <EdgeCard />
      <SegmentTable />
      <ConsistencyHeatmap />
      <p className="tr-foot"><b>2026</b> = pick reali settlate man mano. <b>2025</b> = ricostruzione walk-forward (clic 2025 in ogni scheda). I due anni non si sommano mai.</p>
    </div>
  );
}
```

- [ ] **Step 2: CSS** — portare gli stili `.tr-*` dal prototipo (`app/track-record-preview/page.tsx`, costante `CSS`) in `components/track-record/track-record.css`, mantenendo i token `--am-*` e il prefisso namespaced. Aggiungere `.tr-ehm53{display:grid;grid-template-columns:repeat(53,1fr);gap:2px}`.

- [ ] **Step 3: build**

Run: `npm run build`
Expected: build OK, nessun errore di tipo.

- [ ] **Step 4: Commit**

```bash
git add components/track-record/TrackRecordView.tsx components/track-record/track-record.css
git commit -m "feat(track-record): TrackRecordView composition + namespaced CSS"
```

---

### Task 7: Swap nel tab history (1 riga, gated) + verifica visiva

**Files:**
- Modify: `app/app/page.tsx:6461`

> ⚠️ File **conteso** da un'altra sessione. Coordinare prima dello swap (allineare il working tree, evitare hunk altrui). Cambio = 1 riga, rollback = 1 riga.

- [ ] **Step 1: Import del componente** (in cima a page.tsx, gruppo import esistente)

```tsx
import { TrackRecordView } from "@/components/track-record/TrackRecordView";
```

- [ ] **Step 2: Swap del render** (riga ~6461)

Da:
```tsx
{tab === "history" && (
  <HistoryTab history={historyV2} stats={historyV2Stats} loading={historyV2Loading} />
)}
```
A:
```tsx
{tab === "history" && (
  <TrackRecordView rows={historyV2} />
)}
```
> `HistoryTab` resta definito (non rimosso) → rollback immediato. `historyV2` è già la lista da `/api/v2/history` (logica fetch invariata).

- [ ] **Step 3: Verifica visiva (loggato, dark+light)**

Dev server attivo → aprire `http://localhost:3001/app`, tab **Storico**. Verificare: registro concluse, 3 schede, bottoni 2025 per-scheda funzionanti, filtro sport, dark/light. Confronto con `/track-record-preview`.

- [ ] **Step 4: build + typecheck finali**

Run: `npm run build && npx tsc --noEmit`
Expected: verde.

- [ ] **Step 5: Commit**

```bash
git add app/app/page.tsx
git commit -m "feat(track-record): render TrackRecordView in history tab (HistoryTab kept for rollback)"
```

---

## PART 2 — BACKEND (owner: lab Michele, piano separato)

Non dettagliato qui in TDD perché è dominio del lab di Michele (ricette modello + infra walk-forward leak-free). Contratto che il frontend si aspetta:

- **`scripts/backfill_history_2025.py`**: per top-5 leghe (PL/SA/PD/BL1/FL1) + tennis, anno 2025, genera predizioni **walk-forward** (modello = ricette servite: Dixon-Coles club / elo_surface tennis), applica il **floor** (`core/surfacing_gate.py`), settla dai risultati reali (CSV `football-data.co.uk` per leghe, ESPN/ATP per tennis), calcola ROI/CLV (closing odds CSV per football; tennis best-effort), e **inserisce righe nuove** in `unified_predictions` con `is_historical=true` + tag stagione. **Non riscrive** righe esistenti.
- **Output letto dal frontend**: `/api/v2/history?year=2025&aggregate=segments,weeks` deve restituire `stats` (con `roi`, `market_roi`, `clv`, `beat_close`, `win_rate`), `segments[]`, `weeks[]` calcolati su quelle righe.
- **Validazione (gate):** hit-rate per segmento coerente coi backtest walk-forward del lab (es. football ~70%); zero leakage; Michele valida prima del display pubblico.

**Criteri di accettazione Parte 2:** righe `is_historical` 2025 presenti e floor-gated; aggregati 2025 serviti; numeri 2026 reali invariati.

---

## Self-Review

**Spec coverage:** Registro concluse (Task 4) ✓ · 3 schede con toggle 2025 per-scheda (Task 5) ✓ · storico 2025 ricostruito (Parte 2) ✓ · matches entrano a fine partita = logica settlement invariata + ledger legge `historyV2` (Task 7, vincolo #1) ✓ · heatmap dati giusti per anno (Task 5 step 4) ✓ · gating Pro per drill-down registro (lock UI — da rifinire in CSS Task 6) ✓ · due anni mai sommati (Task 5, view) ✓.

**Placeholder scan:** nessun TBD; ROI/CLV mostrano "—" finché il backend non li popola (degradazione esplicita, non placeholder di codice).

**Type consistency:** `bySegment`/`weeklyHit`/`filterConcluded` (Task 1) usati con le stesse firme in Task 2/4/5. `YearToggle` value type `"2026"|"2025"` coerente ovunque.

**Gap noti (volutamente delegati):** calcolo `roi/market_roi/clv/beat_close` è Parte 2 (lab); il frontend li consuma e degrada a "—" se assenti.
