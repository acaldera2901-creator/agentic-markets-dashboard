import { type NextRequest, NextResponse } from "next/server";
import { checkBasicAuth } from "@/core/auth";

// Every route of this app sits behind one shared password (GROWTH_PASSWORD).
// Fail-closed: without the env var nothing is served.
export async function proxy(request: NextRequest) {
  const verdict = await checkBasicAuth(request.headers.get("authorization"), process.env.GROWTH_PASSWORD);
  if (verdict === "ok") return NextResponse.next();
  if (verdict === "missing-config") {
    return new NextResponse("Accesso non configurato: manca GROWTH_PASSWORD (min 12 caratteri).", { status: 503 });
  }
  return new NextResponse("Password richiesta.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="BetRedge Growth", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
