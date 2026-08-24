// lib/seo/indexnow.test.ts — #SEO-AEO-0825
// La chiave vive in due posti per forza (una costante TS e un file statico che
// il protocollo pretende scaricabile dalla radice). Questo test e' cio' che
// impedisce loro di divergere: senza, una chiave ruotata a meta' rende ogni
// invio un 403 che nessuno vede, perche' il cron continua a rispondere.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { INDEXNOW_KEY, extractSitemapUrls, submitToIndexNow } from "./indexnow";

describe("IndexNow", () => {
  it("il file pubblico della chiave esiste e contiene esattamente la chiave", () => {
    const path = join(process.cwd(), "public", `${INDEXNOW_KEY}.txt`);
    expect(readFileSync(path, "utf8").trim()).toBe(INDEXNOW_KEY);
  });

  it("la chiave rispetta il formato del protocollo (8-128 caratteri, [a-zA-Z0-9-])", () => {
    expect(INDEXNOW_KEY).toMatch(/^[a-zA-Z0-9-]{8,128}$/);
  });

  it("estrae le loc dalla sitemap e toglie i doppioni", () => {
    const xml = `<?xml version="1.0"?><urlset>
      <url><loc>https://www.betredge.com/</loc></url>
      <url><loc>https://www.betredge.com/tools</loc></url>
      <url><loc>https://www.betredge.com/tools</loc></url>
    </urlset>`;
    expect(extractSitemapUrls(xml)).toEqual([
      "https://www.betredge.com/",
      "https://www.betredge.com/tools",
    ]);
  });

  it("su una sitemap senza loc restituisce lista vuota, non un finto successo", () => {
    expect(extractSitemapUrls("<urlset></urlset>")).toEqual([]);
  });

  // Misurato il 25/08: con la chiave non ancora pubblicata l'endpoint risponde
  // 202 lo stesso. Se un giorno qualcuno "semplifica" ok in status < 300, e'
  // questo test a fermarlo: il cron tornerebbe a dichiarare fatto cio' che
  // Bing sta ancora per rifiutare.
  it("202 non e' una conferma: e' validazione in sospeso", async () => {
    const calls: string[] = [];
    const orig = globalThis.fetch;
    for (const [status, expectOk, expectPending] of [
      [200, true, false],
      [202, false, true],
      [403, false, false],
    ] as const) {
      globalThis.fetch = (async (url: string) => {
        calls.push(String(url));
        return new Response("", { status });
      }) as typeof fetch;
      const r = await submitToIndexNow(["https://www.betredge.com/"]);
      expect(r.status, `status ${status}`).toBe(status);
      expect(r.ok, `ok su ${status}`).toBe(expectOk);
      expect(r.pendingValidation, `pending su ${status}`).toBe(expectPending);
    }
    globalThis.fetch = orig;
    expect(calls).toHaveLength(3);
  });
});
