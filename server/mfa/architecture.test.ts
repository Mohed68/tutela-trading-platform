import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const source = (path: string) => readFileSync(join(root, path), "utf8");

test("MFA credential, Session Assurance, and Platform Authority stay separate", () => {
  const mfa = [
    source("server/mfa/contracts.ts"),
    source("server/mfa/crypto.ts"),
    source("server/mfa/totp.ts"),
    source("server/mfa/service.ts"),
  ].join("\n");
  assert.doesNotMatch(
    mfa,
    /PLATFORM_ROLE|PLATFORM_PERMISSION|OrganizationVerification|TrustStatus|Eligibility|adminRole/,
  );
  assert.doesNotMatch(
    source("server/session-assurance/sessionAssurance.ts"),
    /encrypted_secret|recovery_code|generateTotp|verifyTotp/,
  );
});

test("MFA secret encryption never falls back to unrelated secrets", () => {
  const crypto = source("server/mfa/crypto.ts");
  assert.match(crypto, /MFA_ENCRYPTION_KEY/);
  assert.doesNotMatch(crypto, /SESSION_SECRET|DATABASE_URL|TEST_DATABASE_URL/);
  assert.match(crypto, /aes-256-gcm/);
  assert.match(crypto, /setAAD/);
  assert.match(crypto, /setAuthTag/);
});

test("production MFA routes expose no secret, hash, or storage DTO", () => {
  const auth = source("server/auth.ts");
  assert.match(auth, /\/api\/auth\/mfa\/enrollment/);
  assert.match(auth, /\/api\/auth\/mfa\/challenge/);
  assert.match(auth, /\/api\/auth\/mfa\/step-up/);
  assert.doesNotMatch(
    auth,
    /res\.json\([^)]*(?:encrypted_secret|secret_auth_tag|code_hash|code_salt|last_accepted_counter)/,
  );
});

test("normal MFA and privileged step-up are distinct server events", () => {
  const auth = source("server/auth.ts");
  const challenge = auth.slice(
    auth.indexOf('"/api/auth/mfa/challenge"'),
    auth.indexOf('"/api/auth/mfa/step-up"'),
  );
  assert.match(challenge, /markMfaSatisfied/);
  assert.doesNotMatch(challenge, /markStepUpSatisfied/);
  const stepUp = auth.slice(auth.indexOf('"/api/auth/mfa/step-up"'));
  assert.doesNotMatch(stepUp, /hasMfaAssurance\(req\.session\)/);
  assert.match(stepUp, /service\.verifyChallenge\([\s\S]*result\.method !== "totp"[\s\S]*markMfaSatisfied\(req\.session[\s\S]*markStepUpSatisfied\(req\.session/);
  assert.match(stepUp, /markStepUpSatisfied/);
});

test("MFA migration is additive and contains no plaintext secret column", () => {
  const migration = source("migrations/0018_totp_mfa_credentials.sql");
  assert.doesNotMatch(migration, /^\s*(?:DROP|TRUNCATE|DELETE|UPDATE)\b/imu);
  assert.doesNotMatch(migration, /plaintext_secret|recovery_code\s+(?:text|varchar)/i);
  assert.match(migration, /encrypted_secret bytea/);
  assert.match(migration, /code_hash bytea/);
});

test("test migration mode cannot fall back to runtime DATABASE_URL", () => {
  const runner = source("scripts/run-mfa-migration.mjs");
  const testBranch = runner.slice(
    runner.indexOf("if (testMode)"),
    runner.indexOf("const runtimeUrl", runner.indexOf("if (testMode)")) + 120,
  );
  assert.match(testBranch, /TEST_DATABASE_URL_REQUIRED/);
  assert.doesNotMatch(testBranch, /TEST_DATABASE_URL\s*\?\?/);
  assert.match(runner, /TEST_DATABASE_URL_AMBIGUOUS/);
});
