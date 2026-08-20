import { NextResponse } from "next/server";
import { internalInviteSpec } from "@/lib/internal-invite";

// #TG-TRIAL-SITE: dice quanti giorni di PRO regala UN codice invito preciso.
//
// Serve alla landing: se il canale Telegram promette «3 giorni di PRO» e la
// pagina di atterraggio non lo conferma, la promessa non vale niente. La
// alternativa era leggere `searchParams` in app/page.tsx, ma quello renderebbe
// dinamica la home — che è una pagina SEO servita statica. Meglio una fetch
// client, che parte SOLO quando l'URL ha un ?ref=.
//
// Non enumera nulla: risponde su un codice esatto e non dice mai quali esistono.
// Il numero di giorni non è un segreto, è l'offerta stessa.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get("code") ?? "";
  const spec = internalInviteSpec(code);
  if (!spec) return NextResponse.json({ ok: false }, { status: 404 });
  return NextResponse.json({ ok: true, code: spec.code, days: spec.days });
}
