// Standalone test for lib/session.ts — run with:
//   node --test --experimental-strip-types tests/ts/session.test.mjs
// No JS test runner is installed in this project; node:test + type-stripping is enough
// for the pure crypto session logic (no Next/React imports in lib/session.ts).
import { test } from "node:test";
import assert from "node:assert/strict";

process.env.SESSION_SECRET = "test-secret-at-least-16-chars-long";

const { signSession, verifySession, SESSION_COOKIE } = await import(
  "../../lib/session.ts"
);

test("valid signature is accepted and identifier round-trips", () => {
  const token = signSession("user@example.com");
  const payload = verifySession(token);
  assert.ok(payload, "expected a payload");
  assert.equal(payload.identifier, "user@example.com");
  assert.equal(typeof payload.iat, "number");
});

test("tampered payload is rejected", () => {
  const token = signSession("user@example.com");
  const [body, sig] = token.split(".");
  // forge a higher-privilege identifier while keeping the original signature
  const forgedBody = Buffer.from(
    JSON.stringify({ identifier: "admin@example.com", iat: Math.floor(Date.now() / 1000) })
  ).toString("base64url");
  const forged = `${forgedBody}.${sig}`;
  assert.equal(verifySession(forged), null);
  // sanity: original still valid
  assert.ok(verifySession(`${body}.${sig}`));
});

test("tampered signature is rejected", () => {
  const token = signSession("user@example.com");
  const [body] = token.split(".");
  assert.equal(verifySession(`${body}.deadbeef`), null);
});

test("wrong secret is rejected", () => {
  const token = signSession("user@example.com", "test-secret-at-least-16-chars-long");
  assert.equal(verifySession(token, "another-secret-also-16-plus-chars"), null);
});

test("garbage / empty input is rejected", () => {
  assert.equal(verifySession(undefined), null);
  assert.equal(verifySession(""), null);
  assert.equal(verifySession("nodot"), null);
  assert.equal(verifySession(".onlysig"), null);
});

test("expired token is rejected", async () => {
  // craft a token with an old iat but a valid signature
  const secret = process.env.SESSION_SECRET;
  const crypto = await import("node:crypto");
  const oldIat = Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 31; // 31 days ago
  const body = Buffer.from(
    JSON.stringify({ identifier: "user@example.com", iat: oldIat })
  ).toString("base64url");
  const sig = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest()
    .toString("base64url");
  assert.equal(verifySession(`${body}.${sig}`), null);
});

test("cookie name is stable", () => {
  assert.equal(SESSION_COOKIE, "am_session");
});
