# Standardizzazione card World Cup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendere le card della pagina `/world-cup` (`components/world-cup/WcBoard.tsx`, `WcCard`) identiche per layout a quelle calcio/tennis: readout Mercato/Modello/Edge + Confidenza + blocco Gol.

**Architecture:** Modifica a un solo componente (`WcCard`). Si sostituisce la sezione "outcome rows + edge chip" con il readout `.mvm` (a specchio di `PredictionCard`) + Confidenza + blocco Gol (dai λ in `enrichment.lambdas`), mantenendo lock-overlay, ramo below-floor (barre), scorebar e sezione Perché. Riusa CSS globale già esistente e `computeGoalsSummary`/`computeExtraMarkets`.

**Tech Stack:** Next.js (App Router), React/TSX. Nessun framework di test JS nel repo (i test TS girano con `tsx`). Verifica principale: `tsc` + `next build` + visual check.

## Global Constraints

- **Un solo file:** `components/world-cup/WcBoard.tsx` (funzione `WcCard` + un helper locale + import). NESSUN altro file.
- **Nessun CSS nuovo:** le classi `.mvm`, `.col`, `.model`, `.edge`, `.conf`, `.dot`, `.conf-lab`, `.conf-txt`, `.goals-block`, `.goals-head`, `.goals-ou` esistono già in `app/globals.css` (usate da calcio/tennis) e sono caricate su `/world-cup` dal root `app/layout.tsx`.
- **Display-only:** la `.mvm` su `/world-cup` NON è cliccabile (niente betslip/onSelect, niente classe `sel`).
- **i18n:** seguire la convenzione del file (`lang === "it" ? … : …`), NON usare `pick5` (è del monolite `page.tsx`).
- **FTC-onesto:** quando non c'è edge di valore → label "nessuna quota · lettura del modello". MAI claim di win-rate.
- **Non toccare:** dati/pipeline WC, gating accesso, card calcio/tennis, resto di `/world-cup` (gruppi/calendario/winner odds), `page.tsx`.
- **Branch:** `feat/wc-card-standardization` (worktree `~/Desktop/agentic-markets-wccard`, da `origin/main`).

---

### Task 0: Setup — GIÀ FATTO dal controller

Worktree `~/Desktop/agentic-markets-wccard` su branch `feat/wc-card-standardization` (da `origin/main` @46f95da, include la feature gol mergiata). Spec committata. Nessuna azione.

---

### Task 1: Standardizzare `WcCard` (readout mvm + Confidenza + blocco Gol)

**Files:**
- Modify: `components/world-cup/WcBoard.tsx` (import in testa; helper locale dopo `const pct` ~riga 152; derivazioni dentro `WcCard` prima del `return`; sostituzione JSX nella sezione rows+edge-chip ~righe 414-440)

**Interfaces:**
- Consumes da `@/lib/poisson-model`: `computeGoalsSummary(lambdaHome: number, lambdaAway: number): { expected_goals: number; band_low: number; band_high: number; band_p: number }` e `computeExtraMarkets(lambdaHome: number, lambdaAway: number, marketOdds?): Array<{ key: string; label: string; p: number; ... }>` (over_1_5/2_5/3_5 tra i risultati).
- Dati già in `WcCard`: `probs` ({home,draw,away}), `pick` ("HOME"|"DRAW"|"AWAY"|null), `belowFloor`, `home`, `away`, `lang`, `copy`, `e = p.enrichment` (con `e.market?{p_home,p_draw,p_away}`, `e.lambdas?{home,away}`), `p.signal_type`, `p.edge_percent`, `p.confidence_score`, helper `pct`.
- Produces: nessuna API nuova (componente interno).

- [ ] **Step 1: Aggiungere l'import delle funzioni gol**

In `components/world-cup/WcBoard.tsx`, dopo l'import esistente `import { modelEdge } from "@/lib/best-bets";` (~riga 13), aggiungere:

```tsx
import { computeExtraMarkets, computeGoalsSummary } from "@/lib/poisson-model";
```

- [ ] **Step 2: Aggiungere l'helper locale `confidenceFromEdge`**

In `components/world-cup/WcBoard.tsx`, subito dopo `const pct = (v: number) => …;` (~riga 152), aggiungere (copia verbatim dell'helper del calcio in `app/app/page.tsx:1911`, così i pallini coincidono):

```tsx
// Mirror of the football card's confidenceFromEdge (app/app/page.tsx) so the
// World Cup confidence meter matches the home board exactly. `edge` is the
// FRACTIONAL edge (e.g. 0.032), not a percentage.
function wcConfidenceFromEdge(edge: number | null, probability: number) {
  const edgeScore = Math.min(45, Math.max(0, (edge ?? 0) * 700));
  const probScore = Math.min(35, Math.max(0, (probability - 0.35) * 100));
  return Math.round(Math.min(95, 20 + edgeScore + probScore));
}
```

- [ ] **Step 3: Aggiungere le derivazioni dentro `WcCard`**

In `WcCard`, subito dopo la riga `const wcModelEdge = … modelEdge(wcProbs[0], wcProbs[1]) : null;` (la dichiarazione esistente, ~riga 345), aggiungere il blocco di derivazioni per il readout standard:

```tsx
  // ── Standard readout (mirror of the football PredictionCard) ──────────────
  // Market-implied %, model %, value edge, confidence and goal markets, all
  // from data already on the row. Shown only in the clear-pick branch below.
  const pickProb =
    pick === "HOME" ? probs?.home
    : pick === "AWAY" ? probs?.away
    : pick === "DRAW" ? probs?.draw
    : null;
  const pickName =
    pick === "HOME" ? home
    : pick === "AWAY" ? away
    : pick === "DRAW" ? (lang === "it" ? "Pareggio" : "Draw")
    : null;
  const marketImplied =
    pick === "HOME" ? e?.market?.p_home
    : pick === "AWAY" ? e?.market?.p_away
    : pick === "DRAW" ? e?.market?.p_draw
    : null;
  // Value edge only when there is a real market price (promoted signal row).
  // p.edge_percent is already a percentage (e.g. 3.2).
  const edgeVal =
    p.signal_type === "signal" && typeof p.edge_percent === "number" && p.edge_percent > 0
      ? p.edge_percent
      : null;
  const confScore =
    pickProb != null
      ? (p.confidence_score ?? wcConfidenceFromEdge(edgeVal != null ? edgeVal / 100 : null, pickProb))
      : null;
  const confDots = confScore != null ? Math.max(1, Math.min(4, Math.round(confScore / 25))) : 0;
  const confLabel =
    confScore == null ? null
    : confScore >= 70 ? (lang === "it" ? "alta" : "high")
    : confScore >= 45 ? (lang === "it" ? "media" : "medium")
    : (lang === "it" ? "bassa" : "low");
  // Goal markets from the national-Poisson λ already on the row.
  const lh = e?.lambdas?.home;
  const la = e?.lambdas?.away;
  const goals =
    typeof lh === "number" && typeof la === "number" && lh > 0 && la > 0
      ? computeGoalsSummary(lh, la)
      : null;
  const overs = goals && typeof lh === "number" && typeof la === "number"
    ? computeExtraMarkets(lh, la)
    : [];
  const overPct = (key: string) => {
    const m = overs.find((x) => x.key === key);
    return m ? `${Math.round(m.p * 100)}%` : "—";
  };
```

- [ ] **Step 4: Sostituire la sezione JSX (rows + edge chip) col readout standard**

In `WcCard`, sostituire ESATTAMENTE questo blocco (attualmente ~righe 414-440, dentro il ramo non-locked `<>`, dal `{probs && (` fino al `) : null}` dell'edge chip):

```tsx
          {probs && (
            <div className="rows">
              {rowsData.map((r) => {
                const isPick = !belowFloor && pick === r.key;
                return (
                  <div key={r.key} className={`row${isPick ? " pick" : ""}`}>
                    <span className="lab">{r.key}</span>
                    <div className="track"><span className="fill" style={{ width: `${Math.round(r.pct * 100)}%` }} /></div>
                    <span className="pct">{pct(r.pct)}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* edge chip — model edge primary (uniform across sports); the neutral
              gate label when below the surfacing floor. */}
          {belowFloor ? (
            <span className="edge flat wc-no-favourite-inline">
              <strong>{copy.noClearFavourite}</strong> · <span>{copy.openMatch}</span>
            </span>
          ) : wcModelEdge != null ? (
            <span className="edge model">
              <svg aria-hidden="true"><use href="#g-bolt" /></svg>
              +{wcModelEdge.toFixed(1)} pt · {lang === "it" ? "edge modello" : "model edge"}
            </span>
          ) : null}
```

con questo (ramo below-floor = barre oneste; ramo pick = readout mvm + Confidenza + blocco Gol — il `.why` che segue resta invariato e condiviso):

```tsx
          {belowFloor ? (
            <>
              {probs && (
                <div className="rows">
                  {rowsData.map((r) => (
                    <div key={r.key} className="row">
                      <span className="lab">{r.key}</span>
                      <div className="track"><span className="fill" style={{ width: `${Math.round(r.pct * 100)}%` }} /></div>
                      <span className="pct">{pct(r.pct)}</span>
                    </div>
                  ))}
                </div>
              )}
              <span className="edge flat wc-no-favourite-inline">
                <strong>{copy.noClearFavourite}</strong> · <span>{copy.openMatch}</span>
              </span>
            </>
          ) : (
            <>
              <div className="mvm">
                <div className="col">
                  <div className="n">{marketImplied != null ? pct(marketImplied) : "–"}</div>
                  <div className="l">{lang === "it" ? "Mercato" : "Market"}</div>
                </div>
                <div className="col model">
                  <div className="n">{pickProb != null ? pct(pickProb) : "–"}</div>
                  <div className="l"><span className="lw">{lang === "it" ? "Modello" : "Model"}</span>{pickName ? <span className="ln"> · {pickName}</span> : null}</div>
                </div>
                <div className={`col edge${edgeVal != null ? " val" : ""}`}>
                  <div className="n">{edgeVal != null ? `+${edgeVal.toFixed(1)}%` : "–"}</div>
                  <div className="l">Edge</div>
                </div>
              </div>
              {edgeVal != null && confScore != null ? (
                <div className="conf">
                  <span className="conf-lab">{lang === "it" ? "Confidenza" : "Confidence"}</span>
                  {[0, 1, 2, 3].map((i) => <span key={i} className={`dot${i < confDots ? " on" : ""}`} />)}
                  {confLabel && <span className="conf-txt">{confLabel}</span>}
                </div>
              ) : (
                <span className="edge flat">
                  {marketImplied != null
                    ? (lang === "it" ? "nessun edge · in linea col mercato" : "no edge · in line with market")
                    : (lang === "it" ? "nessuna quota · lettura del modello" : "no market price · model read")}
                </span>
              )}
              {goals && (
                <div className="goals-block">
                  <div className="goals-head">
                    <span className="goals-eg">{lang === "it" ? "Gol attesi" : "Expected goals"}: <b>{goals.expected_goals.toFixed(1)}</b></span>
                    <span className="goals-band">{lang === "it" ? "Fascia più probabile" : "Most likely range"}: <b>{goals.band_low === goals.band_high ? `${goals.band_low}` : `${goals.band_low}–${goals.band_high}`} {lang === "it" ? "gol" : "goals"}</b> ({Math.round(goals.band_p * 100)}%)</span>
                  </div>
                  <div className="goals-ou">
                    <span>Over 1.5: <b>{overPct("over_1_5")}</b></span>
                    <span>Over 2.5: <b>{overPct("over_2_5")}</b></span>
                    <span>Over 3.5: <b>{overPct("over_3_5")}</b></span>
                  </div>
                </div>
              )}
            </>
          )}
```

Nota: NON toccare il blocco `{/* WHY … */}<div className="why">…</div>` che segue subito dopo — resta condiviso per entrambi i rami. Il ramo `p.locked` (overlay) sopra resta invariato.

- [ ] **Step 4b: Rimuovere gli orfani creati dalla modifica**

Rimuovendo l'edge-chip, `wcModelEdge` e `wcProbs` (e l'import `modelEdge`) non sono più usati. Prima confermare con grep che non servano altrove:

Run: `grep -n "wcModelEdge\|wcProbs\|modelEdge" components/world-cup/WcBoard.tsx`
Atteso: occorrenze SOLO nella dichiarazione `wcProbs`/`wcModelEdge` e nell'import. Se così, rimuovere:
1. Il blocco di dichiarazione (commento incluso) in `WcCard`:

```tsx
  // Model edge — margin of the pick over the 2nd-best outcome — is the primary,
  // uniform metric across every sport (Andrea: "edge modello primario ovunque").
  // A real market edge, when present, is surfaced as a detail inside the Why
  // (buildWcWhy reads p.edge_percent), not as the headline chip.
  const wcProbs = probs ? [probs.home, probs.draw, probs.away].filter((v) => Number.isFinite(v)).sort((a, b) => b - a) : [];
  const wcModelEdge =
    !belowFloor && wcProbs.length >= 2 ? modelEdge(wcProbs[0], wcProbs[1]) : null;
```

2. L'import in testa al file: `import { modelEdge } from "@/lib/best-bets";`

(Se invece il grep mostra un uso residuo di `modelEdge` altrove, lasciare l'import e rimuovere solo le due righe `wcProbs`/`wcModelEdge`.)

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: nessun NUOVO errore in `components/world-cup/WcBoard.tsx` (il repo può avere ~2 errori stripe pre-esistenti non correlati — confermare che l'insieme errori sia invariato salvo quelli).

- [ ] **Step 6: Build**

Run: `npm run build`
Expected: build completa senza errori (`/world-cup` compila).

- [ ] **Step 7: Visual check su `/world-cup` da loggato Base+ (obbligatorio — lo fa il controller)**

NON tentare un login headless. Il controller verifica (dev server + sessione Base+/bypass):
- una card WC con pick chiaro mostra il readout **Mercato / Modello · {squadra} / Edge** + (se c'è edge di valore) i pallini **Confidenza**, altrimenti la label "nessuna quota · lettura del modello";
- subito sotto il **blocco Gol**: Gol attesi + Fascia + Over 1.5/2.5/3.5 con Over monotòni (1.5 ≥ 2.5 ≥ 3.5);
- una card **below-floor** mostra le barre HOME/DRAW/AWAY + "nessun favorito";
- card **locked** → overlay invariato;
- impaginazione coerente con una card calcio/tennis del feed `/app` (confronto a fianco);
- resto di `/world-cup` (gruppi, calendario, winner odds) invariato.

- [ ] **Step 8: Commit**

```bash
git add components/world-cup/WcBoard.tsx
git commit -m "feat(wc): card /world-cup al design standard — readout mvm + Confidenza + blocco Gol

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Note finali

- Merge/deploy prod = **gate APPROVE** (codice di prodotto su superficie pubblica). PR con report "cosa è cambiato davvero vs proposto" + screenshot del visual check.
- `wcModelEdge` (l'edge-modello-in-punti) non è più mostrato come chip: il readout usa l'edge di valore (come calcio). Se Andrea volesse mantenere anche il "+X pt model edge" da qualche parte, è un follow-up — non in questo piano (la richiesta è "uguali al calcio").
