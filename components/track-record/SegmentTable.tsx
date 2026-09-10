"use client";

import { useYearData } from "./useYearData";
import { GlyphBars } from "@/components/ui/glyphs"; // #UI-MACHINA-0802
import { isRateMeaningful, MIN_DECIDED_FOR_RATE } from "@/lib/track-record"; // #SETTLE-0909

// #HISTORY-TRIM-0626: "Per segmento" sul track record live (nessun filtro anno).
// Hit-rate + campione per segmento.
export function SegmentTable({ lang }: { lang: "it" | "en" }) {
  const it = lang === "it";
  const d = useYearData("segments");
  const segs = d?.segments ?? [];
  return (
    <>
      <div className="tr-sh">
        <span className="tr-glyph"><GlyphBars size={16} /></span>
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
                    {/* #SETTLE-0909 — la guardia sul campione mancava PROPRIO QUI,
                        mentre lib/track-record.ts prometteva di applicarla
                        «everywhere a rate renders». Misurato sulla pagina il
                        10/09: un segmento pubblicava 58,6% su 29 pick e un
                        altro 46,7% su 30, allineati come se valessero uguale.
                        Sotto la soglia si mostra il campione e non la
                        percentuale: un numero che non regge non si arrotonda,
                        si tace. */}
                    {isRateMeaningful(s.decided) ? (
                      <span className="cv">{(s.hitRate * 100).toFixed(1)}%</span>
                    ) : (
                      <span className="cn" title={it
                        ? `campione troppo piccolo: ${s.decided} esiti su ${MIN_DECIDED_FOR_RATE} necessari`
                        : `sample too small: ${s.decided} of ${MIN_DECIDED_FOR_RATE} needed`}>
                        {it ? "campione ridotto" : "small sample"}
                      </span>
                    )}
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
