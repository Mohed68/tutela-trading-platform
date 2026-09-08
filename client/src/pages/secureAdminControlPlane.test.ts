import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const page = fs.readFileSync(path.join(root, "client/src/pages/SecureAdminControlPlane.tsx"), "utf8");
const guard = fs.readFileSync(path.join(root, "client/src/components/navigation/RouteGuard.tsx"), "utf8");

test("Admin frontend consumes server authority and never manufactures it", () => {
  assert.match(guard, /\/admin\/auth\/info/);
  assert.doesNotMatch(guard, /requireRoles=\{\["admin"\]\}/);
  assert.doesNotMatch(page + guard, /localStorage|sessionStorage|adminRole|is2FAEnabled|mfaSatisfied/);
});

test("Control Plane exposes honest maturity labels and safe endpoints", () => {
  assert.match(page, /DEFINED/);
  assert.match(page, /ACTIVE_BASELINE/);
  assert.match(page, /No unimplemented capability is presented as operational/);
  assert.match(page, /\/admin\/control-plane\/overview/);
  assert.match(page, /\/admin\/platform\/owners/);
  assert.doesNotMatch(page, /password|recoveryCodes|encryptedSecret/);
});

test("privileged actions require explicit post-step-up confirmation", () => {
  assert.match(page, /explicitly submit this action again/i);
  assert.doesNotMatch(page, /stepUp\(\).*grantRole\(|await stepUp\(\).*await grantRole/s);
});
