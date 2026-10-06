// Filone A — daily series, comparison with the previous period, anomalies.
// Presentational only: receives the normalized series (or nothing) and renders.

import { HUMAN_FILTER_CRITERIA, NO_COUNTRY_SPIKE_SHARE, noCountrySpike } from "@/core/estimate";
import type { GrowthData } from "@/core/model";
import { ANOMALY_BASELINE_DAYS, ANOMALY_SIGMA, type Anomaly, SERIES_METRICS, SMALL_SAMPLE_BASE, anomalies, compare, windowDays } from "@/core/series";
import { Chip, SectionTitle, Why, fmtDay, fmtInt, fmtSigned } from "../primitives";

/** Inline SVG sparkline: one series, anomalous days ringed + labelled, native hover per point. */
function Sparkline({ values, days, flagged }: { values: number[]; days: string[]; flagged: Set<number> }) {
  const W = 168;
  const H = 36;
  const P = 4;
  const max = Math.max(1, ...values);
  const x = (i: number) => P + (values.length === 1 ? 0 : (i * (W - 2 * P)) / (values.length - 1));
  const y = (v: number) => H - P - (v / max) * (H - 2 * P);
  const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`andamento, massimo ${fmtInt(max)}`} className="overflow-visible">
      <line x1={P} x2={W - P} y1={H - P} y2={H - P} className="g-spark-base" strokeWidth={1} />
      <polyline points={pts} fill="none" className="g-spark-line" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      {values.map((v, i) => (
        <g key={days[i]}>
          {flagged.has(i) && <circle cx={x(i)} cy={y(v)} r={4.5} className="g-spark-ring" strokeWidth={2} />}
          {/* invisible, larger hit target for the native tooltip */}
          <circle cx={x(i)} cy={y(v)} r={6} fill="transparent">
            <title>{`${fmtDay(days[i])}: ${fmtInt(v)}${flagged.has(i) ? " — anomalia" : ""}`}</title>
          </circle>
        </g>
      ))}
    </svg>
  );
}

function AnomalyNote({ a }: { a: Anomaly }) {
  return (
    <li className="g-anom text-[12px] font-medium">
      {a.z > 0 ? "▲" : "▼"} {fmtDay(a.day)}: {fmtInt(a.value)} <span className="g-muted font-normal">(media {ANOMALY_BASELINE_DAYS}g prima {a.mean.toFixed(1)} ± {a.sd.toFixed(1)}, {a.z > 0 ? "+" : ""}
      {a.z.toFixed(1)}σ)</span>
    </li>
  );
}

const pct = (r: number) => `${(r * 100).toFixed(0)}%`;

export function Trends({ data }: { data: GrowthData }) {
  const n = windowDays(data.window);
  const s = data.trends;
  const shown = s.days.slice(s.days.length - n);
  const rows = SERIES_METRICS.map((m) => {
    const v = s.values[m.key];
    if (!v) return { m, v: null, c: null, an: [] as Anomaly[] };
    return { m, v, c: compare(v, n), an: anomalies(v, s.days, n) };
  });
  const cur = (k: string) => rows.find((r) => r.m.key === k)?.c?.current ?? null;
  const human = cur("probably_human");
  const raw = cur("page_views");
  const noCountry = cur("page_views_no_country");
  const spike = raw !== null && noCountry !== null ? noCountrySpike(noCountry, raw) : null;

  return (
    <section aria-labelledby="andamento" className="flex flex-col gap-3">
      <SectionTitle id="andamento" title="Andamento giornaliero" hint={`ultimi ${n} giorni interi vs i ${n} precedenti`} />
      <p className="text-[14px] flex flex-wrap items-center gap-x-2 gap-y-1">
        <span>
          Page view ultimi {n}g: <span className="g-num g-num--sm">{human === null ? "n/d" : fmtInt(human)}</span> probabilmente umani
        </span>
        <Chip mark="EST" />
        <span className="g-muted">· {raw === null ? "n/d" : fmtInt(raw)} grezzi</span>
        <Chip mark="LIVE" />
      </p>
      {spike?.spike && (
        <div role="alert" className="g-card px-4 py-3 text-[14px]" style={{ borderLeft: "4px solid var(--anomaly)" }}>
          <span className="g-anom">▲</span> Picco anomalo, controllare prima di leggere i totali: {pct(spike.share!)} dei page view degli ultimi {n} giorni è senza paese (soglia{" "}
          {pct(NO_COUNTRY_SPIKE_SHARE)}).
        </div>
      )}
      <Why label="perché e come si legge">
        I page view grezzi contengono anche crawler, job sintetici e traffico senza paese: per le persone leggi la riga «probabilmente umani» (STIMATO, stesso criterio
        della card in Acquisition: {HUMAN_FILTER_CRITERIA.map((c, i) => `${i + 1}) ${c}`).join("; ")}). Il grezzo resta accanto. Giorni di calendario nel fuso
        Europe/Rome, dal {fmtDay(shown[0])} al {fmtDay(shown[shown.length - 1])}; oggi è escluso perché parziale. Un giorno senza eventi vale 0 solo se la lettura è
        riuscita: se la query fallisce la riga resta vuota. Con un periodo precedente sotto {SMALL_SAMPLE_BASE} eventi c&apos;è solo il delta assoluto (campione
        piccolo). <b>Anomalia</b> = giorno oltre {ANOMALY_SIGMA} deviazioni standard (σ) dalla media dei {ANOMALY_BASELINE_DAYS} giorni prima, solo con ≥
        {ANOMALY_BASELINE_DAYS} giorni di storia dal primo dato registrato; σ è la deviazione standard campionaria di quei {ANOMALY_BASELINE_DAYS} giorni, z = (valore −
        media) / σ.
      </Why>
      <div className="g-card p-4 g-scroll">
        <table className="g-table">
          <thead>
            <tr>
              <th>Metrica</th>
              <th className="r">Ultimi {n}g</th>
              <th className="r">{n}g prima</th>
              <th className="r">Delta</th>
              <th>Andamento</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ m, v, c, an }) => (
              <tr key={m.key}>
                <td className="whitespace-nowrap">
                  <span className="g-ink">{m.label}</span>
                  {m.key === "sessions" && <div className="g-meta">somma delle sessioni di ogni giorno</div>}
                  {m.key === "probably_human" && (
                    <div className="g-meta">
                      <Chip mark="EST" /> esclusi senza paese, paesi senza sessioni, raffiche
                    </div>
                  )}
                  {m.key === "page_views" && (
                    <div className="g-meta">
                      <Chip mark="LIVE" /> crawler e senza paese inclusi
                    </div>
                  )}
                  {m.key === "page_views_no_country" && <div className="g-meta">test locali, job sintetici o crawler</div>}
                </td>
                {v && c ? (
                  <>
                    <td className="r g-num g-num--sm">{fmtInt(c.current)}</td>
                    <td className="r g-muted">{fmtInt(c.previous)}</td>
                    <td className="r whitespace-nowrap">
                      <span className="font-semibold">{fmtSigned(c.delta)}</span>
                      {c.pct !== null && (
                        <span className="g-muted">
                          {" "}
                          ({c.pct > 0 ? "+" : ""}
                          {(c.pct * 100).toFixed(0)}%)
                        </span>
                      )}
                    </td>
                    <td>
                      <Sparkline values={v.slice(v.length - n)} days={shown} flagged={new Set(an.map((a) => a.index - (v.length - n)))} />
                    </td>
                    <td className="min-w-[180px]">
                      {c.smallSample && (
                        <div className="g-meta">
                          campione piccolo (base {fmtInt(c.previous)} &lt; {SMALL_SAMPLE_BASE}): niente %
                        </div>
                      )}
                      {c.partialHistory && <div className="g-meta">il periodo precedente comincia prima del primo dato registrato</div>}
                      {an.length > 0 && (
                        <details className="g-why">
                          <summary>
                            <span className="g-anom">▲ {an.length === 1 ? "1 anomalia" : `${an.length} anomalie`}</span> <span className="g-caret" aria-hidden="true">▸</span>
                          </summary>
                          <ul className="g-why-body flex flex-col gap-1">
                            {an.map((a) => (
                              <AnomalyNote key={a.day} a={a} />
                            ))}
                          </ul>
                        </details>
                      )}
                    </td>
                  </>
                ) : (
                  <td colSpan={5} className="text-[12px]" style={{ color: "var(--s-err)" }}>
                    <Chip mark="ERRORE" /> Lettura fallita ({s.errors[m.key] ?? "errore"}) — serie vuota, nessun valore sostituito con 0.
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <details className="g-card g-why p-4">
        <summary>
          Tabella giorno per giorno <span className="g-caret" aria-hidden="true">▸</span>
        </summary>
        <div className="g-scroll mt-3">
          <table className="g-table text-[12px] g-tab">
            <thead>
              <tr>
                <th>Giorno</th>
                {SERIES_METRICS.map((m) => (
                  <th key={m.key} className="r">
                    {m.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((d, j) => {
                const i = s.days.length - n + j;
                return (
                  <tr key={d}>
                    <td className="g-muted whitespace-nowrap">{fmtDay(d)}</td>
                    {rows.map(({ m, v, an }) => (
                      <td key={m.key} className={`r ${an.some((a) => a.index === i) ? "g-anom" : ""}`}>
                        {v ? fmtInt(v[i]) : ""}
                        {an.filter((a) => a.index === i).map((a) => (a.z > 0 ? " ▲" : " ▼"))}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
