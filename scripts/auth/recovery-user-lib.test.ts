import assert from "node:assert/strict";
import test from "node:test";
import type { Client } from "pg";
import { verifyRecoveryMarker } from "../migrations/rehearsal-lib.js";
import {
  assertRecoveryUserEnvironment,
  readRecoveryCredentialInput,
} from "./recovery-user-lib.js";

test("recovery-user tooling refuses production, Render, and implicit mode", () => {
  assert.throws(
    () => assertRecoveryUserEnvironment({ NODE_ENV: "development" }),
    /RECOVERY_MODE_REQUIRED/,
  );
  assert.throws(
    () =>
      assertRecoveryUserEnvironment({
        NODE_ENV: "production",
        TUTELA_RECOVERY_MODE: "true",
      }),
    /PRODUCTION_MODE_FORBIDDEN/,
  );
  assert.throws(
    () =>
      assertRecoveryUserEnvironment({
        NODE_ENV: "development",
        RENDER: "true",
        TUTELA_RECOVERY_MODE: "true",
      }),
    /RENDER_FORBIDDEN/,
  );
});

test("recovery credentials require a non-real identifier and strong local secret", () => {
  assert.throws(
    () =>
      readRecoveryCredentialInput({
        TUTELA_RECOVERY_USER_EMAIL: "real@example.com",
        TUTELA_RECOVERY_USER_PASSWORD: "long-enough-password",
      }),
    /RECOVERY_IDENTIFIER_MUST_BE_NON_REAL/,
  );
  assert.throws(
    () =>
      readRecoveryCredentialInput({
        TUTELA_RECOVERY_USER_EMAIL:
          "phase-4b@recovery.tutela.invalid",
        TUTELA_RECOVERY_USER_PASSWORD: "too-short",
      }),
    /RECOVERY_PASSWORD_LENGTH_INVALID/,
  );
  assert.deepEqual(
    readRecoveryCredentialInput({
      TUTELA_RECOVERY_USER_EMAIL:
        "phase-4b@recovery.tutela.invalid",
      TUTELA_RECOVERY_USER_PASSWORD: "long-enough-password",
    }),
    {
      email: "phase-4b@recovery.tutela.invalid",
      password: "long-enough-password",
    },
  );
});

test("recovery marker validation fails closed when the marker is absent", async () => {
  const client = {
    query: async () => ({
      rows: [{ count: "0", valid: null }],
    }),
  } as unknown as Client;

  await assert.rejects(
    () => verifyRecoveryMarker(client),
    /Recovery marker verification failed/,
  );
});

