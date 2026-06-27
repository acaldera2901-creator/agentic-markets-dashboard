import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/admin-auth";
import { dbExecute } from "@/lib/db";
import { validateRule } from "@/lib/segments";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthorized(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as
    | { name?: string; description?: string; rule?: unknown; active?: boolean }
    | null;
  if (!body) return NextResponse.json({ error: "body required" }, { status: 400 });

  let ruleJson: string | null = null;
  if (body.rule !== undefined) {
    try {
      ruleJson = JSON.stringify(validateRule(body.rule));
    } catch (e) {
      return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 400 });
    }
  }

  try {
    await dbExecute(
      `UPDATE segments SET
         name = COALESCE($2, name),
         description = COALESCE($3, description),
         rule = COALESCE($4::jsonb, rule),
         active = COALESCE($5, active),
         updated_at = NOW()
       WHERE id = $1`,
      [id, body.name ?? null, body.description ?? null, ruleJson, body.active ?? null]
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: "update failed", detail: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthorized(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    await dbExecute("DELETE FROM segments WHERE id = $1", [id]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: "delete failed", detail: String(e) }, { status: 500 });
  }
}
