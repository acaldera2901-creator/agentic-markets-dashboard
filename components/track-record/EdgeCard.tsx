"use client";

import { useState } from "react";
import { YearToggle } from "./YearToggle";
import { useYearData } from "./useYearData";

// Scheda "Battiamo il mercato" con bottone 2025 indipendente.
// ROI/CLV/beat_close arrivano dal backfill backend (Parte 2): finché assenti → "—".
export function EdgeCard() {
  const [year, setYear] = useState<"2026" | "2025">("2026");
  const d = useYearData(year, "");
  const s = d?.stats;
  return (
    <section className="tr-hero tr-card">
      <div className="tr-cardtop">
        <span className="tr-eye">Battiamo il mercato</span>
        <YearToggle value={year} onChange={setYear} />
      </div>
      <h1>Battiamo il mercato.</h1>
      <div className="tr-vs">
        <div className="tr-vside tr-us">
          <span className="tr-pill c">BETREDGE</span>
          <div className="tr-big">{s?.roi ?? "—"}</div>
          <div className="tr-lab">ROI seguendo le pick</div>
        </div>
        <div className="tr-vx">VS</div>
        <div className="tr-vside tr-mk">
          <span className="tr-pill">MERCATO</span>
          <div className="tr-big">{s?.market_roi ?? "—"}</div>
          <div className="tr-lab">flat bet sul favorito</div>
        </div>
      </div>
      <div className="tr-hbot">
        <div className="tr-card">
          <div className="tr-big tr-win">{s?.clv ?? "—"}</div>
          <div className="tr-lab">CLV medio</div>
        </div>
        <div className="tr-card">
          <div className="tr-big">{s?.win_rate ?? "—"}</div>
          <div className="tr-lab">hit rate</div>
        </div>
        <div className="tr-card">
          <div className="tr-big">{s?.beat_close ?? "—"}</div>
          <div className="tr-lab">battono la chiusura</div>
        </div>
      </div>
    </section>
  );
}
