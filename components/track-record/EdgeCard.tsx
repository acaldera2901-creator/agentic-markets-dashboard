"use client";

import { useYearData } from "./useYearData";

// #HISTORY-TRIM-0626: sintesi del track record LIVE (tutte le pick reali, nessun
// filtro anno). Mostra hit-rate / pick decise / vinte; ROI·CLV ancora in arrivo.
// Empty-state neutro finché non si conclude nessuna pick. Niente "—" in pubblico.
export function EdgeCard({ lang }: { lang: "it" | "en" }) {
  const it = lang === "it";
  const d = useYearData("");
  const s = d?.stats;
  const decided = (s?.won ?? 0) + (s?.lost ?? 0);

  return (
    <section className="tr-hero tr-card">
      {s?.win_rate ? (
        <>
          <h1>Track record</h1>
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
          <h1>Track record</h1>
          <p className="tr-lab" style={{ marginTop: 8 }}>
            {it
              ? "Le pick concluse appariranno qui man mano che le partite finiscono."
              : "Settled picks will appear here as matches finish."}
          </p>
        </>
      )}
    </section>
  );
}
