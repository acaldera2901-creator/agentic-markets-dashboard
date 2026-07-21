import type { MetadataRoute } from "next";

// #SEO-SCAFFOLDING-0721 — sitemap delle sole rotte pubbliche renderizzabili da
// anonimo (niente rotte dietro flag NEXT_PUBLIC_UX_NEW né aree auth/admin).
// Niente lastModified: il contenuto delle board cambia a ogni ciclo agenti, un
// timestamp di build mentirebbe; changeFrequency comunica la stessa cosa.
const BASE = "https://www.betredge.com";

const PUBLIC_ROUTES: { path: string; changeFrequency: "daily" | "monthly"; priority: number }[] = [
  { path: "/", changeFrequency: "daily", priority: 1 },
  { path: "/app", changeFrequency: "daily", priority: 0.9 },
  { path: "/world-cup", changeFrequency: "daily", priority: 0.8 },
  { path: "/weekly-pick", changeFrequency: "daily", priority: 0.8 },
  { path: "/community", changeFrequency: "daily", priority: 0.6 },
  { path: "/terms", changeFrequency: "monthly", priority: 0.3 },
  { path: "/privacy", changeFrequency: "monthly", priority: 0.3 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_ROUTES.map((r) => ({
    url: r.path === "/" ? BASE : `${BASE}${r.path}`,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}
