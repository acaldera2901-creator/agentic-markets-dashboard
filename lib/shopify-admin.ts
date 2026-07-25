// #SHOPIFY-CRYPTO-3 — client Admin API per il rail crypto.
// Il checkout Shopify NON può incassare crypto: qualunque forma di pago manuale
// crea un ordine e rimanda il pagamento a dopo, e il bottone finale dice
// "Complete order" (misurato sull'ordine #1001). Quindi il crypto si paga dove
// l'utente clicca — la pagina PayGate — e l'ordine viene SPECCHIATO qui dentro
// già pagato: ricevuta, report e rimborsi restano in Shopify senza chiedere al
// cliente un secondo passaggio che sembra facoltativo.
//
// Token separato da quello dei webhook: `SHOPIFY_ADMIN_TOKEN` è un token OAuth
// con scope write_orders. Senza di esso il mirror è inerte (ritorna null) e il
// pagamento crypto funziona comunque: perdiamo la riga in Shopify, non i soldi.

const API_VERSION = "2026-07";

export function isShopifyAdminConfigured(): boolean {
  return Boolean(process.env.SHOPIFY_ADMIN_TOKEN && process.env.SHOPIFY_SHOP_DOMAIN);
}

type GqlResult<T> = { data?: T; errors?: Array<{ message?: string }> };

// Fail-loud di proposito: un errore qui riguarda soldi (ordine da marcare
// pagato), quindi deve risalire al chiamante e non degradare a "non trovato".
async function adminGql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const domain = process.env.SHOPIFY_SHOP_DOMAIN;
  const token = process.env.SHOPIFY_ADMIN_TOKEN;
  if (!domain || !token) throw new Error("shopify admin not configured");

  const res = await fetch(`https://${domain}/admin/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: { "X-Shopify-Access-Token": token, "content-type": "application/json" },
    body: JSON.stringify({ query, variables: variables ?? {} }),
  });
  if (!res.ok) throw new Error(`shopify admin http ${res.status}`);
  const json = (await res.json()) as GqlResult<T>;
  if (json.errors?.length) throw new Error(`shopify admin: ${json.errors[0]?.message ?? "graphql error"}`);
  if (!json.data) throw new Error("shopify admin: empty data");
  return json.data;
}

const ORDER_CREATE = `
  mutation MirrorPaidOrder($order: OrderCreateOrderInput!, $options: OrderCreateOptionsInput) {
    orderCreate(order: $order, options: $options) {
      order { id name displayFinancialStatus }
      userErrors { field message }
    }
  }`;

export type MirrorInput = {
  identifier: string;
  plan: "base" | "premium";
  period: "monthly" | "annual";
  amountUsd: number;
  paygateOrderId: string;
  txid?: string | null;
};

// Titolo della riga d'ordine: dice la verità sul prodotto venduto. Il crypto è
// per forza un acquisto SINGOLO (nessun rail crypto può ri-addebitare), quindi
// non riusiamo le SKU in abbonamento — una riga "Annual subscription" su un
// pagamento che non si rinnova sarebbe una ricevuta falsa. Riga custom: nessun
// accoppiamento con i variant id, e il titolo resta leggibile in fattura.
export function mirrorLineTitle(plan: "base" | "premium", period: "monthly" | "annual"): string {
  const tier = plan === "premium" ? "Premium" : "Base";
  const days = period === "annual" ? "365" : "30";
  return `BetRedge ${tier} — ${days} days (one-time, crypto)`;
}

// Crea in Shopify l'ordine GIÀ PAGATO che corrisponde a un pagamento crypto
// arrivato via PayGate. Ritorna il GID, o null se non configurato/fallito:
// il chiamante non deve MAI far dipendere il grant da questo (i soldi sono già
// arrivati e il piano è già stato concesso).
export async function createMirroredPaidOrder(input: MirrorInput): Promise<string | null> {
  if (!isShopifyAdminConfigured()) return null;
  const amount = input.amountUsd.toFixed(2);
  const money = { shopMoney: { amount, currencyCode: "USD" } };

  try {
    const data = await adminGql<{
      orderCreate: {
        order: { id: string; name: string; displayFinancialStatus: string } | null;
        userErrors: Array<{ field?: string[]; message: string }>;
      };
    }>(ORDER_CREATE, {
      order: {
        // L'email fa da chiave cliente in Shopify; l'identifier resta anche come
        // attributo, che è ciò che il webhook dei rimborsi sa leggere.
        ...(input.identifier.includes("@") ? { email: input.identifier } : {}),
        currency: "USD",
        financialStatus: "PAID",
        tags: ["crypto", "paygate"],
        customAttributes: [
          { key: "identifier", value: input.identifier },
          { key: "rail", value: "paygate-crypto" },
          { key: "paygate_order", value: input.paygateOrderId },
        ],
        lineItems: [
          {
            title: mirrorLineTitle(input.plan, input.period),
            quantity: 1,
            requiresShipping: false,
            taxable: true,
            vendor: "BetRedge",
            priceSet: money,
          },
        ],
        // La transazione rende l'incasso visibile in Finanze col suo gateway,
        // invece di un ordine "pagato" senza traccia di come.
        transactions: [
          {
            kind: "SALE",
            status: "SUCCESS",
            gateway: "PayGate (crypto)",
            amountSet: money,
            ...(input.txid ? { authorizationCode: input.txid } : {}),
          },
        ],
      },
      // Nessuna ricevuta da Shopify: la manda già il callback PayGate
      // (receiptEmail), e due ricevute per un pagamento sono un reclamo.
      options: { sendReceipt: false },
    });

    const r = data.orderCreate;
    if (r.order) {
      console.log(`[shopify-admin] mirror ordine ${r.order.name} (${r.order.displayFinancialStatus}) per paygate=${input.paygateOrderId}`);
      return r.order.id;
    }
    console.error(`[shopify-admin] mirror fallito: ${r.userErrors?.[0]?.message ?? "unknown"}`);
    return null;
  } catch (e) {
    console.error("[shopify-admin] mirror error:", String(e));
    return null;
  }
}
