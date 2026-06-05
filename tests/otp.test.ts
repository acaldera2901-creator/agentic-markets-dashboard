import assert from "node:assert/strict";
import { test } from "node:test";
import { generateCode, hashCode, codeMatches } from "../lib/otp.ts";

// otp.ts reads SESSION_SECRET lazily inside the functions, so setting it here
// (before any function call) is sufficient.
process.env.SESSION_SECRET = process.env.SESSION_SECRET || "test-secret-1234567890";

test("generateCode returns a 6-digit numeric string", () => {
  for (let i = 0; i < 200; i++) {
    const c = generateCode();
    assert.match(c, /^\d{6}$/, `bad code: ${c}`);
  }
});

test("hashCode is deterministic and never the plaintext", () => {
  const h = hashCode("123456");
  assert.equal(h, hashCode("123456"));
  assert.notEqual(h, "123456");
});

test("codeMatches true only for the exact code", () => {
  const h = hashCode("428913");
  assert.equal(codeMatches("428913", h), true);
  assert.equal(codeMatches("428914", h), false);
  assert.equal(codeMatches("", h), false);
  assert.equal(codeMatches("4289130", h), false);
});

test("different codes hash differently", () => {
  assert.notEqual(hashCode("000000"), hashCode("000001"));
});
