// /api/match-builder — #MB-2 Creator Picks.
//
// POST: pubblica una schedina costruita col Match Builder (solo loggati).
//       Lo snapshot delle selezioni viene validato e salvato com'è: la pagina
//       /community mostra ciò che il creator ha pubblicato, non ricomputa.
// GET:  ultime schedine pubblicate, proiettate per sessione — gli anonimi
//       vedono i match ma NON pick/probabilità (stessa regola del board:
//       i pick sono il prodotto, il lock è la CTA).

import { NextResponse } from "next/server";
import { dbQuery, dbExecute } from "@/lib/db";
import { resolveAccessState } from "@/lib/auth";

export const dynamic = "force-dynamic";

const CODE_RE = /^[A-Z0-9_-]{2,20}$/;
const MAX_SELECTIONS = 5;
const MIN_SELECTIONS = 2;
// #CREATOR-GATE-0626: Creator Picks è a livelli — Base vede le prime N schedine,
// il resto bloccato; Pro tutte; Free/anon nessuna (solo upsell). Tunable.
const BASE_SLIP_ALLOWANCE = 3;

type SlipSelection = {
  id: string;
  label: string;
  market: string;
  sport: string;
  when: string;
  prob: number;
};

function sanitizeSelections(raw: unknown): SlipSelection[] | null {
  if (!Array.isArray(raw) || raw.length < MIN_SELECTIONS || raw.length > MAX_SELECTIONS) return null;
  const out: SlipSelection[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) return null;
    const e = entry as Record<string, unknown>;
    const id = typeof e.id === "string" ? e.id.slice(0, 80) : "";
    const label = typeof e.label === "string" ? e.label.slice(0, 120) : "";
    const market = typeof e.market === "string" ? e.market.slice(0, 80) : "";
    const sport = typeof e.sport === "string" ? e.sport.slice(0, 80) : "";
    const when = typeof e.when === "string" ? e.when.slice(0, 40) : "";
    const prob = typeof e.prob === "number" && Number.isFinite(e.prob) ? e.prob : NaN;
    if (!id || !label || !market || !(prob > 0 && prob <= 1)) return null;
    out.push({ id, label, market, sport, when, prob });
  }
  return out;
}

export async function POST(req: Request) {
  const { ctx, state } = await resolveAccessState(req);
  if (state === "anonymous" || !ctx) {
    return NextResponse.json({ error: "login required" }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  if (!CODE_RE.test(code)) return NextResponse.json({ error: "invalid creator code" }, { status: 400 });
  const mb = typeof body.mb === "string" ? body.mb.slice(0, 500) : "";
  if (!mb) return NextResponse.json({ error: "missing mb param" }, { status: 400 });
  const selections = sanitizeSelections(body.selections);
  if (!selections) return NextResponse.json({ error: "invalid selections (2-5 required)" }, { status: 400 });

  const combined = selections.reduce((acc, s) => acc * s.prob, 1);
  // Anti-flood: max 10 schedine/ora per profilo — un creator normale ne fa 2-3.
  const recent = await dbQuery<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM community_slips
     WHERE creator_identifier = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
    [ctx.identifier]
  );
  if ((recent[0]?.n ?? 0) >= 10) {
    return NextResponse.json({ error: "rate limit: too many slips this hour" }, { status: 429 });
  }
  try {
    await dbExecute(
      `INSERT INTO community_slips (creator_code, creator_identifier, mb_param, selections, combined_prob)
       VALUES ($1, $2, $3, $4, $5)`,
      [code, ctx.identifier, mb, JSON.stringify(selections), combined.toFixed(4)]
    );
  } catch (e) {
    console.error("[match-builder] publish failed:", String(e));
    return NextResponse.json({ error: "publish failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function GET(req: Request) {
  const { state } = await resolveAccessState(req);
  // #CREATOR-GATE-0626: tiered reveal by plan. Pro → all unlocked; Base → first
  // BASE_SLIP_ALLOWANCE unlocked, rest locked; Free/anon → none (all locked +
  // upsell). Locked slips null out pick/prob server-side (no leak); the matchup
  // labels stay as a teaser. `access` drives the page's upsell/CTA copy.
  const allowance =
    state === "premium" || state === "admin_full" ? Infinity
    : state === "base" ? BASE_SLIP_ALLOWANCE
    : 0;
  const access: "none" | "partial" | "full" =
    state === "premium" || state === "admin_full" ? "full"
    : state === "base" ? "partial"
    : "none";
  const rows = await dbQuery<{
    id: string;
    creator_code: string;
    mb_param: string;
    selections: SlipSelection[] | string;
    combined_prob: string | number | null;
    created_at: string;
  }>(
    `SELECT id, creator_code, mb_param, selections, combined_prob, created_at
     FROM community_slips
     ORDER BY created_at DESC
     LIMIT 30`
  );
  const slips = rows.map((r, i) => {
    const sels: SlipSelection[] =
      typeof r.selections === "string" ? JSON.parse(r.selections) : (r.selections ?? []);
    const slipLocked = i >= allowance;
    return {
      id: r.id,
      creator_code: r.creator_code,
      mb_param: r.mb_param,
      created_at: r.created_at,
      locked: slipLocked,
      combined_prob: slipLocked ? null : (r.combined_prob != null ? Number(r.combined_prob) : null),
      // Locked projection: match names visible (teaser), pick/prob hidden.
      selections: sels.map((s) => ({
        label: s.label,
        sport: s.sport,
        when: s.when,
        market: slipLocked ? null : s.market,
        prob: slipLocked ? null : s.prob,
      })),
    };
  });
  return NextResponse.json({ access, slips });
}
