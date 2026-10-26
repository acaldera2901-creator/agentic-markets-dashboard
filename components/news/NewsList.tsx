"use client";
// components/news/NewsList.tsx (#NEWS-FOTMOB-PROD-1026) — the rewritten FotMob
// notes on /blog, above the guides. The same language as the rest of the page
// chrome (agentic-lang), Rome time declared once, «x minutes ago» only after
// mount. Every note carries its source and the link to the original; a board
// link only when the board names the team — never invented. The picture is
// ours, by kind of story (lib/news/kind.ts), never FotMob's; no price, no
// pick: the news says when, never why.
import Image from "next/image";
import { fillNews, newsCopy } from "@/lib/news/copy";
import type { NewsFeed } from "@/lib/news/table";
import { matchesForNote, rowsFor, stateMessage, updatedLine } from "@/lib/news/view";
import { boardHref, useBoardMatches, useNow, useSiteLang } from "./use-news";
import "./news.css";

export function NewsList({ feed }: { feed: NewsFeed }) {
  const lang = useSiteLang();
  const now = useNow();
  const c = newsCopy(lang);
  const cards = feed.state === "ok" ? feed.cards : [];
  const board = useBoardMatches(cards.some((k) => k.teams.length > 0));
  const message = stateMessage(feed, c);
  const updated = updatedLine(feed, lang, c);
  return (
    <section className="nw" aria-labelledby="nw-title" data-state={feed.state}>
      <div className="nw-head">
        <h2 id="nw-title" className="nw-h">{c.latest}</h2>
        {updated && (
          <p className="nw-updated">
            {updated} <span className="nw-tz">· {c.romeTime}</span>
          </p>
        )}
      </div>

      {message ? (
        <p className="nw-state">{message}</p>
      ) : (
        <ol className="nw-list">
          {rowsFor(cards, lang, now).map((r, i) => {
            const links = matchesForNote(cards[i], board);
            return (
              <li key={r.key} className="nw-item" data-img={r.image ? "" : undefined} data-kind={r.kind}>
                <div className="nw-when">
                  <time className="nw-time" dateTime={r.iso}>{r.time}</time>
                  {r.ago && <span className="nw-ago">{r.ago}</span>}
                </div>
                {r.image && (
                  <span className="nw-thumb">
                    <Image src={r.image.src} width={r.image.width} height={r.image.height} alt="" loading="lazy" sizes="(max-width: 640px) calc(100vw - 64px), 168px" />
                  </span>
                )}
                <div className="nw-note">
                  <span className="nw-lab">{r.source}{r.english && <em className="nw-en"> · {c.inEnglish}</em>}</span>
                  <h3 className="nw-title" lang={r.textLang}>{r.title}</h3>
                  <p className="nw-text" lang={r.textLang}>{r.body}</p>
                  <p className="nw-meta">
                    <a className="nw-orig" href={r.url} rel="nofollow noopener noreferrer" target="_blank">
                      {c.readOriginal} <span aria-hidden="true">↗</span>
                    </a>
                  </p>
                  {links.length > 0 && (
                    <p className="nw-board">
                      <span className="nw-lab">{c.onBoard}</span>
                      {links.map((m) => (
                        <a key={m.id} href={boardHref(m)}>
                          {m.home} – {m.away} <span aria-hidden="true">→</span>
                        </a>
                      ))}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {cards.length > 0 && <p className="nw-takedown">{fillNews(c.takedown, {})}</p>}
    </section>
  );
}
