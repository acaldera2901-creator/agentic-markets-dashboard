import { after } from "next/server";
import { GA_MEASUREMENT_ID } from "./ga4-config";

export async function sendGa4Signup(consent: unknown, session: unknown) {
  const secret = process.env.GA4_MEASUREMENT_PROTOCOL_SECRET;
  if (!GA_MEASUREMENT_ID || !secret || consent !== true || !session || typeof session !== "object") return;
  const { client_id, session_id } = session as Record<string, unknown>;
  if (typeof client_id !== "string" || !/^\d{1,20}\.\d{1,20}$/.test(client_id)) return;
  if (typeof session_id !== "string" || !/^\d{1,12}$/.test(session_id) || Number(session_id) === 0) return;

  const endpoint = new URL("https://www.google-analytics.com/mp/collect");
  endpoint.searchParams.set("measurement_id", GA_MEASUREMENT_ID);
  endpoint.searchParams.set("api_secret", secret);
  try {
    const result = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: AbortSignal.timeout(3000),
      body: JSON.stringify({
        client_id,
        consent: { ad_user_data: "DENIED", ad_personalization: "DENIED" },
        events: [{ name: "sign_up", params: { session_id: Number(session_id), method: "email" } }],
      }),
    });
    if (!result.ok) console.warn("[GA4] sign_up delivery failed", result.status);
  } catch {
    console.warn("[GA4] sign_up delivery failed");
  }
}

export function scheduleGa4Signup(consent: unknown, session: unknown) {
  if (GA_MEASUREMENT_ID && consent === true && session && process.env.GA4_MEASUREMENT_PROTOCOL_SECRET) {
    after(() => sendGa4Signup(consent, session));
  }
}
