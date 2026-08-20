// #LAUNCH-SETUP-0805 — one-off che crea nello store gli oggetti della promo di
// lancio: 3 selling plan "−50% sul solo primo ciclo" + la variante Weekly Pick
// a metà prezzo. Vive nel backend perché è l'unico posto dove esistono le
// credenziali Admin API; il lab e le chat non le vedono mai.
//
// Idempotente per costruzione: ogni gruppo ha un merchantCode fisso e la
// funzione prima CERCA, poi crea solo ciò che manca. Chiamarla due volte
// ritorna gli stessi id senza toccare lo store.
//
// La coppia di pricing policy è il punto legale/commerciale dell'intera promo:
//   fixed     (vale sul ciclo 1)  → −50%
//   recurring (afterCycle: 1)     → 0%, cioè prezzo pieno dal 2° addebito
// È il primitivo nativo di Shopify: il rinnovo torna pieno senza logica nostra
// e senza date da sorvegliare. Vedi #STORE-IDS-ANSWER-0805.

export type LaunchGroupKind = "base" | "premium" | "annual";

export const LAUNCH_MERCHANT_CODE: Record<LaunchGroupKind, string> = {
  base: "betredge-launch-base-monthly",
  premium: "betredge-launch-premium-monthly",
  annual: "betredge-launch-annual",
};

// 6,50 e non 6,49: è 12,99 × 0,5 arrotondato come lo calcola il server per gli
// altri rail — una variante a 6,49 mostrerebbe due prezzi per la stessa cosa.
export const WEEKLY_LAUNCH_PRICE = "6.50";
const WEEKLY_LAUNCH_OPTION = "Launch -50%";

export type Gql = <T>(query: string, variables?: Record<string, unknown>) => Promise<T>;

// Gli id in env sono numerici (è ciò che il webhook confronta col payload);
// l'Admin API parla in GID. Conversioni esplicite ai due bordi.
export function toVariantGid(numericId: string): string {
  return `gid://shopify/ProductVariant/${numericId}`;
}

export function numericId(gid: string): string {
  const tail = gid.split("/").pop();
  if (!tail || !/^\d+$/.test(tail)) throw new Error(`gid inatteso: ${gid}`);
  return tail;
}

// Input della mutation per un gruppo di lancio. Funzione pura: i test provano
// QUI che lo sconto è 50% sul solo primo ciclo — è l'unica parte del "50% solo
// il primo mese" che si può coprire con un test senza uno store davanti.
export function launchGroupInput(kind: LaunchGroupKind) {
  const interval = kind === "annual" ? "YEAR" : "MONTH";
  const label =
    kind === "annual" ? "Annual" : kind === "premium" ? "Premium Monthly" : "Base Monthly";
  return {
    name: `BetRedge Launch — ${label} (−50% first cycle)`,
    merchantCode: LAUNCH_MERCHANT_CODE[kind],
    options: ["Launch"],
    sellingPlansToCreate: [
      {
        name: "Launch offer: −50% first cycle, full price after",
        options: ["−50% first cycle"],
        category: "SUBSCRIPTION",
        billingPolicy: { recurring: { interval, intervalCount: 1 } },
        deliveryPolicy: { recurring: { interval, intervalCount: 1 } },
        pricingPolicies: [
          { fixed: { adjustmentType: "PERCENTAGE", adjustmentValue: { percentage: 50.0 } } },
          {
            recurring: {
              afterCycle: 1,
              adjustmentType: "PERCENTAGE",
              adjustmentValue: { percentage: 0.0 },
            },
          },
        ],
      },
    ],
  };
}

// Env richieste: le 4 variant già in produzione. Tenerle come parametro rende
// la funzione testabile e il fallimento esplicito invece di un undefined che
// arriva a Shopify.
export type LaunchSetupEnv = {
  variantBase: string;
  variantPremium: string;
  variantBaseAnnual: string;
  variantPremiumAnnual: string;
  variantWeekly: string;
};

export function readLaunchSetupEnv(): LaunchSetupEnv {
  const need = (name: string): string => {
    const v = process.env[name];
    if (!v) throw new Error(`env mancante: ${name}`);
    return v;
  };
  return {
    variantBase: need("SHOPIFY_VARIANT_BASE"),
    variantPremium: need("SHOPIFY_VARIANT_PREMIUM"),
    variantBaseAnnual: need("SHOPIFY_VARIANT_BASE_ANNUAL"),
    variantPremiumAnnual: need("SHOPIFY_VARIANT_PREMIUM_ANNUAL"),
    variantWeekly: need("SHOPIFY_VARIANT_WEEKLY"),
  };
}

export type LaunchSetupResult = {
  // Numerici, pronti da incollare nelle 4 env che il codice live già legge.
  env: {
    SHOPIFY_SELLING_PLAN_BASE_LAUNCH: string;
    SHOPIFY_SELLING_PLAN_PREMIUM_LAUNCH: string;
    SHOPIFY_SELLING_PLAN_ANNUAL_LAUNCH: string;
    SHOPIFY_VARIANT_WEEKLY_LAUNCH: string;
  };
  created: string[]; // cosa è stato creato in QUESTA chiamata (vuoto = era già tutto lì)
};

const GROUPS_QUERY = `
  query LaunchGroups($q: String!) {
    sellingPlanGroups(first: 20, query: $q) {
      nodes {
        id
        merchantCode
        sellingPlans(first: 5) { nodes { id } }
      }
    }
  }`;

const GROUP_CREATE = `
  mutation LaunchGroupCreate($input: SellingPlanGroupInput!, $resources: SellingPlanGroupResourceInput) {
    sellingPlanGroupCreate(input: $input, resources: $resources) {
      sellingPlanGroup {
        id
        merchantCode
        sellingPlans(first: 5) { nodes { id } }
      }
      userErrors { field message }
    }
  }`;

const WEEKLY_PRODUCT_QUERY = `
  query WeeklyProduct($id: ID!) {
    productVariant(id: $id) {
      id
      product {
        id
        options { name }
        variants(first: 50) { nodes { id title price selectedOptions { name value } } }
      }
    }
  }`;

const VARIANT_CREATE = `
  mutation WeeklyLaunchVariant($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
    productVariantsBulkCreate(productId: $productId, variants: $variants) {
      productVariants { id title price }
      userErrors { field message }
    }
  }`;

type GroupNode = { id: string; merchantCode: string; sellingPlans: { nodes: Array<{ id: string }> } };

async function ensureGroup(
  gql: Gql,
  kind: LaunchGroupKind,
  variantNumericIds: string[],
  existing: GroupNode[],
  created: string[]
): Promise<string> {
  const code = LAUNCH_MERCHANT_CODE[kind];
  const found = existing.find((g) => g.merchantCode === code);
  if (found) {
    const plan = found.sellingPlans.nodes[0];
    if (!plan) throw new Error(`gruppo ${code} esiste ma senza selling plan: risolvere a mano`);
    return numericId(plan.id);
  }
  const data = await gql<{
    sellingPlanGroupCreate: {
      sellingPlanGroup: GroupNode | null;
      userErrors: Array<{ field?: string[]; message: string }>;
    };
  }>(GROUP_CREATE, {
    input: launchGroupInput(kind),
    resources: { productVariantIds: variantNumericIds.map(toVariantGid) },
  });
  const r = data.sellingPlanGroupCreate;
  if (!r.sellingPlanGroup) {
    throw new Error(`sellingPlanGroupCreate ${code}: ${r.userErrors?.[0]?.message ?? "unknown"}`);
  }
  const plan = r.sellingPlanGroup.sellingPlans.nodes[0];
  if (!plan) throw new Error(`sellingPlanGroupCreate ${code}: gruppo creato senza plan`);
  created.push(code);
  return numericId(plan.id);
}

async function ensureWeeklyLaunchVariant(gql: Gql, weeklyVariantId: string, created: string[]): Promise<string> {
  const data = await gql<{
    productVariant: {
      id: string;
      product: {
        id: string;
        options: Array<{ name: string }>;
        variants: {
          nodes: Array<{
            id: string;
            title: string;
            price: string;
            selectedOptions: Array<{ name: string; value: string }>;
          }>;
        };
      };
    } | null;
  }>(WEEKLY_PRODUCT_QUERY, { id: toVariantGid(weeklyVariantId) });

  const product = data.productVariant?.product;
  if (!product) throw new Error(`variant weekly ${weeklyVariantId} non trovata nello store`);

  // Idempotenza: la variante di lancio si riconosce dall'option value, non dal
  // prezzo — un domani il prezzo pieno potrebbe diventare 6,50 e il match per
  // prezzo aggancerebbe la variante sbagliata.
  const existing = product.variants.nodes.find((v) =>
    v.selectedOptions.some((o) => o.value === WEEKLY_LAUNCH_OPTION)
  );
  if (existing) return numericId(existing.id);

  const optionName = product.options[0]?.name ?? "Title";
  const res = await gql<{
    productVariantsBulkCreate: {
      productVariants: Array<{ id: string; title: string; price: string }>;
      userErrors: Array<{ field?: string[]; message: string }>;
    };
  }>(VARIANT_CREATE, {
    productId: product.id,
    variants: [
      {
        price: WEEKLY_LAUNCH_PRICE,
        optionValues: [{ optionName, name: WEEKLY_LAUNCH_OPTION }],
        inventoryItem: { requiresShipping: false, tracked: false },
      },
    ],
  });
  const r = res.productVariantsBulkCreate;
  const variant = r.productVariants?.[0];
  if (!variant) {
    throw new Error(`productVariantsBulkCreate weekly: ${r.userErrors?.[0]?.message ?? "unknown"}`);
  }
  created.push("weekly-launch-variant");
  return numericId(variant.id);
}

export async function ensureLaunchSetup(gql: Gql, env: LaunchSetupEnv): Promise<LaunchSetupResult> {
  const created: string[] = [];

  const existing = await gql<{ sellingPlanGroups: { nodes: GroupNode[] } }>(GROUPS_QUERY, {
    q: "merchant_code:betredge-launch*",
  });
  const nodes = existing.sellingPlanGroups.nodes;

  // Tre gruppi SEPARATI, non uno: un gruppo unico su 4 variant esporrebbe il
  // piano annuale anche sulle variant mensili — combinazione che il checkout
  // non costruisce mai ma che a quel punto esisterebbe nello store.
  const base = await ensureGroup(gql, "base", [env.variantBase], nodes, created);
  const premium = await ensureGroup(gql, "premium", [env.variantPremium], nodes, created);
  const annual = await ensureGroup(
    gql,
    "annual",
    [env.variantBaseAnnual, env.variantPremiumAnnual],
    nodes,
    created
  );
  const weekly = await ensureWeeklyLaunchVariant(gql, env.variantWeekly, created);

  return {
    env: {
      SHOPIFY_SELLING_PLAN_BASE_LAUNCH: base,
      SHOPIFY_SELLING_PLAN_PREMIUM_LAUNCH: premium,
      SHOPIFY_SELLING_PLAN_ANNUAL_LAUNCH: annual,
      SHOPIFY_VARIANT_WEEKLY_LAUNCH: weekly,
    },
    created,
  };
}
