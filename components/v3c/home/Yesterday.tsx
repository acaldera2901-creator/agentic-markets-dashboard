"use client";
// components/v3c/home/Yesterday.tsx (#REDESIGN-V3C F3)
// «Ieri»: le pick sigillate partite ieri (UTC) e come sono finite, VINTE E
// PERSE, lette solo da pick_ledger + pick_settlement_current (/api/v3/yesterday).
// Interi, mai un tasso: vinte e perse accanto alla somma delle probabilità
// sigillate (quante le stime dovevano vincerne). Nessun ROI, CLV, hit-rate.
import type { V3DayPick, V3DaySummary, V3YesterdayResponse } from "@/lib/v3c/contracts";
import type { V3cCopy } from "@/lib/v3c/copy";
import { dayLong, pctInt } from "@/lib/v3c/board-view";
import { useV3cCopy } from "@/lib/v3c/lang.client";
import { V3C_ROUTES } from "../V3cChrome";
import { v3cLocale } from "@/lib/v3c/copy";

const SHOWN = 8;

function pickName(p: V3DayPick, t: V3cCopy): string {
  if (!p.pick) return "—";
  const k = p.pick.trim().toUpperCase();
  if (p.sport === "football") return k === "HOME" ? p.home : k === "AWAY" ? p.away : k === "DRAW" ? t.board.draw : p.pick;
  return p.pick;
}

function Summary({ s, label, t }: { s: V3DaySummary; label: string; t: V3cCopy }) {
  return (
    <div className="v3c-yd-sum">
      <span className="v3c-lab">
        {label}
        {s.limited_sample && s.won + s.lost > 0 ? <em className="v3c-tag">{t.yday.limited}</em> : null}
      </span>
      <dl>
        <div>
          <dt>{t.yday.won}</dt>
          <dd className="v3c-num">{s.won}</dd>
        </div>
        <div>
          <dt>{t.yday.lost}</dt>
          <dd className="v3c-num">{s.lost}</dd>
        </div>
        <div>
          <dt>{t.yday.expected}</dt>
          <dd className="v3c-num">{s.expected_wins == null ? "—" : s.expected_wins.toFixed(1)}</dd>
        </div>
        {s.other ? (
          <div>
            <dt>{t.yday.other}</dt>
            <dd className="v3c-num">{s.other}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}

export function Yesterday({ data }: { data: V3YesterdayResponse | null }) {
  const { lang, t } = useV3cCopy();
  const locale = v3cLocale(lang);
  if (!data) {
    return (
      <section className="v3c-yday" id="v3c-yday" aria-labelledby="v3c-yday-h">
        <h2 className="v3c-t-sec" id="v3c-yday-h">
          {t.yday.title}
        </h2>
        <p className="v3c-small">{t.yday.unavailable}</p>
      </section>
    );
  }
  const decided = data.picks.filter((p) => p.result === "won" || p.result === "lost");
  // vinte e perse insieme, nell'ordine dell'ora: nessuna scelta di quali mostrare
  const list = decided.slice(0, SHOWN);
  const dayLabel = dayLong(`${data.day}T12:00:00Z`, "UTC", locale);
  return (
    <section className="v3c-yday" id="v3c-yday" aria-labelledby="v3c-yday-h">
      <div className="v3c-yd-t">
        <span className="v3c-lab">{t.yday.lab(dayLabel)}</span>
        <h2 className="v3c-t-sec" id="v3c-yday-h">
          {t.yday.title}
        </h2>
        <p className="v3c-small">{t.yday.body}</p>
      </div>
      {decided.length === 0 ? (
        <div className="v3c-yd-none">
          <p className="v3c-t-row">{t.yday.none}</p>
          <p className="v3c-small">{t.yday.noneHint}</p>
        </div>
      ) : (
        <>
          <div className="v3c-yd-sums">
            {data.football.settled ? <Summary s={data.football} label={t.yday.football} t={t} /> : null}
            {data.tennis.settled ? <Summary s={data.tennis} label={t.yday.tennis} t={t} /> : null}
          </div>
          <ul className="v3c-yd-list">
            {list.map((p, i) => (
              <li key={`${p.kickoff}-${p.home}-${i}`} data-result={p.result}>
                <span className={["v3c-yd-res", p.result === "won" ? "v3c-yd-won" : "v3c-yd-lost"].join(" ")}>{p.result === "won" ? t.yday.wonOne : t.yday.lostOne}</span>
                <span className="v3c-yd-m">
                  <b>
                    {p.home} – {p.away}
                  </b>
                  <small>
                    {t.yday.picked(pickName(p, t), pctInt(p.p))}
                    {p.final_score ? ` · ${p.final_score}` : ""}
                    {p.is_paper ? ` · ${t.yday.paper}` : ""}
                  </small>
                </span>
              </li>
            ))}
          </ul>
          {decided.length > SHOWN ? <p className="v3c-fine">{t.yday.more(decided.length - SHOWN)}</p> : null}
        </>
      )}
      <a className="v3c-btn v3c-btn-line v3c-btn-s" href={V3C_ROUTES.record}>
        {t.yday.full}
      </a>
    </section>
  );
}
