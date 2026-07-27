import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "pg";
import {
  applicationSchemaFingerprint,
  requireRawDatabaseUrl,
  verifyRecoveryMarker,
} from "../migrations/rehearsal-lib.js";

const EXPECTED_FINGERPRINT =
  "1654ed34b5a19cef9edc6fe3e996553e59c370f311207a89348811f969e3def8";

const EXPECTED_COUNTS = new Map([
  ["neon_auth.users_sync", "1"],
  ["public.activity_logs", "0"],
  ["public.commodities", "9"],
  ["public.contracts", "0"],
  ["public.offers", "9"],
  ["public.partner_relations", "0"],
  ["public.sessions", "0"],
  ["public.users", "4"],
  ["public.verification_documents", "0"],
  ["public.offer_verifications", "0"],
  ["public.performance_insights_reports", "0"],
]);

const LEGACY_USER_COLUMNS = [
  "id",
  "email",
  "first_name",
  "last_name",
  "profile_image_url",
  "company_name",
  "role",
  "financial_rating",
  "credit_rating",
  "verified",
  "created_at",
  "updated_at",
] as const;

const REQUIRED_LOCAL_AUTH_COLUMNS = [
  "password_hash",
  "auth_provider",
  "email_verified_at",
  "last_login_at",
] as const;

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

test(
  "approved legacy identity boundary remains read-only and incompatible with local credentials",
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

      for (const [name, expected] of EXPECTED_COUNTS) {
        const [schema, table] = name.split(".");
        const result = await client.query<{ count: string }>(
          `SELECT count(*)::text AS count
           FROM ${quoteIdentifier(schema)}.${quoteIdentifier(table)}`,
        );
        assert.equal(result.rows[0].count, expected);
      }

      const userColumns = (
        await client.query<{
          column_name: string;
          data_type: string;
          is_nullable: "YES" | "NO";
        }>(`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'users'
          ORDER BY ordinal_position
        `)
      ).rows;
      assert.deepEqual(
        userColumns.map((column) => column.column_name),
        LEGACY_USER_COLUMNS,
      );
      assert.deepEqual(
        REQUIRED_LOCAL_AUTH_COLUMNS.filter((required) =>
          userColumns.some((column) => column.column_name === required),
        ),
        [],
      );
      assert.equal(userColumns[0].column_name, "id");
      assert.equal(userColumns[0].data_type, "character varying");
      assert.equal(userColumns[0].is_nullable, "NO");
      assert.equal(
        userColumns.some((column) =>
          /(password|provider|disabled|deleted|locked)/i.test(
            column.column_name,
          ),
        ),
        false,
      );

      const identitySummary = (
        await client.query<{
          total: string;
          non_null_identifiers: string;
          blank_identifiers: string;
          distinct_identifiers: string;
          distinct_ids: string;
          null_ids: string;
        }>(`
          SELECT
            count(*)::text AS total,
            count(email)::text AS non_null_identifiers,
            count(*) FILTER (WHERE btrim(email) = '')::text
              AS blank_identifiers,
            count(DISTINCT lower(btrim(email)))
              FILTER (WHERE email IS NOT NULL AND btrim(email) <> '')::text
              AS distinct_identifiers,
            count(DISTINCT id)::text AS distinct_ids,
            count(*) FILTER (WHERE id IS NULL)::text AS null_ids
          FROM public.users
        `)
      ).rows[0];
      assert.deepEqual(identitySummary, {
        total: "4",
        non_null_identifiers: "4",
        blank_identifiers: "0",
        distinct_identifiers: "4",
        distinct_ids: "4",
        null_ids: "0",
      });

      const roleSummary = (
        await client.query<{
          total: string;
          distinct_roles: string;
          null_roles: string;
        }>(`
          SELECT
            count(*)::text AS total,
            count(DISTINCT role)::text AS distinct_roles,
            count(*) FILTER (WHERE role IS NULL)::text AS null_roles
          FROM public.users
        `)
      ).rows[0];
      assert.deepEqual(roleSummary, {
        total: "4",
        distinct_roles: "4",
        null_roles: "0",
      });

      const verificationSummary = (
        await client.query<{
          verified_count: string;
          not_verified_count: string;
          unknown_count: string;
        }>(`
          SELECT
            count(*) FILTER (WHERE verified IS TRUE)::text
              AS verified_count,
            count(*) FILTER (WHERE verified IS FALSE)::text
              AS not_verified_count,
            count(*) FILTER (WHERE verified IS NULL)::text
              AS unknown_count
          FROM public.users
        `)
      ).rows[0];
      assert.deepEqual(verificationSummary, {
        verified_count: "3",
        not_verified_count: "1",
        unknown_count: "0",
      });

      const sessionColumns = (
        await client.query<{
          column_name: string;
          data_type: string;
          is_nullable: "YES" | "NO";
        }>(`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'sessions'
          ORDER BY ordinal_position
        `)
      ).rows;
      assert.deepEqual(sessionColumns, [
        {
          column_name: "sid",
          data_type: "character varying",
          is_nullable: "NO",
        },
        {
          column_name: "sess",
          data_type: "jsonb",
          is_nullable: "NO",
        },
        {
          column_name: "expire",
          data_type: "timestamp without time zone",
          is_nullable: "NO",
        },
      ]);

      const journal = (
        await client.query<{ count: string; accepted_count: string }>(`
          SELECT
            count(*)::text AS count,
            count(*) FILTER (
              WHERE execution_status IN ('verified', 'succeeded', 'superseded')
            )::text AS accepted_count
          FROM public.tutela_migration_journal
        `)
      ).rows[0];
      assert.deepEqual(journal, { count: "6", accepted_count: "6" });

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

