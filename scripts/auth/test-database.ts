import { Pool } from "pg";

const TEST_DATABASE_REQUIRED = "TEST_DATABASE_URL_REQUIRED";
const TEST_DATABASE_AMBIGUOUS = "TEST_DATABASE_URL_AMBIGUOUS";
const TEST_DATABASE_INVALID = "TEST_DATABASE_URL_INVALID";

export const REQUIRED_AUTH_TEST_MIGRATION =
  "0017_organization_verification_artifact_fingerprint_compatibility";

export interface TestDatabaseIdentity {
  readonly connectionString: string;
}

function normalizedSecret(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function requireTestDatabase(
  environment: NodeJS.ProcessEnv = process.env,
): Readonly<TestDatabaseIdentity> {
  const connectionString = normalizedSecret(environment.TEST_DATABASE_URL);
  if (!connectionString) {
    throw new Error(TEST_DATABASE_REQUIRED);
  }

  const runtimeConnectionString = normalizedSecret(environment.DATABASE_URL);
  if (
    runtimeConnectionString !== undefined &&
    runtimeConnectionString === connectionString
  ) {
    throw new Error(TEST_DATABASE_AMBIGUOUS);
  }

  try {
    const parsed = new URL(connectionString);
    if (
      !["postgres:", "postgresql:"].includes(parsed.protocol) ||
      !parsed.hostname ||
      !parsed.pathname.slice(1)
    ) {
      throw new Error(TEST_DATABASE_INVALID);
    }
  } catch {
    throw new Error(TEST_DATABASE_INVALID);
  }

  return Object.freeze({ connectionString });
}

export function createAuthIntegrationTestPool(
  identity: Readonly<TestDatabaseIdentity>,
): Pool {
  return new Pool({
    connectionString: identity.connectionString,
    application_name: "tutela-auth-integration-test",
    max: 2,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 10_000,
  });
}

export async function verifyAuthTestDatabaseBaseline(pool: Pool): Promise<void> {
  const result = await pool.query<{
    users_table: string | null;
    sessions_table: string | null;
    journal_table: string | null;
    latest_migration_status: string | null;
  }>(
    `
      SELECT
        to_regclass('public.users')::text AS users_table,
        to_regclass('public.sessions')::text AS sessions_table,
        to_regclass('public.tutela_migration_journal')::text AS journal_table,
        (
          SELECT execution_status
          FROM public.tutela_migration_journal
          WHERE migration_identifier = $1
        ) AS latest_migration_status
    `,
    [REQUIRED_AUTH_TEST_MIGRATION],
  );

  const baseline = result.rows[0];
  if (
    baseline?.users_table !== "users" ||
    baseline.sessions_table !== "sessions" ||
    baseline.journal_table !== "tutela_migration_journal" ||
    !["succeeded", "verified"].includes(
      baseline.latest_migration_status ?? "",
    )
  ) {
    throw new Error("AUTH_TEST_DATABASE_BASELINE_INVALID");
  }

  const sessionColumns = await pool.query<{ column_name: string }>(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sessions'
      AND column_name IN ('sid', 'sess', 'expire')
    ORDER BY column_name
  `);
  if (
    sessionColumns.rows.map(({ column_name }) => column_name).join(",") !==
    "expire,sess,sid"
  ) {
    throw new Error("AUTH_TEST_SESSION_SCHEMA_INVALID");
  }
}
