"use client";
// components/v3c/pages/Books.tsx (#REDESIGN-V3C F9 · filone pages) — la pagina Books.
// Una cosa grande: le card dei book con prezzi live (gli unici che possono essere
// «best» sulla board). Ogni card: logo del catalogo, cosa fa il book qui, il
// bonus — NESSUNO, perché il catalogo non ne ha uno verificato (lib/partners.ts:
// le tagline sono FTC-safe e dichiarano di non affermare bonus) —, dove vale il
// link, il bottone affiliato reale tracciato (partner_click, come la vetrina di
// sempre). Sotto: il confronto dei prezzi di oggi, poi gli altri book (solo link
// di registrazione, nessun prezzo), il gioco responsabile, la FAQ.
// Una sola CTA royal: il primo book con feed. 18+ e affiliazione sempre visibili.
import Link from "next/link";
import { useV3cLang } from "@/lib/v3c/lang.client";
import { usePagesCopy } from "@/lib/v3c/pages-copy.client";
import { hhmmUtc, type CompareRow } from "@/lib/v3c/books";
import { trackEvent } from "@/lib/track-event";
import { PARTNERS_SEO_FAQ, PARTNERS_SEO_HEADING, PARTNERS_SEO_INTRO } from "@/app/partners/seo";
import { Arrow } from "../Arrow";
import { Fascia } from "../Fascia";
import { v3cLang } from "@/lib/v3c/copy";

export type BookCard = {
  id: string;
  name: string;
  logo: string;
  emblem: boolean;
  url: string;
  category: "sportsbook" | "casino";
  /** il partner esiste SOLO in questi paesi (nessun link neutro) */
  onlyIn: string[] | null;
  /** il partner ha un link di registrazione locale in questi paesi */
  localIn: string[] | null;
};

type Props = {
  blocked: boolean;
  connected: BookCard[];
  more: BookCard[];
  rows: CompareRow[];
  bestCount: Record<string, number>;
  priced: number;
  checkedAt: string | null;
  boardOk: boolean;
};

function regions(codes: string[], lang: string): string {
  try {
    const dn = new Intl.DisplayNames([v3cLang(lang)], { type: "region" });
    return codes.map((c) => dn.of(c) ?? c).join(", ");
  } catch {
    return codes.join(", ");
  }
}

function track(b: BookCard, kind: string) {
  trackEvent("partner_click", { partner_id: b.name, meta: { surface: "v3c_partners", kind } });
}

function Logo({ b }: { b: BookCard }) {
  return (
    <span className={b.emblem ? "v3c-pg-plate v3c-pg-plate-em" : "v3c-pg-plate"}>
      {/* eslint-disable-next-line @next/next/no-img-element -- loghi statici in /public, come la vetrina di sempre */}
      <img src={b.logo} alt="" loading="lazy" />
    </span>
  );
}

/** La prosa SEO di /partners (stesso testo del layout a flag spento); il JSON-LD lo scrive il server. */
function PartnersSeo() {
  return (
    <section className="v3c-sec v3c-pg-seo" aria-labelledby="v3c-pg-seo-h">
      <h2 className="v3c-t-sec" id="v3c-pg-seo-h">
        {PARTNERS_SEO_HEADING}
      </h2>
      <div className="v3c-prose">
        {PARTNERS_SEO_INTRO.map((p) => (
          <p key={p.slice(0, 40)}>{p}</p>
        ))}
      </div>
      <div className="v3c-pg-faq">
        {PARTNERS_SEO_FAQ.map(([q, a]) => (
          <div key={q} className="v3c-faq-i">
            <h3 className="v3c-t-row">{q}</h3>
            <p className="v3c-small">{a}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

const price2 = (n: number) => n.toFixed(2);

export function V3cBooks({ blocked, connected, more, rows, bestCount, priced, checkedAt, boardOk }: Props) {
  const lang = useV3cLang();
  const t = usePagesCopy().books;

  const where = (b: BookCard) => (b.onlyIn ? t.onlyIn(regions(b.onlyIn, lang)) : b.localIn ? `${t.everywhere} · ${t.localLink(regions(b.localIn, lang))}` : t.everywhere);

  if (blocked) {
    return (
      <main className="v3c-wrap" id="main">
        <Fascia tab={t.tab} title={t.blockedTitle} meta={<span>{t.blockedBody}</span>} />
        <p>
          <Link className="v3c-btn v3c-btn-line" href="/">
            {t.blockedBack}
          </Link>
        </p>
        <PartnersSeo />
      </main>
    );
  }

  return (
    <main className="v3c-wrap" id="main">
      <Fascia
        tab={t.tab}
        title={t.title}
        meta={
          <>
            <b>{t.metaStrong(connected.length)}</b>
            <span>{t.metaRest}</span>
            <span className="v3c-age">18+</span>
          </>
        }
      />

      <div className="v3c-pg-cards">
        {connected.map((b, i) => (
          <article key={b.id} className={i === 0 ? "v3c-pg-card v3c-pg-card-first" : "v3c-pg-card"} aria-labelledby={`v3c-bk-${b.id}`}>
            <div className="v3c-pg-card-h">
              <Logo b={b} />
              <div>
                <h2 className="v3c-t-row" id={`v3c-bk-${b.id}`}>
                  {b.name}
                </h2>
                <span className="v3c-small">
                  {t.connected} · {boardOk && priced > 0 ? <b>{t.bestOn(bestCount[b.id] ?? 0, priced)}</b> : t.noBoard}
                </span>
              </div>
            </div>
            <p className="v3c-pg-bonus">
              <b>{t.bonusNone}</b>
              <small>{t.bonusWhy}</small>
            </p>
            <p className="v3c-pg-where">
              <span className="v3c-lab">{t.where}</span> {where(b)}
            </p>
            <a
              className={i === 0 ? "v3c-btn v3c-btn-cta" : "v3c-btn v3c-btn-line"}
              href={b.url}
              target="_blank"
              rel="nofollow sponsored noopener noreferrer"
              data-partner={b.id}
              onClick={() => track(b, "card")}
            >
              {t.goTo(b.name)} <Arrow up />
            </a>
            <span className="v3c-fine">
              {t.affiliate} · 18+
            </span>
          </article>
        ))}
      </div>

      <section className="v3c-sec" aria-labelledby="v3c-pg-cmp">
        <div className="v3c-sec-h">
          <h2 className="v3c-t-sec" id="v3c-pg-cmp">
            {t.compareTitle}
          </h2>
          <span className="v3c-small">{t.compareSub}</span>
        </div>
        {rows.length === 0 ? (
          <p className="v3c-small v3c-pg-none">{t.compareNone}</p>
        ) : (
          <div className="v3c-pg-scroll">
            <table className="v3c-books v3c-pg-cmp">
              <thead>
                <tr>
                  <th className="v3c-lab" scope="col">
                    {t.compareMatch}
                  </th>
                  {connected.map((b) => (
                    <th key={b.id} className="v3c-lab v3c-r" scope="col">
                      {b.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <span className="v3c-pg-cmp-m">{r.match}</span>
                      <small className="v3c-pg-cmp-o">{r.outcome}</small>
                    </td>
                    {connected.map((b) => {
                      const v = r.prices[b.id];
                      const best = r.best === b.id && Object.keys(r.prices).length > 1;
                      return (
                        <td key={b.id} className={best ? "v3c-num v3c-r v3c-pg-best" : "v3c-num v3c-r"}>
                          {v != null ? price2(v) : <span className="v3c-pg-dash" aria-label="no price">—</span>}
                          {best ? <span className="v3c-sr"> ({t.compareBest})</span> : null}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {rows.length > 0 && checkedAt ? <p className="v3c-fine v3c-pg-checked">{t.compareChecked(hhmmUtc(checkedAt))}</p> : null}
      </section>

      {more.length > 0 ? (
        <section className="v3c-sec" aria-labelledby="v3c-pg-more">
          <div className="v3c-sec-h">
            <h2 className="v3c-t-sec" id="v3c-pg-more">
              {t.moreTitle}
            </h2>
            <span className="v3c-small">{t.moreSub}</span>
          </div>
          <ul className="v3c-pg-morelist">
            {more.map((b) => (
              <li key={b.id}>
                <Logo b={b} />
                <span className="v3c-pg-more-n">
                  <b>{b.name}</b>
                  <span className="v3c-small">
                    {b.category === "sportsbook" ? t.sportsbook : t.casino}
                    {b.onlyIn || b.localIn ? ` · ${where(b)}` : ""}
                  </span>
                </span>
                <a className="v3c-ghost v3c-pg-visit" href={b.url} target="_blank" rel="nofollow sponsored noopener noreferrer" data-partner={b.id} onClick={() => track(b, "more")}>
                  {t.visit} <Arrow up />
                  <span className="v3c-sr"> {b.name}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <aside className="v3c-pg-resp">
        <span className="v3c-age v3c-pg-age">18+</span>
        <div>
          <b>{t.respTitle}</b>
          <p className="v3c-small">
            {t.respBody}{" "}
            <a href="https://www.begambleaware.org" rel="nofollow noopener noreferrer" target="_blank">
              BeGambleAware ↗
            </a>
          </p>
        </div>
      </aside>

      <PartnersSeo />
      <p className="v3c-fine v3c-pg-fine">{t.fine}</p>
    </main>
  );
}
