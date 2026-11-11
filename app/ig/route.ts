import { NextResponse } from "next/server";
import { channelRedirect, linkClickCountable, scheduleLinkClick } from "@/lib/link-clicks";
import { clientIp, rateLimit } from "@/lib/rate-limit";

// #IG-LINK-1106 — link for the Instagram bio: betredge.com/ig
// 302 to /r/BRAND-IG?utm_source=instagram&utm_medium=bio&utm_campaign=profile (#IG-BRAND-1110). The click is counted server-side (aggregate, HMAC IP+UA,
// nothing on the device); the source reaches profiles.acquisition at signup only after consent (lib/attribution).
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const from = new URL(req.url);
  const url = channelRedirect("ig", from, req.url);
  if (linkClickCountable(req, from)) {
    const ip = clientIp(req);
    // a repeated reload from the same IP does not inflate the count (per instance, best-effort — same as /r/)
    if (!rateLimit(`link-click:ig:${ip}`, 1, 30 * 60_000)) scheduleLinkClick("ig", ip, req.headers.get("user-agent") ?? "", `${url.pathname}${url.search}`);
  }
  const res = NextResponse.redirect(url, 302);
  res.headers.set("Cache-Control", "no-store"); // a cached 302 would skip the count
  return res;
}
