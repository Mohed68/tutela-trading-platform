import assert from "node:assert/strict";
import test from "node:test";
import {
  assertRecoveryModeIsLocal,
  isRecoveryMode,
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
