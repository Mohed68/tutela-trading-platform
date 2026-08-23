import assert from "node:assert/strict";
import test from "node:test";

import {
  REGISTRY_CONTRACT_VERSION,
  createOrganizationProfileRevisionId,
} from "../organization-registry/index.js";
import { createOrganizationParticipationEligibilityRequest } from "../organization-participation-eligibility/index.js";
import { createOrganizationParticipationEligibilityResultInternal } from "../organization-participation-eligibility/eligibilityContracts.js";
import { createOrganizationVerificationWorkflowStreamIdentity } from "../organization-verification/application/persistence-contract/index.js";
import {
  evaluateOfferPublicationEligibility,
  type OfferPublicationEligibilityDependencies,
} from "../offer-publication-eligibility/index.js";
import { deriveAuthoritativeOfferVerificationEligibility } from "../verification/eligibilityReadModel.js";
import {
  buildMarketplaceOptions,
  buildMarketplaceSummary,
  buildPublishedMarketplaceOfferRecords,
  filterPublishedMarketplaceOffers,
  projectPublishedOffer,
  type PublishedOfferRow,
} from "./publicMarketplace.js";

function must<T>(
  result: Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; code: string }>,
): T {
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error(result.code);
  return result.value;
}

function eligibleParticipation() {
  const streamIdentity = must(
    createOrganizationVerificationWorkflowStreamIdentity({
      workflowExecutionId: "marketplace-org-workflow",
      organizationId: "marketplace-org",
      recordId: "marketplace-org-record",
      revisionId: "marketplace-org-revision",
      attemptId: "marketplace-org-attempt",
    }),
  );
  const request = must(
    createOrganizationParticipationEligibilityRequest({
      evaluationId: "marketplace-participation-evaluation",
      userId: "marketplace-user",
      membershipId: "marketplace-membership",
      organizationId: streamIdentity.organizationId,
      organizationProfileRevisionId: must(
        createOrganizationProfileRevisionId("marketplace-profile-revision"),
      ),
      expectedRegistryContractVersion: REGISTRY_CONTRACT_VERSION,
      verificationStreamIdentity: streamIdentity,
      evaluatedAt: "2026-09-03T00:00:00.000Z",
    }),
  );
  return createOrganizationParticipationEligibilityResultInternal({
    request,
    outcome: "eligible",
    reasonCodes: [],
  });
}

function eligibleOfferVerification(offerId = "public-offer") {
  const projection = deriveAuthoritativeOfferVerificationEligibility({
    offerId,
    submissionRevision: 1,
    attemptId: `${offerId}-attempt`,
    processState: "completed",
    decision: "approved",
    completedAt: "2026-09-03T00:00:00.000Z",
    engineVersion: "verification-engine/v1",
    technicalPolicyVersion: "technical/v1",
    commercialPolicyVersion: "commercial/v1",
    inputFingerprint: "c".repeat(64),
    evidenceSource: "platform_submitted",
    evidenceAssuranceLevel: "documentary",
  });
  assert.ok(projection);
  return projection;
}

const verifiedRow: PublishedOfferRow = {
  id: "public-offer",
  user_id: "marketplace-user",
  seller_organization_id: "marketplace-org",
  offer_type: "sell",
  quantity: "10.00",
  unit: "MT",
  price_per_unit: "100.00",
  currency: "USD",
  location: "Public location",
  status: "verified",
  valid_until: null,
  minimum_quantity: null,
  delivery_terms: null,
  payment_terms: null,
  created_at: null,
  updated_at: null,
  commodity_id: "commodity",
  commodity_name: "Public commodity",
  commodity_category: "agricultural",
};

const eligibleDependencies: OfferPublicationEligibilityDependencies =
  Object.freeze({
    organizationParticipationEligibility: Object.freeze({
      async resolveCurrentOrganizationParticipationEligibility() {
        return Object.freeze({
          status: "resolved" as const,
          result: eligibleParticipation(),
        });
      },
    }),
    offerVerificationEligibility: Object.freeze({
      async resolveCurrentOfferVerificationEligibility(offerId: string) {
        return Object.freeze({
          status: "resolved" as const,
          projection: eligibleOfferVerification(offerId),
        });
      },
    }),
  });

test("projection accepts only an authentic publishable eligibility result", () => {
  const publicationEligibility = evaluateOfferPublicationEligibility({
    offerId: verifiedRow.id,
    lifecycleStatus: verifiedRow.status,
    sellerOrganizationId: verifiedRow.seller_organization_id!,
    sellerUserId: verifiedRow.user_id,
    organizationParticipation: {
      status: "resolved",
      result: eligibleParticipation(),
    },
    offerVerification: {
      status: "resolved",
      projection: eligibleOfferVerification(),
    },
  });
  assert.equal(projectPublishedOffer(verifiedRow, publicationEligibility).offer.id, verifiedRow.id);
  assert.throws(
    () => projectPublishedOffer(verifiedRow, { ...publicationEligibility }),
    /MARKETPLACE_PUBLICATION_ELIGIBILITY_REQUIRED/,
  );
});

test("marketplace includes only offers accepted by Publication Eligibility", async () => {
  const records = await buildPublishedMarketplaceOfferRecords(
    [verifiedRow, { ...verifiedRow, id: "submitted-offer", status: "submitted" }],
    eligibleDependencies,
  );
  assert.deepEqual(records.map(({ offer }) => offer.id), ["public-offer"]);
});

test("unavailable Organization Participation excludes otherwise valid offers", async () => {
  const records = await buildPublishedMarketplaceOfferRecords([verifiedRow], {
    ...eligibleDependencies,
    organizationParticipationEligibility: {
      async resolveCurrentOrganizationParticipationEligibility() {
        return Object.freeze({ status: "unavailable" as const });
      },
    },
  });
  assert.deepEqual(records, []);
});

test("public projection excludes seller keys and sensitive user data", async () => {
  const [record] = await buildPublishedMarketplaceOfferRecords(
    [verifiedRow],
    eligibleDependencies,
  );
  assert.equal(record.offer.trust.offerVerification.state, "verified");
  assert.equal(
    record.offer.trust.sellerOrganizationVerification.state,
    "verified",
  );
  assert.equal(record.offer.visibility.state, "published");
  assert.equal(record.offer.status, "verified");
  assert.equal(record.offer.seller.displayName, null);

  const serialized = JSON.stringify(record.offer);
  for (const forbidden of [
    "userId",
    "user_id",
    "email",
    "password",
    "firstName",
    "lastName",
    "kyb",
    "moderation",
    "document",
  ]) {
    assert.ok(!serialized.toLowerCase().includes(forbidden.toLowerCase()));
  }
});

test("empty published population produces aligned list helpers", () => {
  assert.deepEqual(
    filterPublishedMarketplaceOffers([], {
      category: "agricultural",
      commodityKey: "public_commodity",
      q: "commodity",
    }),
    [],
  );
  assert.deepEqual(buildMarketplaceOptions([]), { commodities: [] });
  assert.deepEqual(buildMarketplaceSummary([]), {
    activeOffers: 0,
    publishedOffers: 0,
    marketValueUsd: 0,
    avgPrice: null,
    avgPriceUnit: undefined,
    avgPriceCount: 0,
    avgPriceCoverage: { used: 0, skipped: 0 },
    median: null,
    p25: null,
    p75: null,
  });
});
