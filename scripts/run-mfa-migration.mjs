import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const { Client } = pg;
const MIGRATION_IDENTIFIER = "0018_totp_mfa_credentials";
const MIGRATION_FILENAME = "migrations/0018_totp_mfa_credentials.sql";
const PREDECESSOR =
  "0017_organization_verification_artifact_fingerprint_compatibility";
const testMode = process.argv.includes("--test");

function requireTarget() {
  if (testMode) {
    const testUrl = process.env.TEST_DATABASE_URL?.trim();
    if (!testUrl) throw new Error("TEST_DATABASE_URL_REQUIRED");
    const runtimeUrl = process.env.DATABASE_URL?.trim();
    if (runtimeUrl && runtimeUrl === testUrl) {
      throw new Error("TEST_DATABASE_URL_AMBIGUOUS");
    }
    return testUrl;
  }
  const runtimeUrl = process.env.DATABASE_URL?.trim();
  if (!runtimeUrl) throw new Error("DATABASE_URL_REQUIRED");
  return runtimeUrl;
}

function gitRevision() {
  return execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
    windowsHide: true,
  }).trim();
}

async function assertSchema(client) {
  const objects = await client.query(`
    SELECT
      to_regclass('public.user_mfa_credentials')::text AS credentials,
      to_regclass('public.user_mfa_recovery_codes')::text AS recovery_codes
  `);
  if (
    objects.rows[0].credentials !== "user_mfa_credentials" ||
    objects.rows[0].recovery_codes !== "user_mfa_recovery_codes"
  ) {
    throw new Error("MFA_MIGRATION_TABLES_INVALID");
  }
  const columns = await client.query(`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('user_mfa_credentials', 'user_mfa_recovery_codes')
    ORDER BY table_name, column_name
  `);
  const names = new Set(
    columns.rows.map((row) => `${row.table_name}.${row.column_name}`),
  );
  for (const required of [
    "user_mfa_credentials.encrypted_secret",
    "user_mfa_credentials.secret_iv",
    "user_mfa_credentials.secret_auth_tag",
    "user_mfa_credentials.last_accepted_counter",
    "user_mfa_credentials.failed_attempts",
    "user_mfa_credentials.locked_until",
    "user_mfa_recovery_codes.code_salt",
    "user_mfa_recovery_codes.code_hash",
    "user_mfa_recovery_codes.used_at",
  ]) {
    if (!names.has(required)) throw new Error("MFA_MIGRATION_COLUMNS_INVALID");
  }
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationPath = path.join(root, MIGRATION_FILENAME);
const sql = await readFile(migrationPath, "utf8");
const checksum = crypto.createHash("sha256").update(sql).digest("hex");
const client = new Client({
  connectionString: requireTarget(),
  connectionTimeoutMillis: 15_000,
});

try {
  await client.connect();
  await client.query("BEGIN");
  const predecessor = await client.query(
    `SELECT execution_status FROM public.tutela_migration_journal
     WHERE migration_identifier = $1`,
    [PREDECESSOR],
  );
  if (
    predecessor.rowCount !== 1 ||
    !["succeeded", "verified"].includes(predecessor.rows[0].execution_status)
  ) {
    throw new Error("MFA_MIGRATION_PREDECESSOR_INVALID");
  }

  const existing = await client.query(
    `SELECT checksum, execution_status, sql_executed
     FROM public.tutela_migration_journal
     WHERE migration_identifier = $1`,
    [MIGRATION_IDENTIFIER],
  );
  if (existing.rowCount === 1) {
    const row = existing.rows[0];
    if (
      row.checksum !== checksum ||
      row.execution_status !== "succeeded" ||
      row.sql_executed !== true
    ) {
      throw new Error("MFA_MIGRATION_EXISTING_STATE_INVALID");
    }
    await assertSchema(client);
    await client.query("COMMIT");
    console.log("MFA migration already applied and verified.");
  } else {
    if (existing.rowCount !== 0) {
      throw new Error("MFA_MIGRATION_JOURNAL_COLLISION");
    }
    const collision = await client.query(`
      SELECT
        to_regclass('public.user_mfa_credentials') IS NOT NULL AS credentials,
        to_regclass('public.user_mfa_recovery_codes') IS NOT NULL AS recovery_codes
    `);
    if (collision.rows[0].credentials || collision.rows[0].recovery_codes) {
      throw new Error("MFA_MIGRATION_OBJECT_COLLISION");
    }
    const before = await client.query(`
      SELECT
        (SELECT count(*)::text FROM public.users) AS users,
        (SELECT count(*)::text FROM public.offers) AS offers,
        (SELECT count(*)::text FROM public.orders) AS orders,
        (SELECT count(*)::text FROM public.contracts) AS contracts
    `);
    await client.query(
      `INSERT INTO public.tutela_migration_journal (
        migration_identifier, migration_filename, checksum, provenance,
        execution_path, git_revision, execution_status, sql_executed,
        included_in_bootstrap, notes
      ) VALUES ($1, $2, $3, 'additive_migration',
        'existing_database_upgrade', $4, 'running', false, false,
        'Additive TOTP MFA credential and recovery-code storage.')`,
      [MIGRATION_IDENTIFIER, MIGRATION_FILENAME, checksum, gitRevision()],
    );
    await client.query(sql);
    await assertSchema(client);
    const after = await client.query(`
      SELECT
        (SELECT count(*)::text FROM public.users) AS users,
        (SELECT count(*)::text FROM public.offers) AS offers,
        (SELECT count(*)::text FROM public.orders) AS orders,
        (SELECT count(*)::text FROM public.contracts) AS contracts
    `);
    if (JSON.stringify(before.rows[0]) !== JSON.stringify(after.rows[0])) {
      throw new Error("MFA_MIGRATION_BUSINESS_DATA_CHANGED");
    }
    await client.query(
      `UPDATE public.tutela_migration_journal
       SET execution_timestamp = now(), execution_status = 'succeeded',
           sql_executed = true
       WHERE migration_identifier = $1`,
      [MIGRATION_IDENTIFIER],
    );
    await client.query("COMMIT");
    console.log("MFA migration applied and verified successfully.");
  }
} catch (error) {
  await client.query("ROLLBACK").catch(() => undefined);
  console.error(
    "MFA migration failed:",
    error instanceof Error ? error.message : "UNKNOWN_ERROR",
  );
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}
