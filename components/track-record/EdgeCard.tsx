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
          <h2>Track record</h2>
          <div className="tr-hbot">
            <div className="tr-card">
              <div className="tr-big">{s.win_rate}</div>
              {/* #SETTLE-0909 — la percentuale non va pubblicata nuda.
                  L'intervallo al 95% dice quanto è solida: 3 su 4 e 750 su 1000
                  sono entrambi «75%», ma solo uno dei due significa qualcosa.
                  Se l'API è di un deploy precedente e non lo manda, si ricade
                  sull'etichetta semplice invece di mostrare "undefined". */}
              <div className="tr-lab">
                hit rate
                {s.interval_95
                  ? ` · 95% ${(s.interval_95.low * 100).toFixed(1)}–${(s.interval_95.high * 100).toFixed(1)}%`
                  : ""}
              </div>
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
          {/* #SETTLE-0909 — la copertura, cioè il denominatore. Un track record
              che dice «65,2%» senza dire su quante delle pick mostrate è
              calcolato lascia credere che sia su tutte. Qui si dichiara anche
              quante restano fuori e perché. */}
          {typeof s.coverage === "number" && (
            <p className="tr-lab" style={{ marginTop: 10 }}>
              {it
                ? `Verificate ${(s.coverage * 100).toFixed(1)}% delle pick mostrate${s.unverified_excluded ? ` · ${s.unverified_excluded} fuori perché nessuna fonte le conferma` : ""}.`
                : `${(s.coverage * 100).toFixed(1)}% of shown picks verified${s.unverified_excluded ? ` · ${s.unverified_excluded} left out because no source confirms them` : ""}.`}
            </p>
          )}
          <p className="tr-lab" style={{ marginTop: 12 }}>
            {it
              ? "Edge vs mercato (ROI) in arrivo col confronto quote storiche."
              : "Edge vs market (ROI) coming with the historical-odds comparison."}
          </p>
        </>
      ) : (
        <>
          <h2>Track record</h2>
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
