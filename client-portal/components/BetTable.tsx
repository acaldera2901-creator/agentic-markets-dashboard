"use client";

import type { BetRecord } from "@/lib/types";

interface Props {
  bets: BetRecord[];
}

const SPORT_EMOJI = { football: "⚽", tennis: "🎾" } as const;

export default function BetTable({ bets }: Props) {
  if (!bets.length) {
    return (
      <div
        style={{
          padding: "32px",
          textAlign: "center",
          color: "var(--am-muted)",
          fontSize: 13,
        }}
      >
        No bets found for the selected filters.
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--am-line)" }}>
            {["Data", "Sport", "Match", "Selezione", "Quota", "Stake", "Esito", "P&L"].map(
              (h) => (
                <th
                  key={h}
                  style={{
                    padding: "10px 12px",
                    textAlign: "left",
                    color: "var(--am-muted-2)",
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    fontFamily: "monospace",
                    whiteSpace: "nowrap",
                  }}
                >
                  {h}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody>
          {bets.map((bet) => {
            const pnl = bet.profit_loss ?? 0;
            const pnlColor = pnl > 0 ? "var(--am-green)" : pnl < 0 ? "var(--am-red)" : "var(--am-muted)";
            return (
              <tr
                key={bet.id}
                style={{
                  borderBottom: "1px solid var(--am-line)",
                  transition: "background 0.12s",
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLElement).style.background = "transparent")
                }
              >
                <td style={{ padding: "11px 12px", color: "var(--am-muted)", whiteSpace: "nowrap" }}>
                  {new Date(bet.placed_at).toLocaleDateString("it-IT", {
                    day: "2-digit",
                    month: "short",
                    year: "2-digit",
                  })}
                </td>
                <td style={{ padding: "11px 12px", whiteSpace: "nowrap" }}>
                  <span style={{ fontSize: 14 }}>
                    {SPORT_EMOJI[bet.sport] ?? "🏆"}
                  </span>{" "}
                  <span
                    style={{
                      color: bet.sport === "football" ? "#4CAF50" : "#FF9800",
                      fontSize: 11,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      fontFamily: "monospace",
                    }}
                  >
                    {bet.sport}
                  </span>
                </td>
                <td
                  style={{
                    padding: "11px 12px",
                    color: "var(--am-text)",
                    maxWidth: 200,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {bet.match_name}
                </td>
                <td style={{ padding: "11px 12px", color: "var(--am-muted)", whiteSpace: "nowrap" }}>
                  {bet.selection}
                </td>
                <td
                  style={{
                    padding: "11px 12px",
                    color: "var(--am-text)",
                    fontFamily: "monospace",
                    fontWeight: 600,
                  }}
                >
                  {bet.odds?.toFixed(2) ?? "—"}
                </td>
                <td
                  style={{
                    padding: "11px 12px",
                    color: "var(--am-text)",
                    fontFamily: "monospace",
                  }}
                >
                  €{bet.stake?.toFixed(2) ?? "—"}
                </td>
                <td style={{ padding: "11px 12px" }}>
                  <span className={`status-pill ${bet.status}`}>{bet.status}</span>
                </td>
                <td
                  style={{
                    padding: "11px 12px",
                    color: pnlColor,
                    fontFamily: "monospace",
                    fontWeight: 700,
                    whiteSpace: "nowrap",
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
  );
}
