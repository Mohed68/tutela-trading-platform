import assert from "node:assert/strict";
import test from "node:test";
import { hashPassword, verifyPassword } from "./password.js";

test("local passwords use a versioned salted scrypt hash", async () => {
  const password = "phase-4a-characterization-only";
  const first = await hashPassword(password);
  const second = await hashPassword(password);

  assert.match(first, /^scrypt-v1\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
  assert.notEqual(first, second);
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword("incorrect-password", first), false);
});

test("malformed or unsupported password hashes fail closed", async () => {
  for (const value of [
    "",
    "scrypt-v1",
    "unsupported$salt$hash",
    "scrypt-v1$not-valid",
  ]) {
    assert.equal(await verifyPassword("password", value), false);
  }
});

