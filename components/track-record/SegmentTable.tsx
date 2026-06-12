"use client";

import { useState } from "react";
import { YearToggle } from "./YearToggle";
import { useYearData } from "./useYearData";

// Scheda "Per segmento" con bottone 2025 indipendente. Hit-rate + campione per segmento.
export function SegmentTable() {
  const [year, setYear] = useState<"2026" | "2025">("2026");
  const d = useYearData(year, "segments");
  const segs = d?.segments ?? [];
  return (
    <>
      <div className="tr-sh">
        <span className="tr-glyph">📊</span>
        <h2>Per segmento</h2>
        <YearToggle value={year} onChange={setYear} />
      </div>
      <div className="tr-card tr-score">
        <table>
          <thead>
            <tr>
              <th></th>
              <th className="grp">Hit rate</th>
              <th className="grp vcol">Campione</th>
            </tr>
          </thead>
          <tbody>
            {segs.length === 0 ? (
              <tr>
                <td colSpan={3} className="tr-empty">
                  Nessun dato per {year} (in arrivo dal backfill)
                </td>
              </tr>
            ) : (
              segs.map((s) => (
                <tr key={s.key}>
                  <td>
                    <span className="seg-name">{s.label}</span>
                  </td>
                  <td>
                    <span className="cv">{(s.hitRate * 100).toFixed(1)}%</span>
                  </td>
                  <td className="vcol">
                    <span className="cn">{s.decided} pick</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
