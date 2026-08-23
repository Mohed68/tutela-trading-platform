import { pool } from "../db.js";
import {
  createReadonlyPostgresPort,
  type RawPostgresQuery,
} from "../infrastructure/readonlyPostgres.js";
import {
  createPostgresOrganizationVerificationPersistenceAdapter,
  type OrganizationVerificationPostgresDatabase,
  type OrganizationVerificationPostgresQueryClient,
} from "../organization-verification/infrastructure/persistence/postgres/index.js";
import { createPostgresMarketplaceOrganizationParticipationEligibilityAdapter } from "./postgresRuntime.js";

const execute: RawPostgresQuery = async (statement, parameters) => {
  const result = await pool.query(statement, [...parameters]);
  return {
    rowCount: result.rowCount,
    rows: result.rows.map((row) => Object.fromEntries(Object.entries(row))),
  };
};

const participationDatabase = createReadonlyPostgresPort(execute);

const organizationVerificationDatabase: OrganizationVerificationPostgresDatabase =
  Object.freeze({
    query(statement: string, parameters: readonly unknown[] = []) {
      return participationDatabase.query(statement, parameters);
    },
    async transaction<T>(
      operation: (
        client: OrganizationVerificationPostgresQueryClient,
      ) => Promise<T>,
    ) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const transactionExecute: RawPostgresQuery = async (
          statement,
          parameters,
        ) => {
          const result = await client.query(statement, [...parameters]);
          return {
            rowCount: result.rowCount,
            rows: result.rows.map((row) =>
              Object.fromEntries(Object.entries(row)),
            ),
          };
        };
        const result = await operation(
          createReadonlyPostgresPort(transactionExecute),
        );
        await client.query("COMMIT");
        return result;
      } catch (error) {
        try {
          await client.query("ROLLBACK");
        } catch {
          // Preserve the original failure and expose no connection details.
        }
        throw error;
      } finally {
        client.release();
      }
    },
  });

export const productionOrganizationParticipationEligibilityReadAdapter =
  createPostgresMarketplaceOrganizationParticipationEligibilityAdapter({
    database: participationDatabase,
    evidenceStream:
      createPostgresOrganizationVerificationPersistenceAdapter(
        organizationVerificationDatabase,
      ),
    clock: Object.freeze({ now: () => new Date().toISOString() }),
  });
