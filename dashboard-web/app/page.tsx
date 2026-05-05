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
  enrichment?: PredictionEnrichment | null;
}

interface AgentStatus {
  name: string;
  status: "alive" | "stale" | "offline";
  last_seen: string | null;
  age_seconds: number | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LEAGUE_FLAGS: Record<string, string> = {
  PL: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", SA: "🇮🇹", PD: "🇪🇸", BL1: "🇩🇪", FL1: "🇫🇷", CL: "⭐", EL: "🟠",
};

const TABS = ["predictions", "bets", "agents"] as const;
type Tab = typeof TABS[number];

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
    voided: "text-gray-400 border-gray-400/40 bg-gray-400/10",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full border text-xs font-mono ${colors[status] ?? "text-gray-400"}`}>
      {status}
    </span>
  );
}

// ─── Prediction "Why" Reasoning ───────────────────────────────────────────────

interface Reason { icon: string; text: string; highlight?: boolean }

function buildReasons(p: Prediction): Reason[] {
  const e = p.enrichment ?? {};
  const reasons: Reason[] = [];

  // Always: Dixon-Coles model output
  const leader = p.p_home > p.p_draw && p.p_home > p.p_away ? "HOME" : p.p_draw > p.p_away ? "DRAW" : "AWAY";
  const leaderPct = leader === "HOME" ? p.p_home : leader === "DRAW" ? p.p_draw : p.p_away;
  reasons.push({
    icon: "🧠",
    text: `Dixon-Coles model: ${leader} favoured at ${pct(leaderPct)} — λ ${p.lambda_home?.toFixed(2) ?? "?"} (home) vs ${p.lambda_away?.toFixed(2) ?? "?"} (away)`,
  });

  // Edge vs market
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

  // Pi Rating strength comparison
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

  // xG form
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
    // xGA (defensive strength)
    if (e.xga_home != null && e.xga_away != null) {
      const defDiff = e.xga_away - e.xga_home; // positive = home has better defense
      if (Math.abs(defDiff) > 0.3) {
        reasons.push({
          icon: "🛡️",
          text: `Defense: ${defDiff > 0 ? "HOME concedes less" : "AWAY concedes less"} — home concedes ${e.xga_home.toFixed(2)} vs away ${e.xga_away.toFixed(2)} xGA`,
        });
      }
    }
  }

  // Form
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

  // Injuries impact
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

  // API-Football independent model comparison
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
      reasons.push({
        icon: "✅",
        text: `API-Football confirms: HOME ${apiHome}% (our model: ${dixonHome}%) — models agree`,
      });
    }
    if (e.api_advice) {
      reasons.push({ icon: "💬", text: `API-Football advice: "${e.api_advice}"` });
    }
  }

  // Weather impact
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

  // AI narrative
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
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs text-gray-500 font-mono">{LEAGUE_FLAGS[p.league] ?? "⚽"} {p.league_name}</div>
            <div className="font-bold text-white text-base mt-0.5">
              {p.home_team} <span className="text-gray-500 font-normal">vs</span> {p.away_team}
            </div>
            <div className="text-xs text-gray-500 font-mono mt-0.5">{fmtKickoff(p.kickoff)}</div>
          </div>
          <button onClick={onClose} className="text-gray-600 hover:text-white text-xl font-mono shrink-0">✕</button>
        </div>

        {/* Probabilities */}
        <div className="space-y-1.5">
          <ProbBar label="HOME" pct={p.p_home} color="text-cyan-400" odds={p.odds_home}
            isValue={p.best_selection === "HOME" && (p.edge ?? 0) > 0.03} />
          <ProbBar label="DRAW" pct={p.p_draw} color="text-yellow-400" odds={p.odds_draw}
            isValue={p.best_selection === "DRAW" && (p.edge ?? 0) > 0.03} />
          <ProbBar label="AWAY" pct={p.p_away} color="text-fuchsia-400" odds={p.odds_away}
            isValue={p.best_selection === "AWAY" && (p.edge ?? 0) > 0.03} />
        </div>

        {/* Why section */}
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

        {/* Footer stats */}
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

        {/* Tap hint */}
        <div className="text-[10px] text-gray-700 font-mono text-center">
          tap to see why →
        </div>

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

// ─── Agent Status Tab ─────────────────────────────────────────────────────────

function AgentStatusTab({ agents }: { agents: AgentStatus[] }) {
  const AGENT_ROLES: Record<string, string> = {
    DataCollector: "Fetches fixtures, odds, history from all data sources",
    ModelAgent: "Runs Dixon-Coles Poisson model to compute match probabilities",
    AnalystAgent: "Identifies value bets by comparing model vs market odds",
    StrategistAgent: "Evaluates opportunities, assigns conviction score 0-10",
    RiskManagerAgent: "Kelly sizing, exposure limits, data quality gates",
    TraderAgent: "Executes bets on Betfair (paper or live)",
    MonitorAgent: "Heartbeat monitoring, PSI drift detection, Telegram alerts",
    ResearchAgent: "Generates AI match analysis via Ollama local LLM",
    AHCollectorAgent: "Asian Handicap odds from Pinnacle/SBOBet (S7)",
  };

  const anyOnline = agents.some((a) => a.status !== "offline");

  return (
    <div className="space-y-4">
      {/* Architecture note */}
      <div className="glass-card p-4 border-cyan-400/10">
        <div className="text-xs font-mono text-gray-400 space-y-1 leading-relaxed">
          <div className="text-cyan-400 font-bold mb-2">Architettura ibrida</div>
          <div>
            <span className="text-cyan-300">Dashboard (Vercel)</span> — Dixon-Coles · Pi Rating · xG · API-Football · Odds.
            Sempre online, non dipende dagli agenti Python.
          </div>
          <div>
            <span className="text-fuchsia-300">Agenti Python (locale)</span> — Analisi in tempo reale, Betfair execution,
            Ollama AI summaries. Devono girare su questo Mac con <code className="text-yellow-300">python run.py</code>.
          </div>
          {!anyOnline && (
            <div className="mt-2 text-yellow-400 border border-yellow-400/20 rounded px-2 py-1">
              ⚠️ Nessun agente attivo. Avvia il sistema con <code>python run.py</code> nella cartella del progetto.
              Gli agenti invieranno heartbeat ogni 30s a questo dashboard.
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
              {agent.last_seen
                ? `Last seen: ${timeAgo(agent.last_seen)}`
                : "No heartbeat received"}
              {agent.age_seconds != null && ` (${agent.age_seconds}s ago)`}
            </div>
          </div>
        ))}
      </div>

      {/* Agent pipeline diagram */}
      <div className="glass-card p-4">
        <h3 className="text-xs font-mono text-cyan-400/70 uppercase tracking-wider mb-3">Pipeline Flow</h3>
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-gray-400">
          {[
            "DataCollector", "→", "ModelAgent", "→", "AnalystAgent", "→",
            "StrategistAgent", "→", "RiskManagerAgent", "→", "TraderAgent",
          ].map((item, i) => (
            <span key={i} className={item === "→" ? "text-gray-600" : "text-cyan-300"}>{item}</span>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-gray-400 mt-2">
          {["AHCollectorAgent", "→", "AH Odds", "·", "ResearchAgent", "→", "AI Summaries", "·", "MonitorAgent", "→", "Alerts + PSI"].map((item, i) => (
            <span key={i} className={["→", "·"].includes(item) ? "text-gray-600" : "text-fuchsia-300"}>{item}</span>
          ))}
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
      {/* Summary KPIs */}
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

      {/* League P&L breakdown */}
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

      {/* Filters */}
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
          Paper only
        </button>
      </div>

      {/* Bets table */}
      {filtered.length === 0 ? (
        <div className="glass-card p-8 text-center text-gray-400 font-mono">No bets match filters</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((bet) => (
            <div key={bet.id} className={`glass-card p-4 ${
              bet.status === "won" ? "border-green-400/20" :
              bet.status === "lost" ? "border-red-400/20" : ""
            }`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-white">
                      {bet.home_team && bet.away_team
                        ? `${bet.home_team} vs ${bet.away_team}`
                        : bet.match_external_id}
                    </span>
                    {bet.league && (
                      <span className="text-xs text-gray-500 font-mono">
                        {LEAGUE_FLAGS[bet.league] ?? "⚽"} {bet.league}
                      </span>
                    )}
                    <span className={`text-xs font-mono ${bet.paper ? "text-yellow-400" : "text-green-400"}`}>
                      [{bet.paper ? "PAPER" : "LIVE"}]
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
              <div className="text-[10px] text-gray-700 font-mono mt-2">
                Placed: {timeAgo(bet.placed_at)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Predictions Tab ──────────────────────────────────────────────────────────

function PredictionsTab({
  predictions, computedAt, loading, refreshing, onRefresh,
}: {
  predictions: Prediction[];
  computedAt: string | null;
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const [leagueFilter, setLeagueFilter] = useState("ALL");
  const [valueOnly, setValueOnly] = useState(false);

  const allLeagues = [...new Set(predictions.map((p) => p.league))];
  const filtered = predictions.filter((p) => {
    if (leagueFilter !== "ALL" && p.league !== leagueFilter) return false;
    if (valueOnly && (p.edge == null || p.edge <= 0.03)) return false;
    return true;
  });
  const valueBets = predictions.filter((p) => p.edge != null && p.edge > 0.03);

  return (
    <div className="space-y-4">
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

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setValueOnly(!valueOnly)}
          className={`px-3 py-1 rounded-full border text-xs font-mono transition ${
            valueOnly ? "border-green-400 text-green-400 bg-green-400/10" : "border-white/10 text-gray-400 hover:border-green-400/40"
          }`}>
          +EV Only
        </button>
        {["ALL", ...allLeagues].map((l) => (
          <button key={l} onClick={() => setLeagueFilter(l)}
            className={`px-3 py-1 rounded-full border text-xs font-mono transition ${
              leagueFilter === l ? "border-cyan-400 text-cyan-300 bg-cyan-400/10" : "border-white/10 text-gray-400 hover:border-cyan-400/40"
            }`}>
            {LEAGUE_FLAGS[l] ?? ""} {l}
          </button>
        ))}
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
  const [tab, setTab] = useState<Tab>("predictions");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [bets, setBets] = useState<Bet[]>([]);
  const [leaguePnl, setLeaguePnl] = useState<LeaguePnl[]>([]);
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [computedAt, setComputedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [predLoading, setPredLoading] = useState(true);
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

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetch("/api/predictions", { method: "POST" });
      await fetchPredictions();
    } finally { setRefreshing(false); }
  };

  useEffect(() => {
    fetchData();
    fetchPredictions();
    fetchAgents();
    const dataInt = setInterval(fetchData, 30_000);
    const predInt = setInterval(fetchPredictions, 3_600_000);
    const agentInt = setInterval(fetchAgents, 60_000);
    return () => { clearInterval(dataInt); clearInterval(predInt); clearInterval(agentInt); };
  }, [fetchData, fetchPredictions, fetchAgents]);

  const pnl = summary?.pnl ?? 0;
  const valueBets = predictions.filter((p) => p.edge != null && p.edge > 0.03);
  const aliveAgents = agents.filter((a) => a.status === "alive").length;
  const totalAgents = agents.length || 9;

  return (
    <main className="max-w-7xl mx-auto px-6 py-10 space-y-8">
      {/* Header */}
      <section className="text-center space-y-3">
        <div className="inline-block px-4 py-1 rounded-full border border-cyan-400 text-cyan-300 text-xs font-mono tracking-wider">
          MULTI-AGENT AI · FOOTBALL PREDICTION MARKETS
        </div>
        <h1 className="text-5xl md:text-6xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-cyan-300 via-fuchsia-400 to-blue-500">
          Agentic Markets
        </h1>
        <p className="text-gray-400 text-xs font-mono">
          Last update: {lastUpdate || "—"} · Auto-refresh 30s
        </p>
      </section>

      {/* Global KPI strip */}
      <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total Bets", value: loading ? "—" : String(summary?.total_bets ?? 0), color: "text-white" },
          { label: "Win Rate", value: loading ? "—" : `${summary?.win_rate ?? "0"}%`, color: "text-cyan-300" },
          { label: "P&L", value: loading ? "—" : `${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}€`, color: pnl >= 0 ? "text-green-400" : "text-red-400" },
          { label: "Value Bets", value: String(valueBets.length), color: "text-green-400" },
          { label: "Agents", value: `${aliveAgents}/${totalAgents}`, color: aliveAgents === totalAgents ? "text-green-400" : "text-yellow-400" },
        ].map((kpi) => (
          <div key={kpi.label} className="glass-card p-4 text-center">
            <div className={`text-xl font-black ${kpi.color}`}>{kpi.value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{kpi.label}</div>
          </div>
        ))}
      </section>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/10">
        {(["predictions", "bets", "agents"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-xs font-mono uppercase tracking-wider transition border-b-2 -mb-px ${
              tab === t
                ? "border-cyan-400 text-cyan-300"
                : "border-transparent text-gray-500 hover:text-gray-300"
            }`}>
            {t === "predictions" && `Predictions (${valueBets.length > 0 ? `+EV:${valueBets.length}` : predictions.length})`}
            {t === "bets" && `Bets (${summary?.total_bets ?? 0})`}
            {t === "agents" && `Agents (${aliveAgents}/${totalAgents} alive)`}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "predictions" && (
        <PredictionsTab
          predictions={predictions}
          computedAt={computedAt}
          loading={predLoading}
          refreshing={refreshing}
          onRefresh={handleRefresh}
        />
      )}
      {tab === "bets" && (
        <BetsTab bets={bets} summary={summary ?? {
          total_bets: 0, won: 0, lost: 0, pending: 0, pnl: 0,
          win_rate: "0.0", avg_odds: "0.00", avg_stake: "0.00",
        }} leaguePnl={leaguePnl} />
      )}
      {tab === "agents" && <AgentStatusTab agents={agents} />}

      <footer className="text-center text-xs text-gray-600 pb-8 font-mono">
        Agentic Markets · Dixon-Coles · Pi Rating · xG · 9-Agent AI System · PAPER MODE
      </footer>
    </main>
  );
}
