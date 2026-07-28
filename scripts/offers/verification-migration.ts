import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { Client, type QueryResultRow } from "pg";
import { safeErrorMessage } from "../../server/safeErrors.js";
import {
  applicationSchemaFingerprint,
  requireRawDatabaseUrl,
  sha256File,
  verifyRecoveryMarker,
} from "../migrations/rehearsal-lib.js";

const MIGRATION_IDENTIFIER = "0009_verification_engine";
const MIGRATION_FILENAME = "migrations/0009_verification_engine.sql";
const PRE_MIGRATION_FINGERPRINT =
  "d309afaee7935df8b4e91e42f9f6f6c6e9c646b810640e1683e0512e6777bdbe";
const POST_MIGRATION_FINGERPRINT =
  "aeb77478a423b407e5e69705f78b7948e8020411b7defa26f605568f616fc401";
const EXPECTED_LEGACY_USER_HASH =
  "3369cf18c0fb7ffa5881cdd4a6c25c2da11ef489c46e7b9e52f5d28f41288bbc";
const EXPECTED_LEGACY_OFFER_HASH =
  "b9492303d4d3bb157941fd3ed609438761eb85396e83861af4cfb5f77664c2fc";

const NEW_TABLES = [
  "offer_submission_revisions",
  "offer_verification_attempts",
  "offer_verification_findings",
  "offer_verification_events",
  "offer_verification_commands",
  "offer_workflow_transitions",
] as const;

type Command = "rehearse" | "execute" | "verify";

function assertLocalRecoveryEnvironment(): void {
  if (process.env.TUTELA_RECOVERY_MODE !== "true") {
    throw new Error("RECOVERY_MODE_REQUIRED");
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("PRODUCTION_MODE_FORBIDDEN");
  }
  if (process.env.RENDER) throw new Error("RENDER_FORBIDDEN");
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

async function tableSnapshot(
  client: Client,
  table: "users" | "offers",
  where = "",
): Promise<string> {
  const rows = (
    await client.query<QueryResultRow>(
      `SELECT to_jsonb(source) AS record
       FROM public.${table} AS source
       ${where}
       ORDER BY source.id`,
    )
  ).rows;
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(rows.map((row) => row.record)))
    .digest("hex");
}

async function offerStatusValues(client: Client): Promise<string[]> {
  return (
    await client.query<{ enumlabel: string }>(`
      SELECT enum_value.enumlabel
      FROM pg_type AS enum_type
      INNER JOIN pg_enum AS enum_value
        ON enum_value.enumtypid = enum_type.oid
      INNER JOIN pg_namespace AS enum_namespace
        ON enum_namespace.oid = enum_type.typnamespace
      WHERE enum_namespace.nspname = 'public'
        AND enum_type.typname = 'offer_status'
      ORDER BY enum_value.enumsortorder
    `)
  ).rows.map((row) => row.enumlabel);
}

async function assertProtectedRows(client: Client): Promise<void> {
  await verifyRecoveryMarker(client);
  if (
    (await tableSnapshot(
      client,
      "users",
      "WHERE source.recovery_provenance IS NULL",
    )) !== EXPECTED_LEGACY_USER_HASH
  ) {
    throw new Error("LEGACY_USERS_CHANGED");
  }
  if ((await tableSnapshot(client, "offers")) !== EXPECTED_LEGACY_OFFER_HASH) {
    throw new Error("LEGACY_OFFERS_CHANGED");
  }
  const counts = (
    await client.query<{ recovery_offers: number; sessions: number }>(`
      SELECT
        (
          SELECT count(*)::int
          FROM public.offers AS offer
          INNER JOIN public.users AS owner ON owner.id = offer.user_id
          WHERE owner.recovery_provenance = 'tutela-recovery-test'
        ) AS recovery_offers,
        (SELECT count(*)::int FROM public.sessions) AS sessions
    `)
  ).rows[0];
  if (counts.recovery_offers !== 0 || counts.sessions !== 0) {
    throw new Error("RECOVERY_WRITE_BASELINE_CHANGED");
  }
}

async function assertPreMigration(client: Client): Promise<void> {
  await assertProtectedRows(client);
  if ((await applicationSchemaFingerprint(client)) !== PRE_MIGRATION_FINGERPRINT) {
    throw new Error("VERIFICATION_PRE_MIGRATION_FINGERPRINT_MISMATCH");
  }
  const existing = (
    await client.query<{ name: string }>(
      `
        SELECT table_name AS name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = ANY($1::text[])
      `,
      [NEW_TABLES],
    )
  ).rows;
  if (existing.length > 0) {
    throw new Error("VERIFICATION_MIGRATION_OBJECT_COLLISION");
  }
  if ((await offerStatusValues(client)).includes("verified")) {
    throw new Error("VERIFIED_STATUS_ALREADY_PRESENT");
  }
}

async function assertPostMigration(
  client: Client,
  expectedFingerprint?: string,
): Promise<string> {
  await assertProtectedRows(client);
  const statuses = await offerStatusValues(client);
  const expectedStatuses = [
    "active",
    "pending",
    "closed",
    "cancelled",
    "draft",
    "submitted",
    "verified",
  ];
  if (JSON.stringify(statuses) !== JSON.stringify(expectedStatuses)) {
    throw new Error("VERIFICATION_OFFER_STATUS_MISMATCH");
  }

  for (const table of NEW_TABLES) {
    const count = (
      await client.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM public.${table}`,
      )
    ).rows[0].count;
    if (count !== 0) {
      throw new Error("VERIFICATION_TABLE_BASELINE_NOT_EMPTY");
    }
  }

  const fingerprint = await applicationSchemaFingerprint(client);
  if (expectedFingerprint && fingerprint !== expectedFingerprint) {
    throw new Error("VERIFICATION_POST_MIGRATION_FINGERPRINT_MISMATCH");
  }
  return fingerprint;
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
    throw new Error("VERIFICATION_MIGRATION_JOURNAL_INVALID");
  }
}

async function rehearse(client: Client): Promise<void> {
  await client.query("BEGIN");
  try {
    await assertPreMigration(client);
    const sql = fs.readFileSync(migrationPath(), "utf8");
    await client.query(sql);
    await client.query(sql);
    const postFingerprint = await assertPostMigration(client);
    await client.query("ROLLBACK");

    await client.query("BEGIN READ ONLY");
    await assertPreMigration(client);
    await client.query("ROLLBACK");
    console.log(
      JSON.stringify({
        command: "rehearse",
        migrationIdentifier: MIGRATION_IDENTIFIER,
        preMigrationFingerprint: PRE_MIGRATION_FINGERPRINT,
        postMigrationFingerprint: postFingerprint,
        legacyUsersUnchanged: true,
        legacyOffersUnchanged: true,
        newTablesEmpty: true,
        idempotenceRehearsed: true,
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
  const currentFingerprint = await applicationSchemaFingerprint(client);
  if (currentFingerprint === POST_MIGRATION_FINGERPRINT) {
    await client.query("BEGIN READ ONLY");
    try {
      await assertPostMigration(client, POST_MIGRATION_FINGERPRINT);
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
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    }
  }

  await client.query("BEGIN");
  try {
    await assertPreMigration(client);
    const collision = (
      await client.query<{ count: number }>(
        `
          SELECT count(*)::int AS count
          FROM public.tutela_migration_journal
          WHERE migration_identifier = $1
        `,
        [MIGRATION_IDENTIFIER],
      )
    ).rows[0].count;
    if (collision !== 0) {
      throw new Error("VERIFICATION_MIGRATION_JOURNAL_COLLISION");
    }
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
          'existing_database_upgrade', $4, 'running', false, false, $5
        )
      `,
      [
        MIGRATION_IDENTIFIER,
        MIGRATION_FILENAME,
        sha256File(migrationPath()),
        gitRevision(),
        "Phase 6B isolated verification persistence and private verified status; no legacy row rewrite.",
      ],
    );
    await client.query(fs.readFileSync(migrationPath(), "utf8"));
    const fingerprint = await assertPostMigration(
      client,
      POST_MIGRATION_FINGERPRINT,
    );
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
        fingerprint,
        journalStatus: "succeeded",
        legacyUsersUnchanged: true,
        legacyOffersUnchanged: true,
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
    const fingerprint = await assertPostMigration(
      client,
      POST_MIGRATION_FINGERPRINT,
    );
    await verifyJournal(client);
    await client.query("ROLLBACK");
    console.log(
      JSON.stringify({
        command: "verify",
        migrationIdentifier: MIGRATION_IDENTIFIER,
        fingerprint,
        journalStatus: "succeeded",
        legacyUsersUnchanged: true,
        legacyOffersUnchanged: true,
        verificationTablesEmpty: true,
        recoveryOwnedOffers: 0,
        sessions: 0,
      }),
    );
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

const command = process.argv[2] as Command | undefined;
if (!command || !["rehearse", "execute", "verify"].includes(command)) {
  console.error("VERIFICATION_MIGRATION_COMMAND_REQUIRED");
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
        : `VERIFICATION_MIGRATION_FAILED:${safeErrorMessage(error)}`;
  console.error(code);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}
