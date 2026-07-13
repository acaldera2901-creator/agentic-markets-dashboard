import { NextRequest, NextResponse } from "next/server";
import { GEO_BLOCKED_COUNTRIES } from "@/lib/sportsbooks";

export const dynamic = "force-dynamic";

// #GOLIVE-HIGH-D (audit go-live legale): dice al client se l'utente è in una
// giurisdizione dove i link-book/casino vanno nascosti. Geo dall'header
// Vercel/Cloudflare (server-side, non falsificabile dal client). La blocklist è la
// STESSA costante di lib/sportsbooks (fonte unica di verità: nessun set da allineare).

export function GET(req: NextRequest) {
  const country = (req.headers.get("x-vercel-ip-country") || req.headers.get("cf-ipcountry") || "")
    .trim()
    .toUpperCase();
  return NextResponse.json({ blocked: GEO_BLOCKED_COUNTRIES.has(country) });
}
