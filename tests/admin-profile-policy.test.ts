import assert from "node:assert/strict";
import {
  ADMIN_IDENTIFIER,
  ADMIN_PROFILE_PLAN,
  isAdminIdentifier,
  normalizeAssignablePlan,
  normalizeIdentifier,
} from "../lib/admin-profile-policy";

assert.equal(ADMIN_IDENTIFIER, "acaldera2901@gmail.com");
assert.equal(ADMIN_PROFILE_PLAN, "admin_full");

assert.equal(normalizeIdentifier("  ACALDERA2901@GMAIL.COM "), "acaldera2901@gmail.com");
assert.equal(isAdminIdentifier("  ACALDERA2901@GMAIL.COM "), true);
assert.equal(isAdminIdentifier("client@example.com"), false);

assert.equal(normalizeAssignablePlan("free"), "free");
assert.equal(normalizeAssignablePlan("pending_payment"), "pending_payment");
assert.equal(normalizeAssignablePlan("base"), "base");
assert.equal(normalizeAssignablePlan("premium"), "premium");
assert.equal(normalizeAssignablePlan("admin_full"), "admin_full");
assert.equal(normalizeAssignablePlan("enterprise"), null);
assert.equal(normalizeAssignablePlan(null), null);

console.log("admin profile policy ok");
