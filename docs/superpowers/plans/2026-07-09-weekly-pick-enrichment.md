# Weekly Pick — pagina piena (Fase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trasformare `/weekly-pick` in una pagina di analisi completa e densa che rende visibile tutto ciò che il modello già calcola, più brief editoriale e anteprima che converte — senza nuove dipendenze esterne.

**Architecture:** Tutti gli arricchimenti sono aggiunti al **serve route** `/api/weekly-pick` (che già fa il join `unified_predictions.enrichment`) + a un pure helper in `lib/weekly-pick.ts`; la UI in `app/weekly-pick/page.tsx` li rende. Nessuna migration, nessun tocco al cron `generate` né al daemon Python.

**Tech Stack:** Next.js (App Router, questa build ha breaking changes — vedi `node_modules/next/dist/docs/`), TypeScript, CSS in `app/globals.css`, test con il runner esistente del repo.

## Global Constraints

- **FTC-safe**: mai quote, mai edge/vincita promessa, mai "battiamo il mercato".
- **No invenzione**: ogni numero/fatto da dati reali persistiti; brief = template deterministico, non prosa generata.
- **Locked = zero leak**: per non-acquirenti `market/prob/status/kickoff/id/detail` restano `null` server-side; combinata nascosta. L'anteprima mostra solo label match, competizione, sport, orario e conteggi aggregati.
- **Surgical**: solo `lib/weekly-pick.ts`, `lib/weekly-pick.test.ts`, `app/api/weekly-pick/route.ts`, `app/weekly-pick/page.tsx`, `app/globals.css`. Nessuna migration/Python/cron.
- **5 lingue**: ogni copy nuovo in it/en/es/fr/ru (oggetti `COPY`/`DCOPY`).
- **WC standings**: mostrata solo per gironi avviati (almeno una squadra con `played > 0`); fail-soft se fetch fallisce o squadra non trovata.
- **Feature dietro** `WEEKLY_PICK_ENABLED`. Deploy: branch+PR, mai push diretto su main, PROPOSAL + APPROVE al `ch_deploy_gate`.

---

### Task 1: `weeklyBrief()` — dati del brief (puro)

**Files:**
- Modify: `lib/weekly-pick.ts` (append)
- Test: `lib/weekly-pick.test.ts` (append)

**Interfaces:**
- Consumes: `WeeklyPickLeg` (già esportato).
- Produces:
```ts
export type WeeklyBrief = {
  legs: number;
  competitions: number;        // # sport distinti (proxy competizione in Fase 1)
  combinedProb: number | null; // null quando non disponibile (lockato)
  avgConfidence: number | null;// media confidenze 0..100, null se nessuna
  strongest: { label: string; market: string; prob: number } | null;
};
export function weeklyBrief(
  legs: Array<{ label: string; sport: string; market: string | null; prob: number | null }>,
  combinedProb: number | null,
  confidences: number[],
): WeeklyBrief;
```

- [ ] **Step 1: Write the failing test**
```ts
import { weeklyBrief } from "./weekly-pick";

test("weeklyBrief: strongest = prob max, medie e conteggi", () => {
  const legs = [
    { label: "A vs B", sport: "football", market: "A", prob: 0.74 },
    { label: "C vs D", sport: "tennis", market: "C", prob: 0.61 },
    { label: "E vs F", sport: "football", market: "E", prob: 0.55 },
  ];
  const b = weeklyBrief(legs, 0.248, [70, 62, 58]);
  expect(b.legs).toBe(3);
  expect(b.competitions).toBe(2);
  expect(b.combinedProb).toBeCloseTo(0.248);
  expect(b.avgConfidence).toBe(63); // round((70+62+58)/3)
  expect(b.strongest).toEqual({ label: "A vs B", market: "A", prob: 0.74 });
});

test("weeklyBrief: lockato/parziale null-safe", () => {
  const legs = [
    { label: "A vs B", sport: "football", market: null, prob: null },
    { label: "C vs D", sport: "tennis", market: null, prob: null },
  ];
  const b = weeklyBrief(legs, null, []);
  expect(b.legs).toBe(2);
  expect(b.competitions).toBe(2);
  expect(b.combinedProb).toBeNull();
  expect(b.avgConfidence).toBeNull();
  expect(b.strongest).toBeNull(); // nessuna prob nota
});
```

- [ ] **Step 2: Run test, verify FAIL** — `npm test -- weekly-pick` → FAIL ("weeklyBrief is not a function").

- [ ] **Step 3: Implement**
```ts
export type WeeklyBrief = {
  legs: number;
  competitions: number;
  combinedProb: number | null;
  avgConfidence: number | null;
  strongest: { label: string; market: string; prob: number } | null;
};

// PURA. Aggregati del brief settimanale (nessun testo: la UI compone la frase
// multilingua dai campi). Null-safe: col teaser lockato prob/market sono null →
// strongest null, combinata dal chiamante (null se nascosta). Tie-break stabile
// per label così due leg a pari prob danno sempre lo stesso strongest.
export function weeklyBrief(
  legs: Array<{ label: string; sport: string; market: string | null; prob: number | null }>,
  combinedProb: number | null,
  confidences: number[],
): WeeklyBrief {
  const competitions = new Set(legs.map((l) => l.sport)).size;
  const withProb = legs.filter(
    (l): l is { label: string; sport: string; market: string; prob: number } =>
      typeof l.prob === "number" && Number.isFinite(l.prob) && typeof l.market === "string"
  );
  const strongest = withProb.length
    ? withProb.reduce((best, l) =>
        l.prob > best.prob || (l.prob === best.prob && l.label < best.label) ? l : best
      )
    : null;
  const avgConfidence = confidences.length
    ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length)
    : null;
  return {
    legs: legs.length,
    competitions,
    combinedProb: combinedProb ?? null,
    avgConfidence,
    strongest: strongest ? { label: strongest.label, market: strongest.market, prob: strongest.prob } : null,
  };
}
```

- [ ] **Step 4: Run test, verify PASS** — `npm test -- weekly-pick` → PASS.

- [ ] **Step 5: Commit** — `git add lib/weekly-pick.ts lib/weekly-pick.test.ts && git commit -m "feat(weekly-pick): weeklyBrief() aggregati brief (#WEEKLY-PICK-2)"`

---

### Task 2: Serve route — detail esteso + aggregati + standings WC

**Files:**
- Modify: `app/api/weekly-pick/route.ts`

**Interfaces:**
- Consumes: `weeklyBrief`, `fetchWcGroups` (da `@/lib/world-cup`).
- Produces (payload aggiunto): a livello top `brief: WeeklyBrief`, `sports: Record<string, number>`; dentro ogni `detail`: `restDays {home,away}`, `hostAdvantage: string|null`, `squadStrength {home,away}` (0..1|null), `lineups: {home?: string[]; away?: string[]}|null`, `group: string|null`, `standing: { home: WcStandingRow|null; away: WcStandingRow|null }|null`.

- [ ] **Step 1: Estendi `buildLegDetail`** — dentro la funzione, dopo i blocchi esistenti, aggiungi al return:
```ts
    restDays: { home: numOrNull(venue.rest_days_home), away: numOrNull(venue.rest_days_away) },
    hostAdvantage: typeof venue.host_advantage === "string" ? venue.host_advantage : null,
    squadStrength: { home: numOrNull(squad.xi_value_ratio_home), away: numOrNull(squad.xi_value_ratio_away) },
    lineups: (() => {
      const lu = (e.lineups && typeof e.lineups === "object") ? e.lineups as Record<string, unknown> : null;
      if (!lu) return null;
      const side = (v: unknown) => Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 11) : undefined;
      const home = side((lu.home as Record<string, unknown>)?.xi ?? lu.home);
      const away = side((lu.away as Record<string, unknown>)?.xi ?? lu.away);
      return (home || away) ? { home, away } : null;
    })(),
    group: typeof e.group === "string" ? e.group : null,
```
> NB: la forma esatta di `enrichment.lineups` va confermata a runtime (vedi `_format_confirmed_xi` in `agents/model.py`); il codice sopra è fail-soft — se la forma non combacia, `lineups` resta `null`, nessun crash. Confermare con una riga reale in Step 4.

- [ ] **Step 2: Standings WC (una volta per request)** — in `GET`, dopo aver risolto `resolvedLegs`, prima del `return`:
```ts
import { fetchWcGroups, type WcStandingRow } from "@/lib/world-cup";
// ...
const needsWc = unlocked && sels.some((s) => /world|wc/i.test(s.sport ?? ""));
const wcGroups = needsWc ? await fetchWcGroups().catch(() => []) : [];
const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
const findStanding = (team: string): WcStandingRow | null => {
  const n = norm(team);
  for (const g of wcGroups) for (const row of g.teams) {
    if (!norm(row.team) || row.played <= 0) continue; // solo gironi avviati
    if (norm(row.team) === n || norm(row.team).includes(n) || n.includes(norm(row.team))) return row;
  }
  return null;
};
```

- [ ] **Step 3: Brief + aggregati + standings nel payload** — sostituisci il `return NextResponse.json({...})` per includere:
```ts
  const parts = (label: string) => { const p = label.split(/\s+vs\s+/i); return { home: p[0] ?? label, away: p[1] ?? "" }; };
  const confidences: number[] = [];
  const selectionsOut = resolvedLegs.map((s) => {
    const predId = s.id.startsWith("wp_") ? s.id.slice(3) : s.id;
    const rich = richById.get(predId);
    const detail = unlocked && rich ? buildLegDetail(rich) : null;
    if (detail?.confidence != null) confidences.push(detail.confidence);
    let detailWithStanding = detail;
    if (detail && needsWc && /world|wc/i.test(s.sport ?? "")) {
      const { home, away } = parts(s.label);
      detailWithStanding = { ...detail, standing: { home: findStanding(home), away: findStanding(away) } };
    }
    return {
      label: s.label, sport: s.sport,
      market: unlocked ? s.market : null,
      prob: unlocked ? s.prob : null,
      status: unlocked ? s.status : null,
      kickoff: unlocked ? s.kickoff : null,
      id: unlocked ? predId : null,
      detail: detailWithStanding,
    };
  });
  const sports: Record<string, number> = {};
  for (const s of sels) sports[String(s.sport ?? "other")] = (sports[String(s.sport ?? "other")] ?? 0) + 1;
  const brief = weeklyBrief(
    selectionsOut.map((s) => ({ label: s.label, sport: s.sport, market: s.market, prob: s.prob })),
    unlocked && row.combined_prob != null ? Number(row.combined_prob) : null,
    confidences,
  );
```
poi nel JSON aggiungi `brief`, `sports`, e usa `selections: selectionsOut`.

- [ ] **Step 4: Verifica** — `npx tsc --noEmit` (0 errori sui file toccati). Poi con `WEEKLY_PICK_ENABLED=true` e una riga reale, `curl` locale del route come Pro → conferma `brief`, `sports`, `detail.restDays/squadStrength/lineups/standing` presenti; come anonimo → `market/prob/detail` null. Documenta la forma reale di `lineups`.

- [ ] **Step 5: Commit** — `git commit -am "feat(weekly-pick): serve brief+aggregati+detail esteso+standings WC (#WEEKLY-PICK-2)"`

---

### Task 3: UI pagina — brief, card inline, stat, anteprima

**Files:**
- Modify: `app/weekly-pick/page.tsx`

**Interfaces:**
- Consumes: payload esteso di Task 2 (`brief`, `sports`, `detail.*` nuovi).

- [ ] **Step 1: Estendi i type** `Detail` e `Data`:
```ts
type WcRow = { team: string; played: number; won: number; drawn: number; lost: number; goals_for: number; goals_against: number; points: number };
// in Detail: aggiungi
  restDays?: { home: number | null; away: number | null };
  hostAdvantage?: string | null;
  squadStrength?: { home: number | null; away: number | null };
  lineups?: { home?: string[]; away?: string[] } | null;
  group?: string | null;
  standing?: { home: WcRow | null; away: WcRow | null } | null;
// in Data: aggiungi
  brief?: { legs: number; competitions: number; combinedProb: number | null; avgConfidence: number | null; strongest: { label: string; market: string; prob: number } | null };
  sports?: Record<string, number>;
```

- [ ] **Step 2: Copy 5 lingue** — aggiungi a ogni lingua di `COPY` le chiavi: `briefEyebrow`, `briefLegs` ("selezioni"), `briefComp` ("competizioni"), `briefConf` ("confidenza media"), `briefStrongest` ("la più solida"), `briefFactors` ("ogni partita analizzata su forma, gol attesi, assenze, contesto, formazioni"), `unlockList` (array 4-5 voci "cosa sblocchi"), `unlockPromo` ("Analisi completa di ogni partita"). A `DCOPY`: `rest` ("Riposo"), `host` ("Fattore campo"), `squadStr` ("Forza rosa"), `xi` ("Formazione confermata"), `standing` ("Classifica girone"), `pos` ("pos.").

- [ ] **Step 3: Componente `<WeeklyBrief>`** (in-file) sopra `<section className="wp-wrap">`, reso solo se `available`:
```tsx
{available && data?.brief && (
  <section className="wp-brief">
    <p className="lp-eyebrow">{t.briefEyebrow}</p>
    <div className="wp-brief-stats">
      <span className="wp-bstat"><b>{data.brief.legs}</b>{t.briefLegs}</span>
      <span className="wp-bstat"><b>{data.brief.competitions}</b>{t.briefComp}</span>
      {unlocked && data.brief.combinedProb != null && <span className="wp-bstat accent"><b>{Math.round(data.brief.combinedProb*100)}%</b>{t.kProb}</span>}
      {unlocked && data.brief.avgConfidence != null && <span className="wp-bstat"><b>{data.brief.avgConfidence}%</b>{t.briefConf}</span>}
    </div>
    {unlocked && data.brief.strongest && (
      <p className="wp-brief-strong">{t.briefStrongest}: <b>{data.brief.strongest.label}</b> — {data.brief.strongest.market} · {Math.round(data.brief.strongest.prob*100)}%</p>
    )}
    <p className="wp-brief-factors">{t.briefFactors}</p>
  </section>
)}
```

- [ ] **Step 4: Card leg inline** — estrai il corpo di `LegDetail` in un blocco riusabile e rendilo INLINE sotto ogni leg sbloccata (oltre a restare nella modale). Aggiungi al `LegDetail` esistente i nuovi blocchi (dopo il blocco forma), tutti condizionali/fail-soft:
```tsx
{(d?.squadStrength?.home != null || d?.squadStrength?.away != null) && (
  <div className="wp-d-block"><span className="wp-d-lab">{t.squadStr}</span>
    <div className="wp-d-xg">
      <span className="wp-d-xg-side"><em>{home}</em><b>{d.squadStrength.home != null ? Math.round(d.squadStrength.home*100)+"%" : "—"}</b></span>
      <span className="wp-d-xg-side"><em>{away}</em><b>{d.squadStrength.away != null ? Math.round(d.squadStrength.away*100)+"%" : "—"}</b></span>
    </div></div>
)}
{d?.lineups && (d.lineups.home?.length || d.lineups.away?.length) && (
  <div className="wp-d-block"><span className="wp-d-lab">{t.xi}</span>
    {d.lineups.home?.length ? <p className="wp-d-xi"><em>{home}:</em> {d.lineups.home.join(", ")}</p> : null}
    {d.lineups.away?.length ? <p className="wp-d-xi"><em>{away}:</em> {d.lineups.away.join(", ")}</p> : null}
  </div>
)}
{d?.standing && (d.standing.home || d.standing.away) && (
  <div className="wp-d-block"><span className="wp-d-lab">{t.standing}</span>
    <div className="wp-d-stand">
      {d.standing.home && <span>{home}: {d.standing.home.points}pt · {d.standing.home.won}-{d.standing.home.drawn}-{d.standing.home.lost}</span>}
      {d.standing.away && <span>{away}: {d.standing.away.points}pt · {d.standing.away.won}-{d.standing.away.drawn}-{d.standing.away.lost}</span>}
    </div></div>
)}
```
E i chip contesto: aggiungi `restDays` e `hostAdvantage` all'array `chips` esistente (fail-soft: solo se presenti).

- [ ] **Step 5: Anteprima pubblica** — nel ramo `!unlocked` del `wp-slip-foot`, sopra il box `wp-unlock`, inserisci il pannello "cosa sblocchi":
```tsx
{!unlocked && (
  <div className="wp-unlock-list">
    <span className="wp-unlock-list-ttl">{t.unlockPromo}</span>
    <ul>{t.unlockList.map((x, i) => <li key={i}><IChk />{x}</li>)}</ul>
  </div>
)}
```

- [ ] **Step 6: Verifica** — `npx tsc --noEmit` 0 errori; `npm run lint` sul file pulito. Commit: `git commit -am "feat(weekly-pick): UI brief+card inline+anteprima+stat (#WEEKLY-PICK-2)"`

---

### Task 4: CSS `.wp-*` in globals.css

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: greppa collisioni** — `grep -nE "wp-brief|wp-bstat|wp-d-xi|wp-d-stand|wp-unlock-list" app/globals.css` → deve essere vuoto (nessuna classe già usata).

- [ ] **Step 2: aggiungi le regole** vicino al blocco `.wp-*` esistente, coerenti col design system verde (variabili `--am-*`): `.wp-brief` (card superficie sopra la slip), `.wp-brief-stats`/`.wp-bstat` (riga stat, `b` grande, accento verde su `.accent`), `.wp-brief-strong`, `.wp-brief-factors` (muted, small), `.wp-d-xi` (riga formazione, text-sm muted), `.wp-d-stand` (flex column, small), `.wp-unlock-list` (lista con check verdi, gap). Responsive (flex-wrap, no inline-style che blocca il responsive — usare classi).

- [ ] **Step 3: Verifica visiva** — vedi Task 5. Commit: `git commit -am "style(weekly-pick): superfici brief/card inline/anteprima (#WEEKLY-PICK-2)"`

---

### Task 5: Verifica reale (Costruito ≠ Verificato)

- [ ] **Step 1: build+test+types** — `npm test -- weekly-pick` PASS; `npx tsc --noEmit` 0 errori; `npm run build` OK.
- [ ] **Step 2: visual check da loggato** — su preview/prod-like con `WEEKLY_PICK_ENABLED=true` e una `weekly_pick` reale: come **Pro** la pagina mostra brief + card inline complete (forma, xG, forza rosa, riposo, formazioni, classifica WC dove avviata) + stat; come **non-acquirente** vede anteprima ("cosa sblocchi") + nomi match, MAI pick/prob/combinata (ispeziona anche il JSON del route: campi null). Screenshot prima/dopo. NB: preview *.vercel.app non fa login → visual da loggato SOLO su prod.
- [ ] **Step 3:** se un formato dati reale non combacia (es. `lineups`), fixare alla radice e ripetere.

---

### Task 6: Deploy-gate + rilascio

- [ ] **Step 1: branch+PR** — lavoro su branch `feat/weekly-pick-enrichment`, fetch prima, PR verso main. Mai push diretto su main.
- [ ] **Step 2: PROPOSAL** in `ch_deploy_gate` con change-spec esatta (file toccati, prima→dopo, blast radius, rollback=revert, piano di verifica). Attendi `APPROVE #WEEKLY-PICK-2` umano.
- [ ] **Step 3: deploy** dopo APPROVE; verifica board+banner post-deploy (file condivisi); report "cosa è cambiato davvero vs proposto".

## Self-Review

- **Copertura spec**: brief (T1+T3), detail esteso (T2+T3), anteprima (T3), aggregati (T2+T3), standings WC solo-avviati (T2 `played>0` + T3). ✅
- **Placeholder**: nessun TBD; unico "da confermare a runtime" = forma `lineups`, gestito fail-soft con verifica esplicita in T2S4/T5S3. ✅
- **Type consistency**: `WeeklyBrief`/`WcStandingRow` coerenti tra T1/T2/T3; `squadStrength`/`restDays`/`lineups`/`standing`/`group` stessi nomi in serve e UI. ✅
