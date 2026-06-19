import { NextResponse } from "next/server";

// #AUTORELOAD: ritorna il build-id del deployment ATTUALMENTE servito (no-store →
// mai in cache). Legge le System Env di Vercel a RUNTIME (cambiano a ogni deploy;
// niente inlining build-time). Il client cattura la prima risposta come baseline e
// ricarica quando questo id cambia. Vedi useEffect #AUTORELOAD in app/app/page.tsx.
export const dynamic = "force-dynamic";

export function GET() {
  const id =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.VERCEL_DEPLOYMENT_ID ||
    process.env.VERCEL_URL ||
    "dev";
  return NextResponse.json(
    { id },
    { headers: { "cache-control": "no-store, max-age=0" } },
  );
}
