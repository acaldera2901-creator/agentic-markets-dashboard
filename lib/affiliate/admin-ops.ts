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
import { payoutCancelledEmail } from "./emails";
import { adminGuard, loadPayout, mailLangOf, notifyAffiliate } from "./payouts";
import { affiliateRpc, type RpcResult } from "./rpc";
import { maskAddress } from "./wallet";

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
    // #AFFILIATE-COMPLETE-1023: SPEC-ui §12 «nessun log di indirizzi interi» (mark-sent returns to_address).
    console.log(`[admin/affiliate/${tag}] ok actor=${actor} ${maskAddressesIn(JSON.stringify(res)).slice(0, 300)}`);
    await notifyCancelled((res as { cancelled_payout_ids?: unknown }).cancelled_payout_ids);
    return NextResponse.json(res);
  } catch (e) {
    console.error(`[admin/affiliate/${tag}] failed:`, String(e));
    return NextResponse.json({ error: `${tag} failed` }, { status: 500 });
  }
}

/** #AFFILIATE-COMPLETE-1023 — a suspension, a blocked address or an unmark can cancel payouts
 *  in preparation (SQL side effect): the affiliate gets the same generic email as a manual
 *  cancel (never the operator's reason). Best effort: the change is already committed. */
export async function notifyCancelled(ids: unknown): Promise<void> {
  if (!Array.isArray(ids)) return;
  for (const raw of ids) {
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) continue;
    try {
      const p = await loadPayout(id);
      if (!p || p.status !== "cancelled") continue;
      await notifyAffiliate(p.affiliate_identifier, payoutCancelledEmail({ lang: await mailLangOf(p.affiliate_identifier), amountUsd: p.amount_usd }));
    } catch (e) {
      console.error(`[admin/affiliate] cancellation email for payout ${id} failed:`, String(e));
    }
  }
}

/** Every 0x+40-hex address in a log line, masked like the UI (0x4b1e…91d7). */
export function maskAddressesIn(text: string): string {
  return text.replace(/0x[0-9a-fA-F]{40}(?![0-9a-fA-F])/g, (a) => maskAddress(a));
}

/** Una cella CSV: virgolette raddoppiate e niente formule (=, +, -, @ in testa). */
export function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s = typeof v === "object" ? JSON.stringify(v) : String(v);
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
