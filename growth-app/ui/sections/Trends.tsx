// Filone A — daily series, comparison with the previous period, anomalies.
// Presentational only: receives the normalized series (or nothing) and renders.

import type { ReactNode } from "react";
import { HUMAN_FILTER_CRITERIA, NO_COUNTRY_SPIKE_SHARE, noCountrySpike } from "@/core/estimate";
import type { GrowthData } from "@/core/model";
import {
  ANOMALY_BASELINE_DAYS,
  ANOMALY_SIGMA,
  type Anomaly,
  SERIES_METRICS,
  SMALL_SAMPLE_BASE,
  anomalies,
  compare,
  windowDays,
} from "@/core/series";

const fmtInt = (n: number) => n.toLocaleString("it-IT");
const fmtSigned = (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "±") + fmtInt(Math.abs(n));
const fmtDay = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;

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
      <line x1={P} x2={W - P} y1={H - P} y2={H - P} className="stroke-gray-700" strokeWidth={1} />
      <polyline points={pts} fill="none" className="stroke-sky-400" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {values.map((v, i) => (
        <g key={days[i]}>
          {flagged.has(i) && <circle cx={x(i)} cy={y(v)} r={4.5} className="fill-gray-900 stroke-amber-300" strokeWidth={2} />}
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
    <div className="text-[11px] text-amber-300">
      {a.z > 0 ? "▲" : "▼"} ANOMALIA {fmtDay(a.day)}: {fmtInt(a.value)} (media {ANOMALY_BASELINE_DAYS}g prima {a.mean.toFixed(1)} ± {a.sd.toFixed(1)}, {a.z > 0 ? "+" : ""}
      {a.z.toFixed(1)}σ)
    </div>
  );
}

const pct = (r: number) => `${(r * 100).toFixed(0)}%`;

function Shell({ n, headline, children }: { n: number; headline: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-gray-800 pb-2">
        <h2 className="text-white font-semibold">Andamento giornaliero</h2>
        <span className="text-gray-500 text-xs">ultimi {n} giorni interi vs i {n} precedenti</span>
        {headline}
      </div>
      {children}
    </section>
  );
}

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

  const headline = (
    <span className="text-xs text-gray-300">
      Page view ultimi {n}g: <span className="font-semibold text-white tabular-nums">{human === null ? "n/d" : fmtInt(human)}</span> probabilmente umani{" "}
      <span className="text-[10px] font-semibold tracking-wider px-1 py-0.5 rounded border bg-amber-950 text-amber-300 border-amber-800">STIMATO</span>
      <span className="text-gray-500"> · {raw === null ? "n/d" : fmtInt(raw)} grezzi </span>
      <span className="text-[10px] font-semibold tracking-wider px-1 py-0.5 rounded border bg-emerald-950 text-emerald-300 border-emerald-800">MISURATO</span>
    </span>
  );

  return (
    <Shell n={n} headline={headline}>
      {spike?.spike && (
        <div role="alert" className="bg-amber-950 border border-amber-600 rounded-xl px-4 py-2 text-sm text-amber-200">
          Picco anomalo, controllare prima di leggere i totali: {pct(spike.share!)} dei page view degli ultimi {n} giorni è senza paese (soglia{" "}
          {pct(NO_COUNTRY_SPIKE_SHARE)}).
        </div>
      )}
      <p className="text-gray-500 text-[11px] leading-snug">
        I page view grezzi contengono anche crawler, job sintetici e traffico senza paese: per le persone leggi la riga «probabilmente umani»
        (STIMATO, stesso criterio della tile in Acquisition: {HUMAN_FILTER_CRITERIA.map((c, i) => `${i + 1}) ${c}`).join("; ")}). Il grezzo resta accanto.{" "}
        Giorni di calendario nel fuso Europe/Rome, dal {fmtDay(shown[0])} al {fmtDay(shown[shown.length - 1])}; oggi è escluso perché
        parziale. Un giorno senza eventi vale 0 solo se la lettura è riuscita: se la query fallisce la riga resta vuota.
        Con un periodo precedente sotto {SMALL_SAMPLE_BASE} eventi c&apos;è solo il delta assoluto (campione piccolo). Anomalia = giorno oltre{" "}
        {ANOMALY_SIGMA} deviazioni standard dalla media dei {ANOMALY_BASELINE_DAYS} giorni prima, solo con ≥{ANOMALY_BASELINE_DAYS} giorni di
        storia dal primo dato registrato.
      </p>
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-500 text-[11px] uppercase tracking-wider text-left">
              <th className="font-normal pb-2 pr-3">Metrica</th>
              <th className="font-normal pb-2 pr-3 text-right">Ultimi {n}g</th>
              <th className="font-normal pb-2 pr-3 text-right">{n}g prima</th>
              <th className="font-normal pb-2 pr-3 text-right">Delta</th>
              <th className="font-normal pb-2 pr-3">Andamento</th>
              <th className="font-normal pb-2">Note</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ m, v, c, an }) => (
              <tr key={m.key} className="border-t border-gray-800 align-top">
                <td className="py-2 pr-3 text-gray-300 whitespace-nowrap">
                  {m.label}
                  {m.key === "sessions" && <div className="text-[10px] text-gray-500">somma delle sessioni di ogni giorno</div>}
                  {m.key === "probably_human" && <div className="text-[10px] text-amber-300">STIMATO · esclusi senza paese, paesi senza sessioni, raffiche</div>}
                  {m.key === "page_views" && <div className="text-[10px] text-gray-500">MISURATO · crawler e senza paese inclusi</div>}
                  {m.key === "page_views_no_country" && <div className="text-[10px] text-gray-500">test locali, job sintetici o crawler</div>}
                </td>
                {v && c ? (
                  <>
                    <td className="py-2 pr-3 text-right text-white font-semibold tabular-nums">{fmtInt(c.current)}</td>
                    <td className="py-2 pr-3 text-right text-gray-400 tabular-nums">{fmtInt(c.previous)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-gray-200 whitespace-nowrap">
                      {fmtSigned(c.delta)}
                      {c.pct !== null && <span className="text-gray-400"> ({c.pct > 0 ? "+" : ""}{(c.pct * 100).toFixed(0)}%)</span>}
                    </td>
                    <td className="py-2 pr-3">
                      <Sparkline values={v.slice(v.length - n)} days={shown} flagged={new Set(an.map((a) => a.index - (v.length - n)))} />
                    </td>
                    <td className="py-2 space-y-0.5">
                      {c.smallSample && <div className="text-[11px] text-gray-400">campione piccolo (base {fmtInt(c.previous)} &lt; {SMALL_SAMPLE_BASE}): niente %</div>}
                      {c.partialHistory && <div className="text-[11px] text-gray-400">il periodo precedente comincia prima del primo dato registrato</div>}
                      {an.map((a) => (
                        <AnomalyNote key={a.day} a={a} />
                      ))}
                    </td>
                  </>
                ) : (
                  <td colSpan={5} className="py-2 text-red-400 text-[12px]">
                    Lettura fallita ({s.errors[m.key] ?? "errore"}) — serie vuota, nessun valore sostituito con 0.
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <details className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <summary className="text-gray-400 text-xs uppercase tracking-wider cursor-pointer">Tabella giorno per giorno</summary>
        <div className="overflow-x-auto mt-3">
          <table className="text-[12px] tabular-nums">
            <thead>
              <tr className="text-gray-500">
                <th className="font-normal text-left pr-3 pb-1">Giorno</th>
                {SERIES_METRICS.map((m) => (
                  <th key={m.key} className="font-normal text-right px-2 pb-1">{m.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((d, j) => {
                const i = s.days.length - n + j;
                return (
                  <tr key={d} className="border-t border-gray-800">
                    <td className="pr-3 py-0.5 text-gray-400">{fmtDay(d)}</td>
                    {rows.map(({ m, v, an }) => (
                      <td key={m.key} className={`text-right px-2 py-0.5 ${an.some((a) => a.index === i) ? "text-amber-300 font-semibold" : "text-gray-200"}`}>
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
    </Shell>
  );
}
