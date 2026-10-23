import { NextResponse } from "next/server";
import { clickCountable, keptSourceParams, scheduleReferralClick } from "@/lib/affiliate/clicks";
import { clientIp, rateLimit } from "@/lib/rate-limit";

// #PRICING-CREATORS-0706 — link invito creator: betredge.com/r/CODICE.
// Redirect alla landing con ?ref=CODICE: la landing persiste il codice in
// localStorage (am_ref, first-touch) e il register lo allega al payload →
// profiles.referred_by (rail #MB-1 già esistente, nessuna logica nuova qui).
// Codice validato con la STESSA regex del register (app/api/auth): un codice
// malformato degrada a redirect pulito alla home, mai un errore.
// #AFFILIATE-CLICKS-1022 (B4): gli utm_*/src del link arrivano sulla landing
// (lib/attribution li cattura nel page_view) e il click si conta in
// affiliate_referral_clicks, solo per un affiliato attivo (lib/affiliate/clicks).
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  // audit #4: niente slice pre-regex — un codice >20 char è INVALIDO (redirect
  // pulito alla home), non troncato in silenzio in un codice diverso.
  const ref = (code ?? "").trim().toUpperCase();
  const url = new URL("/", req.url);
  const valid = /^[A-Z0-9_-]{2,20}$/.test(ref);
  if (valid) url.searchParams.set("ref", ref);
  const kept = keptSourceParams(new URL(req.url));
  for (const [k, v] of kept) url.searchParams.set(k, v);
  if (valid && clickCountable(req, kept)) {
    const ip = clientIp(req);
    // Un ricarica ripetuto dallo stesso IP non gonfia il conto (per istanza: best-effort).
    if (!rateLimit(`aff-click:${ref}:${ip}`, 1, 30 * 60_000)) {
      scheduleReferralClick(ref, ip, req.headers.get("user-agent") ?? "", `${url.pathname}${url.search}`);
    }
  }
  const res = NextResponse.redirect(url, 302);
  res.headers.set("Cache-Control", "no-store"); // un 302 in cache salterebbe il conteggio
  return res;
}
