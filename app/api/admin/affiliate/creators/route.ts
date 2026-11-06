// /api/admin/affiliate/creators — #CREATOR-OFFERS-1031 (B)
// GET ?cohort=standard|creator_human|creator_agent (assente = tutte) &months=1..24 (default 6)
// → KPI mensili per creator (click, signup, attivati, paganti, MRR attribuito,
// commissione maturata) + totali per coorte e mese. Sola lettura, auth admin.
// Contiene l'email degli affiliati: solo backoffice owner/admin.
import { NextResponse, type NextRequest } from "next/server";
import { adminGuard } from "@/lib/affiliate/payouts";
import { COHORTS, loadCreatorKpis, type Cohort } from "@/lib/affiliate/creators";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const denied = await adminGuard(req, false);
  if (denied) return denied;
  const q = new URL(req.url).searchParams;
  const rawCohort = q.get("cohort");
  if (rawCohort && !COHORTS.includes(rawCohort as Cohort)) {
    return NextResponse.json({ error: "invalid_cohort" }, { status: 400 });
  }
  const rawMonths = q.get("months") ?? "6";
  const months = /^[0-9]{1,2}$/.test(rawMonths) ? Number(rawMonths) : NaN;
  if (!(months >= 1 && months <= 24)) return NextResponse.json({ error: "invalid_months" }, { status: 400 });
  try {
    const data = await loadCreatorKpis((rawCohort as Cohort) || null, months);
    return NextResponse.json({ cohort: rawCohort || null, months, ...data });
  } catch (e) {
    console.error("[admin/affiliate/creators] failed:", String(e));
    return NextResponse.json({ error: "kpi unavailable" }, { status: 503 });
  }
}
