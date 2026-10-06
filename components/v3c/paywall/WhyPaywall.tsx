// components/v3c/paywall/WhyPaywall.tsx (#REDESIGN-V3C F8-UI · filone pages)
// «Unlock why the model disagrees» — il paywall del perché (POSITIONING §4).
//
// Regole costruite nel componente, non lasciate al chiamante:
//   · si rende SOLO se c'è un disaccordo: |gap| ≥ FLAT_PP (paywallApplies). Su una
//     partita «in linea» non esiste: vendere il perché di nulla è un dark pattern;
//   · i TITOLI dei fattori li vede chiunque; il #1 è aperto per intero in Free;
//     #2–3 mostrano il titolo e «Opens with Pro» al posto del testo — niente blur,
//     niente testo finto sotto un velo che faccia intuire un «vincente»;
//   · nessun timer, nessuna scarsità, nessun colore d'allarme; il bottone è a
//     linea (la CTA royal della pagina partita resta quella del passo 3);
//   · il rifiuto non serve: il blocco è in pagina, non un modale da chiudere.
// Presentazionale: copy, fattori e prezzo arrivano come props (il prezzo dal
// piano di lib/v3c/plans.ts, i fattori da lib/ui/why-reasons sul match).
import { PAYWALL_CLOSED, PAYWALL_OPEN, paywallApplies } from "@/lib/v3c/paywall";
import type { PagesCopy } from "@/lib/v3c/pages-copy";

export type WhyFactor = { label: string; text: string };

type Props = {
  copy: PagesCopy["paywall"];
  factors: WhyFactor[];
  /** stima − mercato, in punti, con segno; null = nessun mercato → nessun paywall */
  gapPp: number | null;
  /** «$29.99» */
  price: string;
  href: string;
  /** calcio: la stima è 70% mercato, e il paywall lo dice */
  sport?: "football" | "tennis";
  /** pagina prezzi: anatomia senza dati di partita, dichiarata come esempio */
  example?: boolean;
  headingLevel?: "h2" | "h3";
};

function Lock() {
  return (
    <svg className="v3c-pw-lock" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" aria-hidden="true">
      <rect x="3.5" y="7.5" width="9" height="6" />
      <path d="M5.5 7.5V5a2.5 2.5 0 0 1 5 0v2.5" />
    </svg>
  );
}

export function WhyPaywall({ copy, factors, gapPp, price, href, sport = "football", example = false, headingLevel = "h2" }: Props) {
  // l'anatomia della pagina prezzi non è una partita: niente gap da controllare
  if (example ? factors.length === 0 : !paywallApplies(gapPp, factors.length)) return null;
  const H = headingLevel;
  const Ht = headingLevel === "h2" ? "h3" : "h4";
  const shown = factors.slice(0, PAYWALL_OPEN + PAYWALL_CLOSED);
  return (
    <section className="v3c-pw" aria-labelledby="v3c-pw-h">
      <div className="v3c-pw-head">
        <span className="v3c-lab">{copy.lab}</span>
        <H className="v3c-t-sec" id="v3c-pw-h">
          {copy.title}
        </H>
        <p className="v3c-explain">{copy.lede}</p>
      </div>
      <ol className="v3c-pw-list">
        {shown.map((f, i) => {
          const open = i < PAYWALL_OPEN;
          return (
            <li key={f.label + i} className={open ? "v3c-pw-open" : "v3c-pw-closed"}>
              <span className="v3c-pw-k" aria-hidden="true">
                {i + 1}
              </span>
              <div>
                <Ht className="v3c-pw-t">{f.label}</Ht>
                {open ? (
                  <p className="v3c-small">{f.text}</p>
                ) : (
                  <p className="v3c-pw-pro">
                    <Lock />
                    {copy.closed}
                  </p>
                )}
              </div>
              {open ? <span className="v3c-pw-tag">{copy.open}</span> : null}
            </li>
          );
        })}
      </ol>
      {sport === "football" ? <p className="v3c-fine v3c-pw-blend">{copy.blend}</p> : null}
      <div className="v3c-pw-act">
        <a className="v3c-btn v3c-btn-line" href={href}>
          {copy.cta(price)}
        </a>
        <span className="v3c-fine">{copy.cancel}</span>
      </div>
      {example ? <p className="v3c-fine v3c-pw-example">{copy.example}</p> : null}
    </section>
  );
}
