// #SHOPIFY-CRYPTO-2 — client Admin API, usato SOLO dal rail crypto.
// Il checkout Shopify col metodo manuale "Crypto" crea un ordine NON pagato:
// serve l'Admin API per (a) ritrovare quell'ordine quando l'utente arriva a
// pagare, (b) marcarlo pagato quando PayGate conferma on-chain, (c) chiudere i
// pendenti che nessuno paga, così i libri non si riempiono di ordini fantasma.
//
// Token separato da quello dei webhook: `SHOPIFY_ADMIN_TOKEN` è un token OAuth
// con scope read_orders,write_orders. Senza di esso tutto il rail crypto è
// inerte (le funzioni ritornano null/false) → deploy safe dark, come il rail carta.

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

export type PendingCryptoOrder = {
  id: string; // GID
  name: string; // #1001
  amountUsd: number;
  variantId: string | null;
};

const PENDING_QUERY = `
  query PendingCrypto($q: String!) {
    orders(first: 25, query: $q, sortKey: CREATED_AT, reverse: true) {
      nodes {
        id
        name
        paymentGatewayNames
        customAttributes { key value }
        currentTotalPriceSet { shopMoney { amount } }
        lineItems(first: 1) { nodes { variant { id } } }
      }
    }
  }`;

type PendingNode = {
  id: string;
  name: string;
  paymentGatewayNames: string[];
  customAttributes: Array<{ key: string; value: string | null }>;
  currentTotalPriceSet: { shopMoney: { amount: string } };
  lineItems: { nodes: Array<{ variant: { id: string } | null }> };
};

// Ritrova l'ordine crypto in attesa di pagamento di QUESTO utente.
// Il match è su `attributes[identifier]` (che mettiamo noi nel permalink e viene
// dalla SESSIONE), non sull'email digitata al checkout: l'utente può scrivere
// un'email diversa, e pagare l'ordine di un altro non deve essere possibile.
export async function findPendingCryptoOrder(
  identifier: string,
  gatewayName: string
): Promise<PendingCryptoOrder | null> {
  const data = await adminGql<{ orders: { nodes: PendingNode[] } }>(PENDING_QUERY, {
    q: "financial_status:pending AND status:open",
  });
  const want = identifier.trim().toLowerCase();
  const wantGateway = gatewayName.trim().toLowerCase();

  for (const o of data.orders.nodes) {
    const attr = (o.customAttributes ?? []).find((a) => a?.key === "identifier");
    if ((attr?.value ?? "").trim().toLowerCase() !== want) continue;
    const isCrypto = (o.paymentGatewayNames ?? []).some(
      (g) => typeof g === "string" && g.trim().toLowerCase() === wantGateway
    );
    if (!isCrypto) continue;
    const amount = Number.parseFloat(o.currentTotalPriceSet?.shopMoney?.amount ?? "");
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const gid = o.lineItems?.nodes?.[0]?.variant?.id ?? null;
    return {
      id: o.id,
      name: o.name,
      amountUsd: amount,
      variantId: gid ? gid.split("/").pop() ?? null : null,
    };
  }
  return null;
}

const MARK_PAID = `
  mutation MarkPaid($input: OrderMarkAsPaidInput!) {
    orderMarkAsPaid(input: $input) {
      order { id displayFinancialStatus }
      userErrors { field message }
    }
  }`;

// Marca pagato l'ordine Shopify dopo la conferma on-chain di PayGate.
// Idempotente lato Shopify: se l'ordine è già pagato la mutation torna un
// userError, che trattiamo come successo (non è una condizione da ritentare).
export async function markShopifyOrderPaid(orderGid: string): Promise<boolean> {
  const data = await adminGql<{
    orderMarkAsPaid: {
      order: { id: string; displayFinancialStatus: string } | null;
      userErrors: Array<{ field?: string[]; message: string }>;
    };
  }>(MARK_PAID, { input: { id: orderGid } });

  const r = data.orderMarkAsPaid;
  if (r.order) return true;
  const msg = r.userErrors?.[0]?.message ?? "";
  if (/already|paid/i.test(msg)) {
    console.log(`[shopify-admin] ordine ${orderGid} già pagato: ${msg}`);
    return true;
  }
  console.error(`[shopify-admin] markAsPaid fallito su ${orderGid}: ${msg}`);
  return false;
}

const CLOSE = `
  mutation Close($input: OrderCloseInput!) {
    orderClose(input: $input) { order { id } userErrors { message } }
  }`;

// Chiude gli ordini crypto mai pagati. Non li CANCELLA: chiudere archivia e
// lascia lo storico (un cliente che paga in ritardo si recupera a mano),
// cancellare butterebbe via la traccia.
export async function closeStalePendingCryptoOrders(
  gatewayName: string,
  olderThanHours: number
): Promise<{ closed: string[]; errors: string[] }> {
  const cutoff = new Date(Date.now() - olderThanHours * 3_600_000).toISOString();
  const data = await adminGql<{ orders: { nodes: PendingNode[] } }>(PENDING_QUERY, {
    q: `financial_status:pending AND status:open AND created_at:<${cutoff}`,
  });
  const wantGateway = gatewayName.trim().toLowerCase();
  const closed: string[] = [];
  const errors: string[] = [];

  for (const o of data.orders.nodes) {
    const isCrypto = (o.paymentGatewayNames ?? []).some(
      (g) => typeof g === "string" && g.trim().toLowerCase() === wantGateway
    );
    if (!isCrypto) continue;
    try {
      const r = await adminGql<{
        orderClose: { order: { id: string } | null; userErrors: Array<{ message: string }> };
      }>(CLOSE, { input: { id: o.id } });
      if (r.orderClose.order) closed.push(o.name);
      else errors.push(`${o.name}: ${r.orderClose.userErrors?.[0]?.message ?? "close failed"}`);
    } catch (e) {
      errors.push(`${o.name}: ${String(e)}`);
    }
  }
  return { closed, errors };
}
