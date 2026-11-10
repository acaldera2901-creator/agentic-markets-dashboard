"use client";
// components/news/NewsList.tsx (#NEWS-FOTMOB-PROD-1026) — the rewritten FotMob
// notes on /blog, above the guides. The same language as the rest of the page
// chrome (agentic-lang), Rome time declared once, «x minutes ago» only after
// mount. Every note carries its source and the link to the original; a board
// link only when the board names the team — never invented. The picture is
// ours, by kind of story (lib/news/kind.ts), never FotMob's; no price, no
// pick: the news says when, never why.
import Link from "next/link";
import Image from "next/image";
import { fillNews, newsCopy } from "@/lib/news/copy";
import { NewsArt } from "./NewsArt";
import { NewsActions } from "./NewsActions";
import { NewsProfileEntry } from "./NewsProfileEntry";

import { matchesForNote, rowsFor, stateMessage, updatedLine, type WireFeed } from "@/lib/news/view";
import { boardHref, useBoardMatches, useNow, useSiteLang } from "./use-news";
import "./news.css";

export function NewsList({ feed }: { feed: WireFeed }) {
  const lang = useSiteLang();
  const now = useNow();
  const c = newsCopy(lang);
  const cards = feed.state === "ok" ? feed.cards : [];
  const board = useBoardMatches(cards.some((k) => k.teams.length > 0));
  const message = stateMessage(feed, c);
  const updated = updatedLine(feed, lang, c);
  return (
    <section id="news" className="nw" aria-labelledby="nw-title" data-state={feed.state}>
      <div className="nw-head">
        <h2 id="nw-title" className="nw-h">{c.latest}</h2>
        {updated && (
          <p className="nw-updated">
            {updated} <span className="nw-tz">· {c.romeTime}</span>
          </p>
        )}
      </div>

      <NewsProfileEntry lang={lang} />

      {message ? (
        <p className="nw-state">{message}</p>
      ) : (
        <ol className="nw-list ns-feed">
          {rowsFor(cards, lang, now).map((r, i) => {
            const links = matchesForNote(cards[i], board);
            return (
              <li key={r.key} id={"post-"+cards[i].guid} className="nw-item ns-post" data-img={r.image ? "" : undefined} data-kind={r.kind}>
                <header className="ns-post-head">
                  <Link href="/" className="ns-avatar" aria-label="BetRedge"><Image src="/logos/betredge-logo-white-48.png" alt="" width={34} height={22} /></Link>
                  <div className="ns-identity"><strong>betr.edge <span aria-label="BetRedge official" className="ns-verified">✓</span></strong><span>Sports. Insights. Community.</span></div>
                  <div className="nw-when"><time className="nw-time" dateTime={r.iso}>{r.time}</time>{r.ago && <span className="nw-ago">{r.ago}</span>}</div>
                </header>
                {r.image && <div className="nw-media"><span className="nw-thumb"><NewsArt image={r.image} kind={r.kind} badges={r.badges} variant="card" sizes="(max-width: 640px) calc(100vw - 32px), 560px" /></span></div>}
                <div className="nw-note">
                  {r.english && <span className="nw-lab nw-en">{c.inEnglish}</span>}
                  <h3 className="nw-title" lang={r.textLang}>{r.title}</h3>
                  <p className="nw-text" lang={r.textLang}>{r.body}</p>
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
                <NewsActions guid={cards[i].guid} title={r.title} lang={lang} />
              </li>
            );
          })}
        </ol>
      )}

      {cards.length > 0 && <p className="ns-credits-link"><Link href="/blog/credits">{lang === "it" ? "Crediti immagini" : "Image credits"}</Link></p>}
      {cards.length > 0 && <p className="nw-takedown">{fillNews(c.takedown, {})}</p>}
    </section>
  );
}
