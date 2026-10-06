// #REDESIGN-V3C pages — le regole pure delle pagine News · Books · Pro · Metodo.
import { describe, expect, it } from "vitest";
import { v3cRedirects } from "./redirects";
import { checkoutRails, launchPromo, proPlan } from "./plans";
import { PUBLIC_PAID_PLANS } from "@/lib/commercial-plan";
import { PAYGATE_PRICES } from "@/lib/paygate";
import { paywallApplies, usd } from "./paywall";
import { checkoutDeepLink, PRO_CHECKOUT_HREF } from "./checkout-link";
import { booksData, hhmmUtc } from "./books";
import { readingMinutes } from "./news";
import { PAGES_COPY, pagesCopyFor } from "./pages-copy";
import { V3C_LANGS } from "./copy";
import { COMMUNITY_SEO, COMMUNITY_SEO_V3C } from "@/app/community/seo";
import type { V3BoardResponse } from "./contracts";

describe("/plans → /pricing", () => {
  it("flag spento: nessun redirect (il sito resta identico)", () => {
    for (const f of [undefined, null, "", "0", "false"]) expect(v3cRedirects(f)).toEqual([]);
  });
  it("flag acceso: 308 permanente, ma non quando porta al checkout o al login", () => {
    const [r] = v3cRedirects("1");
    expect(r).toMatchObject({ source: "/plans", destination: "/pricing", permanent: true });
    expect(r.missing?.map((m) => m.key).sort()).toEqual(["auth", "checkout"]);
  });
});

describe("piano Pro", () => {
  it("prezzo mensile = premium di lib/commercial-plan, annuale solo col rail carta", () => {
    expect(proPlan({}).monthly).toBe(PUBLIC_PAID_PLANS.premium.amountUsdt);
    expect(proPlan({}).annual).toBeNull();
    expect(proPlan({ NEXT_PUBLIC_PAYGATE_ENABLED: "true" }).annual).toBe(PAYGATE_PRICES.premium.annual);
    expect(proPlan({}).key).toBe("premium");
  });
  it("rail = quelli che il CheckoutModal mostra", () => {
    expect(checkoutRails({})).toEqual(["usdt"]);
    expect(checkoutRails({ NEXT_PUBLIC_PAYGATE_ENABLED: "true", NEXT_PUBLIC_SHOPIFY_CRYPTO_ENABLED: "true", NEXT_PUBLIC_PAYPAL_CLIENT_ID: "x" })).toEqual(["card", "crypto", "paypal"]);
  });
  it("promo: solo una data vera e futura, mai un countdown", () => {
    const now = new Date("2026-10-06T00:00:00Z");
    expect(launchPromo({}, now)).toBeNull();
    expect(launchPromo({ NEXT_PUBLIC_LAUNCH_PROMO_ENABLED: "true", NEXT_PUBLIC_LAUNCH_PROMO_DEADLINE: "boh" }, now)).toBeNull();
    expect(launchPromo({ NEXT_PUBLIC_LAUNCH_PROMO_ENABLED: "true", NEXT_PUBLIC_LAUNCH_PROMO_DEADLINE: "2026-10-01T00:00:00Z" }, now)).toBeNull();
    expect(launchPromo({ NEXT_PUBLIC_LAUNCH_PROMO_ENABLED: "true", NEXT_PUBLIC_LAUNCH_PROMO_DEADLINE: "2026-10-31T00:00:00Z" }, now)).toEqual({ until: "2026-10-31" });
  });
  it("deep link al checkout: solo premium, Base non si vende più", () => {
    expect(checkoutDeepLink("?checkout=premium")).toBe("premium");
    expect(checkoutDeepLink("?checkout=base")).toBeNull();
    expect(checkoutDeepLink("")).toBeNull();
    expect(PRO_CHECKOUT_HREF).toBe("/plans?checkout=premium");
    expect(usd(29.99)).toBe("$29.99");
  });
});

describe("paywall «why»", () => {
  it("mai su un gap ~0, mai senza mercato, mai senza fattori", () => {
    expect(paywallApplies(null, 3)).toBe(false);
    expect(paywallApplies(0, 3)).toBe(false);
    expect(paywallApplies(1.49, 3)).toBe(false);
    expect(paywallApplies(-1.49, 3)).toBe(false);
    expect(paywallApplies(NaN, 3)).toBe(false);
    expect(paywallApplies(2, 0)).toBe(false);
    expect(paywallApplies(2, 3)).toBe(true);
    expect(paywallApplies(-4, 1)).toBe(true);
  });
});

const board = (matches: unknown[], tennis: unknown[] = []) => ({ matches, tennis }) as unknown as V3BoardResponse;
const bp = (bookmaker: string, price: number, captured_at = "2026-10-06T12:00:00Z") => ({ bookmaker, name: bookmaker, price, captured_at });

describe("Books: il confronto prezzi", () => {
  const now = new Date("2026-10-06T10:00:00Z");
  it("solo partite future, esito guida, solo dove un book ha un prezzo; il migliore è il più alto", () => {
    const d = booksData(
      board([
        { id: "a", home: "Alfa", away: "Beta", kickoff: "2026-10-06T18:00:00Z", focus: "home", outcomes: [{ outcome: "home", book_prices: [bp("x", 2.1), bp("y", 2.2, "2026-10-06T13:05:00Z")] }] },
        { id: "b", home: "Gamma", away: "Delta", kickoff: "2026-10-05T18:00:00Z", focus: "home", outcomes: [{ outcome: "home", book_prices: [bp("x", 2)] }] },
        { id: "c", home: "Eta", away: "Teta", kickoff: "2026-10-07T18:00:00Z", focus: "draw", outcomes: [{ outcome: "draw", book_prices: [] }] },
      ]),
      now,
    );
    expect(d.rows.map((r) => r.id)).toEqual(["a"]);
    expect(d.rows[0]).toMatchObject({ outcome: "Alfa", best: "y" });
    expect(d.bestCount).toEqual({ y: 1 });
    const tie = booksData(board([{ id: "t", home: "A", away: "B", kickoff: "2026-10-06T18:00:00Z", focus: "home", outcomes: [{ outcome: "home", book_prices: [bp("x", 1.42), bp("y", 1.42)] }] }]), now);
    expect(tie.rows[0].best).toBeNull();
    expect(tie.bestCount).toEqual({});
    expect(d.priced).toBe(1);
    expect(hhmmUtc(d.checkedAt)).toBe("13:05 UTC");
  });
  it("un prezzo non valido non entra mai", () => {
    const d = booksData(board([{ id: "a", home: "A", away: "B", kickoff: "2026-10-06T18:00:00Z", focus: "home", outcomes: [{ outcome: "home", book_prices: [bp("x", 1), bp("y", NaN)] }] }]), now);
    expect(d.rows).toEqual([]);
    expect(d.checkedAt).toBeNull();
  });
});

describe("News", () => {
  it("minuti di lettura dal testo vero, mai meno di 1", () => {
    expect(readingMinutes("<p>ciao</p>")).toBe(1);
    expect(readingMinutes(`<p>${"parola ".repeat(690)}</p>`)).toBe(3);
  });
});

// Ogni stringa, funzioni comprese (chiamate con argomenti tipici).
function strings(v: unknown): string[] {
  if (typeof v === "string") return [v];
  if (typeof v === "function") return [String((v as (...a: unknown[]) => unknown)("$29.99", 12))];
  if (Array.isArray(v)) return v.flatMap(strings);
  if (v && typeof v === "object") return Object.values(v).flatMap(strings);
  return [];
}

describe("copy delle pagine", () => {
  for (const lang of V3C_LANGS) {
    const all = strings(PAGES_COPY[lang]);
    it(`${lang}: ≤22 parole per elemento`, () => {
      expect(all.filter((s) => s.split(/\s+/).filter(Boolean).length > 22)).toEqual([]);
    });
    it(`${lang}: lessico onesto e nessun piano Base`, () => {
      const banned = /beat(ing)? the market|\bROI\b|\bCLV\b|hit.?rate|guarantee|garantit|\block\b|sure win|easy money|crush|\bBase\b/i;
      expect(all.filter((s) => banned.test(s))).toEqual([]);
    });
  }
  it("ogni lingua ha la sua copy (F10); una lingua sconosciuta legge l'inglese", () => {
    expect(pagesCopyFor("de")).toBe(PAGES_COPY.de);
    expect(pagesCopyFor("ja")).toBe(PAGES_COPY.en);
    expect(pagesCopyFor("it-IT")).toBe(PAGES_COPY.it);
  });
});

describe("/community a flag acceso", () => {
  it("la FAQ v3c non nomina il piano Base; il resto è identico", () => {
    expect(JSON.stringify(COMMUNITY_SEO_V3C)).not.toMatch(/\bBase\b/);
    expect(COMMUNITY_SEO_V3C.faq.length).toBe(COMMUNITY_SEO.faq.length);
    expect(COMMUNITY_SEO_V3C.intro).toEqual(COMMUNITY_SEO.intro);
    expect(COMMUNITY_SEO_V3C.faq.slice(0, 3)).toEqual(COMMUNITY_SEO.faq.slice(0, 3));
  });
});
