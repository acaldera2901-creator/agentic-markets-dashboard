// tests/exec-sql-returning-fix.test.ts — BLOCKER-1 (payment activation)
//
// Faithful model of the production exec_sql RPC contract
// (supabase/migrations/20260524000000_initial_schema.sql:387): exec_sql wraps
// every statement in `SELECT ... FROM (<stmt>) t`. That wrapper is invalid SQL
// for a data-modifying statement, so exec_sql traps the error, runs the bare
// write (the side effect DOES happen) and returns '[]'. => Every INSERT/UPDATE/
// DELETE returns [] even with RETURNING; only plain SELECTs return rows.
//
// These tests reproduce the exact SQL statements the payment/entitlement code
// issues (webhook idempotency, activateStripePlan, activateAdminPlan,
// cancellation) against that contract, proving:
//   - the OLD RETURNING-based logic is inverted (every event looks like a dup),
//   - the NEW SELECT-then-write logic grants exactly once and skips replays.
import { test } from "node:test";
import assert from "node:assert/strict";

type Profile = {
  identifier: string;
  name: string | null;
  plan: string;
  requested_plan: string | null;
  plan_expires_at: string | null;
  stripe_subscription_id: string | null;
};

// In-memory store that honors the exec_sql contract.
class FakeDb {
  profiles = new Map<string, Profile>();
  stripeEvents = new Set<string>();
  eventsAudit = 0; // INSERT INTO events (audit) count

  seedProfile(p: Partial<Profile> & { identifier: string }) {
    this.profiles.set(p.identifier, {
      identifier: p.identifier,
      name: p.name ?? null,
      plan: p.plan ?? "free",
      requested_plan: p.requested_plan ?? null,
      plan_expires_at: p.plan_expires_at ?? null,
      stripe_subscription_id: p.stripe_subscription_id ?? null,
    });
  }

  private findProfile(key: string): Profile | undefined {
    if (this.profiles.has(key)) return this.profiles.get(key);
    const norm = key.toLowerCase().trim();
    for (const p of this.profiles.values()) {
      if (p.identifier.toLowerCase().trim() === norm) return p;
    }
    return undefined;
  }

  // Single entry point modeling exec_sql. `params` carry the $n values.
  exec(sql: string, params: unknown[] = []): Record<string, unknown>[] {
    const s = sql.trim().toLowerCase().replace(/\s+/g, " ");
    const p = (n: number) => params[n - 1];

    // ---- READS: only plain SELECT returns rows ----
    if (s.startsWith("select")) {
      if (s.includes("from stripe_events")) {
        const id = String(p(1));
        return this.stripeEvents.has(id) ? [{ event_id: id }] : [];
      }
      if (s.includes("select name, plan, requested_plan from profiles")) {
        const prof = this.profiles.get(String(p(1)));
        return prof
          ? [{ name: prof.name, plan: prof.plan, requested_plan: prof.requested_plan }]
          : [];
      }
      if (s.includes("plan as old_plan")) {
        const prof = this.findProfile(String(p(1)));
        return prof ? [{ identifier: prof.identifier, name: prof.name, old_plan: prof.plan }] : [];
      }
      if (s.includes("select identifier, language from profiles")) {
        const sub = String(p(1));
        for (const prof of this.profiles.values()) {
          if (prof.stripe_subscription_id === sub) {
            return [{ identifier: prof.identifier, language: null }];
          }
        }
        return [];
      }
      throw new Error("FakeDb: unhandled SELECT: " + sql);
    }

    // ---- WRITES: side effect applies, but ALWAYS return [] (RETURNING dropped) ----
    if (s.startsWith("insert into stripe_events")) {
      this.stripeEvents.add(String(p(1))); // ON CONFLICT DO NOTHING == idempotent add
      return [];
    }
    if (s.startsWith("insert into events")) {
      this.eventsAudit++;
      return [];
    }
    if (s.includes("set plan = requested_plan")) {
      const prof = this.profiles.get(String(p(1)));
      if (
        prof &&
        prof.plan === "pending_payment" &&
        (prof.requested_plan === "base" || prof.requested_plan === "premium")
      ) {
        prof.plan = prof.requested_plan;
        prof.requested_plan = null;
        prof.plan_expires_at = "computed+30d";
      }
      return [];
    }
    if (s.includes("stripe_subscription_id = coalesce")) {
      const prof = this.findProfile(String(p(1)));
      if (prof) {
        prof.plan = String(p(2));
        prof.requested_plan = null;
        if (p(3) != null) prof.stripe_subscription_id = String(p(3));
      }
      return [];
    }
    if (s.includes("set plan = 'free'") && s.includes("stripe_subscription_id = null")) {
      const sub = String(p(1));
      for (const prof of this.profiles.values()) {
        if (prof.stripe_subscription_id === sub) {
          prof.plan = "free";
          prof.stripe_subscription_id = null;
        }
      }
      return [];
    }
    throw new Error("FakeDb: unhandled WRITE: " + sql);
  }
}

// ---------------------------------------------------------------------------
// Reproductions of the exact statements issued by the fixed source files.
// ---------------------------------------------------------------------------

// OLD webhook idempotency (app/api/stripe/webhook/route.ts, pre-fix):
// INSERT ... ON CONFLICT DO NOTHING RETURNING event_id; process iff a row came back.
function shouldProcessOLD(db: FakeDb, eventId: string, eventType: string): boolean {
  const first = db.exec(
    `INSERT INTO stripe_events (event_id, event_type) VALUES ($1, $2)
     ON CONFLICT (event_id) DO NOTHING RETURNING event_id`,
    [eventId, eventType]
  );
  return first.length > 0;
}

// NEW webhook idempotency (post-fix): SELECT existence, then mark.
function shouldProcessNEW(db: FakeDb, eventId: string, eventType: string): boolean {
  const seen = db.exec(`SELECT event_id FROM stripe_events WHERE event_id = $1 LIMIT 1`, [eventId]);
  if (seen.length > 0) return false;
  db.exec(
    `INSERT INTO stripe_events (event_id, event_type) VALUES ($1, $2)
     ON CONFLICT (event_id) DO NOTHING`,
    [eventId, eventType]
  );
  return true;
}

type ActivatedRow = { identifier: string; name: string | null; plan: string };

// NEW activateStripePlan (lib/plan-grant.ts, post-fix): SELECT prev, UPDATE,
// notify only on real transition. Returns the activated row (never null-on-success).
function activateStripePlanNEW(
  db: FakeDb,
  identifier: string,
  plan: "base" | "premium",
  subId: string | null,
  notifySpy: () => void
): ActivatedRow | null {
  const prev = db.exec(
    `SELECT identifier, name, plan AS old_plan FROM profiles
      WHERE identifier = $1 OR LOWER(TRIM(identifier)) = $1 LIMIT 1`,
    [identifier]
  );
  const before = prev[0] as { identifier: string; name: string | null; old_plan: string } | undefined;
  if (!before) return null;
  db.exec(
    `UPDATE profiles p SET plan = $2, requested_plan = NULL,
        stripe_subscription_id = COALESCE($3, p.stripe_subscription_id), updated_at = NOW()
      WHERE p.identifier = $1`,
    [before.identifier, plan, subId]
  );
  if (before.old_plan !== plan) {
    db.exec(`INSERT INTO events (event_type) VALUES ('x')`, []); // audit side of notify
    notifySpy();
  }
  return { identifier: before.identifier, name: before.name, plan };
}

// OLD activateStripePlan: single UPDATE ... RETURNING -> [] -> returns null.
function activateStripePlanOLD(db: FakeDb, identifier: string): ActivatedRow | null {
  const rows = db.exec(
    `UPDATE profiles p SET plan = 'premium', stripe_subscription_id = COALESCE($2, p.stripe_subscription_id)
       FROM prev WHERE p.identifier = prev.identifier RETURNING p.identifier, p.name, p.plan`,
    [identifier, null]
  );
  return (rows[0] as ActivatedRow) ?? null;
}

// NEW activateAdminPlan (lib/plan-grant.ts, post-fix): SELECT pending, guarded UPDATE.
function activateAdminPlanNEW(db: FakeDb, identifier: string, notifySpy: () => void): ActivatedRow | null {
  const prev = db.exec(
    `SELECT name, plan, requested_plan FROM profiles WHERE identifier = $1 LIMIT 1`,
    [identifier]
  );
  const before = prev[0] as { name: string | null; plan: string; requested_plan: string | null } | undefined;
  if (
    !before ||
    before.plan !== "pending_payment" ||
    (before.requested_plan !== "base" && before.requested_plan !== "premium")
  ) {
    return null;
  }
  const newPlan = before.requested_plan;
  db.exec(
    `UPDATE profiles SET plan = requested_plan, requested_plan = NULL, updated_at = NOW()
      WHERE identifier = $1 AND plan = 'pending_payment' AND requested_plan IN ('base','premium')`,
    [identifier]
  );
  db.exec(`INSERT INTO events (event_type) VALUES ('x')`, []);
  notifySpy();
  return { identifier, name: before.name, plan: newPlan };
}

// NEW cancellation (webhook, post-fix): SELECT-before-update, then downgrade.
function cancelSubNEW(db: FakeDb, subId: string, emailSpy: (id: string) => void): void {
  const rows = db.exec(
    `SELECT identifier, language FROM profiles WHERE stripe_subscription_id = $1 LIMIT 1`,
    [subId]
  );
  db.exec(
    `UPDATE profiles SET plan = 'free', stripe_subscription_id = NULL, updated_at = NOW()
      WHERE stripe_subscription_id = $1`,
    [subId]
  );
  const c = rows[0] as { identifier: string } | undefined;
  if (c) emailSpy(c.identifier);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test("exec_sql contract: a write with RETURNING returns [] (side effect still applies)", () => {
  const db = new FakeDb();
  const r = db.exec(
    `INSERT INTO stripe_events (event_id, event_type) VALUES ($1,$2)
     ON CONFLICT (event_id) DO NOTHING RETURNING event_id`,
    ["evt_1", "invoice.paid"]
  );
  assert.deepEqual(r, [], "RETURNING output must be dropped -> []");
  assert.ok(db.stripeEvents.has("evt_1"), "but the row must actually be inserted");
});

test("REGRESSION: OLD idempotency is inverted — a brand-new event is wrongly skipped", () => {
  const db = new FakeDb();
  // First delivery of a never-seen event: OLD logic asks 'did RETURNING give a row?'
  // -> [] -> false -> treated as duplicate -> activation NEVER runs. This is BLOCKER-1.
  assert.equal(shouldProcessOLD(db, "evt_new", "invoice.paid"), false);
});

test("REGRESSION: OLD activateStripePlan returns null even though the plan was granted", () => {
  const db = new FakeDb();
  db.seedProfile({ identifier: "u@x.com", plan: "free" });
  const res = activateStripePlanOLD(db, "u@x.com");
  assert.equal(res, null, "RETURNING -> [] -> caller sees null (no audit/email)");
});

test("FIX: NEW idempotency — first delivery processes, replay is skipped", () => {
  const db = new FakeDb();
  assert.equal(shouldProcessNEW(db, "evt_A", "invoice.paid"), true, "first delivery must process");
  assert.equal(shouldProcessNEW(db, "evt_A", "invoice.paid"), false, "replay must be skipped");
  // A different event still processes.
  assert.equal(shouldProcessNEW(db, "evt_B", "invoice.paid"), true);
});

test("FIX: Stripe payment end-to-end — new invoice.paid grants premium exactly once; replay = no double grant", () => {
  const db = new FakeDb();
  db.seedProfile({ identifier: "buyer@x.com", plan: "free" });
  let notifies = 0;
  const notify = () => notifies++;

  // Webhook core: dedup gate + grant, as wired in route.ts.
  const handle = (eventId: string) => {
    if (!shouldProcessNEW(db, eventId, "invoice.paid")) return "skipped";
    activateStripePlanNEW(db, "buyer@x.com", "premium", "sub_1", notify);
    return "processed";
  };

  assert.equal(handle("evt_pay_1"), "processed");
  assert.equal(db.profiles.get("buyer@x.com")!.plan, "premium", "plan granted");
  assert.equal(notifies, 1, "notify fired once on the real transition");
  assert.equal(db.eventsAudit, 1, "audit row written once");

  // Stripe redelivers / replay of the SAME event id.
  assert.equal(handle("evt_pay_1"), "skipped", "duplicate must be skipped");
  assert.equal(db.profiles.get("buyer@x.com")!.plan, "premium");
  assert.equal(notifies, 1, "no second notify / no double receipt");
  assert.equal(db.eventsAudit, 1, "no second audit row");
});

test("FIX: admin/USDT activation — pending->requested plan once, notify once, second call is a no-op", () => {
  const db = new FakeDb();
  db.seedProfile({ identifier: "usdt-user", plan: "pending_payment", requested_plan: "base" });
  let notifies = 0;

  const first = activateAdminPlanNEW(db, "usdt-user", () => notifies++);
  assert.deepEqual(first, { identifier: "usdt-user", name: null, plan: "base" });
  assert.equal(db.profiles.get("usdt-user")!.plan, "base", "plan granted");
  assert.equal(notifies, 1);

  // Second click: no longer pending -> returns null, no double grant/notify.
  const second = activateAdminPlanNEW(db, "usdt-user", () => notifies++);
  assert.equal(second, null);
  assert.equal(notifies, 1);
});

test("FIX: cancellation — identifier captured BEFORE nulling sub id, then downgraded", () => {
  const db = new FakeDb();
  db.seedProfile({ identifier: "gone@x.com", plan: "premium", stripe_subscription_id: "sub_9" });
  const emailed: string[] = [];

  cancelSubNEW(db, "sub_9", (id) => emailed.push(id));
  assert.deepEqual(emailed, ["gone@x.com"], "cancellation email target resolved");
  const prof = db.profiles.get("gone@x.com")!;
  assert.equal(prof.plan, "free", "downgraded");
  assert.equal(prof.stripe_subscription_id, null, "sub id cleared");
});
