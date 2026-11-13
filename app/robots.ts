import type { MetadataRoute } from "next";

// #SEO-SCAFFOLDING-0721 — robots machine-readable (prima: 404 → nessuna guida di
// crawl). Le aree non indicizzabili sono API, admin e flussi utente transazionali.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        // Public GET resources used by the anonymous board. Exact path or query
        // only: do not accidentally open authenticated child routes.
        allow: ["/", ...["predictions", "tennis", "tennis-live", "news", "fortuneplay-odds", "geo-books", "version", "v2/history"].flatMap(path => [`/api/${path}$`, `/api/${path}?`])],
        disallow: ["/api/", "/admin", "/reset-password", "/go/"],
      },
    ],
    sitemap: "https://www.betredge.com/sitemap.xml",
  };
}
