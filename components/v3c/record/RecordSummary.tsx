"use client";
// components/v3c/record/RecordSummary.tsx (#REDESIGN-V3C F6)
// Il riepilogo del registro: tre fatti in riga (sigillate e periodo · Brier
// nostro e del mercato AFFIANCATI con i loro intervalli e la frase che il dato
// sceglie · copertura), poi calibrazione, atteso/osservato, tennis a parte.
// La cosa grande della pagina è il reliability diagram (DIRECTION-v3b).
import type { V3TennisRecordGroup } from "@/lib/v3c/contracts";
import { brierVerdict } from "@/lib/v3c/copy-record";
import type { RecordSummary } from "@/lib/v3c/record-data.server";
import { brier4, dateUtc, int, signed4 } from "@/lib/v3c/record-view";
import { Reliability } from "./Reliability";
import { Weeks } from "./Weeks";
import { TennisRecord } from "./TennisRecord";
import { RecordEmpty } from "./RecordStates";
import { useRecordCopy } from "./useRecordCopy";

export function RecordSummaryView({ data }: { data: RecordSummary }) {
  const { t, locale } = useRecordCopy();
  const { record: r, calibration: cal } = data;
  const tennisSealed = r.tennis.groups.reduce((a, g: V3TennisRecordGroup) => a + g.sealed, 0);
  if (r.counts.sealed === 0 && tennisSealed === 0) return <RecordEmpty />;
  const b = r.brier;
  const verdict = brierVerdict(b.difference_ci95);
  const ci = (c: { low: number; high: number } | null | undefined) => (c ? t.kpi.ci(brier4(c.low, locale), brier4(c.high, locale)) : null);
  return (
    <>
      <section className="v3c-rec-kpi" aria-label={t.kpi.brier}>
        <div>
          <span className="v3c-lab">{t.kpi.sealed}</span>
          <b className="v3c-n-xl">{int(r.counts.sealed, locale)}</b>
          <span className="v3c-rec-vs">{t.kpi.sealedVs(dateUtc(r.scope.since, locale), dateUtc(data.last_scored_kickoff, locale), int(r.counts.scored, locale))}</span>
        </div>
        <div className="v3c-rec-brier">
          <span className="v3c-lab">{t.kpi.brier}</span>
          <dl>
            <div>
              <dt>{t.kpi.ours}</dt>
              <dd>
                <b className="v3c-n-xl">{brier4(b.estimate, locale)}</b>
                <small>{ci(b.estimate_ci95)}</small>
              </dd>
            </div>
            <div>
              <dt>{t.kpi.market}</dt>
              <dd>
                <b className="v3c-n-xl v3c-m">{brier4(b.market, locale)}</b>
                <small>{ci(b.market_ci95)}</small>
              </dd>
            </div>
          </dl>
          {verdict ? <p className="v3c-rec-verdict">{t.kpi.verdict[verdict]}</p> : null}
          {b.difference_ci95 ? (
            <p className="v3c-fine">
              {t.kpi.diff(signed4(b.difference, locale), signed4(b.difference_ci95.low, locale), signed4(b.difference_ci95.high, locale), int(b.n_paired, locale))}{" "}
              {t.kpi.blend}
            </p>
          ) : (
            <p className="v3c-fine">{t.kpi.blend}</p>
          )}
        </div>
        <div>
          <span className="v3c-lab">{t.kpi.coverage}</span>
          <b className="v3c-n-xl">{t.kpi.coverageMain(int(r.counts.paired, locale), int(r.counts.scored, locale))}</b>
          <span className="v3c-rec-vs">{t.kpi.coverageVs}</span>
          <span className="v3c-fine v3c-rec-rest">
            {t.kpi.coverageRest(int(r.counts.pending, locale), int(r.counts.orphans + r.counts.unresolved, locale), int(r.counts.paper, locale))}
          </span>
        </div>
      </section>

      <Reliability cal={cal} />
      <Weeks weeks={r.weekly} />
      <TennisRecord groups={r.tennis.groups} calibration={cal.tennis} />
    </>
  );
}
