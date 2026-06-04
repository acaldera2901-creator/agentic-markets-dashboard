import type { Plan } from "@/lib/auth";

export const ADMIN_IDENTIFIER = "acaldera2901@gmail.com";
export const ADMIN_PROFILE_PLAN: Plan = "admin_full";

const ASSIGNABLE_PLANS = new Set<Plan>([
  "free",
  "pending_payment",
  "base",
  "premium",
  "admin_full",
]);

export function normalizeIdentifier(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim().toLowerCase();
  if (!value || value.length > 320) return null;
  return value;
}

export function isAdminIdentifier(raw: unknown): boolean {
  return normalizeIdentifier(raw) === ADMIN_IDENTIFIER;
}

export function normalizeAssignablePlan(raw: unknown): Plan | null {
  if (typeof raw !== "string") return null;
  return ASSIGNABLE_PLANS.has(raw as Plan) ? raw as Plan : null;
}

export function defaultPlanForIdentifier(identifier: string): Plan {
  return isAdminIdentifier(identifier) ? ADMIN_PROFILE_PLAN : "free";
}
