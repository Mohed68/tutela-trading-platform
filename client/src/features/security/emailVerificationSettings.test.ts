import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const source = fs.readFileSync(path.join(process.cwd(), "client/src/features/security/EmailVerificationSettings.tsx"), "utf8");

test("Settings requests verification only for the authenticated session", () => {
  assert.match(source, /\/api\/auth\/email-verification\/request/);
  assert.match(source, /apiRequest\("POST", "\/api\/auth\/email-verification\/request", \{\}\)/);
  assert.doesNotMatch(source, /targetUserId|targetEmail/);
  assert.doesNotMatch(source, /token|localStorage|sessionStorage/);
});

test("Settings exposes honest verified and unverified states", () => {
  assert.match(source, /Send verification email/);
  assert.match(source, /Verified/);
  assert.match(source, /Unverified/);
  assert.match(source, /Verification email sent to/);
});
