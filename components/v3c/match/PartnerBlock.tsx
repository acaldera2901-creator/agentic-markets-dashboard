"use client";
// components/v3c/match/PartnerBlock.tsx (#REDESIGN-V3C F4)
// Il passo 3: SOLO dopo la lettura. Una lista di N book — chi ha un feed mostra
// la quota, chi non ce l'ha dice «Odds on partner site» e non finge un numero — e UNA
// CTA royal verso il miglior prezzo. Link affiliati reali dal contratto
// (deep-link del book o landing del registro), rel="nofollow sponsored",
// tracciati come sulla board. 18+ e «affiliate» discreti ma presenti.
import { topPriced, type BookListing } from "@/lib/v3c/match-view";
import type { V3cMatchCopy } from "@/lib/v3c/match-copy";
import { trackEvent } from "@/lib/track-event";
import { Arrow } from "../Arrow";
import { PartnerLogo } from "../PartnerLogo";

/** ui2: il logo del partner (catalogo), non più le iniziali. Il nome è sempre scritto accanto (riga, «Best at …»): alt vuoto. */
function Mark({ b, lg }: { b: { bookmaker: string; name: string }; lg?: boolean }) {
  return <PartnerLogo id={b.bookmaker} name={b.name} size={lg ? "lg" : "row"} decorative />;
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
  /** polish: l'ora di cattura di ogni prezzo (stesso fuso della pagina) */
  timeOf?: (iso: string) => string;
};

function BookRow({ b, best, c, click, timeOf }: { b: BookListing; best: BookListing | null; c: V3cMatchCopy; click: (b: BookListing, kind: string) => void; timeOf?: (iso: string) => string }) {
  return (
    <tr className={b === best ? "v3c-best" : undefined}>
      <td>
        <Mark b={b} />
        <a href={b.url} target="_blank" rel="nofollow sponsored noopener noreferrer" data-partner={b.bookmaker} onClick={() => click(b, b.price == null ? "odds_on_site" : "book_row")}>
          {b.name}
          <span className="v3c-sr">, {c.affiliates}</span>
        </a>
        {b.price != null && b.captured_at && timeOf ? <small className="v3c-p-at">{c.priceAt(timeOf(b.captured_at))}</small> : null}
      </td>
      <td className="v3c-r v3c-num">{b.price == null ? <span className="v3c-mt-site">{c.oddsOnSite}</span> : b.price.toFixed(2)}</td>
      <td className="v3c-r v3c-small">{b.price == null || !best ? "—" : b === best ? c.best : (b.price - (best.price as number)).toFixed(2).replace("-", "−")}</td>
    </tr>
  );
}

export function PartnerBlock({ id, title, label, books, checked, partners, surface, c, age, timeOf }: Props) {
  const priced = books.filter((b) => b.price != null);
  const site = books.filter((b) => b.price == null);
  // polish: «best» solo se un book paga STRETTAMENTE di più; a pari prezzo nessuna CTA verso uno dei due
  const top = topPriced(priced);
  const best = top.length === 1 ? top[0] : null;
  const shared = top.length > 1 ? top : null;
  const click = (b: BookListing, kind: string) => trackEvent("partner_click", { partner_id: b.name, meta: { surface: `v3c_${surface}`, kind, outcome: label } });
  const head = (
    <thead>
      <tr>
        <th className="v3c-lab">{c.book}</th>
        <th className="v3c-lab v3c-r">{c.price}</th>
        <th className="v3c-lab v3c-r">{best ? c.vsBest : ""}</th>
      </tr>
    </thead>
  );
  return (
    <section className="v3c-partner v3c-mt-partner" aria-labelledby={id}>
      <div className="v3c-p-head">
        <h2 className="v3c-t-sec" id={id}>
          {shared && surface === "match" ? c.pricesFrom(priced.length) : title}
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
                {best.captured_at && timeOf ? <small className="v3c-p-at">{c.priceAt(timeOf(best.captured_at))}</small> : null}
              </div>
              <a className="v3c-btn v3c-btn-cta" href={best.url} target="_blank" rel="nofollow sponsored noopener noreferrer" data-partner={best.bookmaker} onClick={() => click(best, "best_price")}>
                {c.cta(best.name)} <Arrow up />
              </a>
            </div>
          ) : shared ? (
            <div className="v3c-p-best v3c-p-shared">
              <div className="v3c-p-num">
                <span className="v3c-lab">{c.sharedTop(shared.length)}</span>
                <span className="v3c-n-xl">{(shared[0].price as number).toFixed(2)}</span>
              </div>
              <p className="v3c-small">{c.sharedNote}</p>
            </div>
          ) : (
            <p className="v3c-fine">{c.noBooks}</p>
          )}
          {priced.length ? (
            <table className="v3c-books">
              {head}
              <tbody>
                {priced.map((b) => (
                  <BookRow key={b.bookmaker} b={b} best={best} c={c} click={click} timeOf={timeOf} />
                ))}
              </tbody>
            </table>
          ) : null}
          {site.length ? (
            // polish: i book senza feed (anche 11) stanno dietro un'apertura: a 390 px la lista era più lunga della lettura
            <details className="v3c-p-more">
              <summary>{c.moreBooks(site.length)}</summary>
              <table className="v3c-books">
                <tbody>
                  {site.map((b) => (
                    <BookRow key={b.bookmaker} b={b} best={best} c={c} click={click} />
                  ))}
                </tbody>
              </table>
            </details>
          ) : null}
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
