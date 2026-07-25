import crypto from "node:crypto";

export function isShopifyConfigured(): boolean {
  return Boolean(
    process.env.SHOPIFY_WEBHOOK_SECRET &&
      process.env.SHOPIFY_VARIANT_BASE &&
      process.env.SHOPIFY_VARIANT_PREMIUM
  );
}

// Shopify firma il RAW body con HMAC-SHA256 (base64) usando il webhook secret.
export function verifyShopifyHmac(rawBody: string, hmacHeader: string | null): boolean {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret || !hmacHeader) return false;
  const digest = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  const a = Buffer.from(digest);
  const b = Buffer.from(hmacHeader);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export type ShopifyPeriod = "monthly" | "annual";

// Risolve piano E periodo dal variant id. Il periodo DEVE venire da qui: mensile
// e annuale sono prodotti Shopify distinti, e passare "monthly" per un ordine
// annuale concederebbe 30 giorni a chi ha pagato 12 mesi.
export function resolveOrderFromVariant(
  variantId: string | number | null | undefined
): { plan: "base" | "premium"; period: ShopifyPeriod } | null {
  if (variantId == null) return null;
  const v = String(variantId);
  if (v === process.env.SHOPIFY_VARIANT_BASE) return { plan: "base", period: "monthly" };
  if (v === process.env.SHOPIFY_VARIANT_PREMIUM) return { plan: "premium", period: "monthly" };
  if (v === process.env.SHOPIFY_VARIANT_BASE_ANNUAL) return { plan: "base", period: "annual" };
  if (v === process.env.SHOPIFY_VARIANT_PREMIUM_ANNUAL) return { plan: "premium", period: "annual" };
  return null;
}

// La Weekly Pick è una SKU one-off, non un piano: l'ordine non concede
// plan/plan_expires_at ma un entitlement per la settimana corrente. Sta fuori
// da resolveOrderFromVariant proprio per non poter essere confusa con un piano.
export function isWeeklyPickVariant(variantId: string | number | null | undefined): boolean {
  const weekly = process.env.SHOPIFY_VARIANT_WEEKLY;
  if (!weekly || variantId == null) return false;
  return String(variantId) === weekly;
}

export type ShopifySku = "base" | "premium" | "weekly";

// Mensile e annuale sono PRODOTTI distinti su Shopify (prezzi 14.99/29.99 vs
// 164.99/329.99), non due varianti dello stesso: così il webhook può dedurre il
// periodo dal solo variant id, che è l'unico campo su cui possiamo contare nel
// payload di orders/paid.
function variantFor(sku: ShopifySku, period: ShopifyPeriod): string | undefined {
  if (sku === "weekly") return process.env.SHOPIFY_VARIANT_WEEKLY;
  if (period === "annual") {
    return sku === "premium"
      ? process.env.SHOPIFY_VARIANT_PREMIUM_ANNUAL
      : process.env.SHOPIFY_VARIANT_BASE_ANNUAL;
  }
  return sku === "premium" ? process.env.SHOPIFY_VARIANT_PREMIUM : process.env.SHOPIFY_VARIANT_BASE;
}

// L'annuale usa UN solo selling plan (ogni 12 mesi, nessun aggiustamento di
// prezzo) condiviso dai due prodotti annuali, perché il prezzo sta già nel
// prodotto. Il mensile ha un plan per prodotto per motivi storici.
function sellingPlanFor(sku: ShopifySku, period: ShopifyPeriod): string | undefined {
  if (sku === "weekly") return undefined;
  if (period === "annual") return process.env.SHOPIFY_SELLING_PLAN_ANNUAL;
  return sku === "premium"
    ? process.env.SHOPIFY_SELLING_PLAN_PREMIUM
    : process.env.SHOPIFY_SELLING_PLAN_BASE;
}

// Costruisce il permalink di checkout Shopify per un nuovo abbonato.
// L'app resta la fonte del piano: passiamo l'email (prefill) e l'identifier
// come cart attribute → Shopify lo riporta in order.note_attributes, che il
// webhook legge con extractOrder per mappare il grant all'utente.
// Ritorna null se lo store non è configurato → il chiamante fa fallback al
// flusso attuale (PayGate), così è safe da deployare "dark".
export function buildShopifyCheckoutUrl(
  sku: ShopifySku,
  email: string,
  period: ShopifyPeriod = "monthly"
): string | null {
  const domain = process.env.SHOPIFY_SHOP_DOMAIN;
  const variant = variantFor(sku, period);
  if (!domain || !variant) return null;

  // Il checkout viene raggiunto via return_to, con l'email precompilata.
  const returnTo = `/checkout?${new URLSearchParams({ "checkout[email]": email })}`;

  const add = new URLSearchParams();
  add.set("id", variant);
  add.set("quantity", "1");
  // La weekly pick NON porta selling_plan: è un acquisto singolo. Passarne uno
  // la trasformerebbe in un addebito ricorrente.
  if (sku !== "weekly") {
    const sellingPlan = sellingPlanFor(sku, period);
    // Senza selling plan l'ordine sarebbe un addebito UNICO travestito da
    // abbonamento: il cliente paga una volta e non rinnova mai, e nessuno se ne
    // accorge. Meglio non offrire affatto il rail (→ 503 → fallback PayGate)
    // che vendere un abbonamento che non è un abbonamento.
    if (!sellingPlan) return null;
    add.set("selling_plan", sellingPlan);
  }
  add.set("attributes[identifier]", email.toLowerCase().trim()); // match con extractOrder
  add.set("return_to", returnTo);

  // Due dettagli verificati sullo store reale, non intercambiabili:
  // 1) il permalink `/cart/{variant}:1?selling_plan=…` NON applica il piano —
  //    su cart.js la riga esce senza selling_plan_allocation, cioè l'utente
  //    pagherebbe una-tantum invece di abbonarsi. Solo /cart/add lo applica.
  // 2) /cart/add SOMMA al carrello esistente: senza /cart/clear a monte un
  //    doppio click metterebbe due abbonamenti nello stesso ordine.
  return `https://${domain}/cart/clear?${new URLSearchParams({ return_to: `/cart/add?${add}` })}`;
}

type OrderShape = {
  id?: unknown;
  email?: unknown;
  total_price?: unknown;
  note_attributes?: Array<{ name?: string; value?: string }>;
  line_items?: Array<{ variant_id?: unknown }>;
};

// Importo in euro/dollari da una stringa Shopify ("14.99"). Ritorna null su
// valori assenti o non numerici: il chiamante deve distinguere "zero" da "non lo so".
function money(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

// Payload di refunds/create: `id` è il RIMBORSO, `order_id` l'ordine originale.
// Serve l'order_id perché è la chiave con cui shopify_events sa a chi apparteneva
// il pagamento (il payload del rimborso non porta l'identifier).
export function extractRefund(
  payload: unknown
): { refundId: string; orderId: string; amount: number | null } | null {
  const r = (payload ?? {}) as {
    id?: unknown;
    order_id?: unknown;
    transactions?: Array<{ kind?: unknown; status?: unknown; amount?: unknown }>;
  };
  if (r.id == null || r.order_id == null) return null;
  // L'importo RIMBORSATO sta nelle transazioni, non in un campo totale: serve a
  // distinguere un rimborso PARZIALE (una mensilità su un annuale, un gesto
  // commerciale) da uno totale. Solo il totale deve spegnere l'accesso.
  let amount: number | null = null;
  for (const t of r.transactions ?? []) {
    if (t?.kind !== "refund") continue;
    if (t?.status != null && t.status !== "success") continue;
    const v = money(t.amount);
    if (v != null) amount = (amount ?? 0) + v;
  }
  return { refundId: String(r.id), orderId: String(r.order_id), amount };
}

export function extractOrder(
  payload: unknown
): {
  orderId: string;
  email: string | null;
  identifier: string | null;
  variantId: string | null;
  totalPrice: number | null;
} | null {
  const o = (payload ?? {}) as OrderShape;
  if (o.id == null) return null;
  const email = typeof o.email === "string" ? o.email : null;
  const attr = (o.note_attributes ?? []).find((a) => a?.name === "identifier");
  const identifier = attr?.value ?? (email ? email.toLowerCase().trim() : null);
  const variantId = o.line_items?.[0]?.variant_id != null ? String(o.line_items[0].variant_id) : null;
  return { orderId: String(o.id), email, identifier, variantId, totalPrice: money(o.total_price) };
}

// Un rimborso spegne l'accesso solo se restituisce (quasi) tutto l'ordine.
// Se non conosciamo uno dei due importi assumiamo TOTALE: il commerciante ha
// restituito i soldi, lasciare l'accesso attivo regalerebbe il prodotto.
// La tolleranza copre i centesimi (arrotondamenti, valute con 2 decimali).
export function isFullRefund(refunded: number | null, orderTotal: number | null): boolean {
  if (refunded == null || orderTotal == null || orderTotal <= 0) return true;
  return refunded + 0.01 >= orderTotal;
}
