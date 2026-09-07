import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const source = (path: string) => readFileSync(join(root, path), "utf8");

test("session assurance has no database, HTTP, client, or MFA challenge authority", () => {
  const implementation = [
    source("server/session-assurance/contracts.ts"),
    source("server/session-assurance/policy.ts"),
    source("server/session-assurance/sessionAssurance.ts"),
  ].join("\n");
  assert.doesNotMatch(
    implementation,
    /DATABASE_URL|TEST_DATABASE_URL|process\.env|pool\.query|app\.(?:get|post|patch|delete)|req\.body|req\.headers|localStorage|totp|otp|qr.?code|mfa.?secret/i,
  );
});

test("only successful server authentication establishes initial assurance", () => {
  const auth = source("server/auth.ts");
  assert.match(auth, /req\.login\([\s\S]*markAuthenticated\(req\.session\)/);
  assert.doesNotMatch(
    auth,
    /mark(?:Mfa|StepUp)Satisfied|markAuthenticated\([^)]*(?:body|headers|cookies)/,
  );
  assert.doesNotMatch(
    auth,
    /is2FAEnabled[\s\S]{0,120}markAuthenticated/,
  );
});

test("Passport login regenerates the session without preserving prior state", () => {
  const passportManager = source("node_modules/passport/lib/sessionmanager.js");
  const auth = source("server/auth.ts");
  assert.match(passportManager, /req\.session\.regenerate/);
  assert.match(passportManager, /options\.keepSessionInfo/);
  assert.doesNotMatch(auth, /keepSessionInfo\s*:\s*true/);
});

test("legacy Admin MFA interpretation remains isolated pending A1.2c", () => {
  const adminAuth = source("server/adminAuth.ts");
  assert.match(adminAuth, /is2FAEnabled/);
  assert.doesNotMatch(adminAuth, /session-assurance/);
});

test("account enrollment remains separate and public surface exposes no MFA implementation", () => {
  const schema = source("shared/schema.ts");
  const exports = source("server/session-assurance/index.ts");
  assert.match(schema, /is2FAEnabled: boolean\("is_2fa_enabled"\)/);
  assert.doesNotMatch(exports, /enroll|challenge|secret|totp|provider/i);
});

test("session-assurance vocabulary remains compatible with Platform Authority", () => {
  const platformContracts = source("server/platform-authority/contracts.ts");
  assert.match(
    platformContracts,
    /SessionAssurance = "authenticated" \| "mfa" \| "recent_step_up"/,
  );
  assert.doesNotMatch(
    source("server/session-assurance/sessionAssurance.ts"),
    /PLATFORM_ROLES|PLATFORM_PERMISSIONS|adminRole|PlatformPrincipal/,
  );
});
