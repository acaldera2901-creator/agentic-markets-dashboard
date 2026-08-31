# Modello di calcolo — riparare l'ancora e il badge PICK

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Riparare due difetti misurati che oggi producono numeri sbagliati in prodotto: l'ancora sharp che accetta prezzi non formati, e il badge PICK acceso per costruzione sui mercati secondari.

**Architecture:** Due blocchi indipendenti. Il Task 0 è Python e tocca il prezzo di riferimento usato dalle righe `unified_predictions` (Telegram, settlement, track record, tennis): un candidato con margine implausibile viene saltato invece che accettato. I Task 1-3 sono TypeScript e danno alle chip Over/Under e marcatore lo stesso trattamento che l'1X2 ha già — floor più soglia di edge, invece di marcare sempre un lato.

**Nota su cosa NON è in questo piano:** il modello xG è **già in produzione** dal giugno 2026 (`lib/poisson-model.ts:80-92`, blend tarato walk-forward il 05/06). Una versione precedente di questo piano proponeva di portarlo in servizio: era sbagliata. Il valore residuo su xG sta nell'estenderlo alle 24 leghe che non hanno Understat, e avrà una spec propria.

**Tech Stack:** Python 3.14 + pytest per il Task 0; TypeScript/Next.js + vitest per i Task 1-3.

**Spec:** `docs/superpowers/specs/2026-08-30-modello-calcolo-upgrade-design.md`

**STATO: ESEGUITO E LIVE.** Tutti e quattro i task completati, PR #305 mergiata il 30/08, produzione su `c066cf6`. Esito misurato: ancore degeneri **101 → 0**, margine massimo **191% → 14,3%**, Pinnacle intatto (268 → 268), nessun evento senza ancora, 115 righe (24,1%) cambiano fonte. pytest 1258 · vitest 1789/1789 · tsc pulito · eslint 0 errori. Visual check da loggato su produzione superato: il badge PICK resta dove c'è valore (Real Madrid–Málaga, 83%, ★ PICK sull'1X2) e sparisce dove non c'era previsione. Il difetto era peggiore del previsto: con `overP`/`underP` nulli il vecchio codice cadeva su `(-1 > -1) = false` e marcava **sempre l'Under**, cioè un pick su un esito privo di probabilità.

## Global Constraints

- **I test TS vivono in `{app,lib,components,features}/**/*.test.{ts,tsx}`.** `vitest.config` non include `tests/`: un test messo lì non viene mai eseguito e sembra passare. Verificato il 30/08/2026.
- **Comandi:** TS `npm test` (= `vitest run`), lint `npx eslint`, tipi `npx tsc --noEmit`. Python: `.venv/bin/python -m pytest`.
- **Il repo era in detached HEAD con un'altra sessione attiva il 30/08.** Lavorare in un worktree dedicato (skill `superpowers:using-git-worktrees`), mai committare sul checkout condiviso.
- **Nessun claim di battere il mercato.** Il posizionamento resta «accuratezza predittiva».
- **`core/market_anchor.py` si tocca SOLO nel Task 0, e solo per validare i candidati.** La gerarchia `pinnacle → betfair_ex_eu → betfair_ex_uk → smarkets → matchbook → best_margin` resta invariata nell'ordine: cambia unicamente il fatto che un candidato con prezzi implausibili viene saltato invece che accettato. Nessun altro task modifica questo file.
- **Nessuna soglia scelta dopo aver visto i risultati.** La soglia dell'ancora (0,15) è fissata in questa spec sulla distribuzione misurata, non ritarata a valle.

---

### Task 0: L'ancora sharp scarta i prezzi non plausibili

**Perché per primo:** il 21,1% degli eventi calcio reali del 30/08 (101 su 478) riceve un'ancora con margine oltre il 20%, fino al 191%, tutti da `betfair_ex_eu` ed etichettati `sharp_exchange`. L'82% del valore apparente che il sistema può calcolare è artefatto di questo. Ogni numero mostrato su quelle righe — probabilità, edge, floor, confidence — poggia su un prezzo che non è un prezzo.

**Files:**
- Modify: `core/market_anchor.py:79-99`
- Test: `tests/test_market_anchor_margin.py`

**Interfaces:**
- Produces: `MAX_ANCHOR_MARGIN: float = 0.15` e `_plausible(odds: tuple[float, float, float]) -> bool`, modulo `core.market_anchor`.
- `select_h2h_anchor` mantiene firma e valore di ritorno invariati: cambia solo quali candidati accetta.

**La soglia, scelta sui dati (misura 30/08 su 1.409 quotazioni sharp):**

| book | n | p50 | p90 | max |
|---|---|---|---|---|
| pinnacle | 268 | 5,0% | 6,2% | 9% |
| betfair_ex_eu | 353 | 4,1% | **188,5%** | 191% |
| betfair_ex_uk | 344 | 3,9% | **188,5%** | 191% |
| smarkets | 295 | 8,7% | 16,6% | 65% |
| matchbook | 149 | 1,2% | 5,3% | 13% |

Betfair è bimodale: o ~4% o ~188%, senza zona intermedia. A 0,15 Pinnacle (max 9%) e Matchbook (max 13%) non vengono mai toccati, e si taglia solo la coda anomala di Smarkets.

- [ ] **Step 1: Scrivere il test che fallisce**

```python
# tests/test_market_anchor_margin.py
from core.market_anchor import select_h2h_anchor


def _event(books):
    return {
        "home_team": "San Marino", "away_team": "Finland",
        "bookmakers": [
            {"key": k, "markets": [{"key": "h2h", "outcomes": [
                {"name": "San Marino", "price": p[0]},
                {"name": "Finland", "price": p[1]},
                {"name": "Draw", "price": p[2]},
            ]}]} for k, p in books
        ],
    }


def test_scarta_exchange_con_margine_implausibile():
    # betfair espone prezzi non formati (margine 177%); marathonbet e' sano
    ev = _event([("betfair_ex_eu", (1.09, 1.07, 1.09)), ("marathonbet", (38.0, 1.11, 9.9))])
    a = select_h2h_anchor(ev)
    assert a["bookmaker"] != "betfair_ex_eu"
    assert a["margin"] <= 0.15


def test_accetta_exchange_sano():
    ev = _event([("betfair_ex_eu", (26.0, 1.08, 9.4))])
    a = select_h2h_anchor(ev)
    assert a["bookmaker"] == "betfair_ex_eu"
    assert a["anchor_source"] == "sharp_exchange"


def test_pinnacle_resta_prioritario():
    ev = _event([("pinnacle", (30.0, 1.09, 9.0)), ("betfair_ex_eu", (26.0, 1.08, 9.4))])
    assert select_h2h_anchor(ev)["anchor_source"] == "pinnacle"


def test_scarta_quote_degeneri_sotto_uno():
    ev = _event([("betfair_ex_eu", (1.0, 1.0, 1.0)), ("marathonbet", (38.0, 1.11, 9.9))])
    a = select_h2h_anchor(ev)
    assert a["bookmaker"] == "marathonbet"
```

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

Run: `.venv/bin/python -m pytest tests/test_market_anchor_margin.py -v`
Expected: FAIL su `test_scarta_exchange_con_margine_implausibile` e `test_scarta_quote_degeneri_sotto_uno` — oggi l'ancora accetta qualunque mercato completo.

- [ ] **Step 3: Implementare la validazione**

In `core/market_anchor.py`, sotto `_SHARP_FALLBACK`:

```python
# #ANCHOR-MARGIN-0830 — un book sharp che espone prezzi non formati (exchange
# senza liquidita' su eventi lontani) produceva un'ancora con margine fino al 191%.
# Misurato il 30/08: 101 eventi su 478. Pinnacle non supera il 9%, Matchbook il 13%;
# Betfair e' bimodale (4% oppure 188%). 0.15 separa i due gruppi senza tagliare il sano.
MAX_ANCHOR_MARGIN = 0.15
MIN_PLAUSIBLE_PRICE = 1.01


def _plausible(odds: tuple[float, float, float]) -> bool:
    """True se le tre quote formano un mercato reale e non un prezzo di riempimento."""
    if any(o is None or o < MIN_PLAUSIBLE_PRICE for o in odds):
        return False
    margin = sum(1 / o for o in odds) - 1
    return -0.02 <= margin <= MAX_ANCHOR_MARGIN
```

Poi in `select_h2h_anchor` aggiungere il controllo a entrambi i rami:

```python
    pinn = by_key.get("pinnacle")
    if pinn is not None and (o := _h2h_outcomes(pinn, home, away)) and _plausible(o):
        return _h2h_result(home, away, o, "pinnacle", "pinnacle")

    for key in _SHARP_FALLBACK:
        bm = by_key.get(key)
        if bm is not None and (o := _h2h_outcomes(bm, home, away)) and _plausible(o):
            return _h2h_result(home, away, o, key, "sharp_exchange")

    return _best_margin_h2h(event)
```

`_best_margin_h2h` resta il fallback finale: sceglie già il book col margine minore, quindi un evento senza alcuna ancora sharp valida degrada su un prezzo soft invece che su uno inventato.

- [ ] **Step 4: Eseguire i test**

Run: `.venv/bin/python -m pytest tests/test_market_anchor_margin.py -v && .venv/bin/python -m pytest tests/ -q`
Expected: i 4 nuovi test passano; la suite pytest esistente resta verde. **Se qualche test esistente si rompe, non aggirarlo:** significa che dipendeva da ancore degenere, ed è esattamente ciò che stiamo correggendo — va aggiornato e segnalato ad Andrea nel report.

- [ ] **Step 5: Misurare l'effetto sulla board reale prima di committare**

```bash
.venv/bin/python -m scripts.verify_xg_path < /dev/null   # sanity: il percorso regge
```

Registrare quante righe cambiano fonte d'ancora rispetto a prima. Atteso: ~21% degli eventi calcio passa da `sharp_exchange` a un'altra fonte, e su quelle righe **l'edge mostrato cambia**. È un cambiamento visibile in prodotto: va nel report ad Andrea, non nascosto nel commit.

- [ ] **Step 6: Commit**

```bash
git add core/market_anchor.py tests/test_market_anchor_margin.py
git commit -m "fix(anchor): scarta le ancore sharp con margine implausibile (#ANCHOR-MARGIN-0830)"
```

---

### Task 1: Le chip Over/Under smettono di marcare sempre un lato

**Files:**
- Modify: `app/app/page.tsx:5188-5195`
- Create: `lib/pick-eligibility.ts`
- Test: `lib/pick-eligibility.test.ts`

**Interfaces:**
- Produces: `export function goalPickSide(args: { overP: number | null; underP: number | null; overOdds: number | null; underOdds: number | null; belowFloor: boolean; minEdge?: number }): "over" | "under" | null` — restituisce `null` quando nessun lato merita il badge. Consumata dal Task 2.

- [ ] **Step 1: Scrivere il test che fallisce**

```ts
// lib/pick-eligibility.test.ts
import { describe, it, expect } from "vitest";
import { goalPickSide } from "./pick-eligibility";

describe("goalPickSide", () => {
  it("non marca nulla quando la riga e' sotto il floor", () => {
    expect(goalPickSide({ overP: 0.7, underP: 0.3, overOdds: 2.0, underOdds: 1.8, belowFloor: true })).toBeNull();
  });

  it("non marca nulla quando nessun lato raggiunge la soglia di edge", () => {
    // overP 0.52 con quota 1.90 -> edge = 0.52*1.90-1 = -0.012
    expect(goalPickSide({ overP: 0.52, underP: 0.48, overOdds: 1.9, underOdds: 1.9, belowFloor: false })).toBeNull();
  });

  it("marca il lato con edge sopra soglia, non quello piu' probabile", () => {
    // over: 0.52*1.90-1 = -0.012 ; under: 0.48*2.30-1 = +0.104
    expect(goalPickSide({ overP: 0.52, underP: 0.48, overOdds: 1.9, underOdds: 2.3, belowFloor: false })).toBe("under");
  });

  it("non marca nulla se mancano le quote", () => {
    expect(goalPickSide({ overP: 0.6, underP: 0.4, overOdds: null, underOdds: null, belowFloor: false })).toBeNull();
  });

  it("marca un solo lato, mai entrambi", () => {
    const side = goalPickSide({ overP: 0.7, underP: 0.3, overOdds: 2.0, underOdds: 1.5, belowFloor: false });
    expect(side).toBe("over");
  });
});
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `npx vitest run lib/pick-eligibility.test.ts`
Expected: FAIL — `Failed to resolve import "./pick-eligibility"`

- [ ] **Step 3: Implementazione minima**

```ts
// lib/pick-eligibility.ts
// #PICK-FLOOR-0830 — un badge PICK si accende solo se la riga supera il floor
// E il lato ha edge sopra soglia. Prima marcavamo sempre un lato (page.tsx:5194-5195),
// scegliendolo per probabilita' invece che per valore.
const DEFAULT_MIN_EDGE = 0.05;

export function goalPickSide(args: {
  overP: number | null; underP: number | null;
  overOdds: number | null; underOdds: number | null;
  belowFloor: boolean; minEdge?: number;
}): "over" | "under" | null {
  const { overP, underP, overOdds, underOdds, belowFloor } = args;
  const minEdge = args.minEdge ?? DEFAULT_MIN_EDGE;
  if (belowFloor) return null;
  const edge = (p: number | null, o: number | null) => (p != null && o != null ? p * o - 1 : null);
  const eOver = edge(overP, overOdds);
  const eUnder = edge(underP, underOdds);
  const best = [
    { side: "over" as const, e: eOver },
    { side: "under" as const, e: eUnder },
  ]
    .filter((x): x is { side: "over" | "under"; e: number } => x.e != null && x.e >= minEdge)
    .sort((a, b) => b.e - a.e)[0];
  return best ? best.side : null;
}
```

- [ ] **Step 4: Eseguire i test e verificare che passino**

Run: `npx vitest run lib/pick-eligibility.test.ts`
Expected: PASS, 5 test

- [ ] **Step 5: Commit**

```bash
git add lib/pick-eligibility.ts lib/pick-eligibility.test.ts
git commit -m "feat(pick): il badge sui gol richiede floor + edge sopra soglia (#PICK-FLOOR-0830)"
```

---

### Task 2: Agganciare la regola alla schermata

**Files:**
- Modify: `app/app/page.tsx:5188-5195`
- Test: `lib/pick-eligibility.test.ts` (esteso)

**Interfaces:**
- Consumes: `goalPickSide` dal Task 1.
- Produces: nessuna nuova interfaccia pubblica.

- [ ] **Step 1: Test che descrive il comportamento atteso della schermata**

```ts
// aggiungere in lib/pick-eligibility.test.ts
it("su una linea tipica senza valore, nessuna delle due chip e' raccomandata", () => {
  const side = goalPickSide({ overP: 0.55, underP: 0.45, overOdds: 1.8, underOdds: 2.0, belowFloor: false });
  const recOver = side === "over";
  const recUnder = side === "under";
  expect(recOver).toBe(false);
  expect(recUnder).toBe(false);   // prima era garantito true su uno dei due
});
```

- [ ] **Step 2: Eseguire il test**

Run: `npx vitest run lib/pick-eligibility.test.ts -t "nessuna delle due chip"`
Expected: **PASS**. Questo è deliberatamente un test di regressione, non un ciclo TDD: la logica corretta è già arrivata col Task 1, e questo test blocca il ritorno al comportamento «un lato sempre marcato» che il Task 2 sta rimuovendo dalla schermata. Se fallisce, il file del Task 1 non è stato salvato.

- [ ] **Step 3: Sostituire la logica in `app/app/page.tsx`**

Sostituire la riga 5188 e le due chip alle righe 5194-5195:

```ts
// prima (5188): const recOver = overP != null && underP != null ? overP >= underP : (overVal ?? -1) > (underVal ?? -1);
const pickSide = goalPickSide({
  overP, underP, overOdds: fp.totalOver ?? null, underOdds: fp.totalUnder ?? null,
  belowFloor,
});
// ...
{ id: "gol-over", mkt: `Gol O/U ${line}`, sel: `Over ${line}`, prob: overP != null ? pct(overP) : null, q: fp.totalOver, value: pv(overVal), rec: pickSide === "over" },
{ id: "gol-under", mkt: `Gol O/U ${line}`, sel: `Under ${line}`, prob: underP != null ? pct(underP) : null, q: fp.totalUnder, value: pv(underVal), rec: pickSide === "under" },
```

Aggiungere l'import in cima al file: `import { goalPickSide } from "@/lib/pick-eligibility";`

`belowFloor` è già in scope in questo blocco — verificato il 30/08: viene usato a `:5109`, `:5126` e `:5177`. Non serve calcolarlo né passarlo.

- [ ] **Step 4: Verificare tipi, lint e test**

```bash
npx tsc --noEmit && npx eslint app/app/page.tsx lib/pick-eligibility.ts && npm test
```
Expected: nessun errore; la suite vitest resta verde.

- [ ] **Step 5: Commit**

```bash
git add app/app/page.tsx lib/pick-eligibility.test.ts
git commit -m "fix(app): le chip gol non marcano piu' sempre un lato (#PICK-FLOOR-0830)"
```

---

### Task 3: Stesso trattamento ai marcatori e alla board World Cup

**Files:**
- Modify: `app/app/page.tsx:5222`
- Modify: `components/world-cup/WcBoard.tsx:523-524`, `:536`
- Test: `lib/pick-eligibility.test.ts` (esteso)

**Interfaces:**
- Consumes: `goalPickSide` dal Task 1.
- Produces: `export function scorerPickEligible(args: { p: number | null; odds: number | null; minEdge?: number }): boolean`

**Perché:** i marcatori hanno 44% di copertura ancora sharp e zero Pinnacle (spec §1.2). Oggi `rec: x.pScores === topP && x.bestPrice != null` marca sempre il più probabile.

- [ ] **Step 1: Test che fallisce**

```ts
// aggiungere in lib/pick-eligibility.test.ts
import { scorerPickEligible } from "./pick-eligibility";

describe("scorerPickEligible", () => {
  it("non marca il marcatore piu' probabile se non ha edge", () => {
    // 0.28 * 3.5 - 1 = -0.02
    expect(scorerPickEligible({ p: 0.28, odds: 3.5 })).toBe(false);
  });
  it("marca solo con edge sopra soglia", () => {
    // 0.32 * 3.6 - 1 = +0.152
    expect(scorerPickEligible({ p: 0.32, odds: 3.6 })).toBe(true);
  });
  it("non marca senza quota", () => {
    expect(scorerPickEligible({ p: 0.9, odds: null })).toBe(false);
  });
});
```

- [ ] **Step 2: Eseguire e verificare il fallimento**

Run: `npx vitest run lib/pick-eligibility.test.ts -t scorerPickEligible`
Expected: FAIL — `scorerPickEligible is not a function`

- [ ] **Step 3: Implementare**

```ts
// aggiungere in lib/pick-eligibility.ts
export function scorerPickEligible(args: { p: number | null; odds: number | null; minEdge?: number }): boolean {
  const { p, odds } = args;
  const minEdge = args.minEdge ?? DEFAULT_MIN_EDGE;
  if (p == null || odds == null) return false;
  return p * odds - 1 >= minEdge;
}
```

- [ ] **Step 4: Applicare ai tre punti d'uso**

In `app/app/page.tsx:5222` sostituire `rec: x.pScores === topP && x.bestPrice != null` con:
```ts
rec: scorerPickEligible({ p: x.pScores, odds: x.bestPrice }),
```

In `components/world-cup/WcBoard.tsx:523-524` applicare lo stesso schema del Task 2 (`goalPickSide`), e a `:536` `scorerPickEligible`. `WcBoard` non ha `belowFloor` in scope: passare `belowFloor: false` e annotarlo con un commento che nomina il limite — la board WC non espone il floor, va allineata quando lo farà.

- [ ] **Step 5: Verificare e committare**

```bash
npx tsc --noEmit && npm test
git add app/app/page.tsx components/world-cup/WcBoard.tsx lib/pick-eligibility.ts lib/pick-eligibility.test.ts
git commit -m "fix(pick): marcatori e board WC allineati alla regola floor+edge (#PICK-FLOOR-0830)"
```

---

## Cosa questo piano NON fa

- **Non porta xG in produzione: c'è già** dal giugno 2026 (`lib/poisson-model.ts:80-92`). Il valore residuo è estenderlo alle 24 leghe senza Understat — spec propria.
- **Non compra il piano formazioni/infortuni.** Misurato il 30/08 su 26.222 record e 3.403 partite: +1,8% del gap, dentro il rumore.
- **Non aggiunge leghe nuove** (le 99 quotate dai partner e non coperte dal fornitore dati — spec propria).
- **Non abbassa il floor** né cambia l'ordine della gerarchia dell'ancora.
