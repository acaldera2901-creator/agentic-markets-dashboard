"use client";

import { useState } from "react";
import { filterConcluded } from "@/lib/track-record-history";

export type LedgerRow = {
  sport: string;
  competition: string | null;
  home_team: string | null;
  away_team: string | null;
  pick: string | null;
  confidence_score?: number | null;
  result: string | null;
  starts_at: string | null;
};

// Registro: SOLO pick concluse (won/lost). Una pick entra qui quando la
// partita finisce — i pending/upcoming sono esclusi.
export function PickLedger({ rows }: { rows: LedgerRow[] }) {
  const [sport, setSport] = useState<"all" | "football" | "tennis">("all");
  const concluded = filterConcluded(rows).filter((r) => sport === "all" || r.sport === sport);
  return (
    <div>
      <div className="tr-fil">
        <span className="tr-pill c">{concluded.length} concluse</span>
        <span className="tr-divider" />
        <span className="tr-eye" style={{ marginRight: 2 }}>
          sport
        </span>
        {(["all", "football", "tennis"] as const).map((s) => (
          <button
            key={s}
            className={`tr-pill btn ${sport === s ? "on" : ""}`}
            onClick={() => setSport(s)}
          >
            {s === "all" ? "Tutti" : s === "football" ? "⚽ Calcio" : "🎾 Tennis"}
          </button>
        ))}
      </div>
      <div className="tr-card">
        <div className="tr-ledger">
          {concluded.map((r, i) => (
            <div key={i} className="tr-lrow">
              <span className="d">
                {r.starts_at
                  ? new Date(r.starts_at).toLocaleDateString("it", { day: "2-digit", month: "short" })
                  : "—"}
              </span>
              <span>
                {r.home_team ?? "?"}–{r.away_team ?? "?"}
                {r.pick ? <span className="comp"> · {r.pick}</span> : null}
              </span>
              <span className="comp">{r.competition}</span>
              <span className="pr">
                {r.confidence_score != null ? `${Math.round(r.confidence_score)}%` : "—"}
              </span>
              <span className={`tr-tag ${r.result === "won" ? "w" : "l"}`}>
                {r.result === "won" ? "WON" : "LOST"}
              </span>
            </div>
          ))}
        </div>
        <div className="tr-glock">
          🔒 Registro completo e drill-down per-pick (prob-al-pick, CLV) —{" "}
          <span className="tr-pill btn">Sblocca con Pro</span>
        </div>
      </div>
    </div>
  );
}
