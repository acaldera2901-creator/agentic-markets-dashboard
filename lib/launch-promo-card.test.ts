// #LAUNCH-PROMO-CARD-0805 — la promo -50% non deve più spegnere il rail carta.
//
// Prima: `app/api/shopify/checkout` rispondeva 503 su ENTRAMBI i rami quando la
// promo era attiva (il prezzo del selling plan Shopify è fisso e non poteva
// riflettere lo sconto) e il client cadeva in silenzio su PayGate. Risultato: per
// tutto il mese di lancio chi aveva diritto allo sconto — cioè tutti i nuovi
// clienti, il target della promo — poteva pagare SOLO in crypto.
//
// Ora lo sconto viaggia su un secondo selling plan che sconta il solo PRIMO ciclo
// (`fixed` + `recurring afterCycle:1`, primitivo nativo Shopify) e, per la Weekly
// Pick che è un one-off, su una variante a metà prezzo.
//
// La proprietà che questi test difendono più di ogni altra: **senza gli id di
// lancio configurati non cambia NIENTE**, e non esiste nessun percorso che mostri
// metà prezzo e addebiti il pieno.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  buildShopifyCheckoutUrl,
  shopifyCanCarryLaunchDiscount,
  isWeeklyPickVariant,
  resolveOrderFromVariant,
} from "./shopify";

const ENV = { ...process.env };

beforeEach(() => {
  process.env.SHOPIFY_SHOP_DOMAIN = "shop.example.com";
  process.env.SHOPIFY_VARIANT_BASE = "100";
  process.env.SHOPIFY_VARIANT_PREMIUM = "200";
  process.env.SHOPIFY_VARIANT_BASE_ANNUAL = "300";
  process.env.SHOPIFY_VARIANT_PREMIUM_ANNUAL = "400";
  process.env.SHOPIFY_VARIANT_WEEKLY = "500";
  process.env.SHOPIFY_SELLING_PLAN_BASE = "777";
  process.env.SHOPIFY_SELLING_PLAN_PREMIUM = "778";
  process.env.SHOPIFY_SELLING_PLAN_ANNUAL = "888";
  delete process.env.SHOPIFY_SELLING_PLAN_BASE_LAUNCH;
  delete process.env.SHOPIFY_SELLING_PLAN_PREMIUM_LAUNCH;
  delete process.env.SHOPIFY_SELLING_PLAN_ANNUAL_LAUNCH;
  delete process.env.SHOPIFY_VARIANT_WEEKLY_LAUNCH;
});

afterEach(() => {
  process.env = { ...ENV };
});

const params = (url: string) => new URLSearchParams(url.split("return_to=")[1] ? decodeURIComponent(url.split("return_to=")[1]).split("?")[1] : "");

describe("senza gli id di lancio: NIENTE cambia (fail-safe)", () => {
  it("shopifyCanCarryLaunchDiscount è false per ogni SKU", () => {
    expect(shopifyCanCarryLaunchDiscount("base", "monthly")).toBe(false);
    expect(shopifyCanCarryLaunchDiscount("premium", "monthly")).toBe(false);
    expect(shopifyCanCarryLaunchDiscount("base", "annual")).toBe(false);
    expect(shopifyCanCarryLaunchDiscount("premium", "annual")).toBe(false);
    expect(shopifyCanCarryLaunchDiscount("weekly")).toBe(false);
  });

  it("un checkout SCONTATO non viene nemmeno costruito", () => {
    // È la garanzia che conta: null → la rotta fa 503 → il client cade su
    // PayGate, cioè il comportamento di prima della patch.
    expect(buildShopifyCheckoutUrl("base", "a@b.com", "monthly", "it", true)).toBeNull();
    expect(buildShopifyCheckoutUrl("premium", "a@b.com", "annual", "it", true)).toBeNull();
    expect(buildShopifyCheckoutUrl("weekly", "a@b.com", "monthly", "it", true)).toBeNull();
  });

  it("il checkout a prezzo PIENO resta identico", () => {
    const url = buildShopifyCheckoutUrl("base", "a@b.com", "monthly", "it", false);
    expect(url).toBeTruthy();
    expect(params(url!).get("selling_plan")).toBe("777");
    expect(params(url!).get("id")).toBe("100");
  });
});

describe("con gli id di lancio: il rail carta porta lo sconto", () => {
  beforeEach(() => {
    process.env.SHOPIFY_SELLING_PLAN_BASE_LAUNCH = "777L";
    process.env.SHOPIFY_SELLING_PLAN_PREMIUM_LAUNCH = "778L";
    process.env.SHOPIFY_SELLING_PLAN_ANNUAL_LAUNCH = "888L";
    process.env.SHOPIFY_VARIANT_WEEKLY_LAUNCH = "500L";
  });

  it("il piano scontato usa il selling plan di lancio, sulla STESSA variante", () => {
    const url = buildShopifyCheckoutUrl("base", "a@b.com", "monthly", "it", true)!;
    expect(params(url).get("selling_plan")).toBe("777L");
    // La variante NON cambia: è il punto che tiene in piedi il webhook.
    expect(params(url).get("id")).toBe("100");
  });

  it("premium e annuale hanno il loro plan di lancio", () => {
    expect(params(buildShopifyCheckoutUrl("premium", "a@b.com", "monthly", "it", true)!).get("selling_plan")).toBe("778L");
    expect(params(buildShopifyCheckoutUrl("base", "a@b.com", "annual", "it", true)!).get("selling_plan")).toBe("888L");
    expect(params(buildShopifyCheckoutUrl("premium", "a@b.com", "annual", "it", true)!).get("selling_plan")).toBe("888L");
  });

  it("la weekly scontata usa la VARIANTE di lancio e nessun selling plan", () => {
    const url = buildShopifyCheckoutUrl("weekly", "a@b.com", "monthly", "it", true)!;
    expect(params(url).get("id")).toBe("500L");
    // Passare un selling plan la trasformerebbe in un addebito ricorrente.
    expect(params(url).get("selling_plan")).toBeNull();
  });

  it("a prezzo pieno si torna a plan e variante normali", () => {
    expect(params(buildShopifyCheckoutUrl("base", "a@b.com", "monthly", "it", false)!).get("selling_plan")).toBe("777");
    expect(params(buildShopifyCheckoutUrl("weekly", "a@b.com", "monthly", "it", false)!).get("id")).toBe("500");
  });
});

describe("configurazione PARZIALE: si sconta solo ciò che lo store sa incassare", () => {
  it("un plan di lancio non blocca né abilita gli altri", () => {
    process.env.SHOPIFY_SELLING_PLAN_BASE_LAUNCH = "777L";
    expect(shopifyCanCarryLaunchDiscount("base", "monthly")).toBe(true);
    expect(shopifyCanCarryLaunchDiscount("premium", "monthly")).toBe(false);
    expect(shopifyCanCarryLaunchDiscount("base", "annual")).toBe(false);
    // e il premium scontato non viene costruito
    expect(buildShopifyCheckoutUrl("premium", "a@b.com", "monthly", "it", true)).toBeNull();
    expect(buildShopifyCheckoutUrl("base", "a@b.com", "monthly", "it", true)).toBeTruthy();
  });

  it("la variante weekly di lancio è indipendente dai piani", () => {
    process.env.SHOPIFY_VARIANT_WEEKLY_LAUNCH = "500L";
    expect(shopifyCanCarryLaunchDiscount("weekly")).toBe(true);
    expect(shopifyCanCarryLaunchDiscount("base", "monthly")).toBe(false);
  });
});

describe("la trappola che avrebbe fatto pagare senza concedere nulla", () => {
  it("il webhook riconosce la variante weekly DI LANCIO come weekly", () => {
    process.env.SHOPIFY_VARIANT_WEEKLY_LAUNCH = "500L";
    expect(isWeeklyPickVariant("500")).toBe(true);
    expect(isWeeklyPickVariant("500L")).toBe(true);
    // Se non lo facesse, la riga risulterebbe SCONOSCIUTA → `unresolved` +
    // alert e nessun entitlement: il cliente paga la weekly scontata e non
    // riceve niente.
  });

  it("la variante weekly di lancio non viene confusa con un PIANO", () => {
    process.env.SHOPIFY_VARIANT_WEEKLY_LAUNCH = "500L";
    expect(resolveOrderFromVariant("500L")).toBeNull();
    expect(resolveOrderFromVariant("500")).toBeNull();
  });

  it("senza la variante di lancio configurata non riconosce id inventati", () => {
    expect(isWeeklyPickVariant("500L")).toBe(false);
    expect(isWeeklyPickVariant("500")).toBe(true);
    expect(isWeeklyPickVariant(null)).toBe(false);
    expect(isWeeklyPickVariant(undefined)).toBe(false);
  });

  it("una variante vuota in env non fa combaciare tutto", () => {
    // Il vecchio codice usciva presto su `!weekly`; con due variabili il rischio
    // è che una stringa vuota renda `String(x) === ""` vero per un id assente.
    process.env.SHOPIFY_VARIANT_WEEKLY = "";
    process.env.SHOPIFY_VARIANT_WEEKLY_LAUNCH = "";
    expect(isWeeklyPickVariant("")).toBe(false);
    expect(isWeeklyPickVariant("500")).toBe(false);
  });
});
