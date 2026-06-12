"use client";

import { useState } from "react";
import { YearToggle } from "./YearToggle";
import { useYearData } from "./useYearData";

// Scheda "Costanza nel tempo" con bottone 2025 indipendente.
// Misura l'hit-rate SETTIMANALE REALE dell'anno selezionato (53 settimane ISO).
// Risolve il bug del prototipo: i due anni hanno dati distinti, non lo stesso pattern.
export function ConsistencyHeatmap() {
  const [year, setYear] = useState<"2026" | "2025">("2026");
  const d = useYearData(year, "weeks");
  const byWeek = new Map((d?.weeks ?? []).map((w) => [w.iso, w]));
  const cells = Array.from({ length: 53 }, (_, i) =>
    byWeek.get(`${year}-W${String(i + 1).padStart(2, "0")}`),
  );
  const populated = cells.filter(Boolean).length;
  return (
    <>
      <div className="tr-sh">
        <span className="tr-glyph">🔥</span>
        <h2>Costanza nel tempo</h2>
        <YearToggle value={year} onChange={setYear} />
      </div>
      <div className="tr-card" style={{ padding: 18 }}>
        <div className="tr-lab" style={{ margin: "0 0 12px" }}>
          {year} · {populated > 0 ? `${populated} settimane con pick` : "in arrivo dal backfill"}
        </div>
        <div className="tr-ehm53">
          {cells.map((w, i) => {
            const a = w ? Math.min(1, 0.25 + w.hitRate * 0.75) : 0;
            return (
              <div
                key={i}
                className="tr-ec"
                title={w ? `${w.iso}: ${(w.hitRate * 100).toFixed(0)}% (${w.decided})` : "nessuna pick"}
                style={w ? { background: `rgba(255,106,94,${a.toFixed(2)})` } : undefined}
              />
            );
          })}
        </div>
        <div className="tr-eleg">meno → più · vuoto = nessuna pick</div>
      </div>
    </>
  );
}
