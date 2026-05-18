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
  settled_at?: string | null;
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

type Tab = "overview" | "portfolio" | "plans" | "predictions" | "tennis" | "bets" | "partners" | "settings" | "agents";

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
  // Elo analysis fields
  elo_p1?: number | null;
  elo_p2?: number | null;
  elo_p1_overall?: number | null;
  elo_p2_overall?: number | null;
  surface_matches_p1?: number | null;
  surface_matches_p2?: number | null;
  elo_raw_p1?: number | null;
  elo_raw_p2?: number | null;
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

interface TennisBet {
  id: number;
  match_id: string;
  selection: string;
  player_name: string | null;
  odds: number;
  stake: number;
  paper: boolean;
  status: string;
  profit_loss: number | null;
  placed_at: string;
  settled_at?: string | null;
  betfair_bet_id: string | null;
  tournament: string | null;
  surface: string | null;
  player1: string | null;
  player2: string | null;
  scheduled_at: string | null;
}

type PortfolioBet = {
  id: string;
  sport: "Football" | "Tennis";
  event: string;
  selection: string;
  odds: number;
  stake: number;
  status: string;
  profitLoss: number;
  placedAt: string;
  settledAt: string | null;
};

type ClientProfile = {
  name: string;
  email: string;
  plan: "unpaid" | "pending_payment" | "base" | "premium" | "admin_full";
  language?: "it" | "en";
  txHash?: string;
  requestedPlan?: "base" | "premium";
  betfair?: {
    username?: string;
    appKeyLast4?: string;
    status?: "not_connected" | "pending_review" | "connected";
  };
  risk?: {
    maxStake: number;
    dailyStopLoss: number;
    maxBetsPerDay: number;
    mode: "approval" | "automatic";
  };
};

type ClientAuthIntent = "login" | "create";

const USDT_TRC20_ADDRESS = "PENDING_WALLET_ADDRESS";
const PLAN_PRICES = {
  base: { eur: 29, label: "Base · Signal Desk" },
  premium: { eur: 199, label: "Premium · Autopilot Agents" },
} as const;
const CLIENT_PROFILE_KEY = "agentic-client-profile";
const CLIENT_PROFILES_KEY = "agentic-client-profiles";
const PRIVATE_BALANCE_PLACEHOLDER = "LOCK";

interface TennisBetSummary {
  total: number;
  won: number;
  lost: number;
  pending: number;
  pnl: number;
}

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
            {footballRows.map((p) => <PredictionCard key={p.match_id} p={p} onSelect={onSelect} />)}
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
            {tennisRows.map((m) => <TennisMatchCard key={m.id} m={m} onSelect={onSelect} />)}
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
          <button className={`place-live ${isFootballLive ? "is-review" : "is-disabled"}`}>
            {isFootballLive ? "Review football order" : "Save tennis signal"}
          </button>
          <p className="ticket-note">
            {isFootballLive
              ? "Football can execute live only after risk approval and Betfair returns a confirmed betId."
              : "Tennis is signal-only until runner mapping is fully verified for live execution."}
          </p>
        </div>
      )}
    </aside>
  );
}

function ClientInsightStrip({
  summary,
  predictions,
  tennisMatches,
  bets,
  computedAt,
  tennisComputedAt,
}: {
  summary: Summary | null;
  predictions: Prediction[];
  tennisMatches: TennisMatch[];
  bets: Bet[];
  computedAt: string | null;
  tennisComputedAt: string | null;
}) {
  const footballValue = predictions.filter((p) => p.edge != null && p.edge > 0.03).length;
  const tennisValue = tennisMatches.filter((m) => m.edge != null && m.edge > 0.025).length;
  const liveConfirmed = bets.filter((b) => !b.paper && Boolean(b.betfair_bet_id)).length;
  const rejected = bets.filter((b) => FAILED_STATUSES.includes(b.status)).length;
  const pnl = summary?.pnl ?? 0;

  return (
    <section className="client-summary-strip" aria-label="Client desk summary">
      <div>
        <span className="metric-label">Session P&L</span>
        <strong className={pnl >= 0 ? "text-green-300" : "text-red-300"}>{`${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}€`}</strong>
        <em>{summary?.pending ?? 0} pending bets</em>
      </div>
      <div>
        <span className="metric-label">Football Edge</span>
        <strong>{footballValue}</strong>
        <em>{computedAt ? `updated ${timeAgo(computedAt)}` : "waiting for markets"}</em>
      </div>
      <div>
        <span className="metric-label">Tennis Signals</span>
        <strong>{tennisValue}</strong>
        <em>{tennisComputedAt ? `updated ${timeAgo(tennisComputedAt)}` : "signal layer active"}</em>
      </div>
      <div>
        <span className="metric-label">Execution Quality</span>
        <strong>{liveConfirmed}</strong>
        <em>{rejected ? `${rejected} blocked/rejected safely` : "betId required for live"}</em>
      </div>
    </section>
  );
}

function money(value: number) {
  return `€${value.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function betEventName(bet: Bet) {
  if (bet.home_team && bet.away_team) return `${bet.home_team} vs ${bet.away_team}`;
  return bet.match_external_id || `Betfair ${bet.betfair_bet_id || bet.id}`;
}

function buildPortfolioBets(bets: Bet[], tennisBets: TennisBet[]): PortfolioBet[] {
  const football: PortfolioBet[] = bets
    .filter((bet) => ["pending", "won", "lost"].includes(bet.status))
    .map((bet) => ({
      id: `football-${bet.id}`,
      sport: "Football",
      event: betEventName(bet),
      selection: bet.selection,
      odds: Number(bet.odds || 0),
      stake: Number(bet.stake || 0),
      status: bet.status,
      profitLoss: Number(bet.profit_loss || 0),
      placedAt: bet.placed_at,
      settledAt: bet.settled_at || null,
    }));

  const tennis: PortfolioBet[] = tennisBets
    .filter((bet) => ["pending", "won", "lost"].includes(bet.status))
    .map((bet) => ({
      id: `tennis-${bet.id}`,
      sport: "Tennis",
      event: bet.player1 && bet.player2 ? `${bet.player1} vs ${bet.player2}` : bet.match_id,
      selection: bet.player_name || bet.selection,
      odds: Number(bet.odds || 0),
      stake: Number(bet.stake || 0),
      status: bet.status,
      profitLoss: Number(bet.profit_loss || 0),
      placedAt: bet.placed_at,
      settledAt: bet.settled_at || null,
    }));

  return [...football, ...tennis].sort((a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime());
}

function buildEquityPoints(portfolioBets: PortfolioBet[], startingBalance: number) {
  const settled = portfolioBets
    .filter((bet) => bet.status !== "pending" && bet.profitLoss !== 0)
    .sort((a, b) => new Date(a.settledAt || a.placedAt).getTime() - new Date(b.settledAt || b.placedAt).getTime());

  const points = [{ label: "Start", balance: startingBalance }];
  let balance = startingBalance;
  for (const bet of settled) {
    balance = Math.round((balance + bet.profitLoss) * 100) / 100;
    points.push({
      label: new Date(bet.settledAt || bet.placedAt).toLocaleDateString("it-IT", { day: "2-digit", month: "short" }),
      balance,
    });
  }
  return points;
}

function PortfolioChart({ points }: { points: Array<{ label: string; balance: number }> }) {
  const width = 720;
  const height = 220;
  const padX = 28;
  const padY = 24;
  const values = points.map((point) => point.balance);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(0.01, max - min);
  const coords = points.map((point, index) => {
    const x = points.length === 1 ? padX : padX + (index / (points.length - 1)) * (width - padX * 2);
    const y = height - padY - ((point.balance - min) / spread) * (height - padY * 2);
    return { ...point, x, y };
  });
  const line = coords.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `${padX},${height - padY} ${line} ${width - padX},${height - padY}`;
  const positive = points[points.length - 1]?.balance >= points[0]?.balance;
  const stroke = positive ? "#22C55E" : "#EF4444";

  return (
    <div className="portfolio-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Portfolio equity chart">
        <defs>
          <linearGradient id="portfolioFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((i) => {
          const y = padY + i * ((height - padY * 2) / 3);
          return <line key={i} x1={padX} x2={width - padX} y1={y} y2={y} className="portfolio-grid-line" />;
        })}
        <polygon points={area} fill="url(#portfolioFill)" />
        <polyline points={line} fill="none" stroke={stroke} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {coords.map((point, index) => (
          <circle key={`${point.label}-${index}`} cx={point.x} cy={point.y} r="4" fill={stroke} />
        ))}
      </svg>
      <div className="portfolio-chart-axis">
        <span>{points[0]?.label ?? "Start"}</span>
        <strong>{money(points[points.length - 1]?.balance ?? 0)}</strong>
        <span>{points[points.length - 1]?.label ?? "Now"}</span>
      </div>
    </div>
  );
}

function PortfolioTab({
  summary,
  bets,
  tennisBetSummary,
  tennisBets,
  onOpenDesk,
  startingBalance = 0,
}: {
  summary: Summary | null;
  bets: Bet[];
  tennisBetSummary: TennisBetSummary | null;
  tennisBets: TennisBet[];
  onOpenDesk: () => void;
  startingBalance?: number;
}) {
  const portfolioBets = buildPortfolioBets(bets, tennisBets);
  const footballPnl = Number(summary?.pnl || 0);
  const tennisPnl = Number(tennisBetSummary?.pnl || 0);
  const pnl = Math.round((footballPnl + tennisPnl) * 100) / 100;
  const currentBalance = Math.round((startingBalance + pnl) * 100) / 100;
  const settled = portfolioBets.filter((bet) => bet.status !== "pending");
  const won = settled.filter((bet) => bet.status === "won").length;
  const winRate = settled.length ? (won / settled.length) * 100 : 0;
  const activeBets = portfolioBets.filter((bet) => bet.status === "pending").length;
  const totalPnLPct = startingBalance ? (pnl / startingBalance) * 100 : 0;
  const equityPoints = buildEquityPoints(portfolioBets, startingBalance);
  const footballCount = portfolioBets.filter((bet) => bet.sport === "Football").length;
  const tennisCount = portfolioBets.filter((bet) => bet.sport === "Tennis").length;
  const totalSports = footballCount + tennisCount || 1;

  return (
    <div className="portfolio-view">
      <section className="portfolio-hero">
        <div>
          <p className="eyebrow">Client dashboard</p>
          <h3>Portfolio unico</h3>
          <span>Performance cliente e desk operativo sono ora nella stessa pagina.</span>
        </div>
        <button onClick={onOpenDesk}>Open Desk</button>
      </section>

      <section className="portfolio-balance">
        <div>
          <span className="metric-label">Net Asset Value</span>
          <strong>{money(currentBalance)}</strong>
          <em className={pnl >= 0 ? "text-green-300" : "text-red-300"}>
            {pnl >= 0 ? "+" : ""}{money(pnl)} · {totalPnLPct >= 0 ? "+" : ""}{totalPnLPct.toFixed(2)}%
          </em>
        </div>
        <div className="portfolio-stat-strip">
          <div>
            <span>Win Rate</span>
            <strong>{winRate.toFixed(1)}%</strong>
          </div>
          <div>
            <span>Posizioni Aperte</span>
            <strong>{activeBets}</strong>
          </div>
          <div>
            <span>Capitale Iniziale</span>
            <strong>{money(startingBalance)}</strong>
          </div>
        </div>
      </section>

      <section className="portfolio-grid">
        <div className="portfolio-panel portfolio-panel-wide">
          <div className="portfolio-panel-head">
            <div>
              <p className="eyebrow">Equity line</p>
              <h4>Andamento portafoglio</h4>
            </div>
            <span className={pnl >= 0 ? "is-positive" : "is-negative"}>{totalPnLPct >= 0 ? "+" : ""}{totalPnLPct.toFixed(2)}%</span>
          </div>
          <PortfolioChart points={equityPoints} />
        </div>

        <div className="portfolio-panel">
          <div className="portfolio-panel-head">
            <div>
              <p className="eyebrow">Allocation</p>
              <h4>Sport mix</h4>
            </div>
          </div>
          <div className="allocation-bars">
            <div>
              <span>Football</span>
              <strong>{Math.round((footballCount / totalSports) * 100)}%</strong>
              <em style={{ width: `${(footballCount / totalSports) * 100}%` }} />
            </div>
            <div>
              <span>Tennis</span>
              <strong>{Math.round((tennisCount / totalSports) * 100)}%</strong>
              <em style={{ width: `${(tennisCount / totalSports) * 100}%` }} />
            </div>
          </div>
        </div>
      </section>

      <section className="portfolio-panel">
        <div className="portfolio-panel-head">
          <div>
            <p className="eyebrow">Recent bets</p>
            <h4>Ultime operazioni</h4>
          </div>
          <span>{portfolioBets.length} total</span>
        </div>
        <div className="portfolio-bet-list">
          {portfolioBets.slice(0, 6).map((bet) => (
            <div key={bet.id} className="portfolio-bet-row">
              <div>
                <span>{bet.sport}</span>
                <strong>{bet.event}</strong>
                <em>{bet.selection} · {bet.odds.toFixed(2)} · {fmtKickoff(bet.placedAt)}</em>
              </div>
              <div>
                <StatusBadge status={bet.status} />
                <strong className={bet.profitLoss >= 0 ? "text-green-300" : "text-red-300"}>
                  {bet.status === "pending" ? money(bet.stake) : `${bet.profitLoss >= 0 ? "+" : ""}${money(bet.profitLoss)}`}
                </strong>
              </div>
            </div>
          ))}
          {!portfolioBets.length && <div className="book-empty">Nessuna operazione ancora disponibile.</div>}
        </div>
      </section>
    </div>
  );
}

function PreAccessLanding({
  onLogin,
  onCreate,
  onPlans,
}: {
  onLogin: () => void;
  onCreate: () => void;
  onPlans: () => void;
}) {
  return (
    <div className="preaccess-view">
      <section className="preaccess-hero">
        <div>
          <p className="eyebrow">Client access required</p>
          <h3>Signal Desk privato per edge verificati</h3>
          <span>
            Le prediction, il portafoglio, le size e il wallet di pagamento restano nascosti finché il cliente non accede
            e non sceglie un piano.
          </span>
        </div>
        <div className="preaccess-actions">
          <button onClick={onLogin}>Login</button>
          <button onClick={onCreate}>Create profile</button>
        </div>
      </section>

      <section className="preaccess-grid">
        <div>
          <span>01</span>
          <strong>Crea profilo</strong>
          <em>Account cliente con lingua, piano e stato pagamento.</em>
        </div>
        <div>
          <span>02</span>
          <strong>Scegli piano</strong>
          <em>Base per segnali manuali, Premium per agenti automatici.</em>
        </div>
        <div>
          <span>03</span>
          <strong>Invia USDT</strong>
          <em>Il wallet compare solo dentro il checkout cliente.</em>
        </div>
        <div>
          <span>04</span>
          <strong>Sblocca desk</strong>
          <em>Dati reali visibili solo dopo piano attivo o approval interno.</em>
        </div>
      </section>

      <section className="preaccess-plan-strip">
        <button onClick={onPlans}>
          <strong>Base · €29/mese</strong>
          <span>Best bets, edge e spiegazioni</span>
        </button>
        <button onClick={onPlans}>
          <strong>Premium · €199/mese</strong>
          <span>Agenti automatici con Betfair personale</span>
        </button>
      </section>
    </div>
  );
}

function PlanFeature({ children, locked = false }: { children: React.ReactNode; locked?: boolean }) {
  return (
    <li className={locked ? "is-locked" : ""}>
      <span>{locked ? "LOCK" : "OK"}</span>
      <strong>{children}</strong>
    </li>
  );
}

function CryptoPaymentBox({
  profile,
  plan,
  onSubmit,
}: {
  profile: ClientProfile | null;
  plan: "base" | "premium";
  onSubmit: (plan: "base" | "premium") => void;
}) {
  const price = PLAN_PRICES[plan];
  return (
    <div className="crypto-pay-box">
      <div>
        <span>USDT TRC20</span>
        <strong>{price.eur} EUR / mese</strong>
        {!profile && <em>Crea un profilo o accedi per selezionare il piano.</em>}
      </div>
      <button disabled={!profile} onClick={() => onSubmit(plan)}>
        {profile ? `Attiva ${price.label}` : "Crea profilo prima"}
      </button>
    </div>
  );
}

function PlansTab({
  profile,
  onOpenDesk,
  onPaymentSubmit,
}: {
  profile: ClientProfile | null;
  onOpenDesk: () => void;
  onPaymentSubmit: (plan: "base" | "premium") => void;
}) {
  return (
    <div className="plans-view">
      <section className="plans-hero">
        <div>
          <p className="eyebrow">Client plans</p>
          <h3>Due livelli, una sola esperienza</h3>
          <span>
            Il piano Base mostra i migliori bet e il razionale. Il Premium sblocca gli agenti che eseguono da soli,
            con risk control e Betfair betId verificato.
          </span>
        </div>
        <button onClick={onOpenDesk}>View live edges</button>
      </section>

      <section className="plans-grid">
        <article className="plan-card">
          <div className="plan-card-head">
            <div>
              <p className="eyebrow">Base</p>
              <h4>Signal Desk</h4>
            </div>
            <span>Manual</span>
          </div>
          <p className="plan-description">
            Per il cliente che vuole vedere le migliori opportunita, capire il perche e decidere se entrare.
          </p>
          <div className="price-line">
            <strong>€29/month</strong>
            <span>Crypto only · USDT TRC20</span>
          </div>
          <div className="plan-core-line">
            <strong>Ti mostro cosa fare</strong>
            <em>Decisione finale al cliente</em>
          </div>
          <ul className="plan-feature-list">
            <PlanFeature>Best bets ordinati per edge, confidenza e quota</PlanFeature>
            <PlanFeature>Spiegazione del razionale modello per ogni bet</PlanFeature>
            <PlanFeature>Probabilita modello vs quota di mercato</PlanFeature>
            <PlanFeature>Storico dei suggerimenti e performance</PlanFeature>
            <PlanFeature>Notifiche quando esce un nuovo value bet</PlanFeature>
            <PlanFeature locked>Bet automatici degli agenti</PlanFeature>
            <PlanFeature locked>Stake sizing automatico live</PlanFeature>
          </ul>
          <CryptoPaymentBox profile={profile} plan="base" onSubmit={onPaymentSubmit} />
        </article>

        <article className="plan-card is-premium">
          <div className="plan-card-head">
            <div>
              <p className="eyebrow">Premium</p>
              <h4>Autopilot Agents</h4>
            </div>
            <span>Unlocked</span>
          </div>
          <p className="plan-description">
            Per il cliente che vuole delegare agli agenti: analisi, decisione, stake e piazzamento live.
          </p>
          <div className="price-line">
            <strong>€199/month</strong>
            <span>Crypto only · USDT TRC20</span>
          </div>
          <div className="plan-core-line">
            <strong>Lo faccio per te</strong>
            <em>Execution layer con audit completo</em>
          </div>
          <ul className="plan-feature-list">
            <PlanFeature>Tutto il piano Base incluso</PlanFeature>
            <PlanFeature>Agenti sbloccati per piazzare bet automaticamente</PlanFeature>
            <PlanFeature>Stake sizing secondo bankroll e risk profile</PlanFeature>
            <PlanFeature>Stop loss, limiti giornalieri e limiti per sport</PlanFeature>
            <PlanFeature>Betfair live execution solo con betId confermato</PlanFeature>
            <PlanFeature>Report automatico dopo ogni operazione</PlanFeature>
            <PlanFeature>Ogni cliente collega il proprio conto Betfair</PlanFeature>
            <PlanFeature>Dashboard modificabile per limiti e risk profile</PlanFeature>
          </ul>
          <CryptoPaymentBox profile={profile} plan="premium" onSubmit={onPaymentSubmit} />
        </article>
      </section>

      <section className="plan-flow">
        <div>
          <span>01</span>
          <strong>Signal</strong>
          <em>Gli agenti trovano il value bet.</em>
        </div>
        <div>
          <span>02</span>
          <strong>Explain</strong>
          <em>Il cliente vede quota, edge e perche.</em>
        </div>
        <div>
          <span>03</span>
          <strong>Execute</strong>
          <em>Nel Premium l'agente piazza live con risk control.</em>
        </div>
        <div>
          <span>04</span>
          <strong>Audit</strong>
          <em>Ogni bet ha log, stato e Betfair betId.</em>
        </div>
      </section>
    </div>
  );
}

function SettingsTab({
  profile,
  onUnlock,
  onSave,
}: {
  profile: ClientProfile | null;
  onUnlock: () => void;
  onSave: (profile: ClientProfile) => void;
}) {
  const [draft, setDraft] = useState<ClientProfile | null>(profile);

  useEffect(() => {
    setDraft(profile);
  }, [profile]);

  if (!draft) {
    return (
      <section className="settings-empty">
        <p className="eyebrow">Account</p>
        <h3>Create profile to configure your service</h3>
        <button onClick={onUnlock}>Create profile</button>
      </section>
    );
  }

  const risk = draft.risk ?? { maxStake: 10, dailyStopLoss: 50, maxBetsPerDay: 5, mode: "automatic" as const };
  const betfair = draft.betfair ?? { status: "not_connected" as const };

  return (
    <div className="settings-view">
      <section className="settings-panel">
        <div className="settings-panel-head">
          <div>
            <p className="eyebrow">Profile</p>
            <h3>Account details</h3>
          </div>
          <span>{draft.plan.replace("_", " ")}</span>
        </div>
        <div className="settings-grid">
          <label>
            <span>Name</span>
            <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
          </label>
          <label>
            <span>Email</span>
            <input value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} />
          </label>
          <label>
            <span>Language</span>
            <select value={draft.language ?? "it"} onChange={(event) => setDraft({ ...draft, language: event.target.value as "it" | "en" })}>
              <option value="it">Italiano</option>
              <option value="en">English</option>
            </select>
          </label>
        </div>
      </section>

      <section className={`settings-panel ${profileHasPremium(draft) ? "" : "is-locked"}`}>
        <div className="settings-panel-head">
          <div>
            <p className="eyebrow">Betfair connect</p>
            <h3>Personal exchange account</h3>
          </div>
          <span>{betfair.status ?? "not_connected"}</span>
        </div>
        <p className="settings-copy">
          Premium uses the client personal Betfair account. For beta, credentials are reviewed manually before live execution is enabled.
        </p>
        <div className="settings-grid">
          <label>
            <span>Betfair username</span>
            <input disabled={!profileHasPremium(draft)} value={betfair.username ?? ""} onChange={(event) => setDraft({ ...draft, betfair: { ...betfair, username: event.target.value } })} />
          </label>
          <label>
            <span>App key last 4</span>
            <input disabled={!profileHasPremium(draft)} value={betfair.appKeyLast4 ?? ""} onChange={(event) => setDraft({ ...draft, betfair: { ...betfair, appKeyLast4: event.target.value.slice(-4) } })} />
          </label>
          <label>
            <span>Status</span>
            <select disabled={!profileHasPremium(draft)} value={betfair.status ?? "not_connected"} onChange={(event) => setDraft({ ...draft, betfair: { ...betfair, status: event.target.value as "not_connected" | "pending_review" | "connected" } })}>
              <option value="not_connected">Not connected</option>
              <option value="pending_review">Pending review</option>
              <option value="connected">Connected</option>
            </select>
          </label>
        </div>
      </section>

      <section className={`settings-panel ${profileHasPremium(draft) ? "" : "is-locked"}`}>
        <div className="settings-panel-head">
          <div>
            <p className="eyebrow">Risk profile</p>
            <h3>Autopilot limits</h3>
          </div>
          <span>{risk.mode}</span>
        </div>
        <div className="settings-grid">
          <label>
            <span>Max stake per bet</span>
            <input disabled={!profileHasPremium(draft)} type="number" value={risk.maxStake} onChange={(event) => setDraft({ ...draft, risk: { ...risk, maxStake: Number(event.target.value) } })} />
          </label>
          <label>
            <span>Daily stop loss</span>
            <input disabled={!profileHasPremium(draft)} type="number" value={risk.dailyStopLoss} onChange={(event) => setDraft({ ...draft, risk: { ...risk, dailyStopLoss: Number(event.target.value) } })} />
          </label>
          <label>
            <span>Max bets per day</span>
            <input disabled={!profileHasPremium(draft)} type="number" value={risk.maxBetsPerDay} onChange={(event) => setDraft({ ...draft, risk: { ...risk, maxBetsPerDay: Number(event.target.value) } })} />
          </label>
          <label>
            <span>Mode</span>
            <select disabled={!profileHasPremium(draft)} value={risk.mode} onChange={(event) => setDraft({ ...draft, risk: { ...risk, mode: event.target.value as "approval" | "automatic" } })}>
              <option value="automatic">Full automatic</option>
              <option value="approval">Approval required</option>
            </select>
          </label>
        </div>
      </section>

      <button className="settings-save" onClick={() => onSave(draft)}>Save settings</button>
    </div>
  );
}

function ClientAuthModal({
  intent,
  storedProfiles,
  onClose,
  onSave,
  onNotFound,
}: {
  intent: ClientAuthIntent;
  storedProfiles: ClientProfile[];
  onClose: () => void;
  onSave: (profile: ClientProfile) => void;
  onNotFound: (email: string) => void;
}) {
  const [mode, setMode] = useState<ClientAuthIntent>(intent);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const normalizedEmail = email.trim().toLowerCase();
  const canSubmit = mode === "login" ? normalizedEmail.includes("@") : name.trim().length > 1 && normalizedEmail.includes("@");

  return (
    <div className="auth-modal-backdrop" onClick={onClose}>
      <form
        className="auth-modal"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          if (!canSubmit) return;
          if (mode === "login") {
            const found = storedProfiles.find((profile) => profile.email.toLowerCase() === normalizedEmail);
            if (!found) {
              setError("Profilo non trovato. Crea un profilo cliente per continuare.");
              onNotFound(normalizedEmail);
              return;
            }
            onSave(found);
            return;
          }
          onSave({
            name: name.trim(),
            email: normalizedEmail,
            plan: "unpaid",
            language: "it",
            risk: { maxStake: 10, dailyStopLoss: 50, maxBetsPerDay: 5, mode: "automatic" },
            betfair: { status: "not_connected" },
          });
        }}
      >
        <div className="auth-modal-head">
          <p className="eyebrow">Client access</p>
          <h3>{mode === "login" ? "Login Signal Desk" : "Crea il tuo profilo Signal Desk"}</h3>
          <span>
            {mode === "login"
              ? "Accedi con l’email usata per il tuo profilo cliente."
              : "Crea il profilo, poi scegli Base o Premium per sbloccare i dati."}
          </span>
        </div>
        <div className="auth-mode-switch">
          <button type="button" className={mode === "login" ? "is-active" : ""} onClick={() => { setMode("login"); setError(""); }}>Login</button>
          <button type="button" className={mode === "create" ? "is-active" : ""} onClick={() => { setMode("create"); setError(""); }}>Create profile</button>
        </div>
        {mode === "create" && (
          <label>
            <span>Nome</span>
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Il tuo nome" autoComplete="name" />
          </label>
        )}
        <label>
          <span>Email</span>
          <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@email.com" inputMode="email" />
        </label>
        {error && <p className="auth-error">{error}</p>}
        <button disabled={!canSubmit}>{mode === "login" ? "Login" : "Continue to plans"}</button>
        <p>Base e Premium sono crypto-only. I dati prediction restano bloccati finché il piano non è attivo.</p>
      </form>
    </div>
  );
}

function profileHasAccess(profile: ClientProfile | null) {
  return Boolean(profile && ["base", "premium", "admin_full"].includes(profile.plan));
}

function profileHasPremium(profile: ClientProfile | null) {
  return Boolean(profile && ["premium", "admin_full"].includes(profile.plan));
}

function ProfilePanel({
  profile,
  onLogout,
  onUpgrade,
}: {
  profile: ClientProfile;
  onLogout: () => void;
  onUpgrade: () => void;
}) {
  const hasPremium = profileHasPremium(profile);
  return (
    <section className="profile-panel">
      <div className="profile-card">
        <div className="profile-avatar">{profile.name.slice(0, 1).toUpperCase()}</div>
        <div>
          <p className="eyebrow">Client profile</p>
          <h3>{profile.name}</h3>
          <span>{profile.email} · {profile.plan.replace("_", " ")}</span>
        </div>
        <button onClick={onLogout}>Logout</button>
      </div>
      {!hasPremium && (
        <div className="upgrade-card">
          <div>
            <p className="eyebrow">Passa a Pro</p>
            <h3>Autopilot Agents</h3>
            <span>Sblocca agenti automatici, stake sizing, stop loss e Betfair execution con betId verificato.</span>
          </div>
          <button onClick={onUpgrade}>Upgrade to Pro</button>
        </div>
      )}
    </section>
  );
}

function LockedGate({
  isUnlocked,
  onUnlock,
  children,
}: {
  isUnlocked: boolean;
  onUnlock: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={`locked-gate ${isUnlocked ? "is-unlocked" : ""}`}>
      <div className="locked-content">{children}</div>
      {!isUnlocked && (
        <div className="locked-overlay">
          <p className="eyebrow">Signal Desk locked</p>
          <h3>Accedi per vedere prediction, edge e spiegazioni</h3>
          <span>I dati sensibili restano offuscati finché non accedi e non attivi un piano.</span>
          <button onClick={onUnlock}>Login / Create profile</button>
        </div>
      )}
    </div>
  );
}

function bestFootballSelection(p: Prediction) {
  if (!p.best_selection) return null;
  const map = {
    HOME: { name: p.home_team, odds: p.odds_home, probability: p.p_home },
    DRAW: { name: "Draw", odds: p.odds_draw, probability: p.p_draw },
    AWAY: { name: p.away_team, odds: p.odds_away, probability: p.p_away },
  } as const;
  return map[p.best_selection as keyof typeof map] ?? null;
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


const LEAGUE_BADGE_COLORS: Record<string, string> = {
  PL:  "text-violet-400 border-violet-400/40 bg-violet-400/10",
  SA:  "text-blue-400 border-blue-400/40 bg-blue-400/10",
  PD:  "text-red-400 border-red-400/40 bg-red-400/10",
  BL1: "text-yellow-400 border-yellow-400/40 bg-yellow-400/10",
  FL1: "text-cyan-400 border-cyan-400/40 bg-cyan-400/10",
  CL:  "text-amber-300 border-amber-300/40 bg-amber-300/10",
  EL:  "text-orange-400 border-orange-400/40 bg-orange-400/10",
};

function PredictionCard({ p, onSelect }: { p: Prediction; onSelect?: (s: SlipSelection) => void }) {
  const [showWhy, setShowWhy] = useState(false);
  const hasOdds = p.odds_home != null;
  const isValueBet = p.edge != null && p.edge > 0.03;
  const e = p.enrichment ?? {};
  const leagueBadgeColor = LEAGUE_BADGE_COLORS[p.league] ?? "text-gray-400 border-gray-400/40 bg-gray-400/10";
  const reasons = buildReasons(p);

  const handleSelect = () => {
    if (!onSelect || !p.best_selection) return;
    const selOdds = p.best_selection === "HOME" ? p.odds_home : p.best_selection === "DRAW" ? p.odds_draw : p.odds_away;
    const selP = p.best_selection === "HOME" ? p.p_home : p.best_selection === "DRAW" ? p.p_draw : p.p_away;
    if (!selOdds || selP == null) return;
    const confidence = confidenceFromEdge(p.edge, selP);
    onSelect({
      id: p.match_id,
      sport: "Football",
      event: `${p.home_team} vs ${p.away_team}`,
      league: p.league,
      kickoff: p.kickoff,
      market: "1X2",
      selection: p.best_selection === "HOME" ? p.home_team : p.best_selection === "DRAW" ? "Draw" : p.away_team,
      odds: selOdds,
      modelProbability: selP,
      edge: p.edge,
      confidence,
      recommendedStake: stakeFromEdge(p.edge, confidence),
    });
  };

  return (
    <div className={`glass-card p-4 space-y-3 ${isValueBet ? "border-green-400/40" : ""}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${leagueBadgeColor}`}>
              {p.league}
            </span>
            <span className="text-xs text-gray-500 font-mono">{LEAGUE_FLAGS[p.league] ?? "⚽"} {p.league_name}</span>
          </div>
          <div className="text-sm font-bold text-white mt-1">
            {p.home_team}<span className="text-gray-500 font-normal mx-2">vs</span>{p.away_team}
          </div>
          <div className="text-xs text-gray-600 font-mono mt-0.5">{fmtKickoff(p.kickoff)}</div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {isValueBet && p.best_selection && (
            <button
              className="text-xs px-2 py-0.5 rounded-full border border-green-400/50 text-green-400 bg-green-400/10 font-mono hover:bg-green-400/20 transition-colors"
              onClick={handleSelect}
            >
              +EV {p.best_selection}
            </button>
          )}
          {p.match_type && p.match_type !== "STANDARD" && <MatchTypeBadge matchType={p.match_type} />}
          {e.research && (
            <span className="text-xs px-1.5 py-0.5 rounded border border-purple-400/40 text-purple-400 bg-purple-400/5 font-mono">AI</span>
          )}
        </div>
      </div>

      {/* Probability bars */}
      <div className="space-y-1.5">
        <ProbBar label="HOME" pct={p.p_home} color="text-cyan-400"
          odds={p.odds_home} isValue={hasOdds && p.best_selection === "HOME" && isValueBet} />
        <ProbBar label="DRAW" pct={p.p_draw} color="text-yellow-400"
          odds={p.odds_draw} isValue={hasOdds && p.best_selection === "DRAW" && isValueBet} />
        <ProbBar label="AWAY" pct={p.p_away} color="text-fuchsia-400"
          odds={p.odds_away} isValue={hasOdds && p.best_selection === "AWAY" && isValueBet} />
      </div>

      {/* Footer: model + edge + why toggle */}
      <div className="flex items-center justify-between text-xs font-mono pt-1 border-t border-white/5">
        <button
          className="text-gray-500 hover:text-cyan-400 transition-colors text-[10px] uppercase tracking-wider"
          onClick={() => setShowWhy(!showWhy)}
        >
          {showWhy ? "▲ meno" : "▼ perché"}
        </button>
        <span className="text-gray-600">Dixon-Coles</span>
        {p.edge != null ? (
          <span className={`px-2 py-0.5 rounded border font-mono text-[10px] ${p.edge > 0.03 ? "text-green-400 border-green-400/40 bg-green-400/10" : p.edge > 0 ? "text-gray-400 border-gray-400/30" : "text-red-400 border-red-400/30"}`}>
            {p.edge > 0 ? "+" : ""}{(p.edge * 100).toFixed(1)}%
          </span>
        ) : (
          <span className="text-gray-600">no edge</span>
        )}
      </div>

      {/* Inline Why section */}
      {showWhy && (
        <div className="space-y-2 pt-2 border-t border-white/5 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="text-[9px] font-mono text-cyan-400/60 uppercase tracking-widest">Perché questa previsione</div>
          {reasons.map((r, i) => (
            <div key={i} className={`flex gap-2 text-[10px] font-mono leading-relaxed ${r.highlight ? "text-white" : "text-gray-500"}`}>
              <span className="shrink-0">{r.icon}</span>
              <span>{r.text}</span>
            </div>
          ))}
          <div className="flex items-center justify-between text-[9px] text-gray-600 font-mono pt-1 border-t border-white/5">
            <span>λ home {p.lambda_home?.toFixed(2) ?? "?"}</span>
            <span>λ away {p.lambda_away?.toFixed(2) ?? "?"}</span>
            <span>{p.model_matches ?? "?"} matches</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tennis Tab ───────────────────────────────────────────────────────────────

const SURFACE_META: Record<string, { label: string; color: string }> = {
  CLAY:  { label: "CLAY",  color: "text-orange-400 border-orange-400/40 bg-orange-400/10" },
  GRASS: { label: "GRASS", color: "text-green-400 border-green-400/40 bg-green-400/10" },
  HARD:  { label: "HARD",  color: "text-blue-400 border-blue-400/40 bg-blue-400/10" },
};

type TennisReason = { icon: string; text: string; highlight?: boolean };

function buildTennisReasons(m: TennisMatch): TennisReason[] {
  const reasons: TennisReason[] = [];
  const surfLabel = m.surface === "CLAY" ? "terra battuta" : m.surface === "GRASS" ? "erba" : "cemento";
  const p1last = m.player1.split(" ").pop() ?? m.player1;
  const p2last = m.player2.split(" ").pop() ?? m.player2;

  // Elo surface ratings
  if (m.elo_p1 != null && m.elo_p2 != null) {
    const delta = m.elo_p1 - m.elo_p2;
    const leader = delta > 0 ? p1last : p2last;
    const stronger = Math.abs(delta) > 80 ? "nettamente superiore" : Math.abs(delta) > 30 ? "superiore" : "leggermente avanti";
    reasons.push({
      icon: "🎾",
      text: `Elo ${surfLabel}: ${p1last} ${m.elo_p1} · ${p2last} ${m.elo_p2} — ${leader} ${stronger} (Δ${Math.abs(delta).toFixed(0)} pt)`,
      highlight: Math.abs(delta) > 80,
    });
  } else {
    reasons.push({ icon: "🎾", text: `Elo surface-adjusted su ${surfLabel} — modello ${m.model}` });
  }

  // Overall vs surface rating (shows surface specialisation)
  if (m.elo_p1 != null && m.elo_p1_overall != null && m.elo_p2 != null && m.elo_p2_overall != null) {
    const p1surfAdv = m.elo_p1 - m.elo_p1_overall;
    const p2surfAdv = m.elo_p2 - m.elo_p2_overall;
    const hasSpec = Math.abs(p1surfAdv) > 20 || Math.abs(p2surfAdv) > 20;
    if (hasSpec) {
      const parts: string[] = [];
      if (Math.abs(p1surfAdv) > 20) parts.push(`${p1last} ${p1surfAdv > 0 ? "+" : ""}${p1surfAdv.toFixed(0)} su ${surfLabel}`);
      if (Math.abs(p2surfAdv) > 20) parts.push(`${p2last} ${p2surfAdv > 0 ? "+" : ""}${p2surfAdv.toFixed(0)} su ${surfLabel}`);
      reasons.push({ icon: "📊", text: `Specializzazione superficie: ${parts.join(" · ")} (vs rating overall)`, highlight: Math.abs(p1surfAdv) > 60 || Math.abs(p2surfAdv) > 60 });
    } else {
      reasons.push({ icon: "📊", text: `Overall: ${p1last} ${m.elo_p1_overall} · ${p2last} ${m.elo_p2_overall} — prestazioni simili su tutte le superfici` });
    }
  }

  // Surface match count (data reliability)
  if (m.surface_matches_p1 != null && m.surface_matches_p2 != null) {
    const minMatches = Math.min(m.surface_matches_p1, m.surface_matches_p2);
    const reliability = minMatches >= 50 ? "alta" : minMatches >= 20 ? "media" : "bassa";
    reasons.push({
      icon: "📈",
      text: `Partite su ${surfLabel}: ${p1last} ${m.surface_matches_p1} · ${p2last} ${m.surface_matches_p2} — affidabilità rating ${reliability}`,
    });
  }

  // Fatigue adjustment (shown only when meaningful)
  if (m.elo_raw_p1 != null) {
    const delta = Math.abs(m.p1 - m.elo_raw_p1);
    if (delta > 0.003) {
      const dir = m.p1 > m.elo_raw_p1 ? "favorisce" : "penalizza";
      reasons.push({
        icon: "⚡",
        text: `Fatica: Elo puro ${Math.round(m.elo_raw_p1 * 100)}% → ${Math.round(m.p1 * 100)}% dopo aggiustamento — stanchezza ${dir} ${p1last}`,
      });
    }
  }

  // Model vs market odds
  const mktP1 = m.odds_p1 && m.odds_p1 > 1 ? Math.round((1 / m.odds_p1) * 100) : null;
  const mktP2 = m.odds_p2 && m.odds_p2 > 1 ? Math.round((1 / m.odds_p2) * 100) : null;
  if (m.best_selection === "P1" && mktP1 != null) {
    reasons.push({
      icon: "🧠",
      text: `Modello: ${p1last} ${Math.round(m.p1 * 100)}% · Mercato: ${mktP1}% — modello vede ${Math.round(m.p1 * 100) - mktP1}pp in più`,
      highlight: Math.round(m.p1 * 100) - mktP1 > 4,
    });
  } else if (m.best_selection === "P2" && mktP2 != null) {
    reasons.push({
      icon: "🧠",
      text: `Modello: ${p2last} ${Math.round(m.p2 * 100)}% · Mercato: ${mktP2}% — modello vede ${Math.round(m.p2 * 100) - mktP2}pp in più`,
      highlight: Math.round(m.p2 * 100) - mktP2 > 4,
    });
  } else {
    reasons.push({ icon: "⚖️", text: `${p1last} ${Math.round(m.p1 * 100)}% vs ${p2last} ${Math.round(m.p2 * 100)}% — nessun edge netto` });
  }

  // Edge conclusion
  if (m.edge != null && m.edge > 0.025) {
    reasons.push({ icon: "💰", text: `Value bet: edge +${(m.edge * 100).toFixed(1)}% su ${m.best_selection === "P1" ? m.player1 : m.player2} — supera soglia minima 2.5%`, highlight: true });
  } else if (m.edge != null && m.edge > 0) {
    reasons.push({ icon: "📉", text: `Edge marginale +${(m.edge * 100).toFixed(1)}% — sotto soglia value (2.5%), segnale non attivato` });
  } else {
    reasons.push({ icon: "❌", text: "Nessun edge positivo — il mercato prezza già correttamente questa partita" });
  }

  return reasons;
}

function TennisMatchCard({ m, onSelect }: { m: TennisMatch; onSelect?: (s: SlipSelection) => void }) {
  const [showWhy, setShowWhy] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const surface = SURFACE_META[m.surface] ?? { label: m.surface, color: "text-gray-400 border-gray-400/40 bg-gray-400/10" };

  const handleWhyClick = async () => {
    const next = !showWhy;
    setShowWhy(next);
    if (next && !aiAnalysis && !loadingAnalysis) {
      setLoadingAnalysis(true);
      try {
        const res = await fetch("/api/tennis-analysis", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ match_id: m.id }),
        });
        const data = await res.json() as { analysis?: string };
        if (data.analysis) setAiAnalysis(data.analysis);
      } catch {
        // keep Elo fallback
      } finally {
        setLoadingAnalysis(false);
      }
    }
  };
  const isValue = m.edge != null && m.edge > 0.025;
  const scheduledDate = new Date(m.scheduled).toLocaleDateString("it-IT", {
    weekday: "short", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome",
  });

  const handleSelect = (player: "P1" | "P2") => {
    if (!onSelect) return;
    const isP1 = player === "P1";
    const odds = isP1 ? m.odds_p1 : m.odds_p2;
    const probability = isP1 ? m.p1 : m.p2;
    const name = isP1 ? m.player1 : m.player2;
    const edgeForSel = m.best_selection === player ? m.edge : null;
    const confidence = confidenceFromEdge(edgeForSel, probability);
    onSelect({
      id: m.id,
      sport: "Tennis",
      event: `${m.player1} vs ${m.player2}`,
      league: m.tournament,
      kickoff: m.scheduled,
      market: "Match Winner",
      selection: name,
      odds,
      modelProbability: probability,
      edge: edgeForSel,
      confidence,
      recommendedStake: stakeFromEdge(edgeForSel, confidence),
    });
  };

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
        {isValue && m.best_selection && (
          <button
            className="text-xs px-2 py-0.5 rounded-full border border-green-400/50 text-green-400 bg-green-400/10 font-mono shrink-0 hover:bg-green-400/20 transition-colors"
            onClick={() => handleSelect(m.best_selection as "P1" | "P2")}
          >
            +EV {m.best_selection}
          </button>
        )}
      </div>

      {/* Probability bars */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => onSelect && handleSelect("P1")}>
          <span className="text-xs font-mono w-24 shrink-0 text-cyan-400 truncate">{m.player1.split(" ").pop()}</span>
          <div className="flex-1 bg-white/5 rounded-full h-1.5 overflow-hidden">
            <div className="h-full rounded-full bg-cyan-400 transition-all" style={{ width: `${Math.round(m.p1 * 100)}%` }} />
          </div>
          <span className="text-xs font-mono w-8 text-right text-cyan-400">{Math.round(m.p1 * 100)}%</span>
          <span className="text-xs font-mono text-gray-500 w-10 text-right">{m.odds_p1.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => onSelect && handleSelect("P2")}>
          <span className="text-xs font-mono w-24 shrink-0 text-fuchsia-400 truncate">{m.player2.split(" ").pop()}</span>
          <div className="flex-1 bg-white/5 rounded-full h-1.5 overflow-hidden">
            <div className="h-full rounded-full bg-fuchsia-400 transition-all" style={{ width: `${Math.round(m.p2 * 100)}%` }} />
          </div>
          <span className="text-xs font-mono w-8 text-right text-fuchsia-400">{Math.round(m.p2 * 100)}%</span>
          <span className="text-xs font-mono text-gray-500 w-10 text-right">{m.odds_p2.toFixed(2)}</span>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs font-mono pt-1 border-t border-white/5">
        <button
          className="text-gray-500 hover:text-cyan-400 transition-colors text-[10px] uppercase tracking-wider"
          onClick={handleWhyClick}
        >
          {loadingAnalysis ? "⏳ analisi..." : showWhy ? "▲ meno" : "▼ perché"}
        </button>
        <span className="text-gray-600">{m.model}</span>
        {m.edge != null && m.edge > 0 ? (
          <span className={`px-2 py-0.5 rounded border font-mono text-[10px] ${isValue ? "text-green-400 border-green-400/40 bg-green-400/10" : "text-gray-400 border-gray-400/30"}`}>
            edge +{(m.edge * 100).toFixed(1)}%
          </span>
        ) : (
          <span className="text-gray-600">no edge</span>
        )}
      </div>

      {/* Inline Why */}
      {showWhy && (
        <div className="space-y-2 pt-2 border-t border-white/5 animate-in fade-in slide-in-from-top-1 duration-150">
          {/* AI analysis — shown first when available */}
          {aiAnalysis ? (
            <>
              <div className="text-[9px] font-mono text-cyan-400/60 uppercase tracking-widest flex items-center gap-1.5">
                <span>🤖</span> Analisi AI
              </div>
              <p className="text-[10px] font-mono text-gray-300 leading-relaxed whitespace-pre-line">
                {aiAnalysis}
              </p>
              <div className="text-[9px] font-mono text-white/20 uppercase tracking-widest pt-1 border-t border-white/5">Dati Elo</div>
            </>
          ) : loadingAnalysis ? (
            <div className="text-[10px] font-mono text-cyan-400/50 animate-pulse">Generazione analisi AI in corso...</div>
          ) : (
            <div className="text-[9px] font-mono text-cyan-400/60 uppercase tracking-widest">Analisi Elo Surface</div>
          )}
          {/* Structured Elo reasons — always shown */}
          {buildTennisReasons(m).map((r, i) => (
            <div key={i} className={`text-[10px] font-mono leading-relaxed ${r.highlight ? "text-green-400" : "text-gray-400"}`}>
              {r.icon} {r.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TennisTab({
  matches,
  summary,
  loading,
  computedAt,
  agents = [],
  showPnl = false,
}: {
  matches: TennisMatch[];
  summary: TennisSummary | null;
  loading: boolean;
  computedAt: string | null;
  agents?: AgentStatus[];
  showPnl?: boolean;
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
          { label: "P&L Tennis",        value: showPnl ? `${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}€` : "—", color: showPnl ? (pnl >= 0 ? "text-green-400" : "text-red-400") : "text-gray-500" },
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

function ClientStatusTab({
  agents,
  bets,
  tennisSummary,
  computedAt,
  tennisComputedAt,
}: {
  agents: AgentStatus[];
  bets: Bet[];
  tennisSummary: TennisSummary | null;
  computedAt: string | null;
  tennisComputedAt: string | null;
}) {
  const footballAgents = agents.filter((a) => !a.name.startsWith("Tennis"));
  const tennisAgents = agents.filter((a) => a.name.startsWith("Tennis"));
  const footballAlive = footballAgents.filter((a) => a.status === "alive").length;
  const tennisAlive = tennisAgents.filter((a) => a.status === "alive").length;
  const confirmedLive = bets.filter((b) => !b.paper && Boolean(b.betfair_bet_id)).length;
  const blocked = bets.filter((b) => FAILED_STATUSES.includes(b.status)).length;

  const rows = [
    {
      title: "Football execution",
      value: footballAgents.length ? `${footballAlive}/${footballAgents.length} online` : "checking",
      detail: "Live orders are valid only when Betfair confirms a betId.",
      tone: footballAlive === footballAgents.length && footballAgents.length > 0 ? "good" : "warn",
    },
    {
      title: "Tennis signal layer",
      value: tennisAgents.length ? `${tennisAlive}/${tennisAgents.length} active` : "active signal",
      detail: `${tennisSummary?.value_bets ?? 0} value signals from ${tennisSummary?.markets_active ?? 0} active markets.`,
      tone: "good",
    },
    {
      title: "Execution audit",
      value: `${confirmedLive} confirmed`,
      detail: blocked ? `${blocked} orders blocked or rejected safely.` : "Every live bet must be traceable to Betfair.",
      tone: blocked ? "warn" : "good",
    },
    {
      title: "Data freshness",
      value: computedAt ? timeAgo(computedAt) : "syncing",
      detail: tennisComputedAt ? `Tennis updated ${timeAgo(tennisComputedAt)}.` : "Tennis database fallback is enabled.",
      tone: "neutral",
    },
  ];

  return (
    <div className="client-status">
      <section className="client-callout">
        <div>
          <p className="eyebrow">Client status</p>
          <h3>Only decision-critical health is shown here.</h3>
        </div>
        <p>
          The desk hides internal agent noise and surfaces four client questions:
          can we trade, are signals fresh, did Betfair confirm, and what is blocked for safety.
        </p>
      </section>

      <section className="client-status-grid">
        {rows.map((row) => (
          <article key={row.title} className={`client-status-card ${row.tone}`}>
            <span>{row.title}</span>
            <strong>{row.value}</strong>
            <em>{row.detail}</em>
          </article>
        ))}
      </section>

      <section className="client-system-list">
        <div>
          <strong>Client sees</strong>
          <span>Market board, bet slip, active bets, settled history, execution confirmation.</span>
        </div>
        <div>
          <strong>Client does not need</strong>
          <span>Python process names, internal pipeline steps, optimizer jargon, raw heartbeat spam.</span>
        </div>
      </section>
    </div>
  );
}

// ─── Bets Tab ─────────────────────────────────────────────────────────────────

const FAILED_STATUSES = ["execution_rejected", "expired_unconfirmed", "cancelled"];

function BetsTab({ bets, summary, leaguePnl, tennisBets = [], tennisBetSummary }: {
  bets: Bet[];
  summary: Summary;
  leaguePnl: LeaguePnl[];
  tennisBets?: TennisBet[];
  tennisBetSummary?: TennisBetSummary | null;
}) {
  const [filter, setFilter] = useState<string>("live");
  const [showDemo, setShowDemo] = useState(false);

  const realBets   = bets.filter((b) => !FAILED_STATUSES.includes(b.status));
  const failedBets = bets.filter((b) => FAILED_STATUSES.includes(b.status));

  const filtered = (filter === "failed" ? failedBets : realBets).filter((b) => {
    if (filter !== "live" && filter !== "failed" && b.status !== filter) return false;
    if (!showDemo && b.paper) return false;
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
        {[
          { key: "live",    label: "Live bets" },
          { key: "pending", label: "Pending" },
          { key: "won",     label: "Won" },
          { key: "lost",    label: "Lost" },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setFilter(key)}
            className={`px-3 py-1 rounded-full border text-xs font-mono transition ${
              filter === key ? "border-cyan-400 text-cyan-300 bg-cyan-400/10" : "border-white/10 text-gray-400 hover:border-cyan-400/40"
            }`}>
            {label}
          </button>
        ))}
        {failedBets.length > 0 && (
          <button onClick={() => setFilter("failed")}
            className={`px-3 py-1 rounded-full border text-xs font-mono transition ${
              filter === "failed" ? "border-red-400 text-red-300 bg-red-400/10" : "border-white/10 text-gray-500 hover:border-red-400/30"
            }`}>
            Failed ({failedBets.length})
          </button>
        )}
        <button onClick={() => setShowDemo(!showDemo)}
          className={`px-3 py-1 rounded-full border text-xs font-mono transition ${
            showDemo ? "border-yellow-400 text-yellow-400 bg-yellow-400/10" : "border-white/10 text-gray-400"
          }`}>
          {showDemo ? "Hide Demo" : "Show Demo"}
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
                  ) : FAILED_STATUSES.includes(bet.status) ? (
                    <span className="text-xs text-gray-600 font-mono">—</span>
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

      {/* ── Tennis Bets ── */}
      {tennisBets.filter((tb) => showDemo || !tb.paper).length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <h3 className="text-xs font-mono text-amber-400/70 uppercase tracking-wider">🎾 Tennis Bets</h3>
            {tennisBetSummary && (
              <span className="text-xs font-mono text-gray-500">
                {tennisBetSummary.pending} open · {tennisBetSummary.won}W/{tennisBetSummary.lost}L ·{" "}
                <span className={tennisBetSummary.pnl >= 0 ? "text-green-400" : "text-red-400"}>
                  {tennisBetSummary.pnl >= 0 ? "+" : ""}{tennisBetSummary.pnl.toFixed(2)}€
                </span>
              </span>
            )}
          </div>
          {tennisBets.filter((tb) => showDemo || !tb.paper).slice(0, 30).map((tb) => (
            <div key={tb.id} className={`glass-card p-4 ${
              tb.status === "won" ? "border-green-400/20" :
              tb.status === "lost" ? "border-red-400/20" : ""
            }`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-white">
                      {tb.player1 && tb.player2 ? `${tb.player1} vs ${tb.player2}` : tb.match_id}
                    </span>
                    {tb.tournament && (
                      <span className="text-xs text-gray-500 font-mono">🎾 {tb.tournament}</span>
                    )}
                    {tb.surface && (
                      <span className="text-xs px-1.5 py-0.5 rounded border border-amber-400/30 text-amber-300 font-mono">{tb.surface}</span>
                    )}
                    <span className="text-xs font-mono text-yellow-400">[DEMO]</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="text-xs font-mono text-cyan-300 font-bold">{tb.player_name ?? tb.selection}</span>
                    <span className="text-xs font-mono text-gray-400">@ {Number(tb.odds).toFixed(2)}</span>
                    <span className="text-xs font-mono text-gray-400">stake: {Number(tb.stake).toFixed(2)}€</span>
                    {tb.profit_loss != null && (
                      <span className={`text-xs font-mono font-bold ${tb.profit_loss >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {tb.profit_loss >= 0 ? "+" : ""}{tb.profit_loss.toFixed(2)}€
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <StatusBadge status={tb.status} />
                </div>
              </div>
              <div className="text-[10px] text-gray-700 font-mono mt-2">Placed: {timeAgo(tb.placed_at)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Partners Tab ─────────────────────────────────────────────────────────────

type PartnerType = "Casino & Sportsbook" | "Sportsbook" | "Exchange" | "Casino" | "Crypto Casino";
type PartnerStatus = "featured" | "active" | "coming_soon" | "in_discussion";

interface Partner {
  id: string;
  name: string;
  type: PartnerType;
  status: PartnerStatus;
  description: string;
  url: string | null;
  since: string;
  logo_initials: string;
  logo_color: string;
  featured?: boolean;
  tags?: string[];
}

const PARTNERS: Partner[] = [
  {
    id: "partner-01",
    name: "Partner Principale",
    type: "Casino & Sportsbook",
    status: "featured",
    description: "Casino e piattaforma di scommesse sportive — partner esclusivo del progetto. Integrazione diretta con Agentic Markets per segnali e edge calcolati in tempo reale.",
    url: null,
    since: "2026",
    logo_initials: "P1",
    logo_color: "from-amber-500 to-orange-600",
    featured: true,
    tags: ["Esclusivo", "Sport", "Casino", "Live"],
  },
];

const PARTNER_STATUS_META: Record<PartnerStatus, { label: string; color: string }> = {
  featured:      { label: "Partner Esclusivo", color: "text-amber-400 border-amber-400/40 bg-amber-400/10" },
  active:        { label: "Attivo",            color: "text-green-400 border-green-400/40 bg-green-400/10" },
  coming_soon:   { label: "Coming Soon",       color: "text-cyan-400 border-cyan-400/40 bg-cyan-400/10" },
  in_discussion: { label: "In Trattativa",     color: "text-gray-400 border-gray-400/30 bg-gray-400/5" },
};

function PartnerCard({ p }: { p: Partner }) {
  const status = PARTNER_STATUS_META[p.status];
  return (
    <div className={`glass-card p-5 space-y-4 flex flex-col ${p.featured ? "border-amber-400/30" : ""}`}>
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${p.logo_color} flex items-center justify-center text-white font-bold text-lg shrink-0`}>
          {p.logo_initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-white">{p.name}</span>
            {p.featured && (
              <span className="text-[9px] px-1.5 py-0.5 rounded border border-amber-400/50 text-amber-400 bg-amber-400/10 font-mono uppercase tracking-wider">⭐ Featured</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-[10px] font-mono text-gray-500">{p.type}</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded border font-mono ${status.color}`}>{status.label}</span>
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs font-mono text-gray-400 leading-relaxed flex-1">{p.description}</p>

      {/* Tags */}
      {p.tags && p.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {p.tags.map((tag) => (
            <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-gray-500 font-mono">{tag}</span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-white/5">
        <span className="text-[10px] font-mono text-gray-600">Partner dal {p.since}</span>
        {p.url ? (
          <a
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-mono px-3 py-1 rounded border border-cyan-400/40 text-cyan-400 bg-cyan-400/5 hover:bg-cyan-400/15 transition-colors"
          >
            Visita →
          </a>
        ) : (
          <span className="text-[10px] font-mono text-gray-600 italic">Link in arrivo</span>
        )}
      </div>
    </div>
  );
}

function PartnersTab() {
  const featured = PARTNERS.filter((p) => p.featured);
  const others = PARTNERS.filter((p) => !p.featured);

  return (
    <div className="space-y-8 p-4">
      {/* Header */}
      <div className="space-y-1">
        <p className="eyebrow">Rete commerciale</p>
        <h2 className="text-xl font-bold text-white">Casino & Scommesse Partner</h2>
        <p className="text-xs font-mono text-gray-500 max-w-lg">
          Piattaforme di gioco e scommesse con cui Agentic Markets collabora — integrazione segnali, edge e strumenti AI per gli operatori del settore.
        </p>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Partner Attivi", value: String(PARTNERS.filter((p) => ["featured", "active"].includes(p.status)).length), color: "text-green-400" },
          { label: "In Trattativa", value: String(PARTNERS.filter((p) => p.status === "in_discussion").length), color: "text-amber-300" },
          { label: "Coming Soon",   value: String(PARTNERS.filter((p) => p.status === "coming_soon").length), color: "text-cyan-400" },
        ].map((s) => (
          <div key={s.label} className="glass-card p-3 text-center">
            <div className={`text-xl font-bold font-mono ${s.color}`}>{s.value}</div>
            <div className="text-[10px] font-mono text-gray-500 uppercase tracking-wider mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Featured */}
      {featured.length > 0 && (
        <div className="space-y-3">
          <div className="text-[9px] font-mono text-amber-400/70 uppercase tracking-widest">Partner Esclusivi</div>
          <div className="grid grid-cols-1 gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
            {featured.map((p) => <PartnerCard key={p.id} p={p} />)}
          </div>
        </div>
      )}

      {/* Others */}
      {others.length > 0 && (
        <div className="space-y-3">
          <div className="text-[9px] font-mono text-gray-500 uppercase tracking-widest">Network Partner</div>
          <div className="grid grid-cols-1 gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
            {others.map((p) => <PartnerCard key={p.id} p={p} />)}
          </div>
        </div>
      )}

      {/* Add partner CTA */}
      <div className="glass-card p-5 border-dashed border-white/10 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl border-2 border-dashed border-white/20 flex items-center justify-center text-white/30 text-2xl shrink-0">+</div>
        <div>
          <div className="text-sm font-bold text-white/60">Aggiungi partner</div>
          <div className="text-xs font-mono text-gray-600 mt-0.5">Casino, sportsbook o exchange — contattaci per integrare la tua piattaforma con Agentic Markets.</div>
        </div>
      </div>
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
  const [clientProfile, setClientProfile] = useState<ClientProfile | null>(null);
  const [storedProfiles, setStoredProfiles] = useState<ClientProfile[]>([]);
  const [authOpen, setAuthOpen] = useState(false);
  const [authIntent, setAuthIntent] = useState<ClientAuthIntent>("login");
  const [slipSelection, setSlipSelection] = useState<SlipSelection | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [bets, setBets] = useState<Bet[]>([]);
  const [leaguePnl, setLeaguePnl] = useState<LeaguePnl[]>([]);
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [tennisMatches, setTennisMatches] = useState<TennisMatch[]>([]);
  const [tennisSummary, setTennisSummary] = useState<TennisSummary | null>(null);
  const [tennisComputedAt, setTennisComputedAt] = useState<string | null>(null);
  const [tennisBets, setTennisBets] = useState<TennisBet[]>([]);
  const [tennisBetSummary, setTennisBetSummary] = useState<TennisBetSummary | null>(null);
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

  useEffect(() => {
    try {
      const profilesRaw = window.localStorage.getItem(CLIENT_PROFILES_KEY);
      if (profilesRaw) setStoredProfiles(JSON.parse(profilesRaw) as ClientProfile[]);
      const raw = window.localStorage.getItem(CLIENT_PROFILE_KEY);
      if (raw) setClientProfile(JSON.parse(raw) as ClientProfile);
    } catch { /**/ }
  }, []);

  const saveClientProfile = (profile: ClientProfile) => {
    const normalizedProfile = { ...profile, email: profile.email.trim().toLowerCase() };
    setClientProfile(normalizedProfile);
    setAuthOpen(false);
    window.localStorage.setItem(CLIENT_PROFILE_KEY, JSON.stringify(normalizedProfile));
    const nextProfiles = [
      normalizedProfile,
      ...storedProfiles.filter((item) => item.email.toLowerCase() !== normalizedProfile.email),
    ];
    setStoredProfiles(nextProfiles);
    window.localStorage.setItem(CLIENT_PROFILES_KEY, JSON.stringify(nextProfiles));
  };

  const openAuth = (intent: ClientAuthIntent = "login") => {
    setAuthIntent(intent);
    setAuthOpen(true);
  };

  const handleAuthSave = (profile: ClientProfile) => {
    saveClientProfile(profile);
    setTab(profileHasAccess(profile) ? "overview" : "plans");
  };

  const submitCryptoPayment = (plan: "base" | "premium") => {
    if (!clientProfile) {
      setAuthOpen(true);
      return;
    }
    // Strip payment-flow residuals before activating plan
    const { txHash: _tx, requestedPlan: _rp, ...rest } = clientProfile;
    saveClientProfile({ ...rest, plan });
    setTab("overview");
  };

  const logoutClientProfile = () => {
    setClientProfile(null);
    setSlipSelection(null);
    setTab("overview");
    window.localStorage.removeItem(CLIENT_PROFILE_KEY);
  };

  const fetchData = useCallback(async () => {
    try {
      const [dataResp, tennisBetsResp] = await Promise.all([
        fetch("/api/data"),
        fetch("/api/tennis-bets"),
      ]);
      if (dataResp.ok) {
        const data = await dataResp.json();
        setSummary(data.summary);
        setBets(data.bets ?? []);
        setLeaguePnl(data.league_pnl ?? []);
        setLastUpdate(new Date().toLocaleTimeString());
      }
      if (tennisBetsResp.ok) {
        const tb = await tennisBetsResp.json();
        setTennisBets(tb.bets ?? []);
        setTennisBetSummary(tb.summary ?? null);
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
        const isPlaceholder = data.source === "placeholder" || data.is_placeholder === true;
        setTennisMatches(isPlaceholder ? [] : (data.matches ?? []));
        setTennisSummary(isPlaceholder ? null : (data.summary ?? null));
        setTennisComputedAt(isPlaceholder ? null : (data.computed_at ?? null));
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
  }, [tab]);

  const pnl = (summary?.pnl ?? 0) + (tennisBetSummary?.pnl ?? 0);
  const valueBets = predictions.filter((p) => p.edge != null && p.edge > 0.03);
  const aliveAgents = agents.filter((a) => a.status === "alive").length;
  const totalAgents = agents.length || 16;
  const isClientUnlocked = profileHasAccess(clientProfile);
  const isPremiumClient = profileHasPremium(clientProfile);

  const tennisValueBets = tennisMatches.filter((m) => m.edge != null && m.edge > 0.03);
  const navItems: { tab: Tab; label: string; value?: string; tone?: string }[] = [
    { tab: "overview",     label: "Dashboard",  value: isClientUnlocked ? String(valueBets.length + tennisValueBets.length) : "LOCK", tone: "green" },
    { tab: "portfolio",    label: "Portfolio",  value: isPremiumClient ? `${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}€` : "PRO", tone: isPremiumClient ? "green" : undefined },
    { tab: "plans",        label: "Plans",      value: "2", tone: "amber" },
    { tab: "predictions",  label: "Best Bets",  value: isClientUnlocked ? String(predictions.length + tennisMatches.length) : "LOCK" },
    { tab: "tennis",       label: "Tennis",     value: isClientUnlocked ? String(tennisMatches.length) : "LOCK", tone: isClientUnlocked ? "amber" : undefined },
    { tab: "bets",         label: "Bets",       value: isPremiumClient ? String((summary?.pending ?? 0) + (tennisBetSummary?.pending ?? 0)) : "PRO", tone: isPremiumClient && ((summary?.pending ?? 0) + (tennisBetSummary?.pending ?? 0)) > 0 ? "green" : undefined },
    { tab: "partners",     label: "Partner",    value: String(PARTNERS.length) },
    { tab: "settings",     label: "Settings",   value: clientProfile ? (isPremiumClient ? "PRO" : "SET") : "LOGIN" },
    { tab: "agents",       label: "Status",     value: isPremiumClient ? (aliveAgents === totalAgents ? "OK" : `${aliveAgents}/${totalAgents}`) : "PRO" },
  ];

  return (
    <main className="sportsbook-shell">
      <section className="book-topbar">
        <div>
          <p className="eyebrow">Agentic Markets</p>
          <h1>Sportsbook <span className="neon-text">Edge Desk</span></h1>
          <p className="book-topbar-subtitle">
            Un’unica console per segnali, live execution e controllo Betfair.
          </p>
        </div>
        <div className="topbar-stats">
          <div className="live-badge">LIVE</div>
          <span>Net P&amp;L</span>
          <strong className={pnl >= 0 ? "text-green-300" : "text-red-300"} style={{fontFamily:"ui-monospace,monospace", fontSize:"14px"}}>
            {loading ? "—" : isPremiumClient ? `${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}€` : "—"}
          </strong>
          <span>{isClientUnlocked ? `${predictions.length + tennisMatches.length} events` : "private desk"}</span>
          <span>{isClientUnlocked ? (valueBets.length + tennisValueBets.length > 0 ? `${valueBets.length + tennisValueBets.length} +EV` : "scanning") : "plans active"}</span>
          <span>{lastUpdate || "syncing"}</span>
          <button className="client-access-button" onClick={() => isClientUnlocked ? setTab("portfolio") : openAuth("login")}>
            {isClientUnlocked ? `${clientProfile?.name} · Signal Desk` : "Login / Create profile"}
          </button>
        </div>
      </section>

      <section className={`book-layout${isPremiumClient ? "" : " no-betslip"}`}>
        <aside className="sports-rail">
          <div className="rail-title">Desk</div>
          {navItems.map((item) => (
            <button
              key={item.tab}
              className={`rail-item ${tab === item.tab ? "is-active" : ""} ${item.tone ?? ""}`}
              onClick={() => {
                if (!isClientUnlocked && ["portfolio", "predictions", "tennis", "bets", "agents"].includes(item.tab)) {
                  setTab(item.tab);
                  openAuth("login");
                  return;
                }
                setTab(item.tab);
              }}
            >
              <span>{item.label}</span>
              {item.value && <strong>{item.value}</strong>}
            </button>
          ))}
          <button className="rail-refresh" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? "Computing..." : "Refresh odds"}
          </button>
          <div className="rail-note">
            <strong>Execution layer</strong>
            <span>Live solo con betId Betfair confermato. Tennis in signal layer finché il book non è sano.</span>
          </div>
        </aside>

        <section className="book-main">
          <div className="book-main-head">
            <div>
              <p className="eyebrow">{tab === "overview" ? "Client sportsbook" : navItems.find((n) => n.tab === tab)?.label}</p>
              <h2>
                {tab === "overview" && "Decision board"}
                {tab === "portfolio" && "Client portfolio"}
                {tab === "plans" && "Client plans"}
                {tab === "predictions" && "Best bets · Signal Desk"}
                {tab === "tennis" && "Tennis · Elo Surface v2"}
                {tab === "bets" && "Execution log"}
                {tab === "partners" && "Casino & Partner Network"}
                {tab === "settings" && "Account settings"}
                {tab === "agents" && "Health & safety"}
              </h2>
            </div>
            <div className="book-head-kpis">
              <span>{predictions.length + tennisMatches.length} events</span>
              <span>{valueBets.length + tennisValueBets.length} +EV</span>
              <span>{loading ? "—" : `${summary?.win_rate ?? "0"}% win`}</span>
            </div>
          </div>

          {tab === "overview" && (
            isClientUnlocked ? (
              <>
                {isPremiumClient && (
                  <ClientInsightStrip
                    summary={summary}
                    predictions={predictions}
                    tennisMatches={tennisMatches}
                    bets={bets}
                    computedAt={computedAt}
                    tennisComputedAt={tennisComputedAt}
                  />
                )}
                <SportsbookBoard
                  predictions={predictions}
                  tennisMatches={tennisMatches}
                  onSelect={isPremiumClient ? setSlipSelection : () => undefined}
                />
              </>
            ) : (
              <PreAccessLanding
                onLogin={() => openAuth("login")}
                onCreate={() => openAuth("create")}
                onPlans={() => setTab("plans")}
              />
            )
          )}
          {tab === "portfolio" && (
            <LockedGate isUnlocked={isClientUnlocked} onUnlock={() => openAuth("login")}>
              {clientProfile && (
                <ProfilePanel
                  profile={clientProfile}
                  onLogout={logoutClientProfile}
                  onUpgrade={() => setTab("plans")}
                />
              )}
              {isPremiumClient ? (
                <PortfolioTab
                  summary={summary}
                  bets={bets}
                  tennisBetSummary={tennisBetSummary}
                  tennisBets={tennisBets}
                  onOpenDesk={() => setTab("overview")}
                />
              ) : (
                <div className="premium-gate-card">
                  <p className="eyebrow">Piano Premium</p>
                  <h3>Portfolio Betfair</h3>
                  <p>Il portfolio collegato al tuo conto Betfair è disponibile solo con il Piano Premium. Nel Piano Base hai accesso ai segnali del desk — le scommesse le gestisci tu.</p>
                  <button onClick={() => setTab("plans")}>Passa a Premium · €199/mese</button>
                </div>
              )}
            </LockedGate>
          )}
          {tab === "plans" && (
            <PlansTab
              profile={clientProfile}
              onOpenDesk={() => setTab("overview")}
              onPaymentSubmit={submitCryptoPayment}
            />
          )}
          {tab === "tennis" && (
            <LockedGate isUnlocked={isClientUnlocked} onUnlock={() => openAuth("login")}>
              <TennisTab
                matches={tennisMatches}
                summary={tennisSummary}
                loading={tennisLoading}
                computedAt={tennisComputedAt}
                agents={agents}
                showPnl={isPremiumClient}
              />
            </LockedGate>
          )}
          {tab === "predictions" && (
            <LockedGate isUnlocked={isClientUnlocked} onUnlock={() => openAuth("login")}>
              {isPremiumClient && (
                <ClientInsightStrip
                  summary={summary}
                  predictions={predictions}
                  tennisMatches={tennisMatches}
                  bets={bets}
                  computedAt={computedAt}
                  tennisComputedAt={tennisComputedAt}
                />
              )}
              <SportsbookBoard
                predictions={predictions}
                tennisMatches={tennisMatches}
                onSelect={isPremiumClient ? setSlipSelection : () => undefined}
              />
            </LockedGate>
          )}
          {tab === "bets" && (
            <LockedGate isUnlocked={isClientUnlocked} onUnlock={() => openAuth("login")}>
              {isPremiumClient ? (
                <BetsTab bets={bets} summary={summary ?? {
                  total_bets: 0, won: 0, lost: 0, pending: 0, pnl: 0,
                  win_rate: "0.0", avg_odds: "0.00", avg_stake: "0.00",
                }} leaguePnl={leaguePnl} tennisBets={tennisBets} tennisBetSummary={tennisBetSummary} />
              ) : (
                <div className="premium-gate-card">
                  <p className="eyebrow">Piano Premium</p>
                  <h3>Execution log</h3>
                  <p>Il log scommesse degli agenti è disponibile solo con il Piano Premium. Il tuo conto Betfair viene collegato durante l&apos;onboarding Premium e le bet vengono piazzate automaticamente dagli agenti.</p>
                  <button onClick={() => setTab("plans")}>Passa a Premium · €199/mese</button>
                </div>
              )}
            </LockedGate>
          )}
          {tab === "partners" && <PartnersTab />}
          {tab === "settings" && (
            <SettingsTab
              profile={clientProfile}
              onUnlock={() => openAuth("login")}
              onSave={saveClientProfile}
            />
          )}
          {tab === "agents" && (
            <LockedGate isUnlocked={isClientUnlocked} onUnlock={() => openAuth("login")}>
              {isPremiumClient ? (
                <ClientStatusTab
                  agents={agents}
                  bets={bets}
                  tennisSummary={tennisSummary}
                  computedAt={computedAt}
                  tennisComputedAt={tennisComputedAt}
                />
              ) : (
                <div className="premium-gate-card">
                  <p className="eyebrow">Piano Premium</p>
                  <h3>Status agenti</h3>
                  <p>Il monitoraggio degli agenti, l&apos;esecuzione live e l&apos;audit di sistema sono disponibili solo con il Piano Premium.</p>
                  <button onClick={() => setTab("plans")}>Passa a Premium · €199/mese</button>
                </div>
              )}
            </LockedGate>
          )}
        </section>

        {isPremiumClient && (
          <BetSlip
            key={slipSelection ? `${slipSelection.sport}-${slipSelection.id}-${slipSelection.selection}` : "empty-slip"}
            selection={slipSelection}
            onClear={() => setSlipSelection(null)}
          />
        )}
      </section>

      <footer className="text-center text-xs text-gray-600 pb-8 font-mono">
        Sportsbook Edge Desk · verified execution only · client-grade interface
      </footer>
      {authOpen && (
        <ClientAuthModal
          intent={authIntent}
          storedProfiles={storedProfiles}
          onClose={() => setAuthOpen(false)}
          onSave={handleAuthSave}
          onNotFound={(_email: string) => undefined}
        />
      )}
    </main>
  );
}
