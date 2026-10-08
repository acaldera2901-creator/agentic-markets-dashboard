// components/v3c/fixui3.test.tsx (#REDESIGN-V3C fixui3) — regressions of QA-REPORT-3, UI and copy side:
// B3 no v3c link to the old sign-in or checkout · R1 the home FAQ says only what the site does ·
// R4 no amount in € before the visitor types · M7 no absolute www.betredge.com link in v3c copy ·
// L1 /profilo is a neutral page, not a 404 · the German board's «ENDE / Ende». Fictitious data, no DB.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { getV3cToolsCopy } from "@/lib/i18n/v3c-tools";
import { V3C_LANGS } from "@/lib/v3c/copy";
import { V3C_HOME_FAQ } from "@/lib/v3c/home-faq";
import { V3C_LIVE_COPY } from "@/lib/v3c/live-copy";
import { V3C_PAGE_PATHS } from "@/lib/v3c/pages-routes";
import { FIXUI3_COPY, amountPlaceholder, previewWordsFor } from "@/lib/v3c/fixui3-copy";
import { TOOLS, defaultValues, toolDef, toolPreview, type BoardCtx } from "@/lib/v3c/tools";
import { TOOL_SLUGS } from "@/lib/tools/registry";
import { Footer, TopBar } from "./Chrome";
import { AccountSoon } from "./pages/AccountSoon";

const ROOT = process.cwd();
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
function files(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(join(ROOT, dir))) {
    const p = join(dir, f);
    if (statSync(join(ROOT, p)).isDirectory()) files(p, out);
    else if (/\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f)) out.push(p);
  }
  return out;
}

describe("B3 · no v3c link to /plans?auth or ?checkout (Fase 0)", () => {
  for (const l of V3C_LANGS) {
    it(`${l}: header + footer`, () => {
      const c = getV3cToolsCopy(l as never);
      const html = renderToStaticMarkup(<><TopBar locale={l as never} copy={c.nav} /><Footer locale={l as never} copy={c} /></>);
      expect(html).not.toMatch(/\/plans\?|[?&]auth=|[?&]checkout=/);
    });
  }
  it("no v3c source (components/v3c, app/v3c) writes or imports a sign-in / checkout href", () => {
    const hits = [...files("components/v3c"), ...files("app/v3c")].filter((p) => {
      const s = readFileSync(join(ROOT, p), "utf8").replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, "");
      return /\/plans\?|SIGN_IN_HREF|PRO_CHECKOUT_HREF|FREE_SIGNUP_HREF/.test(s);
    });
    expect(hits).toEqual([]);
  });
});

describe("R1 · the home FAQ says only what the site does", () => {
  it("≤ 22 words per answer in EN and IT too (the parity test covers the other 9)", () => {
    for (const l of ["en", "it"] as const) for (const [q, a] of V3C_HOME_FAQ[l]) expect(words(a), `${l}: ${q}`).toBeLessThanOrEqual(22);
  });
  it("no in-play model, no «all sealed», no open «Pro features», no «three outcomes» — in 11 languages", () => {
    const all = JSON.stringify(V3C_HOME_FAQ);
    expect(all).not.toMatch(/reads the game|rilegge|liest das Spiel|all of them sealed|tutti sigillati|alle vor dem Anstoß versiegelt|Pro features included|funzioni Pro comprese|Live is a Pro feature|three outcomes|tre gli esiti/i);
  });
  it("live = a score, numbers from before kick-off; tennis estimate not sealed", () => {
    const en = V3C_HOME_FAQ.en.map(([, a]) => a).join(" ");
    expect(en).toContain("A live score updates while the match is on; our market and estimate numbers are from before kick-off.");
    expect(en).toMatch(/Tennis: the estimate shown isn’t sealed yet/);
  });
});

const ctx: BoardCtx = {
  outcomes: [
    { price: 2.15, estimate: 48, market: 46, prices: { a: 2.2 } },
    { price: 3.2, estimate: 27, market: 30, prices: { a: 3.25 } },
    { price: 3.55, estimate: 25, market: 24, prices: { a: 3.6 } },
  ],
  lead: { price: 2.15, estimate: 48, market: 46, prices: { a: 2.2 }, label: "Home" },
};

describe("R4 · tools: no amount in € before the visitor types", () => {
  it("every money input starts empty, and so does every input of the record tools", () => {
    for (const t of TOOLS) for (const i of t.inputs) if (i.kind === "money" || i.kind === "signed") expect(i.default, `${t.slug}.${i.key}`).toBeNull();
    expect(toolDef("yield-calculator").inputs.every((i) => i.default == null)).toBe(true);
  });
  it("on the defaults, no result carries «€»; stake, ROI and yield wait for the visitor", () => {
    for (const t of TOOLS) expect(JSON.stringify(t.compute(defaultValues(t))), t.slug).not.toContain("€");
    for (const s of ["stake-calculator", "roi-calculator", "yield-calculator"] as const) expect(toolDef(s).compute(defaultValues(toolDef(s)))).toEqual([]);
    // arbitrage: the margin from the prices, the stakes only with the visitor's total
    const arb = toolDef("arbitrage-calculator");
    expect(arb.compute(defaultValues(arb)).map((r) => r.key)).toEqual(["shortfall", "sum"]);
    expect(arb.compute({ ...defaultValues(arb), total: 100 }).filter((r) => r.key === "stake")).toHaveLength(3);
  });
  it("the board prefill brings prices and probabilities, never an amount", () => {
    for (const t of TOOLS) {
      const v = t.fromBoard(ctx);
      for (const i of t.inputs) if (i.kind === "money" || i.kind === "signed") expect(v[i.key] ?? null, `${t.slug}.${i.key}`).toBeNull();
    }
  });
  it("the previews (hub, bench, OG) carry no «€»; the money ones say «e.g.»", () => {
    for (const s of TOOL_SLUGS) {
      const p = toolPreview(s, ctx);
      expect(p.input + p.output, s).not.toContain("€");
    }
    expect(toolPreview("stake-calculator", ctx).input).toBe("e.g. 100 at 2.15");
    expect(toolPreview("roi-calculator", ctx)).toMatchObject({ input: "e.g. 400 on 1,000", output: "+40.0%" });
    for (const t of TOOLS) if (t.column) expect(JSON.stringify(t.column(ctx)), t.slug).not.toContain("€");
  });
  it("the preview words are translated («at» was English in every language)", () => {
    // fixq Q5: EV reads the best book price (2.20), never the composite 2.15
    expect(toolPreview("ev-calculator", ctx, previewWordsFor("de")).input).toBe("2.20 bei 48%");
    expect(toolPreview("yield-calculator", ctx, previewWordsFor("it")).input).toBe("es. 200 scommesse · 50");
    for (const l of V3C_LANGS.filter((x) => x !== "en")) expect(FIXUI3_COPY[l].at, l).not.toBe("at");
  });
  it("the empty amount field shows a hint, never a value: «e.g. 10»", () => {
    expect(amountPlaceholder("en")).toBe("e.g. 10");
    expect(amountPlaceholder("de")).toBe("z. B. 10");
  });
});

describe("M7 · no absolute www.betredge.com link in v3c copy", () => {
  it("v3c dictionaries, tool copy and FAQ: relative links only (an e-mail address is not a link)", () => {
    const sources = [
      ...readdirSync(join(ROOT, "lib/v3c")).filter((f) => /copy|faq|seo/.test(f) && !/\.test\./.test(f)).map((f) => `lib/v3c/${f}`),
      ...readdirSync(join(ROOT, "lib/i18n/v3c-tools")).filter((f) => !/\.test\./.test(f)).map((f) => `lib/i18n/v3c-tools/${f}`),
      ...readdirSync(join(ROOT, "lib/tools/copy")).map((f) => `lib/tools/copy/${f}`),
      "lib/learn-links.ts",
    ];
    const hits = sources.filter((p) => /https?:\/\/(www\.)?betredge\.com/i.test(readFileSync(join(ROOT, p), "utf8")));
    expect(hits).toEqual([]);
  });
});

describe("L1 · /profilo with the redesign on", () => {
  it("stays a v3c route, and shows «Account: coming with Pro» with no sign-in link", () => {
    expect(V3C_PAGE_PATHS).toContain("/profilo");
    const html = renderToStaticMarkup(<AccountSoon />);
    expect(html).toContain("Account: coming with Pro.");
    expect(html).toContain('href="/pricing"');
    expect(html).not.toMatch(/\/plans|auth=|checkout=/);
  });
});

describe("live · a finished match does not say «end» twice", () => {
  it("in every language the FT tag differs from the short «finished» word", () => {
    for (const l of V3C_LANGS) {
      const c = V3C_LIVE_COPY[l];
      expect(c.ft.toLowerCase(), l).not.toBe(c.finishedShort.toLowerCase());
    }
  });
});
