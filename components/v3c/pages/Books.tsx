"use client";
// components/v3c/pages/Books.tsx (#REDESIGN-V3C F9 · filone pages → ui2) — la pagina Books.
// ui2 (Andrea, 07/10): «tutti i partner in evidenza, non solo 2». Ogni partner
// del catalogo (lib/partners.ts) ha la STESSA card: logo, nome, tipo, dove vale
// il link, 18+, bottone affiliato reale tracciato (partner_click, come la
// vetrina di sempre), rel="nofollow sponsored". Ordine alfabetico, dichiarato.
// L'unica differenza fra le card è un fatto: chi ha un feed di quote letto dice
// «Live prices on the board», gli altri «Odds on partner site» — stesso stile,
// stessa riga. Nessun bonus: il catalogo non ne ha di verificati. Nessuna CTA
// royal: tutti i bottoni hanno lo stesso peso. Sotto: il confronto dei prezzi
// di oggi (solo book con feed), il gioco responsabile, la FAQ.
import { useMemo, useState } from "react";
import { Banner } from "../Banner";
import "../fidelity.css";
import "../ui2.css";
import Link from "next/link";
import { useV3cLang } from "@/lib/v3c/lang.client";
import { usePagesCopy } from "@/lib/v3c/pages-copy.client";
import { hhmmUtc, type CompareRow } from "@/lib/v3c/books";
import { trackEvent } from "@/lib/track-event";
import { PARTNERS_SEO_FAQ, PARTNERS_SEO_HEADING, PARTNERS_SEO_INTRO } from "@/app/partners/seo";
import { Arrow } from "../Arrow";
import { Fascia } from "../Fascia";
import { PartnerLogo, needsName } from "../PartnerLogo";
import { v3cLang } from "@/lib/v3c/copy";

export type BookCard = {
  id: string;
  name: string;
  url: string;
  category: "sportsbook" | "casino";
  /** un feed di quote letto: la quota compare sulla board e nel confronto */
  live: boolean;
  /** il partner esiste SOLO in questi paesi (nessun link neutro) */
  onlyIn: string[] | null;
  /** il partner ha un link di registrazione locale in questi paesi */
  localIn: string[] | null;
};

type Props = {
  blocked: boolean;
  /** tutti i partner, già in ordine alfabetico */
  cards: BookCard[];
  /** i soli book con feed, per le colonne del confronto */
  connected: BookCard[];
  rows: CompareRow[];
  checkedAt: string | null;
};

type Kind = "all" | "sportsbook" | "casino";

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

export function V3cBooks({ blocked, cards, connected, rows, checkedAt }: Props) {
  const lang = useV3cLang();
  const t = usePagesCopy().books;
  const [kind, setKind] = useState<Kind>("all");
  const [q, setQ] = useState("");

  const where = (b: BookCard) => (b.onlyIn ? t.onlyIn(regions(b.onlyIn, lang)) : b.localIn ? `${t.everywhere} · ${t.localLink(regions(b.localIn, lang))}` : t.everywhere);
  const count = (k: Kind) => (k === "all" ? cards.length : cards.filter((c) => c.category === k).length);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return cards.filter((c) => (kind === "all" || c.category === kind) && (!needle || c.name.toLowerCase().includes(needle)));
  }, [cards, kind, q]);

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

  const KINDS: [Kind, string][] = [
    ["all", t.all],
    ["sportsbook", t.sportsbooks],
    ["casino", t.casinos],
  ];

  return (
    <main className="v3c-wrap" id="main">
      <Fascia
        tab={t.tab}
        title={t.title}
        meta={
          <>
            <b>{t.metaStrong(cards.length)}</b>
            <span>{t.metaRest}</span>
            <span className="v3c-age">18+</span>
          </>
        }
        art={<Banner name="partner-crowd" priority position="60% 45%" />}
      />

      <div className="v3c-bks-bar">
        <div className="v3c-chips" role="group" aria-label={t.filterLabel}>
          {KINDS.map(([k, label]) => (
            <button key={k} type="button" className="v3c-chip" aria-pressed={kind === k} onClick={() => setKind(k)}>
              {label} <small>{count(k)}</small>
            </button>
          ))}
        </div>
        <label className="v3c-bks-search">
          <span className="v3c-sr">{t.search}</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.search} autoComplete="off" spellCheck={false} />
        </label>
        <p className="v3c-small v3c-bks-order" aria-live="polite">
          {t.shown(shown.length, cards.length)} · {t.order}
        </p>
      </div>

      {shown.length === 0 ? (
        <p className="v3c-small v3c-bks-none">{t.none}</p>
      ) : (
        <ul className="v3c-bks-grid">
          {shown.map((b) => (
            <li key={b.id}>
              <article className="v3c-bks-card" aria-labelledby={`v3c-bks-${b.id}`}>
                <PartnerLogo id={b.id} name={b.name} size="card" decorative />
                <div className="v3c-bks-id">
                  <h2 className="v3c-t-row" id={`v3c-bks-${b.id}`}>
                    {b.name}
                  </h2>
                  <span className="v3c-small">
                    {b.category === "sportsbook" ? t.typeSportsbook : t.typeCasino} · <span className="v3c-age">18+</span>
                  </span>
                </div>
                <dl className="v3c-bks-facts">
                  <div>
                    <dt className="v3c-lab">{t.pricesLab}</dt>
                    <dd>{b.live ? t.live : t.siteOdds}</dd>
                  </div>
                  <div>
                    <dt className="v3c-lab">{t.where}</dt>
                    <dd>{where(b)}</dd>
                  </div>
                </dl>
                <a className="v3c-btn v3c-btn-line v3c-bks-go" href={b.url} target="_blank" rel="nofollow sponsored noopener noreferrer" data-partner={b.id} onClick={() => track(b, "card")}>
                  {t.goTo(b.name)} <Arrow up />
                </a>
                <span className="v3c-fine">{t.affiliate}</span>
              </article>
            </li>
          ))}
        </ul>
      )}

      <section className="v3c-sec" id="v3c-pg-compare" aria-labelledby="v3c-pg-cmp">
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
                      <span className="v3c-bks-th">
                        <PartnerLogo id={b.id} name={b.name} size="chip" decorative />
                        <span className={needsName(b.id, b.name) ? undefined : "v3c-sr"}>{b.name}</span>
                      </span>
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
