// «Oggi in 30 secondi»: what changed (the top rows of the deltas and anomalies
// that core/series already computes for Andamento) and what not to trust in
// this window. No new number is computed here: every figure is one that the
// page shows elsewhere, brought to the top.

import type { ReactNode } from "react";
import { NO_COUNTRY_SPIKE_SHARE, noCountrySpike } from "@/core/estimate";
import { formatPct } from "@/core/kpi";
import type { GrowthData } from "@/core/model";
import { type Anomaly, SERIES_METRICS, SMALL_SAMPLE_BASE, type SeriesMetric, anomalies, compare, windowDays } from "@/core/series";
import { Chip, type Mark, fmtDay, fmtInt, fmtSigned } from "../primitives";

const SHOWN = 4;

/** The series mark follows the tile it feeds: the estimate is ≈, consented sessions approximate «Sessioni» (◐), the rest is counted. */
const SERIES_MARK: Partial<Record<SeriesMetric, Mark>> = { probably_human: "EST", sessions: "PROXY" };

export interface TodayProps {
  data: GrowthData;
  windowLabel: string;
  /** Tiles whose read failed on this page (ERRORE), to say so up front. */
  errorCount: number;
  /** Share of page views without session_id in this window, already formatted (null = read failed). */
  noSessShare: string | null;
  /** Snapshot pages say that the numbers are frozen. */
  snapshotLabel?: string;
  missingCount: number;
  missingHref: string;
}

interface Row {
  key: SeriesMetric;
  label: string;
  current: number;
  previous: number;
  delta: number;
  pct: number | null;
  smallSample: boolean;
  an: Anomaly[];
}

export function Today({ data, windowLabel, errorCount, noSessShare, snapshotLabel, missingCount, missingHref }: TodayProps) {
  const n = windowDays(data.window);
  const s = data.trends;
  const rows: Row[] = [];
  let failed = 0;
  for (const m of SERIES_METRICS) {
    const v = s.values[m.key];
    if (!v) {
      failed++;
      continue;
    }
    const c = compare(v, n);
    rows.push({ key: m.key, label: m.label, ...c, an: anomalies(v, s.days, n) });
  }
  // Anomalous metrics first (strongest σ), then the biggest absolute movement.
  const topZ = (r: Row) => Math.max(0, ...r.an.map((a) => Math.abs(a.z)));
  const ranked = [...rows].sort((a, b) => topZ(b) - topZ(a) || Math.abs(b.delta) - Math.abs(a.delta) || b.current - a.current).slice(0, SHOWN);
  const anomalyCount = rows.reduce((k, r) => k + r.an.length, 0);

  // «Non fidarti di»: the limits that invalidate a plain reading of this window.
  const spike = data.humanTraffic.ok ? noCountrySpike(data.humanTraffic.data.excl_no_country, data.humanTraffic.data.page_views) : null;
  const warnings: { glyph: "▲" | "△" | "·"; text: ReactNode }[] = [];
  if (spike?.spike && data.humanTraffic.ok) {
    warnings.push({
      glyph: "▲",
      text: (
        <>
          <b>{formatPct(spike.share, 0)} dei page view ({windowLabel}) è senza paese</b> ({fmtInt(data.humanTraffic.data.excl_no_country)} su{" "}
          {fmtInt(data.humanTraffic.data.page_views)}, soglia {formatPct(NO_COUNTRY_SPIKE_SHARE, 0)}): leggi «probabilmente umani», non i grezzi. Senza paese = test
          locali, job sintetici o crawler, causa non determinabile dai dati.
        </>
      ),
    });
  }
  if (errorCount > 0) {
    warnings.push({ glyph: "△", text: <><b>{errorCount} {errorCount === 1 ? "lettura fallita" : "letture fallite"}</b> in pagina: il valore manca, non è stato sostituito con 0.</> });
  }
  if (failed > 0) {
    warnings.push({ glyph: "△", text: <><b>{failed} serie giornaliere non lette</b>: le righe di Andamento restano vuote, non a 0.</> });
  }
  if (noSessShare !== null) {
    warnings.push({
      glyph: "·",
      text: <><b>{noSessShare} dei page view ({windowLabel}) non ha session_id</b>: sessioni, fonti delle sessioni e signup per fonte contano solo il traffico con consenso.</>,
    });
  }
  warnings.push({ glyph: "·", text: <><b>Conteggi delle fasi</b>: unità diverse per passo, nessuna conversione calcolabile.</> });
  if (ranked.some((r) => r.smallSample)) {
    warnings.push({ glyph: "·", text: <>Periodo precedente sotto {SMALL_SAMPLE_BASE} eventi su alcune righe: solo il delta assoluto, niente percentuale.</> });
  }
  if (snapshotLabel) {
    warnings.push({ glyph: "·", text: <><b>Numeri fermi allo snapshot del {snapshotLabel}</b>: ricaricare non li aggiorna.</> });
  }

  return (
    <section aria-labelledby="oggi" className="flex flex-col gap-4">
      <h2 id="oggi" className="g-h g-h--page">
        {data.window === "today" ? "Oggi" : windowLabel} in 30 secondi
      </h2>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="g-card lg:col-span-7 p-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h3 className="g-h g-h--card">Cosa è cambiato</h3>
            <span className="g-meta">
              ultimi {n} giorni interi vs i {n} precedenti · oggi escluso perché parziale
            </span>
          </div>
          {ranked.length === 0 ? (
            <p className="g-caveat">Nessuna serie giornaliera letta: niente da confrontare (nessun valore sostituito con 0).</p>
          ) : (
            <ol className="flex flex-col">
              {ranked.map((r) => (
                <li
                  key={r.key}
                  className="g-rule grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 py-2.5 items-center md:grid-cols-[minmax(0,1fr)_64px_minmax(200px,1fr)_auto]"
                  data-change={r.key}
                >
                  <span className="g-label">{r.label}</span>
                  <span className="g-num g-num--md justify-self-end">{fmtInt(r.current)}</span>
                  <span className="g-meta col-span-2 md:col-span-1 g-tab">
                    <span className="g-ink font-semibold">
                      {r.delta === 0 ? "=" : r.delta > 0 ? "▲ " : "▼ "}
                      {r.delta === 0 ? "" : fmtSigned(r.delta)}
                    </span>
                    {r.pct !== null && (
                      <span>
                        {" "}
                        ({r.pct > 0 ? "+" : ""}
                        {(r.pct * 100).toFixed(0)}%)
                      </span>
                    )}
                    <span> vs {fmtInt(r.previous)} prima</span>
                    {r.smallSample && <span> · base &lt; {SMALL_SAMPLE_BASE}, niente %</span>}
                    {r.an.map((a) => (
                      <span key={a.day} className="g-anom block">
                        {a.z > 0 ? "▲" : "▼"} anomalia {fmtDay(a.day)} · {a.z > 0 ? "+" : ""}
                        {a.z.toFixed(1)}σ
                      </span>
                    ))}
                  </span>
                  <span className="justify-self-end">
                    <Chip mark={SERIES_MARK[r.key] ?? "LIVE"} />
                  </span>
                </li>
              ))}
            </ol>
          )}
          <p className="g-meta">
            Le stesse righe, con l&apos;andamento giorno per giorno, in <a href="#andamento">Andamento</a>. Anomalia = oltre 2σ dalla media dei 14 giorni prima.
          </p>
        </div>
        <aside className="g-card lg:col-span-5 p-4 flex flex-col gap-3" style={{ borderLeft: "4px solid var(--anomaly)" }} aria-labelledby="non-fidarti">
          <h3 id="non-fidarti" className="g-h g-h--card">
            Non fidarti di
          </h3>
          <ul className="flex flex-col gap-2.5">
            {warnings.map((w, i) => (
              <li key={i} className="grid grid-cols-[18px_minmax(0,1fr)] gap-2 text-[14px] leading-snug">
                <span aria-hidden="true" className={w.glyph === "▲" ? "g-anom" : w.glyph === "△" ? "font-semibold" : "g-muted"} style={w.glyph === "△" ? { color: "var(--s-err)" } : undefined}>
                  {w.glyph}
                </span>
                <span className="g-caveat" style={{ color: "var(--ink)" }}>
                  {w.text}
                </span>
              </li>
            ))}
          </ul>
          <p className="g-rule pt-3 mt-auto text-[14px]">
            <span className="font-semibold">
              {anomalyCount} {anomalyCount === 1 ? "anomalia" : "anomalie"} negli ultimi {n} giorni
            </span>
            <span className="g-muted"> · </span>
            <a href={missingHref}>{missingCount} KPI non misurati →</a>
          </p>
        </aside>
      </div>
    </section>
  );
}
