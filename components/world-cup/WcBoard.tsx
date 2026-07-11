"use client";

// World Cup slice of the main board, at parity with the home card. Consumes
// /api/v2/predictions — the route projects per-session server-side
// (lib/access-projection.ts), so this component renders exactly what the viewer
// is entitled to: anonymous gets the blurred lock + CTA, base/free-PotD gets the
// pick + why, premium additionally gets the Deep Analysis panel (form, venue,
// squad, lambdas, market). Zero new gate logic — every field arrives already
// projected; missing fields just don't render (fail-soft).
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { computeExtraMarkets, computeGoalsSummary } from "@/lib/poisson-model";
import { formPhrase, goalsPhrase, scorerPhrase, confidenceWord, type WhyLang } from "@/lib/why-text";
import { FORTUNEPLAY_BET_URL } from "@/lib/affiliate";
import { useBooksBlocked } from "@/lib/use-books-blocked";
import { SportIcon } from "@/app/components/sport-icon";
import { PredictionDetailModal, useDetailModal } from "@/components/PredictionDetailModal";
import { type GoalscorerMarket } from "@/lib/goalscorer-model";
// #WC-UNIFY-0702: stessa pipeline card/scheda del board principale (quote FortunePlay + MatchDetailSheet).
import { teamPairKey as fpPairKey } from "@/lib/team-pair-key";
import { fpEdge } from "@/lib/fortuneplay-live";
import { normName } from "@/lib/odds-api";
import type { FpOddsEntry } from "@/lib/fortuneplay-board";
import type { MdsData, MdsGroup, MdsChip } from "@/components/MatchDetailSheet";
// #BUNDLE-SLIM-0702: la scheda pesante si carica on-demand (all'apertura del modal).
const MatchDetailSheet = dynamic(() => import("@/components/MatchDetailSheet").then((m) => m.MatchDetailSheet));

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
  // Mercati soft (#SOFT-MARKETS): corners/cards/fouls — Pro-only (projection-gated).
  soft?: {
    corners?: { expected: number; main_line: number; p_over: number; is_generic: boolean };
    cards?: { expected: number; main_line: number; p_over: number; is_generic: boolean };
    fouls?: { expected: number; main_line: number; p_over: number; is_generic: boolean };
  } | null;
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

function DeepAnalysis({ e, home, away, lang }: { e: WcEnrichment; home: string; away: string; lang: WcLang }) {
  const it = lang === "it";
  const v = e.venue || {};
  const sq = e.squad || {};
  const injH = sq.injuries_home?.length ?? 0;
  const injA = sq.injuries_away?.length ?? 0;
  const hasTravel = typeof v.travel_km_home === "number" || typeof v.travel_km_away === "number";
  const hasRest = typeof v.rest_days_home === "number" || typeof v.rest_days_away === "number";
  const lh = e.lambdas?.home, la = e.lambdas?.away;
  const hasGoals = typeof lh === "number" && typeof la === "number" && lh > 0 && la > 0;
  const gsum = hasGoals ? computeGoalsSummary(lh!, la!) : null;
  const over25 = hasGoals ? computeExtraMarkets(lh!, la!).find((x) => x.key === "over_2_5") : null;
  const topScorer = (e.goalscorer_markets ?? []).slice().sort((a, b) => b.pScores - a.pScores)[0];

  return (
    <div className="deep-analysis-panel">
      <div className="da-header">
        <span className="da-badge">⚡ Pro</span>
        <span className="da-title">{it ? "Analisi approfondita" : "Deep Analysis"}</span>
      </div>
      {(typeof lh === "number" || typeof la === "number") && (
        <div className="da-row">
          <span className="da-label">{it ? "Gol attesi" : "Expected goals"}</span>
          <span className="da-value">{lh?.toFixed(2) ?? "–"} vs {la?.toFixed(2) ?? "–"}</span>
        </div>
      )}
      {gsum && (
        <div className="da-row">
          <span className="da-label">{it ? "Risultato probabile" : "Likely result"}</span>
          <span className="da-value">{gsum.band_low === gsum.band_high ? `${gsum.band_low}` : `${gsum.band_low}-${gsum.band_high}`} {it ? "gol" : "goals"} ({Math.round(gsum.band_p * 100)}%)</span>
        </div>
      )}
      {over25 && (
        <div className="da-row">
          <span className="da-label">Over 2.5</span>
          <span className="da-value">{Math.round(over25.p * 100)}%</span>
        </div>
      )}
      {(e.form_home || e.form_away) && (
        <div className="da-row">
          <span className="da-label">{it ? "Forma" : "Form"}</span>
          <span className="da-value">
            {home.split(" ")[0]} {fmtForm(e.form_home) ?? "–"} · {away.split(" ")[0]} {fmtForm(e.form_away) ?? "–"}
          </span>
        </div>
      )}
      {topScorer && (
        <div className="da-row">
          <span className="da-label">{it ? "Marcatore top" : "Top scorer"}</span>
          <span className="da-value">{topScorer.name} {Math.round(topScorer.pScores * 100)}%</span>
        </div>
      )}
      {hasTravel && (
        <div className="da-row">
          <span className="da-label">✈️ {it ? "Viaggio" : "Travel"}</span>
          <span className="da-value">
            {typeof v.travel_km_home === "number" ? `${v.travel_km_home}km` : "–"} vs{" "}
            {typeof v.travel_km_away === "number" ? `${v.travel_km_away}km` : "–"}
          </span>
        </div>
      )}
      {hasRest && (
        <div className="da-row">
          <span className="da-label">🛌 {it ? "Riposo" : "Rest"}</span>
          <span className="da-value">
            {typeof v.rest_days_home === "number" ? `${v.rest_days_home}${it ? "g" : "d"}` : "–"} vs{" "}
            {typeof v.rest_days_away === "number" ? `${v.rest_days_away}${it ? "g" : "d"}` : "–"}
          </span>
        </div>
      )}
      {v.host_advantage && (
        <div className="da-row">
          <span className="da-label">🏟️ {it ? "In casa" : "Host edge"}</span>
          <span className="da-value">{v.host_advantage}</span>
        </div>
      )}
      {(injH > 0 || injA > 0) && (
        <div className="da-row">
          <span className="da-label">🚑 {it ? "Infortuni" : "Injuries"}</span>
          <span className="da-value">H:{injH} · A:{injA}</span>
        </div>
      )}
      {e.market && typeof e.market.p_home === "number" && (
        <div className="da-row">
          <span className="da-label">💹 {it ? "Mercato" : "Market"}</span>
          <span className="da-value">
            H:{pct(e.market.p_home)} D:{pct(e.market.p_draw ?? 0)} A:{pct(e.market.p_away ?? 0)}
          </span>
        </div>
      )}
      {(typeof e.matches?.home === "number" || typeof e.matches?.away === "number") && (
        <div className="da-row">
          <span className="da-label">🗃️ {it ? "Campione" : "Sample"}</span>
          <span className="da-value">
            {e.matches?.home ?? "–"} vs {e.matches?.away ?? "–"} {it ? "partite" : "matches"}
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
  const hl: WhyLang = it ? "it" : "en"; // WC why resta it/en (convenzione esistente)
  const e = p.enrichment;
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const out: string[] = [];

  // ── 1. La chiamata ──
  if (probs) {
    const sides = [
      { v: probs.home, name: home, draw: false },
      { v: probs.draw, name: it ? "il pareggio" : "the draw", draw: true },
      { v: probs.away, name: away, draw: false },
    ];
    const top = sides.slice().sort((a, b) => b.v - a.v)[0];
    const tp = Math.round(top.v * 100);
    if (belowFloor || tp < 45) {
      out.push(it ? `Partita equilibrata, ${top.name} avanti di poco (${tp}%).` : `A tight match — ${top.name} edges it at ${tp}%.`);
    } else if (top.draw) {
      out.push(it ? `Il modello vede il pareggio come l'esito più probabile, al ${tp}%.` : `The model makes the draw the likeliest result, at ${tp}%.`);
    } else if (tp >= 65) {
      out.push(it ? `Il modello dà ${top.name} nettamente in vantaggio, al ${tp}%.` : `The model makes ${top.name} clear favourites, at ${tp}%.`);
    } else {
      out.push(it ? `Il modello dà ${top.name} in vantaggio al ${tp}%, ma resta una partita aperta.` : `The model favours ${top.name} at ${tp}%, but it stays an open game.`);
    }
  }

  // ── 2. Forma a parole ──
  const hf = formPhrase(e?.form_home ?? null, hl);
  const af = formPhrase(e?.form_away ?? null, hl);
  if (hf && af) {
    out.push(it ? `${home} è ${hf}, ${away} ${af}.` : `${home} is ${hf}, ${away} ${af}.`);
  }

  // ── 3. Storia gol (+ marcatore chiave) ──
  const lh = e?.lambdas?.home, la = e?.lambdas?.away;
  if (typeof lh === "number" && typeof la === "number" && lh > 0 && la > 0) {
    const gsum = computeGoalsSummary(lh, la);
    const ov = computeExtraMarkets(lh, la).find((x) => x.key === "over_2_5");
    let s = goalsPhrase(gsum.expected_goals, gsum.band_low, gsum.band_high, ov ? ov.p : null, hl);
    const topScorer = (e?.goalscorer_markets ?? []).slice().sort((a, b) => b.pScores - a.pScores)[0];
    if (topScorer && topScorer.pScores >= 0.15) {
      s += `; ${scorerPhrase(topScorer.name, topScorer.pScores, hl)}`;
    }
    out.push(cap(s) + ".");
  }

  // ── 4. Host + confidenza + onestà value (una frase) ──
  const mH = e?.matches?.home, mA = e?.matches?.away;
  const smallSample = (typeof mH === "number" && mH < 10) || (typeof mA === "number" && mA < 10);
  const tpStrong = probs ? Math.max(probs.home, probs.draw, probs.away) >= 0.65 : false;
  const conf = confidenceWord(tpStrong && !belowFloor, smallSample, hl);
  const host = e?.venue?.host_advantage ? (it ? `${e.venue.host_advantage} gioca in casa; ` : `${e.venue.host_advantage} plays at home; `) : "";
  let value: string;
  if (p.signal_type === "signal" && typeof p.edge_percent === "number" && p.edge_percent > 0) {
    value = it ? `c'è valore, il modello batte il mercato di +${p.edge_percent.toFixed(1)}%` : `there's value, the model beats the market by +${p.edge_percent.toFixed(1)}%`;
  } else {
    value = it ? `è la nostra prediction dal modello BetRedge` : `it's our BetRedge model prediction`;
  }
  out.push(`${host}${cap(conf)}: ${value}.`);

  return out.join(" ");
}

function WcCard({ p, fp, live }: { p: ProjectedRow; fp?: FpOddsEntry; live?: LiveScore | null }) {
  const [showWhy, setShowWhy] = useState(false);
  // #ITALIA-EU-PARERE: link-book visibili solo nelle geo dell'allowlist server-side.
  const booksBlocked = useBooksBlocked();
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
  // #WC-UNIFY-0702: quota live FortunePlay allineata al LATO della pick (per nome
  // normalizzato, non per posizione) + value del modello vs quota FP.
  const fpPickOdds: number | null = (() => {
    if (!fp || p.locked) return null;
    if (displayPick === "DRAW") return fp.oddsDraw;
    const k = normName(displayPick === "HOME" ? (p.home_team ?? "") : (p.away_team ?? ""));
    if (k && k === fp.homeKey) return fp.oddsHome;
    if (k && k === fp.awayKey) return fp.oddsAway;
    return null;
  })();
  const fpValue = pickProb != null ? fpEdge(pickProb, fpPickOdds ?? null) : null;
  const L2 = (it: string, en: string) => (lang === "it" ? it : en);

  // Stessa MdsData del board principale (calcio/tennis): esito 1X2 + gol O/U +
  // marcatori + soft, con quote FortunePlay e value. La scheda WC diventa identica.
  const mdsData: MdsData = (() => {
    const fpq = (key: "HOME" | "DRAW" | "AWAY"): number | null => {
      if (!fp) return null;
      if (key === "DRAW") return fp.oddsDraw;
      const k = normName(key === "HOME" ? (p.home_team ?? "") : (p.away_team ?? ""));
      if (k && k === fp.homeKey) return fp.oddsHome;
      if (k && k === fp.awayKey) return fp.oddsAway;
      return null;
    };
    const pv = (v: number | null) => (v != null && v > 0 ? `+${(v * 100).toFixed(0)}%` : null);
    const groups: MdsGroup[] = [];

    // Esito 1X2
    if (probs) {
      const esito: Array<{ key: "HOME" | "DRAW" | "AWAY"; sel: string; prob: number }> = [
        { key: "HOME", sel: home, prob: probs.home },
        { key: "DRAW", sel: L2("Pareggio", "Draw"), prob: probs.draw },
        { key: "AWAY", sel: away, prob: probs.away },
      ];
      groups.push({
        key: "esito", icon: "result", title: L2("Esito 1X2", "Match result"),
        src: { kind: fp ? "fp" : "est", label: fp ? "FortunePlay" : L2("solo modello", "model only") },
        chips: esito.map((o) => {
          const q = fpq(o.key);
          return { id: `esito-${o.key}`, mkt: "Esito 1X2", sel: o.sel, prob: pct(o.prob), q, value: q != null ? pv(fpEdge(o.prob, q)) : null, rec: displayPick === o.key };
        }),
      });
    }

    // Gol Over/Under (solo se FortunePlay quota i totali)
    if (fp && fp.totalLine != null && (fp.totalOver != null || fp.totalUnder != null)) {
      const line = fp.totalLine;
      const overKey = `over_${String(line).replace(".", "_")}`;
      const overP = overs.find((x) => x.key === overKey)?.p ?? null;
      const underP = overP != null ? 1 - overP : null;
      const overVal = fp.totalOver != null && overP != null ? fpEdge(overP, fp.totalOver) : null;
      const underVal = fp.totalUnder != null && underP != null ? fpEdge(underP, fp.totalUnder) : null;
      const recOver = overP != null && underP != null ? overP >= underP : (overVal ?? -1) > (underVal ?? -1);
      groups.push({
        key: "gol", icon: "goal", title: L2("Gol", "Goals"),
        meta: `${L2("linea", "line")} ${line}${goals ? ` · ${L2("attesi", "exp.")} ${goals.expected_goals.toFixed(1)}` : ""}`,
        src: { kind: "fp", label: "FortunePlay" },
        chips: [
          { id: "gol-over", mkt: `Gol O/U ${line}`, sel: `Over ${line}`, prob: overP != null ? pct(overP) : null, q: fp.totalOver, value: pv(overVal), rec: recOver },
          { id: "gol-under", mkt: `Gol O/U ${line}`, sel: `Under ${line}`, prob: underP != null ? pct(underP) : null, q: fp.totalUnder, value: pv(underVal), rec: !recOver },
        ],
      });
    }

    // Marcatore (goalscorer_markets, già deduplicati upstream #109) — top 4 per pScores.
    const gs = [...(e?.goalscorer_markets ?? [])].sort((a, b) => b.pScores - a.pScores).slice(0, 4);
    if (gs.length) {
      const topP = Math.max(...gs.map((x) => x.pScores));
      groups.push({
        key: "marcatore", icon: "boot", title: L2("Marcatore", "Goalscorer"),
        src: { kind: "us", label: L2("best · book US", "best · US book") },
        chips: gs.map((x, i) => ({ id: `gs-${i}`, mkt: L2("Marcatore", "Goalscorer"), sel: x.name, prob: pct(x.pScores), q: x.bestPrice, value: pv(x.edge), rec: x.pScores === topP && x.bestPrice != null })),
        note: L2("La nostra probabilità che ogni giocatore segni almeno un gol.", "Our probability that each player scores at least once."),
      });
    }

    // Soft: cartellini + falli come NOSTRE predizioni (solo modello reale, no is_generic).
    const sf = e?.soft;
    if (sf) {
      const chips: MdsChip[] = [];
      if (sf.cards && !sf.cards.is_generic) chips.push({ id: "soft-cards", mkt: L2("Cartellini", "Cards"), sel: `${L2("Cartellini", "Cards")} Over ${sf.cards.main_line}`, prob: pct(sf.cards.p_over) });
      if (sf.fouls && !sf.fouls.is_generic) chips.push({ id: "soft-fouls", mkt: L2("Falli", "Fouls"), sel: `${L2("Falli", "Fouls")} Over ${sf.fouls.main_line}`, prob: pct(sf.fouls.p_over) });
      if (chips.length) groups.push({
        key: "soft", icon: "flag", title: L2("Cartellini · Falli", "Cards · Fouls"),
        src: { kind: "est", label: L2("modello · Pro", "model · Pro") },
        chips,
        note: L2("Cartellini e falli: la nostra probabilità Over dal modello (Pro).", "Cards & fouls: our model's Over probability (Pro)."),
      });
    }

    return {
      league: p.league && p.league !== "World Cup" ? `World Cup · ${p.league}` : "World Cup",
      when: p.starts_at ? `${kickFmt.format(new Date(p.starts_at))} UTC` : "",
      home, away,
      extraMarkets: overs.length ? overs : undefined,
      hero: {
        flag: L2("La nostra prediction", "Our prediction"),
        pick: pickName ? (displayPick === "DRAW" ? pickName : `${pickName} ${L2("vince", "to win")}`) : L2("Lettura modello", "Model read"),
        read: `${pickProb != null ? pct(pickProb) + " " : ""}${L2("modello", "model")}${confLabel ? ` · ${L2("conf.", "conf.")} ${confLabel}` : ""}`,
        confDots,
        quotaLabel: L2("Quota FortunePlay", "FortunePlay odds"),
        quota: fpPickOdds != null ? fpPickOdds.toFixed(2) : null,
        value: fpValue != null && fpValue > 0 ? `value ${(fpValue * 100).toFixed(1)}%` : null,
      },
      groups,
      matchUrl: fp?.matchUrl || FORTUNEPLAY_BET_URL,
      fpMatchId: fp?.id ?? null,
      books: fp?.books?.map((b) => ({ name: b.name, matchUrl: b.matchUrl })),
      moreLabel: L2("Altri mercati FortunePlay", "More FortunePlay markets"),
      labels: {
        schedina: L2("La tua schedina", "Your betslip"),
        quotaComb: L2("quota combinata", "combined odds"),
        quotaOne: L2("quota", "odds"),
        touch: L2("tocca i mercati", "tap the markets"),
        apri: L2("Apri su FortunePlay", "Open on FortunePlay"),
        apriMulti: L2("Apri la multipla su FortunePlay", "Open the accumulator on FortunePlay"),
        openBook: L2("Apri su {book}", "Open on {book}"),
        disc: L2("Value indicativo del modello vs quota FortunePlay — non è garanzia di vincita. +18 · gioca responsabilmente.", "Indicative model value vs FortunePlay odds — not a guarantee of winning. 18+ · play responsibly."),
        side: L2("Schedina composta lato BetRedge → il bottone apre la partita su FortunePlay.", "Betslip composed on BetRedge → the button opens the match on FortunePlay."),
        selOne: L2("1 selezione", "1 selection"),
        selMany: L2("{n} selezioni", "{n} selections"),
      },
    };
  })();

  // Live / scheduled readout for the .scorebar (mirrors the football card).
  const scStatus = isLive ? "live" : isPaused ? "paused" : isFinished ? "finished" : null;
  const scLabel = isLive ? `LIVE${live?.minute != null ? ` ${live.minute}'` : ""}` : isPaused ? "HT" : isFinished ? "FT" : null;

  // Detail modal (stesso shell di calcio/tennis). Le card locked non lo aprono
  // (gate via overlay → /app); le card vere diventano una sintesi cliccabile.
  const modalEnabled = !p.locked;
  const { open: modalOpen, rect: modalRect, close: closeModal, cardProps } = useDetailModal(modalEnabled);
  const modalTitleId = `pdm-wc-${p.id}`;

  const headerNode = (
    <>
      {/* top: World Cup glyph + league/paper badge + when (live pulse) */}
      <div className="top">
        <div className="comp">
          <SportIcon sport="worldcup" size={15} className="sgi" variant="sm" />
          <span className="league">
            World Cup
            {p.league && p.league !== "World Cup" ? ` · ${p.league}` : ""}
            {/* #GOLIVE: nessun badge "paper" verso i clienti */}
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
    </>
  );

  // readout (mvm + conf/flat) — griglia + lead colonna sinistra modal
  const readoutNode = (
    <>
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
          {/* #CARD-REDESIGN-V2: readout allineato al main board (rimossi square Mercato/Edge). */}
          <div className="v2r">
            <div className="v2r-l">
              <span className="v2r-eye">{lang === "it" ? "Il nostro pronostico" : "Our prediction"}</span>
              <span className="v2r-pick">{pickName ?? (lang === "it" ? "Lettura modello" : "Model read")}</span>
              {confScore != null && (
                <span className="v2r-conf">{[0, 1, 2, 3].map((i) => <span key={i} className={`d${i < confDots ? " on" : ""}`} />)}{confLabel && <span className="v2r-conf-t">{confLabel}</span>}</span>
              )}
            </div>
            <div className="v2r-q">
              {fpPickOdds != null ? (
                <>
                  <span className="v2r-qlab">{lang === "it" ? "Quota FortunePlay" : "FortunePlay odds"}</span>
                  <span className="v2r-qn">{fpPickOdds.toFixed(2)}</span>
                  <span className="v2r-sub">{pickProb != null ? `${pct(pickProb)} ` : ""}{lang === "it" ? "modello" : "model"}{fpValue != null && fpValue > 0 ? <span className="v2r-val">value {(fpValue * 100).toFixed(1)}%</span> : null}</span>
                </>
              ) : (
                <>
                  <span className="v2r-qlab">{lang === "it" ? "probabilità modello" : "model probability"}</span>
                  <span className="v2r-qn">{pickProb != null ? pct(pickProb) : "–"}</span>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );

  // corpo completo (gol · marcatori · why · deep analysis) — solo nel modal
  // #WC-UNIFY-0702: gol/marcatori/soft ora vivono nella MatchDetailSheet; qui resta
  // solo l'analisi "Perché" + Deep Analysis (contenuto premium WC non presente sul board).
  const analysisNode = (
    <>
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
              {/* #PARTNER-REMOVE-0626: Place bet → link invito FortunePlay (singolo partner).
                  #ITALIA-EU-PARERE: solo nelle geo dell'allowlist (default nascosto). */}
              {!booksBlocked && (
                <a
                  className="betbtn"
                  href={FORTUNEPLAY_BET_URL}
                  target="_blank"
                  rel="nofollow sponsored noopener noreferrer"
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
                  <DeepAnalysis e={e} home={home} away={away} lang={lang} />
                ) : (
                  <div className="deep-analysis-locked">
                    <span>⚡</span>
                    <span>Deep analysis available with BetRedge Pro (29.99 USDT/month)</span>
                  </div>
                )}
              </div>
            )}
          </div>
    </>
  );

  // Locked → resta inline (overlay gate). Card vera → sintesi compatta + modal.
  if (!modalEnabled) {
    return (
      <article className="card"><div className="pred" {...cardProps}>
        {headerNode}
        {readoutNode}
      </div></article>
    );
  }

  return (
    <>
      <article className="card"><div className="pred is-clickable" {...cardProps}>
        {headerNode}
        {readoutNode}
        <div className="pred-more" aria-hidden="true">
          <span className="pm-lab">{lang === "it" ? "Apri scheda completa" : "Open full card"}</span>
          <span className="pm-chev" />
        </div>
      </div></article>
      <PredictionDetailModal
        open={modalOpen}
        onClose={closeModal}
        anchorRect={modalRect}
        titleId={modalTitleId}
        lang={lang}
        title={p.home_team && p.away_team ? <>{home} <span className="pdm-v">v</span> {away}</> : p.event_name}
        subtitle={<>World Cup{p.league && p.league !== "World Cup" ? ` · ${p.league}` : ""}</>}
        hideHead
        hideExtraMarkets
      >
        {/* #WC-UNIFY-0702: stessa scheda del board principale + analisi WC (Perché/Deep) sotto. */}
        <MatchDetailSheet data={mdsData} />
        <div className="pred">{analysisNode}</div>
      </PredictionDetailModal>
    </>
  );
}

export default function WcBoard() {
  const router = useRouter();
  const [rows, setRows] = useState<ProjectedRow[] | null>(null);
  // Live scores from the same feed the home board uses (/api/live covers the
  // ESPN fifa.friendly + football-data fixtures). Matched to cards by team-name
  // pair since the live feed is keyed by match_id, not the prediction id.
  const [liveMap, setLiveMap] = useState<Record<string, LiveScore>>({});
  // #WC-UNIFY-0702: quote live FortunePlay (stesso endpoint del board principale).
  const [fpOdds, setFpOdds] = useState<Record<string, FpOddsEntry>>({});

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/fortuneplay-odds", { credentials: "same-origin" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (alive && d) setFpOdds(d.odds ?? {}); })
        .catch(() => { /* fail-soft: card restano senza quota */ });
    load();
    const int = setInterval(load, 30_000);
    return () => { alive = false; clearInterval(int); };
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
        <WcCard key={p.id} p={p} fp={fpOdds[fpPairKey("soccer", p.home_team ?? "", p.away_team ?? "", p.starts_at ?? null) ?? ""]} live={liveMap[teamPairKey(p.home_team, p.away_team)] ?? null} />
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
        {/* Anonimo → apri il popup di iscrizione sul desk (stessa convenzione della
            chrome WC / SiteTopbar): /app?auth=register forza il login-wall sul tab
            "Registrati". Prima puntava a "/" (home) che NON apre nessun popup. */}
        <button onClick={() => router.push("/app?auth=register")}>Sign in / Choose plan</button>
      </div>
      <div className="locked-content">{grid}</div>
    </div>
  );
}
