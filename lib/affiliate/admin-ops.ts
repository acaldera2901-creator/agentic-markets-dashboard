// lib/affiliate/admin-ops.ts — #AFFILIATE-OPS-1022
// Strumenti operatore chiamati dal backoffice (server-to-server, Bearer
// ADMIN_SECRET) o da /admin del sito (cookie). Ogni azione è UNA funzione SQL
// (migration 20261022130000) con lock e riga in affiliate_admin_actions; qui
// solo auth, input e chi è l'operatore.
//
// Identità (R-B): l'auth admin è un segreto condiviso, quindi l'operatore lo
// DICHIARA il backoffice nell'header `x-admin-actor` (la sua sessione
// bo_admins), accettato solo se il Bearer è davvero ADMIN_SECRET. Dal cookie di
// /admin resta «admin-cookie». Una scrittura via Bearer senza operatore è
// rifiutata: il registro deve dire chi.

import { NextResponse, type NextRequest } from "next/server";
import { verifyBearer } from "@/lib/admin-auth";
import { adminGuard } from "./payouts";
import { affiliateRpc, type RpcResult } from "./rpc";

const ACTOR = /^[A-Za-z0-9._%+@:-]{2,120}$/;

/** Chi agisce, o null se una chiamata Bearer non dichiara l'operatore. */
export function adminActor(req: Request): string | null {
  if (verifyBearer(req, process.env.ADMIN_SECRET)) {
    const a = (req.headers.get("x-admin-actor") ?? "").trim();
    return ACTOR.test(a) ? `bo:${a}` : null;
  }
  return "admin-cookie";
}

export function reasonOf(v: unknown): string | null {
  const r = typeof v === "string" ? v.trim() : "";
  return r.length >= 3 && r.length <= 500 ? r : null;
}

export function positiveId(raw: string): number | null {
  return /^[1-9][0-9]{0,15}$/.test(raw) ? Number(raw) : null;
}

/** Guardia + corpo JSON + operatore; poi `run`. Esiti SQL non ok → 409 (404 se not_found). */
export async function adminOp(
  req: NextRequest,
  tag: string,
  run: (body: Record<string, unknown>, actor: string) => Promise<NextResponse | { fn: string; args: Record<string, unknown> }>,
): Promise<NextResponse> {
  const denied = await adminGuard(req, true);
  if (denied) return denied;
  const actor = adminActor(req);
  if (!actor) return NextResponse.json({ error: "actor_required" }, { status: 400 });
  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("not an object");
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  try {
    const step = await run(body, actor);
    if (step instanceof NextResponse) return step;
    const res = await affiliateRpc<RpcResult>(step.fn, step.args);
    if (!res.ok) return NextResponse.json(res, { status: res.error === "not_found" ? 404 : 409 });
    console.log(`[admin/affiliate/${tag}] ok actor=${actor} ${JSON.stringify(res).slice(0, 300)}`);
    return NextResponse.json(res);
  } catch (e) {
    console.error(`[admin/affiliate/${tag}] failed:`, String(e));
    return NextResponse.json({ error: `${tag} failed` }, { status: 500 });
  }
}

/** Una cella CSV: virgolette raddoppiate e niente formule (=, +, -, @ in testa). */
export function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s = typeof v === "object" ? JSON.stringify(v) : String(v);
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
