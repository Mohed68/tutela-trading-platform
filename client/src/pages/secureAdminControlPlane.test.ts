import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const page = fs.readFileSync(path.join(root, "client/src/pages/SecureAdminControlPlane.tsx"), "utf8");
const guard = fs.readFileSync(path.join(root, "client/src/components/navigation/RouteGuard.tsx"), "utf8");
const vre = fs.readFileSync(path.join(root, "client/src/components/admin/VreWorkbench.tsx"), "utf8");

test("Admin frontend consumes server authority and never manufactures it", () => {
  assert.match(guard, /\/admin\/auth\/info/);
  assert.doesNotMatch(guard, /requireRoles=\{\["admin"\]\}/);
  assert.doesNotMatch(page + guard, /localStorage|sessionStorage|adminRole|is2FAEnabled|mfaSatisfied/);
});

test("VRE workbench preserves domain separation and describes bounded active enforcement consumption",()=>{
  assert.match(vre,/Self-attestation is Evidence/);
  assert.match(vre,/does not approve the Organization or set Trust/);
  assert.match(vre,/signal never imposes an enforcement state/);
  assert.match(vre,/Current V2 command guard consumes only matching authoritative actions/is);
  assert.match(vre,/RESTRICTED requires explicit actions/);
  assert.match(vre,/Historical facts will remain intact/);
  assert.doesNotMatch(vre,/Force Verified|Mark Trusted|Set Eligibility/);
});

test("Control Plane exposes honest maturity labels and safe endpoints", () => {
  assert.match(page, /DEFINED/);
  assert.match(page, /ACTIVE_BASELINE/);
  assert.match(page, /No unimplemented capability is presented as operational/);
  assert.match(page, /\/admin\/control-plane\/overview/);
  assert.match(page, /\/admin\/platform\/owners/);
  assert.doesNotMatch(page, /password|recoveryCodes|encryptedSecret/);
});

test("platform role choices use the canonical server vocabulary", () => {
  assert.match(page, /VERIFICATION_REVIEWER/);
  assert.match(page, /OPERATIONS/);
  assert.doesNotMatch(page, /COMPLIANCE_REVIEWER|RISK_ANALYST|TRADE_OPERATIONS/);
});

test("privileged actions require explicit post-step-up confirmation", () => {
  assert.match(page, /explicitly submit this action again/i);
  assert.doesNotMatch(page, /stepUp\(\).*grantRole\(|await stepUp\(\).*await grantRole/s);
});

test("privileged step-up uses a grouped numeric authenticator entry and safe failure copy", () => {
  assert.match(page, /TotpCodeInput/);
  assert.match(page, /The code could not be verified\. Wait for a new authenticator code and try again\./);
  assert.doesNotMatch(page, /<Input aria-label="Current authenticator code"/);
});
