import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { getTableColumns } from "drizzle-orm";
import { Client, type QueryResultRow } from "pg";
import { insertOfferSchema, offers } from "../../shared/schema.js";
import {
  applicationSchemaFingerprint,
  requireRawDatabaseUrl,
  verifyRecoveryMarker,
} from "../migrations/rehearsal-lib.js";
import { verifyRecoveryUserState } from "../auth/recovery-user-lib.js";
import { isSafeRecoveryRequest } from "../../server/recoveryMode.js";

const EXPECTED_FINGERPRINT =
  "aeb77478a423b407e5e69705f78b7948e8020411b7defa26f605568f616fc401";
const EXPECTED_LEGACY_USER_HASH =
  "3369cf18c0fb7ffa5881cdd4a6c25c2da11ef489c46e7b9e52f5d28f41288bbc";
const EXPECTED_LEGACY_OFFER_HASH =
  "b9492303d4d3bb157941fd3ed609438761eb85396e83861af4cfb5f77664c2fc";

function snapshotHash(rows: QueryResultRow[]): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(rows.map((row) => row.record)))
    .digest("hex");
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
  return snapshotHash(rows);
}

test(
  "approved database has an additive empty draft state and unchanged legacy rows",
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
      await verifyRecoveryUserState(client);

      const beforeUsers = await tableSnapshot(
        client,
        "users",
        "WHERE source.recovery_provenance IS NULL",
      );
      const beforeOffers = await tableSnapshot(client, "offers");
      assert.equal(beforeUsers, EXPECTED_LEGACY_USER_HASH);
      assert.equal(beforeOffers, EXPECTED_LEGACY_OFFER_HASH);

      const counts = (
        await client.query<{
          legacy_users: number;
          recovery_users: number;
          offers: number;
          recovery_offers: number;
          sessions: number;
        }>(`
          SELECT
            (SELECT count(*)::int
             FROM public.users
             WHERE recovery_provenance IS NULL) AS legacy_users,
            (SELECT count(*)::int
             FROM public.users
             WHERE recovery_provenance = 'tutela-recovery-test')
              AS recovery_users,
            (SELECT count(*)::int FROM public.offers) AS offers,
            (
              SELECT count(*)::int
              FROM public.offers AS offer
              INNER JOIN public.users AS owner
                ON owner.id = offer.user_id
              WHERE owner.recovery_provenance = 'tutela-recovery-test'
            ) AS recovery_offers,
            (SELECT count(*)::int FROM public.sessions) AS sessions
        `)
      ).rows[0];
      assert.deepEqual(counts, {
        legacy_users: 4,
        recovery_users: 1,
        offers: 9,
        recovery_offers: 0,
        sessions: 0,
      });

      const databaseStatuses = (
        await client.query<{ enumlabel: string }>(`
          SELECT enum_value.enumlabel
          FROM pg_type AS enum_type
          INNER JOIN pg_enum AS enum_value
            ON enum_value.enumtypid = enum_type.oid
          WHERE enum_type.typname = 'offer_status'
          ORDER BY enum_value.enumsortorder
        `)
      ).rows.map((row) => row.enumlabel);
      assert.deepEqual(databaseStatuses, [
        "active",
        "pending",
        "closed",
        "cancelled",
        "draft",
        "submitted",
        "verified",
      ]);
      assert.equal(databaseStatuses.includes("draft"), true);

      const stateCounts = (
        await client.query<{
          active: number;
          expired: number;
          draft: number;
        }>(`
          SELECT
            count(*) FILTER (WHERE status::text = 'active')::int AS active,
            count(*) FILTER (
              WHERE valid_until IS NOT NULL
                AND valid_until <= now()
            )::int AS expired,
            count(*) FILTER (WHERE status::text = 'draft')::int AS draft
          FROM public.offers
        `)
      ).rows[0];
      assert.deepEqual(stateCounts, {
        active: 9,
        expired: 9,
        draft: 0,
      });

      const columns = (
        await client.query<{ column_name: string }>(`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'offers'
          ORDER BY ordinal_position
        `)
      ).rows.map((row) => row.column_name);
      for (const absent of [
        "verified",
        "seller_org_verified",
        "moderation_status",
        "recovery_provenance",
      ]) {
        assert.equal(columns.includes(absent), false);
      }

      assert.equal(
        await tableSnapshot(
          client,
          "users",
          "WHERE source.recovery_provenance IS NULL",
        ),
        beforeUsers,
      );
      assert.equal(await tableSnapshot(client, "offers"), beforeOffers);
      await client.query("ROLLBACK");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      const code =
        error && typeof error === "object" && "code" in error
          ? String(error.code).replace(/[^A-Z0-9_-]/gi, "")
          : "ASSERTION_FAILURE";
      throw new Error(`PHASE5A_DATABASE_${code}`);
    } finally {
      await client.end().catch(() => undefined);
    }
  },
);

test("shared schema represents the additive database-backed draft state", () => {
  const columns = getTableColumns(offers);
  assert.deepEqual(columns.status.enumValues, [
    "active",
    "pending",
    "closed",
    "cancelled",
    "draft",
    "submitted",
    "verified",
    "hidden",
    "archived",
  ]);
  assert.equal(columns.status.enumValues.includes("draft"), true);
  assert.ok("verified" in columns);
  assert.ok("sellerOrgVerified" in columns);
  assert.ok("moderationStatus" in columns);
});

test("generic create validation accepts prohibited authority and invalid commerce", () => {
  const unsafe = insertOfferSchema.safeParse({
    userId: "client-controlled-owner",
    commodityId: "not-validated-before-parse",
    type: "buy",
    quantity: "0",
    unit: "UNSUPPORTED",
    pricePerUnit: "-1",
    currency: "ANY",
    location: "",
    status: "active",
    verified: true,
    sellerOrgVerified: true,
    moderationStatus: "active",
  });

  assert.equal(unsafe.success, true);
  if (!unsafe.success) return;
  assert.equal(unsafe.data.userId, "client-controlled-owner");
  assert.equal(unsafe.data.quantity, "0");
  assert.equal(unsafe.data.pricePerUnit, "-1");
  assert.equal(unsafe.data.verified, true);
  assert.equal(unsafe.data.sellerOrgVerified, true);
  assert.equal(unsafe.data.moderationStatus, "active");

  const draft = insertOfferSchema.safeParse({
    ...unsafe.data,
    status: "draft",
  });
  assert.equal(draft.success, true);
});

test("recovery guard blocks every current offer write and raw private detail", () => {
  assert.equal(isSafeRecoveryRequest("GET", "/api/offers"), true);
  assert.equal(isSafeRecoveryRequest("POST", "/api/offers"), false);
  assert.equal(
    isSafeRecoveryRequest("PATCH", "/api/offers/example/status"),
    false,
  );
  assert.equal(
    isSafeRecoveryRequest("DELETE", "/api/offers/example"),
    false,
  );
  assert.equal(
    isSafeRecoveryRequest("GET", "/api/offers/example"),
    false,
  );
  assert.equal(
    isSafeRecoveryRequest("POST", "/api/offers/example/verify"),
    false,
  );
  assert.equal(isSafeRecoveryRequest("POST", "/api/drafts"), true);
  assert.equal(isSafeRecoveryRequest("PATCH", "/api/drafts/example"), true);
  assert.equal(isSafeRecoveryRequest("DELETE", "/api/drafts/example"), true);
});
