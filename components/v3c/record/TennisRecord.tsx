"use client";
// components/v3c/record/TennisRecord.tsx (#REDESIGN-V3C F6 · ui3)
// Il tennis a parte. ui3 (decisione di Andrea, 07/10): nel tennis non diamo la
// nostra stima, e il numero sigillato è per lo più il mercato (temperato). Quindi
// qui niente Brier stima-contro-mercato, niente calibrazione, niente «atteso»:
// solo quante partite sono sigillate e come sono finite, con la nota onesta.
// I gruppi per kind/model_version restano nel contratto (/api/v3/record e
// /api/v3/calibration, V3TennisRecordGroup): qui si sommano soltanto.
import type { V3TennisRecordGroup } from "@/lib/v3c/contracts";
import { LIMITED_SAMPLE_N } from "@/lib/v3c/contracts";
import { dateUtc, int } from "@/lib/v3c/record-view";
import { useRecordCopy } from "./useRecordCopy";
import "../ui3.css";

export function TennisRecord({ groups }: { groups: V3TennisRecordGroup[] }) {
  const { t, locale } = useRecordCopy();
  if (!groups.length) return null;
  const sum = (f: (g: V3TennisRecordGroup) => number) => groups.reduce((a, g) => a + f(g), 0);
  const sealed = sum((g) => g.sealed);
  const settled = sum((g) => g.scored);
  const won = sum((g) => g.observed_wins);
  const since = groups.reduce<string | null>((min, g) => (g.since && (!min || Date.parse(g.since) < Date.parse(min)) ? g.since : min), null);
  const cells: [string, number, boolean?][] = [
    [t.tennis.sealed, sealed],
    [t.tennis.settled, settled, settled < LIMITED_SAMPLE_N],
    [t.tennis.won, won],
    [t.tennis.lost, settled - won],
    [t.tennis.void, sum((g) => g.settled_other)],
    [t.tennis.awaiting, sum((g) => g.unsettled)],
  ];
  return (
    <section className="v3c-sec v3c-rec-tennis" aria-labelledby="v3c-rec-tn-h">
      <div className="v3c-sec-h">
        <div>
          <h2 className="v3c-t-sec" id="v3c-rec-tn-h">
            {t.tennis.title}
          </h2>
          <p className="v3c-explain">{t.tennis.lede}</p>
        </div>
      </div>
      <p className="v3c-lab v3c-tn-rec-lab">
        {t.tennis.label}
        {since ? <small> · {dateUtc(since, locale)}</small> : null}
      </p>
      <dl className="v3c-tn-rec">
        {cells.map(([label, n, limited]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd className="v3c-num">
              {int(n, locale)}
              {limited ? <small>{t.limited}</small> : null}
            </dd>
          </div>
        ))}
      </dl>
      <p className="v3c-fine v3c-rec-cap">{t.tennis.note}</p>
    </section>
  );
}
