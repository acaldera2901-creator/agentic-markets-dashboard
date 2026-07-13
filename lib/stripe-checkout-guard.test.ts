// lib/stripe-checkout-guard.test.ts — #GOLIVE-QW-B
//
// The Stripe checkout route marks the caller's profile 'pending_payment' before
// redirecting to Stripe. Without a plan guard, any authenticated user hitting
// the endpoint would DOWNGRADE an already-active paid plan (base/premium) to
// pending_payment before paying a cent. The fix scopes the UPDATE with
// `plan IN ('free','pending_payment')`.
//
// Two guards, following the tests/exec-sql-returning-fix.test.ts precedent
// (model the exact SQL the route issues):
//   1. semantic model of the UPDATE WHERE clause — active plans untouched;
//   2. presence check on the real route source — the guard clause must exist,
//      so a future edit that drops it fails here.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

type Profile = { identifier: string; plan: string; requested_plan: string | null };

// Faithful model of the route's UPDATE:
//   SET plan='pending_payment', requested_plan=$2
//   WHERE (identifier=$1 OR lower(trim(identifier))=$1)
//     AND plan IN ('free','pending_payment')
function applyCheckoutUpdate(profiles: Map<string, Profile>, identifier: string, requested: string) {
  const key = identifier.trim().toLowerCase();
  for (const p of profiles.values()) {
    const idMatch = p.identifier === identifier || p.identifier.trim().toLowerCase() === key;
    const planMatch = p.plan === "free" || p.plan === "pending_payment";
    if (idMatch && planMatch) {
      p.plan = "pending_payment";
      p.requested_plan = requested;
    }
  }
}

describe("stripe checkout plan guard (#GOLIVE-QW-B)", () => {
  it("marks a free profile pending_payment", () => {
    const db = new Map<string, Profile>([
      ["u@x.io", { identifier: "u@x.io", plan: "free", requested_plan: null }],
    ]);
    applyCheckoutUpdate(db, "u@x.io", "base");
    expect(db.get("u@x.io")).toEqual({ identifier: "u@x.io", plan: "pending_payment", requested_plan: "base" });
  });

  it("keeps a pending_payment profile pending and updates requested_plan", () => {
    const db = new Map<string, Profile>([
      ["u@x.io", { identifier: "u@x.io", plan: "pending_payment", requested_plan: "base" }],
    ]);
    applyCheckoutUpdate(db, "u@x.io", "premium");
    expect(db.get("u@x.io")).toEqual({ identifier: "u@x.io", plan: "pending_payment", requested_plan: "premium" });
  });

  it("NEVER downgrades an active base plan", () => {
    const db = new Map<string, Profile>([
      ["u@x.io", { identifier: "u@x.io", plan: "base", requested_plan: null }],
    ]);
    applyCheckoutUpdate(db, "u@x.io", "premium");
    expect(db.get("u@x.io")!.plan).toBe("base");
  });

  it("NEVER downgrades an active premium plan", () => {
    const db = new Map<string, Profile>([
      ["u@x.io", { identifier: "u@x.io", plan: "premium", requested_plan: null }],
    ]);
    applyCheckoutUpdate(db, "u@x.io", "base");
    expect(db.get("u@x.io")!.plan).toBe("premium");
  });

  it("the real route keeps the plan-scope guard in its UPDATE", () => {
    const src = readFileSync(
      join(process.cwd(), "app/api/stripe/checkout/route.ts"),
      "utf8"
    );
    expect(src).toContain("plan IN ('free', 'pending_payment')");
  });
});
