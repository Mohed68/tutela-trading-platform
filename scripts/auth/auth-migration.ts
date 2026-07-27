import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { Client, type QueryResultRow } from "pg";
import {
  applicationSchemaFingerprint,
  requireRawDatabaseUrl,
  sha256File,
  verifyRecoveryMarker,
} from "../migrations/rehearsal-lib.js";

const MIGRATION_IDENTIFIER = "0006_additive_auth_recovery";
const MIGRATION_FILENAME = "migrations/0006_additive_auth_recovery.sql";
const PRE_MIGRATION_FINGERPRINT =
  "1654ed34b5a19cef9edc6fe3e996553e59c370f311207a89348811f969e3def8";
const POST_MIGRATION_FINGERPRINT =
  "e79139302ae53b2dafb58a2eaf54ab47873df4a15dd3c0026ea0024d424da659";
const EXPECTED_LEGACY_USERS = 4;
const REQUIRED_COLUMNS = [
  "password_hash",
  "auth_provider",
  "last_login_at",
  "login_enabled",
  "credential_status",
  "recovery_provenance",
] as const;

type Command = "rehearse" | "execute" | "verify";

interface LegacyUserRow extends QueryResultRow {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  profile_image_url: string | null;
  company_name: string | null;
  role: string | null;
  financial_rating: string | null;
  credit_rating: string | null;
  verified: boolean | null;
  created_at: Date | null;
  updated_at: Date | null;
}

function assertLocalRecoveryEnvironment(): void {
  if (process.env.TUTELA_RECOVERY_MODE !== "true") {
    throw new Error("RECOVERY_MODE_REQUIRED");
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("PRODUCTION_MODE_FORBIDDEN");
  }
  if (process.env.RENDER) {
    throw new Error("RENDER_FORBIDDEN");
  }
}

function migrationPath(): string {
  return path.resolve(process.cwd(), MIGRATION_FILENAME);
}

function gitRevision(): string {
  return execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: process.cwd(),
    encoding: "utf8",
    windowsHide: true,
  }).trim();
}

async function legacyUserSnapshot(client: Client): Promise<string> {
  const rows = (
    await client.query<LegacyUserRow>(`
      SELECT
        id,
        email,
        first_name,
        last_name,
        profile_image_url,
        company_name,
        role,
        financial_rating::text,
        credit_rating,
        verified,
        created_at,
        updated_at
      FROM public.users
      WHERE recovery_provenance IS NULL
      ORDER BY id
    `)
  ).rows;

  if (rows.length !== EXPECTED_LEGACY_USERS) {
    throw new Error("LEGACY_USER_COUNT_MISMATCH");
  }
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(rows))
    .digest("hex");
}

async function legacyUserSnapshotBeforeMigration(
  client: Client,
): Promise<string> {
  const rows = (
    await client.query<LegacyUserRow>(`
      SELECT
        id,
        email,
        first_name,
        last_name,
        profile_image_url,
        company_name,
        role,
        financial_rating::text,
        credit_rating,
        verified,
        created_at,
        updated_at
      FROM public.users
      ORDER BY id
    `)
  ).rows;

  if (rows.length !== EXPECTED_LEGACY_USERS) {
    throw new Error("LEGACY_USER_COUNT_MISMATCH");
  }
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(rows))
    .digest("hex");
}

async function verifyLegacyAuthFieldsRemainNull(
  client: Client,
): Promise<void> {
  const result = (
    await client.query<{ count: string }>(`
      SELECT count(*)::text AS count
      FROM public.users
      WHERE recovery_provenance IS NULL
        AND (
          password_hash IS NOT NULL
          OR auth_provider IS NOT NULL
          OR last_login_at IS NOT NULL
          OR login_enabled IS NOT NULL
          OR credential_status IS NOT NULL
        )
    `)
  ).rows[0];
  if (result.count !== "0") {
    throw new Error("LEGACY_AUTH_FIELDS_CHANGED");
  }
}

async function verifyPostflight(client: Client): Promise<void> {
  const columns = (
    await client.query<{
      column_name: string;
      is_nullable: "YES" | "NO";
      column_default: string | null;
    }>(`
      SELECT column_name, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'users'
        AND column_name = ANY($1::text[])
      ORDER BY column_name
    `, [REQUIRED_COLUMNS])
  ).rows;

  if (
    columns.length !== REQUIRED_COLUMNS.length ||
    columns.some(
      (column) =>
        column.is_nullable !== "YES" || column.column_default !== null,
    )
  ) {
    throw new Error("AUTH_COLUMN_POSTFLIGHT_FAILED");
  }

  const constraints = (
    await client.query<{ count: string }>(`
      SELECT count(*)::text AS count
      FROM pg_constraint
      WHERE conrelid = 'public.users'::regclass
        AND conname IN (
          'users_credential_status_check',
          'users_recovery_provenance_check'
        )
    `)
  ).rows[0].count;
  if (constraints !== "2") {
    throw new Error("AUTH_CONSTRAINT_POSTFLIGHT_FAILED");
  }

  const indexExists = (
    await client.query<{ exists: boolean }>(`
      SELECT to_regclass(
        'public.users_recovery_provenance_unique'
      ) IS NOT NULL AS exists
    `)
  ).rows[0].exists;
  if (!indexExists) {
    throw new Error("AUTH_INDEX_POSTFLIGHT_FAILED");
  }

  await verifyLegacyAuthFieldsRemainNull(client);
}

async function verifyJournal(client: Client): Promise<void> {
  const row = (
    await client.query<{
      execution_status: string;
      sql_executed: boolean;
      checksum: string;
    }>(
      `
        SELECT execution_status, sql_executed, checksum
        FROM public.tutela_migration_journal
        WHERE migration_identifier = $1
      `,
      [MIGRATION_IDENTIFIER],
    )
  ).rows[0];

  if (
    !row ||
    row.execution_status !== "succeeded" ||
    !row.sql_executed ||
    row.checksum !== sha256File(migrationPath())
  ) {
    throw new Error("AUTH_MIGRATION_JOURNAL_INVALID");
  }
}

async function rehearse(client: Client): Promise<void> {
  await client.query("BEGIN");
  try {
    await verifyRecoveryMarker(client);
    const beforeFingerprint = await applicationSchemaFingerprint(client);
    if (beforeFingerprint !== PRE_MIGRATION_FINGERPRINT) {
      throw new Error("PRE_MIGRATION_FINGERPRINT_MISMATCH");
    }
    const beforeUsers = await legacyUserSnapshotBeforeMigration(client);
    await client.query(fs.readFileSync(migrationPath(), "utf8"));
    await verifyPostflight(client);
    const afterUsers = await legacyUserSnapshot(client);
    if (afterUsers !== beforeUsers) {
      throw new Error("LEGACY_USERS_CHANGED_DURING_REHEARSAL");
    }
    const postFingerprint = await applicationSchemaFingerprint(client);
    await client.query("ROLLBACK");
    console.log(
      JSON.stringify({
        command: "rehearse",
        migrationIdentifier: MIGRATION_IDENTIFIER,
        legacyUsersUnchanged: true,
        preMigrationFingerprint: beforeFingerprint,
        postMigrationFingerprint: postFingerprint,
        transactionRolledBack: true,
      }),
    );
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

async function execute(client: Client): Promise<void> {
  if (POST_MIGRATION_FINGERPRINT === "REPLACE_AFTER_REHEARSAL") {
    throw new Error("POST_MIGRATION_FINGERPRINT_NOT_RECORDED");
  }

  await client.query("BEGIN");
  try {
    await verifyRecoveryMarker(client);
    const currentFingerprint = await applicationSchemaFingerprint(client);

    if (currentFingerprint === POST_MIGRATION_FINGERPRINT) {
      await verifyPostflight(client);
      await verifyJournal(client);
      await client.query("ROLLBACK");
      console.log(
        JSON.stringify({
          command: "execute",
          migrationIdentifier: MIGRATION_IDENTIFIER,
          alreadyApplied: true,
          fingerprint: currentFingerprint,
        }),
      );
      return;
    }

    if (currentFingerprint !== PRE_MIGRATION_FINGERPRINT) {
      throw new Error("PRE_MIGRATION_FINGERPRINT_MISMATCH");
    }

    const existingJournal = (
      await client.query<{ count: string }>(
        `
          SELECT count(*)::text AS count
          FROM public.tutela_migration_journal
          WHERE migration_identifier = $1
        `,
        [MIGRATION_IDENTIFIER],
      )
    ).rows[0].count;
    if (existingJournal !== "0") {
      throw new Error("AUTH_MIGRATION_JOURNAL_COLLISION");
    }

    const beforeUsers = await legacyUserSnapshotBeforeMigration(client);
    const checksum = sha256File(migrationPath());
    const revision = gitRevision();

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
        VALUES ($1, $2, $3, 'additive_migration',
          'existing_database_upgrade', $4, 'running', false, false, $5)
      `,
      [
        MIGRATION_IDENTIFIER,
        MIGRATION_FILENAME,
        checksum,
        revision,
        "Phase 4B additive auth-only reconciliation; no legacy backfill.",
      ],
    );

    await client.query(fs.readFileSync(migrationPath(), "utf8"));
    await verifyPostflight(client);
    const afterUsers = await legacyUserSnapshot(client);
    if (afterUsers !== beforeUsers) {
      throw new Error("LEGACY_USERS_CHANGED_DURING_MIGRATION");
    }

    const postFingerprint = await applicationSchemaFingerprint(client);
    if (postFingerprint !== POST_MIGRATION_FINGERPRINT) {
      throw new Error("POST_MIGRATION_FINGERPRINT_MISMATCH");
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
    await verifyJournal(client);
    await client.query("COMMIT");

    console.log(
      JSON.stringify({
        command: "execute",
        migrationIdentifier: MIGRATION_IDENTIFIER,
        alreadyApplied: false,
        legacyUsersUnchanged: true,
        fingerprint: postFingerprint,
        journalStatus: "succeeded",
      }),
    );
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

async function verify(client: Client): Promise<void> {
  if (POST_MIGRATION_FINGERPRINT === "REPLACE_AFTER_REHEARSAL") {
    throw new Error("POST_MIGRATION_FINGERPRINT_NOT_RECORDED");
  }

  await client.query("BEGIN READ ONLY");
  try {
    await verifyRecoveryMarker(client);
    await verifyPostflight(client);
    await verifyJournal(client);
    const fingerprint = await applicationSchemaFingerprint(client);
    if (fingerprint !== POST_MIGRATION_FINGERPRINT) {
      throw new Error("POST_MIGRATION_FINGERPRINT_MISMATCH");
    }
    await client.query("ROLLBACK");
    console.log(
      JSON.stringify({
        command: "verify",
        migrationIdentifier: MIGRATION_IDENTIFIER,
        legacyUsers: EXPECTED_LEGACY_USERS,
        legacyAuthFieldsRemainNull: true,
        fingerprint,
        journalStatus: "succeeded",
      }),
    );
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

const command = process.argv[2] as Command | undefined;
if (!command || !["rehearse", "execute", "verify"].includes(command)) {
  console.error("AUTH_MIGRATION_COMMAND_REQUIRED");
  process.exit(1);
}

assertLocalRecoveryEnvironment();
const client = new Client({
  connectionString: requireRawDatabaseUrl(process.env.DATABASE_URL),
});

try {
  await client.connect();
  if (command === "rehearse") await rehearse(client);
  if (command === "execute") await execute(client);
  if (command === "verify") await verify(client);
} catch (error) {
  const code =
    error instanceof Error && /^[A-Z0-9_]+$/.test(error.message)
      ? error.message
      : error && typeof error === "object" && "code" in error
        ? `DATABASE_ERROR_${String(error.code).replace(/[^A-Z0-9_-]/gi, "")}`
        : "AUTH_MIGRATION_FAILED";
  console.error(code);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}
