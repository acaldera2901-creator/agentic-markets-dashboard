// app/api/cron/closing-price/route.ts — #ANCORA-CHIUSURA-0917
//
// Raccoglie il prezzo dell'ancora nell'ultima ora prima del fischio, dove il
// cron a 2 ore di `/api/predictions/refresh` non arriva. Senza quest'ultimo
// punto non esiste una closing line, e senza closing line non esiste il CLV:
// misurato il 17/09, solo l'1,8% delle partite ha un prezzo entro 15 minuti dal
// via.
//
// Gira ogni 10 minuti ed e' quasi sempre un no-op: se nel nostro database non
// c'e' nessuna partita dentro la finestra, esce senza chiamare l'Odds API.
import { NextRequest, NextResponse } from "next/server";
import { verifyBearer } from "@/lib/admin-auth";
import { registraPrezzoAncora } from "@/lib/ancora-prezzi";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (!verifyBearer(req, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const esito = await registraPrezzoAncora();
  // L'esito si restituisce SEMPRE, anche a zero: un giro che non scrive nulla
  // perche' non c'era niente da scrivere e un giro rotto devono essere
  // distinguibili da fuori.
  return NextResponse.json({ ok: true, ...esito });
}
