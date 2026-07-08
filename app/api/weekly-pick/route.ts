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
  type PredOutcomeRow,
  type WeeklyPickLeg,
} from "@/lib/weekly-pick";
import { hasWeeklyPick } from "@/lib/weekly-pick-server";

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
  };
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
    // Locked projection: nomi match come teaser; pick/prob/status/kickoff/detail
    // nascosti (no leak). Solo le leg SBLOCCATE portano id + detail (scheda "perché").
    selections: resolvedLegs.map((s) => {
      const predId = s.id.startsWith("wp_") ? s.id.slice(3) : s.id;
      const rich = richById.get(predId);
      return {
        label: s.label,
        sport: s.sport,
        market: unlocked ? s.market : null,
        prob: unlocked ? s.prob : null,
        status: unlocked ? s.status : null,
        kickoff: unlocked ? s.kickoff : null,
        id: unlocked ? predId : null,
        detail: unlocked && rich ? buildLegDetail(rich) : null,
      };
    }),
  });
}
