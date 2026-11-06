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

// ItemList di SportsEvent per le prossime partite (#SEO-AEO-1106). Solo fatti pubblici (squadre/giocatori, competizione, orario):
// niente probabilita', quote o pick (gated), niente numeri di performance. Il testo equivalente e' visibile nella pagina (UpcomingMatches).
export function matchesJsonLd(
  matches: ReadonlyArray<{ sport: "football" | "tennis"; competition: string; home: string; away: string; startsAt: string }>,
  path = "/predictions",
): object {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Upcoming football and tennis matches on BetRedge",
    itemListElement: matches.map((m, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "SportsEvent",
        name: `${m.home} vs ${m.away}`,
        description: m.competition,
        startDate: m.startsAt,
        sport: m.sport === "tennis" ? "Tennis" : "Soccer",
        url: `${ORIGIN}${path}`,
        competitor: [m.home, m.away].map((n) => ({ "@type": m.sport === "tennis" ? "Person" : "SportsTeam", name: n })),
      },
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
