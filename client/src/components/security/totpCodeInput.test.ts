import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("client/src/components/security/TotpCodeInput.tsx", "utf8");

test("TOTP input is a six-digit, grouped, paste-capable numeric control", () => {
  assert.match(source, /maxLength=\{6\}/);
  assert.match(source, /pattern=\{REGEXP_ONLY_DIGITS\}/);
  assert.match(source, /inputMode="numeric"/);
  assert.match(source, /autoComplete="one-time-code"/);
  assert.match(source, /InputOTPSlot index=\{0\}[\s\S]*InputOTPSlot index=\{5\}/);
  assert.match(source, /InputOTPSeparator/);
});

test("TOTP input explains authenticator usage without claiming a TUTELA mobile app", () => {
  assert.match(source, /Open the authenticator app linked to your TUTELA account/);
  assert.match(source, /Codes normally refresh every 30 seconds\./);
  assert.match(source, /This is not a recovery code\./);
  assert.doesNotMatch(source, /TUTELA app code/);
});
