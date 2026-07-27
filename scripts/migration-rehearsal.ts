import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";
import {
  EXECUTION_PATH,
  LEGACY_STRUCTURAL_FINGERPRINT,
  RehearsalSafetyError,
  applicationSchemaFingerprint,
  assertChecksum,
  partnerPreflight,
  preflight0003,
  preflight0004,
  redactedFailure,
  requireRawDatabaseUrl,
  sha256File,
  verify0003,
  verify0004,
  verify0005,
  verifyLegacyBaseline,
  verifyLegacyRowCounts,
  verifyRecoveryMarker,
  verifyRecreatedLegacyBaseline,
} from "./migrations/rehearsal-lib.js";

const root = process.cwd();

interface MigrationDefinition {
  identifier: string;
  filename: string;
  provenance: "additive_migration" | "legacy_reconciliation";
  preflight: (client: Client) => Promise<unknown>;
  verify: (client: Client) => Promise<void>;
  ownsTransaction: boolean;
}

const migrations: MigrationDefinition[] = [
  {
    identifier: "0003_offer_verifications",
    filename: "migrations/0003_offer_verifications.sql",
    provenance: "additive_migration",
    preflight: preflight0003,
    verify: verify0003,
    ownsTransaction: false,
  },
  {
    identifier: "0004_performance_insights_reports",
    filename: "migrations/0004_performance_insights_reports.sql",
    provenance: "additive_migration",
    preflight: preflight0004,
    verify: verify0004,
    ownsTransaction: false,
  },
  {
    identifier: "0005_partner_relations_reconciliation",
    filename: "migrations/0005_partner_relations_reconciliation.sql",
    provenance: "legacy_reconciliation",
    preflight: partnerPreflight,
    verify: verify0005,
    ownsTransaction: true,
  },
];

function absolute(relativePath: string): string {
  return path.join(root, relativePath);
}

function currentGitRevision(): string {
  const revision = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();

  if (!/^[0-9a-f]{40}$/.test(revision)) {
    throw new RehearsalSafetyError(
      "Unable to determine the application Git revision.",
      "GIT_REVISION_INVALID",
    );
  }
  return revision;
}

async function tableExists(client: Client, name: string): Promise<boolean> {
  return (
    await client.query<{ exists: boolean }>(
      "SELECT to_regclass($1) IS NOT NULL AS exists",
      [name],
    )
  ).rows[0].exists;
}

async function assertNotApplied(
  client: Client,
  identifier: string,
): Promise<void> {
  const result = await client.query(
    `
      SELECT 1
      FROM public.tutela_migration_journal
      WHERE migration_identifier = $1
    `,
    [identifier],
  );
  if (result.rowCount !== 0) {
    throw new RehearsalSafetyError(
      `Migration ${identifier} has already been journaled.`,
      "MIGRATION_ALREADY_APPLIED",
    );
  }
}

async function insertJournalRecord(
  client: Client,
  values: {
    identifier: string;
    filename: string;
    checksum: string;
    provenance:
      | "observed_legacy_baseline"
      | "legacy_reconciliation"
      | "additive_migration";
    gitRevision: string;
    status: "running" | "verified" | "succeeded" | "failed" | "superseded";
    sqlExecuted: boolean;
    executionTimestamp: boolean;
    failureMessage?: string;
    notes?: string;
  },
): Promise<void> {
  await client.query(
    `
      INSERT INTO public.tutela_migration_journal (
        migration_identifier,
        migration_filename,
        checksum,
        provenance,
        execution_path,
        git_revision,
        execution_timestamp,
        execution_status,
        sql_executed,
        included_in_bootstrap,
        failure_message,
        notes
      )
      VALUES ($1, $2, $3, $4, $5, $6,
        CASE WHEN $7::boolean THEN now() ELSE NULL END,
        $8, $9, false, $10, $11)
    `,
    [
      values.identifier,
      values.filename,
      values.checksum,
      values.provenance,
      EXECUTION_PATH,
      values.gitRevision,
      values.executionTimestamp,
      values.status,
      values.sqlExecuted,
      values.failureMessage ?? null,
      values.notes ?? null,
    ],
  );
}

async function createJournalAndBaseline(client: Client): Promise<void> {
  if (await tableExists(client, "public.tutela_migration_journal")) {
    throw new RehearsalSafetyError(
      "Migration journal already exists.",
      "MIGRATION_JOURNAL_PRESENT",
    );
  }

  const gitRevision = currentGitRevision();
  const journalFilename = "migrations/0000_migration_journal.sql";
  const baselineFilename =
    "docs/recovery/phase-2a/observed-legacy-schema-baseline.md";
  const supersededFilename = "migrations/0002_partner_relations.sql";
  const journalChecksum = sha256File(absolute(journalFilename));
  const baselineChecksum = sha256File(absolute(baselineFilename));
  const supersededChecksum = sha256File(absolute(supersededFilename));
  const journalSql = fs.readFileSync(absolute(journalFilename), "utf8");

  await client.query("BEGIN");
  try {
    await client.query(journalSql);
    await verifyJournalStructure(client);
    await insertJournalRecord(client, {
      identifier: "0000_migration_journal",
      filename: journalFilename,
      checksum: journalChecksum,
      provenance: "additive_migration",
      gitRevision,
      status: "succeeded",
      sqlExecuted: true,
      executionTimestamp: true,
      notes: "Created the repository-owned migration provenance journal.",
    });
    await insertJournalRecord(client, {
      identifier: "observed_legacy_neon_baseline_v1",
      filename: baselineFilename,
      checksum: baselineChecksum,
      provenance: "observed_legacy_baseline",
      gitRevision,
      status: "verified",
      sqlExecuted: false,
      executionTimestamp: false,
      notes:
        "Observed structural baseline only; no repository SQL created the legacy schema.",
    });
    await insertJournalRecord(client, {
      identifier: "0002_partner_relations",
      filename: supersededFilename,
      checksum: supersededChecksum,
      provenance: "legacy_reconciliation",
      gitRevision,
      status: "superseded",
      sqlExecuted: false,
      executionTimestamp: false,
      notes:
        "Not executed. Superseded on the existing-database path by the observed baseline and migration 0005.",
    });
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  }
}

async function verifyJournalStructure(client: Client): Promise<void> {
  const columns = (
    await client.query<{ name: string }>(`
      SELECT column_name AS name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'tutela_migration_journal'
      ORDER BY ordinal_position
    `)
  ).rows.map((row) => row.name);
  const constraints = (
    await client.query<{ name: string }>(`
      SELECT conname AS name
      FROM pg_constraint
      WHERE conrelid = 'public.tutela_migration_journal'::regclass
      ORDER BY conname
    `)
  ).rows.map((row) => row.name);
  const indexes = (
    await client.query<{ name: string }>(`
      SELECT indexname AS name
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'tutela_migration_journal'
      ORDER BY indexname
    `)
  ).rows.map((row) => row.name);

  const expectedColumns = [
    "migration_identifier",
    "migration_filename",
    "checksum",
    "provenance",
    "execution_path",
    "git_revision",
    "recorded_at",
    "execution_timestamp",
    "execution_status",
    "sql_executed",
    "included_in_bootstrap",
    "failure_message",
    "notes",
  ];
  const expectedConstraints = [
    "tutela_migration_journal_checksum_check",
    "tutela_migration_journal_execution_mode_check",
    "tutela_migration_journal_execution_path_check",
    "tutela_migration_journal_nonexecution_check",
    "tutela_migration_journal_pkey",
    "tutela_migration_journal_provenance_check",
    "tutela_migration_journal_status_check",
    "tutela_migration_journal_success_check",
  ];
  const expectedIndexes = [
    "tutela_migration_journal_pkey",
    "tutela_migration_journal_status_idx",
  ];

  if (
    JSON.stringify(columns) !== JSON.stringify(expectedColumns) ||
    JSON.stringify(constraints) !== JSON.stringify(expectedConstraints) ||
    JSON.stringify(indexes) !== JSON.stringify(expectedIndexes)
  ) {
    throw new RehearsalSafetyError(
      "Migration journal structure verification failed.",
      "JOURNAL_STRUCTURE_MISMATCH",
    );
  }
}

async function markMigrationFailed(
  client: Client,
  identifier: string,
  error: unknown,
): Promise<void> {
  await client.query(
    `
      UPDATE public.tutela_migration_journal
      SET execution_status = 'failed',
          failure_message = $2,
          notes = 'Execution stopped; no successful application was recorded.'
      WHERE migration_identifier = $1
        AND execution_status = 'running'
    `,
    [identifier, redactedFailure(error)],
  );
}

async function executeMigration(
  client: Client,
  migration: MigrationDefinition,
): Promise<void> {
  await verifyRecoveryMarker(client);
  await assertNotApplied(client, migration.identifier);

  const migrationPath = absolute(migration.filename);
  const initialChecksum = sha256File(migrationPath);
  await migration.preflight(client);
  assertChecksum(
    initialChecksum,
    sha256File(migrationPath),
    migration.identifier,
  );

  await insertJournalRecord(client, {
    identifier: migration.identifier,
    filename: migration.filename,
    checksum: initialChecksum,
    provenance: migration.provenance,
    gitRevision: currentGitRevision(),
    status: "running",
    sqlExecuted: false,
    executionTimestamp: false,
    notes: "Preflight passed; execution started on the marked recovery branch.",
  });

  try {
    const sql = fs.readFileSync(migrationPath, "utf8");
    let executableSql = sql;
    if (migration.ownsTransaction) {
      if (!/\nBEGIN;\s*\n/.test(sql) || !/\nCOMMIT;\s*$/.test(sql)) {
        throw new RehearsalSafetyError(
          "Embedded transaction boundary could not be isolated safely.",
          "TRANSACTION_BOUNDARY_INVALID",
        );
      }
      executableSql = sql
        .replace(/\nBEGIN;\s*\n/, "\n")
        .replace(/\nCOMMIT;\s*$/, "\n");
      if (/\nBEGIN;\s*\n/.test(executableSql) || /\nCOMMIT;\s*$/.test(executableSql)) {
        throw new RehearsalSafetyError(
          "Embedded transaction boundary could not be isolated safely.",
          "TRANSACTION_BOUNDARY_INVALID",
        );
      }
    }
    await client.query("BEGIN");
    await client.query(executableSql);
    await migration.verify(client);
    await client.query("COMMIT");

    assertChecksum(
      initialChecksum,
      sha256File(migrationPath),
      migration.identifier,
    );
    await client.query(
      `
        UPDATE public.tutela_migration_journal
        SET execution_status = 'succeeded',
            sql_executed = true,
            execution_timestamp = now(),
            notes = 'SQL executed and structural post-verification passed.'
        WHERE migration_identifier = $1
          AND execution_status = 'running'
      `,
      [migration.identifier],
    );
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    await markMigrationFailed(client, migration.identifier, error);
    throw error;
  }
}

async function assertJournalMatchesRepository(client: Client): Promise<void> {
  const expected = new Map([
    [
      "0000_migration_journal",
      {
        filename: "migrations/0000_migration_journal.sql",
        status: "succeeded",
        executed: true,
      },
    ],
    [
      "observed_legacy_neon_baseline_v1",
      {
        filename:
          "docs/recovery/phase-2a/observed-legacy-schema-baseline.md",
        status: "verified",
        executed: false,
      },
    ],
    [
      "0002_partner_relations",
      {
        filename: "migrations/0002_partner_relations.sql",
        status: "superseded",
        executed: false,
      },
    ],
    ...migrations.map(
      (migration) =>
        [
          migration.identifier,
          {
            filename: migration.filename,
            status: "succeeded",
            executed: true,
          },
        ] as const,
    ),
  ]);

  const rows = (
    await client.query<{
      identifier: string;
      filename: string;
      checksum: string;
      status: string;
      sql_executed: boolean;
      included_in_bootstrap: boolean;
      failure_message: string | null;
    }>(`
      SELECT
        migration_identifier AS identifier,
        migration_filename AS filename,
        checksum,
        execution_status AS status,
        sql_executed,
        included_in_bootstrap,
        failure_message
      FROM public.tutela_migration_journal
      ORDER BY migration_identifier
    `)
  ).rows;

  if (rows.length !== expected.size) {
    throw new RehearsalSafetyError(
      "Migration journal entry count is unexpected.",
      "JOURNAL_ENTRY_MISMATCH",
    );
  }

  for (const row of rows) {
    const expectedRow = expected.get(row.identifier);
    if (
      !expectedRow ||
      row.filename !== expectedRow.filename ||
      row.status !== expectedRow.status ||
      row.sql_executed !== expectedRow.executed ||
      row.included_in_bootstrap ||
      row.failure_message !== null
    ) {
      throw new RehearsalSafetyError(
        "Migration journal state differs from the approved plan.",
        "JOURNAL_ENTRY_MISMATCH",
      );
    }
    assertChecksum(
      row.checksum,
      sha256File(absolute(row.filename)),
      row.identifier,
    );
  }
}

async function expectDatabaseError(
  client: Client,
  expectedCode: string,
  operation: () => Promise<void>,
): Promise<void> {
  await client.query("BEGIN");
  try {
    await operation();
    throw new RehearsalSafetyError(
      "Expected constraint rejection did not occur.",
      "CONSTRAINT_NOT_ENFORCED",
    );
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : "";
    if (code !== expectedCode) throw error;
  } finally {
    await client.query("ROLLBACK").catch(() => undefined);
  }
}

async function runConstraintBehaviorTests(client: Client): Promise<void> {
  const users = (
    await client.query<{ id: string }>(
      "SELECT id FROM public.users ORDER BY id LIMIT 2",
    )
  ).rows;
  const offer = (
    await client.query<{ id: string; user_id: string }>(
      "SELECT id, user_id FROM public.offers ORDER BY id LIMIT 1",
    )
  ).rows[0];

  if (users.length !== 2 || !offer) {
    throw new RehearsalSafetyError(
      "Copied test data cannot support rollback-only behavior tests.",
      "TEST_PREREQUISITES_MISSING",
    );
  }

  await expectDatabaseError(client, "23502", async () => {
    await client.query(
      `
        INSERT INTO public.partner_relations
          (requester_id, partner_id, status)
        VALUES ($1, $2, NULL)
      `,
      [users[0].id, users[1].id],
    );
  });
  await expectDatabaseError(client, "23514", async () => {
    await client.query(
      `
        INSERT INTO public.partner_relations
          (requester_id, partner_id, status)
        VALUES ($1, $2, 'unsupported')
      `,
      [users[0].id, users[1].id],
    );
  });
  await expectDatabaseError(client, "23514", async () => {
    await client.query(
      `
        INSERT INTO public.offer_verifications
          (offer_id, submitted_by, documents, status, submitted_at)
        VALUES ($1, $2, '[]', 'approved', now())
      `,
      [offer.id, offer.user_id],
    );
  });
  await expectDatabaseError(client, "23514", async () => {
    await client.query(
      `
        INSERT INTO public.partner_relations
          (requester_id, partner_id, status)
        VALUES ($1, $1, 'pending')
      `,
      [users[0].id],
    );
  });
  await expectDatabaseError(client, "23505", async () => {
    await client.query(
      `
        INSERT INTO public.partner_relations
          (requester_id, partner_id, status)
        VALUES ($1, $2, 'pending')
      `,
      [users[0].id, users[1].id],
    );
    await client.query(
      `
        INSERT INTO public.partner_relations
          (requester_id, partner_id, status)
        VALUES ($2, $1, 'approved')
      `,
      [users[0].id, users[1].id],
    );
  });

  await client.query("BEGIN");
  try {
    await client.query(
      `
        INSERT INTO public.partner_relations
          (requester_id, partner_id, status)
        VALUES ($1, $2, 'rejected')
      `,
      [users[0].id, users[1].id],
    );
    await client.query(
      `
        INSERT INTO public.partner_relations
          (requester_id, partner_id, status)
        VALUES ($2, $1, 'pending')
      `,
      [users[0].id, users[1].id],
    );
  } finally {
    await client.query("ROLLBACK").catch(() => undefined);
  }

  await client.query("BEGIN");
  try {
    const verification = (
      await client.query<{ id: string }>(
        `
          INSERT INTO public.offer_verifications
            (offer_id, submitted_by, documents, submitted_at)
          VALUES ($1, $2, '[]', now())
          RETURNING id
        `,
        [offer.id, offer.user_id],
      )
    ).rows[0];
    const report = (
      await client.query<{ id: string }>(
        `
          INSERT INTO public.performance_insights_reports
            (user_id, summary, insights, recommendations, risk_factors, opportunities)
          VALUES ($1, '{}', '{}', '[]', '[]', '[]')
          RETURNING id
        `,
        [users[0].id],
      )
    ).rows[0];
    if (!verification?.id || !report?.id) {
      throw new RehearsalSafetyError(
        "UUID default behavior was not verified.",
        "UUID_DEFAULT_FAILED",
      );
    }
  } finally {
    await client.query("ROLLBACK").catch(() => undefined);
  }

  const counts = (
    await client.query<{
      partners: string;
      verifications: string;
      reports: string;
    }>(`
      SELECT
        (SELECT count(*)::bigint FROM public.partner_relations) AS partners,
        (SELECT count(*)::bigint FROM public.offer_verifications) AS verifications,
        (SELECT count(*)::bigint FROM public.performance_insights_reports) AS reports
    `)
  ).rows[0];
  if (
    counts.partners !== "0" ||
    counts.verifications !== "0" ||
    counts.reports !== "0"
  ) {
    throw new RehearsalSafetyError(
      "Rollback-only tests left business records behind.",
      "TEST_RECORDS_REMAIN",
    );
  }
}

async function executeRehearsal(client: Client): Promise<void> {
  await verifyLegacyBaseline(client);
  await createJournalAndBaseline(client);
  for (const migration of migrations) {
    await executeMigration(client, migration);
  }
  await assertJournalMatchesRepository(client);
  await verifyLegacyRowCounts(client);
  process.stdout.write(
    `REHEARSAL_EXECUTED\nBEFORE_FINGERPRINT=${LEGACY_STRUCTURAL_FINGERPRINT}\n` +
      `AFTER_FINGERPRINT=${await applicationSchemaFingerprint(client)}\n`,
  );
}

async function testRehearsal(client: Client): Promise<void> {
  await verifyRecoveryMarker(client);
  await verifyJournalStructure(client);
  await assertJournalMatchesRepository(client);
  await verify0003(client);
  await verify0004(client);
  await verify0005(client);
  await verifyLegacyRowCounts(client);

  for (const migration of migrations) {
    let rejected = false;
    try {
      await assertNotApplied(client, migration.identifier);
    } catch (error) {
      rejected =
        error instanceof RehearsalSafetyError &&
        error.code === "MIGRATION_ALREADY_APPLIED";
    }
    if (!rejected) {
      throw new RehearsalSafetyError(
        "Reapplication guard failed.",
        "REAPPLICATION_GUARD_FAILED",
      );
    }
  }

  let checksumRejected = false;
  try {
    assertChecksum(
      "0".repeat(64),
      sha256File(absolute(migrations[0].filename)),
      migrations[0].identifier,
    );
  } catch (error) {
    checksumRejected =
      error instanceof RehearsalSafetyError &&
      error.code === "CHECKSUM_MISMATCH";
  }
  if (!checksumRejected) {
    throw new RehearsalSafetyError(
      "Checksum mismatch guard failed.",
      "CHECKSUM_GUARD_FAILED",
    );
  }

  await runConstraintBehaviorTests(client);
  await assertJournalMatchesRepository(client);
  process.stdout.write("REHEARSAL_TESTS_PASSED\n");
}

async function printSafeStatus(client: Client): Promise<void> {
  await verifyRecoveryMarker(client);
  await assertJournalMatchesRepository(client);
  process.stdout.write(
    `REHEARSAL_VERIFIED\nAFTER_FINGERPRINT=${await applicationSchemaFingerprint(client)}\n`,
  );
}

async function main(): Promise<void> {
  const command = process.argv[2];
  if (!["execute", "test", "verify", "verify-reset"].includes(command)) {
    throw new RehearsalSafetyError(
      "Use execute, test, verify, or verify-reset.",
      "COMMAND_INVALID",
    );
  }

  const client = new Client({
    connectionString: requireRawDatabaseUrl(process.env.DATABASE_URL),
  });
  await client.connect();
  try {
    if (command === "execute") await executeRehearsal(client);
    if (command === "test") await testRehearsal(client);
    if (command === "verify") await printSafeStatus(client);
    if (command === "verify-reset") {
      await verifyRecreatedLegacyBaseline(client);
      process.stdout.write(
        `RECREATED_BASELINE_VERIFIED\nFINGERPRINT=${LEGACY_STRUCTURAL_FINGERPRINT}\n`,
      );
    }
  } finally {
    await client.end().catch(() => undefined);
  }
}

main().catch((error) => {
  process.stderr.write(`MIGRATION_REHEARSAL_STOPPED:${redactedFailure(error)}\n`);
  process.exitCode = 1;
});
