// /dev/flag?set=on|off|clear&to=/dev/ds (#REDESIGN-V3C F0)
// Imposta il cookie di override del redesign e torna alla pagina indicata.
// Non tocca dati: è un cookie di presentazione, leggibile dal client, 30 giorni.
// Serve a provare il redesign su una preview con NEXT_PUBLIC_REDESIGN spento.
import { NextRequest, NextResponse } from "next/server";
import { REDESIGN_COOKIE, safeReturnPath } from "@/lib/redesign-flag";

const THIRTY_DAYS = 60 * 60 * 24 * 30;

export function GET(req: NextRequest) {
  const set = req.nextUrl.searchParams.get("set");
  const to = safeReturnPath(req.nextUrl.searchParams.get("to"));
  const url = new URL(to, req.nextUrl.origin);
  const res = NextResponse.redirect(url, 303);

  if (set === "on" || set === "off") {
    res.cookies.set(REDESIGN_COOKIE, set === "on" ? "1" : "0", {
      path: "/",
      maxAge: THIRTY_DAYS,
      sameSite: "lax",
      secure: req.nextUrl.protocol === "https:",
    });
  } else if (set === "clear") {
    res.cookies.set(REDESIGN_COOKIE, "", { path: "/", maxAge: 0 });
  }
  return res;
}
