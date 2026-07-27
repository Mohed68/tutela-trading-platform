import assert from "node:assert/strict";
import test from "node:test";
import { getTableColumns } from "drizzle-orm";
import { Client } from "pg";
import { offers } from "../../shared/schema.js";
import {
  applicationSchemaFingerprint,
  requireRawDatabaseUrl,
  verifyRecoveryMarker,
} from "../migrations/rehearsal-lib.js";

const APPROVED_POST_MIGRATION_FINGERPRINT =
  "1654ed34b5a19cef9edc6fe3e996553e59c370f311207a89348811f969e3def8";

type OfferVerificationState =
  | "verified"
  | "unverified"
  | "pending"
  | "unknown"
  | "not_applicable";

type SellerVerificationState =
  | "verified"
  | "unverified"
  | "pending"
  | "unknown"
  | "unavailable";

interface LegacyOfferFixture {
  id: string;
  type: "buy" | "sell";
  commodity: {
    id: string;
    name: string;
    type: string;
  };
  quantity: string;
  unit: string;
  pricePerUnit: string;
  currency: string;
  location: string;
  status: "active" | "pending" | "closed" | "cancelled";
  validUntil: string | null;
  deliveryTerms: string | null;
  paymentTerms: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    passwordHash: string;
    companyName: string;
    financialRating: string;
  };
}

function proposedUnknownTrustProjection(row: LegacyOfferFixture) {
  return {
    id: row.id,
    offerType: row.type,
    commodity: {
      id: row.commodity.id,
      name: row.commodity.name,
      category: row.commodity.type,
    },
    quantity: {
      value: row.quantity,
      unit: row.unit,
    },
    pricing: {
      amountPerUnit: row.pricePerUnit,
      currency: row.currency,
    },
    location: row.location,
    terms: {
      delivery: row.deliveryTerms,
      payment: row.paymentTerms,
      validUntil: row.validUntil,
    },
    status: row.status,
    trust: {
      offerVerification: {
        state: "unknown" as OfferVerificationState,
        evidenceSource: null,
        verifiedAt: null,
      },
      sellerOrganizationVerification: {
        state: "unavailable" as SellerVerificationState,
        evidenceSource: null,
        verifiedAt: null,
      },
    },
    visibility: {
      state: "unknown" as const,
    },
    seller: {
      displayName: null,
    },
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function verificationLabel(
  state: OfferVerificationState | SellerVerificationState,
): string {
  if (state === "verified") return "Verified";
  if (state === "pending") return "Verification pending";
  if (state === "unverified") return "Not verified";
  if (state === "not_applicable") return "Not applicable";
  return "Verification unavailable";
}

test("proposed DTO preserves absent trust evidence as unknown and unavailable", () => {
  const dto = proposedUnknownTrustProjection({
    id: "offer-fixture",
    type: "sell",
    commodity: {
      id: "commodity-fixture",
      name: "Fixture commodity",
      type: "agricultural",
    },
    quantity: "10.00",
    unit: "mt",
    pricePerUnit: "100.00",
    currency: "USD",
    location: "Fixture location",
    status: "active",
    validUntil: null,
    deliveryTerms: null,
    paymentTerms: null,
    createdAt: null,
    updatedAt: null,
    user: {
      id: "private-user-id",
      email: "private@example.invalid",
      firstName: "Private",
      lastName: "Person",
      passwordHash: "never-public",
      companyName: "Private organization",
      financialRating: "5.0",
    },
  });

  assert.equal(dto.trust.offerVerification.state, "unknown");
  assert.equal(
    dto.trust.sellerOrganizationVerification.state,
    "unavailable",
  );
  assert.equal(dto.visibility.state, "unknown");
  assert.equal(dto.seller.displayName, null);
  assert.equal(verificationLabel("unknown"), "Verification unavailable");
  assert.equal(verificationLabel("unavailable"), "Verification unavailable");
  assert.notEqual(verificationLabel("unknown"), "Verified");

  const serialized = JSON.stringify(dto);
  for (const forbiddenValue of [
    "private-user-id",
    "private@example.invalid",
    "Private",
    "Person",
    "never-public",
    "Private organization",
    "5.0",
  ]) {
    assert.ok(!serialized.includes(forbiddenValue));
  }
});

test(
  "approved disposable database proves current and legacy offer schemas are incompatible",
  { skip: !process.env.DATABASE_URL },
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
        APPROVED_POST_MIGRATION_FINGERPRINT,
      );

      const beforeCount = (
        await client.query<{ count: string }>(
          "SELECT count(*)::text AS count FROM public.offers",
        )
      ).rows[0].count;

      const databaseColumns = (
        await client.query<{ column_name: string }>(`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'offers'
          ORDER BY ordinal_position
        `)
      ).rows.map((row) => row.column_name);

      const currentColumns = getTableColumns(offers);
      assert.ok("verified" in currentColumns);
      assert.ok("sellerOrgVerified" in currentColumns);
      assert.ok(!databaseColumns.includes("verified"));
      assert.ok(!databaseColumns.includes("seller_org_verified"));

      const statuses = (
        await client.query<{ status: string; count: string }>(`
          SELECT status::text AS status, count(*)::text AS count
          FROM public.offers
          GROUP BY status
          ORDER BY status
        `)
      ).rows;
      assert.deepEqual(statuses, [{ status: "active", count: "9" }]);

      const evidenceCounts = (
        await client.query<{
          offer_verifications: string;
          verification_documents: string;
          relevant_activity_logs: string;
        }>(`
          SELECT
            (SELECT count(*)::text FROM public.offer_verifications)
              AS offer_verifications,
            (SELECT count(*)::text FROM public.verification_documents)
              AS verification_documents,
            (
              SELECT count(*)::text
              FROM public.activity_logs
              WHERE action ILIKE ANY(
                ARRAY[
                  '%approv%',
                  '%verif%',
                  '%moder%',
                  '%hidden%',
                  '%archiv%',
                  '%kyb%'
                ]
              )
            ) AS relevant_activity_logs
        `)
      ).rows[0];
      assert.deepEqual(evidenceCounts, {
        offer_verifications: "0",
        verification_documents: "0",
        relevant_activity_logs: "0",
      });

      const afterCount = (
        await client.query<{ count: string }>(
          "SELECT count(*)::text AS count FROM public.offers",
        )
      ).rows[0].count;
      assert.equal(afterCount, beforeCount);

      await client.query("ROLLBACK");
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // The original failure is reported below using only a safe code.
      }

      const code =
        error && typeof error === "object" && "code" in error
          ? String(error.code).replace(/[^A-Z0-9_-]/gi, "")
          : "ASSERTION_OR_CONNECTION_FAILURE";
      throw new Error(`MARKETPLACE_CHARACTERIZATION_${code}`);
    } finally {
      await client.end().catch(() => undefined);
    }
  },
);
