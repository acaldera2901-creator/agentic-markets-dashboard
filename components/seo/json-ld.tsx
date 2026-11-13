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
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
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

// Article per i post del blog (#BLOG-SSR-0814). publisher/author = Organization
// BetRedge (i post arrivano dal feed Soro senza byline personale: inventare un
// autore-persona sarebbe un fake signal). Vietati numeri di performance come
// per il resto del file: il gate è la revisione umana pre-publish.
export function articleJsonLd(a: {
  title: string;
  description?: string | null;
  path: string;
  image?: string | null;
  datePublished?: string | null;
  dateModified?: string | null;
}): object {
  const org = { "@type": "Organization", name: "BetRedge", url: ORIGIN };
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: a.title,
    ...(a.description ? { description: a.description } : {}),
    mainEntityOfPage: { "@type": "WebPage", "@id": `${ORIGIN}${a.path}` },
    ...(a.image ? { image: [a.image] } : {}),
    ...(a.datePublished ? { datePublished: a.datePublished } : {}),
    ...(a.dateModified ? { dateModified: a.dateModified } : {}),
    inLanguage: "en",
    author: org,
    publisher: org,
  };
}

// A fixture directory, not individual Event landing pages. Google Event rich results
// require a dedicated URL and real venue data, neither supplied by this board.
// Keep every public fixture in the ItemList and in the visible UpcomingMatches list.
export function matchesJsonLd(
  matches: ReadonlyArray<{ sport: "football" | "tennis"; competition: string; home: string; away: string; startsAt: string }>,
  path = "/predictions",
): object {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Football and tennis fixtures",
    url: `${ORIGIN}${path}`,
    numberOfItems: matches.length,
    itemListElement: matches.map((m, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: `${m.home} vs ${m.away}`,
      description: `${m.sport === "tennis" ? "Tennis" : "Football"} · ${m.competition} · ${m.startsAt}`,
    })),
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
