import { pool } from "./db";

const REQUIRED_USER_COLUMNS = [
  "id",
  "email",
  "password_hash",
  "auth_provider",
  "last_login_at",
  "login_enabled",
  "credential_status",
  "recovery_provenance",
] as const;

const REQUIRED_TABLES = [
  "users",
  "sessions",
  "email_verification_tokens",
  "offer_submission_revisions",
  "offer_verification_attempts",
  "offer_verification_findings",
  "offer_verification_events",
  "offer_verification_commands",
  "offer_workflow_transitions",
] as const;

export interface DatabaseSchemaVerification {
  legacyAuthenticationColumnsMissing: string[];
}

export async function verifyDatabaseSchema(options?: {
  allowLegacyAuthenticationSchema?: boolean;
}): Promise<DatabaseSchemaVerification> {
  const tableResult = await pool.query<{ table_name: string }>(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = ANY($1::text[])
  `, [REQUIRED_TABLES]);
  const tables = new Set(tableResult.rows.map((row) => row.table_name));
  const missingTables = REQUIRED_TABLES.filter((name) => !tables.has(name));

  if (missingTables.length > 0) {
    throw new Error(
      `Database schema is incomplete. Missing table(s): ${missingTables.join(", ")}. Apply the database schema and migrations before starting TUTELA.`,
    );
  }

  const columnResult = await pool.query<{ column_name: string }>(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users'
  `);
  const columns = new Set(columnResult.rows.map((row) => row.column_name));
  const missingColumns = REQUIRED_USER_COLUMNS.filter((name) => !columns.has(name));

  if (missingColumns.length > 0) {
    if (options?.allowLegacyAuthenticationSchema) {
      await pool.query("SELECT 1");
      return {
        legacyAuthenticationColumnsMissing: [...missingColumns],
      };
    }
    throw new Error(
      `Local authentication migration is incomplete. Missing users column(s): ${missingColumns.join(", ")}. Apply migrations/0001_local_auth.sql before starting TUTELA.`,
    );
  }

  const verifiedStatus = await pool.query<{ available: boolean }>(`
    SELECT EXISTS (
      SELECT 1
      FROM pg_type AS enum_type
      INNER JOIN pg_enum AS enum_value
        ON enum_value.enumtypid = enum_type.oid
      INNER JOIN pg_namespace AS enum_namespace
        ON enum_namespace.oid = enum_type.typnamespace
      WHERE enum_namespace.nspname = 'public'
        AND enum_type.typname = 'offer_status'
        AND enum_value.enumlabel = 'verified'
    ) AS available
  `);
  if (!verifiedStatus.rows[0]?.available) {
    throw new Error(
      "Offer verification migration is incomplete. Missing verified offer lifecycle status.",
    );
  }

  await pool.query("SELECT 1");
  return { legacyAuthenticationColumnsMissing: [] };
}
