"use client";

// World Cup slice of the main board, at parity with the home card. Consumes
// /api/v2/predictions — the route projects per-session server-side
// (lib/access-projection.ts), so this component renders exactly what the viewer
// is entitled to: anonymous gets the blurred lock + CTA, base/free-PotD gets the
// pick + why, premium additionally gets the Deep Analysis panel (form, venue,
// squad, lambdas, market). Zero new gate logic — every field arrives already
// projected; missing fields just don't render (fail-soft).
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { computeExtraMarkets, computeGoalsSummary } from "@/lib/poisson-model";
import { PlaceBetMenu } from "@/components/PlaceBetMenu";
import { SportIcon } from "@/app/components/sport-icon";
import GoalscorerBlock from "@/components/GoalscorerBlock";
import { type GoalscorerMarket } from "@/lib/goalscorer-model";

type WcEnrichment = {
  kind?: string;
  form_home?: { w: number; d: number; l: number; gf: number; ga: number; last?: string[]; played?: number } | null;
  form_away?: { w: number; d: number; l: number; gf: number; ga: number; last?: string[]; played?: number } | null;
  venue?: {
    travel_km_home?: number | null; travel_km_away?: number | null;
    rest_days_home?: number | null; rest_days_away?: number | null;
    tz_shift_home?: number | null; tz_shift_away?: number | null;
    host_advantage?: string | null;
  } | null;
  squad?: {
    injuries_home?: string[]; injuries_away?: string[];
    revealed_home?: boolean; revealed_away?: boolean;
  } | null;
  lambdas?: { home?: number | null; away?: number | null } | null;
  matches?: { home?: number | null; away?: number | null } | null;
  market?: { p_home?: number; p_draw?: number; p_away?: number } | null;
  group?: string | null;
  model?: string | null;
  goalscorer_markets?: GoalscorerMarket[] | null; // premium-only (projection-gated)
};

type ProjectedRow = {
  id: string;
  event_name?: string | null;
  home_team?: string | null;
  away_team?: string | null;
  league?: string | null;
  starts_at?: string | null;
  locked: boolean;
  pick?: string | null;
  market?: string | null;
  confidence_score?: number | null;
  is_paper?: boolean;
  signal_type?: string | null;
  edge_percent?: number | null;    // paid-tier; real only for promoted signal rows
  explanation?: string | null;
  notes?: string | null;           // JSON: { p_home, p_draw, p_away, odds_home?, odds_draw?, odds_away? }
  enrichment?: WcEnrichment | null; // premium-only (projection-gated)
  // Real affiliate target attached by withAffiliate on unlocked rows.
  affiliate?: { url: string; bookmaker?: string; bonus?: string } | null;
};

const kickFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC",
});

type WcProbs = {
  home: number; draw: number; away: number;
  odds_home: number | null; odds_draw: number | null; odds_away: number | null;
};

function parseProbs(notes?: string | null): WcProbs | null {
  if (!notes) return null;
  try {
    const n = JSON.parse(notes);
    if (typeof n.p_home === "number" && typeof n.p_draw === "number" && typeof n.p_away === "number") {
      return {
        home: n.p_home, draw: n.p_draw, away: n.p_away,
        // Real 3-way market odds only present on rows with a matched market.
        odds_home: typeof n.odds_home === "number" ? n.odds_home : null,
        odds_draw: typeof n.odds_draw === "number" ? n.odds_draw : null,
        odds_away: typeof n.odds_away === "number" ? n.odds_away : null,
      };
    }
  } catch {
    /* fail-soft */
  }
  return null;
}

// Confidence-surfacing gate (Wave 1). The national path stores the flag inside
// `notes` (JSON) — same contract as the Python writer: surface.below_floor=true
// means no clear favourite, so the card drops the pick direction/edge but keeps
// the probabilities and the why. Probability-neutral, fail-soft.
function parseSurfaceBelowFloor(notes?: string | null): boolean {
  if (!notes) return false;
  try {
    const n = JSON.parse(notes);
    return n?.surface?.below_floor === true;
  } catch {
    return false;
  }
}

// WcBoard is mounted outside page.tsx's LanguageCtx, so it can't use useT().
// It reads the same `agentic-lang` key the rest of the app persists and resolves
// the two surface-gate strings locally — never hardcode English (5-lang parity
// with the TRANSLATIONS dictionary in app/page.tsx).
type WcLang = "it" | "en" | "es" | "fr" | "ru";
function resolveWcLang(): WcLang {
  if (typeof window === "undefined") return "it";
  const stored = window.localStorage.getItem("agentic-lang");
  return stored === "en" || stored === "es" || stored === "fr" || stored === "ru" ? stored : "it";
}

// Reactive language. resolveWcLang() at render time alone is not enough: the
// component is SSR'd with the "it" fallback and, without a state change, React
// keeps the server markup after hydration — so the stored language never gets
// applied (this was the #wc-i18n bug: /world-cup stuck in Italian in EN mode).
// Reading it in an effect forces a post-mount re-render; the events let a
// language switch (here or on the home topbar) update the board live.
function useWcLang(): WcLang {
  const [lang, setLang] = useState<WcLang>("it");
  useEffect(() => {
    const sync = () => setLang(resolveWcLang());
    sync();
    window.addEventListener("agentic-lang-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("agentic-lang-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return lang;
}

// Display-only canonicalization: some prediction rows carry a non-canonical
// spelling (unified_predictions has "Congo DR" while the dataset canonical is
// "DR Congo"), which made the board disagree with the deduped squads tab.
// Canonicalize at render — zero settlement risk, no DB write. The durable fix
// is normalizing the prediction pipeline at the source (flagged separately).
const WC_TEAM_CANON: Record<string, string> = {
  "congo dr": "DR Congo",
  "cabo verde": "Cape Verde",
};
const canonTeam = (name?: string | null) =>
  name ? WC_TEAM_CANON[name.trim().toLowerCase()] ?? name : name ?? "";

const pct = (v: number) => `${Math.round(v * 100)}%`;
// Mirror of the football card's confidenceFromEdge (app/app/page.tsx) so the
// World Cup confidence meter matches the home board exactly. `edge` is the
// FRACTIONAL edge (e.g. 0.032), not a percentage.
function wcConfidenceFromEdge(edge: number | null, probability: number) {
  const edgeScore = Math.min(45, Math.max(0, (edge ?? 0) * 700));
  const probScore = Math.min(35, Math.max(0, (probability - 0.35) * 100));
  return Math.round(Math.min(95, 20 + edgeScore + probScore));
}
const fmtForm = (f?: { w: number; d: number; l: number } | null) =>
  f ? `${f.w}W-${f.d}D-${f.l}L` : null;

function DeepAnalysis({ e, home, away }: { e: WcEnrichment; home: string; away: string }) {
  const v = e.venue || {};
  const sq = e.squad || {};
  const injH = sq.injuries_home?.length ?? 0;
  const injA = sq.injuries_away?.length ?? 0;
  const hasTravel =
    typeof v.travel_km_home === "number" || typeof v.travel_km_away === "number";
  const hasRest =
    typeof v.rest_days_home === "number" || typeof v.rest_days_away === "number";

  return (
    <div className="deep-analysis-panel">
      <div className="da-header">
        <span className="da-badge">⚡ Pro</span>
        <span className="da-title">Deep Analysis</span>
      </div>
      {(e.form_home || e.form_away) && (
        <div className="da-row">
          <span className="da-label">📈 Form</span>
          <span className="da-value">
            {home.split(" ")[0]} {fmtForm(e.form_home) ?? "–"} · {away.split(" ")[0]} {fmtForm(e.form_away) ?? "–"}
          </span>
        </div>
      )}
      {(typeof e.lambdas?.home === "number" || typeof e.lambdas?.away === "number") && (
        <div className="da-row">
          <span className="da-label">Goal rate</span>
          <span className="da-value">
            {e.lambdas?.home?.toFixed(2) ?? "–"} vs {e.lambdas?.away?.toFixed(2) ?? "–"}
          </span>
        </div>
      )}
      {hasTravel && (
        <div className="da-row">
          <span className="da-label">✈️ Travel</span>
          <span className="da-value">
            {typeof v.travel_km_home === "number" ? `${v.travel_km_home}km` : "–"} vs{" "}
            {typeof v.travel_km_away === "number" ? `${v.travel_km_away}km` : "–"}
          </span>
        </div>
      )}
      {hasRest && (
        <div className="da-row">
          <span className="da-label">🛌 Rest</span>
          <span className="da-value">
            {typeof v.rest_days_home === "number" ? `${v.rest_days_home}d` : "–"} vs{" "}
            {typeof v.rest_days_away === "number" ? `${v.rest_days_away}d` : "–"}
          </span>
        </div>
      )}
      {v.host_advantage && (
        <div className="da-row">
          <span className="da-label">🏟️ Host edge</span>
          <span className="da-value">{v.host_advantage}</span>
        </div>
      )}
      {(injH > 0 || injA > 0) && (
        <div className="da-row">
          <span className="da-label">🚑 Injuries</span>
          <span className="da-value">H:{injH} · A:{injA}</span>
        </div>
      )}
      {e.market && typeof e.market.p_home === "number" && (
        <div className="da-row">
          <span className="da-label">💹 Market</span>
          <span className="da-value">
            H:{pct(e.market.p_home)} D:{pct(e.market.p_draw ?? 0)} A:{pct(e.market.p_away ?? 0)}
          </span>
        </div>
      )}
      {(typeof e.matches?.home === "number" || typeof e.matches?.away === "number") && (
        <div className="da-row">
          <span className="da-label">🗃️ Sample</span>
          <span className="da-value">
            {e.matches?.home ?? "–"} vs {e.matches?.away ?? "–"} matches
          </span>
        </div>
      )}
    </div>
  );
}

// Live football score shape from /api/live (same as the home board).
type LiveScore = {
  home_score: number | null; away_score: number | null;
  match_status: string; minute: number | null;
  home_team?: string; away_team?: string;
};
function normTeam(s?: string | null) {
  return (s ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}
function teamPairKey(a?: string | null, b?: string | null) {
  // Canonicalize before normalizing: the live feed (ESPN displayName, e.g.
  // "Cape Verde") and prediction rows ("Cabo Verde") spell some teams
  // differently, so raw names never matched and the LIVE band stayed hidden.
  return [normTeam(canonTeam(a)), normTeam(canonTeam(b))].sort().join("|");
}

const WC_WHY_LABELS: Record<WcLang, { show: string; hide: string; model: string }> = {
  it: { show: "▼ perché", hide: "▲ meno", model: "Modello calibrato" },
  en: { show: "▼ why", hide: "▲ less", model: "Calibrated model" },
  es: { show: "▼ por qué", hide: "▲ menos", model: "Modelo calibrado" },
  fr: { show: "▼ pourquoi", hide: "▲ moins", model: "Modèle calibré" },
  ru: { show: "▼ почему", hide: "▲ меньше", model: "Калиброванная модель" },
};

function fmtFormCount(f?: { w: number; d: number; l: number } | null, it?: boolean) {
  return f ? (it ? `${f.w}V-${f.d}P-${f.l}S` : `${f.w}W-${f.d}D-${f.l}L`) : null;
}

// Human "why" paragraph in the active language, mirroring the home board's
// buildFootballWhy: favourite + why (form / host) + honest value note + sample.
// No codes, no λ/jargon, no "?". it = Italian, others fall back to English.
function buildWcWhy(p: ProjectedRow, probs: WcProbs | null, home: string, away: string, belowFloor: boolean, lang: WcLang): string {
  const it = lang === "it";
  const e = p.enrichment;
  const out: string[] = [];

  if (probs) {
    const sides = [
      { v: probs.home, name: home, draw: false },
      { v: probs.draw, name: it ? "il pareggio" : "the draw", draw: true },
      { v: probs.away, name: away, draw: false },
    ];
    const top = sides.slice().sort((a, b) => b.v - a.v)[0];
    const tp = Math.round(top.v * 100);
    if (belowFloor || tp < 45) {
      out.push(it ? `Partita equilibrata: nessun favorito netto, ${top.name} avanti solo di poco (${tp}%).` : `A tight match with no clear favourite — ${top.name} edges it at just ${tp}%.`);
    } else if (top.draw) {
      out.push(it ? `Il modello vede il pareggio come l'esito più probabile, al ${tp}%.` : `The model makes the draw the likeliest result, at ${tp}%.`);
    } else if (tp >= 65) {
      out.push(it ? `Il modello dà ${top.name} nettamente in vantaggio, al ${tp}%.` : `The model makes ${top.name} clear favourites, at ${tp}%.`);
    } else {
      out.push(it ? `Il modello dà ${top.name} in vantaggio al ${tp}%, ma resta una partita aperta.` : `The model favours ${top.name} at ${tp}%, but it stays an open game.`);
    }
  }

  const fh = fmtFormCount(e?.form_home, it), fa = fmtFormCount(e?.form_away, it);
  if (fh && fa) {
    out.push(it ? `Forma recente: ${home} ${fh}, ${away} ${fa}.` : `Recent form: ${home} ${fh}, ${away} ${fa}.`);
  }

  if (e?.venue?.host_advantage) {
    out.push(it ? `${e.venue.host_advantage} gioca in casa, un vantaggio in più.` : `${e.venue.host_advantage} plays at home, an added edge.`);
  }

  if (p.signal_type === "signal" && typeof p.edge_percent === "number" && p.edge_percent > 0) {
    out.push(it ? `C'è valore: il modello batte la quota di mercato di +${p.edge_percent.toFixed(1)}%.` : `There's value here: the model beats the market price by +${p.edge_percent.toFixed(1)}%.`);
  } else {
    out.push(it ? `Non c'è una quota di mercato consolidata per questo match, quindi non dichiariamo nessun edge: è la lettura del modello, non una value bet.` : `There's no settled market price for this match, so we're not claiming an edge — it's the model's read, not a value bet.`);
  }

  const mH = e?.matches?.home, mA = e?.matches?.away;
  if (typeof mH === "number" && typeof mA === "number") {
    const low = mH < 10 || mA < 10;
    out.push(it ? `Stima basata su ${mH} contro ${mA} partite internazionali${low ? " — campione limitato, più incertezza." : ", un campione solido."}` : `Built on ${mH} vs ${mA} internationals${low ? " — a small sample, so more uncertainty." : ", a solid sample."}`);
  }

  return out.join(" ");
}

function WcCard({ p, live, betLinksEnabled = false }: { p: ProjectedRow; live?: LiveScore | null; betLinksEnabled?: boolean }) {
  const [showWhy, setShowWhy] = useState(false);
  const home = canonTeam(p.home_team) || "Home";
  const away = canonTeam(p.away_team) || "Away";
  const probs = parseProbs(p.notes);
  // Surfacing gate: below the confidence floor there is no clear favourite, so
  // the card shows the probabilities + why but no pick direction and no edge.
  const belowFloor = parseSurfaceBelowFloor(p.notes);
  const pick = belowFloor ? null : (p.pick || null);
  // Unified card structure (Andrea, 2026-06-20): every card uses the readout,
  // never the bars — even with no clear favourite. There we show the model's
  // most-probable outcome as "Modello", with NO edge claimed (FTC-honest).
  const topOutcome: "HOME" | "DRAW" | "AWAY" | null = probs
    ? (probs.home >= probs.draw && probs.home >= probs.away ? "HOME"
       : probs.draw >= probs.away ? "DRAW" : "AWAY")
    : null;
  const displayPick = pick ?? topOutcome;
  const lang = useWcLang();
  const whyL = WC_WHY_LABELS[lang];
  const model = whyL.model;
  // Live football score (same treatment as the home board's card).
  const isLive = live?.match_status === "IN_PLAY";
  const isPaused = live?.match_status === "PAUSED";
  const isFinished = live?.match_status === "FINISHED";
  const hasScore = !!live && (live.home_score != null || live.away_score != null);
  // #WC-LIVE-1: the live feed is matched by an unordered team pair (teamPairKey
  // sorts the names), so its home/away orientation may differ from this card.
  // Re-orient the score to the card before rendering, else it shows reversed.
  const liveSwapped = !!live?.home_team && normTeam(canonTeam(live.home_team)) !== normTeam(canonTeam(p.home_team));
  const liveHomeScore = live ? (liveSwapped ? live.away_score : live.home_score) : null;
  const liveAwayScore = live ? (liveSwapped ? live.home_score : live.away_score) : null;
  const e = p.enrichment;

  // ── Standard readout (mirror of the football PredictionCard) ──────────────
  // Market-implied %, model %, value edge, confidence and goal markets, all
  // from data already on the row. Shown only in the clear-pick branch below.
  const pickProb =
    displayPick === "HOME" ? probs?.home
    : displayPick === "AWAY" ? probs?.away
    : displayPick === "DRAW" ? probs?.draw
    : null;
  const pickName =
    displayPick === "HOME" ? home
    : displayPick === "AWAY" ? away
    : displayPick === "DRAW" ? (lang === "it" ? "Pareggio" : "Draw")
    : null;
  // Market % from the REAL bookmaker odds (Pinnacle) in notes — 1/odds, raw
  // implied, same as the football card. `enrichment.market` is empty/null on WC
  // rows, so we derive the market from probs.odds_* (parseProbs reads odds_* from
  // notes). Falls back to null only when the match genuinely has no odds.
  const pickOdds =
    displayPick === "HOME" ? probs?.odds_home
    : displayPick === "AWAY" ? probs?.odds_away
    : displayPick === "DRAW" ? probs?.odds_draw
    : null;
  const marketImplied = pickOdds && pickOdds > 0 ? 1 / pickOdds : null;
  // Value edge only with a real market price AND a clear favourite — never on a
  // below-floor "no clear favourite" card (no value claimed). p.edge_percent is
  // already a percentage (e.g. 3.2).
  const edgeVal =
    !belowFloor && p.signal_type === "signal" && typeof p.edge_percent === "number" && p.edge_percent > 0
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

  // Live / scheduled readout for the .scorebar (mirrors the football card).
  const scStatus = isLive ? "live" : isPaused ? "paused" : isFinished ? "finished" : null;
  const scLabel = isLive ? `LIVE${live?.minute != null ? ` ${live.minute}'` : ""}` : isPaused ? "HT" : isFinished ? "FT" : null;

  return (
    <article className="card"><div className="pred">
      {/* top: World Cup glyph + league/paper badge + when (live pulse) */}
      <div className="top">
        <div className="comp">
          <SportIcon sport="worldcup" size={15} className="sgi" variant="sm" />
          <span className="league">
            World Cup
            {p.league && p.league !== "World Cup" ? ` · ${p.league}` : ""}
            {p.is_paper ? " · paper" : ""}
          </span>
        </div>
        {isLive ? (
          <span className="when live"><span className="pulse" />{lang === "it" ? "live" : "live"}</span>
        ) : (
          <span className="when">{p.starts_at ? `${kickFmt.format(new Date(p.starts_at))} UTC` : ""}</span>
        )}
      </div>

      {/* fixture + scorebar */}
      <div className="fx">
        <div className="teams">
          {p.home_team && p.away_team
            ? (<>{home}<span className="vs">v</span>{away}</>)
            : p.event_name}
        </div>
        {hasScore && live ? (
          <div className="scorebar">
            <span className={`stt${scStatus === "live" ? " live" : ""}`}>{scLabel}</span>
            <span className="sc">{liveHomeScore ?? 0}<span className="x">–</span>{liveAwayScore ?? 0}</span>
            <span className="grow" />
          </div>
        ) : (
          <div className="scorebar">
            <span className="stt">{lang === "it" ? "Programmato" : "Scheduled"}</span>
            <span className="sc sched">{p.starts_at ? `${kickFmt.format(new Date(p.starts_at))} UTC` : ""}</span>
          </div>
        )}
      </div>

      {/* outcome rows / gate overlay */}
      {p.locked ? (
        <Link href="/app" className="lock-overlay wc-lock" role="button">
          <span className="blurred">▒▒ HOME ▒▒▒%</span>
          <span className="blurred">▒▒ DRAW ▒▒▒%</span>
          <span className="blurred">▒▒ AWAY ▒▒▒%</span>
          <span className="locked-cta">Sign in to reveal pick &amp; confidence</span>
        </Link>
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
              {belowFloor
                ? (lang === "it" ? "nessun favorito netto · lettura del modello" : "no clear favourite · model read")
                : marketImplied != null
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
          {e?.goalscorer_markets && e.goalscorer_markets.length > 0 && (
            <GoalscorerBlock markets={e.goalscorer_markets} homeTeam={home} awayTeam={away} lang={lang} />
          )}

          {/* WHY — #CARD-STD-1: same structure as the football card —
              static .wlab label + .dl readout (Form/Sample) + .act footer
              (toggle · place bet · model · Pro) + expandable .why-body. */}
          <div className="why">
            <div className="wlab"><span className="tri">▸</span> {lang === "it" ? "Perché" : "Why"}</div>
            <dl>
              {(e?.form_home || e?.form_away) && (
                <div className="it"><dt>{lang === "it" ? "Forma" : "Form"}</dt><dd>{fmtFormCount(e?.form_home, lang === "it") ?? "–"} <span className="vs">vs</span> {fmtFormCount(e?.form_away, lang === "it") ?? "–"}</dd></div>
              )}
              {e?.matches && (e.matches.home != null || e.matches.away != null) && (
                <div className="it"><dt>{lang === "it" ? "Campione" : "Sample"}</dt><dd>{e.matches.home ?? "–"} <span className="vs">vs</span> {e.matches.away ?? "–"}</dd></div>
              )}
            </dl>

            {/* footer action row — mirrors the football .act */}
            <div className="act">
              <button type="button" className="open" onClick={() => setShowWhy((v) => !v)}>
                {showWhy ? (lang === "it" ? "Nascondi" : "Hide") : (lang === "it" ? "Mostra" : "Show")} <span className="ar">→</span>
              </button>
              {/* Place Bet — same affiliate dropdown as the football/tennis cards
                  (PlaceBetMenu) when the geo-gate is on; otherwise the Partners
                  deep-link fallback. Never a fake/direct target without the menu. */}
              {betLinksEnabled ? (
                <PlaceBetMenu
                  buttonClassName="betbtn"
                  label={isLive ? (lang === "it" ? "Live — Piazza" : "Live — Place bet") : (lang === "it" ? "Piazza scommessa" : "Place bet")}
                  disclaimer={lang === "it" ? "18+ · Gioca responsabilmente · *Link affiliato — potremmo ricevere una commissione, senza costi per te." : "18+ · Play responsibly · *Affiliate link — we may earn a commission at no cost to you."}
                  selection={{
                    sport: "worldcup",
                    league: p.league || "WC",
                    homeTeam: home,
                    awayTeam: away,
                    market: "1X2",
                    pick: pick === "HOME" ? home : pick === "AWAY" ? away : pick === "DRAW" ? "Draw" : "",
                    odds: null,
                    eventStartUtc: p.starts_at || undefined,
                  }}
                />
              ) : (
                <a
                  className="betbtn"
                  href={p.affiliate?.url || "/app?tab=partners"}
                  {...(p.affiliate?.url
                    ? { target: "_blank", rel: "nofollow sponsored noopener" }
                    : {})}
                >
                  {isLive ? (lang === "it" ? "Live — Piazza" : "Live — Place bet") : (lang === "it" ? "Piazza scommessa" : "Place bet")}
                </a>
              )}
              <span className="model">{model}</span>
              <span className="gate">Pro</span>
            </div>

            {/* expandable analysis body — paragraph + Deep Analysis (premium) */}
            {showWhy && (
              <div className="why-body">
                <p className="why-prose">{buildWcWhy(p, probs, home, away, belowFloor, lang)}</p>
                {e ? (
                  <DeepAnalysis e={e} home={home} away={away} />
                ) : (
                  <div className="deep-analysis-locked">
                    <span>⚡</span>
                    <span>Deep analysis available with Signal Desk Pro (49.90 USDT/month)</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div></article>
  );
}

export default function WcBoard() {
  const router = useRouter();
  const [rows, setRows] = useState<ProjectedRow[] | null>(null);
  // Live scores from the same feed the home board uses (/api/live covers the
  // ESPN fifa.friendly + football-data fixtures). Matched to cards by team-name
  // pair since the live feed is keyed by match_id, not the prediction id.
  const [liveMap, setLiveMap] = useState<Record<string, LiveScore>>({});
  // Affiliate dropdown geo-gate (server-side). Same flag the home board reads;
  // off → cards fall back to the Partners deep-link. Fail-soft on error.
  const [betLinksEnabled, setBetLinksEnabled] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch("/api/bet-links")
      .then((r) => r.json())
      .then((j: { enabled?: boolean }) => { if (alive) setBetLinksEnabled(Boolean(j.enabled)); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    fetch("/api/v2/predictions?competition=World Cup&sport=football", {
      credentials: "same-origin",
    })
      .then((r) => r.json())
      .then((d) => { if (alive) setRows(d.predictions || []); })
      .catch(() => { if (alive) setRows([]); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/live", { credentials: "same-origin" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!alive || !d?.live) return;
          const map: Record<string, LiveScore> = {};
          for (const s of Object.values(d.live as Record<string, LiveScore>)) {
            if (s?.home_team && s?.away_team) map[teamPairKey(s.home_team, s.away_team)] = s;
          }
          setLiveMap(map);
        })
        .catch(() => { /* fail-soft: no live band */ });
    load();
    const int = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(int); };
  }, []);

  if (rows === null) return <div className="book-empty">Loading World Cup board…</div>;
  if (!rows.length) {
    return (
      <div className="book-empty">
        First World Cup signals publish when markets open — kickoff June 11.
      </div>
    );
  }

  const grid = (
    <div className="wc-board-grid">
      {rows.map((p) => (
        <WcCard key={p.id} p={p} live={liveMap[teamPairKey(p.home_team, p.away_team)] ?? null} betLinksEnabled={betLinksEnabled} />
      ))}
    </div>
  );

  // Whole-board access wall: when every row is locked the viewer has no access
  // (anonymous, or free without the Pick of the Day). Mirror the home board's
  // LockedGate — blur the grid behind a single overlay. The per-card data is
  // already stripped server-side; this hides the matchups too. The WC hub
  // (groups/calendar/squads/track-record) stays public around this board.
  const viewerLocked = rows.every((r) => r.locked);
  if (!viewerLocked) return grid;

  return (
    <div className="locked-gate">
      <div className="locked-overlay">
        <p className="eyebrow">World Cup board locked</p>
        <h3>Sign in to see the World Cup predictions</h3>
        <span>Picks, probabilities and edge stay hidden until you sign in and activate a plan.</span>
        <button onClick={() => router.push("/")}>Sign in / Choose plan</button>
      </div>
      <div className="locked-content">{grid}</div>
    </div>
  );
}
