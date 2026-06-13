"use client";

import { useState } from "react";
import { YearToggle } from "./YearToggle";
import { useYearData } from "./useYearData";

// Scheda "Per segmento" con bottone 2025 indipendente. Hit-rate + campione per segmento.
export function SegmentTable({ lang }: { lang: "it" | "en" }) {
  const it = lang === "it";
  const [year, setYear] = useState<"2026" | "2025">("2026");
  const d = useYearData(year, "segments");
  const segs = d?.segments ?? [];
  return (
    <>
      <div className="tr-sh">
        <span className="tr-glyph">📊</span>
        <h2>{it ? "Per segmento" : "By segment"}</h2>
        <YearToggle value={year} onChange={setYear} lang={lang} />
      </div>
      <div className="tr-card tr-score">
        <table>
          <thead>
            <tr>
              <th></th>
              <th className="grp">Hit rate</th>
              <th className="grp vcol">{it ? "Campione" : "Sample"}</th>
            </tr>
          </thead>
          <tbody>
            {segs.length === 0 ? (
              <tr>
                <td colSpan={3} className="tr-empty">
                  {it ? `Nessun dato per il ${year}` : `No data for ${year} yet`}
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
                    <span className="cn">{s.decided} {it ? "pick" : "picks"}</span>
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
