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

const MIGRATION_IDENTIFIER = "0010_verification_immutability";
const MIGRATION_FILENAME = "migrations/0010_verification_immutability.sql";
const EXPECTED_SCHEMA_FINGERPRINT =
  "aeb77478a423b407e5e69705f78b7948e8020411b7defa26f605568f616fc401";
const EXPECTED_HARDENING_FINGERPRINT =
  "ddcaad3f95a71374b58333ef67b712dd9fb3c0795f7a38fd1828bff9412ebee0";
const EXPECTED_LEGACY_USER_HASH =
  "3369cf18c0fb7ffa5881cdd4a6c25c2da11ef489c46e7b9e52f5d28f41288bbc";
const EXPECTED_LEGACY_OFFER_HASH =
  "b9492303d4d3bb157941fd3ed609438761eb85396e83861af4cfb5f77664c2fc";

const TRIGGERS = [
  "offer_submission_revisions_immutable",
  "offer_verification_attempts_guard",
  "offer_verification_findings_immutable",
  "offer_verification_events_immutable",
  "offer_verification_commands_guard",
  "offer_workflow_transitions_immutable",
] as const;

const FUNCTIONS = [
  "tutela_reject_verification_history_mutation",
  "tutela_guard_verification_attempt_mutation",
  "tutela_guard_verification_command_mutation",
] as const;

const VERIFICATION_TABLES = [
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

async function assertProtectedData(client: Client): Promise<void> {
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
  for (const table of VERIFICATION_TABLES) {
    const count = (
      await client.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM public.${table}`,
      )
    ).rows[0].count;
    if (count !== 0) throw new Error("VERIFICATION_TABLE_NOT_EMPTY");
  }
}

async function verifyPhase6BJournal(client: Client): Promise<void> {
  const status = (
    await client.query<{ execution_status: string }>(
      `
        SELECT execution_status
        FROM public.tutela_migration_journal
        WHERE migration_identifier = '0009_verification_engine'
      `,
    )
  ).rows[0]?.execution_status;
  if (status !== "succeeded") {
    throw new Error("PHASE_6B_MIGRATION_REQUIRED");
  }
}

async function hardeningObjects(client: Client): Promise<{
  triggers: { name: string; table: string; definition: string }[];
  functions: { name: string; definition: string }[];
}> {
  const triggers = (
    await client.query<{
      name: string;
      table: string;
      definition: string;
    }>(
      `
        SELECT
          trigger.tgname AS name,
          relation.relname AS table,
          pg_get_triggerdef(trigger.oid, true) AS definition
        FROM pg_trigger AS trigger
        INNER JOIN pg_class AS relation ON relation.oid = trigger.tgrelid
        INNER JOIN pg_namespace AS namespace
          ON namespace.oid = relation.relnamespace
        WHERE namespace.nspname = 'public'
          AND NOT trigger.tgisinternal
          AND trigger.tgname = ANY($1::text[])
        ORDER BY trigger.tgname
      `,
      [TRIGGERS],
    )
  ).rows;
  const functions = (
    await client.query<{ name: string; definition: string }>(
      `
        SELECT
          procedure.proname AS name,
          pg_get_functiondef(procedure.oid) AS definition
        FROM pg_proc AS procedure
        INNER JOIN pg_namespace AS namespace
          ON namespace.oid = procedure.pronamespace
        WHERE namespace.nspname = 'public'
          AND procedure.proname = ANY($1::text[])
        ORDER BY procedure.proname
      `,
      [FUNCTIONS],
    )
  ).rows;
  return { triggers, functions };
}

async function hardeningFingerprint(client: Client): Promise<string> {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(await hardeningObjects(client)))
    .digest("hex");
}

async function assertBase(client: Client): Promise<void> {
  await assertProtectedData(client);
  await verifyPhase6BJournal(client);
  if (
    (await applicationSchemaFingerprint(client)) !==
    EXPECTED_SCHEMA_FINGERPRINT
  ) {
    throw new Error("PHASE_6B_SCHEMA_FINGERPRINT_MISMATCH");
  }
}

async function assertObjectsAbsent(client: Client): Promise<void> {
  const objects = await hardeningObjects(client);
  if (objects.triggers.length !== 0 || objects.functions.length !== 0) {
    throw new Error("IMMUTABILITY_OBJECT_COLLISION");
  }
}

async function assertObjectsPresent(client: Client): Promise<string> {
  await assertBase(client);
  const objects = await hardeningObjects(client);
  if (
    objects.triggers.length !== TRIGGERS.length ||
    objects.functions.length !== FUNCTIONS.length
  ) {
    throw new Error("IMMUTABILITY_OBJECTS_INCOMPLETE");
  }
  const fingerprint = await hardeningFingerprint(client);
  if (
    EXPECTED_HARDENING_FINGERPRINT !== "REPLACE_AFTER_REHEARSAL" &&
    fingerprint !== EXPECTED_HARDENING_FINGERPRINT
  ) {
    throw new Error("IMMUTABILITY_FINGERPRINT_MISMATCH");
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
    throw new Error("IMMUTABILITY_MIGRATION_JOURNAL_INVALID");
  }
}

async function rehearse(client: Client): Promise<void> {
  await client.query("BEGIN");
  try {
    await assertBase(client);
    await assertObjectsAbsent(client);
    const sql = fs.readFileSync(migrationPath(), "utf8");
    await client.query(sql);
    await client.query(sql);
    const fingerprint = await assertObjectsPresent(client);
    await client.query("ROLLBACK");

    await client.query("BEGIN READ ONLY");
    await assertBase(client);
    await assertObjectsAbsent(client);
    await client.query("ROLLBACK");
    console.log(
      JSON.stringify({
        command: "rehearse",
        migrationIdentifier: MIGRATION_IDENTIFIER,
        schemaFingerprint: EXPECTED_SCHEMA_FINGERPRINT,
        hardeningFingerprint: fingerprint,
        idempotenceRehearsed: true,
        transactionRolledBack: true,
        legacyUsersUnchanged: true,
        legacyOffersUnchanged: true,
      }),
    );
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

async function execute(client: Client): Promise<void> {
  if (EXPECTED_HARDENING_FINGERPRINT === "REPLACE_AFTER_REHEARSAL") {
    throw new Error("HARDENING_FINGERPRINT_NOT_RECORDED");
  }
  const existingObjects = await hardeningObjects(client);
  if (
    existingObjects.triggers.length === TRIGGERS.length &&
    existingObjects.functions.length === FUNCTIONS.length
  ) {
    await client.query("BEGIN READ ONLY");
    const fingerprint = await assertObjectsPresent(client);
    await verifyJournal(client);
    await client.query("ROLLBACK");
    console.log(
      JSON.stringify({
        command: "execute",
        migrationIdentifier: MIGRATION_IDENTIFIER,
        alreadyApplied: true,
        hardeningFingerprint: fingerprint,
      }),
    );
    return;
  }

  await client.query("BEGIN");
  try {
    await assertBase(client);
    await assertObjectsAbsent(client);
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
      throw new Error("IMMUTABILITY_MIGRATION_JOURNAL_COLLISION");
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
        "Phase 6D narrowly guards Phase 6 verification history and immutable attempt fields.",
      ],
    );
    await client.query(fs.readFileSync(migrationPath(), "utf8"));
    const fingerprint = await assertObjectsPresent(client);
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
        schemaFingerprint: EXPECTED_SCHEMA_FINGERPRINT,
        hardeningFingerprint: fingerprint,
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
  if (EXPECTED_HARDENING_FINGERPRINT === "REPLACE_AFTER_REHEARSAL") {
    throw new Error("HARDENING_FINGERPRINT_NOT_RECORDED");
  }
  await client.query("BEGIN READ ONLY");
  try {
    const fingerprint = await assertObjectsPresent(client);
    await verifyJournal(client);
    await client.query("ROLLBACK");
    console.log(
      JSON.stringify({
        command: "verify",
        migrationIdentifier: MIGRATION_IDENTIFIER,
        schemaFingerprint: EXPECTED_SCHEMA_FINGERPRINT,
        hardeningFingerprint: fingerprint,
        journalStatus: "succeeded",
        verificationTablesEmpty: true,
        recoveryOwnedOffers: 0,
        sessions: 0,
        legacyUsersUnchanged: true,
        legacyOffersUnchanged: true,
      }),
    );
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

const command = process.argv[2] as Command | undefined;
if (!command || !["rehearse", "execute", "verify"].includes(command)) {
  console.error("IMMUTABILITY_MIGRATION_COMMAND_REQUIRED");
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
        : `IMMUTABILITY_MIGRATION_FAILED:${safeErrorMessage(error)}`;
  console.error(code);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}
