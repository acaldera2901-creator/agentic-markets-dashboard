"use client";
// components/v3c/pages/News.tsx (#REDESIGN-V3C F9 · filone pages) — /blog = News.
// Lista + articolo. La fonte oggi è il blog esistente (blog_posts, solo
// published, lib/blog.ts): guide scritte da noi. Lo spazio «News at hh:mm» per le
// note partita legate a un prezzo esiste, ma è dichiarato vuoto: nessun feed di
// terzi in questo filone (la proposta FotMob è docs/v3c-news-proposal.md, gated).
// #REDESIGN-V3C news: con NEWS_FOTMOB_ENABLED acceso il server passa `live` e la
// pagina mostra le note riscritte (NewsLive.tsx); le guide restano sotto, a parte.
// URL, canonical, JSON-LD (Article + breadcrumb) restano quelli di app/blog/*.
import Link from "next/link";
import { useV3cLang } from "@/lib/v3c/lang.client";
import { usePagesCopy } from "@/lib/v3c/pages-copy.client";
import { hubPath } from "@/lib/tools/registry";
import { Fascia } from "../Fascia";
import { v3cLocale } from "@/lib/v3c/copy";
import { newsCopyFor } from "@/lib/v3c/news-copy";
import type { NewsPage } from "@/lib/v3c/news/news.server";
import { MostMoved, NewsLiveList, UpdatedAt } from "./NewsLive";

export type NewsItem = {
  slug: string;
  title: string;
  description: string | null;
  /** ISO della data editoriale (pub_date, poi published_at) */
  date: string | null;
};

const BOARD = "/";
const TOOLS = hubPath("en");

/** «6 Oct» + «2026», in UTC: server e browser scrivono la stessa cosa. */
function dateParts(iso: string | null, lang: string): { day: string; rest: string } | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const loc = v3cLocale(lang);
  return {
    day: d.toLocaleDateString(loc, { day: "2-digit", timeZone: "UTC" }),
    rest: d.toLocaleDateString(loc, { month: "short", year: "numeric", timeZone: "UTC" }),
  };
}

function longDate(iso: string | null, lang: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(v3cLocale(lang), { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

/** `notes` off when the live news is on: «Not live yet» would no longer be true. */
function Aside({ notes = true }: { notes?: boolean }) {
  const t = usePagesCopy().news;
  return (
    <aside className="v3c-pg-naside">
      {notes ? (
      <section className="v3c-pg-notes" aria-labelledby="v3c-pg-notes-h">
        <span className="v3c-lab">{t.notesTitle}</span>
        <h2 className="v3c-t-row" id="v3c-pg-notes-h">
          {t.notesBody}
        </h2>
        <p className="v3c-fine">{t.notesNot}</p>
        <a className="v3c-pg-more" href={BOARD}>
          {t.boardLink} <span aria-hidden="true">→</span>
        </a>
      </section>
      ) : null}
      <ToolsAside />
    </aside>
  );
}

function GuideList({ posts }: { posts: NewsItem[] }) {
  const lang = useV3cLang();
  const t = usePagesCopy().news;
  return (
    <ol className="v3c-pg-nlist">
      {posts.map((p) => {
        const d = dateParts(p.date, lang);
        return (
          <li key={p.slug} className="v3c-pg-nw">
            <span className="v3c-pg-nw-t">
              {d ? (
                <>
                  <b className="v3c-num">{d.day}</b>
                  <small>{d.rest}</small>
                </>
              ) : null}
            </span>
            <div>
              <span className="v3c-lab">{t.guide}</span>
              <h2 className="v3c-t-row v3c-pg-nw-h">
                <a href={`/blog/${p.slug}`}>{p.title}</a>
              </h2>
              {p.description ? <p className="v3c-small">{p.description}</p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function ToolsAside() {
  const t = usePagesCopy().news;
  return (
    <section className="v3c-pg-ntools" aria-labelledby="v3c-pg-ntools-h">
      <h2 className="v3c-t-row" id="v3c-pg-ntools-h">
        {t.toolsTitle}
      </h2>
      <p className="v3c-small">{t.toolsBody}</p>
      <a className="v3c-pg-more" href={TOOLS}>
        {t.toolsLink} <span aria-hidden="true">→</span>
      </a>
    </section>
  );
}

/**
 * News with the live notes (NEWS_FOTMOB_ENABLED on): the notes first, then our
 * guides under their own heading; the aside carries «Most moved today».
 */
function LiveIndex({ posts, live }: { posts: NewsItem[]; live: NewsPage }) {
  const lang = useV3cLang();
  const t = usePagesCopy().news;
  const nc = newsCopyFor(lang);
  const cards = live.feed.state === "ok" ? live.feed.cards : [];
  return (
    <main className="v3c-wrap" id="main">
      <Fascia
        tab={t.tab}
        title={t.title}
        meta={
          live.feed.state === "ok" ? (
            <>
              <b>
                <UpdatedAt at={live.feed.fetchedAt} />
              </b>
              <span>{nc.count(cards.length)}</span>
            </>
          ) : (
            <>
              <b>{t.metaStrong(posts.length)}</b>
              <span>{t.metaRest}</span>
            </>
          )
        }
      />
      <div className="v3c-cols v3c-cols-8-4">
        <div>
          <NewsLiveList live={live} />
          <section className="v3c-nw-guides" aria-labelledby="v3c-nw-guides-h">
            <div className="v3c-nw-head">
              <h2 className="v3c-t-sec" id="v3c-nw-guides-h">
                {nc.guides}
              </h2>
              <p className="v3c-small">{nc.guidesSub}</p>
            </div>
            {posts.length === 0 ? (
              <div className="v3c-empty">
                <p className="v3c-t-row">{t.empty}</p>
              </div>
            ) : (
              <GuideList posts={posts} />
            )}
          </section>
        </div>
        <aside className="v3c-pg-naside">
          {live.movers ? <MostMoved movers={live.movers} cards={cards} /> : null}
          <ToolsAside />
        </aside>
      </div>
    </main>
  );
}

export function V3cNewsIndex({ posts, live = null }: { posts: NewsItem[]; live?: NewsPage | null }) {
  const t = usePagesCopy().news;
  if (live && live.feed.state !== "off") return <LiveIndex posts={posts} live={live} />;
  return (
    <main className="v3c-wrap" id="main">
      <Fascia
        tab={t.tab}
        title={t.title}
        meta={
          <>
            <b>{t.metaStrong(posts.length)}</b>
            <span>{t.metaRest}</span>
          </>
        }
      />
      <div className="v3c-cols v3c-cols-8-4">
        <div>
          {posts.length === 0 ? (
            <div className="v3c-empty">
              <p className="v3c-t-row">{t.empty}</p>
              <a className="v3c-linkbtn" href={BOARD}>
                {t.emptySub}
              </a>
            </div>
          ) : (
            <GuideList posts={posts} />
          )}
        </div>
        <Aside />
      </div>
    </main>
  );
}

export type ArticleProps = {
  slug: string;
  title: string;
  date: string | null;
  minutes: number;
  image: string | null;
  /** già passato da sanitizeBlogHtml sul server */
  html: string;
  more: NewsItem[];
  /** live news on (NEWS_FOTMOB_ENABLED): the «Not live yet» box is left out */
  liveNews?: boolean;
};

export function V3cArticle({ title, date, minutes, image, html, more, liveNews = false }: ArticleProps) {
  const lang = useV3cLang();
  const t = usePagesCopy().news;
  const when = longDate(date, lang);
  return (
    <main className="v3c-wrap" id="main">
      <nav className="v3c-crumbs" aria-label="Breadcrumb">
        <Link href="/blog">{t.crumb}</Link>
        <span aria-hidden="true">/</span>
        <span>{t.guide}</span>
      </nav>
      <Fascia
        tab={`${t.crumb} · ${t.guide}`}
        title={<>{title}</>}
        meta={
          <>
            {when ? (
              <b>
                {t.published} {when}
              </b>
            ) : null}
            <span>{t.minutes(minutes)}</span>
          </>
        }
      />
      <div className="v3c-cols v3c-cols-8-4">
        <article className="v3c-pg-article">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element -- immagine del post da URL esterno del feed, dimensioni ignote
            <img className="v3c-pg-art-img" src={image} alt="" loading="lazy" />
          ) : null}
          <div className="v3c-pg-art-body" dangerouslySetInnerHTML={{ __html: html }} />
          <p className="v3c-fine v3c-pg-art-resp">
            {t.responsible}{" "}
            <a href="https://www.begambleaware.org" rel="nofollow noopener noreferrer" target="_blank">
              BeGambleAware
            </a>
            .
          </p>
          <p className="v3c-pg-art-back">
            <Link className="v3c-pg-more" href="/blog">
              <span aria-hidden="true">←</span> {t.back}
            </Link>
          </p>
        </article>
        <div>
          <Aside notes={!liveNews} />
          {more.length ? (
            <ol className="v3c-pg-nlist v3c-pg-nlist-s">
              {more.map((p) => (
                <li key={p.slug} className="v3c-pg-nw v3c-pg-nw-s">
                  <div>
                    <span className="v3c-lab">{t.guide}</span>
                    <h2 className="v3c-t-row v3c-pg-nw-h">
                      <a href={`/blog/${p.slug}`}>{p.title}</a>
                    </h2>
                  </div>
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      </div>
    </main>
  );
}
