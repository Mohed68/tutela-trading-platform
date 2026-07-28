import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "pg";
import {
  applicationSchemaFingerprint,
  requireRawDatabaseUrl,
  verifyRecoveryMarker,
} from "../migrations/rehearsal-lib.js";

const EXPECTED_FINGERPRINT =
  "0a899670e067b22692abc0a8f3d9d05c590f84d709d214984e2cf1e1749d1def";
const AUTH_COLUMNS = [
  "password_hash",
  "auth_provider",
  "last_login_at",
  "login_enabled",
  "credential_status",
  "recovery_provenance",
] as const;

test(
  "additive auth schema preserves disabled legacy identities",
  { skip: !process.env.DATABASE_URL, timeout: 30_000 },
  async () => {
    const client = new Client({
      connectionString: requireRawDatabaseUrl(process.env.DATABASE_URL),
    });

    try {
      await client.connect();
      await client.query("BEGIN READ ONLY");
      await verifyRecoveryMarker(client);
      assert.equal(
        await applicationSchemaFingerprint(client),
        EXPECTED_FINGERPRINT,
      );

      const columns = (
        await client.query<{
          column_name: string;
          is_nullable: "YES" | "NO";
          column_default: string | null;
        }>(
          `
            SELECT column_name, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'users'
              AND column_name = ANY($1::text[])
            ORDER BY column_name
          `,
          [AUTH_COLUMNS],
        )
      ).rows;
      assert.equal(columns.length, AUTH_COLUMNS.length);
      assert.equal(
        columns.every(
          (column) =>
            column.is_nullable === "YES" &&
            column.column_default === null,
        ),
        true,
      );

      const legacy = (
        await client.query<{
          count: string;
          auth_fields_set: string;
          distinct_ids: string;
          distinct_identifiers: string;
        }>(`
          SELECT
            count(*)::text AS count,
            count(*) FILTER (
              WHERE password_hash IS NOT NULL
                 OR auth_provider IS NOT NULL
                 OR last_login_at IS NOT NULL
                 OR login_enabled IS NOT NULL
                 OR credential_status IS NOT NULL
            )::text AS auth_fields_set,
            count(DISTINCT id)::text AS distinct_ids,
            count(DISTINCT lower(btrim(email)))::text
              AS distinct_identifiers
          FROM public.users
          WHERE recovery_provenance IS NULL
        `)
      ).rows[0];
      assert.deepEqual(legacy, {
        count: "4",
        auth_fields_set: "0",
        distinct_ids: "4",
        distinct_identifiers: "4",
      });

      const recovery = (
        await client.query<{ count: string }>(`
          SELECT count(*)::text AS count
          FROM public.users
          WHERE recovery_provenance = 'tutela-recovery-test'
        `)
      ).rows[0].count;
      assert.ok(recovery === "0" || recovery === "1");

      const journal = (
        await client.query<{
          execution_status: string;
          sql_executed: boolean;
        }>(`
          SELECT execution_status, sql_executed
          FROM public.tutela_migration_journal
          WHERE migration_identifier = '0006_additive_auth_recovery'
        `)
      ).rows[0];
      assert.deepEqual(journal, {
        execution_status: "succeeded",
        sql_executed: true,
      });

      const sessions = (
        await client.query<{ count: string }>(
          "SELECT count(*)::text AS count FROM public.sessions",
        )
      ).rows[0].count;
      assert.equal(sessions, "0");

      await client.query("ROLLBACK");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      const code =
        error && typeof error === "object" && "code" in error
          ? String(error.code).replace(/[^A-Z0-9_-]/gi, "")
          : "ASSERTION_FAILURE";
      throw new Error(`AUTH_CHARACTERIZATION_${code}`);
    } finally {
      await client.end().catch(() => undefined);
    }
  },
);
