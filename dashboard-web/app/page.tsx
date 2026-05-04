"use client";

import { useEffect, useState } from "react";

interface Summary {
  total_bets: number;
  won: number;
  lost: number;
  pnl: number;
  win_rate: string;
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
  thesis: string | null;
  placed_at: string;
}

const AGENTS = [
  "DataCollector",
  "ModelAgent",
  "AnalystAgent",
  "StrategistAgent",
  "RiskManagerAgent",
  "TraderAgent",
  "MonitorAgent",
];

const AGENT_ICONS = ["🕵️", "📈", "🔍", "🧠", "🛡️", "💰", "🔍"];

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    won: "text-green-400 border-green-400/40 bg-green-400/10",
    lost: "text-red-400 border-red-400/40 bg-red-400/10",
    pending: "text-yellow-400 border-yellow-400/40 bg-yellow-400/10",
    voided: "text-gray-400 border-gray-400/40 bg-gray-400/10",
  };
  return (
    <span
      className={`px-2 py-0.5 rounded-full border text-xs font-mono ${colors[status] ?? "text-gray-400"}`}
    >
      {status}
    </span>
  );
}

function AgentPill({ name, index }: { name: string; index: number }) {
  return (
    <div className="glass-card px-4 py-3 text-center">
      <div className="text-lg mb-1">{AGENT_ICONS[index] ?? "🤖"}</div>
      <div className="text-xs font-bold text-cyan-300">{name.replace("Agent", "")}</div>
      <div className="w-2 h-2 rounded-full bg-cyan-400 mx-auto mt-2 animate-pulse" />
    </div>
  );
}

export default function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<string>("");

  const fetchData = async () => {
    try {
      const resp = await fetch("/api/data");
      if (resp.ok) {
        const data = await resp.json();
        setSummary(data.summary);
        setBets(data.bets ?? []);
        setLastUpdate(new Date().toLocaleTimeString());
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const pnl = summary?.pnl ?? 0;

  return (
    <main className="max-w-7xl mx-auto px-6 py-12 space-y-12">
      {/* Header */}
      <section className="text-center space-y-4">
        <div className="inline-block px-4 py-1 rounded-full border border-cyan-400 text-cyan-300 text-xs font-mono tracking-wider">
          MULTI-AGENT AI · FOOTBALL PREDICTION MARKETS
        </div>
        <h1 className="text-5xl md:text-7xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-cyan-300 via-fuchsia-400 to-blue-500">
          Agentic Markets
        </h1>
        <p className="text-gray-400 text-sm font-mono">
          Last update: {lastUpdate || "—"} · Auto-refresh every 30s
        </p>
      </section>

      {/* KPI Cards */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Total Bets",
            value: loading ? "—" : String(summary?.total_bets ?? 0),
            icon: "📊",
            color: "text-white",
          },
          {
            label: "Win Rate",
            value: loading ? "—" : `${summary?.win_rate ?? "0"}%`,
            icon: "🎯",
            color: "text-cyan-300",
          },
          {
            label: "P&L",
            value: loading ? "—" : `${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}€`,
            icon: "💰",
            color: pnl >= 0 ? "text-green-400" : "text-red-400",
          },
          {
            label: "Won / Lost",
            value: loading ? "—" : `${summary?.won ?? 0} / ${summary?.lost ?? 0}`,
            icon: "⚡",
            color: "text-fuchsia-300",
          },
        ].map((kpi) => (
          <div key={kpi.label} className="glass-card p-5 text-center">
            <div className="text-3xl mb-2">{kpi.icon}</div>
            <div className={`text-2xl font-black ${kpi.color} neon-text`}>{kpi.value}</div>
            <div className="text-xs text-gray-400 mt-1">{kpi.label}</div>
          </div>
        ))}
      </section>

      {/* Agent Status */}
      <section>
        <h2 className="text-xl font-bold text-cyan-300 mb-4 font-mono">// AGENT STATUS</h2>
        <div className="grid grid-cols-3 md:grid-cols-7 gap-3">
          {AGENTS.map((agent, i) => (
            <AgentPill key={agent} name={agent} index={i} />
          ))}
        </div>
      </section>

      {/* Data Sources */}
      <section>
        <h2 className="text-xl font-bold text-cyan-300 mb-4 font-mono">// DATA SOURCES</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            {
              name: "BALLDONTLIE",
              desc: "EPL · Serie A · La Liga · CL stats",
              icon: "⚽",
              status: "configured",
            },
            {
              name: "Polymarket",
              desc: "Football prediction markets · CLOB API",
              icon: "📈",
              status: "demo",
            },
            {
              name: "Prediction Hunt",
              desc: "Arbitrage · +EV · Kalshi · PredictIt",
              icon: "🔍",
              status: "configured",
            },
            {
              name: "Dixon-Coles",
              desc: "Internal model · Poisson regression",
              icon: "🧠",
              status: "running",
            },
            {
              name: "The Odds API",
              desc: "40+ bookmakers · Real-time odds",
              icon: "📊",
              status: "configured",
            },
            {
              name: "API-Football",
              desc: "Fixtures · Lineups · Form · xG",
              icon: "🏟️",
              status: "configured",
            },
          ].map((src) => (
            <div key={src.name} className="glass-card p-4 flex items-center gap-3">
              <span className="text-2xl">{src.icon}</span>
              <div className="flex-1">
                <div className="font-bold text-sm text-white">{src.name}</div>
                <div className="text-xs text-gray-400">{src.desc}</div>
              </div>
              <span
                className={`text-xs px-2 py-0.5 rounded-full border font-mono ${
                  src.status === "running"
                    ? "border-green-400/40 text-green-400 bg-green-400/10"
                    : src.status === "demo"
                    ? "border-yellow-400/40 text-yellow-400 bg-yellow-400/10"
                    : "border-cyan-400/40 text-cyan-400 bg-cyan-400/10"
                }`}
              >
                {src.status}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Recent Bets */}
      <section>
        <h2 className="text-xl font-bold text-cyan-300 mb-4 font-mono">// RECENT BETS</h2>
        {loading ? (
          <div className="glass-card p-8 text-center text-gray-400 font-mono">Loading...</div>
        ) : bets.length === 0 ? (
          <div className="glass-card p-8 text-center text-gray-400 font-mono">
            No bets yet — system running in paper mode
          </div>
        ) : (
          <div className="glass-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-cyan-900/50">
                <tr className="text-left text-gray-400 text-xs font-mono">
                  <th className="px-4 py-3">Match</th>
                  <th className="px-4 py-3">Selection</th>
                  <th className="px-4 py-3">Odds</th>
                  <th className="px-4 py-3">Stake</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">P&L</th>
                  <th className="px-4 py-3 hidden md:table-cell">Mode</th>
                </tr>
              </thead>
              <tbody>
                {bets.map((bet, i) => (
                  <tr
                    key={bet.id}
                    className={`border-b border-cyan-900/20 hover:bg-cyan-900/10 transition-colors ${
                      i % 2 === 0 ? "" : "bg-white/[0.02]"
                    }`}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-gray-300 max-w-32 truncate">
                      {bet.match_external_id}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-cyan-300 font-bold uppercase text-xs">
                        {bet.selection}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-white">{bet.odds?.toFixed(2)}</td>
                    <td className="px-4 py-3 font-mono text-white">€{bet.stake?.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={bet.status} />
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {bet.profit_loss != null ? (
                        <span className={bet.profit_loss >= 0 ? "text-green-400" : "text-red-400"}>
                          {bet.profit_loss >= 0 ? "+" : ""}
                          {bet.profit_loss.toFixed(2)}€
                        </span>
                      ) : (
                        <span className="text-gray-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span
                        className={`text-xs font-mono ${
                          bet.paper ? "text-yellow-400" : "text-green-400"
                        }`}
                      >
                        {bet.paper ? "PAPER" : "LIVE"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="text-center text-xs text-gray-600 pb-8 font-mono">
        Agentic Markets · Multi-Agent Football Prediction Trading Desk · PAPER MODE
      </footer>
    </main>
  );
}
