/**
 * public/widget.js è il solo codice nostro che gira sul sito del partner:
 * si testa eseguendolo davvero in jsdom, non leggendone il sorgente.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// jsdom serve import.meta.url come http: → il file si risolve dalla root del repo.
const SRC = readFileSync(join(process.cwd(), "public/widget.js"), "utf8");
const ORIGIN = "https://www.betredge.com";

function addTag(attrs: Record<string, string> = {}) {
  const s = document.createElement("script");
  s.src = `${ORIGIN}/widget.js`;
  for (const [k, v] of Object.entries(attrs)) s.setAttribute(k, v);
  document.body.appendChild(s);
  return s;
}
const run = () => new Function(SRC)();

describe("widget.js", () => {
  beforeEach(() => { document.body.innerHTML = ""; });

  it("inserisce l'iframe subito dopo il proprio tag", () => {
    const tag = addTag({ "data-ref": "SERGIO" });
    run();
    const iframe = document.querySelector("iframe")!;
    expect(iframe).toBeTruthy();
    expect(tag.nextElementSibling).toBe(iframe);
    expect(iframe.getAttribute("title")).toMatch(/betredge/i);
  });

  it("passa i data-* e l'host ospite nella query", () => {
    addTag({ "data-ref": "SERGIO", "data-sport": "tennis", "data-limit": "4", "data-lang": "it", "data-theme": "dark" });
    run();
    const src = new URL(document.querySelector("iframe")!.getAttribute("src")!);
    expect(src.origin).toBe(ORIGIN);
    expect(src.pathname).toBe("/embed");
    expect(src.searchParams.get("ref")).toBe("SERGIO");
    expect(src.searchParams.get("sport")).toBe("tennis");
    expect(src.searchParams.get("limit")).toBe("4");
    expect(src.searchParams.get("lang")).toBe("it");
    expect(src.searchParams.get("theme")).toBe("dark");
    expect(src.searchParams.get("host")).toBe(window.location.hostname);
  });

  it("non lascia il widget senza sandbox né apre la navigazione dell'ospite", () => {
    addTag();
    run();
    const iframe = document.querySelector("iframe")!;
    expect(iframe.getAttribute("sandbox")).toContain("allow-scripts");
    expect(iframe.getAttribute("sandbox")).not.toContain("allow-top-navigation");
  });

  it("applica l'altezza solo se il messaggio arriva DAL suo iframe", () => {
    addTag();
    run();
    const iframe = document.querySelector("iframe") as HTMLIFrameElement;
    const before = iframe.style.height;

    // mittente estraneo: ignorato
    window.dispatchEvent(new MessageEvent("message", {
      data: { type: "betredge-embed-height", height: 900 }, origin: ORIGIN, source: window as Window & typeof globalThis,
    }));
    expect(iframe.style.height).toBe(before);

    // origin sbagliata, source giusto: ignorato
    window.dispatchEvent(new MessageEvent("message", {
      data: { type: "betredge-embed-height", height: 900 }, origin: "https://evil.example", source: iframe.contentWindow,
    }));
    expect(iframe.style.height).toBe(before);

    // messaggio legittimo: applicato
    window.dispatchEvent(new MessageEvent("message", {
      data: { type: "betredge-embed-height", height: 431 }, origin: ORIGIN, source: iframe.contentWindow,
    }));
    expect(iframe.style.height).toBe("431px");
  });

  it("clampa un'altezza assurda invece di far esplodere la pagina ospite", () => {
    addTag();
    run();
    const iframe = document.querySelector("iframe") as HTMLIFrameElement;
    window.dispatchEvent(new MessageEvent("message", {
      data: { type: "betredge-embed-height", height: 999999 }, origin: ORIGIN, source: iframe.contentWindow,
    }));
    expect(parseInt(iframe.style.height, 10)).toBeLessThanOrEqual(2000);
  });

  it("due tag nella stessa pagina producono due widget indipendenti", () => {
    addTag({ "data-sport": "tennis" });
    addTag({ "data-sport": "football" });
    run(); run();
    const iframes = [...document.querySelectorAll("iframe")];
    expect(iframes).toHaveLength(2);
    const sports = iframes.map((f) => new URL(f.getAttribute("src")!).searchParams.get("sport")).sort();
    expect(sports).toEqual(["football", "tennis"]);
  });

  it("non lascia globali sulla pagina ospite", () => {
    addTag();
    const before = new Set(Object.keys(window));
    run();
    const added = Object.keys(window).filter((k) => !before.has(k));
    expect(added).toEqual([]);
  });
});
