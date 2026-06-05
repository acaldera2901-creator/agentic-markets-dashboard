import { verifySession, SESSION_COOKIE } from "./session";
import { dbQuery } from "./db";

// Server-side access gating (P0 #1).
// The plan is ALWAYS resolved fresh from the `profiles` table here — never read from
// the cookie — so a stale/tampered cookie can never grant a higher plan than the DB stores.

export type Plan = "free" | "pending_payment" | "base" | "premium" | "admin_full";

export type SessionContext = {
  identifier: string;
  plan: Plan;
  name: string | null;
  plan_expires_at: string | null;
};

// Paid plans (base/premium) expire; admin_full and free do not. A plan past its
// expiry degrades to 'free' AT RUNTIME here — independent of the daily cron
// sweep — so an expired subscriber loses data access immediately, never lingering
// until the next cron run.
function effectivePlan(plan: Plan, expiresAt: string | null): Plan {
  if (plan !== "base" && plan !== "premium") return plan;
  if (!expiresAt) return plan; // legacy active rows with no expiry stay active
  return new Date(expiresAt).getTime() < Date.now() ? "free" : plan;
}

// Header-based cookie read: robust across Next.js versions (avoids the cookie() API
// that has breaking changes in this Next build — see AGENTS.md).
function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(/;\s*/)) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq) === name) return decodeURIComponent(part.slice(eq + 1));
  }
  return null;
}

export async function getSessionPlan(req: Request): Promise<SessionContext | null> {
  const token = readCookie(req, SESSION_COOKIE);
  const payload = verifySession(token);
  if (!payload) return null;
  const rows = await dbQuery<{ identifier: string; plan: Plan; name: string | null; plan_expires_at: string | null }>(
    "SELECT identifier, plan, name, plan_expires_at FROM profiles WHERE identifier = $1 OR LOWER(TRIM(identifier)) = $1 LIMIT 1",
    [payload.identifier]
  );
  if (!rows.length) return null;
  const expiresAt = rows[0].plan_expires_at ?? null;
  return {
    identifier: rows[0].identifier,
    plan: effectivePlan(rows[0].plan, expiresAt),
    name: rows[0].name ?? null,
    plan_expires_at: expiresAt,
  };
}

// Server-side mirror of the client predicates profileHasAccess / profileHasPremium.
export function planHasAccess(plan: Plan | null | undefined): boolean {
  return plan === "base" || plan === "premium" || plan === "admin_full";
}
export function planHasPremium(plan: Plan | null | undefined): boolean {
  return plan === "premium" || plan === "admin_full";
}

function jsonDeny(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

// Route guards. Usage in a route handler:
//   const { deny } = await requireAccess(req); if (deny) return deny;
export async function requireAccess(
  req: Request
): Promise<{ ctx: SessionContext | null; deny: Response | null }> {
  const ctx = await getSessionPlan(req);
  if (!ctx) return { ctx: null, deny: jsonDeny(401, "authentication required") };
  if (!planHasAccess(ctx.plan)) return { ctx, deny: jsonDeny(403, "active plan required") };
  return { ctx, deny: null };
}

export async function requirePremium(
  req: Request
): Promise<{ ctx: SessionContext | null; deny: Response | null }> {
  const ctx = await getSessionPlan(req);
  if (!ctx) return { ctx: null, deny: jsonDeny(401, "authentication required") };
  if (!planHasPremium(ctx.plan)) return { ctx, deny: jsonDeny(403, "premium plan required") };
  return { ctx, deny: null };
}

// Read-side access state — never denies. Writes still use requireAccess/requirePremium.
export type AccessState =
  | "anonymous" | "free" | "pending_payment" | "base" | "premium" | "admin_full";

export async function resolveAccessState(
  req: Request
): Promise<{ ctx: SessionContext | null; state: AccessState }> {
  const ctx = await getSessionPlan(req);
  if (!ctx) return { ctx: null, state: "anonymous" };
  return { ctx, state: ctx.plan as AccessState };
}
