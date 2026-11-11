// lib/link-clicks.ts — #IG-LINK-1106: first-party campaign link (betredge.com/ig, for the Instagram bio).
// The click is counted SERVER-side as an aggregate (HMAC of IP+UA, nothing written on the device → no consent needed, calde's GDPR note 06/11).
// The source travels in the redirect URL (utm_source/utm_medium/src); lib/attribution (consent-gated, client) keeps it for the signup
// (profiles.acquisition) only AFTER the visitor accepts: without consent the source stays in this aggregate count only.
import { after } from "next/server";
import { dbExecute } from "@/lib/db";
import { isBotUserAgent } from "@/lib/bot-filter";
import { analyticsWriteAllowed } from "@/lib/events-write-gate";
import { hashIp } from "@/lib/affiliate/account";
import { keptSourceParams } from "@/lib/affiliate/clicks";

// #IG-BRAND-1110: the bio link goes through the brand affiliate code BRAND-IG (/r/ counts it in affiliate_referral_clicks and
// carries ?ref=BRAND-IG to the landing → signup/Pro attributed in the backoffice). The IG bio can only be edited from mobile.
export const CHANNELS = { ig: { path: "/r/BRAND-IG", utm_source: "instagram", utm_medium: "bio", utm_campaign: "profile" } } as const;
export type Channel = keyof typeof CHANNELS;

/** Where the link lands: fixed source params for the channel; the campaign/content the link carries (utm_campaign, utm_content) survive, source/medium never come from the URL. */
export function channelRedirect(channel: Channel, from: URL, base: string | URL): URL {
  const c = CHANNELS[channel];
  const url = new URL(c.path, base);
  url.searchParams.set("utm_source", c.utm_source);
  url.searchParams.set("utm_medium", c.utm_medium);
  url.searchParams.set("utm_campaign", c.utm_campaign);
  for (const [k, v] of keptSourceParams(from)) if (k === "utm_campaign" || k === "utm_content") url.searchParams.set(k, v);
  return url;
}

/** Count only real visits to the production site: no dev/preview, bots, prefetch or test-marked links. */
export function linkClickCountable(req: Request, from: URL, env: Record<string, string | undefined> = process.env): boolean {
  if (!analyticsWriteAllowed(env)) return false;
  if (isBotUserAgent(req.headers.get("user-agent"))) return false;
  const purpose = `${req.headers.get("sec-purpose") ?? ""} ${req.headers.get("purpose") ?? ""}`.toLowerCase();
  if (purpose.includes("prefetch") || purpose.includes("prerender") || req.headers.get("next-router-prefetch")) return false;
  if (keptSourceParams(from).some(([, v]) => /test/i.test(v))) return false;
  return true;
}

export async function recordLinkClickSafe(channel: Channel, ip: string, ua: string, landing: string, at = new Date()): Promise<boolean> {
  try {
    const day = at.toISOString().slice(0, 10);
    await dbExecute(
      `INSERT INTO link_clicks (channel, clicked_at, ip_hash, ua_hash, landing) VALUES ($1, $2::timestamptz, $3, $4, $5)`,
      [channel, at.toISOString(), hashIp(`${ip}|${day}`), ua ? hashIp(ua) : null, landing.slice(0, 500)]
    );
    return true;
  } catch (e) {
    console.error("[link-clicks] click non registrato:", String(e));
    return false;
  }
}

/** After the response; never throws. */
export function scheduleLinkClick(channel: Channel, ip: string, ua: string, landing: string): void {
  const run = () => recordLinkClickSafe(channel, ip, ua, landing);
  try { after(run); } catch { void run(); }
}
