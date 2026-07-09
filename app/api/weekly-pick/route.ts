// /api/weekly-pick — #WEEKLY-PICK-1. Serve la multipla della casa della settimana
// corrente, proiettata per sessione: Pro (inclusa) o acquirente one-off → sbloccata
// (market+prob); gli altri → teaser lockato (nomi match visibili, pick/prob nulli
// server-side, nessun leak) + prezzo. Inerte se la feature è OFF.

import { NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";
import { resolveAccessState } from "@/lib/auth";
import {
  currentWeekStart,
  weeklyPickEnabled,
  weeklyPickIncludedInPlan,
  weeklyPickAmount,
  resolveWeeklyPickOutcomes,
  weeklyBrief,
  type PredOutcomeRow,
  type WeeklyPickLeg,
} from "@/lib/weekly-pick";
import { hasWeeklyPick } from "@/lib/weekly-pick-server";
import { fetchWcGroups, type WcStandingRow } from "@/lib/world-cup";

export const dynamic = "force-dynamic";

type WpRow = { selections: unknown; combined_prob: string | number | null };
// Riga arricchita: PredOutcomeRow (per lo stato live) + i campi dettaglio della
// predizione (solo per le leg SBLOCCATE → costruiscono la scheda "perché").
type RichRow = PredOutcomeRow & {
  league: string | null;
  competition: string | null;
  world_cup_stage: string | null;
  neutral_venue: boolean | null;
  model_version: string | null;
  confidence_score: number | null;
  risk_level: string | null;
  explanation: string | null;
  notes: string | null;
  enrichment: unknown;
};

type FormRec = { last: string[]; w: number; d: number; l: number; gf: number; ga: number };
function parseForm(v: unknown): FormRec | null {
  if (!v || typeof v !== "object") return null;
  const f = v as Record<string, unknown>;
  const last = Array.isArray(f.last) ? f.last.filter((x): x is string => typeof x === "string").slice(-5) : [];
  const n = (k: string) => (typeof f[k] === "number" ? (f[k] as number) : 0);
  if (!last.length && !n("w") && !n("d") && !n("l")) return null;
  return { last, w: n("w"), d: n("d"), l: n("l"), gf: n("gf"), ga: n("ga") };
}

// Costruisce il payload dettaglio di una leg (FTC-safe: probabilità + gol attesi +
// forma + reasoning + contesto; MAI quote/edge). Sfrutta l'enrichment ricco del
// modello (lambdas = gol attesi, form_*, venue, squad).
function buildLegDetail(r: RichRow) {
  let probs: { home: number; draw: number | null; away: number | null } | null = null;
  try {
    const n = r.notes ? JSON.parse(r.notes) : null;
    if (n && typeof n.p_home === "number") {
      probs = {
        home: n.p_home,
        draw: typeof n.p_draw === "number" ? n.p_draw : null,
        away: typeof n.p_away === "number" ? n.p_away : null,
      };
    }
  } catch { /* notes malformati → probs null */ }
  const e = (r.enrichment && typeof r.enrichment === "object") ? (r.enrichment as Record<string, unknown>) : {};
  const squad = (e.squad && typeof e.squad === "object") ? (e.squad as Record<string, unknown>) : {};
  const venue = (e.venue && typeof e.venue === "object") ? (e.venue as Record<string, unknown>) : {};
  const lambdas = (e.lambdas && typeof e.lambdas === "object") ? (e.lambdas as Record<string, unknown>) : {};
  const matches = (e.matches && typeof e.matches === "object") ? (e.matches as Record<string, unknown>) : {};
  const strArr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 3) : []);
  const numOrNull = (v: unknown) => (typeof v === "number" ? v : null);
  const xgH = numOrNull(lambdas.home);
  const xgA = numOrNull(lambdas.away);
  return {
    competition: r.competition || r.league || null,
    stage: r.world_cup_stage ?? null,
    neutral: r.neutral_venue === true,
    probs,
    confidence: r.confidence_score ?? null,
    risk: r.risk_level ?? null,
    why: r.explanation ?? null,
    xg: (xgH != null || xgA != null) ? { home: xgH, away: xgA } : null,
    form: { home: parseForm(e.form_home), away: parseForm(e.form_away) },
    injuries: { home: strArr(squad.injuries_home), away: strArr(squad.injuries_away) },
    rotation: { home: squad.rotation_flag_home === true, away: squad.rotation_flag_away === true },
    venue: {
      heat: venue.heat_risk === true,
      indoor: venue.indoor === true,
      altitude: numOrNull(venue.altitude_m),
      tzHome: numOrNull(venue.tz_shift_home),
      tzAway: numOrNull(venue.tz_shift_away),
      travelHome: numOrNull(venue.travel_km_home),
      travelAway: numOrNull(venue.travel_km_away),
    },
    model: r.model_version ?? null,
    sample: { home: numOrNull(matches.home), away: numOrNull(matches.away) },
    // #WEEKLY-PICK-2: campi enrichment finora raccolti ma mai mostrati. Tutti
    // fail-soft (assente → null/omesso, mai inventato).
    restDays: { home: numOrNull(venue.rest_days_home), away: numOrNull(venue.rest_days_away) },
    hostAdvantage: typeof venue.host_advantage === "string" ? venue.host_advantage : null,
    squadStrength: { home: numOrNull(squad.xi_value_ratio_home), away: numOrNull(squad.xi_value_ratio_away) },
    lineups: extractLineups(e.lineups),
    group: typeof e.group === "string" ? e.group : null,
  };
}

// Formazioni confermate (ESPN, ~1h pre-match). La forma esatta di enrichment.lineups
// non è garantita: gestiamo sia { home:{xi:[...]}, away:{...} } sia { home:[...] }.
// Fail-soft: forma inattesa → null (nessuna riga formazione, niente inventato).
function extractLineups(v: unknown): { home?: string[]; away?: string[] } | null {
  if (!v || typeof v !== "object") return null;
  const lu = v as Record<string, unknown>;
  const side = (raw: unknown): string[] | undefined => {
    const arr = Array.isArray(raw)
      ? raw
      : raw && typeof raw === "object" && Array.isArray((raw as Record<string, unknown>).xi)
        ? ((raw as Record<string, unknown>).xi as unknown[])
        : null;
    if (!arr) return undefined;
    const names = arr
      .map((x) => (typeof x === "string" ? x : x && typeof x === "object" ? String((x as Record<string, unknown>).name ?? "") : ""))
      .filter((s) => s.length > 0)
      .slice(0, 11);
    return names.length ? names : undefined;
  };
  const home = side(lu.home);
  const away = side(lu.away);
  return home || away ? { home, away } : null;
}

export async function GET(req: Request) {
  if (!weeklyPickEnabled()) return NextResponse.json({ enabled: false });

  const { ctx, state } = await resolveAccessState(req);
  const week = currentWeekStart(new Date());

  const rows = await dbQuery<WpRow>(
    `SELECT selections, combined_prob FROM weekly_pick WHERE week_start = $1 LIMIT 1`,
    [week]
  );
  const row = rows[0];
  if (!row) return NextResponse.json({ enabled: true, week, available: false });

  const sels: WeeklyPickLeg[] = typeof row.selections === "string" ? JSON.parse(row.selections) : ((row.selections as WeeklyPickLeg[]) ?? []);
  const included = weeklyPickIncludedInPlan(state);
  const purchased = ctx ? await hasWeeklyPick(ctx.identifier, week) : false;
  const unlocked = included || purchased;

  // Stato live: risolve ogni leg contro il settlement della sua predizione, così
  // chi compra a metà settimana vede cosa ha già giocato e cosa manca.
  const predIds = sels.map((s) => (s.id.startsWith("wp_") ? s.id.slice(3) : s.id));
  const predRows = predIds.length
    ? await dbQuery<RichRow>(
        `SELECT id::text AS id, status, result, starts_at::text AS starts_at,
                league, competition, world_cup_stage, neutral_venue, model_version,
                confidence_score, risk_level, explanation, notes, enrichment
           FROM unified_predictions WHERE id::text = ANY($1)`,
        [predIds]
      )
    : [];
  const richById = new Map(predRows.map((r) => [r.id, r]));
  const { legs: resolvedLegs, outcome, remaining } = resolveWeeklyPickOutcomes(sels, predRows);

  // Prezzo effettivo (sconto -50% se lancio attivo) deciso server-side; il full
  // serve alla UI per il barrato. price_usd = ciò che l'utente paga davvero.
  const { amount, fullAmount, discounted } = weeklyPickAmount();

  // #WEEKLY-PICK-2: classifica World Cup (fonte ESPN, cache) per posizionare le
  // nazionali di una leg WC. Fetch UNA volta per request, solo se serve e sbloccato.
  // Solo gironi avviati (played > 0): pre-torneo la tabella è tutta a zero e direbbe
  // nulla. Match per nome normalizzato, fail-soft: non trovato → nessuna riga.
  const isWcLeg = (sport: string | null | undefined) => /world|wc/i.test(sport ?? "");
  const needsWc = unlocked && sels.some((s) => isWcLeg(s.sport));
  const wcGroups = needsWc ? await fetchWcGroups().catch(() => []) : [];
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
  const findStanding = (team: string): WcStandingRow | null => {
    const n = norm(team);
    if (!n) return null;
    for (const g of wcGroups) {
      for (const row of g.teams) {
        const rn = norm(row.team);
        if (!rn || row.played <= 0) continue; // solo gironi avviati
        if (rn === n || rn.includes(n) || n.includes(rn)) return row;
      }
    }
    return null;
  };
  const splitLabel = (label: string) => {
    const p = label.split(/\s+vs\s+/i);
    return { home: p[0] ?? label, away: p[1] ?? "" };
  };

  const confidences: number[] = [];
  // Locked projection: nomi match come teaser; pick/prob/status/kickoff/detail
  // nascosti (no leak). Solo le leg SBLOCCATE portano id + detail (scheda "perché").
  const selectionsOut = resolvedLegs.map((s) => {
    const predId = s.id.startsWith("wp_") ? s.id.slice(3) : s.id;
    const rich = richById.get(predId);
    const detail = unlocked && rich ? buildLegDetail(rich) : null;
    if (detail?.confidence != null) confidences.push(detail.confidence);
    let detailOut: (typeof detail & { standing?: { home: WcStandingRow | null; away: WcStandingRow | null } }) | null = detail;
    if (detail && needsWc && isWcLeg(s.sport)) {
      const { home, away } = splitLabel(s.label);
      detailOut = { ...detail, standing: { home: findStanding(home), away: findStanding(away) } };
    }
    return {
      label: s.label,
      sport: s.sport,
      market: unlocked ? s.market : null,
      prob: unlocked ? s.prob : null,
      status: unlocked ? s.status : null,
      kickoff: unlocked ? s.kickoff : null,
      id: unlocked ? predId : null,
      detail: detailOut,
    };
  });

  // Aggregati safe (non rivelano pick/prob) → mostrati anche al teaser lockato.
  const sports: Record<string, number> = {};
  for (const s of sels) {
    const k = String(s.sport ?? "other");
    sports[k] = (sports[k] ?? 0) + 1;
  }
  const brief = weeklyBrief(
    selectionsOut.map((s) => ({ label: s.label, sport: s.sport, market: s.market, prob: s.prob })),
    unlocked && row.combined_prob != null ? Number(row.combined_prob) : null,
    confidences
  );

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
    brief,
    sports,
    selections: selectionsOut,
  });
}
