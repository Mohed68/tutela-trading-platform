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

const MIGRATION_IDENTIFIER = "0008_add_submitted_offer_status";
const MIGRATION_FILENAME = "migrations/0008_add_submitted_offer_status.sql";
const PRE_MIGRATION_FINGERPRINT =
  "0a899670e067b22692abc0a8f3d9d05c590f84d709d214984e2cf1e1749d1def";
const POST_MIGRATION_FINGERPRINT =
  "d309afaee7935df8b4e91e42f9f6f6c6e9c646b810640e1683e0512e6777bdbe";
const EXPECTED_LEGACY_USER_HASH =
  "3369cf18c0fb7ffa5881cdd4a6c25c2da11ef489c46e7b9e52f5d28f41288bbc";
const EXPECTED_LEGACY_OFFER_HASH =
  "b9492303d4d3bb157941fd3ed609438761eb85396e83861af4cfb5f77664c2fc";

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

async function verifyProtectedState(
  client: Client,
  expectedFingerprint: string,
  expectSubmitted: boolean,
): Promise<void> {
  await verifyRecoveryMarker(client);
  if ((await applicationSchemaFingerprint(client)) !== expectedFingerprint) {
    throw new Error("SUBMISSION_FINGERPRINT_MISMATCH");
  }
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

  const expectedStatuses = [
    "active",
    "pending",
    "closed",
    "cancelled",
    "draft",
    ...(expectSubmitted ? ["submitted"] : []),
  ];
  if (
    JSON.stringify(await offerStatusValues(client)) !==
    JSON.stringify(expectedStatuses)
  ) {
    throw new Error("OFFER_STATUS_ENUM_MISMATCH");
  }
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
    throw new Error("SUBMISSION_MIGRATION_JOURNAL_INVALID");
  }
}

async function rehearse(client: Client): Promise<void> {
  await client.query("BEGIN");
  try {
    await verifyProtectedState(client, PRE_MIGRATION_FINGERPRINT, false);
    const sql = fs.readFileSync(migrationPath(), "utf8");
    await client.query(sql);
    await client.query(sql);
    if (!(await offerStatusValues(client)).includes("submitted")) {
      throw new Error("SUBMITTED_ENUM_VALUE_NOT_ADDED");
    }
    const postFingerprint = await applicationSchemaFingerprint(client);
    if ((await tableSnapshot(client, "offers")) !== EXPECTED_LEGACY_OFFER_HASH) {
      throw new Error("LEGACY_OFFERS_CHANGED_DURING_REHEARSAL");
    }
    await client.query("ROLLBACK");

    await client.query("BEGIN READ ONLY");
    await verifyProtectedState(client, PRE_MIGRATION_FINGERPRINT, false);
    await client.query("ROLLBACK");
    console.log(
      JSON.stringify({
        command: "rehearse",
        migrationIdentifier: MIGRATION_IDENTIFIER,
        preMigrationFingerprint: PRE_MIGRATION_FINGERPRINT,
        postMigrationFingerprint: postFingerprint,
        legacyUsersUnchanged: true,
        legacyOffersUnchanged: true,
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
      await verifyProtectedState(client, POST_MIGRATION_FINGERPRINT, true);
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
    await verifyProtectedState(client, PRE_MIGRATION_FINGERPRINT, false);
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
      throw new Error("SUBMISSION_MIGRATION_JOURNAL_COLLISION");
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
        "Phase 5C additive submitted enum value; no default change or backfill.",
      ],
    );
    await client.query(fs.readFileSync(migrationPath(), "utf8"));
    if (!(await offerStatusValues(client)).includes("submitted")) {
      throw new Error("SUBMITTED_ENUM_VALUE_NOT_ADDED");
    }
    if ((await tableSnapshot(client, "offers")) !== EXPECTED_LEGACY_OFFER_HASH) {
      throw new Error("LEGACY_OFFERS_CHANGED_DURING_MIGRATION");
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
        fingerprint: postFingerprint,
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
    await verifyProtectedState(client, POST_MIGRATION_FINGERPRINT, true);
    await verifyJournal(client);
    const submitted = (
      await client.query<{ value: string }>(
        "SELECT 'submitted'::public.offer_status::text AS value",
      )
    ).rows[0].value;
    if (submitted !== "submitted") throw new Error("SUBMITTED_ENUM_CAST_FAILED");
    await client.query("ROLLBACK");
    console.log(
      JSON.stringify({
        command: "verify",
        migrationIdentifier: MIGRATION_IDENTIFIER,
        fingerprint: POST_MIGRATION_FINGERPRINT,
        journalStatus: "succeeded",
        submittedAccepted: true,
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
  console.error("SUBMISSION_MIGRATION_COMMAND_REQUIRED");
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
        : "SUBMISSION_MIGRATION_FAILED";
  console.error(code);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}
