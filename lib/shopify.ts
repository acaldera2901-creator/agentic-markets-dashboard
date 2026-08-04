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
): { plan: "base" | "premium"; period: ShopifyPeriod; recurring: boolean } | null {
  if (variantId == null) return null;
  const v = String(variantId);
  if (v === process.env.SHOPIFY_VARIANT_BASE) return { plan: "base", period: "monthly", recurring: true };
  if (v === process.env.SHOPIFY_VARIANT_PREMIUM) return { plan: "premium", period: "monthly", recurring: true };
  if (v === process.env.SHOPIFY_VARIANT_BASE_ANNUAL) return { plan: "base", period: "annual", recurring: true };
  if (v === process.env.SHOPIFY_VARIANT_PREMIUM_ANNUAL) return { plan: "premium", period: "annual", recurring: true };
  // One-off: 30 giorni, nessun contratto di abbonamento dietro.
  if (v === process.env.SHOPIFY_VARIANT_BASE_ONEOFF) return { plan: "base", period: "monthly", recurring: false };
  if (v === process.env.SHOPIFY_VARIANT_PREMIUM_ONEOFF) return { plan: "premium", period: "monthly", recurring: false };
  return null;
}

// Il nome del metodo di pagamento manuale "Crypto …" creato nell'admin Shopify.
// Serve a riconoscere, in orders/paid, gli ordini il cui grant NON è nostro:
// li ha già concessi il callback PayGate, e concederli di nuovo qui regalerebbe
// altri 30 giorni. Il confronto è case/space-insensitive perché il nome è testo
// digitato a mano nell'admin.
export function isCryptoGatewayOrder(gatewayNames: string[] | null | undefined): boolean {
  const configured = process.env.SHOPIFY_CRYPTO_GATEWAY_NAME;
  if (!configured) return false;
  const want = configured.trim().toLowerCase();
  return (gatewayNames ?? []).some((g) => typeof g === "string" && g.trim().toLowerCase() === want);
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


// Prefisso di lingua del checkout. Lo store pubblica Español (default), English
// e Italiano: senza prefisso Shopify serve il DEFAULT, quindi un utente inglese
// o italiano si trovava un checkout in spagnolo (misurato: /checkouts/cn/…/es-es).
// Le lingue che NON pubblichiamo (fr, ru) cadono su inglese, non sullo spagnolo:
// un francese legge l'inglese, non il castigliano.
// È di fatto un allowlist: qualunque valore non previsto diventa "/en", quindi il
// valore che arriva dal client non finisce mai interpolato nell'URL.
export function shopifyLocalePrefix(lang: string | null | undefined): string {
  if (lang === "it") return "/it";
  if (lang === "es") return "";
  return "/en";
}

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
  period: ShopifyPeriod = "monthly",
  lang?: string | null
): string | null {
  const domain = process.env.SHOPIFY_SHOP_DOMAIN;
  const variant = variantFor(sku, period);
  if (!domain || !variant) return null;

  // Il prefisso va su OGNI hop della catena: /cart/clear e /cart/add sono
  // redirect, e un hop senza prefisso riporta la sessione al default dello store.
  const loc = shopifyLocalePrefix(lang);

  // Il checkout viene raggiunto via return_to, con l'email precompilata.
  const returnTo = `${loc}/checkout?${new URLSearchParams({ "checkout[email]": email })}`;

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
  return `https://${domain}${loc}/cart/clear?${new URLSearchParams({ return_to: `${loc}/cart/add?${add}` })}`;
}

type OrderShape = {
  id?: unknown;
  email?: unknown;
  total_price?: unknown;
  payment_gateway_names?: unknown;
  gateway?: unknown;
  note_attributes?: Array<{ name?: string; value?: string }>;
  line_items?: Array<{ variant_id?: unknown; quantity?: unknown }>;
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

export type ShopifyLineItem = { variantId: string; quantity: number };

// #SHOPIFY-MULTILINE-0804 — un ordine può avere PIÙ righe.
//
// Il nostro checkout ne produce sempre una sola (`/cart/clear` poi `/cart/add`),
// ma lo storefront è pubblico: chi ci arriva da lì mette nel carrello quello che
// vuole, es. un piano E la Weekly Pick. Finché leggevamo solo `line_items[0]`
// quell'ordine concedeva UNA sola delle due cose e l'altra spariva senza traccia
// — pagata e mai consegnata, con `status` che diceva comunque "granted"/"weekly"
// e la reconcile che quindi non la ri-tentava mai.
//
// La quantità serve al chiamante per accorgersi di un ordine che chiede due volte
// la stessa cosa (due piani, due settimane): non si "stacka" a indovinare, si
// segnala. Righe senza variant vengono scartate qui: non sono mappabili a nulla.
function extractLineItems(o: OrderShape): ShopifyLineItem[] {
  const out: ShopifyLineItem[] = [];
  for (const li of o.line_items ?? []) {
    if (li?.variant_id == null) continue;
    const q = typeof li.quantity === "number" && Number.isFinite(li.quantity) ? li.quantity : 1;
    out.push({ variantId: String(li.variant_id), quantity: q > 0 ? Math.floor(q) : 1 });
  }
  return out;
}

export function extractOrder(
  payload: unknown
): {
  orderId: string;
  email: string | null;
  identifier: string | null;
  variantId: string | null;
  lineItems: ShopifyLineItem[];
  totalPrice: number | null;
  gatewayNames: string[];
} | null {
  const o = (payload ?? {}) as OrderShape;
  if (o.id == null) return null;
  const email = typeof o.email === "string" ? o.email : null;
  const attr = (o.note_attributes ?? []).find((a) => a?.name === "identifier");
  const identifier = attr?.value ?? (email ? email.toLowerCase().trim() : null);
  const lineItems = extractLineItems(o);
  // `variantId` resta un campo SINGOLO perché è quello che finisce nella colonna
  // `shopify_events.variant_id`, da cui la reconcile ri-tenta i piani rimasti
  // senza grant. Su un ordine misto deve quindi essere il variant del PIANO, non
  // il primo in ordine di carrello: se ci finisse la Weekly Pick, la reconcile non
  // saprebbe più quale piano concedere. Nessun cambio di schema, solo la scelta
  // giusta della riga da registrare.
  const planItem = lineItems.find((li) => resolveOrderFromVariant(li.variantId) != null);
  const variantId = planItem?.variantId ?? lineItems[0]?.variantId ?? null;
  // Shopify manda l'array `payment_gateway_names`; `gateway` è il campo legacy
  // singolo. Leggiamo entrambi: un ordine crypto non riconosciuto = doppio grant.
  const gatewayNames = [
    ...(Array.isArray(o.payment_gateway_names) ? o.payment_gateway_names : []),
    ...(typeof o.gateway === "string" ? [o.gateway] : []),
  ].filter((g): g is string => typeof g === "string");
  return {
    orderId: String(o.id),
    email,
    identifier,
    variantId,
    lineItems,
    totalPrice: money(o.total_price),
    gatewayNames,
  };
}

// Un rimborso spegne l'accesso solo se restituisce (quasi) tutto l'ordine.
// Se non conosciamo uno dei due importi assumiamo TOTALE: il commerciante ha
// restituito i soldi, lasciare l'accesso attivo regalerebbe il prodotto.
// La tolleranza copre i centesimi (arrotondamenti, valute con 2 decimali).
export function isFullRefund(refunded: number | null, orderTotal: number | null): boolean {
  if (refunded == null || orderTotal == null || orderTotal <= 0) return true;
  return refunded + 0.01 >= orderTotal;
}
