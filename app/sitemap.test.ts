// app/sitemap.test.ts (#TOOLS-HUB-0805)
// La sitemap è l'unico invito che diamo ai crawler: 66 pagine nuove che non
// compaiono lì restano scoperte per settimane.

import { describe, it, expect, vi, beforeAll } from "vitest";
import type { MetadataRoute } from "next";
import sitemap from "./sitemap";
import { TOOL_LOCALES, TOOL_SLUGS, hubPath, toolPath } from "@/lib/tools/registry";
import { GENERATED_AT } from "@/lib/seo/last-modified.generated";

// #BLOG-SSR-0814: la sitemap legge i post published dal DB — nei test il DB
// non c'è, si mocka la sola query (2 post finti, uno senza date).
vi.mock("@/lib/blog", () => ({
  listPublishedPosts: vi.fn(async () => [
    {
      slug: "implied-probability-from-betting-odds",
      title: "Implied Probability",
      description: null,
      featured_image_url: null,
      pub_date: "2026-08-13T09:52:04.000Z",
      published_at: "2026-08-14T10:00:00.000Z",
    },
    {
      slug: "post-senza-date",
      title: "No dates",
      description: null,
      featured_image_url: null,
      pub_date: null,
      published_at: null,
    },
  ]),
}));

const BASE = "https://www.betredge.com";

describe("sitemap", () => {
  let entries: MetadataRoute.Sitemap;
  let urls: string[];
  beforeAll(async () => {
    entries = await sitemap();
    urls = entries.map((e) => e.url);
  });

  it("contiene gli undici tool in tutte e undici le lingue, più gli undici hub", () => {
    for (const locale of TOOL_LOCALES) {
      expect(urls, `hub ${locale}`).toContain(`${BASE}${hubPath(locale)}`);
      for (const slug of TOOL_SLUGS) {
        expect(urls, `${slug} ${locale}`).toContain(`${BASE}${toolPath(slug, locale)}`);
      }
    }
    const toolUrls = urls.filter((u) => u.includes("/tools"));
    // 11 tool × 11 lingue + 11 hub. Conteggio a mano: un tool che entra in
    // TOOL_SLUGS ma non finisce in sitemap resta invisibile ai crawler.
    expect(toolUrls).toHaveLength(132);
  });

  it("non ha URL duplicate", () => {
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("tiene le rotte pubbliche che c'erano già", () => {
    // #URL-PATHS-0810: /app è un redirect permanente, al suo posto i path del desk.
    for (const path of ["", "/predictions", "/plans", "/history", "/ai-tennis-predictions", "/ai-football-predictions", "/weekly-model-case", "/community", "/partners", "/terms", "/privacy"]) {
      expect(urls).toContain(path === "" ? BASE : `${BASE}${path}`);
    }
    expect(urls).not.toContain(`${BASE}/app`);
  });

  it("declassa /world-cup: il torneo è finito, la pagina resta come archivio", () => {
    const wc = entries.find((e) => e.url === `${BASE}/world-cup`);
    expect(wc).toBeTruthy();
    expect(wc!.changeFrequency).toBe("monthly");
  });

  // #SEO-LASTMOD-0915: Google ignora <priority> da anni. Il test è qui perché
  // il campo non rientri di soppiatto con la prossima rotta copiaincollata.
  it("non dichiara priority su nessuna URL", () => {
    const withPriority = entries.filter((e) => e.priority !== undefined);
    expect(withPriority.map((e) => e.url)).toEqual([]);
  });

  // #BLOG-SSR-0814
  it("contiene /blog e gli articoli published, con lastModified onesto", () => {
    expect(urls).toContain(`${BASE}/blog`);
    const post = entries.find(
      (e) => e.url === `${BASE}/blog/implied-probability-from-betting-odds`
    );
    expect(post).toBeTruthy();
    // published_at vince su pub_date: è la data in cui l'articolo è comparso.
    expect(post!.lastModified).toBe("2026-08-14T10:00:00.000Z");
    expect(post!.changeFrequency).toBe("monthly");
  });

  it("un post senza date entra senza lastModified (mai una data inventata)", () => {
    const post = entries.find((e) => e.url === `${BASE}/blog/post-senza-date`);
    expect(post).toBeTruthy();
    expect(post!.lastModified).toBeUndefined();
  });

  // #SEO-LASTMOD-0915 — l'audit di visibilità aveva trovato lastmod su 5 URL su
  // 150: i soli articoli. I test qui sotto presidiano la copertura piena.
  describe("lastModified", () => {
    it("c'è su ogni URL tranne i post senza data (mai una data inventata)", () => {
      const senzaData = entries
        .filter((e) => e.lastModified === undefined)
        .map((e) => e.url);
      expect(senzaData).toEqual([`${BASE}/blog/post-senza-date`]);
    });

    it("nessuna data è nel futuro", () => {
      const ora = Date.now();
      const future = entries
        .filter((e) => e.lastModified && new Date(e.lastModified).getTime() > ora)
        .map((e) => e.url);
      expect(future).toEqual([]);
    });

    it("ogni data è un ISO valido", () => {
      const invalide = entries
        .filter((e) => e.lastModified && Number.isNaN(new Date(e.lastModified).getTime()))
        .map((e) => e.url);
      expect(invalide).toEqual([]);
    });

    // Il fallback GENERATED_AT esiste per non lasciare mai un undefined, ma se
    // ci finisce una rotta vuol dire che last-modified.generated.ts è indietro
    // rispetto a sitemap.ts: va rigenerato con `npm run seo:lastmod`.
    it("nessuna rotta statica cade sul fallback: la mappa generata le copre tutte", () => {
      const scoperte = entries
        .filter((e) => !e.url.startsWith(`${BASE}/blog/`))
        .filter((e) => e.lastModified === GENERATED_AT)
        .map((e) => e.url);
      expect(scoperte).toEqual([]);
    });

    it("l'indice /blog non è più vecchio dell'articolo più recente", () => {
      const index = entries.find((e) => e.url === `${BASE}/blog`)!;
      // Il mock pubblica al 2026-08-14: l'indice deve almeno arrivarci.
      expect(new Date(index.lastModified!).getTime()).toBeGreaterThanOrEqual(
        new Date("2026-08-14T10:00:00.000Z").getTime()
      );
    });
  });
});
