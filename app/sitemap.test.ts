// app/sitemap.test.ts (#TOOLS-HUB-0805)
// La sitemap è l'unico invito che diamo ai crawler: 66 pagine nuove che non
// compaiono lì restano scoperte per settimane.

import { describe, it, expect } from "vitest";
import sitemap from "./sitemap";
import { TOOL_LOCALES, TOOL_SLUGS, hubPath, toolPath } from "@/lib/tools/registry";

const BASE = "https://www.betredge.com";

describe("sitemap", () => {
  const entries = sitemap();
  const urls = entries.map((e) => e.url);

  it("contiene i sei tool in tutte e undici le lingue, più gli undici hub", () => {
    for (const locale of TOOL_LOCALES) {
      expect(urls, `hub ${locale}`).toContain(`${BASE}${hubPath(locale)}`);
      for (const slug of TOOL_SLUGS) {
        expect(urls, `${slug} ${locale}`).toContain(`${BASE}${toolPath(slug, locale)}`);
      }
    }
    const toolUrls = urls.filter((u) => u.includes("/tools"));
    // 6 tool × 11 lingue + 11 hub. Conteggio a mano: un tool che entra in
    // TOOL_SLUGS ma non finisce in sitemap resta invisibile ai crawler.
    expect(toolUrls).toHaveLength(77);
  });

  it("non ha URL duplicate", () => {
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("tiene le rotte pubbliche che c'erano già", () => {
    for (const path of ["", "/app", "/weekly-pick", "/community", "/partners", "/terms", "/privacy"]) {
      expect(urls).toContain(path === "" ? BASE : `${BASE}${path}`);
    }
  });

  it("declassa /world-cup: il torneo è finito, la pagina resta come archivio", () => {
    const wc = entries.find((e) => e.url === `${BASE}/world-cup`);
    expect(wc).toBeTruthy();
    expect(wc!.changeFrequency).toBe("monthly");
    expect(wc!.priority).toBeLessThanOrEqual(0.3);
  });

  it("dà agli hub una priorità maggiore delle singole pagine-tool", () => {
    const hub = entries.find((e) => e.url === `${BASE}/tools`)!;
    const tool = entries.find((e) => e.url === `${BASE}/tools/kelly-criterion`)!;
    expect(hub.priority!).toBeGreaterThan(tool.priority!);
  });

  it("dà alle pagine inglesi priorità maggiore che alle tradotte (canonical)", () => {
    const en = entries.find((e) => e.url === `${BASE}/tools/kelly-criterion`)!;
    const it = entries.find((e) => e.url === `${BASE}/it/tools/kelly-criterion`)!;
    expect(en.priority!).toBeGreaterThan(it.priority!);
  });
});
