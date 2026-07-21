import type { MetadataRoute } from "next";

// #SEO-SCAFFOLDING-0721 — robots machine-readable (prima: 404 → nessuna guida di
// crawl). Le aree non indicizzabili sono API, admin e flussi utente transazionali.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin", "/reset-password"],
      },
    ],
    sitemap: "https://www.betredge.com/sitemap.xml",
  };
}
