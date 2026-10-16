// components/lobby/HomeFaq.tsx — #RESTYLING-0921 round 2 · #CLASSIC-ASSET-1013 round 3
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
//
// Round 3 (Andrea, 14/10): sei risposte aperte su tre colonne occupavano troppo.
// Ora ogni domanda è un <details> chiuso: la risposta sta comunque nell'HTML
// del server (è ciò che lo schema dichiara, e Google legge il contenuto dei
// <details> chiusi), tastiera e stati li dà il browser, niente JS. Copy invariata.
import { homeFaq } from "@/lib/home-faq";
import { IconChevronDown } from "@/components/ui/icons";

export function HomeFaq({ lang, title }: { lang: string; title: string }) {
  const items = homeFaq(lang);
  if (items.length === 0) return null;
  return (
    <section className="br-faq" aria-labelledby="br-faq-title">
      <h2 className="br-sec__title" id="br-faq-title">{title}</h2>
      <div className="br-faq__list">
        {items.map(([q, a]) => (
          <details className="br-faq__item" key={q}>
            <summary className="br-faq__q">
              <span>{q}</span>
              <IconChevronDown size={16} className="br-faq__chev" />
            </summary>
            <p className="br-faq__a">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
