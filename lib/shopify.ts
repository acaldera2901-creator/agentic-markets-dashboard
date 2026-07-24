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

export function resolvePlanFromVariant(
  variantId: string | number | null | undefined
): "base" | "premium" | null {
  if (variantId == null) return null;
  const v = String(variantId);
  if (v === process.env.SHOPIFY_VARIANT_BASE) return "base";
  if (v === process.env.SHOPIFY_VARIANT_PREMIUM) return "premium";
  return null;
}

// Costruisce il permalink di checkout Shopify per un nuovo abbonato.
// L'app resta la fonte del piano: passiamo l'email (prefill) e l'identifier
// come cart attribute → Shopify lo riporta in order.note_attributes, che il
// webhook legge con extractOrder per mappare il grant all'utente.
// Ritorna null se lo store non è configurato → il chiamante fa fallback al
// flusso attuale (PayGate), così è safe da deployare "dark".
export function buildShopifyCheckoutUrl(
  plan: "base" | "premium",
  email: string
): string | null {
  const domain = process.env.SHOPIFY_SHOP_DOMAIN;
  const variant = plan === "premium" ? process.env.SHOPIFY_VARIANT_PREMIUM : process.env.SHOPIFY_VARIANT_BASE;
  if (!domain || !variant) return null;

  const params = new URLSearchParams();
  params.set("checkout[email]", email); // prefill: mantiene il case originale
  params.set("attributes[identifier]", email.toLowerCase().trim()); // match con extractOrder
  const sellingPlan =
    plan === "premium" ? process.env.SHOPIFY_SELLING_PLAN_PREMIUM : process.env.SHOPIFY_SELLING_PLAN_BASE;
  if (sellingPlan) params.set("selling_plan", sellingPlan);

  return `https://${domain}/cart/${variant}:1?${params.toString()}`;
}

type OrderShape = {
  id?: unknown;
  email?: unknown;
  note_attributes?: Array<{ name?: string; value?: string }>;
  line_items?: Array<{ variant_id?: unknown }>;
};

export function extractOrder(
  payload: unknown
): { orderId: string; email: string | null; identifier: string | null; variantId: string | null } | null {
  const o = (payload ?? {}) as OrderShape;
  if (o.id == null) return null;
  const email = typeof o.email === "string" ? o.email : null;
  const attr = (o.note_attributes ?? []).find((a) => a?.name === "identifier");
  const identifier = attr?.value ?? (email ? email.toLowerCase().trim() : null);
  const variantId = o.line_items?.[0]?.variant_id != null ? String(o.line_items[0].variant_id) : null;
  return { orderId: String(o.id), email, identifier, variantId };
}
