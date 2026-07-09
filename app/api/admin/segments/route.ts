import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/admin-auth";
import { dbQuery, dbExecute } from "@/lib/db";
import { validateRule } from "@/lib/segments";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthorized(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await dbQuery(
    "SELECT id, key, name, description, rule, active, resend_segment, last_count, last_synced_at, created_at, updated_at FROM segments ORDER BY created_at DESC"
  );
  return NextResponse.json({ segments: rows ?? [] });
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthorized(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as
    | { key?: string; name?: string; description?: string; rule?: unknown; active?: boolean }
    | null;
  if (!body?.key || !body?.name) return NextResponse.json({ error: "key and name required" }, { status: 400 });
  if (!/^[a-z0-9_]+$/.test(body.key)) return NextResponse.json({ error: "key must be [a-z0-9_]" }, { status: 400 });

  let rule;
  try {
    rule = validateRule(body.rule ?? { all: [] });
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 400 });
  }

  try {
    // #PRELAUNCH-AUDIT: exec_sql non restituisce RETURNING → generiamo noi l'id e lo
    // passiamo nell'INSERT, così la risposta porta l'id reale (prima era sempre null).
    const id = randomUUID();
    await dbExecute(
      `INSERT INTO segments (id, key, name, description, rule, active)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
      [id, body.key, body.name, body.description ?? null, JSON.stringify(rule), body.active ?? true]
    );
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    console.error("[admin/segments] insert failed:", String(e));
    return NextResponse.json({ error: "insert failed" }, { status: 500 });
  }
}
