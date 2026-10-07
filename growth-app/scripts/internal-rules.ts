// Rules that recognise our own / test accounts (#GROWTH-V7). Pure, so they are
// tested; run only by scripts/internal-accounts.ts, locally, on rows read with
// the admin connection. Identifiers never leave this process: the output is
// ids + reason codes (core/internal.ts).

import { PAID_CHANNELS } from "../core/kpi";
import { type AccountReason, type InternalAccountsFile, NO_PAYMENT_REASON, type OrderReason, type OrderTable } from "../core/internal";

/** plan / plan_source values that only the team gets. */
export const INTERNAL_PLANS = ["admin_full"];
export const INTERNAL_PLAN_SOURCES = ["team", "admin", "admin_full"];
/** E-mail domains of the company. */
export const MAVEN_DOMAINS = ["mavenagency.io"];
/** Handles named by the audit of 07/10 (CTO, agency, Tommy), matched in the local part. */
export const TEAM_HANDLES = ["calde", "mavenagency", "tommy"];
/** Below the cheapest list price (base monthly, $14.99) an order is a test price. */
export const MIN_LIST_PRICE_USD = 14.99;

export const RULES_TEXT = [
  `team-plan: plan ${INTERNAL_PLANS.join("/")} o plan_source ${INTERNAL_PLAN_SOURCES.join("/")}`,
  `maven-domain: e-mail del dominio ${MAVEN_DOMAINS.join(", ")}`,
  `team-handle: la parte prima della chiocciola contiene ${TEAM_HANDLES.join(", ")}`,
  `test-orders: ha generato un ordine Paygate/PayPal sotto il prezzo di listino più basso ($${MIN_LIST_PRICE_USD})`,
  "ordini: internal-account = ordine di un account interno (collegato per identificativo); test-price = ordine Paygate/PayPal sotto listino di chiunque",
  `${NO_PAYMENT_REASON}: profilo esterno con piano base/premium da canale a pagamento ma nessun ordine pagato registrato (Paygate/PayPal con paid_at, Shopify orders/paid; Stripe solo con stripe_subscription_id)`,
  "un account ha un solo motivo: il primo che vale, in quest'ordine",
];

export interface ProfileIn {
  id: string;
  identifier: string | null;
  plan: string | null;
  plan_source: string | null;
  stripe_subscription_id: string | null;
}

export interface OrderIn {
  table: OrderTable;
  id: string;
  identifier: string | null;
  /** USD for Paygate/PayPal; null for Shopify (store currency, unknown). */
  amount_usd: number | null;
  /** paid_at set (Paygate/PayPal) or an orders/paid event (Shopify). */
  paid: boolean;
}

const norm = (s: string | null) => (s ?? "").trim().toLowerCase();

export function accountReason(p: ProfileIn, testOrderIdentifiers: Set<string>): AccountReason | null {
  const ident = norm(p.identifier);
  const [local, domain = ""] = ident.split("@");
  if (INTERNAL_PLANS.includes(p.plan ?? "") || INTERNAL_PLAN_SOURCES.includes(p.plan_source ?? "")) return "team-plan";
  if (MAVEN_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`))) return "maven-domain";
  if (TEAM_HANDLES.some((h) => local.includes(h))) return "team-handle";
  if (ident && testOrderIdentifiers.has(ident)) return "test-orders";
  return null;
}

const isTestPrice = (o: OrderIn) => o.table !== "shopify_events" && o.amount_usd !== null && o.amount_usd < MIN_LIST_PRICE_USD;

export function classify(profiles: ProfileIn[], orders: OrderIn[], generatedAt: string): InternalAccountsFile {
  const testIdents = new Set(orders.filter(isTestPrice).map((o) => norm(o.identifier)).filter(Boolean));
  const accounts: InternalAccountsFile["accounts"] = [];
  const internalIdents = new Set<string>();
  for (const p of profiles) {
    const reason = accountReason(p, testIdents);
    if (!reason) continue;
    accounts.push({ id: p.id, reason });
    if (norm(p.identifier)) internalIdents.add(norm(p.identifier));
  }
  const outOrders: InternalAccountsFile["orders"] = [];
  for (const o of orders) {
    let reason: OrderReason | null = null;
    if (internalIdents.has(norm(o.identifier))) reason = "internal-account";
    else if (isTestPrice(o)) reason = "test-price";
    if (reason) outOrders.push({ table: o.table, id: o.id, reason });
  }
  const paidIdents = new Set(orders.filter((o) => o.paid).map((o) => norm(o.identifier)).filter(Boolean));
  const paid = new Set<string>(PAID_CHANNELS);
  const internalIds = new Set(accounts.map((a) => a.id));
  const paidPlanNoPayment: InternalAccountsFile["paidPlanNoPayment"] = [];
  for (const p of profiles) {
    if (internalIds.has(p.id)) continue;
    if (p.plan !== "base" && p.plan !== "premium") continue;
    if (!paid.has(p.plan_source ?? "")) continue;
    const evidence = paidIdents.has(norm(p.identifier)) || (p.plan_source === "stripe" && !!p.stripe_subscription_id);
    if (!evidence) paidPlanNoPayment.push({ id: p.id, reason: NO_PAYMENT_REASON });
  }
  const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id);
  return {
    schema: 1,
    generatedAt,
    rules: RULES_TEXT,
    accounts: accounts.sort(byId),
    orders: outOrders.sort((a, b) => a.table.localeCompare(b.table) || a.id.localeCompare(b.id)),
    paidPlanNoPayment: paidPlanNoPayment.sort(byId),
  };
}
