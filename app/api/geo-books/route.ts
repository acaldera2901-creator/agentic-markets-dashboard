import { NextRequest, NextResponse } from "next/server";
import { geoAllowed } from "@/lib/sportsbooks";

export const dynamic = "force-dynamic";

// #PRELAUNCH-AUDIT LEGALE-2 layer2 + #ITALIA-EU-PARERE (decisione Andrea 2026-07-10):
// dice al client se l'utente è in una giurisdizione dove i link-book vanno nascosti.
// Geo dall'header Vercel/Cloudflare (server-side, non falsificabile dal client).
// Ribaltato da blocklist-IT ad ALLOWLIST: blocked=false SOLO se la geo è
// nell'allowlist SPORTSBOOK_GEO_ALLOWLIST (stessa policy di lib/sportsbooks —
// hard-block IT/BE/NL incluso). Default nascosto.
export function GET(req: NextRequest) {
  const country = (req.headers.get("x-vercel-ip-country") || req.headers.get("cf-ipcountry") || "")
    .trim()
    .toUpperCase();
  return NextResponse.json({ blocked: !geoAllowed(country) });
}
