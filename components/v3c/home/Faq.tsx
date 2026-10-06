"use client";
// components/v3c/home/Faq.tsx (#REDESIGN-V3C F3)
// polish: le sei domande di lib/v3c/home-faq.ts (solo Free e Pro), VISIBILI: il FAQPage JSON-LD di "/" resta
// identico (requisito F3: canonical, JSON-LD, sitemap invariati) e uno schema
// senza risposta visibile è rischio manual action. Unica fonte, nessuna copia.
// Nota per F9: due risposte descrivono ancora la card del desk di oggi
// («every card carries one number») — si riscrivono con il JSON-LD, insieme.
import { v3cHomeFaq } from "@/lib/v3c/home-faq";
import { useV3cCopy } from "@/lib/v3c/lang.client";

export function Faq() {
  const { lang, t } = useV3cCopy();
  const items = v3cHomeFaq(lang);
  return (
    <section className="v3c-faq" aria-labelledby="v3c-faq-h">
      <h2 className="v3c-t-sec" id="v3c-faq-h">
        {t.faq.title}
      </h2>
      <div className="v3c-faq-l">
        {items.map(([q, a]) => (
          <details key={q}>
            <summary>{q}</summary>
            <p className="v3c-explain">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
