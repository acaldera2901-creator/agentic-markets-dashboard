// Client PayPal Orders v2 (#PAYPAL-PAY). REST, no SDK server-side (stile lib/paygate.ts).
// Flusso una-tantum: createOrder → utente approva (bottone PayPal/Apple Pay) →
// captureOrder. La concessione del piano NON si fida del client: evaluateCapture
// (puro) + claim atomico DB stanno nel route handler /capture.
import { amountFor, periodDays, type PlanKey, type Period } from "./paygate";

export { amountFor, periodDays };
export type { PlanKey, Period };

// USD unico (i prezzi server-side sono in USD, come PayGate).
const CURRENCY = "USD";

export function paypalApiBase(): string {
  return process.env.PAYPAL_ENV === "sandbox"
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";
}

export async function getAccessToken(): Promise<string> {
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) throw new Error("[paypal] client id/secret non configurati");
  const auth = Buffer.from(`${id}:${secret}`).toString("base64");
  const resp = await fetch(`${paypalApiBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!resp.ok) throw new Error(`[paypal] oauth failed: ${resp.status}`);
  const d = (await resp.json()) as { access_token?: string };
  if (!d.access_token) throw new Error("[paypal] oauth: missing access_token");
  return d.access_token;
}

export async function createOrder(opts: {
  amount: number;
  plan: PlanKey;
  period: Period;
  identifier: string;
  orderId: string;
}): Promise<{ id: string }> {
  const token = await getAccessToken();
  const resp = await fetch(`${paypalApiBase()}/v2/checkout/orders`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          // custom_id = il nostro orderId → lo ritroviamo nel webhook per la riconciliazione.
          custom_id: opts.orderId,
          description: `BetRedge ${opts.plan} ${opts.period}`,
          amount: { currency_code: CURRENCY, value: opts.amount.toFixed(2) },
        },
      ],
    }),
  });
  if (!resp.ok) throw new Error(`[paypal] create order failed: ${resp.status}`);
  const d = (await resp.json()) as { id?: string };
  if (!d.id) throw new Error("[paypal] create order: missing id");
  return { id: d.id };
}

export async function captureOrder(
  paypalOrderId: string
): Promise<{ status: string; capturedValue: number | null; currency: string | null; captureId: string | null }> {
  const token = await getAccessToken();
  const resp = await fetch(`${paypalApiBase()}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  // PayPal può tornare 201 (catturato) o 422 (già catturato/non approvabile).
  const d = (await resp.json().catch(() => null)) as
    | {
        status?: string;
        purchase_units?: Array<{
          payments?: { captures?: Array<{ id?: string; status?: string; amount?: { value?: string; currency_code?: string } }> };
        }>;
      }
    | null;
  const cap = d?.purchase_units?.[0]?.payments?.captures?.[0];
  const rawValue = cap?.amount?.value;
  return {
    status: typeof d?.status === "string" ? d.status : "",
    capturedValue: rawValue != null && rawValue !== "" && Number.isFinite(Number(rawValue)) ? Number(rawValue) : null,
    currency: cap?.amount?.currency_code ?? null,
    captureId: cap?.id ?? null,
  };
}

// Decisione di concessione — PURA (testabile). Concede solo se: ordine trovato e
// pending, capture COMPLETED, valuta USD, importo >= atteso.
export function evaluateCapture(opts: {
  order: { status: string; amount_usd: number } | null;
  captured: { status: string; value: number | null; currency: string | null };
}): { grant: boolean; reason: string } {
  if (!opts.order) return { grant: false, reason: "order not found" };
  if (opts.order.status !== "pending") return { grant: false, reason: "order not pending" };
  if (opts.captured.status !== "COMPLETED") return { grant: false, reason: `capture status ${opts.captured.status}` };
  if (opts.captured.currency !== CURRENCY) return { grant: false, reason: "wrong currency" };
  if (opts.captured.value == null || !Number.isFinite(opts.captured.value)) return { grant: false, reason: "missing value" };
  if (opts.captured.value + 1e-9 < opts.order.amount_usd) return { grant: false, reason: "amount below expected" };
  return { grant: true, reason: "ok" };
}

export async function verifyWebhookSignature(opts: {
  headers: Record<string, string | null>;
  body: string;
}): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) return false;
  const token = await getAccessToken();
  const resp = await fetch(`${paypalApiBase()}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      auth_algo: opts.headers["paypal-auth-algo"],
      cert_url: opts.headers["paypal-cert-url"],
      transmission_id: opts.headers["paypal-transmission-id"],
      transmission_sig: opts.headers["paypal-transmission-sig"],
      transmission_time: opts.headers["paypal-transmission-time"],
      webhook_id: webhookId,
      webhook_event: JSON.parse(opts.body),
    }),
  });
  if (!resp.ok) return false;
  const d = (await resp.json().catch(() => null)) as { verification_status?: string } | null;
  return d?.verification_status === "SUCCESS";
}
