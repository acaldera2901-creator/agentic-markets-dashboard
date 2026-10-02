"use client";

import { useYearData, type YearStats } from "./useYearData";
import { headlineFigure } from "@/lib/track-record";
import { sourceBreakdownLine } from "@/lib/track-record-copy";

// #HISTORY-TRIM-0626: sintesi del track record LIVE (tutte le pick reali, nessun
// filtro anno). Mostra hit-rate / pick decise / vinte; ROI·CLV ancora in arrivo.
// Empty-state neutro finché non si conclude nessuna pick. Niente "—" in pubblico.
type CoverageStats = NonNullable<YearStats>;

/** La riga della copertura: solo le esclusioni che ci sono davvero. */
export function coverageLine(s: CoverageStats, it: boolean): string {
  const pct = `${((s.coverage ?? 0) * 100).toFixed(1)}%`;
  const parts: string[] = [];
  if (s.unresolved_excluded) parts.push(it
    ? `${s.unresolved_excluded} senza un esito confermato`
    : `${s.unresolved_excluded} without a confirmed result`);
  if (s.unverified_excluded) parts.push(it
    ? `${s.unverified_excluded} con un esito che nessuna fonte conferma`
    : `${s.unverified_excluded} with a result no source confirms`);
  const floor = s.post_cutover_excluded?.n ?? 0;
  if (floor) parts.push(it
    ? `${floor} sotto il floor di lega (dal 25/09), fuori dal numero`
    : `${floor} below the league floor (since 25/09), left out of the number`);
  const n = s.surfaced_total ? `${s.surfaced_total} ` : "";
  const head = it
    ? `Verificate ${pct} delle ${n}pick mostrate e concluse`
    : `${pct} of the ${n}shown, finished picks verified`;
  return `${head}${parts.length ? ` · ${parts.join(" · ")}` : ""}.`;
}

export function EdgeCard({ lang }: { lang: "it" | "en" }) {
  const it = lang === "it";
  const d = useYearData("");
  const s = d?.stats;
  // #SPLIT-0201 — in testa il TOTALE (decisione di Andrea, 02/10), sotto la
  // sua scomposizione per fonte quando l'API la manda.
  const h = headlineFigure(s);
  const decided = h.won + h.lost;

  return (
    <section className="tr-hero tr-card">
      {s && h.winRate ? (
        <>
          <h2>Track record</h2>
          <div className="tr-hbot">
            <div className="tr-card">
              <div className="tr-big">{h.winRate}</div>
              {/* #SETTLE-0909 — la percentuale non va pubblicata nuda.
                  L'intervallo al 95% dice quanto è solida: 3 su 4 e 750 su 1000
                  sono entrambi «75%», ma solo uno dei due significa qualcosa.
                  Se l'API è di un deploy precedente e non lo manda, si ricade
                  sull'etichetta semplice invece di mostrare "undefined". */}
              <div className="tr-lab">
                hit rate
                {h.interval95
                  ? ` · 95% ${(h.interval95.low * 100).toFixed(1)}–${(h.interval95.high * 100).toFixed(1)}%`
                  : ""}
              </div>
              {h.breakdown && <div className="tr-note">{sourceBreakdownLine(lang, h.breakdown)}</div>}
            </div>
            <div className="tr-card">
              <div className="tr-big">{decided}</div>
              <div className="tr-lab">{it ? "pick decise" : "picks settled"}</div>
            </div>
            <div className="tr-card">
              <div className="tr-big tr-win">{h.won}</div>
              <div className="tr-lab">{it ? "vinte" : "won"}</div>
            </div>
          </div>
          {/* #SETTLE-0909 — la copertura, cioè il denominatore. Un track record
              che dice «65,2%» senza dire su quante delle pick mostrate è
              calcolato lascia credere che sia su tutte. Qui si dichiara anche
              quante restano fuori e perché. */}
          {/* #COERENZA-1001 — il denominatore è TUTTE le pick mostrate e
              finite, e ogni esclusione dal numero si dichiara qui: senza
              esito, esito non confermato, sotto il floor dal cutover. */}
          {typeof s.coverage === "number" && (
            <p className="tr-lab" style={{ marginTop: 10 }}>
              {coverageLine(s, it)}
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
