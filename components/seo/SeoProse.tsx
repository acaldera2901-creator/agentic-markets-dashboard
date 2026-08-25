// components/seo/SeoProse.tsx — #SEO-AEO-0825
// Blocco di prosa RESO DAL SERVER per pagine il cui contenuto vero e' client
// (gattato per geo o dietro paywall). Non aggira il gate: dice a un lettore
// umano e a un crawler cosa fa la pagina, senza esporre nulla di gattato.
//
// La FAQ visibile e il FAQPage JSON-LD escono dallo STESSO array: una risposta
// nello schema che non compare nella pagina e' rischio di manual action, e il
// solo modo di non farli divergere e' non averli come due liste.
import { JsonLd, faqJsonLd } from "./json-ld";

// Palette --am-* (la stessa che usano queste tre pagine). Vedi la nota sulle due
// palette parallele: qui NON si tocca --v-*.
//
// z-index: le pagine con una scena machina hanno una velatura FISSA a tutto
// schermo ([data-mc-ground]::after, z-index:-1, nero al 92-98%). Il contenuto
// della pagina ci sta sopra perche' vive dentro un antenato posizionato; questa
// sezione, che e' un fratello del contenuto, ci finiva SOTTO. Misurato: 1,12:1
// di contrasto sullo schermo mentre getComputedStyle dichiarava 9,39:1. Bastano
// position+z-index per dipingere nello stesso strato del resto della pagina.
const CSS = `
.seo-prose{position:relative;z-index:0;max-width:68ch;margin:0 auto;padding:48px 24px 64px;font-size:15px;line-height:1.7;color:var(--am-muted)}
.seo-prose h1,.seo-prose h2{color:var(--am-text);letter-spacing:-.015em;margin:0 0 14px}
.seo-prose h1{font-size:30px;font-weight:800}
.seo-prose h2{font-size:22px;font-weight:700}
.seo-prose p{margin:0 0 14px}
.seo-prose .seo-faq{margin-top:32px;border-top:1px solid var(--am-line);padding-top:24px}
.seo-prose .seo-faq h3{color:var(--am-text);font-size:15px;font-weight:700;margin:0 0 6px}
.seo-prose .seo-faq div+div{margin-top:20px}
`;

export function SeoProse({
  heading,
  headingLevel = "h2",
  intro,
  faq,
}: {
  heading: string;
  /** h1 solo dove la pagina non ne serve gia' uno nell'HTML iniziale. */
  headingLevel?: "h1" | "h2";
  intro: string[];
  faq: Array<[question: string, answer: string]>;
}) {
  const H = headingLevel;
  return (
    <section className="seo-prose">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <JsonLd data={faqJsonLd(faq, "en")} />
      <H>{heading}</H>
      {intro.map((p) => (
        <p key={p.slice(0, 40)}>{p}</p>
      ))}
      <div className="seo-faq">
        {faq.map(([q, a]) => (
          <div key={q}>
            <h3>{q}</h3>
            <p>{a}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
