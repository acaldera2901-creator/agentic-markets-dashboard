# Ridisegno Why + Deep Analysis — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline) — implementare task per task. Step con checkbox `- [ ]`.

**Goal:** Riscrivere i testi "Why" in lingua semplice (intrecciando gol/marcatore/forma/confidenza) e rifare la Deep Analysis come lista compatta ripulita, per calcio/tennis/WC — solo presentazione, deterministico, 5 lingue.

**Architecture:** Estrarre i frammenti di testo riusabili (forma a parole, frase gol, frase marcatore, confidenza) in un lib puro testabile `lib/why-text.ts` (vitest). I 3 builder esistenti (`buildFootballWhy`, `buildTennisWhy` in `app/app/page.tsx`; `buildWcWhy` in `WcBoard.tsx`) li usano per assemblare ≤4 frasi. Le Deep Analysis restano JSX in-file: si ripuliscono label + ordine + righe nuove.

**Tech Stack:** Next.js/TypeScript, vitest (via npx, non in package.json), i18n inline via `pick5`/ternari `WcLang`.

## Global Constraints

- 5 lingue sempre: it/en/es/fr/ru (pattern `pick5(lang,{...})` / ternari WcLang).
- FTC: mai dichiarare value senza quota reale; confidenza descrittiva, mai promesse.
- Nessuna modifica a modello/probabilità/edge/gating/projection/schema. Solo presentazione.
- Fail-soft: ogni frase/riga è condizionale al dato presente; nessun crash se manca.
- Deep Analysis resta premium-only (`isPremium` calcio/tennis; projection-gated WC).
- Cap Why: ≤4 frasi brevi (prioritizzazione).
- Fonti gol: calcio = `enrichment.goals_summary` + `extra_markets`; WC = `computeGoalsSummary`/`computeExtraMarkets` (già in WcBoard). Marcatori = `enrichment.goalscorer_markets` (top per `pScores`).

---

### Task 1: lib/why-text.ts — frammenti plain-language (TESTATO)

**Files:**
- Create: `lib/why-text.ts`
- Test: `lib/why-text.test.ts`

**Interfaces — Produces:**
- `type WhyLang = "it"|"en"|"es"|"fr"|"ru"`
- `formPhrase(c:{w:number;d:number;l:number}|null, lang:WhyLang): string|null` — es. "4 vittorie nelle ultime 5", "in un buon momento", "in un periodo difficile", "in forma altalenante"; null se c==null.
- `goalsPhrase(eg:number, bandLow:number, bandHigh:number, over25:number|null, lang:WhyLang): string` — es. "partita da ~3 gol (2-3), Over 2.5 al 58%". over25 in 0..1; se null ometti la coda Over.
- `scorerPhrase(name:string, pScores:number, lang:WhyLang): string` — es. "occhio a Mbappé, primo candidato al gol (51%)".
- `confidenceWord(strong:boolean, smallSample:boolean, lang:WhyLang): string` — "lettura solida" / "più incertezza per il campione limitato" / "partita incerta".

- [ ] **Step 1: test che fallisce** — `lib/why-text.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { formPhrase, goalsPhrase, scorerPhrase, confidenceWord } from "./why-text";

describe("why-text", () => {
  it("formPhrase: 4 vinte su 5 (IT/EN)", () => {
    expect(formPhrase({ w: 4, d: 0, l: 1 }, "it")).toBe("4 vittorie nelle ultime 5");
    expect(formPhrase({ w: 4, d: 0, l: 1 }, "en")).toBe("4 wins in the last 5");
  });
  it("formPhrase: mood buono / difficile / altalena", () => {
    expect(formPhrase({ w: 2, d: 1, l: 0 }, "it")).toBe("in un buon momento");
    expect(formPhrase({ w: 0, d: 1, l: 3 }, "it")).toBe("in un periodo difficile");
    expect(formPhrase({ w: 1, d: 1, l: 1 }, "it")).toBe("in forma altalenante");
    expect(formPhrase(null, "it")).toBeNull();
  });
  it("goalsPhrase con e senza Over", () => {
    expect(goalsPhrase(2.9, 2, 3, 0.58, "it")).toContain("Over 2.5 al 58%");
    expect(goalsPhrase(2.9, 2, 3, null, "it")).not.toContain("Over");
  });
  it("scorerPhrase formatta nome + %", () => {
    expect(scorerPhrase("Mbappé", 0.51, "it")).toContain("Mbappé");
    expect(scorerPhrase("Mbappé", 0.51, "it")).toContain("51%");
  });
  it("confidenceWord", () => {
    expect(confidenceWord(true, false, "it")).toBe("lettura solida");
    expect(confidenceWord(false, true, "it")).toContain("campione");
  });
});
```

- [ ] **Step 2: run, deve fallire** — `npx vitest run lib/why-text.test.ts` → FAIL (module not found).
- [ ] **Step 3: implementa `lib/why-text.ts`** — funzioni pure con le 5 lingue (regole: "n vinte su 5" se w≥3 su w+d+l≤5; mood da `formMoodWord` esistente: ≥3W o (≥2W e 0L)→buono, ≥3L o 0W→difficile, else altalena; goalsPhrase arrotonda eg, mostra fascia low-high o singola, coda Over se over25!=null; scorerPhrase `${name} … (${round(p*100)}%)`; confidenceWord 3 casi).
- [ ] **Step 4: run, deve passare** — `npx vitest run lib/why-text.test.ts` → PASS.
- [ ] **Step 5: commit** — `git add lib/why-text.ts lib/why-text.test.ts && git commit -m "feat(why): lib plain-language why-text + test"`

---

### Task 2: buildFootballWhy → nuovo (page.tsx)

**Files:** Modify `app/app/page.tsx` (`buildFootballWhy` ~4156).
**Consumes:** Task 1 helpers; `e.goals_summary`, `e.extra_markets` (over_2_5), `e.goalscorer_markets`, `e.form_home/away`, `p.p_*`, `p.edge`, `p.odds_*`, `isFootballBestBet`.

- [ ] **Step 1**: importare i helper da `@/lib/why-text` in page.tsx.
- [ ] **Step 2**: riscrivere `buildFootballWhy` per assemblare ≤4 frasi nell'ordine: (1) chiamata (favorito netto/aperta/equilibrio da p_*), (2) `formPhrase` casa/trasferta a confronto, (3) `goalsPhrase` da goals_summary+over_2_5 se presenti, (4) `scorerPhrase` dal top di goalscorer_markets se presente (pScores≥0.15), (5) value+confidenza in una frase (isFootballBestBet → value; else in-linea/no-quota; `confidenceWord` da forza pick e campione `matches<10`). Prioritizza: tieni (1)+(5) sempre, (2/3/4) se dati. Niente sigle.
- [ ] **Step 3**: `npx tsc --noEmit` → 0 errori (esclusi stripe/vitest pre-esistenti).
- [ ] **Step 4: commit** — `git commit -am "feat(why): football why in lingua semplice + gol/marcatore"`

---

### Task 3: buildTennisWhy → nuovo (page.tsx)

**Files:** Modify `app/app/page.tsx` (`buildTennisWhy` ~4233).
**Consumes:** Task 1 `confidenceWord`; `m.surface`, `m.p1/p2`, `m.elo_p1/p2`, `m.surface_matches_p1/p2`, `m.h2h_*`, `m.odds_*`, `isTennisBestBet`.

- [ ] **Step 1**: riscrivere ≤4 frasi: (1) chiamata+superficie (favorito netto/di misura/equilibrio/TBD), (2) perché su questa superficie (△elo ≥60/≥15 + "{n} match qui" se surface_matches noto), (3) H2H se rilevante ("conduce gli scontri {a}-{b}"), (4) value+confidenza (isTennisBestBet / in-linea / no-quota + `confidenceWord`).
- [ ] **Step 2**: `npx tsc --noEmit` → 0 errori.
- [ ] **Step 3: commit** — `git commit -am "feat(why): tennis why in lingua semplice (superficie/H2H/confidenza)"`

---

### Task 4: buildWcWhy → nuovo (WcBoard.tsx)

**Files:** Modify `components/world-cup/WcBoard.tsx` (`buildWcWhy` ~273; usa `goals`/`overs` già calcolati nel componente — passarli o ricalcolare con computeGoalsSummary; `e.goalscorer_markets`, `e.form_*`, `e.venue.host_advantage`, `e.matches`, `probs`, `p.edge_percent`).
**Consumes:** Task 1 helpers.

- [ ] **Step 1**: importare helper da `@/lib/why-text` in WcBoard.tsx.
- [ ] **Step 2**: riscrivere `buildWcWhy` (e passargli i gol): ≤4 frasi: (1) chiamata da probs, (2) `formPhrase` confronto, (3) `goalsPhrase` da computeGoalsSummary/overs, (4) `scorerPhrase` top se presente, (5) host mezza-frase + value(edge_percent)/confidenza accorpate. Prioritizza a ≤4.
- [ ] **Step 3**: `npx tsc --noEmit` → 0 errori.
- [ ] **Step 4: commit** — `git commit -am "feat(why): world cup why in lingua semplice + gol/marcatore/host"`

---

### Task 5: Deep Analysis calcio (page.tsx)

**Files:** Modify `app/app/page.tsx` (DA calcio ~4682).

- [ ] **Step 1**: ripulire/riordinare le righe `.da-row`: Gol attesi (goals_summary o xg) · **Risultato probabile** (band) · **Over 2.5** (extra_markets) · Forma (in parole via formPhrase counts→string corta) · **Marcatore top** (goalscorer_markets) · Pressing (ppda, opz.) · Infortuni · Meteo · **Modello vs Mercato** (p vs 1/odds + edge). Rimuovere righe jargon non spiegabili (npxG, API-FB) dalla lista. Label tutte in 5 lingue.
- [ ] **Step 2**: `npx tsc --noEmit` → 0 errori.
- [ ] **Step 3: commit** — `git commit -am "feat(deep): deep analysis calcio ripulita + righe nuove"`

---

### Task 6: Deep Analysis tennis (page.tsx)

**Files:** Modify `app/app/page.tsx` (DA tennis ~5073).

- [ ] **Step 1**: label in parole: Forza sulla superficie (elo) · Forza generale (elo_overall) · Match su questa superficie (surface_matches) · Probabilità modello (elo_raw) · Testa a testa (h2h). 5 lingue.
- [ ] **Step 2**: `npx tsc --noEmit` → 0 errori.
- [ ] **Step 3: commit** — `git commit -am "feat(deep): deep analysis tennis label in parole semplici"`

---

### Task 7: Deep Analysis World Cup (WcBoard.tsx)

**Files:** Modify `components/world-cup/WcBoard.tsx` (`DeepAnalysis` ~160).

- [ ] **Step 1**: riordino/ripulitura: Gol attesi · **Risultato probabile** · **Over 2.5** · Forma · **Marcatore top** · Riposo/Viaggio/In casa · Infortuni · Modello vs Mercato. Label in parole, 5 lingue (WcLang).
- [ ] **Step 2**: `npx tsc --noEmit` → 0 errori.
- [ ] **Step 3: commit** — `git commit -am "feat(deep): deep analysis world cup ripulita + righe nuove"`

---

### Task 8: Verifica end-to-end + deploy

- [ ] **Step 1**: `npx vitest run lib/why-text.test.ts` → PASS; `npx tsc --noEmit` pulito.
- [ ] **Step 2**: merge FF → main + push (GATE: APPROVE deploy Andrea), poll `/api/version`.
- [ ] **Step 3**: visual check Pro su prod: Why su una card calcio, una tennis, una WC; Deep Analysis nuova su ognuna; fail-soft (dato mancante → riga assente); spot-check IT+EN.
- [ ] **Step 4**: aggiornare diario.

## Self-Review

- **Spec coverage:** Why calcio (T2), tennis (T3), WC (T4); Deep Analysis calcio (T5), tennis (T6), WC (T7); helper testati (T1); verifica/5-lingue (T8). ✓ Tutti i punti spec coperti.
- **Placeholder scan:** i testi 5-lingue completi si scrivono in implementazione (UI copy); le regole/condizioni sono esplicite per ogni frase/riga. Nessun "TBD/handle edge cases".
- **Type consistency:** `WhyLang` = stesse 5 lingue di `Lang`/`WcLang`; helper accettano `WhyLang` (passare `lang` esistente). goals: calcio `goals_summary`/`extra_markets`, WC `computeGoalsSummary`. Marcatori `goalscorer_markets` (pScores).
