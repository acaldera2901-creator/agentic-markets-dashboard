import { describe, it, expect } from "vitest";
import { externalReferrerHost, sourceFromSearch } from "./attribution";

describe("sourceFromSearch — registrare da dove arriva chi arriva", () => {
  it("legge src e ref", () => {
    expect(sourceFromSearch("?src=tg-free&ref=TG3")).toEqual({ src: "tg-free", ref: "TG3" });
  });

  it("senza parametri non inventa niente", () => {
    expect(sourceFromSearch("")).toEqual({});
    expect(sourceFromSearch("?a=b")).toEqual({});
  });

  // #ATTRIB-EVERYWHERE-0915 — QUESTO test diceva il contrario: verificava che
  // `utm_campaign` venisse SCARTATO. Era la misura del buco: i link del profilo
  // Reddit, della newsletter e del widget portano utm_* da mesi, e noi ne
  // buttavamo via il contenuto all'arrivo. Ora si cattura.
  it("cattura gli utm_*: sono i tag che portano davvero i nostri link", () => {
    expect(sourceFromSearch("?utm_campaign=x&src=tg-seal")).toEqual({ src: "tg-seal", utm_campaign: "x" });
  });

  it("il link del profilo Reddit arriva intero", () => {
    expect(sourceFromSearch("?utm_source=reddit&utm_medium=profile&utm_campaign=algobetting")).toEqual({
      utm_source: "reddit",
      utm_medium: "profile",
      utm_campaign: "algobetting",
    });
  });

  it("il link della newsletter e quello del widget arrivano interi", () => {
    expect(sourceFromSearch("?utm_source=coldmail&utm_medium=email&utm_campaign=warmup")).toEqual({
      utm_source: "coldmail",
      utm_medium: "email",
      utm_campaign: "warmup",
    });
    expect(sourceFromSearch("?utm_source=widget&utm_medium=embed&utm_content=board")).toEqual({
      utm_source: "widget",
      utm_medium: "embed",
      utm_content: "board",
    });
  });

  // lib/crm-content.ts attacca `crm=<key>` a OGNI cta delle email del ciclo di
  // vita; prima di questo commit nessuno lo leggeva all'atterraggio.
  it("legge il tag crm delle email del ciclo di vita", () => {
    expect(sourceFromSearch("?crm=wb_day7_renew")).toEqual({ crm: "wb_day7_renew" });
  });

  it("ripulisce: e' testo che arriva dall'URL, non entra grezzo a DB", () => {
    expect(sourceFromSearch("?src=<script>alert(1)</script>")).toEqual({ src: "scriptalert1script" });
    expect(sourceFromSearch("?utm_source=<img onerror=x>")).toEqual({ utm_source: "imgonerrorx" });
  });

  it("taglia i valori lunghi", () => {
    expect(sourceFromSearch(`?src=${"a".repeat(200)}`).src).toHaveLength(40);
    expect(sourceFromSearch(`?utm_campaign=${"a".repeat(200)}`).utm_campaign).toHaveLength(40);
  });

  it("un valore che si svuota dopo la pulizia non si registra", () => {
    expect(sourceFromSearch("?src=%20%20")).toEqual({});
    expect(sourceFromSearch("?src=@@@")).toEqual({});
    expect(sourceFromSearch("?utm_source=@@@")).toEqual({});
  });

  it("i marcatori veri dei canali passano interi", () => {
    for (const v of ["tg-free", "tg-seal", "tg-slate", "mail-winback", "mail-wp-receipt"]) {
      expect(sourceFromSearch(`?src=${v}`).src).toBe(v);
    }
  });

  // Il cap di meta in app/api/track/route.ts è 2048 byte, e superarlo butta via
  // l'INTERO meta — anche `path`. Sette chiavi da 40 caratteri devono starci
  // comode insieme a path e ref_host, altrimenti una URL gonfiata a mano
  // spegnerebbe la misura di quella visita.
  it("il caso peggiore sta dentro il cap di 2048 byte del meta", () => {
    const long = "a".repeat(200);
    const qs = ["src", "ref", "utm_source", "utm_medium", "utm_campaign", "utm_content", "crm"]
      .map((k) => `${k}=${long}`)
      .join("&");
    const meta = { path: "/".padEnd(512, "x"), ...sourceFromSearch(`?${qs}`), ref_host: "h".repeat(80) };
    expect(Object.keys(sourceFromSearch(`?${qs}`))).toHaveLength(7);
    expect(JSON.stringify(meta).length).toBeLessThan(2048);
  });
});

describe("externalReferrerHost — solo l'host, e solo se e' esterno", () => {
  it("un referrer esterno lascia il suo host", () => {
    expect(externalReferrerHost("https://www.reddit.com/r/sportsbook/comments/abc/titolo/", "www.betredge.com"))
      .toBe("www.reddit.com");
    expect(externalReferrerHost("https://t.co/aBcD", "www.betredge.com")).toBe("t.co");
  });

  // Minimizzazione: sapere che il canale e' Reddit non richiede sapere QUALE
  // thread stesse leggendo l'utente.
  it("non registra mai il percorso, solo l'host", () => {
    const h = externalReferrerHost("https://news.ycombinator.com/item?id=123&secret=abc", "www.betredge.com");
    expect(h).toBe("news.ycombinator.com");
    expect(h).not.toContain("/");
    expect(h).not.toContain("secret");
  });

  it("il referrer interno non e' una sorgente", () => {
    expect(externalReferrerHost("https://www.betredge.com/tools", "www.betredge.com")).toBeNull();
    expect(externalReferrerHost("https://betredge.com/", "www.betredge.com")).toBeNull();
    expect(externalReferrerHost("https://www.betredge.com/", "betredge.com")).toBeNull();
  });

  it("un nostro sottodominio resta nostro", () => {
    expect(externalReferrerHost("https://news.betredge.com/x", "www.betredge.com")).toBeNull();
    expect(externalReferrerHost("https://checkout.betredge.com/x", "betredge.com")).toBeNull();
  });

  it("referrer assente o malformato: niente, mai un throw", () => {
    expect(externalReferrerHost("", "www.betredge.com")).toBeNull();
    expect(externalReferrerHost("non-una-url", "www.betredge.com")).toBeNull();
    expect(() => externalReferrerHost("://", "www.betredge.com")).not.toThrow();
  });

  it("normalizza a minuscolo e taglia gli host assurdi", () => {
    expect(externalReferrerHost("https://WWW.Reddit.COM/x", "www.betredge.com")).toBe("www.reddit.com");
    expect(externalReferrerHost(`https://${"a".repeat(200)}.com/x`, "www.betredge.com")).toHaveLength(80);
  });
});
