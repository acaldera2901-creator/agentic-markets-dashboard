# Mercati gol nelle schede prediction calcio — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrare nelle schede prediction calcio del sito, sotto l'1X2, un blocco "Gol" con gol attesi + fascia probabile + Over/Under 1.5/2.5/3.5, in probabilità calibrate del modello.

**Architecture:** Display-only e additivo. Il modello Poisson già produce la distribuzione congiunta sui risultati esatti; Over/Under sono già in `computeExtraMarkets()`. Aggiungiamo una funzione pura `computeGoalsSummary()` (gol attesi + fascia), la salviamo in `enrichment.goals_summary` accanto a `extra_markets`, e un sub-componente UI `GoalsBlock` la renderizza nella card, gated dietro il flag `p.locked` già esistente (free/anonimo lockato, Base+ visibile).

**Tech Stack:** TypeScript, Next.js (App Router), test in TS via `node:assert/strict` eseguiti con `tsx` (nessun vitest/jest nel repo).

## Global Constraints

- **Solo calcio.** Tennis/WC/altri sport non hanno `goals_summary` → il blocco non si renderizza per loro.
- **Gating: Base in su.** Free/anonimo vedono il blocco lockato, esattamente come l'1X2: riusa il flag `p.locked` già presente sulla `Prediction`. Nessun nuovo meccanismo di gating.
- **Framing FTC-onesto.** Probabilità calibrate del *modello* per quella partita. MAI claim tipo "X% vincenti" / win-rate.
- **Non toccare:** modello statistico, 1X2, schema DB, settlement, `pick_ledger`/`pick_settlement`, Maven Studio, la firma di `computeExtraMarkets()` e i suoi chiamanti.
- **Branch:** partire da `main` con branch nuovo `feat/prediction-goals-markets`. NON usare `feat/maven-studio` (obsoleto).
- **i18n:** seguire il pattern inline già usato nella card (`lang === "it" ? "…" : "…"`), non aggiungere chiavi al dizionario.
- **Test runner:** i test TS si eseguono con `npx tsx <file>` (vedi `tests/market-blend.test.ts` come riferimento).

---

### Task 0: Setup branch

**Files:** nessuno (solo git).

- [ ] **Step 1: Creare il branch da main aggiornato**

```bash
cd ~/Desktop/agentic-markets
git checkout main
git pull --ff-only
git checkout -b feat/prediction-goals-markets
```

- [ ] **Step 2: Verificare il punto di partenza pulito**

Run: `git status`
Expected: "On branch feat/prediction-goals-markets", working tree clean.

---

### Task 1: `computeGoalsSummary()` — funzione pura + test

Funzione pura nel motore: dato λ casa e λ trasferta, ritorna gol attesi e fascia probabile dalla distribuzione totale-gol. Stessa convenzione (doppio loop, N=9) di `computeExtraMarkets`.

**Files:**
- Modify: `lib/poisson-model.ts` (aggiungere interfaccia `GoalsSummary` + funzione `computeGoalsSummary`, accanto a `computeExtraMarkets` ~riga 205)
- Test: `tests/goals-summary.test.ts` (nuovo)

**Interfaces:**
- Consumes: la funzione `poisson(k, lambda)` già presente e usata in `lib/poisson-model.ts` (stessa usata da `computeExtraMarkets`).
- Produces:
  ```ts
  export interface GoalsSummary {
    expected_goals: number; // λH + λA, arrotondato a 1 decimale
    band_low: number;       // floor(expected_goals)
    band_high: number;      // ceil(expected_goals) (= band_low se intero)
    band_p: number;         // P(totale gol ∈ [band_low, band_high]), 0..1, 4 decimali
  }
  export function computeGoalsSummary(lambdaHome: number, lambdaAway: number): GoalsSummary
  ```

- [ ] **Step 1: Scrivere il test che fallisce**

Create `tests/goals-summary.test.ts`:

```ts
import assert from "node:assert/strict";
import { computeGoalsSummary } from "../lib/poisson-model";

const approx = (a: number, b: number, eps = 1e-3) =>
  assert.ok(Math.abs(a - b) <= eps, `expected ${a} ≈ ${b}`);

// Caso non intero: λH=1.5, λA=1.1 → gol attesi 2.6, fascia [2,3].
// Somma di due Poisson indip. = Poisson(2.6). P(T=2)+P(T=3) ≈ 0.4686.
{
  const g = computeGoalsSummary(1.5, 1.1);
  assert.equal(g.expected_goals, 2.6);
  assert.equal(g.band_low, 2);
  assert.equal(g.band_high, 3);
  approx(g.band_p, 0.4686);
}

// Caso intero: λH=1.0, λA=1.0 → gol attesi 2.0, fascia [2,2] = P(T=2) ≈ 0.2707.
{
  const g = computeGoalsSummary(1.0, 1.0);
  assert.equal(g.expected_goals, 2);
  assert.equal(g.band_low, 2);
  assert.equal(g.band_high, 2);
  approx(g.band_p, 0.2707);
}

// Guard: λ molto piccoli non devono lanciare e restano coerenti.
{
  const g = computeGoalsSummary(0.2, 0.1);
  assert.equal(g.expected_goals, 0.3);
  assert.equal(g.band_low, 0);
  assert.equal(g.band_high, 1);
  assert.ok(g.band_p > 0 && g.band_p <= 1);
}

console.log("goals-summary: all assertions passed");
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `npx tsx tests/goals-summary.test.ts`
Expected: errore di import/run — `computeGoalsSummary` non esiste ancora.

- [ ] **Step 3: Implementare `computeGoalsSummary` in `lib/poisson-model.ts`**

Aggiungere subito dopo la fine di `computeExtraMarkets` (dopo `}` di ~riga 205):

```ts
export interface GoalsSummary {
  expected_goals: number;
  band_low: number;
  band_high: number;
  band_p: number;
}

export function computeGoalsSummary(
  lambdaHome: number,
  lambdaAway: number
): GoalsSummary {
  const N = 9;
  const pTotal: number[] = new Array(2 * N + 1).fill(0);
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      pTotal[i + j] += poisson(i, lambdaHome) * poisson(j, lambdaAway);
    }
  }
  const expected_goals = Math.round((lambdaHome + lambdaAway) * 10) / 10;
  const band_low = Math.floor(expected_goals);
  const band_high = Math.ceil(expected_goals);
  let band = 0;
  for (let t = band_low; t <= band_high; t++) band += pTotal[t] ?? 0;
  const band_p = Math.round(band * 10000) / 10000;
  return { expected_goals, band_low, band_high, band_p };
}
```

- [ ] **Step 4: Eseguire il test e verificare che passi**

Run: `npx tsx tests/goals-summary.test.ts`
Expected: `goals-summary: all assertions passed`

- [ ] **Step 5: Verificare che il test esistente del modello non regredisca**

Run: `npx tsx tests/market-blend.test.ts`
Expected: nessun errore (exit 0).

- [ ] **Step 6: Commit**

```bash
git add lib/poisson-model.ts tests/goals-summary.test.ts
git commit -m "feat: computeGoalsSummary (gol attesi + fascia) dalla distribuzione Poisson

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Persistere `goals_summary` in `enrichment`

Calcolare `goals_summary` nello stesso punto dove oggi si calcola `extra_markets` e includerlo nell'`enrichment` servito. Aggiungere il campo al tipo `PredictionEnrichment` lato UI.

**Files:**
- Modify: `app/api/predictions/route.ts` (import ~riga 10; call site ~righe 835-836)
- Modify: `app/app/page.tsx` (tipo `PredictionEnrichment`, blocco `extra_markets?` ~righe 771-784)

**Interfaces:**
- Consumes: `computeGoalsSummary` da `@/lib/poisson-model` (Task 1).
- Produces: `enrichment.goals_summary` di tipo `GoalsSummary` presente sulle righe prediction calcio servite, e il campo opzionale `goals_summary` sul tipo `PredictionEnrichment` in `page.tsx`.

- [ ] **Step 1: Importare `computeGoalsSummary` in route.ts**

In `app/api/predictions/route.ts`, nel blocco import da `@/lib/poisson-model` (~riga 6-15), aggiungere `computeGoalsSummary` accanto a `computeExtraMarkets`:

```ts
import {
  buildModel,
  predict,
  computeExtraMarkets,
  computeGoalsSummary,
  blendWithMarket,
  devig1x2,
  MARKET_BLEND_ALPHA,
  MatchResult,
} from "@/lib/poisson-model";
```

- [ ] **Step 2: Calcolare e includere `goals_summary` al call site**

In `app/api/predictions/route.ts`, sostituire le righe 835-836:

```ts
      const extra_markets = computeExtraMarkets(lH, lA, marketOdds);
      return { ...hydrated, enrichment: { ...(hydrated.enrichment ?? {}), extra_markets } };
```

con:

```ts
      const extra_markets = computeExtraMarkets(lH, lA, marketOdds);
      const goals_summary = computeGoalsSummary(lH, lA);
      return { ...hydrated, enrichment: { ...(hydrated.enrichment ?? {}), extra_markets, goals_summary } };
```

Nota: `goals_summary` NON va aggiunto a `PREMIUM_ENRICHMENT_KEYS` — sono probabilità calibrate base (come `extra_markets`), non un blocco deep. La visibilità free/anon è gestita lato UI dal flag `p.locked` (Task 3).

- [ ] **Step 3: Aggiungere il campo al tipo `PredictionEnrichment` in page.tsx**

In `app/app/page.tsx`, dentro l'interfaccia `PredictionEnrichment`, subito dopo la chiusura del blocco `extra_markets?: Array<{...}>;` (~riga 784), aggiungere:

```ts
  goals_summary?: {
    expected_goals: number;
    band_low: number;
    band_high: number;
    band_p: number;
  };
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: nessun errore introdotto da queste modifiche (se il repo aveva già errori preesistenti non correlati, verificare che il set di errori sia invariato rispetto a prima — non aggiungerne di nuovi su `route.ts`/`page.tsx`).

- [ ] **Step 5: Commit**

```bash
git add app/api/predictions/route.ts app/app/page.tsx
git commit -m "feat: servire goals_summary in enrichment per le prediction calcio

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Sub-componente UI `GoalsBlock` nella card

Renderizzare il blocco "Gol" nella `PredictionCard`, sotto la readout 1X2, solo quando la card NON è lockata (free/anon restano lockati come per l'1X2) e solo quando `goals_summary` esiste (⇒ solo calcio).

**Files:**
- Modify: `app/app/page.tsx` (nuovo componente `GoalsBlock` vicino a `PredictionCard` ~riga 3209; render dentro `PredictionCard`)

**Interfaces:**
- Consumes: `e.goals_summary` (tipo aggiunto in Task 2) e `e.extra_markets` (filtrando `over_1_5`/`over_2_5`/`over_3_5`), dove `e = p.enrichment ?? {}` già definito nella card a riga 3221. Helper `pct(x)` già presente nel file (usato a riga ~1230 / nelle rows). `lang` già in scope nella card.
- Produces: nessuna API pubblica nuova (componente interno al file).

- [ ] **Step 1: Aggiungere il componente `GoalsBlock`**

In `app/app/page.tsx`, subito PRIMA della dichiarazione `function PredictionCard(` (~riga 3209), inserire:

```tsx
function GoalsBlock({
  summary,
  markets,
  lang,
}: {
  summary: NonNullable<PredictionEnrichment["goals_summary"]>;
  markets: NonNullable<PredictionEnrichment["extra_markets"]>;
  lang: string;
}) {
  const ou = (key: string) => markets.find((m) => m.key === key)?.p ?? null;
  const o15 = ou("over_1_5");
  const o25 = ou("over_2_5");
  const o35 = ou("over_3_5");
  const bandLabel =
    summary.band_low === summary.band_high
      ? `${summary.band_low}`
      : `${summary.band_low}–${summary.band_high}`;
  const fmt = (p: number | null) => (p == null ? "—" : `${Math.round(p * 100)}%`);
  return (
    <div className="goals-block">
      <div className="goals-head">
        <span className="goals-eg">
          {lang === "it" ? "Gol attesi" : "Expected goals"}: <b>{summary.expected_goals.toFixed(1)}</b>
        </span>
        <span className="goals-band">
          {lang === "it" ? "Fascia più probabile" : "Most likely range"}:{" "}
          <b>{bandLabel} {lang === "it" ? "gol" : "goals"}</b> ({Math.round(summary.band_p * 100)}%)
        </span>
      </div>
      <div className="goals-ou">
        <span>Over 1.5: <b>{fmt(o15)}</b></span>
        <span>Over 2.5: <b>{fmt(o25)}</b></span>
        <span>Over 3.5: <b>{fmt(o35)}</b></span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Renderizzare `GoalsBlock` nella card (gated da `!p.locked`)**

In `PredictionCard`, individuare la fine del blocco condizionale della readout 1X2 — il ternario `{p.locked ? (…lock-overlay…) : belowFloor ? (…bars…) : (…mvm readout…)}` (inizia ~riga 3296). Subito DOPO la chiusura di quel ternario (la `)}` che chiude l'intera espressione condizionale, prima della sezione "why"/analisi/betslip), inserire:

```tsx
      {!p.locked && e.goals_summary && (
        <GoalsBlock summary={e.goals_summary} markets={e.extra_markets ?? []} lang={lang} />
      )}
```

Verifica di posizionamento: il blocco deve stare DENTRO `<div className="pred">`, allo stesso livello della readout 1X2, NON dentro il ramo `belowFloor` né dentro il ramo clear-pick. Deve quindi apparire sia per le card con pick chiaro sia per quelle `below_floor`, ma mai quando `p.locked`.

- [ ] **Step 3: Aggiungere lo stile CSS del blocco**

Gli stili della card vivono in `app/globals.css` (la regola `.pred .scorebar` è a ~riga 5509). Aggiungere subito dopo il blocco `.pred .scorebar` (dopo ~riga 5530), usando i token già in uso nella card (`--am-line`, `--am-text`, `--am-muted-2`, `--am-inset`) — niente colori hardcoded:

```css
/* goals block — gol attesi + fascia + over/under */
.pred .goals-block {
  margin-top: 9px; padding: 8px 11px;
  background: var(--am-inset); border: 1px solid var(--am-line); border-radius: 7px;
  display: flex; flex-direction: column; gap: 5px;
}
.pred .goals-block .goals-head,
.pred .goals-block .goals-ou { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 12px; }
.pred .goals-block .goals-head { color: var(--am-muted-2); }
.pred .goals-block .goals-ou { color: var(--am-text); }
.pred .goals-block b { color: var(--am-text); font-variant-numeric: tabular-nums; }
```

- [ ] **Step 3b: Verificare i token in dark + light**

Run: `grep -n "\-\-am-inset\|\-\-am-line\|\-\-am-muted-2\|\-\-am-text" app/globals.css | head`
Expected: i quattro token esistono e sono ridefiniti nel tema light (intorno a riga 108+). Confermare così che il blocco resta leggibile in entrambi i temi.

- [ ] **Step 4: Typecheck + build**

Run: `npx tsc --noEmit`
Expected: nessun nuovo errore su `page.tsx`.

Run: `npm run build`
Expected: build completa senza errori.

- [ ] **Step 5: Visual check sul sito da loggato Base (obbligatorio)**

Avviare il dev server (`npm run dev`) e verificare, **da utente Base loggato** (cookie reali, non anonimo — vedi `feedback_visual_check_loggato`):
- su una scheda prediction **calcio** appare il blocco "Gol" sotto l'1X2 con: Gol attesi (1 decimale), Fascia probabile (es. "2–3 gol (44%)"), Over 1.5/2.5/3.5 in %;
- i numeri Over sono **monotòni** (O1.5 ≥ O2.5 ≥ O3.5);
- da **anonimo/free** la card resta lockata e il blocco Gol NON è visibile;
- su tennis/altri sport il blocco NON compare;
- nessuna regressione visiva su readout 1X2, scorebar, sezione "why".

Catturare uno screenshot (loggato Base + anonimo) per il report.

- [ ] **Step 6: Commit**

```bash
git add app/app/page.tsx
git commit -m "feat: blocco Gol (gol attesi + fascia + Over/Under) nelle card prediction calcio, Base+

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Note finali

- **Deploy/merge in prod = gate di approvazione** (medium-risk: tocca il prodotto servito). Aprire PR con report "cosa è cambiato davvero vs proposto" + screenshot del visual check. NON mergiare/deployare senza APPROVE di Andrea.
- Fase 2 eventuale (fuori da questo piano): settlement + track record dei mercati gol per dimostrarne l'accuratezza; card social via Maven Studio.
