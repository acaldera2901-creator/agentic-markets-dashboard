// Internal / test accounts and their orders (#GROWTH-V7). Pure: no I/O.
//
// Revenue and paying customers exclude our own accounts. The list is NOT
// computed here (the dashboard never reads e-mails or identifiers): it is
// generated locally by scripts/internal-accounts.ts with the admin connection,
// committed as content/internal-accounts.json (only ids + a reason code) and
// passed to the SQL builders. Orders link to profiles only through the buyer's
// identifier, so the script also lists the order ids of those accounts.

export const ACCOUNT_REASONS = ["team-plan", "maven-domain", "team-handle", "test-orders"] as const;
export type AccountReason = (typeof ACCOUNT_REASONS)[number];

export const ORDER_REASONS = ["internal-account", "test-price"] as const;
export type OrderReason = (typeof ORDER_REASONS)[number];

/** External profile on a paid-channel plan with no paid order recorded anywhere: not counted as a paying customer. */
export const NO_PAYMENT_REASON = "no-paid-order" as const;

export const ORDER_TABLES = ["paygate_orders", "paypal_orders", "shopify_events"] as const;
export type OrderTable = (typeof ORDER_TABLES)[number];

export interface InternalAccountsFile {
  schema: 1;
  generatedAt: string;
  /** Plain-language rules, shown in /lavoro and the README. */
  rules: string[];
  accounts: { id: string; reason: AccountReason }[];
  orders: { table: OrderTable; id: string; reason: OrderReason }[];
  paidPlanNoPayment: { id: string; reason: typeof NO_PAYMENT_REASON }[];
}

/** What the SQL builders need: plain id lists, already validated. */
export interface InternalLists {
  generatedAt: string;
  accounts: string[];
  paidPlanNoPayment: string[];
  orders: Record<OrderTable, string[]>;
}

export const EMPTY_INTERNAL: InternalLists = {
  generatedAt: "",
  accounts: [],
  paidPlanNoPayment: [],
  orders: { paygate_orders: [], paypal_orders: [], shopify_events: [] },
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
// Shopify event_id is the order id: digits (or a gid). Never a quote, never a space.
const SHOPIFY_ID = /^[A-Za-z0-9_:/.-]{1,80}$/;

function fail(msg: string): never {
  throw new Error(`content/internal-accounts.json: ${msg}`);
}

/**
 * Validates the committed file and turns it into id lists. The ids end up
 * inside SQL literals, so every id must match a strict pattern: a malformed
 * file stops the build instead of reaching a query.
 */
export function validateInternal(raw: unknown): InternalLists {
  const f = raw as Partial<InternalAccountsFile> | null;
  if (!f || f.schema !== 1) fail("schema sconosciuto");
  if (!f.generatedAt || Number.isNaN(Date.parse(f.generatedAt))) fail("generatedAt mancante");
  if (!Array.isArray(f.accounts) || !Array.isArray(f.orders) || !Array.isArray(f.paidPlanNoPayment)) fail("accounts/orders/paidPlanNoPayment mancanti");
  if (JSON.stringify(f).includes("@")) fail("contiene una @: nel file vanno solo id e motivi, mai e-mail");
  const out: InternalLists = { generatedAt: f.generatedAt, accounts: [], paidPlanNoPayment: [], orders: { paygate_orders: [], paypal_orders: [], shopify_events: [] } };
  for (const a of f.accounts) {
    if (!UUID.test(a.id)) fail(`id profilo non valido: ${a.id}`);
    if (!(ACCOUNT_REASONS as readonly string[]).includes(a.reason)) fail(`motivo sconosciuto: ${a.reason}`);
    out.accounts.push(a.id);
  }
  for (const a of f.paidPlanNoPayment) {
    if (!UUID.test(a.id)) fail(`id profilo non valido: ${a.id}`);
    if (a.reason !== NO_PAYMENT_REASON) fail(`motivo sconosciuto: ${a.reason}`);
    if (out.accounts.includes(a.id)) fail(`profilo sia interno sia senza pagamento: ${a.id}`);
    out.paidPlanNoPayment.push(a.id);
  }
  for (const o of f.orders) {
    if (!(ORDER_TABLES as readonly string[]).includes(o.table)) fail(`tabella ordini sconosciuta: ${o.table}`);
    if (!(ORDER_REASONS as readonly string[]).includes(o.reason)) fail(`motivo ordine sconosciuto: ${o.reason}`);
    if (!(o.table === "shopify_events" ? SHOPIFY_ID : UUID).test(o.id)) fail(`id ordine non valido: ${o.id}`);
    out.orders[o.table].push(o.id);
  }
  return out;
}

/** A SQL array literal of already-validated ids; empty list → an empty typed array (matches nothing). */
export function sqlIdArray(ids: string[], type: "uuid" | "text"): string {
  const pattern = type === "uuid" ? UUID : SHOPIFY_ID;
  for (const id of ids) if (!pattern.test(id)) throw new Error(`id non valido per SQL: ${id}`);
  return `ARRAY[${ids.map((i) => `'${i}'`).join(",")}]::${type}[]`;
}

/** Counts per reason, for the report Andrea validates (never ids). */
export function countByReason(f: InternalAccountsFile): Record<string, number> {
  const out: Record<string, number> = {};
  const inc = (k: string) => (out[k] = (out[k] ?? 0) + 1);
  for (const a of f.accounts) inc(`account:${a.reason}`);
  for (const o of f.orders) inc(`ordine:${o.table}:${o.reason}`);
  for (const p of f.paidPlanNoPayment) inc(`piano-senza-pagamento:${p.reason}`);
  return out;
}
