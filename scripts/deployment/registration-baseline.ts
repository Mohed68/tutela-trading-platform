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

const EXPECTED_LEGACY_USERS = [
  {
    id: "demo-user-1",
    email: "trader1@petromax.com",
    first_name: "Sarah",
    last_name: "Chen",
    profile_image_url: null,
    company_name: "PetroMax Energy Trading",
    role: "senior_trader",
    financial_rating: 8.5,
    credit_rating: "AA-",
    verified: true,
    created_at: "2025-11-21T08:31:17.116Z",
    updated_at: "2025-11-21T08:31:17.116Z",
    password_hash: null,
    auth_provider: null,
    last_login_at: null,
    login_enabled: null,
    credential_status: null,
    recovery_provenance: null,
  },
  {
    id: "demo-user-2",
    email: "manager@globalmetals.com",
    first_name: "Marcus",
    last_name: "Rodriguez",
    profile_image_url: null,
    company_name: "Global Metals Corp",
    role: "commodity_manager",
    financial_rating: 9.2,
    credit_rating: "AAA",
    verified: true,
    created_at: "2025-11-21T08:31:17.333Z",
    updated_at: "2025-11-21T08:31:17.333Z",
    password_hash: null,
    auth_provider: null,
    last_login_at: null,
    login_enabled: null,
    credential_status: null,
    recovery_provenance: null,
  },
  {
    id: "demo-user-3",
    email: "director@agrilink.com",
    first_name: "Emma",
    last_name: "Thompson",
    profile_image_url: null,
    company_name: "AgriLink International",
    role: "trading_director",
    financial_rating: 7.8,
    credit_rating: "A+",
    verified: true,
    created_at: "2025-11-21T08:31:17.529Z",
    updated_at: "2025-11-21T08:31:17.529Z",
    password_hash: null,
    auth_provider: null,
    last_login_at: null,
    login_enabled: null,
    credential_status: null,
    recovery_provenance: null,
  },
  {
    id: "local-admin",
    email: "admin@tutela.local",
    first_name: "Local",
    last_name: "Admin",
    profile_image_url: null,
    company_name: "Demo Company",
    role: "admin",
    financial_rating: 0,
    credit_rating: "unrated",
    verified: false,
    created_at: "2025-11-26T11:22:46.731Z",
    updated_at: "2025-11-26T11:22:46.731Z",
    password_hash: null,
    auth_provider: null,
    last_login_at: null,
    login_enabled: null,
    credential_status: null,
    recovery_provenance: null,
  },
] as const;

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

async function diagnose(client: Client): Promise<void> {
  await client.query("BEGIN READ ONLY");
  try {
    const referenceRows = (
      await client.query<{ record: Record<string, unknown> }>(
        `
          SELECT to_jsonb(reference_user) AS record
          FROM jsonb_populate_recordset(
            null::public.users,
            $1::jsonb
          ) AS reference_user
          ORDER BY reference_user.id
        `,
        [JSON.stringify(EXPECTED_LEGACY_USERS)],
      )
    ).rows.map((row) => row.record);
    const currentRows = (
      await client.query<{ record: Record<string, unknown> }>(`
        SELECT to_jsonb(source) AS record
        FROM public.users AS source
        WHERE source.recovery_provenance IS NULL
        ORDER BY source.id
      `)
    ).rows.map((row) => row.record);
    const currentSnapshotHash = crypto
      .createHash("sha256")
      .update(JSON.stringify(currentRows))
      .digest("hex");
    const legacyAuthenticationDisabled = currentRows.every(
      (row) =>
        row.password_hash == null &&
        row.login_enabled !== true &&
        row.credential_status !== "active" &&
        row.recovery_provenance == null,
    );
    const emailVerificationStateSafe = currentRows.every(
      (row) => row.email_verified_at == null,
    );
    if (
      currentRows.length !== referenceRows.length ||
      currentRows.some(
        (row, index) => String(row.id) !== String(referenceRows[index]?.id),
      )
    ) {
      throw new Error("DIAGNOSTIC_USER_ID_SET_MISMATCH");
    }

    const candidateCells: Array<{
      rowIndex: number;
      field: string;
      candidateValue: unknown;
    }> = [];
    for (const [rowIndex, current] of currentRows.entries()) {
      const reference = referenceRows[rowIndex];
      const fields = new Set([...Object.keys(reference), ...Object.keys(current)]);
      for (const field of fields) {
        if (
          JSON.stringify(current[field] ?? null) !==
          JSON.stringify(reference[field] ?? null)
        ) {
          candidateCells.push({
            rowIndex,
            field,
            candidateValue: reference[field] ?? null,
          });
        }
      }
    }
    if (candidateCells.length > 22) {
      throw new Error("DIAGNOSTIC_SEARCH_SPACE_TOO_LARGE");
    }

    let matchingMask: number | undefined;
    const combinations = 2 ** candidateCells.length;
    for (let mask = 0; mask < combinations; mask += 1) {
      const candidateRows = currentRows.map((row) => ({ ...row }));
      for (const [cellIndex, cell] of candidateCells.entries()) {
        if ((mask & 2 ** cellIndex) !== 0) {
          candidateRows[cell.rowIndex][cell.field] = cell.candidateValue;
        }
      }
      const hash = crypto
        .createHash("sha256")
        .update(JSON.stringify(candidateRows))
        .digest("hex");
      if (hash === EXPECTED_LEGACY_USER_HASH) {
        matchingMask = mask;
        break;
      }
    }
    if (matchingMask === undefined) {
      const candidateDifferences = currentRows.map((row, rowIndex) => ({
        id: String(row.id),
        candidateFields: candidateCells
          .filter((cell) => cell.rowIndex === rowIndex)
          .map((cell) => cell.field)
          .sort(),
      }));
      console.log(
        JSON.stringify({
          mode: "read_only_protected_user_snapshot",
          currentSnapshotHash,
          legacyAuthenticationDisabled,
          emailVerificationStateSafe,
          writesPerformed: false,
        }),
      );
      console.log(
        JSON.stringify({
          mode: "read_only_legacy_user_diagnosis",
          baselineReconstructedFromApprovedFingerprint: false,
          candidateDifferences,
          currentSnapshotHash,
          currentSchemaFingerprint: await applicationSchemaFingerprint(client),
          currentHardeningFingerprint: await hardeningFingerprint(client),
          legacyAuthenticationDisabled,
          emailVerificationStateSafe,
          authoritativeClassification: false,
          writesPerformed: false,
        }),
      );
      throw new Error("DIAGNOSTIC_BASELINE_NOT_RECONSTRUCTED");
    }

    const changedById = new Map<string, string[]>();
    for (const [cellIndex, cell] of candidateCells.entries()) {
      if ((matchingMask & 2 ** cellIndex) === 0) continue;
      const id = String(currentRows[cell.rowIndex].id);
      const fields = changedById.get(id) ?? [];
      fields.push(cell.field);
      changedById.set(id, fields);
    }
    const differences = currentRows.map((row) => ({
      id: String(row.id),
      changedFields: (changedById.get(String(row.id)) ?? []).sort(),
    }));

    await client.query("ROLLBACK");
    console.log(
      JSON.stringify({
        mode: "read_only_legacy_user_diagnosis",
        baselineReconstructedFromApprovedFingerprint: true,
        rowCount: currentRows.length,
        differences,
        writesPerformed: false,
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
if (!command || !["inspect", "diagnose", "execute"].includes(command)) {
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
  if (command === "diagnose") await diagnose(client);
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
