"use client";

import { useState } from "react";
import { SportMark } from "@/app/components/sport-icon";
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
  locked?: boolean; // proiezione per-tier: true per free/anonimo, false/undefined per Pro
};

const PREVIEW = 8; // pick visibili prima dell'espansione

// Registro: SOLO pick concluse (won/lost). Una pick entra qui quando la
// partita finisce — i pending/upcoming sono esclusi.
export function PickLedger({ rows, lang }: { rows: LedgerRow[]; lang: "it" | "en" }) {
  const it = lang === "it";
  const [sport, setSport] = useState<"all" | "football" | "tennis">("all");
  const [expanded, setExpanded] = useState(false);
  const concluded = filterConcluded(rows).filter((r) => sport === "all" || r.sport === sport);
  const visible = expanded ? concluded : concluded.slice(0, PREVIEW);
  // Lock CTA solo per chi NON ha accesso (righe proiettate come locked). Pro → niente lock.
  const isLocked = concluded.some((r) => r.locked);

  return (
    <div>
      <div className="tr-fil">
        <span className="tr-pill c">{concluded.length} {it ? "concluse" : "settled"}</span>
        <span className="tr-divider" />
        <span className="tr-eye" style={{ marginRight: 2 }}>
          sport
        </span>
        {(["all", "football", "tennis"] as const).map((s) => (
          <button
            key={s}
            className={`tr-pill btn ${sport === s ? "on" : ""}`}
            onClick={() => {
              setSport(s);
              setExpanded(false);
            }}
          >
            {s === "all"
              ? (it ? "Tutti" : "All")
              : <><SportMark sport={s} size={14} />{s === "football" ? (it ? "Calcio" : "Football") : "Tennis"}</>}
          </button>
        ))}
      </div>
      <div className="tr-card">
        <div className="tr-ledger">
          {visible.map((r, i) => (
            <div key={i} className="tr-lrow">
              <span className="d">
                {r.starts_at
                  ? new Date(r.starts_at).toLocaleDateString(it ? "it" : "en", { day: "2-digit", month: "short" })
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
        {concluded.length > PREVIEW && (
          <button className="tr-expand" onClick={() => setExpanded((v) => !v)}>
            {expanded
              ? (it ? "▴ Comprimi" : "▴ Collapse")
              : (it ? `▾ Mostra tutte le ${concluded.length} pick` : `▾ Show all ${concluded.length} picks`)}
          </button>
        )}
        {isLocked && (
          <div className="tr-glock">
            🔒 {it ? "Registro completo e drill-down per-pick (prob-al-pick, CLV)" : "Full log and per-pick drill-down (pick probability, CLV)"} —{" "}
            <span className="tr-pill btn">{it ? "Sblocca con Pro" : "Unlock with Pro"}</span>
          </div>
        )}
      </div>
    </div>
  );
}
