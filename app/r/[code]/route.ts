import { NextResponse } from "next/server";

// #PRICING-CREATORS-0706 — link invito creator: betredge.com/r/CODICE.
// Redirect alla landing con ?ref=CODICE: la landing persiste il codice in
// localStorage (am_ref, first-touch) e il register lo allega al payload →
// profiles.referred_by (rail #MB-1 già esistente, nessuna logica nuova qui).
// Codice validato con la STESSA regex del register (app/api/auth): un codice
// malformato degrada a redirect pulito alla home, mai un errore.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const ref = (code ?? "").trim().toUpperCase().slice(0, 20);
  const url = new URL("/", req.url);
  if (/^[A-Z0-9_-]{2,20}$/.test(ref)) url.searchParams.set("ref", ref);
  return NextResponse.redirect(url, 302);
}
