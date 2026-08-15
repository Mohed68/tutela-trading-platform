import type { Pool, PoolClient, QueryResultRow } from "pg";

export type OrganizationVerificationPostgresRow = Readonly<
  Record<string, unknown>
>;

export interface OrganizationVerificationPostgresQueryResult {
  readonly rowCount: number;
  readonly rows: readonly OrganizationVerificationPostgresRow[];
}

export interface OrganizationVerificationPostgresQueryClient {
  query(
    statement: string,
    parameters?: readonly unknown[],
  ): Promise<OrganizationVerificationPostgresQueryResult>;
}

export interface OrganizationVerificationPostgresDatabase
  extends OrganizationVerificationPostgresQueryClient {
  transaction<T>(
    operation: (
      client: OrganizationVerificationPostgresQueryClient,
    ) => Promise<T>,
  ): Promise<T>;
}

function normalizedRows(
  rows: readonly QueryResultRow[],
): readonly OrganizationVerificationPostgresRow[] {
  return Object.freeze(
    rows.map((row) => Object.freeze(Object.fromEntries(Object.entries(row)))),
  );
}

async function query(
  client: Pick<PoolClient, "query"> | Pick<Pool, "query">,
  statement: string,
  parameters: readonly unknown[] = [],
): Promise<OrganizationVerificationPostgresQueryResult> {
  const result = await client.query(statement, [...parameters]);
  return Object.freeze({
    rowCount: result.rowCount ?? 0,
    rows: normalizedRows(result.rows),
  });
}

export function createNodePostgresOrganizationVerificationDatabase(
  pool: Pool,
): OrganizationVerificationPostgresDatabase {
  return Object.freeze({
    query(statement: string, parameters: readonly unknown[] = []) {
      return query(pool, statement, parameters);
    },
    async transaction<T>(
      operation: (
        client: OrganizationVerificationPostgresQueryClient,
      ) => Promise<T>,
    ): Promise<T> {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const transactionClient: OrganizationVerificationPostgresQueryClient =
          Object.freeze({
            query(statement: string, parameters: readonly unknown[] = []) {
              return query(client, statement, parameters);
            },
          });
        const result = await operation(transactionClient);
        await client.query("COMMIT");
        return result;
      } catch (error) {
        try {
          await client.query("ROLLBACK");
        } catch {
          // Preserve the original failure without leaking rollback details.
        }
        throw error;
      } finally {
        client.release();
      }
    },
  });
}
