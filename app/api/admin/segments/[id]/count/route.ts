import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/admin-auth";
import { dbQuery } from "@/lib/db";
import { validateRule, buildSegmentQuery } from "@/lib/segments";

export const dynamic = "force-dynamic";

// Preview conteggio: accetta una `rule` arbitraria nel body (anche non salvata)
// così l'editor del BO mostra il match count live. L'[id] nel path non è usato
// per la query (la rule arriva dal body) ma mantiene l'URL coerente.
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthorized(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { rule?: unknown } | null;
  let rule;
  try {
    rule = validateRule(body?.rule ?? { all: [] });
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 400 });
  }
  const { sql, params } = buildSegmentQuery(rule, { select: "count" });
  const rows = await dbQuery<{ n: number }>(sql, params);
  return NextResponse.json({ count: rows?.[0]?.n ?? 0 });
}
