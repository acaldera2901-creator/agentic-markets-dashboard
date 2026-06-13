// app/api/bet-links/route.ts
import { NextRequest, NextResponse } from "next/server";
import { resolveBooks, buildBetUrl } from "@/lib/sportsbooks";
import type { BetSelection, BetLinkOption } from "@/lib/sportsbooks/types";

export const dynamic = "force-dynamic";

// GET: enablement per la geo dell'utente (decide se mostrare il CTA).
export async function GET(req: NextRequest) {
  const country = req.headers.get("x-vercel-ip-country");
  const enabled = resolveBooks(country).length > 0;
  return NextResponse.json({ enabled });
}

// POST: opzioni-link per una selezione. Geo-gate applicato in resolveBooks.
export async function POST(req: NextRequest) {
  const country = req.headers.get("x-vercel-ip-country");
  let sel: BetSelection;
  try {
    sel = (await req.json()) as BetSelection;
  } catch {
    return NextResponse.json({ options: [] });
  }
  if (!sel || typeof sel !== "object" || Array.isArray(sel)) {
    return NextResponse.json({ options: [] });
  }
  const options: BetLinkOption[] = resolveBooks(country).map((b) => {
    const { url, prefilled } = buildBetUrl(b, sel, country);
    return { id: b.id, name: b.name, logo: b.logo, url, prefilled };
  });
  return NextResponse.json({ options });
}
