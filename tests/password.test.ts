import assert from "node:assert/strict";
import { test } from "node:test";
import { hashPassword, verifyPassword, MIN_PASSWORD_LENGTH } from "../lib/password.ts";

test("hash is salted: same password -> different hashes", () => {
  assert.notEqual(hashPassword("correct horse battery"), hashPassword("correct horse battery"));
});

test("verifyPassword true for the right password, false otherwise", () => {
  const h = hashPassword("s3cret-pass");
  assert.equal(verifyPassword("s3cret-pass", h), true);
  assert.equal(verifyPassword("s3cret-Pass", h), false);
  assert.equal(verifyPassword("", h), false);
});

test("verifyPassword rejects malformed / null stored values", () => {
  assert.equal(verifyPassword("x", null), false);
  assert.equal(verifyPassword("x", "not-a-hash"), false);
  assert.equal(verifyPassword("x", "scrypt$onlytwo"), false);
  assert.equal(verifyPassword("x", "bcrypt$abc$def"), false);
});

test("stored format is scrypt$salt$hash", () => {
  const parts = hashPassword("whatever").split("$");
  assert.equal(parts.length, 3);
  assert.equal(parts[0], "scrypt");
  assert.ok(parts[1].length > 0 && parts[2].length > 0);
});

test("min length constant is sane", () => {
  assert.ok(MIN_PASSWORD_LENGTH >= 8);
});
