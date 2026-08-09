import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { Client, type QueryResultRow } from "pg";
import {
  applicationSchemaFingerprint,
  requireRawDatabaseUrl,
  sha256File,
} from "../migrations/rehearsal-lib.js";

const EXPECTED_SCHEMA_FINGERPRINT =
  "aeb77478a423b407e5e69705f78b7948e8020411b7defa26f605568f616fc401";
const EXPECTED_HARDENING_FINGERPRINT =
  "ddcaad3f95a71374b58333ef67b712dd9fb3c0795f7a38fd1828bff9412ebee0";
const EXPECTED_LEGACY_USER_HASH =
  "3369cf18c0fb7ffa5881cdd4a6c25c2da11ef489c46e7b9e52f5d28f41288bbc";
const EXPECTED_LEGACY_OFFER_HASH =
  "b9492303d4d3bb157941fd3ed609438761eb85396e83861af4cfb5f77664c2fc";

const EXPECTED_ROW_COUNTS = new Map([
  ["neon_auth.users_sync", 1],
  ["public.activity_logs", 0],
  ["public.commodities", 9],
  ["public.contracts", 0],
  ["public.offers", 9],
  ["public.partner_relations", 0],
  ["public.sessions", 0],
  ["public.users", 4],
  ["public.verification_documents", 0],
  ["public.offer_verifications", 0],
  ["public.performance_insights_reports", 0],
  ["public.offer_submission_revisions", 0],
  ["public.offer_verification_attempts", 0],
  ["public.offer_verification_findings", 0],
  ["public.offer_verification_events", 0],
  ["public.offer_verification_commands", 0],
  ["public.offer_workflow_transitions", 0],
]);

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

const BASELINE_ARTIFACTS = [
  {
    identifier: "0000_migration_journal",
    filename: "migrations/0000_migration_journal.sql",
    provenance: "additive_migration",
    status: "verified",
    notes: "Existing migration journal structure verified; repository SQL execution is not claimed.",
  },
  {
    identifier: "observed_legacy_neon_baseline_v1",
    filename: "docs/recovery/phase-2a/observed-legacy-schema-baseline.md",
    provenance: "observed_legacy_baseline",
    status: "verified",
    notes: "Legacy structure and protected row baseline verified without claiming repository creation.",
  },
  {
    identifier: "0002_partner_relations",
    filename: "migrations/0002_partner_relations.sql",
    provenance: "legacy_reconciliation",
    status: "superseded",
    notes: "Existing partner relation structure is represented by the verified baseline and reconciliation state.",
  },
  ...[
    "0003_offer_verifications",
    "0004_performance_insights_reports",
    "0005_partner_relations_reconciliation",
    "0006_additive_auth_recovery",
    "0007_add_draft_offer_status",
    "0008_add_submitted_offer_status",
    "0009_verification_engine",
    "0010_verification_immutability",
  ].map((identifier) => ({
    identifier,
    filename: `migrations/${identifier}.sql`,
    provenance: "additive_migration",
    status: "verified",
    notes: "Existing schema state verified exactly; repository SQL execution is not claimed.",
  })),
] as const;

function gitRevision(): string {
  const renderRevision = process.env.RENDER_GIT_COMMIT?.trim();
  if (renderRevision && /^[0-9a-f]{40}$/i.test(renderRevision)) {
    return renderRevision.toLowerCase();
  }
  return execFileSync("git", ["rev-parse", "HEAD"], {
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

async function hardeningFingerprint(client: Client): Promise<string> {
  const triggers = (
    await client.query(
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
    await client.query(
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
  if (triggers.length !== TRIGGERS.length || functions.length !== FUNCTIONS.length) {
    throw new Error("BASELINE_HARDENING_OBJECTS_INCOMPLETE");
  }
  return crypto
    .createHash("sha256")
    .update(JSON.stringify({ triggers, functions }))
    .digest("hex");
}

async function assertApprovedBaseline(client: Client): Promise<void> {
  const controlState = (
    await client.query<{
      journal_exists: boolean;
      registration_table_exists: boolean;
    }>(`
      SELECT
        to_regclass('public.tutela_migration_journal') IS NOT NULL AS journal_exists,
        to_regclass('public.email_verification_tokens') IS NOT NULL AS registration_table_exists
    `)
  ).rows[0];
  if (!controlState.journal_exists || controlState.registration_table_exists) {
    throw new Error("BASELINE_CONTROL_STATE_MISMATCH");
  }

  const journalCount = (
    await client.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM public.tutela_migration_journal",
    )
  ).rows[0].count;
  if (journalCount !== 0) throw new Error("BASELINE_JOURNAL_NOT_EMPTY");

  for (const [qualifiedTable, expectedCount] of EXPECTED_ROW_COUNTS) {
    const count = (
      await client.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM ${qualifiedTable}`,
      )
    ).rows[0].count;
    if (count !== expectedCount) throw new Error("BASELINE_ROW_COUNT_MISMATCH");
  }

  const usersHash = await tableSnapshot(
    client,
    "users",
    "WHERE source.recovery_provenance IS NULL",
  );
  if (usersHash !== EXPECTED_LEGACY_USER_HASH) {
    throw new Error("BASELINE_LEGACY_USERS_MISMATCH");
  }
  if ((await tableSnapshot(client, "offers")) !== EXPECTED_LEGACY_OFFER_HASH) {
    throw new Error("BASELINE_LEGACY_OFFERS_MISMATCH");
  }
  if ((await applicationSchemaFingerprint(client)) !== EXPECTED_SCHEMA_FINGERPRINT) {
    throw new Error("BASELINE_SCHEMA_FINGERPRINT_MISMATCH");
  }
  if ((await hardeningFingerprint(client)) !== EXPECTED_HARDENING_FINGERPRINT) {
    throw new Error("BASELINE_HARDENING_FINGERPRINT_MISMATCH");
  }
}

async function inspect(client: Client): Promise<void> {
  await client.query("BEGIN READ ONLY");
  try {
    await assertApprovedBaseline(client);
    await client.query("ROLLBACK");
    console.log(
      JSON.stringify({
        mode: "read_only_baseline_inspection",
        approvedBaselineMatched: true,
        schemaFingerprint: EXPECTED_SCHEMA_FINGERPRINT,
        hardeningFingerprint: EXPECTED_HARDENING_FINGERPRINT,
        protectedDataMatched: true,
        journalEmpty: true,
        registrationTableAbsent: true,
      }),
    );
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

async function execute(client: Client): Promise<void> {
  await client.query("BEGIN");
  try {
    await assertApprovedBaseline(client);
    const revision = gitRevision();
    for (const artifact of BASELINE_ARTIFACTS) {
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
          VALUES ($1, $2, $3, $4, 'existing_database_upgrade', $5, $6, false, false, $7)
        `,
        [
          artifact.identifier,
          artifact.filename,
          sha256File(path.resolve(process.cwd(), artifact.filename)),
          artifact.provenance,
          revision,
          artifact.status,
          artifact.notes,
        ],
      );
    }
    const recorded = (
      await client.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM public.tutela_migration_journal",
      )
    ).rows[0].count;
    if (recorded !== BASELINE_ARTIFACTS.length) {
      throw new Error("BASELINE_JOURNAL_RECORD_COUNT_MISMATCH");
    }
    await client.query("COMMIT");
    console.log(
      JSON.stringify({
        mode: "baseline_execution",
        baselineRecorded: true,
        records: BASELINE_ARTIFACTS.length,
        sqlExecutionClaimed: false,
        protectedDataUnchanged: true,
      }),
    );
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

const command = process.argv[2];
if (!command || !["inspect", "execute"].includes(command)) {
  console.error("REGISTRATION_BASELINE_COMMAND_REQUIRED");
  process.exit(1);
}

const client = new Client({
  connectionString: requireRawDatabaseUrl(process.env.DATABASE_URL),
  connectionTimeoutMillis: 10_000,
});

try {
  await client.connect();
  if (command === "inspect") await inspect(client);
  if (command === "execute") await execute(client);
} catch (error) {
  console.error(
    error instanceof Error && /^[A-Z0-9_]+$/.test(error.message)
      ? error.message
      : "REGISTRATION_BASELINE_FAILED",
  );
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}
