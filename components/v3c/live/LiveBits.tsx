"use client";
// components/v3c/live/LiveBits.tsx (#V3C-LIVESCORES) — the live score on the
// board row, the «Live now» block of the home and the scoreboard in the match
// header. Information only: nothing here touches the estimate, the seal or
// the record. No item → the honest «score n/a», never a number we made up.
import Link from "next/link";
import type { V3LiveItem } from "@/lib/v3c/live-contract";
import type { V3cLiveCopy } from "@/lib/v3c/live-copy";
import { liveCopyFor } from "@/lib/v3c/live-copy";
import { liveBadge, scoreOf, wantsLive, type LiveBadge } from "@/lib/v3c/live-view";
import { matchHref } from "@/lib/v3c/match-view";
import { timeHM } from "@/lib/v3c/board-view";
import { useLocalTimeZone, useV3cLang } from "@/lib/v3c/lang.client";
import { v3cLocale } from "@/lib/v3c/copy";
import { useLiveScores, useMinuteNow, type LiveFeed } from "./useLiveScores";
import "./live.css";

/** Visually hidden, polite: only goals and finals are written here (see live-view.announcements). */
export function LiveAnnouncer({ text }: { text: string }) {
  return (
    <p className="v3c-sr" aria-live="polite" aria-atomic="true">
      {text}
    </p>
  );
}

/** The time cell of a board row when the source has something to say (quiet = not started / suspended: the kick-off time stays). */
export function LiveTimeCell({ badge, kickoffTime }: { badge: LiveBadge; kickoffTime: string }) {
  if (badge.tone === "quiet")
    return (
      <span className="v3c-r-time v3c-ls-time" data-tone="quiet">
        {kickoffTime}
        <small>{badge.label}</small>
      </span>
    );
  return (
    <span className="v3c-r-time v3c-ls-time" data-tone={badge.tone}>
      <em className={badge.tone === "live" ? "v3c-live" : "v3c-ls-done"}>
        {badge.short ? (
          <>
            <span className="v3c-ls-long">{badge.label}</span>
            <span className="v3c-ls-short" aria-hidden="true">
              {badge.short}
            </span>
          </>
        ) : (
          badge.label
        )}
      </em>
      {badge.sub ? <small>{badge.sub}</small> : null}
    </span>
  );
}

/** «2–1» / «6-3 4-1» in the row's sub-line: a scoreboard digit strip. */
export function LiveScoreChip({ score, final }: { score: string; final: boolean }) {
  return (
    <b className="v3c-ls-sc v3c-num" data-final={final || undefined}>
      {score}
    </b>
  );
}

export type LiveNowRow = { id: string; sport: "football" | "tennis"; home: string; away: string; league: string | null };

/** Home: the matches in play right now (live or at the break), from the rows the page already has. */
export function LiveNow({ rows, feed, c }: { rows: LiveNowRow[]; feed: LiveFeed; c: V3cLiveCopy }) {
  const lang = useV3cLang();
  const tz = useLocalTimeZone();
  const now = rows
    .map((r) => ({ r, it: feed.items[r.id] }))
    .filter((x): x is { r: LiveNowRow; it: V3LiveItem } => !!x.it && (x.it.state === "live" || x.it.state === "break"));
  if (!now.length) return null;
  const shown = now.slice(0, 6);
  return (
    <section className="v3c-ls-now" aria-labelledby="v3c-ls-now-h">
      <div className="v3c-ls-now-h">
        <h2 className="v3c-t-sec" id="v3c-ls-now-h">
          <i className="v3c-ls-dot" aria-hidden="true" />
          {c.liveNow}
        </h2>
        <span className="v3c-small">{c.liveNowCount(now.length)}</span>
      </div>
      <ul className="v3c-ls-now-l">
        {shown.map(({ r, it }) => {
          const b = liveBadge(it, true, c)!;
          return (
            <li key={r.id}>
              <Link href={matchHref(r.id)} className="v3c-ls-now-i">
                <span className="v3c-ls-now-st">
                  <em className="v3c-live">{b.label}</em>
                  {b.sub ? <small>{b.sub}</small> : null}
                </span>
                <span className="v3c-ls-now-m">
                  <span className="v3c-t-row">
                    {r.home} – {r.away}
                  </span>
                  <small>{r.league ?? ""}</small>
                </span>
                {b.score ? <LiveScoreChip score={b.score} final={false} /> : <small className="v3c-ls-na">{c.unavailable}</small>}
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="v3c-fine">
        {c.source}
        {feed.updatedAt ? <> · {c.updated(timeHM(feed.updatedAt, tz, v3cLocale(lang)))}</> : null}
        {now.length > shown.length ? (
          <>
            {" · "}
            <Link href="/predictions">{c.seeBoard}</Link>
          </>
        ) : null}
      </p>
    </section>
  );
}

const EVENT_WORD = (c: V3cLiveCopy, k: string) => (k === "own_goal" ? c.ownGoal : k === "penalty_goal" ? c.penGoal : k === "red_card" ? c.red : c.goal);

/** The match page: scoreboard under the title while the match is around kick-off. Polls itself. */
/** Server and hydration see the epoch (= not live, nothing rendered); the browser's clock decides after mount. */
const EPOCH = "1970-01-01T00:00:00Z";

export function MatchLive({ id, kickoff, home, away }: { id: string; kickoff: string; home: string; away: string }) {
  const lang = useV3cLang();
  const tz = useLocalTimeZone();
  const c = liveCopyFor(lang);
  const now = useMinuteNow(EPOCH);
  const on = wantsLive(kickoff, now);
  const feed = useLiveScores(on, (x) => (x === id ? [home, away] : null), c);
  if (!on || !feed.loaded) return null;
  const it = feed.items[id];
  const updated = feed.updatedAt ? c.updated(timeHM(feed.updatedAt, tz, v3cLocale(lang))) : null;
  if (!it || it.state === "pre")
    return (
      <div className="v3c-ls-board v3c-ls-board-na" role="status">
        <p className="v3c-small">{it ? c.notStarted : c.unavailableLong}</p>
        <LiveAnnouncer text={feed.announce} />
      </div>
    );
  const b = liveBadge(it, true, c)!;
  return (
    <div className="v3c-ls-board" data-tone={b.tone}>
      <p className="v3c-ls-board-st">
        <em className={b.tone === "live" ? "v3c-live" : "v3c-ls-done"}>{b.label}</em>
        {b.sub ? <span className="v3c-ls-board-min">{b.sub}</span> : null}
        {it.state === "final" ? <span className="v3c-small">{c.finishedNote}</span> : null}
      </p>
      {it.sport === "football" ? <FootballBoard it={it} home={home} away={away} c={c} /> : <TennisBoard it={it} home={home} away={away} c={c} />}
      <p className="v3c-fine">
        {c.source}
        {updated ? <> · {updated}</> : null}
      </p>
      <LiveAnnouncer text={feed.announce} />
    </div>
  );
}

function FootballBoard({ it, home, away, c }: { it: Extract<V3LiveItem, { sport: "football" }>; home: string; away: string; c: V3cLiveCopy }) {
  const score = scoreOf(it);
  return (
    <>
      <div className="v3c-ls-fb" aria-label={score ? `${home} ${it.home}, ${away} ${it.away}` : c.unavailable} role="group">
        <span className="v3c-ls-fb-n">{home}</span>
        <b className="v3c-ls-fb-s v3c-num" aria-hidden="true">
          {it.home ?? "–"}
          <i>–</i>
          {it.away ?? "–"}
        </b>
        <span className="v3c-ls-fb-n v3c-ls-fb-a">{away}</span>
      </div>
      {it.events.length ? (
        <ol className="v3c-ls-ev">
          {it.events.map((e, i) => (
            <li key={i} data-side={e.side} data-kind={e.kind}>
              <span className="v3c-ls-ev-m">{e.minute}</span> <b>{EVENT_WORD(c, e.kind)}</b>
              {e.player ? <> · {e.player}</> : null} <small>({e.side === "home" ? home : away})</small>
            </li>
          ))}
        </ol>
      ) : null}
    </>
  );
}

function TennisBoard({ it, home, away, c }: { it: Extract<V3LiveItem, { sport: "tennis" }>; home: string; away: string; c: V3cLiveCopy }) {
  const sides = [
    { key: "p1" as const, name: home, games: it.sets.map((s) => ({ g: s.p1, tb: s.tb1, won: s.p1 > s.p2 })) },
    { key: "p2" as const, name: away, games: it.sets.map((s) => ({ g: s.p2, tb: s.tb2, won: s.p2 > s.p1 })) },
  ];
  return (
    <table className="v3c-ls-tn">
      <caption className="v3c-sr">{c.setsAria(scoreOf(it) ?? c.unavailable)}</caption>
      <thead>
        <tr>
          <th scope="col">
            <span className="v3c-sr">—</span>
          </th>
          {it.sets.map((_, i) => (
            <th scope="col" key={i} className="v3c-lab">
              {c.set(i + 1)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sides.map((s) => (
          <tr key={s.key} data-winner={it.winner === s.key || undefined}>
            <th scope="row">
              {s.name}
              {it.server === s.key ? (
                <span className="v3c-ls-srv" title={c.serving(s.name)}>
                  <span aria-hidden="true">●</span>
                  <span className="v3c-sr">{c.serving(s.name)}</span>
                </span>
              ) : null}
            </th>
            {s.games.map((g, i) => (
              <td key={i} className="v3c-num" data-won={g.won || undefined}>
                {g.g}
                {g.tb != null ? <sup>{g.tb}</sup> : null}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
