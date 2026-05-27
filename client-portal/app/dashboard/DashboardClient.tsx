"use client";

import EquityChart from "@/components/EquityChart";
import AllocationPie from "@/components/AllocationPie";
import { NumberTicker } from "@/components/magicui/number-ticker";
import { BorderBeam } from "@/components/magicui/border-beam";
import type { EquitySnapshot, BetRecord, DashboardStats } from "@/lib/types";
import Link from "next/link";

interface Props {
  userName: string;
  stats: DashboardStats;
  equity: EquitySnapshot[];
  recentBets: BetRecord[];
  allocation: Array<{ name: string; value: number; color: string }>;
}

const SPORT_EMOJI = { football: "⚽", tennis: "🎾" } as const;

const LABEL: React.CSSProperties = {
  color: "var(--am-muted-2)",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  fontFamily: "var(--font-mono), monospace",
};

export default function DashboardClient({
  userName,
  stats,
  equity,
  recentBets,
  allocation,
}: Props) {
  const { currentBalance, totalPnL, totalPnLPct, winRate, activeBets, startingBalance } = stats;
  const pnlColor = totalPnL >= 0 ? "var(--am-green)" : "var(--am-red)";
  const pnlDim = totalPnL >= 0 ? "var(--am-green-dim)" : "var(--am-red-dim)";
  const pnlBorder = totalPnL >= 0 ? "var(--am-green-b)" : "var(--am-red-b)";

  const today = new Date().toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="animate-slide-up flex flex-col gap-6">

      {/* ─── Header ─────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div style={LABEL}>Portafoglio</div>
          <h1
            style={{
              color: "var(--am-text)",
              fontWeight: 800,
              fontSize: "clamp(1.7rem,3.5vw,2.4rem)",
              margin: "5px 0 0",
              letterSpacing: "-0.025em",
              lineHeight: 1.05,
            }}
          >
            {userName}
          </h1>
        </div>
        <div className="flex items-center gap-2 mt-1 flex-shrink-0">
          <span className="live-dot" />
          <span
            style={{
              fontSize: 10,
              color: "var(--am-muted)",
              fontFamily: "var(--font-mono), monospace",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            Live · {today}
          </span>
        </div>
      </div>

      {/* ─── Balance Hero ────────────────────────────────────── */}
      <div
        style={{
          position: "relative",
          background: "rgba(140,145,255,0.03)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid var(--am-line)",
          borderRadius: 14,
          padding: "28px 28px 24px",
          overflow: "hidden",
        }}
      >
        <BorderBeam colorFrom="#22C55E" colorTo="#818CF8" duration={5} borderRadius={14} />

        <div style={LABEL}>Net Asset Value</div>
        <div
          className="flex items-end flex-wrap gap-3"
          style={{ marginTop: 8, marginBottom: 24 }}
        >
          <div
            style={{
              fontSize: "clamp(2.4rem,5vw,3.5rem)",
              fontWeight: 900,
              color: "var(--am-text)",
              lineHeight: 1,
              fontVariantNumeric: "tabular-nums",
              letterSpacing: "-0.03em",
              fontFamily: "var(--font-display), sans-serif",
            }}
          >
            <NumberTicker value={currentBalance} prefix="€" decimals={2} />
          </div>
          <div className="flex items-center gap-2" style={{ paddingBottom: 4 }}>
            <span
              style={{
                fontSize: 17,
                fontWeight: 700,
                color: pnlColor,
                fontFamily: "var(--font-mono), monospace",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              <NumberTicker
                value={Math.abs(totalPnL)}
                prefix={totalPnL >= 0 ? "+€" : "−€"}
                decimals={2}
              />
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: pnlColor,
                background: pnlDim,
                border: `1px solid ${pnlBorder}`,
                borderRadius: 4,
                padding: "2px 7px",
                fontFamily: "var(--font-mono), monospace",
              }}
            >
              {totalPnLPct >= 0 ? "+" : ""}{totalPnLPct.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* Secondary stats strip */}
        <div
          style={{
            display: "flex",
            borderTop: "1px solid var(--am-line)",
            paddingTop: 20,
            flexWrap: "wrap",
            gap: "16px 0",
          }}
        >
          {[
            {
              label: "Win Rate",
              value: winRate,
              suffix: "%",
              decimals: 1,
              color:
                winRate >= 55
                  ? "var(--am-green)"
                  : winRate >= 45
                  ? "var(--am-amber)"
                  : "var(--am-red)",
            },
            {
              label: "Posizioni Aperte",
              value: activeBets,
              suffix: "",
              decimals: 0,
              color: activeBets > 0 ? "var(--am-amber)" : "var(--am-muted)",
            },
            {
              label: "Capitale Iniziale",
              value: startingBalance,
              prefix: "€",
              suffix: "",
              decimals: 0,
              color: "var(--am-muted)",
            },
          ].map((s, i) => (
            <div
              key={s.label}
              style={{
                flex: "1 1 100px",
                paddingLeft: i > 0 ? 20 : 0,
                borderLeft: i > 0 ? "1px solid var(--am-line)" : "none",
              }}
            >
              <div style={LABEL}>{s.label}</div>
              <div
                style={{
                  marginTop: 5,
                  fontSize: 20,
                  fontWeight: 700,
                  color: s.color,
                  fontVariantNumeric: "tabular-nums",
                  letterSpacing: "-0.01em",
                }}
              >
                <NumberTicker
                  value={s.value}
                  prefix={s.prefix ?? ""}
                  suffix={s.suffix}
                  decimals={s.decimals}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Equity Chart ────────────────────────────────────── */}
      <div
        style={{
          background: "rgba(140,145,255,0.02)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: "1px solid var(--am-line)",
          borderLeft: "2px solid var(--am-green)",
          borderRadius: "0 12px 12px 0",
          padding: "20px 20px 14px",
        }}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <div style={LABEL}>Equity Line</div>
            <div
              style={{
                color: "var(--am-text)",
                fontWeight: 700,
                fontSize: 15,
                marginTop: 3,
                letterSpacing: "-0.01em",
              }}
            >
              Andamento Portafoglio
            </div>
          </div>
          <span
            style={{
              background: totalPnL >= 0 ? "var(--am-green-dim)" : "var(--am-red-dim)",
              border: `1px solid ${totalPnL >= 0 ? "var(--am-green-b)" : "var(--am-red-b)"}`,
              color: pnlColor,
              borderRadius: 4,
              padding: "3px 10px",
              fontSize: 11,
              fontWeight: 700,
              fontFamily: "var(--font-mono), monospace",
            }}
          >
            {totalPnLPct >= 0 ? "+" : ""}{totalPnLPct.toFixed(2)}%
          </span>
        </div>
        <EquityChart data={equity} startingBalance={startingBalance} />
      </div>

      {/* ─── Bottom row ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4">

        {/* Allocation */}
        <div
          style={{
            background: "rgba(140,145,255,0.02)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            border: "1px solid var(--am-line)",
            borderRadius: 12,
            padding: "18px 20px",
          }}
        >
          <div style={LABEL}>Allocazione</div>
          <div
            style={{
              color: "var(--am-text)",
              fontWeight: 700,
              fontSize: 14,
              marginTop: 3,
              marginBottom: 16,
              letterSpacing: "-0.01em",
            }}
          >
            Football vs Tennis
          </div>
          <AllocationPie data={allocation} totalBalance={currentBalance} />
        </div>

        {/* Recent Bets */}
        <div
          style={{
            background: "rgba(140,145,255,0.02)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            border: "1px solid var(--am-line)",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          <div
            className="flex items-center justify-between"
            style={{
              padding: "14px 18px",
              borderBottom: "1px solid var(--am-line)",
            }}
          >
            <div style={LABEL}>Ultime Operazioni</div>
            <Link
              href="/dashboard/history"
              style={{
                color: "var(--am-green)",
                fontSize: 11,
                fontWeight: 600,
                textDecoration: "none",
                letterSpacing: "0.04em",
              }}
            >
              Vedi tutto →
            </Link>
          </div>

          {recentBets.length === 0 ? (
            <div
              style={{
                padding: "32px",
                textAlign: "center",
                color: "var(--am-muted)",
                fontSize: 13,
              }}
            >
              Nessuna operazione registrata.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 12,
                }}
              >
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--am-line)" }}>
                    {["Data", "Sport", "Match", "Quota", "Stake", "Esito", "P&L"].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: "9px 14px",
                          textAlign: "left",
                          ...LABEL,
                          fontSize: 9,
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentBets.map((bet, idx) => {
                    const pnl = bet.profit_loss ?? 0;
                    const pColor =
                      pnl > 0
                        ? "var(--am-green)"
                        : pnl < 0
                        ? "var(--am-red)"
                        : "var(--am-muted)";
                    return (
                      <tr
                        key={bet.id}
                        style={{
                          borderBottom:
                            idx < recentBets.length - 1
                              ? "1px solid var(--am-line)"
                              : "none",
                          transition: "background 0.1s",
                        }}
                        onMouseEnter={(e) =>
                          ((e.currentTarget as HTMLElement).style.background =
                            "rgba(140,145,255,0.04)")
                        }
                        onMouseLeave={(e) =>
                          ((e.currentTarget as HTMLElement).style.background =
                            "transparent")
                        }
                      >
                        <td
                          style={{
                            padding: "10px 14px",
                            color: "var(--am-muted)",
                            fontFamily: "var(--font-mono), monospace",
                            fontSize: 11,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {new Date(bet.placed_at).toLocaleDateString("it-IT", {
                            day: "2-digit",
                            month: "short",
                          })}
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          <span style={{ fontSize: 13 }}>
                            {SPORT_EMOJI[bet.sport] ?? "🏆"}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: "10px 14px",
                            color: "var(--am-text)",
                            maxWidth: 180,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            fontWeight: 500,
                          }}
                        >
                          {bet.match_name}
                        </td>
                        <td
                          style={{
                            padding: "10px 14px",
                            color: "var(--am-text)",
                            fontFamily: "var(--font-mono), monospace",
                            fontWeight: 600,
                          }}
                        >
                          {bet.odds?.toFixed(2) ?? "—"}
                        </td>
                        <td
                          style={{
                            padding: "10px 14px",
                            color: "var(--am-muted)",
                            fontFamily: "var(--font-mono), monospace",
                          }}
                        >
                          €{bet.stake?.toFixed(2) ?? "—"}
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          <span className={`status-pill ${bet.status}`}>
                            {bet.status}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: "10px 14px",
                            color: pColor,
                            fontFamily: "var(--font-mono), monospace",
                            fontWeight: 700,
                          }}
                        >
                          {bet.status === "pending"
                            ? "—"
                            : `${pnl >= 0 ? "+" : ""}€${pnl.toFixed(2)}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
