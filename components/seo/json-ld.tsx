// #SEO-PACK-0810: iniezione JSON-LD consistente (server component, zero client
// JS). Ogni URL negli schema è ASSOLUTO su https://www.betredge.com, lo stesso
// host dei canonical. Regole dure: niente em-dash nei testi; niente numeri di
// performance (hit rate, ROI, accuratezza) negli schema — su un prodotto
// betting-adjacent è un problema di compliance ASA prima ancora che SEO.

const ORIGIN = "https://www.betredge.com";

export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

// BreadcrumbList che rispecchia la gerarchia URL reale. items = coppie
// [nome, path] a partire da Home (inclusa automaticamente).
export function breadcrumbJsonLd(items: Array<[name: string, path: string]>): object {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${ORIGIN}/` },
      ...items.map(([name, path], i) => ({
        "@type": "ListItem",
        position: i + 2,
        name,
        item: `${ORIGIN}${path}`,
      })),
    ],
  };
}

// FAQPage: usare SOLO con domande la cui risposta è visibile nella pagina
// renderizzata (una FAQ schema senza risposta visibile è rischio manual action).
export function faqJsonLd(qa: Array<[question: string, answer: string]>, inLanguage?: string): object {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    ...(inLanguage ? { inLanguage } : {}),
    mainEntity: qa.map(([q, a]) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
}
