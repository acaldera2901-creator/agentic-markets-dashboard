import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { SeoProse } from "@/components/seo/SeoProse";
import { PREDICTIONS_FAQ, PREDICTIONS_INTRO } from "./predictions-faq";

const html = renderToStaticMarkup(createElement(SeoProse, { heading: "How to read a BetRedge prediction", intro: PREDICTIONS_INTRO, faq: PREDICTIONS_FAQ }));
const jsonLd = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)![1].replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&"));

describe("/predictions short answers (FAQ)", () => {
  it("every Q&A is VISIBLE in the server HTML and in the FAQPage JSON-LD (one source, no schema-only answers)", () => {
    expect(jsonLd["@type"]).toBe("FAQPage");
    expect(jsonLd.mainEntity).toHaveLength(PREDICTIONS_FAQ.length);
    PREDICTIONS_FAQ.forEach(([q, a], i) => {
      const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/'/g, "&#x27;");
      expect(html).toContain(esc(q)); expect(html).toContain(esc(a));
      expect(jsonLd.mainEntity[i].name).toBe(q); expect(jsonLd.mainEntity[i].acceptedAnswer.text).toBe(a);
    });
  });
  it("answer-first and short: each answer ≤ 60 words, questions end with ?", () => {
    for (const [q, a] of PREDICTIONS_FAQ) { expect(q.endsWith("?")).toBe(true); expect(a.split(/\s+/).length).toBeLessThanOrEqual(60); }
  });
  it("no forbidden claims or performance numbers (only the mandated «not a guarantee» phrase may mention a guarantee)", () => {
    const text = [...PREDICTIONS_INTRO, ...PREDICTIONS_FAQ.flat()].join(" ").replace(/not a guarantee/gi, "");
    expect(text).not.toMatch(/\bROI\b|win[- ]?rate|hit[- ]?rate|\bCLV\b|guarantee|\block\b|sure[- ]?win|best odds|beat the market|VPN|—/i);
    expect(text).not.toMatch(/\d+(\.\d+)?\s?%/); // percentages only as words («60 percent» example), never a performance figure
  });
  it("states the product is analysis, not a guarantee", () => expect(PREDICTIONS_INTRO.join(" ")).toMatch(/not a guarantee/i));
});
