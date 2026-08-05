// #LAUNCH-SETUP-0805 — la parte del "−50% solo sul primo ciclo" coperta da
// test è QUESTA: la forma esatta delle pricing policy e l'idempotenza del
// one-off. Che lo store poi applichi davvero il pieno dal 2° addebito lo
// verifica l'ordine di prova reale, non un test.
import { describe, it, expect } from "vitest";
import {
  ensureLaunchSetup,
  launchGroupInput,
  numericId,
  toVariantGid,
  LAUNCH_MERCHANT_CODE,
  WEEKLY_LAUNCH_PRICE,
  type Gql,
  type LaunchSetupEnv,
} from "./shopify-launch-setup";

const ENV: LaunchSetupEnv = {
  variantBase: "111",
  variantPremium: "222",
  variantBaseAnnual: "333",
  variantPremiumAnnual: "444",
  variantWeekly: "555",
};

function groupNode(code: string, planId: string) {
  return { id: `gid://shopify/SellingPlanGroup/9`, merchantCode: code, sellingPlans: { nodes: [{ id: `gid://shopify/SellingPlan/${planId}` }] } };
}

const WEEKLY_PRODUCT = {
  productVariant: {
    id: toVariantGid("555"),
    product: {
      id: "gid://shopify/Product/77",
      options: [{ name: "Title" }],
      variants: {
        nodes: [
          {
            id: toVariantGid("555"),
            title: "Default Title",
            price: "12.99",
            selectedOptions: [{ name: "Title", value: "Default Title" }],
          },
        ],
      },
    },
  },
};

// Un fake gql che registra le chiamate e risponde per forma della query.
function fakeGql(state: {
  existingGroups?: ReturnType<typeof groupNode>[];
  weeklyProduct?: unknown;
  calls: Array<{ query: string; variables?: Record<string, unknown> }>;
  planSeq?: number;
}): Gql {
  return (async (query: string, variables?: Record<string, unknown>) => {
    state.calls.push({ query, variables });
    if (query.includes("sellingPlanGroups(")) {
      return { sellingPlanGroups: { nodes: state.existingGroups ?? [] } };
    }
    if (query.includes("sellingPlanGroupCreate")) {
      const input = variables?.input as { merchantCode: string };
      state.planSeq = (state.planSeq ?? 0) + 1;
      return {
        sellingPlanGroupCreate: {
          sellingPlanGroup: groupNode(input.merchantCode, `90${state.planSeq}`),
          userErrors: [],
        },
      };
    }
    if (query.includes("productVariant(")) {
      return state.weeklyProduct ?? WEEKLY_PRODUCT;
    }
    if (query.includes("productVariantsBulkCreate")) {
      return {
        productVariantsBulkCreate: {
          productVariants: [{ id: "gid://shopify/ProductVariant/666", title: "Launch -50%", price: WEEKLY_LAUNCH_PRICE }],
          userErrors: [],
        },
      };
    }
    throw new Error(`query inattesa nel fake: ${query.slice(0, 60)}`);
  }) as Gql;
}

describe("launchGroupInput — la coppia di pricing policy è esattamente −50% ciclo 1 / pieno dopo", () => {
  it("fixed = PERCENTAGE 50, recurring = afterCycle 1 a 0%", () => {
    for (const kind of ["base", "premium", "annual"] as const) {
      const plan = launchGroupInput(kind).sellingPlansToCreate[0];
      expect(plan.pricingPolicies).toEqual([
        { fixed: { adjustmentType: "PERCENTAGE", adjustmentValue: { percentage: 50.0 } } },
        { recurring: { afterCycle: 1, adjustmentType: "PERCENTAGE", adjustmentValue: { percentage: 0.0 } } },
      ]);
    }
  });

  it("mensili fatturano MONTH, annuale YEAR", () => {
    expect(launchGroupInput("base").sellingPlansToCreate[0].billingPolicy.recurring.interval).toBe("MONTH");
    expect(launchGroupInput("premium").sellingPlansToCreate[0].billingPolicy.recurring.interval).toBe("MONTH");
    expect(launchGroupInput("annual").sellingPlansToCreate[0].billingPolicy.recurring.interval).toBe("YEAR");
  });

  it("i merchantCode sono stabili: sono la chiave dell'idempotenza", () => {
    expect(LAUNCH_MERCHANT_CODE).toEqual({
      base: "betredge-launch-base-monthly",
      premium: "betredge-launch-premium-monthly",
      annual: "betredge-launch-annual",
    });
  });
});

describe("ensureLaunchSetup — crea ciò che manca, riusa ciò che c'è", () => {
  it("store vergine: crea 3 gruppi + variante weekly e ritorna id numerici", async () => {
    const state = { calls: [] as Array<{ query: string; variables?: Record<string, unknown> }> };
    const result = await ensureLaunchSetup(fakeGql(state), ENV);

    expect(result.created).toEqual([
      "betredge-launch-base-monthly",
      "betredge-launch-premium-monthly",
      "betredge-launch-annual",
      "weekly-launch-variant",
    ]);
    expect(result.env.SHOPIFY_SELLING_PLAN_BASE_LAUNCH).toBe("901");
    expect(result.env.SHOPIFY_SELLING_PLAN_PREMIUM_LAUNCH).toBe("902");
    expect(result.env.SHOPIFY_SELLING_PLAN_ANNUAL_LAUNCH).toBe("903");
    expect(result.env.SHOPIFY_VARIANT_WEEKLY_LAUNCH).toBe("666");
    // Tutti numerici: sono ciò che sellingPlanFor/isWeeklyPickVariant confrontano.
    for (const v of Object.values(result.env)) expect(v).toMatch(/^\d+$/);
  });

  it("i gruppi mensili vanno sulla LORO variant, l'annuale su entrambe le annuali", async () => {
    const state = { calls: [] as Array<{ query: string; variables?: Record<string, unknown> }> };
    await ensureLaunchSetup(fakeGql(state), ENV);
    const creates = state.calls.filter((c) => c.query.includes("sellingPlanGroupCreate"));
    const byCode = Object.fromEntries(
      creates.map((c) => [
        (c.variables?.input as { merchantCode: string }).merchantCode,
        (c.variables?.resources as { productVariantIds: string[] }).productVariantIds,
      ])
    );
    expect(byCode["betredge-launch-base-monthly"]).toEqual([toVariantGid("111")]);
    expect(byCode["betredge-launch-premium-monthly"]).toEqual([toVariantGid("222")]);
    expect(byCode["betredge-launch-annual"]).toEqual([toVariantGid("333"), toVariantGid("444")]);
  });

  it("seconda chiamata: tutto già esistente → zero create, stessi id", async () => {
    const state = {
      calls: [] as Array<{ query: string; variables?: Record<string, unknown> }>,
      existingGroups: [
        groupNode("betredge-launch-base-monthly", "901"),
        groupNode("betredge-launch-premium-monthly", "902"),
        groupNode("betredge-launch-annual", "903"),
      ],
      weeklyProduct: {
        productVariant: {
          id: toVariantGid("555"),
          product: {
            id: "gid://shopify/Product/77",
            options: [{ name: "Title" }],
            variants: {
              nodes: [
                ...WEEKLY_PRODUCT.productVariant.product.variants.nodes,
                {
                  id: toVariantGid("666"),
                  title: "Launch -50%",
                  price: WEEKLY_LAUNCH_PRICE,
                  selectedOptions: [{ name: "Title", value: "Launch -50%" }],
                },
              ],
            },
          },
        },
      },
    };
    const result = await ensureLaunchSetup(fakeGql(state), ENV);
    expect(result.created).toEqual([]);
    expect(result.env.SHOPIFY_SELLING_PLAN_BASE_LAUNCH).toBe("901");
    expect(result.env.SHOPIFY_VARIANT_WEEKLY_LAUNCH).toBe("666");
    expect(state.calls.some((c) => c.query.includes("Create"))).toBe(false);
  });

  it("la variante weekly esistente si riconosce dall'OPTION, non dal prezzo", async () => {
    // Variante col prezzo giusto ma senza l'option di lancio: NON va riusata.
    const state = {
      calls: [] as Array<{ query: string; variables?: Record<string, unknown> }>,
      weeklyProduct: {
        productVariant: {
          id: toVariantGid("555"),
          product: {
            id: "gid://shopify/Product/77",
            options: [{ name: "Title" }],
            variants: {
              nodes: [
                {
                  id: toVariantGid("555"),
                  title: "Default Title",
                  price: WEEKLY_LAUNCH_PRICE, // stesso prezzo, ma è la variante PIENA
                  selectedOptions: [{ name: "Title", value: "Default Title" }],
                },
              ],
            },
          },
        },
      },
    };
    const result = await ensureLaunchSetup(fakeGql(state), ENV);
    expect(result.created).toContain("weekly-launch-variant");
    expect(result.env.SHOPIFY_VARIANT_WEEKLY_LAUNCH).toBe("666");
  });

  it("userErrors di Shopify → errore esplicito, non un id vuoto", async () => {
    const state = { calls: [] as Array<{ query: string; variables?: Record<string, unknown> }> };
    const gql: Gql = (async (query: string, variables?: Record<string, unknown>) => {
      if (query.includes("sellingPlanGroups(")) return { sellingPlanGroups: { nodes: [] } };
      if (query.includes("sellingPlanGroupCreate")) {
        return {
          sellingPlanGroupCreate: {
            sellingPlanGroup: null,
            userErrors: [{ message: "missing write_purchase_options scope" }],
          },
        };
      }
      throw new Error("unexpected");
    }) as Gql;
    await expect(ensureLaunchSetup(gql, ENV)).rejects.toThrow(/write_purchase_options/);
  });
});

describe("numericId", () => {
  it("estrae la coda numerica dal GID e rifiuta il resto", () => {
    expect(numericId("gid://shopify/SellingPlan/12345")).toBe("12345");
    expect(() => numericId("gid://shopify/SellingPlan/abc")).toThrow();
  });
});
