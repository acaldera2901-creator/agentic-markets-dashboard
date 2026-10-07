"use client";
// components/v3c/pages/NewsLive.tsx (#REDESIGN-V3C news) — the live notes on
// /blog (= News) and «Most moved today». Mounted only when the server says the
// news is on (NEWS_FOTMOB_ENABLED); otherwise News.tsx renders as before.
// Every note shows its source, its time, a link to the original and the AI
// label. Only rewritten notes reach this file (news2: never an original
// headline). The strip says WHEN a note came, never WHY a price moved.
import { useMemo, useState, useSyncExternalStore } from "react";
import { useLocalTimeZone, useV3cLang } from "@/lib/v3c/lang.client";
import { v3cLocale } from "@/lib/v3c/copy";
import { newsCopyFor, type NewsCopy } from "@/lib/v3c/news-copy";
import { dayShort, timeHM } from "@/lib/v3c/board-view";
import { matchHref } from "@/lib/v3c/match-view";
import type { NewsCard, NewsPage, NoteMatch } from "@/lib/v3c/news/news.server";
import type { MoverCard } from "@/lib/v3c/news/movers";

const iso = (t: number) => new Date(t).toISOString();
/** «now» to the minute, client only (null on the server and at hydration): relative times never mismatch. */
const useNow = (): number | null =>
  useSyncExternalStore(
    (cb) => {
      const id = setInterval(cb, 60_000);
      return () => clearInterval(id);
    },
    () => Math.floor(Date.now() / 60_000) * 60_000,
    () => null,
  );

/** «3 hours ago» in the page language; only after mount (the server has no «now» to share). */
function relative(t: number, now: number, locale: string): string {
  const f = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const min = Math.round((t - now) / 60_000);
  if (Math.abs(min) < 60) return f.format(min, "minute");
  const h = Math.round(min / 60);
  if (Math.abs(h) < 24) return f.format(h, "hour");
  return f.format(Math.round(h / 24), "day");
}

/** The text the visitor reads: IT for Italian, EN otherwise (tagged «In English» outside EN/IT). */
export function noteText(card: NewsCard, lang: string): { title: string; body: string; english: boolean } {
  const t = lang === "it" ? card.note.it : card.note.en;
  return { title: t.title, body: t.body, english: lang !== "en" && lang !== "it" };
}

function Label({ card, c, english }: { card: NewsCard; c: NewsCopy; english: boolean }) {
  return (
    <span className="v3c-nw-tag">
      {c.aiLabel(card.source)}
      {english ? <em> · {c.inEnglish}</em> : null}
    </span>
  );
}

function Card({ card, links, c, lang, tz, locale, now }: { card: NewsCard; links: NoteMatch[]; c: NewsCopy; lang: string; tz: string | undefined; locale: string; now: number | null }) {
  const x = noteText(card, lang);
  return (
    <li className="v3c-pg-nw v3c-nw-card">
      <span className="v3c-pg-nw-t">
        <b className="v3c-num">{timeHM(iso(card.t), tz, locale)}</b>
        <small>{now != null ? relative(card.t, now, locale) : dayShort(iso(card.t), tz, locale)}</small>
      </span>
      <div>
        <span className="v3c-lab">{card.source}</span>
        <h3 className="v3c-t-row v3c-pg-nw-h" lang={x.english ? "en" : lang}>
          {x.title}
        </h3>
        <p className="v3c-small v3c-nw-body" lang={x.english ? "en" : lang}>
          {x.body}
        </p>
        <p className="v3c-nw-meta">
          <Label card={card} c={c} english={x.english} />
          <a className="v3c-pg-more" href={card.url} rel="nofollow noopener noreferrer" target="_blank">
            {c.readOriginal} <span aria-hidden="true">↗</span>
          </a>
        </p>
        {links.length ? (
          <p className="v3c-nw-board">
            <span className="v3c-lab">{c.onBoard}</span>
            {links.map((m) => (
              <a key={m.id} href={matchHref(m.id)}>
                {m.home} – {m.away} <span aria-hidden="true">→</span>
              </a>
            ))}
          </p>
        ) : null}
      </div>
    </li>
  );
}

type Filter = { kind: "all" } | { kind: "board" } | { kind: "league"; league: string };

export function NewsLiveList({ live }: { live: NewsPage }) {
  const lang = useV3cLang();
  const tz = useLocalTimeZone();
  const now = useNow();
  const locale = v3cLocale(lang);
  const c = newsCopyFor(lang);
  const [filter, setFilter] = useState<Filter>({ kind: "all" });
  const cards = live.feed.state === "ok" ? live.feed.cards : [];
  const leagues = useMemo(() => [...new Set(Object.values(live.links).flat().map((m) => m.league).filter((l): l is string => !!l))].sort(), [live.links]);
  const shown = cards.filter((k) => {
    const l = live.links[k.guid] ?? [];
    if (filter.kind === "board") return l.length > 0;
    if (filter.kind === "league") return l.some((m) => m.league === filter.league);
    return true;
  });
  const on = (f: Filter) => filter.kind === f.kind && (f.kind !== "league" || (filter.kind === "league" && filter.league === f.league));
  return (
    <section className="v3c-nw" aria-labelledby="v3c-nw-h">
      <div className="v3c-nw-head">
        <h2 className="v3c-t-sec" id="v3c-nw-h">
          {c.latest}
        </h2>
        {cards.length && Object.keys(live.links).length ? (
          <div className="v3c-chips" role="group" aria-label={c.filterLabel}>
            <button type="button" className="v3c-chip" aria-pressed={on({ kind: "all" })} onClick={() => setFilter({ kind: "all" })}>
              {c.all}
            </button>
            <button type="button" className="v3c-chip" aria-pressed={on({ kind: "board" })} onClick={() => setFilter({ kind: "board" })}>
              {c.onBoardFilter}
            </button>
            {leagues.map((l) => (
              <button key={l} type="button" className="v3c-chip" aria-pressed={on({ kind: "league", league: l })} onClick={() => setFilter({ kind: "league", league: l })}>
                {l}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {live.feed.state !== "ok" ? (
        <div className="v3c-empty v3c-nw-state" role="status">
          <p className="v3c-t-row">{live.feed.state === "blocked" ? c.paused : live.feed.state === "error" ? c.error : c.pending}</p>
        </div>
      ) : shown.length === 0 ? (
        <div className="v3c-empty v3c-nw-state" role="status">
          <p className="v3c-t-row">{c.empty}</p>
        </div>
      ) : (
        <ol className="v3c-pg-nlist">
          {shown.map((k) => (
            <Card key={k.guid} card={k} links={live.links[k.guid] ?? []} c={c} lang={lang} tz={tz} locale={locale} now={now} />
          ))}
        </ol>
      )}
      {cards.length ? <p className="v3c-fine v3c-nw-takedown">{c.takedown}</p> : null}
    </section>
  );
}

export function MostMoved({ movers, cards }: { movers: MoverCard[]; cards: NewsCard[] }) {
  const lang = useV3cLang();
  const tz = useLocalTimeZone();
  const locale = v3cLocale(lang);
  const c = newsCopyFor(lang);
  const byGuid = new Map(cards.map((k) => [k.guid, k]));
  return (
    <section className="v3c-pg-notes v3c-nw-moved" aria-labelledby="v3c-nw-moved-h">
      <h2 className="v3c-t-row" id="v3c-nw-moved-h">
        {c.mostMoved}
      </h2>
      <p className="v3c-fine">{c.mostMovedSub}</p>
      {movers.length === 0 ? (
        <p className="v3c-small">{c.noMoves}</p>
      ) : (
        <ol className="v3c-nw-movers">
          {movers.map((m) => {
            const note = m.news ? byGuid.get(m.news.guid) : undefined;
            const who = m.outcome === "home" ? m.home : m.outcome === "away" ? m.away : c.draw;
            return (
              <li key={m.id}>
                <a className="v3c-nw-mv-h" href={matchHref(m.id)}>
                  {m.home} – {m.away}
                </a>
                <span className="v3c-small">
                  {m.league ? `${m.league} · ` : ""}
                  {who}{" "}
                  <b className="v3c-num">
                    {m.from.toFixed(2)} → {m.to.toFixed(2)}
                  </b>
                </span>
                <span className="v3c-small v3c-nw-mv-n">
                  {m.news && note ? (
                    <>
                      <b>{c.newsAt(timeHM(iso(m.news.t), tz, locale))}</b> · {noteText(note, lang).title}
                    </>
                  ) : (
                    c.noNewsNear
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

/** «Updated at hh:mm» for the Fascia meta. */
export function UpdatedAt({ at }: { at: number }) {
  const lang = useV3cLang();
  const tz = useLocalTimeZone();
  return <>{newsCopyFor(lang).updatedAt(timeHM(iso(at), tz, v3cLocale(lang)))}</>;
}
