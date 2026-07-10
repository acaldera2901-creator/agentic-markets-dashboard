import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// #PRELAUNCH-AUDIT LEGALE-2 layer2 (Italia · Decreto Dignità): dice al client se
// l'utente è in una giurisdizione dove i link-book vanno nascosti. Geo dall'header
// Vercel/Cloudflare (server-side, non falsificabile dal client). Stessa policy del
// hard-block in lib/sportsbooks (allineare i due set se se ne aggiungono altri).
const GEO_BLOCKED_COUNTRIES = new Set(["IT"]);

export function GET(req: NextRequest) {
  const country = (req.headers.get("x-vercel-ip-country") || req.headers.get("cf-ipcountry") || "")
    .trim()
    .toUpperCase();
  return NextResponse.json({ blocked: GEO_BLOCKED_COUNTRIES.has(country) });
}
