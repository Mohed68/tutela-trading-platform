import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const adminAuth = readFileSync(join(root, "server/adminAuth.ts"), "utf8");
const routes = readFileSync(join(root, "server/routes.ts"), "utf8");

test("active Admin authorization uses Platform Authority and Session Assurance only", () => {
  assert.match(adminAuth, /resolvePlatformAuthority/);
  assert.match(adminAuth, /getSessionAssurance/);
  assert.doesNotMatch(adminAuth, /adminRole|is2FAEnabled|ROLE_PERMISSIONS|localStorage/);
});

test("controllers request permissions but cannot manufacture authority or assurance", () => {
  assert.doesNotMatch(routes, /resolvePlatformAuthority|markMfaSatisfied|markStepUpSatisfied/);
  assert.doesNotMatch(routes, /requirePermission\(['"](?:kyb:|users:|offers:|audit:|settings:|insights:)/);
});

test("session invalidation is bounded to authenticated session rows", () => {
  const source = readFileSync(join(root, "server/admin-security/sessionInvalidation.ts"), "utf8");
  assert.match(source, /sess #>> '\{passport,user\}' = \$1/);
  assert.doesNotMatch(source, /TRUNCATE|DROP TABLE|UPDATE public\.users/i);
});
