"use client";
// components/classic/ClassicNewsStrip.tsx (#NEWS-FOTMOB-PROD-1026) — «Latest
// news» on the board, between the banners and the tabs: three rewritten
// FotMob notes at most, newest first, each with its Rome time and source, and
// one link to the whole list (/blog). Nothing to show (off, paused, empty,
// error, not yet loaded) → renders nothing: the board never waits for the news.
// A note that names a team on the board links to that match; the others are
// text — never a guessed link.
import Link from "next/link";
import { fillNews, newsCopy } from "@/lib/news/copy";
import { NewsArt } from "@/components/news/NewsArt";
import type { LobbyItem } from "@/lib/ui/lobby";
import { matchesForNote, rowsFor, stripCards, timeRome, type BoardMatch } from "@/lib/news/view";
import { boardHref, useNewsFeed, useNow } from "@/components/news/use-news";
import "@/components/news/news.css";

export function ClassicNewsStrip({ lang, football }: { lang: string; football: readonly LobbyItem[] }) {
  const feed = useNewsFeed();
  const now = useNow();
  if (!feed) return null;
  const cards = stripCards(feed, 3);
  if (!cards.length || feed.state !== "ok") return null;
  const c = newsCopy(lang);
  const board: BoardMatch[] = football.map((it) => ({ id: it.data.id, home: it.data.home, away: it.data.away, league: it.data.league }));
  return (
    <section className="brc-news" aria-labelledby="brc-news-h" data-testid="classic-news-strip">
      <div className="brc-news__head">
        <h2 id="brc-news-h" className="brc-news__h">{c.latest}</h2>
        <span className="brc-news__upd">{fillNews(c.updatedAt, { time: timeRome(feed.updatedAt, lang) })} · {c.romeTime}</span>
        <Link className="brc-news__all" href="/blog">{c.allNews} <span aria-hidden="true">›</span></Link>
      </div>
      <ol className="brc-news__list">
        {rowsFor(cards, lang, now).map((r, i) => {
          const m = matchesForNote(cards[i], board)[0];
          const title = <span className="brc-news__t" lang={r.textLang}>{r.title}</span>;
          return (
            <li key={r.key} className="brc-news__item" data-img={r.image ? "" : undefined} data-kind={r.kind}>
              {r.image && (
                <span className="brc-news__thumb">
                  <NewsArt image={r.image} kind={r.kind} badges={r.badges} variant="strip" sizes="96px" />
                </span>
              )}
              <span className="brc-news__when">
                <time dateTime={r.iso}>{r.time}</time>
              </span>
              {m ? <a className="brc-news__link" href={boardHref(m)}>{title}</a> : title}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
