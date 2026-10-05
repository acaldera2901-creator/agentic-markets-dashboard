// components/v3c/tools/BoardBridge.tsx (#REDESIGN-V3C F5)
// «La stessa matematica sul board di oggi»: per i tool con una colonna
// (EV, Kelly, margine, implicita…) gli otto esiti guida con quella colonna →
// ogni riga porta alla partita. Per gli altri (multipla, bankroll, ROI,
// yield) il ponte è testuale, verso la board o il registro. Nessun partner.
import type { V3cToolsCopy } from "@/lib/i18n/v3c-tools";
import { fmt } from "@/lib/i18n/v3c-tools";
import { getBoardSource, matchTitle } from "@/lib/v3c/board-source";
import type { ToolDef } from "@/lib/v3c/tools";
import { ROUTES } from "../Chrome";
import { Monogrammi } from "../Monogramma";

type Props = { def: ToolDef; column?: string; copy: V3cToolsCopy["tool"] };

export function BoardBridge({ def, column, copy }: Props) {
  const src = getBoardSource();
  const sample = src.kind === "sample";

  if (!def.column) {
    const record = def.bridge === "record";
    return (
      <section className="v3c-sec v3c-bridge" aria-labelledby="v3c-bridge-h">
        <div className="v3c-sec-h">
          <h2 className="v3c-t-sec" id="v3c-bridge-h">
            {record ? copy.sameRatio : copy.pickLegs}
          </h2>
        </div>
        <p className="v3c-explain">{record ? copy.sameRatioBody : copy.pickLegsBody}</p>
        <div className="v3c-act">
          <a className="v3c-btn v3c-btn-line" href={src.boardHref}>
            {copy.openBoard}
          </a>
          {record ? (
            <a className="v3c-ghost" href={ROUTES.record}>
              {copy.seeRecord}
            </a>
          ) : null}
        </div>
      </section>
    );
  }

  const col = def.column;
  return (
    <section className="v3c-sec v3c-bridge" aria-labelledby="v3c-bridge-h">
      <div className="v3c-sec-h">
        <h2 className="v3c-t-sec" id="v3c-bridge-h">
          {copy.sameMaths}
        </h2>
        <span className="v3c-small">
          {fmt(copy.leadAsOf, { asOf: src.pricesAsOf })}
          {sample ? (
            <>
              {" "}
              <em className="v3c-tag v3c-tag-sample">{copy.sample}</em>
            </>
          ) : null}
        </span>
      </div>
      <div className="v3c-tb-l">
        <div className="v3c-tb-h" aria-hidden="true">
          <span className="v3c-lab">{copy.colMatch}</span>
          <span className="v3c-lab v3c-r">{copy.colPrice}</span>
          <span className="v3c-lab v3c-r">{copy.colEstimate}</span>
          <span className="v3c-lab v3c-r">{column}</span>
        </div>
        {src.matches().map((m) => {
          const lead = src.lead(m);
          const c = col({ outcomes: m.outcomes, lead });
          const value = c.value === "none" ? copy.noStake : c.value;
          return (
            <a key={m.id} className="v3c-tb-r" href={m.href} aria-label={`${matchTitle(m)}, ${lead.label} ${lead.price.toFixed(2)}, ${column} ${value}`}>
              <span className="v3c-tb-t">
                <Monogrammi home={m.home} away={m.away} />
                <span className="v3c-tb-name">
                  <b className="v3c-t-row">{matchTitle(m)}</b>
                  <small>
                    {lead.label} · {m.time} {m.day}
                  </small>
                </span>
              </span>
              <span className="v3c-r v3c-num">{lead.price.toFixed(2)}</span>
              <span className="v3c-r v3c-num">
                <mark>{lead.estimate}%</mark>
              </span>
              <span className={["v3c-r", "v3c-num", c.flat ? "v3c-g-flat" : null, c.market ? "v3c-m" : null].filter(Boolean).join(" ")}>{value}</span>
            </a>
          );
        })}
      </div>
      <p className="v3c-fine v3c-tb-fine">{copy.tapRow}</p>
    </section>
  );
}
