"use client";

import { useEffect, useState, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Summary {
  total_bets: number;
  won: number;
  lost: number;
  pending: number;
  pnl: number;
  win_rate: string;
  avg_odds: string;
  avg_stake: string;
}

interface Bet {
  id: number;
  match_external_id: string;
  selection: string;
  odds: number;
  stake: number;
  paper: boolean;
  status: string;
  profit_loss: number | null;
  betfair_bet_id?: string | null;
  placed_at: string;
  thesis?: string;
  home_team?: string;
  away_team?: string;
  league?: string;
  league_name?: string;
  kickoff?: string;
  enrichment?: PredictionEnrichment | null;
}

interface LeaguePnl {
  league: string;
  total: number;
  won: number;
  lost: number;
  pnl: number;
}

interface PredictionEnrichment {
  pi_home?: number;
  pi_away?: number;
  xg_home?: number;
  xga_home?: number;
  xg_away?: number;
  xga_away?: number;
  npxg_home?: number;
  npxg_away?: number;
  form_home?: string;
  form_away?: string;
  injuries_home?: string[];
  injuries_away?: string[];
  weather?: { temp: number; wind: number; condition: string; rain: number; icon: string } | null;
  api_pct_home?: number;
  api_pct_draw?: number;
  api_pct_away?: number;
  api_advice?: string;
  research?: string;
}

interface Prediction {
  id: number;
  match_id: string;
  league: string;
  league_name: string;
  home_team: string;
  away_team: string;
  kickoff: string;
  p_home: number;
  p_draw: number;
  p_away: number;
  lambda_home: number | null;
  lambda_away: number | null;
  odds_home: number | null;
  odds_draw: number | null;
  odds_away: number | null;
  edge: number | null;
  best_selection: string | null;
  model_matches: number | null;
  computed_at: string;
  match_type?: string | null;
  enrichment?: PredictionEnrichment | null;
}

interface AgentStatus {
  name: string;
  status: "alive" | "stale" | "offline";
  last_seen: string | null;
  age_seconds: number | null;
}

interface HistoryMatch {
  match_id: string;
  league: string;
  league_name: string;
  home_team: string;
  away_team: string;
  kickoff: string;
  p_home: number;
  p_draw: number;
  p_away: number;
  odds_home: number | null;
  odds_draw: number | null;
  odds_away: number | null;
  edge: number | null;
  best_selection: string | null;
  bet_selection: string | null;
  bet_status: string | null;
  bet_stake: number | null;
  bet_odds: number | null;
}

interface HistoryStats {
  total_matches: number;
  bets_placed: number;
  won: number;
  lost: number;
  pending: number;
  accuracy: string;
  roi: string;
  model_accuracy: string;
  total_return: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LEAGUE_FLAGS: Record<string, string> = {
  PL: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", SA: "🇮🇹", PD: "🇪🇸", BL1: "🇩🇪", FL1: "🇫🇷", CL: "⭐", EL: "🟠",
};

const LEAGUE_IMPORTANCE: Record<string, number> = {
  CL: 5, EL: 4, PL: 3, SA: 3, PD: 3, BL1: 3, FL1: 3,
};

const MATCH_TYPE_META: Record<string, { label: string; color: string; priority: number }> = {
  DERBY:              { label: "Derby",          color: "text-red-400 border-red-400/40 bg-red-400/10",        priority: 5 },
  TITLE_DECIDER:      { label: "Title",          color: "text-yellow-400 border-yellow-400/40 bg-yellow-400/10", priority: 4 },
  RELEGATION:         { label: "Relegation",     color: "text-orange-400 border-orange-400/40 bg-orange-400/10", priority: 4 },
  NEUTRAL_VENUE:      { label: "Neutral",        color: "text-blue-400 border-blue-400/40 bg-blue-400/10",     priority: 3 },
  CUP_SPILLOVER:      { label: "Cup",            color: "text-violet-400 border-violet-400/40 bg-violet-400/10", priority: 3 },
  SHORT_REST:         { label: "Short Rest",     color: "text-amber-400 border-amber-400/40 bg-amber-400/10",  priority: 2 },
  EUROPEAN_HANGOVER:  { label: "EU Hangover",   color: "text-cyan-400 border-cyan-400/40 bg-cyan-400/10",     priority: 2 },
  DEAD_RUBBER:        { label: "Dead Rubber",    color: "text-gray-500 border-gray-500/40 bg-gray-500/10",     priority: 1 },
  ROTATION:           { label: "Rotation",       color: "text-gray-500 border-gray-500/40 bg-gray-500/10",     priority: 1 },
  STANDARD:           { label: "Standard",       color: "text-gray-600 border-gray-600/40 bg-gray-600/5",      priority: 0 },
};

type Tab = "overview" | "predictions" | "tennis" | "bets" | "history" | "agents";

// ─── Tennis Types ─────────────────────────────────────────────────────────────

interface TennisMatch {
  id: string;
  player1: string;
  player2: string;
  tournament: string;
  surface: "CLAY" | "GRASS" | "HARD";
  round: string;
  scheduled: string;
  p1: number;
  p2: number;
  odds_p1: number;
  odds_p2: number;
  edge: number | null;
  best_selection: "P1" | "P2" | null;
  model: string;
}

interface TennisSummary {
  total_today: number;
  value_bets: number;
  markets_active: number;
  pnl: number;
}

type SlipSelection = {
  id: string;
  sport: "Football" | "Tennis";
  event: string;
  league: string;
  kickoff: string;
  market: string;
  selection: string;
  odds: number;
  modelProbability: number;
  edge: number | null;
  confidence: number;
  recommendedStake: number;
};

// ─── Utilities ────────────────────────────────────────────────────────────────

function pct(v: number) { return `${Math.round(v * 100)}%`; }

function fmtKickoff(utc: string) {
  return new Date(utc).toLocaleDateString("it-IT", {
    weekday: "short", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome",
  });
}

function timeAgo(utc: string) {
  const diff = Math.floor((Date.now() - new Date(utc).getTime()) / 60000);
  if (diff < 1) return "just now";
  if (diff < 60) return `${diff}m ago`;
  const h = Math.floor(diff / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}

function matchImportance(p: Prediction | HistoryMatch): number {
  const leaguePrio = LEAGUE_IMPORTANCE[p.league] ?? 2;
  const edgePrio = (p.edge ?? 0) > 0.05 ? 2 : (p.edge ?? 0) > 0.02 ? 1 : 0;
  const mt = "match_type" in p ? (p.match_type ?? "") : "";
  const typePrio = MATCH_TYPE_META[mt as string]?.priority ?? 0;
  return leaguePrio + edgePrio + typePrio;
}

function confidenceFromEdge(edge: number | null, probability: number) {
  const edgeScore = Math.min(45, Math.max(0, (edge ?? 0) * 700));
  const probScore = Math.min(35, Math.max(0, (probability - 0.35) * 100));
  return Math.round(Math.min(95, 20 + edgeScore + probScore));
}

function stakeFromEdge(edge: number | null, confidence: number) {
  if (!edge || edge <= 0) return 0;
  return Math.min(25, Math.max(2, Math.round(edge * confidence * 3) / 2));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProbBar({ label, pct: p, color, odds, isValue }: {
  label: string; pct: number; color: string; odds?: number | null; isValue?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={`text-xs font-mono w-10 shrink-0 ${color}`}>{label}</span>
      <div className="flex-1 bg-white/5 rounded-full h-1.5 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color.replace("text-", "bg-")}`}
          style={{ width: `${Math.round(p * 100)}%` }} />
      </div>
      <span className={`text-xs font-mono w-8 text-right ${color}`}>{pct(p)}</span>
      {odds != null && (
        <span className="text-xs font-mono text-gray-500 w-10 text-right">{odds.toFixed(2)}</span>
      )}
      {isValue && (
        <span className="text-xs px-1.5 py-0.5 rounded border border-green-400/40 text-green-400 bg-green-400/10 font-mono">
          VALUE
        </span>
      )}
    </div>
  );
}

function FormBadge({ result }: { result: string }) {
  const colors: Record<string, string> = {
    W: "bg-green-500/80 text-white", D: "bg-yellow-500/80 text-black", L: "bg-red-500/80 text-white",
  };
  return (
    <span className={`inline-block w-5 h-5 text-[10px] font-bold rounded text-center leading-5 ${colors[result] ?? "bg-gray-600 text-gray-300"}`}>
      {result}
    </span>
  );
}

function FormRow({ label, form }: { label: string; form?: string }) {
  if (!form) return null;
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-gray-500 font-mono w-10 shrink-0">{label}</span>
      <div className="flex gap-0.5">
        {form.split("").map((r, i) => <FormBadge key={i} result={r} />)}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    won: "text-green-400 border-green-400/40 bg-green-400/10",
    lost: "text-red-400 border-red-400/40 bg-red-400/10",
    pending: "text-yellow-400 border-yellow-400/40 bg-yellow-400/10",
    execution_rejected: "text-red-300 border-red-400/40 bg-red-400/10",
    expired_unconfirmed: "text-gray-400 border-gray-500/40 bg-gray-500/10",
    voided: "text-gray-400 border-gray-400/40 bg-gray-400/10",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full border text-xs font-mono ${colors[status] ?? "text-gray-400"}`}>
      {status}
    </span>
  );
}

function MatchTypeBadge({ matchType }: { matchType?: string | null }) {
  if (!matchType || matchType === "STANDARD" || matchType === "ROTATION") return null;
  const meta = MATCH_TYPE_META[matchType];
  if (!meta) return null;
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${meta.color}`}>
      {meta.label}
    </span>
  );
}

function OddsButton({
  label,
  odds,
  probability,
  active,
  onClick,
}: {
  label: string;
  odds: number | null;
  probability: number;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button className={`odds-button ${active ? "is-value" : ""}`} disabled={odds == null} onClick={onClick}>
      <span>{label}</span>
      <strong>{odds == null ? "—" : odds.toFixed(2)}</strong>
      <em>{pct(probability)}</em>
    </button>
  );
}

function FootballMarketRow({ p, onSelect }: { p: Prediction; onSelect: (selection: SlipSelection) => void }) {
  const options = [
    { key: "HOME", label: "1", odds: p.odds_home, probability: p.p_home, name: p.home_team },
    { key: "DRAW", label: "X", odds: p.odds_draw, probability: p.p_draw, name: "Draw" },
    { key: "AWAY", label: "2", odds: p.odds_away, probability: p.p_away, name: p.away_team },
  ];

  return (
    <div className="market-row">
      <div className="event-cell">
        <div className="event-meta">
          <span>{LEAGUE_FLAGS[p.league] ?? "FB"} {p.league}</span>
          <span>{fmtKickoff(p.kickoff)}</span>
          <MatchTypeBadge matchType={p.match_type} />
        </div>
        <strong>{p.home_team}</strong>
        <strong>{p.away_team}</strong>
      </div>
      <div className="model-cell">
        <span>Model</span>
        <strong>{p.best_selection ?? "WAIT"}</strong>
        <em className={(p.edge ?? 0) > 0.03 ? "text-green-300" : "text-gray-500"}>
          {p.edge == null ? "no edge" : `${p.edge > 0 ? "+" : ""}${(p.edge * 100).toFixed(1)}%`}
        </em>
      </div>
      <div className="odds-grid football">
        {options.map((o) => {
          const confidence = confidenceFromEdge(p.best_selection === o.key ? p.edge : null, o.probability);
          return (
            <OddsButton
              key={o.key}
              label={o.label}
              odds={o.odds}
              probability={o.probability}
              active={p.best_selection === o.key && (p.edge ?? 0) > 0.03}
              onClick={() => o.odds != null && onSelect({
                id: p.match_id,
                sport: "Football",
                event: `${p.home_team} vs ${p.away_team}`,
                league: p.league,
                kickoff: p.kickoff,
                market: "1X2",
                selection: o.name,
                odds: o.odds,
                modelProbability: o.probability,
                edge: p.best_selection === o.key ? p.edge : null,
                confidence,
                recommendedStake: stakeFromEdge(p.best_selection === o.key ? p.edge : null, confidence),
              })}
            />
          );
        })}
      </div>
    </div>
  );
}

function TennisMarketRow({ m, onSelect }: { m: TennisMatch; onSelect: (selection: SlipSelection) => void }) {
  const options = [
    { key: "P1", label: "P1", odds: m.odds_p1, probability: m.p1, name: m.player1 },
    { key: "P2", label: "P2", odds: m.odds_p2, probability: m.p2, name: m.player2 },
  ] as const;

  return (
    <div className="market-row tennis-row">
      <div className="event-cell">
        <div className="event-meta">
          <span>TN {m.surface}</span>
          <span>{fmtKickoff(m.scheduled)}</span>
          <span>{m.round}</span>
        </div>
        <strong>{m.player1}</strong>
        <strong>{m.player2}</strong>
      </div>
      <div className="model-cell">
        <span>{m.tournament}</span>
        <strong>{m.best_selection ?? "WAIT"}</strong>
        <em className={(m.edge ?? 0) > 0.025 ? "text-green-300" : "text-gray-500"}>
          {m.edge == null ? "no edge" : `${m.edge > 0 ? "+" : ""}${(m.edge * 100).toFixed(1)}%`}
        </em>
      </div>
      <div className="odds-grid tennis">
        {options.map((o) => {
          const confidence = confidenceFromEdge(m.best_selection === o.key ? m.edge : null, o.probability);
          return (
            <OddsButton
              key={o.key}
              label={o.label}
              odds={o.odds}
              probability={o.probability}
              active={m.best_selection === o.key && (m.edge ?? 0) > 0.025}
              onClick={() => onSelect({
                id: m.id,
                sport: "Tennis",
                event: `${m.player1} vs ${m.player2}`,
                league: m.tournament,
                kickoff: m.scheduled,
                market: "Match Winner",
                selection: o.name,
                odds: o.odds,
                modelProbability: o.probability,
                edge: m.best_selection === o.key ? m.edge : null,
                confidence,
                recommendedStake: stakeFromEdge(m.best_selection === o.key ? m.edge : null, confidence),
              })}
            />
          );
        })}
      </div>
    </div>
  );
}

function SportsbookBoard({
  predictions,
  tennisMatches,
  onSelect,
}: {
  predictions: Prediction[];
  tennisMatches: TennisMatch[];
  onSelect: (selection: SlipSelection) => void;
}) {
  const footballValue = predictions
    .filter((p) => p.edge != null && p.edge > 0.03)
    .sort((a, b) => (b.edge ?? 0) - (a.edge ?? 0));
  const tennisValue = tennisMatches
    .filter((m) => m.edge != null && m.edge > 0.025)
    .sort((a, b) => (b.edge ?? 0) - (a.edge ?? 0));
  const footballRows = footballValue.length ? footballValue : predictions.slice(0, 8);
  const tennisRows = tennisValue.length ? tennisValue : tennisMatches.slice(0, 6);

  return (
    <div className="sportsbook-board">
      <div className="board-header">
        <div>
          <p className="eyebrow">Market board</p>
          <h2>Best available edges</h2>
        </div>
        <div className="board-chips">
          <span>+EV first</span>
          <span>1X2</span>
          <span>Match winner</span>
        </div>
      </div>

      <section className="market-section">
        <div className="market-section-title">
          <span>Football</span>
          <em>{footballValue.length} value / {predictions.length} markets</em>
        </div>
        {footballRows.length ? (
          <div className="market-list">
            {footballRows.map((p) => <FootballMarketRow key={p.match_id} p={p} onSelect={onSelect} />)}
          </div>
        ) : (
          <div className="book-empty">Football markets loading. Hit refresh if the board stays empty.</div>
        )}
      </section>

      <section className="market-section">
        <div className="market-section-title amber">
          <span>Tennis</span>
          <em>{tennisValue.length} value / {tennisMatches.length} matches</em>
        </div>
        {tennisRows.length ? (
          <div className="market-list">
            {tennisRows.map((m) => <TennisMarketRow key={m.id} m={m} onSelect={onSelect} />)}
          </div>
        ) : (
          <div className="book-empty">Tennis markets loading. Fallback data appears when API is ready.</div>
        )}
      </section>
    </div>
  );
}

function BetSlip({ selection, onClear }: { selection: SlipSelection | null; onClear: () => void }) {
  const [stake, setStake] = useState(() => selection?.recommendedStake ? String(selection.recommendedStake) : "10");
  const stakeNumber = Number(stake) || 0;
  const returns = selection ? stakeNumber * selection.odds : 0;
  const profit = selection ? returns - stakeNumber : 0;
  const ev = selection ? (selection.modelProbability * profit) - ((1 - selection.modelProbability) * stakeNumber) : 0;
  const isFootballLive = selection?.sport === "Football";

  return (
    <aside className="betslip">
      <div className="betslip-head">
        <div>
          <p className="eyebrow">Bet slip</p>
          <h3>{isFootballLive ? "Live ticket" : "Signal ticket"}</h3>
        </div>
        {selection && <button onClick={onClear}>Clear</button>}
      </div>

      {!selection ? (
        <div className="betslip-empty">
          <strong>No selection</strong>
          <span>Click an odds cell from the unified market board to inspect execution quality.</span>
        </div>
      ) : (
        <div className="betslip-ticket">
          <div className="ticket-top">
            <span>{selection.sport}</span>
            <em>{selection.market}</em>
          </div>
          <h4>{selection.event}</h4>
          <div className="ticket-line">
            <span>Selection</span>
            <strong>{selection.selection}</strong>
          </div>
          <div className="ticket-line">
            <span>Odds</span>
            <strong>{selection.odds.toFixed(2)}</strong>
          </div>
          <div className="ticket-line">
            <span>Model probability</span>
            <strong>{pct(selection.modelProbability)}</strong>
          </div>
          <div className="ticket-line">
            <span>Edge</span>
            <strong className={(selection.edge ?? 0) > 0 ? "text-green-300" : "text-gray-400"}>
              {selection.edge == null ? "market only" : `${selection.edge > 0 ? "+" : ""}${(selection.edge * 100).toFixed(1)}%`}
            </strong>
          </div>
          <label className="stake-input">
            <span>Stake</span>
            <input value={stake} onChange={(e) => setStake(e.target.value)} inputMode="decimal" />
          </label>
          <div className="ticket-summary">
            <div>
              <span>Return</span>
              <strong>{returns.toFixed(2)}€</strong>
            </div>
            <div>
              <span>EV</span>
              <strong className={ev >= 0 ? "text-green-300" : "text-red-300"}>{ev >= 0 ? "+" : ""}{ev.toFixed(2)}€</strong>
            </div>
          </div>
          <button className="place-live">{isFootballLive ? "Football live on Betfair" : "Tennis signal only"}</button>
          <p className="ticket-note">
            {isFootballLive
              ? "Football execution is live through TraderAgent, RiskManager guardrails and Betfair confirmation."
              : "Tennis is in paper mode. Settlement loop is live — Elo ratings update on each closed market."}
          </p>
        </div>
      )}
    </aside>
  );
}

// ─── Prediction "Why" Reasoning ───────────────────────────────────────────────

interface Reason { icon: string; text: string; highlight?: boolean }

function buildReasons(p: Prediction): Reason[] {
  const e = p.enrichment ?? {};
  const reasons: Reason[] = [];

  const leader = p.p_home > p.p_draw && p.p_home > p.p_away ? "HOME" : p.p_draw > p.p_away ? "DRAW" : "AWAY";
  const leaderPct = leader === "HOME" ? p.p_home : leader === "DRAW" ? p.p_draw : p.p_away;
  reasons.push({
    icon: "🧠",
    text: `Dixon-Coles model: ${leader} favoured at ${pct(leaderPct)} — λ ${p.lambda_home?.toFixed(2) ?? "?"} (home) vs ${p.lambda_away?.toFixed(2) ?? "?"} (away)`,
  });

  if (p.edge != null && p.odds_home != null) {
    if (p.edge > 0.03) {
      reasons.push({
        icon: "💰",
        text: `Value bet: model sees +${(p.edge * 100).toFixed(1)}% edge on ${p.best_selection} (model ${pct(leaderPct)} vs market implied ${pct(1 / (p.best_selection === "HOME" ? p.odds_home! : p.best_selection === "DRAW" ? p.odds_draw! : p.odds_away!))})`,
        highlight: true,
      });
    } else if (Math.abs(p.edge) < 0.01) {
      reasons.push({ icon: "⚖️", text: `Model and market roughly agree — edge near zero (${(p.edge * 100).toFixed(1)}%)` });
    } else {
      reasons.push({ icon: "📉", text: `Market offers better price: model sees ${(p.edge * 100).toFixed(1)}% edge on ${p.best_selection} (no value currently)` });
    }
  } else {
    reasons.push({ icon: "❓", text: "No market odds available — edge cannot be computed" });
  }

  if (e.pi_home != null || e.pi_away != null) {
    const piH = e.pi_home ?? 0;
    const piA = e.pi_away ?? 0;
    const diff = piH - piA;
    if (Math.abs(diff) > 20) {
      reasons.push({
        icon: "⚡",
        text: `Pi Rating: ${diff > 0 ? "HOME" : "AWAY"} stronger by ${Math.abs(diff)} points (home ${piH > 0 ? "+" : ""}${piH} / away ${piA > 0 ? "+" : ""}${piA})`,
        highlight: Math.abs(diff) > 80,
      });
    } else {
      reasons.push({ icon: "⚡", text: `Pi Rating: teams evenly matched (home ${piH > 0 ? "+" : ""}${piH} / away ${piA > 0 ? "+" : ""}${piA})` });
    }
  }

  if (e.xg_home != null && e.xg_away != null) {
    const diff = e.xg_home - e.xg_away;
    if (Math.abs(diff) > 0.3) {
      reasons.push({
        icon: "⚽",
        text: `xG trend: ${diff > 0 ? "HOME" : "AWAY"} creating more chances — home ${e.xg_home.toFixed(2)} xG vs away ${e.xg_away.toFixed(2)} xG per game`,
        highlight: Math.abs(diff) > 0.6,
      });
    } else {
      reasons.push({ icon: "⚽", text: `xG balanced: home ${e.xg_home.toFixed(2)} vs away ${e.xg_away.toFixed(2)} xG per game` });
    }
    if (e.xga_home != null && e.xga_away != null) {
      const defDiff = e.xga_away - e.xga_home;
      if (Math.abs(defDiff) > 0.3) {
        reasons.push({
          icon: "🛡️",
          text: `Defense: ${defDiff > 0 ? "HOME concedes less" : "AWAY concedes less"} — home concedes ${e.xga_home.toFixed(2)} vs away ${e.xga_away.toFixed(2)} xGA`,
        });
      }
    }
  }

  const formH = e.form_home ?? "";
  const formA = e.form_away ?? "";
  if (formH || formA) {
    const homeWins = (formH.match(/W/g) || []).length;
    const awayWins = (formA.match(/W/g) || []).length;
    const homeLosses = (formH.match(/L/g) || []).length;
    const awayLosses = (formA.match(/L/g) || []).length;
    if (homeWins >= 4) {
      reasons.push({ icon: "🔥", text: `Home on fire: ${homeWins}W in last ${formH.length} games (${formH.split("").join(" ")})`, highlight: true });
    } else if (awayWins >= 4) {
      reasons.push({ icon: "🔥", text: `Away on fire: ${awayWins}W in last ${formA.length} games (${formA.split("").join(" ")})`, highlight: true });
    } else if (homeLosses >= 4) {
      reasons.push({ icon: "📉", text: `Home poor form: ${homeLosses}L in last ${formH.length} games (${formH.split("").join(" ")})` });
    } else if (awayLosses >= 4) {
      reasons.push({ icon: "📉", text: `Away poor form: ${awayLosses}L in last ${formA.length} games (${formA.split("").join(" ")})` });
    } else {
      reasons.push({ icon: "📋", text: `Form: HOME ${formH.split("").join(" ") || "n/a"} · AWAY ${formA.split("").join(" ") || "n/a"}` });
    }
  }

  const injH = e.injuries_home?.length ?? 0;
  const injA = e.injuries_away?.length ?? 0;
  if (injH > 0 || injA > 0) {
    if (injH > injA + 1) {
      reasons.push({ icon: "🚑", text: `Home significantly more injured: ${injH} vs ${injA} — ${e.injuries_home!.slice(0, 2).join(", ")}`, highlight: injH > 3 });
    } else if (injA > injH + 1) {
      reasons.push({ icon: "🚑", text: `Away significantly more injured: ${injA} vs ${injH} — ${e.injuries_away!.slice(0, 2).join(", ")}`, highlight: injA > 3 });
    } else {
      reasons.push({ icon: "🚑", text: `Injuries balanced: home ${injH} · away ${injA} players out` });
    }
  }

  if (e.api_pct_home != null) {
    const dixonHome = Math.round(p.p_home * 100);
    const apiHome = e.api_pct_home;
    const discrepancy = Math.abs(dixonHome - apiHome);
    if (discrepancy >= 8) {
      reasons.push({
        icon: "🔎",
        text: `Models diverge on HOME: Dixon-Coles says ${dixonHome}% vs API-Football ${apiHome}% — discrepancy of ${discrepancy}pp warrants extra caution`,
        highlight: discrepancy >= 15,
      });
    } else {
      reasons.push({ icon: "✅", text: `API-Football confirms: HOME ${apiHome}% (our model: ${dixonHome}%) — models agree` });
    }
    if (e.api_advice) {
      reasons.push({ icon: "💬", text: `API-Football advice: "${e.api_advice}"` });
    }
  }

  if (e.weather) {
    const w = e.weather;
    if (w.wind > 8 || w.rain > 3) {
      reasons.push({
        icon: "🌧️",
        text: `Weather risk: ${w.temp}°C, wind ${w.wind}m/s, rain ${w.rain}mm — may reduce total goals scored`,
        highlight: w.wind > 12 || w.rain > 8,
      });
    }
  }

  if (e.research) {
    reasons.push({ icon: "🤖", text: `AI research: ${e.research}` });
  }

  return reasons;
}

function WhyPanel({ p, onClose }: { p: Prediction; onClose: () => void }) {
  const reasons = buildReasons(p);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="glass-card max-w-lg w-full max-h-[80vh] overflow-y-auto p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs text-gray-500 font-mono">{LEAGUE_FLAGS[p.league] ?? "⚽"} {p.league_name}</div>
            <div className="font-bold text-white text-base mt-0.5">
              {p.home_team} <span className="text-gray-500 font-normal">vs</span> {p.away_team}
            </div>
            <div className="text-xs text-gray-500 font-mono mt-0.5">{fmtKickoff(p.kickoff)}</div>
            {p.match_type && <MatchTypeBadge matchType={p.match_type} />}
          </div>
          <button onClick={onClose} className="text-gray-600 hover:text-white text-xl font-mono shrink-0">✕</button>
        </div>

        <div className="space-y-1.5">
          <ProbBar label="HOME" pct={p.p_home} color="text-cyan-400" odds={p.odds_home}
            isValue={p.best_selection === "HOME" && (p.edge ?? 0) > 0.03} />
          <ProbBar label="DRAW" pct={p.p_draw} color="text-yellow-400" odds={p.odds_draw}
            isValue={p.best_selection === "DRAW" && (p.edge ?? 0) > 0.03} />
          <ProbBar label="AWAY" pct={p.p_away} color="text-fuchsia-400" odds={p.odds_away}
            isValue={p.best_selection === "AWAY" && (p.edge ?? 0) > 0.03} />
        </div>

        <div className="space-y-2">
          <div className="text-[10px] font-mono text-cyan-400/70 uppercase tracking-wider border-b border-white/10 pb-1">
            Perché questa previsione
          </div>
          {reasons.map((r, i) => (
            <div key={i} className={`flex gap-2 text-[11px] font-mono leading-relaxed ${r.highlight ? "text-white" : "text-gray-400"}`}>
              <span className="shrink-0 w-4">{r.icon}</span>
              <span>{r.text}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between text-[10px] text-gray-600 font-mono pt-2 border-t border-white/5">
          <span>λ home {p.lambda_home?.toFixed(2) ?? "?"}</span>
          <span>λ away {p.lambda_away?.toFixed(2) ?? "?"}</span>
          <span>{p.model_matches ?? "?"} training matches</span>
        </div>
      </div>
    </div>
  );
}

function PredictionCard({ p }: { p: Prediction }) {
  const [showWhy, setShowWhy] = useState(false);
  const hasOdds = p.odds_home != null;
  const isValueBet = p.edge != null && p.edge > 0.03;
  const e = p.enrichment ?? {};

  const betRec = isValueBet && hasOdds && p.best_selection ? (() => {
    const selOdds = p.best_selection === "HOME" ? p.odds_home : p.best_selection === "DRAW" ? p.odds_draw : p.odds_away;
    const selP = p.best_selection === "HOME" ? p.p_home : p.best_selection === "DRAW" ? p.p_draw : p.p_away;
    if (!selOdds || selP == null) return null;
    const b = selOdds - 1;
    const q = 1 - selP;
    const kelly = Math.max(0, (b * selP - q) / b);
    const stake = Math.min(15, Math.max(1, Math.round(kelly * 0.25 * 500)));
    return { selOdds, stake };
  })() : null;

  return (
    <>
      <div
        className={`glass-card p-4 space-y-3 cursor-pointer hover:border-cyan-400/30 transition-colors ${isValueBet ? "border-green-400/40" : ""}`}
        onClick={() => setShowWhy(true)}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-xs font-mono text-gray-500">
              {LEAGUE_FLAGS[p.league] ?? "⚽"} {p.league_name}
            </span>
            <div className="text-sm font-bold text-white mt-0.5">
              {p.home_team}<span className="text-gray-500 font-normal mx-2">vs</span>{p.away_team}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {isValueBet && (
              <span className="text-xs px-2 py-0.5 rounded-full border border-green-400/50 text-green-400 bg-green-400/10 font-mono">
                +EV {p.best_selection}
              </span>
            )}
            {p.match_type && p.match_type !== "STANDARD" && (
              <MatchTypeBadge matchType={p.match_type} />
            )}
            {e.research && (
              <span className="text-xs px-1.5 py-0.5 rounded border border-purple-400/40 text-purple-400 bg-purple-400/5 font-mono">
                🤖 AI
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-500 font-mono">{fmtKickoff(p.kickoff)}</div>
          {e.weather && (
            <div className="flex items-center gap-1 text-xs font-mono text-gray-400">
              <span>{e.weather.icon}</span>
              <span>{e.weather.temp}°C</span>
              {e.weather.wind > 6 && <span className="text-yellow-400">💨{e.weather.wind}m/s</span>}
              {e.weather.rain > 0 && <span className="text-blue-400">🌧️{e.weather.rain}mm</span>}
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <ProbBar label="HOME" pct={p.p_home} color="text-cyan-400"
            odds={p.odds_home} isValue={hasOdds && p.best_selection === "HOME" && isValueBet} />
          <ProbBar label="DRAW" pct={p.p_draw} color="text-yellow-400"
            odds={p.odds_draw} isValue={hasOdds && p.best_selection === "DRAW" && isValueBet} />
          <ProbBar label="AWAY" pct={p.p_away} color="text-fuchsia-400"
            odds={p.odds_away} isValue={hasOdds && p.best_selection === "AWAY" && isValueBet} />
        </div>

        {(e.form_home || e.form_away) && (
          <div className="space-y-1">
            <FormRow label="HOME" form={e.form_home} />
            <FormRow label="AWAY" form={e.form_away} />
          </div>
        )}

        {betRec && (
          <div className="rounded-lg border border-green-400/40 bg-green-400/5 px-3 py-2.5 flex items-center gap-3 mt-1">
            <div className="flex-1 min-w-0">
              <div className="text-[9px] font-mono text-green-400/50 uppercase tracking-widest mb-1">Scommetti</div>
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-bold text-green-400 font-mono">{p.best_selection}</span>
                <span className="text-sm font-mono text-white/80">@ {betRec.selOdds.toFixed(2)}</span>
                <span className="text-[10px] font-mono text-green-400/60 ml-auto">edge +{((p.edge ?? 0) * 100).toFixed(1)}%</span>
              </div>
            </div>
            <div className="text-right shrink-0 border-l border-green-400/20 pl-3">
              <div className="text-lg font-bold text-white font-mono">€{betRec.stake}</div>
              <div className="text-[9px] font-mono text-green-400/50 uppercase tracking-wider">stake</div>
            </div>
          </div>
        )}

        <div className="text-[10px] text-gray-700 font-mono text-center">tap to see why →</div>

        <div className="flex items-center justify-between text-xs text-gray-600 font-mono pt-1 border-t border-white/5">
          <span>λ {p.lambda_home?.toFixed(1) ?? "?"} – {p.lambda_away?.toFixed(1) ?? "?"}</span>
          {p.edge != null && (
            <span className={p.edge > 0 ? "text-green-500" : "text-red-500"}>
              edge {p.edge > 0 ? "+" : ""}{(p.edge * 100).toFixed(1)}%
            </span>
          )}
          <span>{p.model_matches ?? "?"} matches</span>
        </div>
      </div>

      {showWhy && <WhyPanel p={p} onClose={() => setShowWhy(false)} />}
    </>
  );
}

// ─── Tennis Tab ───────────────────────────────────────────────────────────────

const SURFACE_META: Record<string, { label: string; color: string }> = {
  CLAY:  { label: "CLAY",  color: "text-orange-400 border-orange-400/40 bg-orange-400/10" },
  GRASS: { label: "GRASS", color: "text-green-400 border-green-400/40 bg-green-400/10" },
  HARD:  { label: "HARD",  color: "text-blue-400 border-blue-400/40 bg-blue-400/10" },
};

function TennisMatchCard({ m }: { m: TennisMatch }) {
  const surface = SURFACE_META[m.surface] ?? { label: m.surface, color: "text-gray-400 border-gray-400/40 bg-gray-400/10" };
  const isValue = m.edge != null && m.edge > 0.025;
  const scheduledDate = new Date(m.scheduled).toLocaleDateString("it-IT", {
    weekday: "short", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome",
  });

  return (
    <div className={`glass-card p-4 space-y-3 ${isValue ? "border-green-400/40" : ""}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${surface.color}`}>
              {surface.label}
            </span>
            <span className="text-xs text-gray-500 font-mono">{m.tournament}</span>
            <span className="text-[10px] text-gray-600 font-mono">{m.round}</span>
          </div>
          <div className="text-sm font-bold text-white mt-1">
            {m.player1} <span className="text-gray-500 font-normal">vs</span> {m.player2}
          </div>
          <div className="text-xs text-gray-600 font-mono mt-0.5">{scheduledDate}</div>
        </div>
        {isValue && (
          <span className="text-xs px-2 py-0.5 rounded-full border border-green-400/50 text-green-400 bg-green-400/10 font-mono shrink-0">
            +EV {m.best_selection}
          </span>
        )}
      </div>

      {/* Probability bars */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono w-24 shrink-0 text-cyan-400 truncate">{m.player1.split(" ").pop()}</span>
          <div className="flex-1 bg-white/5 rounded-full h-1.5 overflow-hidden">
            <div className="h-full rounded-full bg-cyan-400 transition-all" style={{ width: `${Math.round(m.p1 * 100)}%` }} />
          </div>
          <span className="text-xs font-mono w-8 text-right text-cyan-400">{Math.round(m.p1 * 100)}%</span>
          <span className="text-xs font-mono text-gray-500 w-10 text-right">{m.odds_p1.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono w-24 shrink-0 text-fuchsia-400 truncate">{m.player2.split(" ").pop()}</span>
          <div className="flex-1 bg-white/5 rounded-full h-1.5 overflow-hidden">
            <div className="h-full rounded-full bg-fuchsia-400 transition-all" style={{ width: `${Math.round(m.p2 * 100)}%` }} />
          </div>
          <span className="text-xs font-mono w-8 text-right text-fuchsia-400">{Math.round(m.p2 * 100)}%</span>
          <span className="text-xs font-mono text-gray-500 w-10 text-right">{m.odds_p2.toFixed(2)}</span>
        </div>
      </div>

      {/* Edge */}
      <div className="flex items-center justify-between text-xs font-mono pt-1 border-t border-white/5">
        <span className="text-gray-600">{m.model}</span>
        {m.edge != null && m.edge > 0 ? (
          <span className={isValue ? "text-green-400" : "text-gray-500"}>
            edge +{(m.edge * 100).toFixed(1)}%
          </span>
        ) : (
          <span className="text-gray-600">no edge</span>
        )}
      </div>
    </div>
  );
}

function TennisTab({
  matches,
  summary,
  loading,
  computedAt,
  agents = [],
}: {
  matches: TennisMatch[];
  summary: TennisSummary | null;
  loading: boolean;
  computedAt: string | null;
  agents?: AgentStatus[];
}) {
  const [surfaceFilter, setSurfaceFilter] = useState<string>("ALL");

  const surfaces = ["ALL", ...Array.from(new Set(matches.map((m) => m.surface)))];
  const filtered = surfaceFilter === "ALL" ? matches : matches.filter((m) => m.surface === surfaceFilter);
  const valueBets = matches.filter((m) => m.edge != null && m.edge > 0.025);
  const pnl = summary?.pnl ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="inline-block px-3 py-0.5 rounded-full border border-amber-400/50 text-amber-300 text-xs font-mono tracking-wider">
            Tennis AI v2.0 · ATP + WTA · Betfair Exchange
          </div>
          {computedAt && (
            <p className="text-xs text-gray-500 font-mono mt-1">
              computed {timeAgo(computedAt)} · {matches.length} matches loaded
            </p>
          )}
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Matches Today",     value: String(summary?.total_today ?? matches.length), color: "text-white" },
          { label: "Value Bets",        value: String(valueBets.length),  color: "text-green-400" },
          { label: "P&L Tennis",        value: `${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}€`, color: pnl >= 0 ? "text-green-400" : "text-red-400" },
          { label: "Betfair Markets",   value: String(summary?.markets_active ?? 0), color: "text-amber-300" },
        ].map((kpi) => (
          <div key={kpi.label} className="glass-card p-4 text-center">
            <div className={`text-xl font-black ${kpi.color}`}>{kpi.value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Surface filter */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] text-gray-600 font-mono uppercase tracking-wider">Surface</span>
        {surfaces.map((s) => (
          <button key={s} onClick={() => setSurfaceFilter(s)}
            className={`px-3 py-1 rounded-full border text-xs font-mono transition ${
              surfaceFilter === s
                ? "border-amber-400 text-amber-300 bg-amber-400/10"
                : "border-white/10 text-gray-400 hover:border-amber-400/40"
            }`}>
            {s}
          </button>
        ))}
      </div>

      {/* Match list */}
      {loading ? (
        <div className="glass-card p-12 text-center text-gray-400 font-mono">
          <div className="animate-pulse">Loading tennis predictions…</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-8 text-center text-gray-400 font-mono">No matches available</div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((m) => <TennisMatchCard key={m.id} m={m} />)}
        </div>
      )}

      {/* Agent status — live from heartbeat DB */}
      <div className="glass-card p-4">
        <h3 className="text-xs font-mono text-amber-400/70 uppercase tracking-wider mb-3">
          Tennis Pipeline · 6 Agents
        </h3>
        <div className="grid md:grid-cols-3 gap-3">
          {[
            { key: "TennisDataCollectorAgent", label: "DataCollector",  desc: "Betfair tennis markets · 5min cycle" },
            { key: "TennisModelAgent",          label: "ModelAgent",     desc: "Elo Surface v2 · clay/grass/hard · 2966 players" },
            { key: "TennisAnalystAgent",         label: "Analyst",       desc: "Value edge · 4% threshold · market comparison" },
            { key: "TennisRiskManagerAgent",     label: "RiskManager",   desc: "Quarter-Kelly sizing · 20% cap · drawdown gate" },
            { key: "TennisTraderAgent",          label: "Trader",        desc: "Paper bets · Neon DB · Telegram alerts" },
            { key: "TennisSettlementAgent",      label: "Settlement",    desc: "Betfair CLOSED → Elo update → P&L loop" },
          ].map(({ key, label, desc }) => {
            const a = agents.find((ag) => ag.name === key);
            const st = a?.status ?? "offline";
            const dotCls = st === "alive" ? "bg-green-400 animate-pulse" : st === "stale" ? "bg-yellow-400" : "bg-red-400";
            const txtCls = st === "alive" ? "text-green-400" : st === "stale" ? "text-yellow-400" : "text-red-400";
            const borderCls = st === "alive" ? "border-green-400/20" : st === "stale" ? "border-yellow-400/20" : "border-red-400/20";
            return (
              <div key={key} className={`glass-card p-3 space-y-1 ${borderCls}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white font-mono">{label}</span>
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${dotCls}`} />
                    <span className={`text-xs font-mono ${txtCls}`}>{st.toUpperCase()}</span>
                  </div>
                </div>
                <p className="text-[10px] text-gray-500 font-mono">{desc}</p>
                {a?.last_seen
                  ? <div className="text-[9px] text-gray-600 font-mono">Last seen: {timeAgo(a.last_seen)}</div>
                  : <div className="text-[9px] text-gray-600 font-mono">No heartbeat yet</div>}
              </div>
            );
          })}
        </div>
      </div>

      <footer className="text-center text-xs text-gray-600 font-mono pb-4">
        Tennis AI v2.0 · Elo Surface v2 · 2,966 players · Settlement loop live · Paper mode
      </footer>
    </div>
  );
}

// ─── Agent Status Tab ─────────────────────────────────────────────────────────

function AgentStatusTab({ agents }: { agents: AgentStatus[] }) {
  const AGENT_ROLES: Record<string, string> = {
    // Football
    DataCollector:          "Fetches fixtures, odds, history from all data sources",
    ModelAgent:             "Runs Dixon-Coles Poisson model + League & Match Context Module",
    AnalystAgent:           "Identifies value bets by comparing model vs market odds",
    StrategistAgent:        "Evaluates opportunities, assigns conviction score 0-10",
    RiskManagerAgent:       "Kelly sizing, exposure limits, drawdown circuit breaker",
    TraderAgent:            "Executes approved football orders on Betfair Exchange (live)",
    MonitorAgent:           "Heartbeat monitoring, PSI drift detection, Telegram alerts",
    ResearchAgent:          "Generates AI match analysis via Ollama local LLM",
    AHCollectorAgent:       "Asian Handicap odds from Pinnacle/SBOBet",
    ResultSettlementAgent:  "Polls Betfair for settled football markets, updates bet P&L",
    // Tennis
    TennisDataCollectorAgent: "Betfair tennis markets · 5-min polling cycle",
    TennisModelAgent:         "Elo Surface v2 · clay/grass/hard · 2,966 players bootstrapped",
    TennisAnalystAgent:       "Value edge detection · 4% threshold · market comparison",
    TennisRiskManagerAgent:   "Quarter-Kelly sizing · 20% bankroll cap · drawdown gate",
    TennisTraderAgent:        "Paper bets · Neon DB · Betfair Exchange dedup guard",
    TennisSettlementAgent:    "CLOSED market → winner → Elo.update() → P&L settlement loop",
  };

  const anyOnline = agents.some((a) => a.status !== "offline");

  return (
    <div className="space-y-4">
      <div className="glass-card p-4 border-cyan-400/10">
        <div className="text-xs font-mono text-gray-400 space-y-1 leading-relaxed">
          <div className="text-cyan-400 font-bold mb-2">Architettura ibrida v5.0</div>
          <div>
            <span className="text-cyan-300">Dashboard (Vercel)</span> — Dixon-Coles · Pi Rating · xG · API-Football · Odds.
            Sempre online, non dipende dagli agenti Python.
          </div>
          <div>
            <span className="text-fuchsia-300">Agenti Python (locale)</span> — Analisi real-time, League &amp; Match Context Module,
            Betfair execution, Ollama AI. Avvia con <code className="text-yellow-300">python run.py</code>.
          </div>
          {!anyOnline && (
            <div className="mt-2 text-yellow-400 border border-yellow-400/20 rounded px-2 py-1">
              ⚠️ Nessun agente attivo. Avvia il sistema con <code>python run.py</code> nella cartella del progetto.
            </div>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {agents.map((agent) => (
          <div key={agent.name} className={`glass-card p-4 space-y-2 ${
            agent.status === "alive" ? "border-green-400/20" :
            agent.status === "stale" ? "border-yellow-400/20" : "border-red-400/20"
          }`}>
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-white font-mono">{agent.name}</span>
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${
                  agent.status === "alive" ? "bg-green-400 animate-pulse" :
                  agent.status === "stale" ? "bg-yellow-400" : "bg-red-400"
                }`} />
                <span className={`text-xs font-mono ${
                  agent.status === "alive" ? "text-green-400" :
                  agent.status === "stale" ? "text-yellow-400" : "text-red-400"
                }`}>
                  {agent.status.toUpperCase()}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-gray-500 font-mono leading-relaxed">
              {AGENT_ROLES[agent.name] ?? "Multi-agent system component"}
            </p>
            <div className="text-[10px] text-gray-600 font-mono">
              {agent.last_seen ? `Last seen: ${timeAgo(agent.last_seen)}` : "No heartbeat received"}
              {agent.age_seconds != null && ` (${agent.age_seconds}s ago)`}
            </div>
          </div>
        ))}
      </div>

      <div className="glass-card p-4">
        <h3 className="text-xs font-mono text-cyan-400/70 uppercase tracking-wider mb-3">Pipeline Flow · 16 Agents</h3>
        <div className="text-[10px] text-gray-500 font-mono mb-1 uppercase tracking-wider">⚽ Football</div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-gray-400">
          {[
            "DataCollector", "→", "ModelAgent", "→", "ContextService", "→",
            "AnalystAgent", "→", "StrategistAgent", "→", "RiskManagerAgent", "→", "TraderAgent", "→", "ResultSettlement",
          ].map((item, i) => (
            <span key={i} className={
              item === "→" ? "text-gray-600" :
              item === "ContextService" ? "text-green-300" :
              item === "ResultSettlement" ? "text-emerald-400" :
              "text-cyan-300"
            }>{item}</span>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-gray-400 mt-1">
          {["AHCollectorAgent", "→", "AH Odds", "·", "ResearchAgent", "→", "AI Summaries", "·", "MonitorAgent", "→", "Alerts + PSI"].map((item, i) => (
            <span key={i} className={["→", "·"].includes(item) ? "text-gray-600" : "text-fuchsia-300"}>{item}</span>
          ))}
        </div>
        <div className="text-[10px] text-gray-500 font-mono mb-1 mt-3 uppercase tracking-wider">🎾 Tennis</div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-gray-400">
          {[
            "TennisDataCollector", "→", "TennisModel", "→", "TennisAnalyst", "→",
            "TennisRiskManager", "→", "TennisTrader", "→", "TennisSettlement",
          ].map((item, i) => (
            <span key={i} className={item === "→" ? "text-gray-600" : "text-amber-300"}>{item}</span>
          ))}
        </div>
        <div className="mt-3 text-[10px] text-gray-600 font-mono">
          ContextService v5.0: LeagueStrengthAnalyzer · LeagueOddsProfiler · LeaguePredictabilityTracker · MatchTypeClassifier · CompetitionTypeFactors
        </div>
      </div>
    </div>
  );
}

// ─── Bets Tab ─────────────────────────────────────────────────────────────────

function BetsTab({ bets, summary, leaguePnl }: { bets: Bet[]; summary: Summary; leaguePnl: LeaguePnl[] }) {
  const [filter, setFilter] = useState<string>("all");
  const [paperOnly, setPaperOnly] = useState(false);

  const filtered = bets.filter((b) => {
    if (filter !== "all" && b.status !== filter) return false;
    if (paperOnly && !b.paper) return false;
    return true;
  });

  const pnl = summary.pnl;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Bets", value: String(summary.total_bets), color: "text-white" },
          { label: "Win Rate", value: `${summary.win_rate}%`, color: "text-cyan-300" },
          { label: "P&L", value: `${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}€`, color: pnl >= 0 ? "text-green-400" : "text-red-400" },
          { label: "Avg Odds", value: summary.avg_odds, color: "text-fuchsia-300" },
        ].map((kpi) => (
          <div key={kpi.label} className="glass-card p-4 text-center">
            <div className={`text-xl font-black ${kpi.color}`}>{kpi.value}</div>
            <div className="text-xs text-gray-400 mt-1">{kpi.label}</div>
          </div>
        ))}
      </div>

      {leaguePnl.length > 0 && (
        <div className="glass-card p-4">
          <h3 className="text-xs font-mono text-cyan-400/70 uppercase tracking-wider mb-3">P&L by League</h3>
          <div className="space-y-2">
            {leaguePnl.map((l) => (
              <div key={l.league} className="flex items-center gap-3">
                <span className="text-xs font-mono w-8 text-gray-400">{LEAGUE_FLAGS[l.league] ?? "⚽"}</span>
                <span className="text-xs font-mono text-gray-300 w-8">{l.league}</span>
                <div className="flex-1 bg-white/5 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${Number(l.pnl) >= 0 ? "bg-green-500" : "bg-red-500"}`}
                    style={{ width: `${Math.min(Math.abs(Number(l.pnl)) / 20, 100)}%` }}
                  />
                </div>
                <span className={`text-xs font-mono w-16 text-right ${Number(l.pnl) >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {Number(l.pnl) >= 0 ? "+" : ""}{Number(l.pnl).toFixed(2)}€
                </span>
                <span className="text-xs text-gray-600 font-mono">{l.won}W/{l.lost}L</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {["all", "won", "lost", "pending"].map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1 rounded-full border text-xs font-mono transition ${
              filter === s ? "border-cyan-400 text-cyan-300 bg-cyan-400/10" : "border-white/10 text-gray-400 hover:border-cyan-400/40"
            }`}>
            {s}
          </button>
        ))}
        <button onClick={() => setPaperOnly(!paperOnly)}
          className={`px-3 py-1 rounded-full border text-xs font-mono transition ${
            paperOnly ? "border-yellow-400 text-yellow-400 bg-yellow-400/10" : "border-white/10 text-gray-400"
          }`}>
          Demo only
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="glass-card p-8 text-center text-gray-400 font-mono">No bets match filters</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((bet) => {
            const hasBetfairConfirmation = !bet.paper && Boolean(bet.betfair_bet_id);
            const executionLabel = bet.paper ? "DEMO" : hasBetfairConfirmation ? "LIVE" : "UNCONFIRMED";
            const executionClass = bet.paper
              ? "text-yellow-400"
              : hasBetfairConfirmation
                ? "text-green-400"
                : "text-red-300";
            return (
            <div key={bet.id} className={`glass-card p-4 ${
              bet.status === "won" ? "border-green-400/20" :
              bet.status === "lost" || bet.status === "execution_rejected" ? "border-red-400/20" : ""
            }`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-white">
                      {bet.home_team && bet.away_team
                        ? `${bet.home_team} vs ${bet.away_team}`
                        : <span className="text-gray-400">Match <span className="text-cyan-400 font-mono">#{bet.match_external_id}</span></span>
                      }
                    </span>
                    {bet.league && (
                      <span className="text-xs text-gray-500 font-mono">{LEAGUE_FLAGS[bet.league] ?? "⚽"} {bet.league}</span>
                    )}
                    <span className={`text-xs font-mono ${executionClass}`}>
                      [{executionLabel}]
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="text-xs font-mono text-cyan-300 font-bold">{bet.selection}</span>
                    <span className="text-xs font-mono text-gray-400">@ {bet.odds?.toFixed(2)}</span>
                    <span className="text-xs font-mono text-gray-400">stake: {bet.stake?.toFixed(2)}€</span>
                    {bet.kickoff && (
                      <span className="text-xs font-mono text-gray-600">{fmtKickoff(bet.kickoff)}</span>
                    )}
                  </div>
                  {bet.thesis && (
                    <p className="text-[10px] text-gray-500 mt-1 font-mono leading-relaxed line-clamp-2">{bet.thesis}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <StatusBadge status={bet.status} />
                  {bet.profit_loss != null ? (
                    <span className={`text-sm font-bold font-mono ${bet.profit_loss >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {bet.profit_loss >= 0 ? "+" : ""}{bet.profit_loss.toFixed(2)}€
                    </span>
                  ) : (
                    <span className="text-xs text-gray-600 font-mono">pending</span>
                  )}
                </div>
              </div>
              <div className="text-[10px] text-gray-700 font-mono mt-2">Placed: {timeAgo(bet.placed_at)}</div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── History Tab ──────────────────────────────────────────────────────────────

function HistoryTab({ history, stats, loading }: {
  history: HistoryMatch[];
  stats: HistoryStats | null;
  loading: boolean;
}) {
  const [leagueFilter, setLeagueFilter] = useState("ALL");
  const [resultFilter, setResultFilter] = useState("all");

  const allLeagues = [...new Set(history.map((h) => h.league))];

  const filtered = history.filter((h) => {
    if (leagueFilter !== "ALL" && h.league !== leagueFilter) return false;
    if (resultFilter === "bet" && !h.bet_status) return false;
    if (resultFilter === "won" && h.bet_status !== "won") return false;
    if (resultFilter === "lost" && h.bet_status !== "lost") return false;
    if (resultFilter === "no-bet" && h.bet_status) return false;
    return true;
  });

  const getBetOutcomeColor = (h: HistoryMatch) => {
    if (!h.bet_status) return "border-white/10";
    if (h.bet_status === "won") return "border-green-400/30";
    if (h.bet_status === "lost") return "border-red-400/30";
    return "border-yellow-400/20";
  };

  const getModelCorrectness = (h: HistoryMatch) => {
    if (!h.bet_status || h.bet_status === "pending") return null;
    return h.bet_status === "won";
  };

  return (
    <div className="space-y-6">
      {/* Stats strip */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
          {[
            { label: "Matches", value: String(stats.total_matches), color: "text-white" },
            { label: "Bets Placed", value: String(stats.bets_placed), color: "text-cyan-300" },
            { label: "Won", value: String(stats.won), color: "text-green-400" },
            { label: "Lost", value: String(stats.lost), color: "text-red-400" },
            { label: "Hit Rate", value: `${stats.accuracy}%`, color: "text-yellow-400" },
            { label: "ROI", value: `${Number(stats.roi) >= 0 ? "+" : ""}${stats.roi}%`, color: Number(stats.roi) >= 0 ? "text-green-400" : "text-red-400" },
            { label: "Return", value: `${Number(stats.total_return) >= 0 ? "+" : ""}${stats.total_return}€`, color: Number(stats.total_return) >= 0 ? "text-green-400" : "text-red-400" },
          ].map((kpi) => (
            <div key={kpi.label} className="glass-card p-3 text-center">
              <div className={`text-lg font-black ${kpi.color}`}>{kpi.value}</div>
              <div className="text-[10px] text-gray-500 mt-0.5 font-mono">{kpi.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 flex-wrap">
          {[
            { key: "all", label: "All matches" },
            { key: "bet", label: "With bet" },
            { key: "won", label: "Won" },
            { key: "lost", label: "Lost" },
            { key: "no-bet", label: "No bet placed" },
          ].map((f) => (
            <button key={f.key} onClick={() => setResultFilter(f.key)}
              className={`px-3 py-1 rounded-full border text-xs font-mono transition ${
                resultFilter === f.key ? "border-cyan-400 text-cyan-300 bg-cyan-400/10" : "border-white/10 text-gray-400 hover:border-cyan-400/40"
              }`}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 flex-wrap">
          {["ALL", ...allLeagues].map((l) => (
            <button key={l} onClick={() => setLeagueFilter(l)}
              className={`px-3 py-1 rounded-full border text-xs font-mono transition ${
                leagueFilter === l ? "border-fuchsia-400 text-fuchsia-300 bg-fuchsia-400/10" : "border-white/10 text-gray-400 hover:border-fuchsia-400/40"
              }`}>
              {LEAGUE_FLAGS[l] ?? ""} {l}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-[10px] font-mono text-gray-500">
        <span><span className="inline-block w-3 h-3 rounded-full bg-green-400/50 mr-1 align-middle"></span>Bet won</span>
        <span><span className="inline-block w-3 h-3 rounded-full bg-red-400/50 mr-1 align-middle"></span>Bet lost</span>
        <span><span className="inline-block w-3 h-3 rounded-full bg-yellow-400/50 mr-1 align-middle"></span>Pending</span>
        <span><span className="inline-block w-3 h-3 rounded-full bg-gray-600 mr-1 align-middle"></span>No bet placed</span>
      </div>

      {loading ? (
        <div className="glass-card p-12 text-center text-gray-400 font-mono">
          <div className="animate-pulse">Loading last 30 days history…</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-8 text-center text-gray-400 font-mono">
          {history.length === 0 ? "No historical data yet — place some bets first" : "No matches for selected filters"}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((h) => {
            const correct = getModelCorrectness(h);
            return (
              <div key={h.match_id} className={`glass-card p-3 ${getBetOutcomeColor(h)}`}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  {/* Match info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-gray-500 font-mono">{LEAGUE_FLAGS[h.league] ?? "⚽"} {h.league}</span>
                      <span className="text-sm font-bold text-white">
                        {h.home_team} <span className="text-gray-500 font-normal text-xs">vs</span> {h.away_team}
                      </span>
                    </div>
                    <div className="text-[10px] text-gray-600 font-mono mt-0.5">{fmtKickoff(h.kickoff)}</div>
                  </div>

                  {/* Model prediction */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <div className="text-[10px] text-gray-600 font-mono">Model prediction</div>
                      <div className="text-xs font-mono text-cyan-300">{h.best_selection ?? "—"}</div>
                      {h.edge != null && (
                        <div className={`text-[10px] font-mono ${h.edge > 0 ? "text-green-500" : "text-gray-500"}`}>
                          edge {h.edge > 0 ? "+" : ""}{(h.edge * 100).toFixed(1)}%
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bet info + result */}
                  <div className="flex items-center gap-2 shrink-0">
                    {h.bet_status ? (
                      <div className="text-right">
                        <div className="text-[10px] text-gray-600 font-mono">
                          Bet: {h.bet_selection} @ {h.bet_odds?.toFixed(2)}
                        </div>
                        <div className="flex items-center justify-end gap-1 mt-0.5">
                          <StatusBadge status={h.bet_status} />
                          {correct !== null && (
                            <span className={`text-[10px] font-mono ${correct ? "text-green-400" : "text-red-400"}`}>
                              {correct ? "✓ model correct" : "✗ model wrong"}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="text-[10px] text-gray-600 font-mono">no bet placed</span>
                    )}
                  </div>
                </div>

                {/* Probability mini-bar */}
                <div className="flex gap-1 mt-2">
                  {[
                    { label: "H", p: h.p_home, color: "bg-cyan-400" },
                    { label: "D", p: h.p_draw, color: "bg-yellow-400" },
                    { label: "A", p: h.p_away, color: "bg-fuchsia-400" },
                  ].map(({ label, p, color }) => (
                    <div key={label} className="flex items-center gap-1 flex-1">
                      <span className="text-[9px] text-gray-600 font-mono w-3">{label}</span>
                      <div className="flex-1 bg-white/5 rounded-full h-1 overflow-hidden">
                        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.round(p * 100)}%` }} />
                      </div>
                      <span className="text-[9px] text-gray-600 font-mono w-6 text-right">{Math.round(p * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Predictions Tab ──────────────────────────────────────────────────────────

type SortMode = "kickoff_asc" | "kickoff_desc" | "edge_desc" | "importance_desc";
type ImportanceFilter = "all" | "european" | "top5" | "value";

function PredictionsTab({
  predictions, computedAt, loading, refreshing, isStale, onRefresh,
}: {
  predictions: Prediction[];
  computedAt: string | null;
  loading: boolean;
  refreshing: boolean;
  isStale: boolean;
  onRefresh: () => void;
}) {
  const [leagueFilter, setLeagueFilter] = useState("ALL");
  const [valueOnly, setValueOnly] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("kickoff_asc");
  const [importanceFilter, setImportanceFilter] = useState<ImportanceFilter>("all");
  const [matchTypeFilter, setMatchTypeFilter] = useState("ALL");

  const allLeagues = [...new Set(predictions.map((p) => p.league))];
  const allMatchTypes = [...new Set(predictions.map((p) => p.match_type ?? "STANDARD").filter(Boolean))];
  const hasMatchTypes = allMatchTypes.some((t) => t !== "STANDARD" && t !== "ROTATION");

  const filtered = predictions
    .filter((p) => {
      if (leagueFilter !== "ALL" && p.league !== leagueFilter) return false;
      if (valueOnly && (p.edge == null || p.edge <= 0.03)) return false;
      if (importanceFilter === "european" && !["CL", "EL"].includes(p.league)) return false;
      if (importanceFilter === "top5" && !["PL", "SA", "PD", "BL1", "FL1"].includes(p.league)) return false;
      if (importanceFilter === "value" && (p.edge == null || p.edge <= 0.03)) return false;
      if (matchTypeFilter !== "ALL" && (p.match_type ?? "STANDARD") !== matchTypeFilter) return false;
      return true;
    })
    .sort((a, b) => {
      switch (sortMode) {
        case "kickoff_asc":  return new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime();
        case "kickoff_desc": return new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime();
        case "edge_desc":    return (b.edge ?? -1) - (a.edge ?? -1);
        case "importance_desc": return matchImportance(b) - matchImportance(a);
        default: return 0;
      }
    });

  const valueBets = predictions.filter((p) => p.edge != null && p.edge > 0.03);

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-xs text-gray-500 font-mono">
          Dixon-Coles · Pi Rating · xG · Form · next 30 days ·{" "}
          {computedAt ? `computed ${timeAgo(computedAt)}` : "loading…"}
          {valueBets.length > 0 && (
            <span className="ml-2 text-green-400">· {valueBets.length} value bet{valueBets.length > 1 ? "s" : ""}</span>
          )}
        </p>
        <button onClick={onRefresh} disabled={refreshing}
          className="px-3 py-1.5 rounded-lg border border-cyan-400/40 text-cyan-300 text-xs font-mono hover:bg-cyan-400/10 transition disabled:opacity-40">
          {refreshing ? "Computing…" : "↻ Refresh"}
        </button>
      </div>
      {isStale && !loading && (
        <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-yellow-400/30 bg-yellow-400/5 text-xs font-mono text-yellow-400">
          <span>⚠️ Predictions older than 1 hour — click Refresh to recompute (takes ~90s)</span>
        </div>
      )}

      {/* Filter bar */}
      <div className="glass-card p-3 space-y-3">
        {/* Row 1: Sort + Importance */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] text-gray-600 font-mono uppercase tracking-wider w-12 shrink-0">Sort</span>
          {([
            { key: "kickoff_asc", label: "Closest first" },
            { key: "kickoff_desc", label: "Farthest first" },
            { key: "edge_desc", label: "Best edge" },
            { key: "importance_desc", label: "Most important" },
          ] as { key: SortMode; label: string }[]).map((s) => (
            <button key={s.key} onClick={() => setSortMode(s.key)}
              className={`px-2.5 py-1 rounded-full border text-xs font-mono transition ${
                sortMode === s.key ? "border-cyan-400 text-cyan-300 bg-cyan-400/10" : "border-white/10 text-gray-400 hover:border-cyan-400/40"
              }`}>
              {s.label}
            </button>
          ))}
        </div>

        {/* Row 2: Importance / category */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] text-gray-600 font-mono uppercase tracking-wider w-12 shrink-0">Cat.</span>
          {([
            { key: "all", label: "All" },
            { key: "european", label: "⭐ European" },
            { key: "top5", label: "Top 5 leagues" },
            { key: "value", label: "+EV only" },
          ] as { key: ImportanceFilter; label: string }[]).map((f) => (
            <button key={f.key} onClick={() => setImportanceFilter(f.key)}
              className={`px-2.5 py-1 rounded-full border text-xs font-mono transition ${
                importanceFilter === f.key ? "border-fuchsia-400 text-fuchsia-300 bg-fuchsia-400/10" : "border-white/10 text-gray-400 hover:border-fuchsia-400/40"
              }`}>
              {f.label}
            </button>
          ))}
          <button onClick={() => setValueOnly(!valueOnly)}
            className={`px-2.5 py-1 rounded-full border text-xs font-mono transition ${
              valueOnly ? "border-green-400 text-green-400 bg-green-400/10" : "border-white/10 text-gray-400 hover:border-green-400/40"
            }`}>
            +EV Only
          </button>
        </div>

        {/* Row 3: League filter */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] text-gray-600 font-mono uppercase tracking-wider w-12 shrink-0">League</span>
          {["ALL", ...allLeagues].map((l) => (
            <button key={l} onClick={() => setLeagueFilter(l)}
              className={`px-2.5 py-1 rounded-full border text-xs font-mono transition ${
                leagueFilter === l ? "border-cyan-400 text-cyan-300 bg-cyan-400/10" : "border-white/10 text-gray-400 hover:border-cyan-400/40"
              }`}>
              {LEAGUE_FLAGS[l] ?? ""} {l}
            </button>
          ))}
        </div>

        {/* Row 4: Match type filter (only shown if Python pipeline provides types) */}
        {hasMatchTypes && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] text-gray-600 font-mono uppercase tracking-wider w-12 shrink-0">Type</span>
            {["ALL", ...allMatchTypes].map((t) => (
              <button key={t} onClick={() => setMatchTypeFilter(t)}
                className={`px-2.5 py-1 rounded-full border text-xs font-mono transition ${
                  matchTypeFilter === t
                    ? "border-amber-400 text-amber-300 bg-amber-400/10"
                    : "border-white/10 text-gray-400 hover:border-amber-400/40"
                }`}>
                {t === "ALL" ? "All types" : (MATCH_TYPE_META[t]?.label ?? t)}
              </button>
            ))}
          </div>
        )}

        {/* Results count */}
        <div className="text-[10px] text-gray-600 font-mono">
          Showing {filtered.length} of {predictions.length} predictions
          {valueBets.length > 0 && ` · ${valueBets.length} value bets`}
        </div>
      </div>

      {loading ? (
        <div className="glass-card p-12 text-center text-gray-400 font-mono">
          <div className="animate-pulse">Computing Dixon-Coles + Pi Rating + xG predictions…</div>
          <div className="text-xs mt-2 text-gray-600">First load may take ~90s while fetching historical data</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-8 text-center text-gray-400 font-mono">
          {predictions.length === 0 ? "No predictions yet — click Refresh" : "No matches for selected filters"}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((p) => <PredictionCard key={p.match_id} p={p} />)}
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const [tab, setTab] = useState<Tab>("overview");
  const [slipSelection, setSlipSelection] = useState<SlipSelection | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [bets, setBets] = useState<Bet[]>([]);
  const [leaguePnl, setLeaguePnl] = useState<LeaguePnl[]>([]);
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [tennisMatches, setTennisMatches] = useState<TennisMatch[]>([]);
  const [tennisSummary, setTennisSummary] = useState<TennisSummary | null>(null);
  const [tennisComputedAt, setTennisComputedAt] = useState<string | null>(null);
  const [computedAt, setComputedAt] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryMatch[]>([]);
  const [historyStats, setHistoryStats] = useState<HistoryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [predLoading, setPredLoading] = useState(true);
  const [tennisLoading, setTennisLoading] = useState(true);
  const [predStale, setPredStale] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const resp = await fetch("/api/data");
      if (resp.ok) {
        const data = await resp.json();
        setSummary(data.summary);
        setBets(data.bets ?? []);
        setLeaguePnl(data.league_pnl ?? []);
        setLastUpdate(new Date().toLocaleTimeString());
      }
    } catch { /**/ } finally { setLoading(false); }
  }, []);

  const fetchPredictions = useCallback(async () => {
    setPredLoading(true);
    try {
      const resp = await fetch("/api/predictions");
      if (resp.ok) {
        const data = await resp.json();
        setPredictions(data.predictions ?? []);
        setComputedAt(data.computed_at ?? null);
        setPredStale(data.is_stale ?? false);
      }
    } catch { /**/ } finally { setPredLoading(false); }
  }, []);

  const fetchAgents = useCallback(async () => {
    try {
      const resp = await fetch("/api/health");
      if (resp.ok) {
        const data = await resp.json();
        setAgents(data.agents ?? []);
      }
    } catch { /**/ }
  }, []);

  const fetchTennis = useCallback(async () => {
    setTennisLoading(true);
    try {
      const resp = await fetch("/api/tennis");
      if (resp.ok) {
        const data = await resp.json();
        setTennisMatches(data.matches ?? []);
        setTennisSummary(data.summary ?? null);
        setTennisComputedAt(data.computed_at ?? null);
      }
    } catch { /**/ } finally { setTennisLoading(false); }
  }, []);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const resp = await fetch("/api/history");
      if (resp.ok) {
        const data = await resp.json();
        setHistory(data.history ?? []);
        setHistoryStats(data.stats ?? null);
      }
    } catch { /**/ } finally { setHistoryLoading(false); }
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetch("/api/predictions", { method: "POST" });
      await fetchPredictions();
    } finally { setRefreshing(false); }
  };

  useEffect(() => {
    queueMicrotask(() => {
      void fetchData();
      void fetchPredictions();
      void fetchAgents();
      void fetchTennis();
    });
    const dataInt = setInterval(fetchData, 30_000);
    const predInt = setInterval(fetchPredictions, 3_600_000);
    const agentInt = setInterval(fetchAgents, 60_000);
    const tennisInt = setInterval(fetchTennis, 120_000);
    return () => { clearInterval(dataInt); clearInterval(predInt); clearInterval(agentInt); clearInterval(tennisInt); };
  }, [fetchData, fetchPredictions, fetchAgents, fetchTennis]);

  // Fetch history when tab is first opened
  useEffect(() => {
    if (tab === "history" && history.length === 0) {
      queueMicrotask(() => void fetchHistory());
    }
  }, [tab, history.length, fetchHistory]);

  const pnl = summary?.pnl ?? 0;
  const valueBets = predictions.filter((p) => p.edge != null && p.edge > 0.03);
  const aliveAgents = agents.filter((a) => a.status === "alive").length;
  const totalAgents = agents.length || 16;

  const tennisValueBets = tennisMatches.filter((m) => m.edge != null && m.edge > 0.03);
  const navItems: { tab: Tab; label: string; value?: string; tone?: string }[] = [
    { tab: "overview", label: "Edge Desk", value: String(valueBets.length + tennisValueBets.length), tone: "green" },
    { tab: "bets", label: "My Bets", value: String(summary?.total_bets ?? 0) },
    { tab: "history", label: "History", value: String(historyStats?.total_matches ?? history.length) },
    { tab: "agents", label: "Agents", value: `${aliveAgents}/${totalAgents}` },
  ];

  return (
    <main className="sportsbook-shell">
      <section className="book-topbar">
        <div>
          <p className="eyebrow">Agentic Markets OS</p>
          <h1>Sportsbook Edge Desk</h1>
        </div>
        <div className="topbar-stats">
          <span>Live bankroll</span>
          <strong className={pnl >= 0 ? "text-green-300" : "text-red-300"}>{loading ? "—" : `${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}€`}</strong>
          <span>Betfair live</span>
          <span>{lastUpdate || "not synced"}</span>
          <span>{aliveAgents}/{totalAgents} agents</span>
        </div>
      </section>

      <section className="book-layout">
        <aside className="sports-rail">
          <div className="rail-title">Sports</div>
          {navItems.map((item) => (
            <button key={item.tab} className={`rail-item ${tab === item.tab ? "is-active" : ""} ${item.tone ?? ""}`} onClick={() => setTab(item.tab)}>
              <span>{item.label}</span>
              {item.value && <strong>{item.value}</strong>}
            </button>
          ))}
          <button className="rail-refresh" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? "Computing..." : "Refresh odds"}
          </button>
          <div className="rail-note">
            <strong>Live football</strong>
            <span>Football orders go live through RiskManager → TraderAgent → Betfair Exchange. Tennis is paper mode — settlement loop active.</span>
          </div>
        </aside>

        <section className="book-main">
          <div className="book-main-head">
            <div>
              <p className="eyebrow">{tab === "overview" ? "Live sportsbook" : navItems.find((n) => n.tab === tab)?.label}</p>
              <h2>
                {tab === "overview" && "Markets"}
                {tab === "predictions" && "Football markets"}
                {tab === "tennis" && "Tennis markets"}
                {tab === "bets" && "My bets"}
                {tab === "history" && "Settled history"}
                {tab === "agents" && "Agent health"}
              </h2>
            </div>
            <div className="book-head-kpis">
              <span>{predictions.length + tennisMatches.length} events</span>
              <span>{valueBets.length + tennisValueBets.length} +EV</span>
              <span>{loading ? "—" : `${summary?.win_rate ?? "0"}% win`}</span>
            </div>
          </div>

          {tab === "overview" && (
            <SportsbookBoard
              predictions={predictions}
              tennisMatches={tennisMatches}
              onSelect={setSlipSelection}
            />
          )}
          {tab === "tennis" && (
            <TennisTab
              matches={tennisMatches}
              summary={tennisSummary}
              loading={tennisLoading}
              computedAt={tennisComputedAt}
              agents={agents}
            />
          )}
          {tab === "predictions" && (
            <PredictionsTab
              predictions={predictions}
              computedAt={computedAt}
              loading={predLoading}
              refreshing={refreshing}
              isStale={predStale}
              onRefresh={handleRefresh}
            />
          )}
          {tab === "bets" && (
            <BetsTab bets={bets} summary={summary ?? {
              total_bets: 0, won: 0, lost: 0, pending: 0, pnl: 0,
              win_rate: "0.0", avg_odds: "0.00", avg_stake: "0.00",
            }} leaguePnl={leaguePnl} />
          )}
          {tab === "history" && (
            <HistoryTab
              history={history}
              stats={historyStats}
              loading={historyLoading}
            />
          )}
          {tab === "agents" && <AgentStatusTab agents={agents} />}
        </section>

        <BetSlip
          key={slipSelection ? `${slipSelection.sport}-${slipSelection.id}-${slipSelection.selection}` : "empty-slip"}
          selection={slipSelection}
          onClear={() => setSlipSelection(null)}
        />
      </section>

      <footer className="text-center text-xs text-gray-600 pb-8 font-mono">
        Agentic Markets OS v5.3 · 16 Agents · Football Live Betfair Exchange · Tennis Paper Mode
      </footer>
    </main>
  );
}
