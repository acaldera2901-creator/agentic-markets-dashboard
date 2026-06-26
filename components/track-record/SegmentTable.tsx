"use client";

import { useYearData } from "./useYearData";

// #HISTORY-TRIM-0626: "Per segmento" sul track record live (nessun filtro anno).
// Hit-rate + campione per segmento.
export function SegmentTable({ lang }: { lang: "it" | "en" }) {
  const it = lang === "it";
  const d = useYearData("segments");
  const segs = d?.segments ?? [];
  return (
    <>
      <div className="tr-sh">
        <span className="tr-glyph">📊</span>
        <h2>{it ? "Per segmento" : "By segment"}</h2>
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
                  {it ? "Nessun dato ancora" : "No data yet"}
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
