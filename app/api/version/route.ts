import { NextResponse } from "next/server";

// #AUTORELOAD: ritorna il build-id del deployment ATTUALMENTE servito (no-store →
// mai in cache). Le schede aperte confrontano questo id con quello con cui sono
// state caricate (NEXT_PUBLIC_BUILD_ID, inlinato a build-time): se differisce, è
// uscito un nuovo deploy → si ricaricano. Vedi useEffect #AUTORELOAD in app/app/page.tsx.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { id: process.env.NEXT_PUBLIC_BUILD_ID ?? "dev" },
    { headers: { "cache-control": "no-store, max-age=0" } },
  );
}
