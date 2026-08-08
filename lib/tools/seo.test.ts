// lib/tools/seo.test.ts (#TOOLS-HUB-0805)
// Il senso delle 55 pagine è l'indicizzazione: se canonical e hreflang sono
// sbagliati, Google vede 11 pagine duplicate invece di 11 traduzioni. Questo
// test è l'unica cosa che sta fra noi e quell'errore.

import { describe, it, expect } from "vitest";
import { hubMetadata, toolMetadata, toolJsonLd, hubJsonLd } from "./seo";
import { TOOL_LOCALES, TOOL_SLUGS } from "./registry";
import { getToolsCopy } from "./copy";

describe("metadata di un tool", () => {
  it("prende titolo e descrizione dal dizionario del locale", () => {
    const en = getToolsCopy("en").tools["kelly-criterion"];
    const m = toolMetadata("kelly-criterion", "en");
    expect(m.title).toBe(en.metaTitle);
    expect(m.description).toBe(en.metaDescription);
  });

  it("il canonical è assoluto e cambia con la lingua", () => {
    expect(toolMetadata("kelly-criterion", "en").alternates?.canonical).toBe(
      "https://www.betredge.com/tools/kelly-criterion"
    );
    expect(toolMetadata("kelly-criterion", "it").alternates?.canonical).toBe(
      "https://www.betredge.com/it/tools/kelly-criterion"
    );
  });

  it("dichiara tutte e undici le lingue più x-default sull'inglese", () => {
    const langs = toolMetadata("ev-calculator", "de").alternates?.languages as Record<string, string>;
    for (const locale of TOOL_LOCALES) {
      expect(langs[locale], `hreflang ${locale}`).toBeTruthy();
    }
    expect(Object.keys(langs)).toHaveLength(TOOL_LOCALES.length + 1);
    expect(langs["x-default"]).toBe("https://www.betredge.com/tools/ev-calculator");
    expect(langs.it).toBe("https://www.betredge.com/it/tools/ev-calculator");
    expect(langs.en).toBe("https://www.betredge.com/tools/ev-calculator");
  });

  it("gli hreflang sono reciproci: ogni lingua punta alle stesse 11 URL", () => {
    const fromEn = toolMetadata("odds-converter", "en").alternates?.languages;
    const fromRu = toolMetadata("odds-converter", "ru").alternates?.languages;
    expect(fromRu).toEqual(fromEn);
  });

  it("porta og:url coerente col canonical", () => {
    const m = toolMetadata("margin-calculator", "fr");
    expect(m.openGraph?.url).toBe("https://www.betredge.com/fr/tools/margin-calculator");
  });

  it("copre tutti e cinque i tool in tutte e undici le lingue senza buchi", () => {
    for (const slug of TOOL_SLUGS) {
      for (const locale of TOOL_LOCALES) {
        const m = toolMetadata(slug, locale);
        expect(typeof m.title, `${slug}/${locale}`).toBe("string");
        expect((m.title as string).length).toBeGreaterThan(10);
        expect(m.alternates?.canonical).toContain("/tools/");
      }
    }
  });
});

describe("metadata dell'hub", () => {
  it("ha canonical e hreflang propri", () => {
    expect(hubMetadata("en").alternates?.canonical).toBe("https://www.betredge.com/tools");
    expect(hubMetadata("sv").alternates?.canonical).toBe("https://www.betredge.com/sv/tools");
    const langs = hubMetadata("sv").alternates?.languages as Record<string, string>;
    expect(langs["x-default"]).toBe("https://www.betredge.com/tools");
    expect(langs.pl).toBe("https://www.betredge.com/pl/tools");
  });
});

describe("JSON-LD", () => {
  it("un tool dichiara WebApplication gratuita e FAQPage", () => {
    const [app, faq] = toolJsonLd("kelly-criterion", "en") as Record<string, unknown>[];
    expect(app["@type"]).toBe("WebApplication");
    expect(app.url).toBe("https://www.betredge.com/tools/kelly-criterion");
    expect((app.offers as Record<string, unknown>).price).toBe("0");
    expect(app.inLanguage).toBe("en");

    expect(faq["@type"]).toBe("FAQPage");
    const questions = faq.mainEntity as Record<string, unknown>[];
    expect(questions).toHaveLength(getToolsCopy("en").tools["kelly-criterion"].faq.length);
    expect(questions[0]["@type"]).toBe("Question");
    expect((questions[0].acceptedAnswer as Record<string, unknown>)["@type"]).toBe("Answer");
  });

  it("il JSON-LD segue la lingua della pagina", () => {
    const [app] = toolJsonLd("ev-calculator", "it") as Record<string, unknown>[];
    expect(app.inLanguage).toBe("it");
    expect(app.name).toBe(getToolsCopy("it").tools["ev-calculator"].h1);
  });

  it("l'hub elenca i sei tool in ordine", () => {
    const ld = hubJsonLd("en") as Record<string, unknown>;
    expect(ld["@type"]).toBe("ItemList");
    const items = ld.itemListElement as Record<string, unknown>[];
    expect(items).toHaveLength(6);
    expect(items[0].position).toBe(1);
    expect(items[0].url).toBe("https://www.betredge.com/tools/odds-converter");
  });

  it("è serializzabile: niente undefined nel JSON", () => {
    const json = JSON.stringify(toolJsonLd("probability-calculator", "tr"));
    expect(json).not.toContain("undefined");
    expect(json).not.toContain("null");
  });
});
