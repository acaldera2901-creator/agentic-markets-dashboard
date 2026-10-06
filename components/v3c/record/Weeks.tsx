"use client";
// components/v3c/record/Weeks.tsx (#REDESIGN-V3C F6)
// Atteso contro osservato per settimana: per ogni settimana ISO, la somma
// delle probabilità sigillate dell'esito più probabile (atteso, lime = la
// stima) accanto a quante volte è successo (osservato, inchiostro) con il suo
// intervallo 95%. Interi accanto a un'attesa, mai un tasso di vittoria.
import type { V3WeekRow } from "@/lib/v3c/contracts";
import { int } from "@/lib/v3c/record-view";
import { useRecordCopy } from "./useRecordCopy";

function weekShort(isoDay: string, locale: string): string {
  const d = new Date(`${isoDay}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? isoDay : new Intl.DateTimeFormat(locale, { timeZone: "UTC", day: "numeric", month: "short" }).format(d);
}

export function Weeks({ weeks }: { weeks: V3WeekRow[] }) {
  const { t, locale } = useRecordCopy();
  if (!weeks.length) return null;
  const hi = (w: V3WeekRow) => Math.max(w.expected_top, w.observed_top_ci95 ? w.observed_top_ci95.high * w.n : w.observed_top);
  const max = Math.max(1, ...weeks.map(hi));
  const h = (x: number) => `${((x / max) * 100).toFixed(1)}%`;
  return (
    <section className="v3c-sec v3c-rec-weeks" aria-labelledby="v3c-rec-wk-h">
      <div className="v3c-sec-h">
        <h2 className="v3c-t-sec" id="v3c-rec-wk-h">
          {t.weeks.title}
        </h2>
        <span className="v3c-small">{t.weeks.sub}</span>
      </div>
      <div className="v3c-rec-scroll">
        <ol className="v3c-rec-wk" aria-label={t.weeks.aria} style={{ ["--wk" as string]: weeks.length }}>
          {weeks.map((w) => {
            const ci = w.observed_top_ci95;
            return (
              <li key={w.week_start} className={w.limited_sample ? "v3c-rec-thin" : undefined}>
                <span className="v3c-rec-wk-bars">
                  <i className="v3c-rec-exp" style={{ height: h(w.expected_top) }} />
                  <i className="v3c-rec-obs" style={{ height: h(w.observed_top) }} />
                  {ci ? <s className="v3c-rec-whisk" style={{ bottom: h(ci.low * w.n), height: h((ci.high - ci.low) * w.n) }} /> : null}
                </span>
                <span className="v3c-rec-wk-n">
                  <b>{Math.round(w.expected_top)}</b> / <b>{w.observed_top}</b>
                </span>
                <span className="v3c-rec-wk-l">
                  {weekShort(w.week_start, locale)}
                  <small>
                    n {int(w.n, locale)}
                    {w.limited_sample ? " *" : ""}
                  </small>
                </span>
              </li>
            );
          })}
        </ol>
      </div>
      <div className="v3c-legend v3c-rec-legend">
        <span>
          <i className="v3c-rec-k-e" aria-hidden="true" />
          {t.weeks.expected}
        </span>
        <span>
          <i className="v3c-rec-k-o" aria-hidden="true" />
          {t.weeks.observed}
        </span>
      </div>
      <p className="v3c-fine v3c-rec-cap">{t.weeks.caption}</p>
    </section>
  );
}
