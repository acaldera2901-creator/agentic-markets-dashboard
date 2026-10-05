// The v3 endpoints are not public yet. The board exposes estimate and edge for
// EVERY match, which today is gated per plan (lib/access-projection.ts); the
// Free/Pro projection of v3 is F8 work and needs Andrea's APPROVE. Until then a
// v3 route answers only when the redesign flag is on (preview) or to an admin.
import type { NextRequest } from "next/server";
import { isAdminAuthorized } from "@/lib/admin-auth";

export function redesignFlagOn(env: Record<string, string | undefined> = process.env): boolean {
  return env.NEXT_PUBLIC_REDESIGN === "1";
}

export async function v3Allowed(req: NextRequest): Promise<boolean> {
  if (redesignFlagOn()) return true;
  return isAdminAuthorized(req);
}
