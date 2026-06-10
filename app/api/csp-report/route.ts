import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// LOW-26: CSP violation sink. The CSP ships Report-Only (next.config.ts) so it
// can't break the site; without a report endpoint, though, violations were
// invisible and the plan to promote CSP to enforcing could never be validated.
// Browsers POST a JSON report here; we log it (best-effort, never throws).
export async function POST(req: Request) {
  try {
    const body = await req.text();
    // Keep it bounded; CSP reports are small. Log for inspection in Vercel logs.
    console.warn("[csp-report]", body.slice(0, 2000));
  } catch {
    /* ignore malformed reports */
  }
  // 204: nothing to return to the browser's reporting agent.
  return new NextResponse(null, { status: 204 });
}
