"use client";

import { useState } from "react";
import { YearToggle } from "./YearToggle";
import { useYearData } from "./useYearData";

// Scheda di sintesi con bottone 2025 indipendente. Degrada con grazia:
// - se ci sono i dati edge (ROI/CLV dal backfill) → vista "Battiamo il mercato" piena;
// - se c'è solo l'hit-rate (es. 2026 reale, ROI non ancora calcolato) → hero guidato dall'hit-rate;
// - se non c'è ancora nulla (es. 2025 prima del backfill) → "in arrivo".
// Niente "—" in pubblico.
export function EdgeCard({ lang }: { lang: "it" | "en" }) {
  const it = lang === "it";
  const [year, setYear] = useState<"2026" | "2025">("2026");
  const d = useYearData(year, "");
  const s = d?.stats;
  const hasEdge = !!s?.roi;
  const decided = (s?.won ?? 0) + (s?.lost ?? 0);

  return (
    <section className="tr-hero tr-card">
      <div className="tr-cardtop">
        <span className="tr-eye">Track record {year}</span>
        <YearToggle value={year} onChange={setYear} lang={lang} />
      </div>

      {hasEdge ? (
        <>
          <h1>{it ? "Battiamo il mercato." : "We beat the market."}</h1>
          <div className="tr-vs">
            <div className="tr-vside tr-us">
              <span className="tr-pill c">BETREDGE</span>
              <div className="tr-big">{s!.roi}</div>
              <div className="tr-lab">{it ? "ROI seguendo le pick" : "ROI following the picks"}</div>
            </div>
            <div className="tr-vx">VS</div>
            <div className="tr-vside tr-mk">
              <span className="tr-pill">{it ? "MERCATO" : "MARKET"}</span>
              <div className="tr-big">{s?.market_roi ?? "n/a"}</div>
              <div className="tr-lab">{it ? "flat bet sul favorito" : "flat bet on the favourite"}</div>
            </div>
          </div>
          <div className="tr-hbot">
            <div className="tr-card">
              <div className="tr-big tr-win">{s?.clv ?? "n/a"}</div>
              <div className="tr-lab">{it ? "CLV medio" : "average CLV"}</div>
            </div>
            <div className="tr-card">
              <div className="tr-big">{s?.win_rate ?? "n/a"}</div>
              <div className="tr-lab">hit rate</div>
            </div>
            <div className="tr-card">
              <div className="tr-big">{s?.beat_close ?? "n/a"}</div>
              <div className="tr-lab">{it ? "battono la chiusura" : "beat the close"}</div>
            </div>
          </div>
        </>
      ) : s?.win_rate ? (
        <>
          <h1>Track record {year}</h1>
          <div className="tr-hbot">
            <div className="tr-card">
              <div className="tr-big">{s.win_rate}</div>
              <div className="tr-lab">hit rate</div>
            </div>
            <div className="tr-card">
              <div className="tr-big">{decided}</div>
              <div className="tr-lab">{it ? "pick decise" : "picks settled"}</div>
            </div>
            <div className="tr-card">
              <div className="tr-big tr-win">{s.won ?? 0}</div>
              <div className="tr-lab">{it ? "vinte" : "won"}</div>
            </div>
          </div>
          <p className="tr-lab" style={{ marginTop: 12 }}>
            {it
              ? "Edge vs mercato (ROI · CLV) in arrivo col confronto quote storiche."
              : "Edge vs market (ROI · CLV) coming with the historical-odds comparison."}
          </p>
        </>
      ) : (
        <>
          <h1>{it ? `Storico ${year}` : `Track record ${year}`}</h1>
          <p className="tr-lab" style={{ marginTop: 8 }}>
            {it
              ? `In arrivo: ricostruzione walk-forward ${year} (stesse ricette e floor del live).`
              : `Coming soon: ${year} walk-forward reconstruction (same recipes and floors as live).`}
          </p>
        </>
      )}
    </section>
  );
}
