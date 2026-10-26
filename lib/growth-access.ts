/**
 * View-only access to /admin/growth with a secret distinct from ADMIN_SECRET.
 *
 * GROWTH_VIEW_SECRET opens /admin/growth and nothing else: its session lives
 * in a separate cookie (growth_token), is signed with its own key under its
 * own prefix (so it can never verify as an admin token, even if both secrets
 * were equal), and no other admin page or /api/admin/* route reads it.
 * ADMIN_SECRET keeps opening /admin/growth as before. Fail-closed: an unset
 * GROWTH_VIEW_SECRET grants nothing. Edge-safe (imported by middleware).
 */
import { verifyAdminToken } from "@/lib/admin-session";

export const GROWTH_COOKIE = "growth_token";
export const GROWTH_PATH = "/admin/growth";
export const GROWTH_SESSION_PREFIX = "growth-view-session|";

export function isGrowthPath(pathname: string): boolean {
  return pathname === GROWTH_PATH || pathname.startsWith(GROWTH_PATH + "/");
}

export async function canViewGrowth(
  adminToken: string | null | undefined,
  growthToken: string | null | undefined,
  env: Record<string, string | undefined> = process.env
): Promise<boolean> {
  if (env.ADMIN_SECRET && (await verifyAdminToken(adminToken, env.ADMIN_SECRET))) return true;
  if (!env.GROWTH_VIEW_SECRET) return false;
  return verifyAdminToken(growthToken, env.GROWTH_VIEW_SECRET, GROWTH_SESSION_PREFIX);
}
