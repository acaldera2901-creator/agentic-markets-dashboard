import { NextRequest, NextResponse } from "next/server";
import { GEO_BLOCKED_COUNTRIES } from "@/lib/sportsbooks";

export const dynamic = "force-dynamic";

// #GOLIVE-HIGH-D (audit go-live legale): dice al client se l'utente è in una
// giurisdizione dove i link-book/casino vanno nascosti. Geo dall'header
// Vercel/Cloudflare (server-side, non falsificabile dal client). La blocklist è la
// STESSA costante di lib/sportsbooks (fonte unica di verità: nessun set da allineare).

// #PARTNERS-VELOBET-CASEA: oltre al blocked restituisce anche il `country` (ISO-2,
// "" se l'header manca). Serve ai partner che hanno un link DIVERSO per paese e
// nessun link neutro (Casea: solo NO/CH/FI) → il client sa quale mostrare senza un
// secondo endpoint. Nessun dato personale: è la geo che l'utente già conosce, e il
// consumo resta fail-closed (geo ignota → nessun link geo-ristretto).
export function GET(req: NextRequest) {
  const country = (req.headers.get("x-vercel-ip-country") || req.headers.get("cf-ipcountry") || "")
    .trim()
    .toUpperCase();
  return NextResponse.json({ blocked: GEO_BLOCKED_COUNTRIES.has(country), country });
}
