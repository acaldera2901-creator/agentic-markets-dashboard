# Weekly Pick — Pagina strutturata + entry point — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendere la pagina `/weekly-pick` una feature strutturata e visibile (hero + card con stato live delle legs + come funziona + storico), agganciata nel rail "Featured" e nei Piani Pro — tutto frontend/read-only, senza toccare DB/flag/pagamenti.

**Architecture:** Approccio A (route standalone arricchita). Una funzione pura di risoluzione esiti (`resolveWeeklyPickOutcomes`) alimenta due endpoint read-only: `/api/weekly-pick` (settimana corrente, arricchito) e `/api/weekly-pick/history` (nuovo). La pagina consuma entrambi. Nessuna migration, nessuna scrittura DB, nessuna nuova tabella.

**Tech Stack:** Next.js 16 (App Router, route handlers `force-dynamic`), TypeScript, React 19 client component, `postgres` via `lib/db.dbQuery`, vitest (via `npx`, non installato in repo).

## Global Constraints

- **Feature gated invariata:** `weeklyPickEnabled()` legge `WEEKLY_PICK_ENABLED === "true"` (default OFF). Ogni endpoint resta inerte con flag OFF. Questo piano NON accende la feature, NON applica migration, NON aggiunge cron, NON tocca pagamenti. Con flag OFF la pagina mostra "in arrivo"/storico vuoto.
- **Nessun leak sulla settimana corrente:** per utenti lockati (non-Pro/non-acquirenti) l'API NON deve mai restituire `market`, `prob`, esito per-leg (`status`) né `outcome` aggregato — solo `label`, conteggio `legs` e `legs_remaining` aggregato. Lo storico (settimane chiuse) può mostrare tutto.
- **Copy FTC-safe:** nessuna quota, nessun edge/vincita promessa, nessun claim tipo "battiamo il mercato". Footer "18+ · gioca responsabilmente" già presente.
- **5 lingue:** it/en/es/fr/ru, stesso pattern `COPY[lang]` della pagina esistente.
- **Test runner:** vitest non è in `package.json`. Eseguire i test unit con `npx vitest run <file>`. Se offline/non disponibile, fallback: `npx tsx <file di asserzioni>` — ma preferire vitest per coerenza coi 4 `.test.ts` esistenti.
- **id leg → predId:** le selezioni salvate hanno `id = "wp_<predId>"`; il predId reale si ottiene togliendo il prefisso `wp_`.
- **Surgical:** nessun refactor del monolite `app/app/page.tsx` oltre le due aggiunte puntuali (rail link + PlanFeature). Nessun asset PNG raster nuovo.

---

### Task 1: Funzione pura `resolveWeeklyPickOutcomes` + test

**Files:**
- Modify: `lib/weekly-pick.ts` (append dopo `buildHouseMultipla`, ~riga 81)
- Test: `lib/weekly-pick.test.ts` (append nuovo `describe`)

**Interfaces:**
- Consumes: `WeeklyPickLeg` (già esistente in `lib/weekly-pick.ts:46`).
- Produces:
  - `type LegStatus = "upcoming" | "won" | "lost" | "void"`
  - `type MultiplaOutcome = "live" | "won" | "lost"`
  - `type PredOutcomeRow = { id: string; status: string | null; result: string | null; starts_at: string | null }`
  - `type ResolvedLeg = WeeklyPickLeg & { status: LegStatus; kickoff: string | null }`
  - `resolveWeeklyPickOutcomes(legs: WeeklyPickLeg[], predRows: PredOutcomeRow[]): { legs: ResolvedLeg[]; outcome: MultiplaOutcome; remaining: number }`

- [ ] **Step 1: Scrivi i test (falliscono: funzione non esiste)**

Append in fondo a `lib/weekly-pick.test.ts`. Aggiungi anche gli import necessari in cima al file (aggiungi `resolveWeeklyPickOutcomes`, `type PredOutcomeRow` all'import esistente da `./weekly-pick`).

```ts
describe("resolveWeeklyPickOutcomes", () => {
  const legs: WeeklyPickLeg[] = [
    { id: "wp_p1", label: "A vs B", market: "A", sport: "football", prob: 0.7 },
    { id: "wp_p2", label: "C vs D", market: "C", sport: "tennis", prob: 0.6 },
    { id: "wp_p3", label: "E vs F", market: "E", sport: "football", prob: 0.55 },
  ];

  it("tutte upcoming quando non ci sono righe → outcome live, remaining = n", () => {
    const r = resolveWeeklyPickOutcomes(legs, []);
    expect(r.outcome).toBe("live");
    expect(r.remaining).toBe(3);
    expect(r.legs.every((l) => l.status === "upcoming")).toBe(true);
  });

  it("≥1 leg persa → outcome lost", () => {
    const rows = [{ id: "p1", status: "settled", result: "lost", starts_at: "2026-07-06T12:00:00Z" }];
    const r = resolveWeeklyPickOutcomes(legs, rows);
    expect(r.outcome).toBe("lost");
    expect(r.legs.find((l) => l.id === "wp_p1")!.status).toBe("lost");
  });

  it("mix won + upcoming → live, remaining conta solo le upcoming", () => {
    const rows = [{ id: "p1", status: "settled", result: "won", starts_at: "2026-07-06T12:00:00Z" }];
    const r = resolveWeeklyPickOutcomes(legs, rows);
    expect(r.outcome).toBe("live");
    expect(r.remaining).toBe(2);
  });

  it("tutte risolte a won → outcome won, remaining 0", () => {
    const rows = [
      { id: "p1", status: "settled", result: "won", starts_at: null },
      { id: "p2", status: "settled", result: "won", starts_at: null },
      { id: "p3", status: "settled", result: "won", starts_at: null },
    ];
    const r = resolveWeeklyPickOutcomes(legs, rows);
    expect(r.outcome).toBe("won");
    expect(r.remaining).toBe(0);
  });

  it("void non conta come persa: won + void, nessuna upcoming → won", () => {
    const rows = [
      { id: "p1", status: "settled", result: "won", starts_at: null },
      { id: "p2", status: "void", result: "void", starts_at: null },
      { id: "p3", status: "settled", result: "won", starts_at: null },
    ];
    const r = resolveWeeklyPickOutcomes(legs, rows);
    expect(r.outcome).toBe("won");
  });

  it("leg senza riga corrispondente resta upcoming (mai lost) e passa il kickoff quando presente", () => {
    const rows = [{ id: "p1", status: "upcoming", result: null, starts_at: "2026-07-06T12:00:00Z" }];
    const r = resolveWeeklyPickOutcomes(legs, rows);
    expect(r.legs.find((l) => l.id === "wp_p1")!.status).toBe("upcoming");
    expect(r.legs.find((l) => l.id === "wp_p1")!.kickoff).toBe("2026-07-06T12:00:00Z");
    expect(r.legs.find((l) => l.id === "wp_p2")!.status).toBe("upcoming");
    expect(r.outcome).toBe("live");
  });
});
```

- [ ] **Step 2: Esegui i test e verifica che falliscano**

Run: `cd ~/Desktop/agentic-markets && npx vitest run lib/weekly-pick.test.ts`
Expected: FAIL — `resolveWeeklyPickOutcomes is not exported` / not defined.

- [ ] **Step 3: Implementa la funzione pura**

Append in fondo a `lib/weekly-pick.ts`:

```ts
// Stato di una leg risolto contro il settlement della sua predizione.
export type LegStatus = "upcoming" | "won" | "lost" | "void";
// Esito aggregato della multipla nella settimana.
export type MultiplaOutcome = "live" | "won" | "lost";
// Riga minima di unified_predictions necessaria alla risoluzione.
export type PredOutcomeRow = {
  id: string;
  status: string | null;
  result: string | null; // "won" | "lost" | "void" | "pending" | null
  starts_at: string | null;
};
export type ResolvedLeg = WeeklyPickLeg & { status: LegStatus; kickoff: string | null };

// PURA. Mappa ogni leg (id = `wp_<predId>`) allo stato del suo pronostico e deriva
// l'esito aggregato. Regole: `lost` se ≥1 leg persa; altrimenti `live` se ≥1 leg
// ancora da giocare; altrimenti `won`. Una leg il cui predId non ha riga resta
// `upcoming` (mai `lost`): un dato mancante non fa fallire falsamente la multipla.
export function resolveWeeklyPickOutcomes(
  legs: WeeklyPickLeg[],
  predRows: PredOutcomeRow[]
): { legs: ResolvedLeg[]; outcome: MultiplaOutcome; remaining: number } {
  const byId = new Map(predRows.map((r) => [r.id, r]));
  const resolved: ResolvedLeg[] = legs.map((leg) => {
    const predId = leg.id.startsWith("wp_") ? leg.id.slice(3) : leg.id;
    const row = byId.get(predId);
    let status: LegStatus = "upcoming";
    if (row && (row.result === "won" || row.result === "lost" || row.result === "void")) {
      status = row.result;
    }
    return { ...leg, status, kickoff: row?.starts_at ?? null };
  });
  const anyLost = resolved.some((l) => l.status === "lost");
  const remaining = resolved.filter((l) => l.status === "upcoming").length;
  const outcome: MultiplaOutcome = anyLost ? "lost" : remaining > 0 ? "live" : "won";
  return { legs: resolved, outcome, remaining };
}
```

- [ ] **Step 4: Esegui i test e verifica che passino**

Run: `cd ~/Desktop/agentic-markets && npx vitest run lib/weekly-pick.test.ts`
Expected: PASS (tutti, inclusi i test preesistenti del file).

- [ ] **Step 5: Commit**

```bash
git add lib/weekly-pick.ts lib/weekly-pick.test.ts
git commit -m "feat(weekly-pick): risoluzione pura esiti legs (stato live + aggregato) (#WEEKLY-PICK-1)"
```

---

### Task 2: Arricchire `GET /api/weekly-pick` con lo stato live delle legs

**Files:**
- Modify: `app/api/weekly-pick/route.ts` (interamente la GET, righe 22-63)

**Interfaces:**
- Consumes: `resolveWeeklyPickOutcomes`, `PredOutcomeRow` (Task 1); `dbQuery` (`lib/db`), `resolveAccessState` (`lib/auth`), `currentWeekStart`/`weeklyPickEnabled`/`weeklyPickIncludedInPlan`/`weeklyPickAmount` (già importati).
- Produces (shape JSON per la pagina):
  - unlocked: `selections[].{label,sport,market,prob,status,kickoff}`, `combined_prob`, `outcome`, `legs`, `legs_remaining`.
  - locked: `selections[].{label,sport,market:null,prob:null,status:null,kickoff:null}`, `combined_prob:null`, `outcome:null`, `legs`, `legs_remaining`.

- [ ] **Step 1: Sostituisci il corpo della GET**

In `app/api/weekly-pick/route.ts`, aggiorna l'import da `@/lib/weekly-pick` aggiungendo `resolveWeeklyPickOutcomes` e `type PredOutcomeRow`. Poi sostituisci da `const sels: Sel[] = ...` (riga 35) fino alla fine della `return NextResponse.json({...})` con:

```ts
  const sels: WeeklyPickLeg[] = typeof row.selections === "string"
    ? JSON.parse(row.selections)
    : ((row.selections as WeeklyPickLeg[]) ?? []);
  const included = weeklyPickIncludedInPlan(state);
  const purchased = ctx ? await hasWeeklyPick(ctx.identifier, week) : false;
  const unlocked = included || purchased;

  // Stato live: risolve ogni leg contro il settlement della sua predizione, così
  // chi compra a metà settimana vede cosa ha già giocato e cosa manca.
  const predIds = sels.map((s) => (s.id.startsWith("wp_") ? s.id.slice(3) : s.id));
  const predRows = predIds.length
    ? await dbQuery<PredOutcomeRow>(
        `SELECT id::text AS id, status, result, starts_at::text AS starts_at
           FROM unified_predictions WHERE id::text = ANY($1)`,
        [predIds]
      )
    : [];
  const { legs: resolvedLegs, outcome, remaining } = resolveWeeklyPickOutcomes(sels, predRows);

  const { amount, fullAmount, discounted } = weeklyPickAmount();

  return NextResponse.json({
    enabled: true,
    week,
    available: true,
    unlocked,
    included,
    price_usd: amount,
    full_price_usd: fullAmount,
    discounted,
    combined_prob: unlocked && row.combined_prob != null ? Number(row.combined_prob) : null,
    outcome: unlocked ? outcome : null, // live/won/lost solo per chi ha sbloccato
    legs: sels.length,
    legs_remaining: remaining, // aggregato safe per il teaser ("N ancora da giocare")
    // Proiezione lockata: solo label; market/prob/status/kickoff nulli (nessun leak).
    selections: resolvedLegs.map((s) => ({
      label: s.label,
      sport: s.sport,
      market: unlocked ? s.market : null,
      prob: unlocked ? s.prob : null,
      status: unlocked ? s.status : null,
      kickoff: unlocked ? s.kickoff : null,
    })),
  });
```

Inoltre aggiorna gli import di tipo in cima: rimuovi il vecchio `type Sel = {...}` (riga 20) se non più usato, e aggiungi `import { ..., resolveWeeklyPickOutcomes, type PredOutcomeRow, type WeeklyPickLeg } from "@/lib/weekly-pick";`. Il tipo locale `WpRow` (riga 19) resta.

- [ ] **Step 2: Verifica tipi + lint**

Run: `cd ~/Desktop/agentic-markets && npx tsc --noEmit && npm run lint`
Expected: nessun errore su `app/api/weekly-pick/route.ts`. (Se `tsc --noEmit` non è configurato, usa `npm run build` e verifica che compili.)

- [ ] **Step 3: Commit**

```bash
git add app/api/weekly-pick/route.ts
git commit -m "feat(weekly-pick): stato live legs nella card settimana corrente (#WEEKLY-PICK-1)"
```

---

### Task 3: Nuovo endpoint `GET /api/weekly-pick/history`

**Files:**
- Create: `app/api/weekly-pick/history/route.ts`

**Interfaces:**
- Consumes: `resolveWeeklyPickOutcomes`, `PredOutcomeRow`, `WeeklyPickLeg`, `currentWeekStart`, `weeklyPickEnabled` (`lib/weekly-pick`); `dbQuery` (`lib/db`).
- Produces (JSON): `{ enabled:false }` se OFF; altrimenti `{ enabled:true, weeks: [{ week_start, combined_prob, outcome, legs: [{label,sport,market,prob,status}] }] }` (ultime 8 settimane chiuse, DESC).

- [ ] **Step 1: Crea il file**

```ts
// /api/weekly-pick/history — #WEEKLY-PICK-1. Storico read-only delle multiple delle
// settimane CHIUSE (week_start < settimana corrente). Risolve ogni leg contro il
// settlement (unified_predictions.result) senza scritture né nuove tabelle. La
// settimana è chiusa → nessun leak sul presente: legs/market/prob/status visibili.
// Inerte se la feature è OFF.

import { NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";
import {
  currentWeekStart,
  weeklyPickEnabled,
  resolveWeeklyPickOutcomes,
  type PredOutcomeRow,
  type WeeklyPickLeg,
} from "@/lib/weekly-pick";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Row = { week_start: string; selections: unknown; combined_prob: string | number | null };

export async function GET() {
  if (!weeklyPickEnabled()) return NextResponse.json({ enabled: false });

  const week = currentWeekStart(new Date());
  const rows = await dbQuery<Row>(
    `SELECT week_start::text AS week_start, selections, combined_prob
       FROM weekly_pick
      WHERE week_start < $1
      ORDER BY week_start DESC
      LIMIT 8`,
    [week]
  );
  if (!rows.length) return NextResponse.json({ enabled: true, weeks: [] });

  const parsed = rows.map((r) => ({
    week_start: r.week_start,
    combined_prob: r.combined_prob != null ? Number(r.combined_prob) : null,
    sels: (typeof r.selections === "string"
      ? JSON.parse(r.selections)
      : (r.selections ?? [])) as WeeklyPickLeg[],
  }));

  // Un'unica query per tutti i predId di tutte le settimane.
  const predIds = [
    ...new Set(
      parsed.flatMap((p) => p.sels.map((s) => (s.id.startsWith("wp_") ? s.id.slice(3) : s.id)))
    ),
  ];
  const predRows = predIds.length
    ? await dbQuery<PredOutcomeRow>(
        `SELECT id::text AS id, status, result, starts_at::text AS starts_at
           FROM unified_predictions WHERE id::text = ANY($1)`,
        [predIds]
      )
    : [];

  const weeks = parsed.map((p) => {
    const { legs, outcome } = resolveWeeklyPickOutcomes(p.sels, predRows);
    return {
      week_start: p.week_start,
      combined_prob: p.combined_prob,
      outcome,
      legs: legs.map((l) => ({
        label: l.label,
        sport: l.sport,
        market: l.market,
        prob: l.prob,
        status: l.status,
      })),
    };
  });

  return NextResponse.json({ enabled: true, weeks });
}
```

- [ ] **Step 2: Verifica tipi + lint**

Run: `cd ~/Desktop/agentic-markets && npx tsc --noEmit && npm run lint`
Expected: nessun errore sul nuovo file.

- [ ] **Step 3: Commit**

```bash
git add app/api/weekly-pick/history/route.ts
git commit -m "feat(weekly-pick): endpoint storico read-only settimane chiuse (#WEEKLY-PICK-1)"
```

---

### Task 4: Riscrivere la pagina `/weekly-pick` in 4 sezioni

**Files:**
- Modify: `app/weekly-pick/page.tsx` (riscrittura completa)

**Interfaces:**
- Consumes: `GET /api/weekly-pick` (Task 2), `GET /api/weekly-pick/history` (Task 3).
- Produces: nessuna (foglia UI).

- [ ] **Step 1: Riscrivi il file**

Sostituisci l'intero contenuto di `app/weekly-pick/page.tsx`:

```tsx
"use client";
// /weekly-pick — #WEEKLY-PICK-1. Pagina strutturata della MULTIPLA DELLA CASA:
// hero + spiegazione, la multipla della settimana (stato live delle legs), come
// funziona, e lo storico delle settimane precedenti. Chi compra a metà settimana
// vede cosa ha già giocato e cosa manca. FTC-safe: nessuna quota, nessun edge.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type LegStatus = "upcoming" | "won" | "lost" | "void" | null;
type Sel = { label: string; sport: string; market: string | null; prob: number | null; status?: LegStatus; kickoff?: string | null };
type Data = {
  enabled: boolean;
  available?: boolean;
  unlocked?: boolean;
  included?: boolean;
  price_usd?: number;
  full_price_usd?: number;
  discounted?: boolean;
  combined_prob?: number | null;
  outcome?: "live" | "won" | "lost" | null;
  legs?: number;
  legs_remaining?: number;
  selections?: Sel[];
};
type HistLeg = { label: string; sport: string; market: string; prob: number; status: Exclude<LegStatus, null> };
type HistWeek = { week_start: string; combined_prob: number | null; outcome: "live" | "won" | "lost"; legs: HistLeg[] };
type Hist = { enabled: boolean; weeks?: HistWeek[] };

const COPY = {
  it: { back: "← Board", title: "Weekly Pick", sub: "La multipla della casa: le migliori pick della settimana combinate. Nessuna quota, nessun edge promesso — solo la schedina più probabile del nostro modello.", loading: "Caricamento…", loadError: "Impossibile caricare la weekly pick.", retry: "Riprova", soon: "La multipla di questa settimana è in arrivo.", combined: "Probabilità combinata (modello)", remaining: (n: number) => `${n} ancora da giocare`, lockedTitle: "Sblocca la Weekly Pick", unlockCta: (p: string) => `Sblocca a ${p}`, unlocking: "Reindirizzamento al pagamento…", checkoutError: "Impossibile avviare il pagamento. Riprova.", includedCta: "…oppure passa a Pro", responsible: "18+ · gioca responsabilmente", howTitle: "Come funziona", how1: "Le pick a più alta probabilità del modello, combinate in una sola schedina.", how2: "Una nuova multipla ogni lunedì; scade a fine settimana.", how3: "Inclusa nel Pro. Per gli altri, sblocco one-off.", histTitle: "Settimane precedenti", histEmpty: "Il primo storico arriva a fine settimana.", outLive: "In corso", outWon: "Passata", outLost: "Non passata", stUp: "Da giocare", stWon: "✓", stLost: "✗", stVoid: "Void", locale: "it-IT" },
  en: { back: "← Board", title: "Weekly Pick", sub: "The house accumulator: the best picks of the week combined. No odds, no promised edge — just our model's most probable slip.", loading: "Loading…", loadError: "Couldn't load the weekly pick.", retry: "Retry", soon: "This week's slip is on its way.", combined: "Combined probability (model)", remaining: (n: number) => `${n} still to play`, lockedTitle: "Unlock the Weekly Pick", unlockCta: (p: string) => `Unlock for ${p}`, unlocking: "Redirecting to payment…", checkoutError: "Couldn't start the payment. Please try again.", includedCta: "…or go Pro", responsible: "18+ · gamble responsibly", howTitle: "How it works", how1: "The model's highest-probability picks, combined into one slip.", how2: "A new accumulator every Monday; it expires at week's end.", how3: "Included in Pro. For everyone else, a one-off unlock.", histTitle: "Previous weeks", histEmpty: "The first history lands at the end of the week.", outLive: "Live", outWon: "Landed", outLost: "Didn't land", stUp: "To play", stWon: "✓", stLost: "✗", stVoid: "Void", locale: "en-GB" },
  es: { back: "← Board", title: "Weekly Pick", sub: "La combinada de la casa: las mejores picks de la semana combinadas. Sin cuotas, sin edge prometido — solo la combinada más probable de nuestro modelo.", loading: "Cargando…", loadError: "No se pudo cargar la weekly pick.", retry: "Reintentar", soon: "La combinada de esta semana está en camino.", combined: "Probabilidad combinada (modelo)", remaining: (n: number) => `${n} por jugarse`, lockedTitle: "Desbloquea la Weekly Pick", unlockCta: (p: string) => `Desbloquear por ${p}`, unlocking: "Redirigiendo al pago…", checkoutError: "No se pudo iniciar el pago. Inténtalo de nuevo.", includedCta: "…o hazte Pro", responsible: "18+ · juega con responsabilidad", howTitle: "Cómo funciona", how1: "Las picks de mayor probabilidad del modelo, combinadas en una sola.", how2: "Una nueva combinada cada lunes; caduca al final de la semana.", how3: "Incluida en Pro. Para el resto, desbloqueo único.", histTitle: "Semanas anteriores", histEmpty: "El primer historial llega al final de la semana.", outLive: "En curso", outWon: "Acertada", outLost: "No acertada", stUp: "Por jugar", stWon: "✓", stLost: "✗", stVoid: "Void", locale: "es-ES" },
  fr: { back: "← Board", title: "Weekly Pick", sub: "Le combiné de la maison : les meilleures prédictions de la semaine combinées. Aucune cote, aucun edge promis — juste le combiné le plus probable de notre modèle.", loading: "Chargement…", loadError: "Impossible de charger la weekly pick.", retry: "Réessayer", soon: "Le combiné de cette semaine arrive bientôt.", combined: "Probabilité combinée (modèle)", remaining: (n: number) => `${n} encore à jouer`, lockedTitle: "Débloquez la Weekly Pick", unlockCta: (p: string) => `Débloquer pour ${p}`, unlocking: "Redirection vers le paiement…", checkoutError: "Impossible de démarrer le paiement. Réessayez.", includedCta: "…ou passez à Pro", responsible: "18+ · jouez de manière responsable", howTitle: "Comment ça marche", how1: "Les prédictions les plus probables du modèle, combinées en un seul combiné.", how2: "Un nouveau combiné chaque lundi ; il expire en fin de semaine.", how3: "Inclus dans Pro. Pour les autres, un déblocage unique.", histTitle: "Semaines précédentes", histEmpty: "Le premier historique arrive en fin de semaine.", outLive: "En cours", outWon: "Gagné", outLost: "Perdu", stUp: "À jouer", stWon: "✓", stLost: "✗", stVoid: "Void", locale: "fr-FR" },
  ru: { back: "← Board", title: "Weekly Pick", sub: "Экспресс от команды: лучшие пики недели вместе. Без коэффициентов и обещанного edge — только самый вероятный экспресс нашей модели.", loading: "Загрузка…", loadError: "Не удалось загрузить weekly pick.", retry: "Повторить", soon: "Экспресс этой недели уже готовится.", combined: "Совокупная вероятность (модель)", remaining: (n: number) => `${n} ещё сыграют`, lockedTitle: "Откройте Weekly Pick", unlockCta: (p: string) => `Открыть за ${p}`, unlocking: "Переход к оплате…", checkoutError: "Не удалось начать оплату. Попробуйте снова.", includedCta: "…или оформите Pro", responsible: "18+ · играйте ответственно", howTitle: "Как это работает", how1: "Самые вероятные пики модели, собранные в один экспресс.", how2: "Новый экспресс каждый понедельник; истекает в конце недели.", how3: "Входит в Pro. Для остальных — разовая покупка.", histTitle: "Прошлые недели", histEmpty: "Первая история появится в конце недели.", outLive: "В игре", outWon: "Зашёл", outLost: "Не зашёл", stUp: "Сыграет", stWon: "✓", stLost: "✗", stVoid: "Void", locale: "ru-RU" },
} as const;

type Lang = keyof typeof COPY;

function statusChip(status: LegStatus, t: (typeof COPY)[Lang]) {
  if (status === "won") return { txt: t.stWon, color: "var(--am-coral)" };
  if (status === "lost") return { txt: t.stLost, color: "#ef4444" };
  if (status === "void") return { txt: t.stVoid, color: "var(--am-muted-2)" };
  return { txt: t.stUp, color: "var(--am-muted)" };
}

export default function WeeklyPickPage() {
  const [data, setData] = useState<Data | null>(null);
  const [hist, setHist] = useState<Hist | null>(null);
  const [error, setError] = useState(false);
  const [lang, setLang] = useState<Lang>("it");
  const [buying, setBuying] = useState(false);
  const [checkoutErr, setCheckoutErr] = useState(false);
  const t = COPY[lang];

  useEffect(() => {
    const stored = localStorage.getItem("agentic-lang");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-sync from localStorage
    if (stored && stored in COPY) setLang(stored as Lang);
  }, []);

  const fetchData = useCallback(() => {
    let alive = true;
    fetch("/api/weekly-pick", { credentials: "same-origin", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("wp"))))
      .then((d) => { if (alive) setData(d as Data); })
      .catch(() => { if (alive) setError(true); });
    fetch("/api/weekly-pick/history", { credentials: "same-origin", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("wph"))))
      .then((h) => { if (alive) setHist(h as Hist); })
      .catch(() => { if (alive) setHist({ enabled: false }); });
    return () => { alive = false; };
  }, []);

  useEffect(() => fetchData(), [fetchData]);
  const retry = () => { setError(false); setData(null); setHist(null); fetchData(); };

  const buy = useCallback(async () => {
    setCheckoutErr(false);
    setBuying(true);
    try {
      const r = await fetch("/api/weekly-pick/checkout", { method: "POST", credentials: "same-origin" });
      if (r.status === 401) { window.location.href = "/app?tab=account"; return; }
      const j = (await r.json().catch(() => null)) as { url?: string } | null;
      if (r.ok && j?.url) { window.location.href = j.url; return; }
      setCheckoutErr(true);
      setBuying(false);
    } catch {
      setCheckoutErr(true);
      setBuying(false);
    }
  }, []);

  const price = data?.price_usd != null ? `$${data.price_usd.toFixed(2)}` : "$12.99";
  const fullPrice = data?.full_price_usd != null ? `$${data.full_price_usd.toFixed(2)}` : null;
  const histWeeks = hist?.enabled ? (hist.weeks ?? []) : [];

  return (
    <main className="min-h-screen" style={{ background: "var(--am-bg)", color: "var(--am-text)" }}>
      <header className="px-6 py-4 border-b" style={{ borderColor: "var(--am-line)" }}>
        <Link href="/" className="text-xs font-mono" style={{ color: "var(--am-muted)" }}>{t.back}</Link>
        <h1 className="text-2xl font-black mt-1">{t.title}</h1>
        <p className="text-xs font-mono max-w-xl" style={{ color: "var(--am-muted)" }}>{t.sub}</p>
      </header>

      <section className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        {/* ── LA MULTIPLA ── */}
        <div className="space-y-4">
          {error && (
            <div className="text-center py-16 space-y-3">
              <p className="text-sm font-mono" style={{ color: "var(--am-muted)" }}>{t.loadError}</p>
              <button onClick={retry} className="text-xs font-mono px-4 py-2 rounded border" style={{ borderColor: "var(--am-coral-b)", color: "var(--am-coral)", background: "var(--am-coral-dim)" }}>{t.retry}</button>
            </div>
          )}
          {!error && data === null && (
            <p className="text-center text-xs font-mono py-16" style={{ color: "var(--am-muted-2)" }}>{t.loading}</p>
          )}
          {!error && data && (data.enabled === false || data.available === false) && (
            <p className="text-center text-sm font-mono py-16" style={{ color: "var(--am-muted-2)" }}>{t.soon}</p>
          )}
          {!error && data && data.available && (
            <article className="rounded-lg border p-5 space-y-3" style={{ borderColor: "var(--am-coral-b)", background: "var(--am-panel)" }}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono" style={{ color: "var(--am-muted)" }}>
                  {data.legs ?? data.selections?.length ?? 0} · {t.title}
                  {data.legs_remaining != null && data.legs_remaining > 0 && (
                    <span style={{ color: "var(--am-muted-2)" }}> · {t.remaining(data.legs_remaining)}</span>
                  )}
                </span>
                {data.unlocked && data.combined_prob != null && (
                  <span className="text-lg font-black font-mono" style={{ color: "var(--am-coral)" }}>{Math.round(data.combined_prob * 100)}%</span>
                )}
              </div>
              <div className="space-y-1.5">
                {data.selections?.map((s, i) => {
                  const chip = statusChip(s.status ?? null, t);
                  return (
                    <div key={i} className="flex items-center justify-between text-xs font-mono gap-3">
                      <div className="min-w-0">
                        <p className="truncate" style={{ color: "var(--am-text)" }}>{s.label}</p>
                        <p className="text-[10px] truncate" style={{ color: "var(--am-muted-2)" }}>{s.sport}</p>
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        {s.market != null ? (
                          <>
                            <span style={{ color: "var(--am-muted)" }}>{s.market}{s.prob != null && <span style={{ color: "var(--am-coral)" }}> · {Math.round(s.prob * 100)}%</span>}</span>
                            <span style={{ color: chip.color }}>{chip.txt}</span>
                          </>
                        ) : (
                          <span style={{ color: "var(--am-muted-2)" }}>🔒</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {data.unlocked ? (
                <p className="text-[10px] font-mono" style={{ color: "var(--am-muted-2)" }}>{t.combined}</p>
              ) : (
                <div className="border-t pt-3 space-y-2" style={{ borderColor: "var(--am-line)" }}>
                  <p className="text-sm font-bold">{t.lockedTitle}</p>
                  <div className="flex items-baseline gap-2">
                    {data.discounted && fullPrice && (
                      <span className="text-xs font-mono line-through" style={{ color: "var(--am-muted-2)" }}>{fullPrice}</span>
                    )}
                    <span className="text-lg font-black font-mono" style={{ color: "var(--am-coral)" }}>{price}</span>
                  </div>
                  <button
                    onClick={buy}
                    disabled={buying}
                    className="inline-block text-xs font-mono px-4 py-2 rounded"
                    style={{ background: "var(--am-coral)", color: "#fff", fontWeight: 700, opacity: buying ? 0.6 : 1, cursor: buying ? "default" : "pointer" }}
                  >
                    {buying ? t.unlocking : t.unlockCta(price)}
                  </button>
                  {checkoutErr && (
                    <p className="text-[10px] font-mono" style={{ color: "#ef4444" }}>{t.checkoutError}</p>
                  )}
                  <a href="/app?tab=plans" className="block text-[10px] font-mono underline" style={{ color: "var(--am-muted)" }}>{t.includedCta}</a>
                </div>
              )}
              <p className="text-[9px] font-mono" style={{ color: "var(--am-muted-2)" }}>{t.responsible}</p>
            </article>
          )}
        </div>

        {/* ── COME FUNZIONA ── */}
        <div className="space-y-2">
          <h2 className="text-sm font-black">{t.howTitle}</h2>
          <ol className="space-y-1.5">
            {[t.how1, t.how2, t.how3].map((step, i) => (
              <li key={i} className="flex gap-2 text-xs font-mono" style={{ color: "var(--am-muted)" }}>
                <span className="font-black" style={{ color: "var(--am-coral)" }}>{i + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* ── STORICO ── */}
        <div className="space-y-2">
          <h2 className="text-sm font-black">{t.histTitle}</h2>
          {histWeeks.length === 0 ? (
            <p className="text-xs font-mono py-4" style={{ color: "var(--am-muted-2)" }}>{t.histEmpty}</p>
          ) : (
            <div className="space-y-2">
              {histWeeks.map((w) => {
                const label = w.outcome === "won" ? t.outWon : w.outcome === "lost" ? t.outLost : t.outLive;
                const color = w.outcome === "won" ? "var(--am-coral)" : w.outcome === "lost" ? "#ef4444" : "var(--am-muted)";
                return (
                  <article key={w.week_start} className="rounded-lg border p-3 space-y-1.5" style={{ borderColor: "var(--am-line)", background: "var(--am-panel)" }}>
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span style={{ color: "var(--am-muted)" }}>{new Date(w.week_start).toLocaleDateString(t.locale, { day: "2-digit", month: "short" })}</span>
                      <span className="flex items-center gap-2">
                        {w.combined_prob != null && <span style={{ color: "var(--am-muted-2)" }}>{Math.round(w.combined_prob * 100)}%</span>}
                        <span className="font-bold" style={{ color }}>{label}</span>
                      </span>
                    </div>
                    <div className="space-y-1">
                      {w.legs.map((l, i) => {
                        const chip = statusChip(l.status, t);
                        return (
                          <div key={i} className="flex items-center justify-between text-[11px] font-mono gap-3">
                            <span className="truncate" style={{ color: "var(--am-muted)" }}>{l.label} · {l.market}</span>
                            <span style={{ color: chip.color }}>{chip.txt}</span>
                          </div>
                        );
                      })}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Verifica tipi + lint + build**

Run: `cd ~/Desktop/agentic-markets && npm run lint && npm run build`
Expected: build OK, nessun errore su `app/weekly-pick/page.tsx`.

- [ ] **Step 3: Verifica visiva locale**

Run: `cd ~/Desktop/agentic-markets && npm run dev` e apri `http://localhost:3000/weekly-pick`.
Expected (flag OFF): header + hero, card mostra "in arrivo" (`soon`), sezione "Come funziona" con 3 step, storico con empty-state. Nessun errore console. (Il contenuto multipla reale arriva solo dopo go-live.)

- [ ] **Step 4: Commit**

```bash
git add app/weekly-pick/page.tsx
git commit -m "feat(weekly-pick): pagina strutturata (hero+multipla live+come funziona+storico) (#WEEKLY-PICK-1)"
```

---

### Task 5: Entry point — glyph SVG + link nel rail Featured + benefit Pro nei Piani

**Files:**
- Modify: `app/components/sport-glyphs.tsx:72-73` (aggiungi symbol `g-ticket`)
- Modify: `app/app/page.tsx:8663-8675` (link nel gruppo Featured del rail)
- Modify: `app/app/page.tsx:3815-3821` (PlanFeature nella card Pro)

**Interfaces:**
- Consumes: la route `/weekly-pick` (Task 4). `Link` è già importato in `app/app/page.tsx`.
- Produces: nessuna.

- [ ] **Step 1: Aggiungi il glyph `g-ticket`**

In `app/components/sport-glyphs.tsx`, subito prima di `</defs>` (riga 73), aggiungi un simbolo "schedina/ticket":

```tsx
        <symbol id="g-ticket" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7.5A1.5 1.5 0 0 1 5.5 6h13A1.5 1.5 0 0 1 20 7.5v2a1.6 1.6 0 0 0 0 3v2A1.5 1.5 0 0 1 18.5 18h-13A1.5 1.5 0 0 1 4 16.5v-2a1.6 1.6 0 0 0 0-3Z" /><path d="M9 9.5h6M9 12.5h4" stroke="var(--am-coral)" /></g></symbol>
```

- [ ] **Step 2: Aggiungi il link nel rail Featured**

In `app/app/page.tsx`, nel gruppo "IN EVIDENZA", subito dopo il blocco `<a className="rail-item" href="/community">…</a>` (Creator Picks, ~riga 8674) e prima del `<button className="rail-refresh">`, aggiungi:

```tsx
              {/* #WEEKLY-PICK-1: Weekly Pick — la multipla della casa (route) */}
              <Link className="rail-item" href="/weekly-pick">
                <svg className="rail-ic" aria-hidden="true"><use href="#g-ticket" /></svg>
                <span className="rail-label">Weekly Pick</span>
              </Link>
```

- [ ] **Step 3: Aggiungi il benefit nella card Pro dei Piani**

In `app/app/page.tsx`, dentro `<ul className="plan-feature-list">` della card `is-premium` (~riga 3821), come ultima voce prima di `</ul>`, aggiungi:

```tsx
            <PlanFeature><Link href="/weekly-pick" style={{ textDecoration: "underline" }}>{pick5(lang, { it: "Weekly Pick inclusa (la multipla della casa)", en: "Weekly Pick included (the house accumulator)", es: "Weekly Pick incluida (la combinada de la casa)", fr: "Weekly Pick inclus (le combiné de la maison)", ru: "Weekly Pick включён (экспресс от команды)" })}</Link></PlanFeature>
```

- [ ] **Step 4: Verifica lint + build + visiva**

Run: `cd ~/Desktop/agentic-markets && npm run lint && npm run build`
Expected: build OK.
Poi `npm run dev`, apri `http://localhost:3000/app`: nel rail sinistro, gruppo "In evidenza", compare "Weekly Pick" con l'icona ticket e porta a `/weekly-pick`. Nella tab Piani, la card Pro elenca "Weekly Pick inclusa" con link. Verifica su desktop (il gruppo Featured è desktop-only).

- [ ] **Step 5: Commit**

```bash
git add app/components/sport-glyphs.tsx app/app/page.tsx
git commit -m "feat(weekly-pick): entry point rail Featured + benefit Pro nei Piani (#WEEKLY-PICK-1)"
```

---

### Task 6: Aggiornare la PROPOSAL go-live (documentazione, NESSUNA esecuzione)

**Files:**
- Modify: `ops/PROPOSAL-WEEKLY-PICK-1.md`

**Interfaces:** nessuna (documento per il gate).

- [ ] **Step 1: Aggiorna la change-spec go-live**

Aggiungi alla PROPOSAL una sezione "COSA CAMBIA (go-live, SOLO se approvato)" allineata allo stato reale post-UI:
- Apply `db/migrations/014_weekly_pick.sql` su DB prod (crea `weekly_pick`, `weekly_pick_orders`, `weekly_pick_purchases` + RPC). Reversibile: drop tabelle/RPC.
- Set `WEEKLY_PICK_ENABLED=true` su Vercel (env prod). Reversibile: rimetti a `false`.
- Aggiungi cron in `vercel.json`: `{ "path": "/api/weekly-pick/generate", "schedule": "0 6 * * 1" }` (lunedì 06:00 UTC). Serve `CRON_SECRET` (già presente).
- Verifica rail pagamenti PayGate per il checkout one-off €12.99 (checkout→callback→grant) in sandbox prima del GO.
- Accensione entry-point: già live (link sempre visibile, opzione scelta). Pre-go-live mostra "in arrivo"; post-go-live si popola col cron.
- Blast radius: DB + pagamenti. **APPROVE `ch_deploy_gate` (umano) + OK Michele sul prezzo obbligatori.**
- Piano di verifica: dopo il primo `generate` (o trigger manuale con `CRON_SECRET`), da loggato su prod la card mostra la multipla con stato live; acquisto one-off sblocca; storico popola dalla 2ª settimana.

- [ ] **Step 2: Commit**

```bash
git add ops/PROPOSAL-WEEKLY-PICK-1.md
git commit -m "docs(weekly-pick): change-spec go-live allineata (gate, no exec) (#WEEKLY-PICK-1)"
```

- [ ] **Step 3: NON eseguire il go-live**

Postare la PROPOSAL nel canale del gate e attendere `APPROVE #<id>` umano (Andrea/Michele) + OK Michele sul prezzo. Nessun apply migration / flag / cron prima dell'APPROVE.

---

## Self-Review

**Spec coverage:**
- Hero + spiegazione → Task 4 (sezione header + hero copy). ✓
- Card multipla con stato live legs → Task 1 (logica) + Task 2 (API) + Task 4 (render). ✓
- Come funziona → Task 4. ✓
- Storico → Task 1 + Task 3 (endpoint) + Task 4 (render). ✓
- Entry point rail Featured (SVG) + Pro → Task 5. ✓
- Link visibile subito → Task 5 (link incondizionato). ✓
- No leak lockati → Task 2 (Global Constraint enforced). ✓
- Confine gate (no migration/flag/cron/pagamenti) → Task 6 tiene il go-live come proposta. ✓
- No nuova tabella → Task 3 usa join read-time. ✓

**Placeholder scan:** nessun TBD/TODO; ogni step di codice contiene codice completo; copy 5 lingue completa.

**Type consistency:** `resolveWeeklyPickOutcomes`/`PredOutcomeRow`/`LegStatus`/`MultiplaOutcome`/`ResolvedLeg` definiti in Task 1 e usati coerentemente in Task 2/3; shape JSON di `/api/weekly-pick` (Task 2) e `/history` (Task 3) combaciano coi tipi `Data`/`Hist` della pagina (Task 4). `g-ticket` definito in Task 5 Step 1 e referenziato in Step 2.
