import { pool } from "./db";

const REQUIRED_USER_COLUMNS = [
  "id",
  "email",
  "password_hash",
  "auth_provider",
  "email_verified_at",
  "last_login_at",
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
      AND table_name IN ('users', 'sessions')
  `);
  const tables = new Set(tableResult.rows.map((row) => row.table_name));
  const missingTables = ["users", "sessions"].filter((name) => !tables.has(name));

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

  await pool.query("SELECT 1");
  return { legacyAuthenticationColumnsMissing: [] };
}
