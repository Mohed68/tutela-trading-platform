import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const { Client } = pg;
const MIGRATION_IDENTIFIER = "0011_self_service_registration";
const MIGRATION_FILENAME = "migrations/0011_self_service_registration.sql";
const EXPECTED_COLUMNS = [
  "consumed_at",
  "created_at",
  "expires_at",
  "id",
  "token_digest",
  "user_id",
];
const EXPECTED_CONSTRAINTS = [
  "email_verification_tokens_digest_check",
  "email_verification_tokens_pkey",
  "email_verification_tokens_user_id_fkey",
];
const EXPECTED_INDEXES = [
  "email_verification_tokens_digest_unique",
  "email_verification_tokens_pkey",
  "email_verification_tokens_user_idx",
];

function requireDatabaseUrl() {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) throw new Error("DATABASE_URL_REQUIRED");
  return value;
}

function gitRevision() {
  const renderRevision = process.env.RENDER_GIT_COMMIT?.trim();
  if (renderRevision && /^[0-9a-f]{40}$/i.test(renderRevision)) {
    return renderRevision.toLowerCase();
  }
  return execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
    windowsHide: true,
  }).trim();
}

async function assertPrerequisites(client) {
  const result = await client.query(`
    SELECT
      to_regclass('public.users') IS NOT NULL AS users_exists,
      to_regclass('public.tutela_migration_journal') IS NOT NULL AS journal_exists
  `);
  const prerequisite = result.rows[0];
  if (!prerequisite.users_exists || !prerequisite.journal_exists) {
    throw new Error("REGISTRATION_MIGRATION_PREREQUISITES_MISSING");
  }

  const predecessor = await client.query(
    `
      SELECT execution_status
      FROM public.tutela_migration_journal
      WHERE migration_identifier = '0010_verification_immutability'
    `,
  );
  if (
    predecessor.rowCount !== 1 ||
    predecessor.rows[0].execution_status !== "succeeded"
  ) {
    throw new Error("REGISTRATION_MIGRATION_PREDECESSOR_NOT_VERIFIED");
  }
}

async function tableExists(client) {
  const result = await client.query(
    "SELECT to_regclass('public.email_verification_tokens') IS NOT NULL AS exists",
  );
  return result.rows[0].exists;
}

async function assertRegistrationSchema(client) {
  const columns = await client.query(`
    SELECT column_name, data_type, is_nullable, character_maximum_length
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'email_verification_tokens'
    ORDER BY column_name
  `);
  const columnNames = columns.rows.map((row) => row.column_name);
  if (JSON.stringify(columnNames) !== JSON.stringify(EXPECTED_COLUMNS)) {
    throw new Error("REGISTRATION_MIGRATION_COLUMN_MISMATCH");
  }
  const columnByName = Object.fromEntries(
    columns.rows.map((column) => [column.column_name, column]),
  );
  if (
    columnByName.id.data_type !== "character varying" ||
    columnByName.id.is_nullable !== "NO" ||
    columnByName.user_id.data_type !== "character varying" ||
    columnByName.user_id.is_nullable !== "NO" ||
    columnByName.token_digest.data_type !== "character varying" ||
    columnByName.token_digest.character_maximum_length !== 64 ||
    columnByName.token_digest.is_nullable !== "NO" ||
    columnByName.expires_at.data_type !== "timestamp without time zone" ||
    columnByName.expires_at.is_nullable !== "NO" ||
    columnByName.consumed_at.data_type !== "timestamp without time zone" ||
    columnByName.consumed_at.is_nullable !== "YES" ||
    columnByName.created_at.data_type !== "timestamp without time zone" ||
    columnByName.created_at.is_nullable !== "NO"
  ) {
    throw new Error("REGISTRATION_MIGRATION_COLUMN_DEFINITION_MISMATCH");
  }

  const constraints = await client.query(`
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.email_verification_tokens'::regclass
    ORDER BY conname
  `);
  const constraintNames = constraints.rows.map((row) => row.conname);
  if (JSON.stringify(constraintNames) !== JSON.stringify(EXPECTED_CONSTRAINTS)) {
    throw new Error("REGISTRATION_MIGRATION_CONSTRAINT_MISMATCH");
  }

  const indexes = await client.query(`
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'email_verification_tokens'
    ORDER BY indexname
  `);
  const indexNames = indexes.rows.map((row) => row.indexname);
  if (JSON.stringify(indexNames) !== JSON.stringify(EXPECTED_INDEXES)) {
    throw new Error("REGISTRATION_MIGRATION_INDEX_MISMATCH");
  }

  const rowCount = await client.query(
    "SELECT count(*)::int AS count FROM public.email_verification_tokens",
  );
  if (rowCount.rows[0].count !== 0) {
    throw new Error("REGISTRATION_MIGRATION_UNEXPECTED_TOKEN_DATA");
  }
}

async function businessCounts(client) {
  const result = await client.query(`
    SELECT
      (SELECT count(*)::int FROM public.users) AS users,
      (SELECT count(*)::int FROM public.offers) AS offers,
      (SELECT count(*)::int FROM public.contracts) AS contracts
  `);
  return result.rows[0];
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationPath = path.join(root, MIGRATION_FILENAME);
const sql = await readFile(migrationPath, "utf8");
const checksum = crypto.createHash("sha256").update(sql).digest("hex");
const client = new Client({
  connectionString: requireDatabaseUrl(),
  connectionTimeoutMillis: 10_000,
});

try {
  await client.connect();
  if (process.argv.includes("--inspect")) {
    await client.query("BEGIN READ ONLY");
    const objects = await client.query(`
      SELECT
        to_regclass('public.users') IS NOT NULL AS users_exists,
        to_regclass('public.tutela_migration_journal') IS NOT NULL AS journal_exists,
        to_regclass('public.email_verification_tokens') IS NOT NULL AS registration_table_exists,
        to_regclass('public.offer_verification_attempts') IS NOT NULL AS verification_attempts_exists,
        to_regclass('public.offer_verification_findings') IS NOT NULL AS verification_findings_exists,
        to_regclass('public.offer_verification_events') IS NOT NULL AS verification_events_exists,
        to_regclass('public.offer_verification_commands') IS NOT NULL AS verification_commands_exists
    `);
    const journalRows = objects.rows[0].journal_exists
      ? await client.query(`
          SELECT migration_identifier, execution_status, sql_executed
          FROM public.tutela_migration_journal
          ORDER BY migration_identifier
        `)
      : { rows: [] };
    await client.query("ROLLBACK");
    console.log(
      JSON.stringify({
        mode: "read_only_inspection",
        objects: objects.rows[0],
        migrations: journalRows.rows,
      }),
    );
  } else {
    await client.query("BEGIN");
    await assertPrerequisites(client);

    const journal = await client.query(
      `
        SELECT checksum, execution_status, sql_executed
        FROM public.tutela_migration_journal
        WHERE migration_identifier = $1
      `,
      [MIGRATION_IDENTIFIER],
    );

    if (journal.rowCount === 1) {
      const entry = journal.rows[0];
      if (
        entry.checksum !== checksum ||
        entry.execution_status !== "succeeded" ||
        entry.sql_executed !== true ||
        !(await tableExists(client))
      ) {
        throw new Error("REGISTRATION_MIGRATION_EXISTING_STATE_INVALID");
      }
      await assertRegistrationSchema(client);
      await client.query("COMMIT");
      console.log("Registration migration already applied and verified.");
    } else {
      if (journal.rowCount !== 0 || (await tableExists(client))) {
        throw new Error("REGISTRATION_MIGRATION_STATE_COLLISION");
      }

      const before = await businessCounts(client);
      await client.query(
        `
          INSERT INTO public.tutela_migration_journal (
            migration_identifier,
            migration_filename,
            checksum,
            provenance,
            execution_path,
            git_revision,
            execution_status,
            sql_executed,
            included_in_bootstrap,
            notes
          )
          VALUES (
            $1, $2, $3, 'additive_migration',
            'existing_database_upgrade', $4, 'running', false, false,
            'Additive self-service registration email verification storage.'
          )
        `,
        [MIGRATION_IDENTIFIER, MIGRATION_FILENAME, checksum, gitRevision()],
      );
      await client.query(sql);
      await assertRegistrationSchema(client);
      const after = await businessCounts(client);
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        throw new Error("REGISTRATION_MIGRATION_BUSINESS_DATA_CHANGED");
      }

      await client.query(
        `
          UPDATE public.tutela_migration_journal
          SET
            execution_timestamp = now(),
            execution_status = 'succeeded',
            sql_executed = true
          WHERE migration_identifier = $1
        `,
        [MIGRATION_IDENTIFIER],
      );
      await client.query("COMMIT");
      console.log("Registration migration applied and verified successfully.");
    }
  }
} catch (error) {
  await client.query("ROLLBACK").catch(() => undefined);
  console.error(
    "Registration migration failed:",
    error instanceof Error ? error.message : "UNKNOWN_ERROR",
  );
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}
