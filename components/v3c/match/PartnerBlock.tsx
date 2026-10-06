"use client";
// components/v3c/match/PartnerBlock.tsx (#REDESIGN-V3C F4)
// Il passo 3: SOLO dopo la lettura. Una lista di N book — chi ha un feed mostra
// la quota, chi non ce l'ha dice «Odds on site» e non finge un numero — e UNA
// CTA royal verso il miglior prezzo. Link affiliati reali dal contratto
// (deep-link del book o landing del registro), rel="nofollow sponsored",
// tracciati come sulla board. 18+ e «affiliate» discreti ma presenti.
import type { BookListing } from "@/lib/v3c/match-view";
import type { V3cMatchCopy } from "@/lib/v3c/match-copy";
import { trackEvent } from "@/lib/track-event";

const BOOK_COLOUR: Record<string, string> = { fortuneplay: "#1B1F5E", ybets: "#0B6B4F" };

function Mark({ b, lg }: { b: { bookmaker: string; name: string }; lg?: boolean }) {
  const code = b.name.replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase();
  return (
    <span className={lg ? "v3c-bk v3c-bk-lg" : "v3c-bk"} style={{ "--bk": BOOK_COLOUR[b.bookmaker] ?? "#14171C" } as React.CSSProperties} aria-hidden="true">
      {code}
    </span>
  );
}

type Props = {
  id: string;
  title: string;
  label: string;
  books: readonly BookListing[];
  /** «checked 23:10», già formattato */
  checked: string | null;
  partners: boolean;
  surface: "match" | "price_check";
  c: V3cMatchCopy;
  age: string;
};

export function PartnerBlock({ id, title, label, books, checked, partners, surface, c, age }: Props) {
  const priced = books.filter((b) => b.price != null);
  const best = priced[0] ?? null;
  const click = (b: BookListing, kind: string) => trackEvent("partner_click", { partner_id: b.name, meta: { surface: `v3c_${surface}`, kind, outcome: label } });
  return (
    <section className="v3c-partner v3c-mt-partner" aria-labelledby={id}>
      <div className="v3c-p-head">
        <h2 className="v3c-t-sec" id={id}>
          {title}
        </h2>
        {books.length ? <span className="v3c-small">{c.partnerMeta(label, books.length, checked)}</span> : null}
      </div>
      {!partners ? (
        <p className="v3c-fine">{c.blocked}</p>
      ) : books.length === 0 ? (
        <p className="v3c-fine">{c.noBooks}</p>
      ) : (
        <>
          {best ? (
            <div className="v3c-p-best">
              <Mark b={best} lg />
              <div className="v3c-p-num">
                <span className="v3c-lab">{c.bestLab(best.name)}</span>
                <span className="v3c-n-xl">{(best.price as number).toFixed(2)}</span>
              </div>
              <a className="v3c-btn v3c-btn-cta" href={best.url} target="_blank" rel="nofollow sponsored noopener noreferrer" data-partner={best.bookmaker} onClick={() => click(best, "best_price")}>
                {c.cta(best.name)} <span aria-hidden="true">↗</span>
              </a>
            </div>
          ) : (
            <p className="v3c-fine">{c.noBooks}</p>
          )}
          <table className="v3c-books">
            <thead>
              <tr>
                <th className="v3c-lab">{c.book}</th>
                <th className="v3c-lab v3c-r">{c.price}</th>
                <th className="v3c-lab v3c-r">{c.vsBest}</th>
              </tr>
            </thead>
            <tbody>
              {books.map((b) => (
                <tr key={b.bookmaker} className={b === best ? "v3c-best" : undefined}>
                  <td>
                    <Mark b={b} />
                    <a href={b.url} target="_blank" rel="nofollow sponsored noopener noreferrer" data-partner={b.bookmaker} onClick={() => click(b, b.price == null ? "odds_on_site" : "book_row")}>
                      {b.name}
                      <span className="v3c-sr">, {c.affiliates}</span>
                    </a>
                  </td>
                  <td className="v3c-r v3c-num">{b.price == null ? <span className="v3c-mt-site">{c.oddsOnSite}</span> : b.price.toFixed(2)}</td>
                  <td className="v3c-r v3c-small">{b.price == null || !best ? "—" : b === best ? c.best : (b.price - (best.price as number)).toFixed(2).replace("-", "−")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {partners && books.length ? (
        <p className="v3c-fine">
          {c.partnerFine(checked)} <span className="v3c-age">{age}</span> {c.affiliates}
        </p>
      ) : null}
    </section>
  );
}
