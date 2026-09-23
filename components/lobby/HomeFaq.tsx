// components/lobby/HomeFaq.tsx — #RESTYLING-0921 round 2
//
// Le sei domande della FAQ, in coda alla Home.
//
// Non è una scelta grafica: è il prezzo di avere il prodotto su "/". Il
// FAQPage JSON-LD vive su "/" (app/page.tsx) e uno schema le cui risposte non
// sono visibili nella pagina è rischio manual action — la nota c'era già in
// app/page.tsx quando su "/" stava la landing, che le mostrava. Spostando il
// prodotto su "/" le risposte devono venire con lui, o lo schema deve andarsene.
// Vengono con lui: sono anche l'unico testo indicizzabile di una pagina che per
// il resto è dati.
//
// La fonte è UNA, lib/home-faq.ts — la stessa di /how-it-works e dello schema.
// Nessuna copy nuova qui dentro: una FAQ riscritta in due posti diverge, e a
// quel punto lo schema mente su una delle due.
import { homeFaq } from "@/lib/home-faq";

/** `dt`/`dd` in un `<dl>`: è una lista di definizioni, non una fila di
 *  accordion. Il testo è nel DOM al primo paint (nessun `<details>` chiuso da
 *  aprire) perché è esattamente ciò che lo schema dichiara. */
export function HomeFaq({ lang, title }: { lang: string; title: string }) {
  const items = homeFaq(lang);
  if (items.length === 0) return null;
  return (
    <section className="br-faq" aria-labelledby="br-faq-title">
      <h2 className="br-sec__title" id="br-faq-title">{title}</h2>
      <dl className="br-faq__list">
        {items.map(([q, a]) => (
          <div className="br-faq__item" key={q}>
            <dt className="br-faq__q">{q}</dt>
            <dd className="br-faq__a">{a}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
