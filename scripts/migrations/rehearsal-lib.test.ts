import assert from "node:assert/strict";
import test from "node:test";
import {
  RehearsalSafetyError,
  assertChecksum,
  redactedFailure,
  requireRawDatabaseUrl,
  sha256Text,
} from "./rehearsal-lib.js";

test("sha256Text is deterministic", () => {
  assert.equal(
    sha256Text("tutela"),
    "2a6cbdc42e0e9041d314fb4b4fe3993921a47bc776673eaa294b46b91c1ab75a",
  );
});

test("assertChecksum rejects mismatches without exposing values", () => {
  assert.throws(
    () => assertChecksum("expected", "actual", "0003"),
    (error: unknown) =>
      error instanceof RehearsalSafetyError &&
      error.code === "CHECKSUM_MISMATCH" &&
      !error.message.includes("expected") &&
      !error.message.includes("actual"),
  );
});

test("requireRawDatabaseUrl accepts PostgreSQL URLs", () => {
  assert.equal(
    requireRawDatabaseUrl("postgresql://user:secret@example.invalid/db"),
    "postgresql://user:secret@example.invalid/db",
  );
});

test("requireRawDatabaseUrl rejects missing and non-PostgreSQL values", () => {
  assert.throws(
    () => requireRawDatabaseUrl(undefined),
    (error: unknown) =>
      error instanceof RehearsalSafetyError &&
      error.code === "DATABASE_URL_MISSING",
  );
  assert.throws(
    () => requireRawDatabaseUrl("https://example.invalid"),
    (error: unknown) =>
      error instanceof RehearsalSafetyError &&
      error.code === "DATABASE_URL_INVALID",
  );
});

test("redactedFailure exposes only safe error categories", () => {
  const secret = "postgresql://user:password@example.invalid/db";
  const generic = redactedFailure(new Error(secret));
  const database = redactedFailure({ code: "23505", message: secret });
  assert.equal(generic, "REDACTED_MIGRATION_FAILURE");
  assert.equal(database, "DATABASE_ERROR_23505");
  assert.ok(!generic.includes(secret));
  assert.ok(!database.includes(secret));
});
