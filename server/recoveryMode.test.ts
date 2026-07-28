import assert from "node:assert/strict";
import test from "node:test";
import {
  assertRecoveryModeIsLocal,
  isRecoveryMode,
  isSafeRecoveryRequest,
  shouldInitializeExternalMonitoring,
  shouldRunStartupSeeding,
} from "./recoveryMode.js";
import { safeErrorMessage } from "./safeErrors.js";

test("recovery mode is opt-in and preserves normal defaults", () => {
  assert.equal(isRecoveryMode({ NODE_ENV: "development" }), false);
  assert.equal(shouldRunStartupSeeding({ NODE_ENV: "development" }), true);
  assert.equal(
    shouldInitializeExternalMonitoring({ NODE_ENV: "development" }),
    true,
  );
});

test("recovery mode disables startup seed and external monitoring", () => {
  const environment = {
    NODE_ENV: "development",
    TUTELA_RECOVERY_MODE: "true",
  };
  assert.equal(isRecoveryMode(environment), true);
  assert.equal(shouldRunStartupSeeding(environment), false);
  assert.equal(shouldInitializeExternalMonitoring(environment), false);
  assert.doesNotThrow(() => assertRecoveryModeIsLocal(environment));
});

test("recovery mode rejects production and Render environments", () => {
  assert.throws(
    () =>
      assertRecoveryModeIsLocal({
        NODE_ENV: "production",
        TUTELA_RECOVERY_MODE: "true",
      }),
    /NODE_ENV=production/,
  );
  assert.throws(
    () =>
      assertRecoveryModeIsLocal({
        NODE_ENV: "development",
        RENDER: "true",
        TUTELA_RECOVERY_MODE: "true",
      }),
    /Render/,
  );
});

test("recovery mode allows only approved read-only marketplace routes", () => {
  for (const path of [
    "/api/offers",
    "/api/offers/options",
    "/api/offers/search",
    "/api/offers/summary",
  ]) {
    assert.equal(isSafeRecoveryRequest("GET", path), true);
    assert.equal(isSafeRecoveryRequest("HEAD", path), true);
    assert.equal(isSafeRecoveryRequest("POST", path), false);
  }

  assert.equal(isSafeRecoveryRequest("GET", "/api/offers/private"), false);
  assert.equal(isSafeRecoveryRequest("GET", "/admin"), false);
});

test("recovery mode permits the auth loop and safe dashboard overview", () => {
  assert.equal(isSafeRecoveryRequest("GET", "/api/auth/user"), true);
  assert.equal(isSafeRecoveryRequest("HEAD", "/api/auth/user"), true);
  assert.equal(isSafeRecoveryRequest("POST", "/api/auth/login"), true);
  assert.equal(isSafeRecoveryRequest("POST", "/api/auth/logout"), true);
  assert.equal(
    isSafeRecoveryRequest("GET", "/api/dashboard/overview"),
    true,
  );
  assert.equal(
    isSafeRecoveryRequest("HEAD", "/api/dashboard/overview"),
    true,
  );
  assert.equal(
    isSafeRecoveryRequest("POST", "/api/dashboard/overview"),
    false,
  );
  assert.equal(isSafeRecoveryRequest("GET", "/api/logout"), false);
  assert.equal(
    isSafeRecoveryRequest("GET", "/api/dashboard/metrics"),
    false,
  );
  assert.equal(isSafeRecoveryRequest("POST", "/api/auth/register"), false);
  assert.equal(isSafeRecoveryRequest("PATCH", "/api/auth/preferences"), false);
});

test("safe errors redact configured secrets and URL credentials", () => {
  const databaseUrl =
    "postgresql://private-user:private-password@example.invalid/database";
  const message = safeErrorMessage(
    new Error(`Unable to connect to ${databaseUrl}`),
    {
      DATABASE_URL: databaseUrl,
      SESSION_SECRET: "private-session-secret",
    },
  );

  assert.equal(message, "Unable to connect to [REDACTED]");
  assert.ok(!message.includes("private-user"));
  assert.ok(!message.includes("private-password"));
});
