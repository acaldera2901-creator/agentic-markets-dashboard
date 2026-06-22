import { NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";
import { UnifiedPrediction } from "@/lib/unified-adapter";
import { resolveAccessState } from "@/lib/auth";
import { projectPrediction } from "@/lib/access-projection";
import { withAffiliate } from "@/lib/affiliate";
import { PREDICTION_WINDOW_DAYS } from "@/lib/prediction-window";
import { fetchGoalscorerByMatch } from "@/lib/goalscorer-fetch";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { state } = await resolveAccessState(req); // never denies (read)

  const { searchParams } = new URL(req.url);
  const sport       = searchParams.get("sport");
  const competition = searchParams.get("competition");
  const status      = searchParams.get("status");

  // Demo rows must never reach the public board (defensive, AM-CODE-REVIEW-001 #4).
  // Rolling publication window (#019): serve only the next N days — closer
  // matches carry more information; distant ones come into view day by day.
  const conditions: string[] = [
    // #LIVE-1: le card restano servite durante il match (150 min ≈ 90' +
    // recuperi + margine) e spariscono quando il settlement le sposta in
    // history — stessa finestra del board principale.
    "starts_at > NOW() - interval '150 minutes'",
    "starts_at < NOW() + ($1 || ' days')::interval",
    "expires_at > NOW() - interval '150 minutes'",
    "published_at IS NOT NULL",
    "is_historical = FALSE",
    "is_demo = FALSE",
  ];
  const values: unknown[] = [PREDICTION_WINDOW_DAYS];

  if (sport && sport !== "all") {
    values.push(sport);
    conditions.push(`sport = $${values.length}`);
  }
  if (competition && competition !== "all") {
    values.push(`%${competition}%`);
    conditions.push(`competition ILIKE $${values.length}`);
  }
  if (status && status !== "all") {
    values.push(status);
    conditions.push(`status = $${values.length}`);
  }

  const rows = await dbQuery<UnifiedPrediction>(
    `SELECT * FROM unified_predictions
     WHERE ${conditions.join(" AND ")}
     ORDER BY
       competition = 'World Cup' DESC,
       starts_at ASC
     LIMIT 100`,
    values
  );

  // Friendly / WC paper rows store the 1X2 distribution in `notes` (JSON), not
  // in the p_home/p_draw/p_away columns (which stay null). Without this coalesce
  // a consumer reading the p_* columns gets null → the board's "leader"
  // computation falls through to AWAY while the row's `pick` says HOME, so the
  // shown favourite flickers (e.g. Kosovo↔Andorra). /api/predictions already
  // parses notes (unifiedToPredictionRow); mirror it here so both boards agree.
  for (const r of rows as unknown as Array<{ p_home: number | null; p_draw: number | null; p_away: number | null; notes: string | null }>) {
    if (r.p_home == null && r.notes) {
      try {
        const n = JSON.parse(r.notes);
        if (typeof n?.p_home === "number") {
          r.p_home = n.p_home;
          r.p_draw = typeof n.p_draw === "number" ? n.p_draw : null;
          r.p_away = typeof n.p_away === "number" ? n.p_away : null;
        }
      } catch {
        // malformed notes → leave columns null (fail-soft, never fabricate)
      }
    }
  }

  // #WC-DEDUP-1: due pipeline scrivono in unified_predictions (es. WC: la
  // completa `football-worldcup-v2-elo` con prob+odds e una stub senza
  // distribuzione 1X2). Tieni solo le righe con una probabilità usabile (dopo
  // il coalesce dai notes) e collassa i doppioni dello stesso fixture,
  // preferendo quella che porta un pick. Nessun numero inventato: i match
  // senza riga completa spariscono (opzione A, niente card vuote).
  const served: Array<Record<string, unknown>> = [];
  {
    const dedup = new Map<string, Record<string, unknown>>();
    for (const r of rows as unknown as Array<Record<string, unknown>>) {
      if (typeof r.p_home !== "number") continue; // incompleta → nascosta
      const key = [
        String(r.sport ?? ""),
        String(r.home_team ?? "").trim().toLowerCase(),
        String(r.away_team ?? "").trim().toLowerCase(),
        String(r.starts_at ?? "").slice(0, 10),
      ].join("|");
      const cur = dedup.get(key);
      if (!cur || (r.pick && !cur.pick)) dedup.set(key, r);
    }
    served.push(...dedup.values());
  }

  // #PLAYER-GOALSCORER (scheda WC): mercati marcatore dalle λ-nazionale gia` sulla
  // riga (enrichment.lambdas) + player_profiles eleggibili, attaccati a
  // `enrichment` PRIMA della proiezione. Siccome `enrichment` e` PREMIUM_ONLY
  // (lib/access-projection), i mercati ereditano lo stesso gating premium del
  // resto del deep-enrichment. Fail-soft: mappa vuota quando i dati player non
  // sono live -> le card restano identiche.
  {
    const gsPreds = served.map((r) => {
      const enr = r.enrichment as { lambdas?: { home?: number | null; away?: number | null } } | null | undefined;
      return {
        matchId: String(r.id),
        homeTeam: String(r.home_team ?? ""),
        awayTeam: String(r.away_team ?? ""),
        lambdaHome: typeof enr?.lambdas?.home === "number" ? enr.lambdas.home : null,
        lambdaAway: typeof enr?.lambdas?.away === "number" ? enr.lambdas.away : null,
      };
    });
    const gsByMatch = await fetchGoalscorerByMatch(gsPreds);
    if (gsByMatch.size > 0) {
      for (const r of served) {
        const gs = gsByMatch.get(String(r.id));
        if (gs && gs.length > 0) {
          const enr =
            r.enrichment && typeof r.enrichment === "object"
              ? (r.enrichment as Record<string, unknown>)
              : {};
          enr.goalscorer_markets = gs;
          r.enrichment = enr;
        }
      }
    }
  }

  // Vetrina settimanale (#PLANS-3TIER-1): rank per edge desc DENTRO ogni sport.
  // free sblocca rank<1, base rank<5, premium tutto (showcaseAllowance).
  const rankById = new Map<string, number>();
  const bySport = new Map<string, Array<Record<string, unknown>>>();
  for (const row of served) {
    const sp = String(row.sport ?? "other");
    if (!bySport.has(sp)) bySport.set(sp, []);
    bySport.get(sp)!.push(row);
  }
  for (const list of bySport.values()) {
    list
      .map((r) => ({
        id: String(r.id),
        edge: typeof r.edge_percent === "number" ? r.edge_percent
            : typeof r.edge === "number" ? r.edge : -Infinity,
        conf: typeof r.confidence_score === "number" ? r.confidence_score : 0,
      }))
      .sort((a, b) => b.edge - a.edge || b.conf - a.conf)
      .forEach((r, i) => rankById.set(r.id, i));
  }
  const predictions = served.map((row) => {
    const rank = rankById.get((row as { id: string }).id) ?? Infinity;
    const projected = projectPrediction(row as unknown as Record<string, unknown>, state, rank);
    return projected.locked ? projected : withAffiliate(projected);
  });

  // Access bug fix (2026-06-06): this route projects per-session
  // (lib/access-projection.ts), so the body differs for anonymous vs
  // logged-in viewers. A shared `public, s-maxage` header let Vercel's CDN
  // cache one viewer's projection (e.g. an unlocked logged-in response) under
  // the URL key and serve it to everyone — a logged-in user could see the
  // anonymous blurred board, or worse, an anonymous user could see unlocked
  // picks. Only the anonymous projection is identical across requests and safe
  // to share-cache; any session gets `private, no-store`.
  const cacheControl =
    state === "anonymous"
      ? "public, s-maxage=120, stale-while-revalidate=60"
      : "private, no-store";

  return NextResponse.json(
    {
      predictions,
      meta: {
        source: "database",
        generated_at: new Date().toISOString(),
        count: predictions.length,
      },
    },
    { headers: { "Cache-Control": cacheControl, Vary: "Cookie" } }
  );
}
