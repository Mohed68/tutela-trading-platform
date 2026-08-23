import assert from "node:assert/strict";
import test from "node:test";

import {
  REGISTRY_CONTRACT_VERSION,
  createOrganizationProfileRevisionId,
} from "../organization-registry/index.js";
import {
  createOrganizationParticipationEligibilityRequest,
  isOrganizationParticipationEligibilityResult,
} from "../organization-participation-eligibility/index.js";
import { createOrganizationParticipationEligibilityResultInternal } from "../organization-participation-eligibility/eligibilityContracts.js";
import { createOrganizationVerificationWorkflowStreamIdentity } from "../organization-verification/application/persistence-contract/index.js";
import { deriveAuthoritativeOfferVerificationEligibility } from "../verification/eligibilityReadModel.js";
import {
  evaluateOfferPublicationEligibility,
  isOfferPublicationEligibilityResult,
  type OfferPublicationEligibilityInput,
} from "./index.js";

function must<T>(
  result: Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; code: string }>,
): T {
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error(result.code);
  return result.value;
}

function participation(outcome: "eligible" | "ineligible" = "eligible") {
  const streamIdentity = must(
    createOrganizationVerificationWorkflowStreamIdentity({
      workflowExecutionId: "publication-org-workflow",
      organizationId: "publication-org",
      recordId: "publication-org-record",
      revisionId: "publication-org-revision",
      attemptId: "publication-org-attempt",
    }),
  );
  const request = must(
    createOrganizationParticipationEligibilityRequest({
      evaluationId: "publication-participation-evaluation",
      userId: "publication-user",
      membershipId: "publication-membership",
      organizationId: streamIdentity.organizationId,
      organizationProfileRevisionId: must(
        createOrganizationProfileRevisionId("publication-profile-revision"),
      ),
      expectedRegistryContractVersion: REGISTRY_CONTRACT_VERSION,
      verificationStreamIdentity: streamIdentity,
      evaluatedAt: "2026-09-03T00:00:00.000Z",
    }),
  );
  const result = createOrganizationParticipationEligibilityResultInternal({
    request,
    outcome,
    reasonCodes:
      outcome === "eligible" ? [] : ["organization_not_trusted"],
  });
  assert.equal(isOrganizationParticipationEligibilityResult(result), true);
  return result;
}

function offerVerification(
  decision: "approved" | "revision_required" | "manual_review" = "approved",
) {
  const projection = deriveAuthoritativeOfferVerificationEligibility({
    offerId: "publication-offer",
    submissionRevision: 1,
    attemptId: "publication-offer-attempt",
    processState: "completed",
    decision,
    completedAt: "2026-09-03T00:00:00.000Z",
    engineVersion: "verification-engine/v1",
    technicalPolicyVersion: "technical/v1",
    commercialPolicyVersion: "commercial/v1",
    inputFingerprint: "b".repeat(64),
  });
  assert.ok(projection);
  return projection;
}

function input(
  overrides: Partial<OfferPublicationEligibilityInput> = {},
): OfferPublicationEligibilityInput {
  return {
    offerId: "publication-offer",
    lifecycleStatus: "verified",
    sellerOrganizationId: "publication-org",
    sellerUserId: "publication-user",
    organizationParticipation: {
      status: "resolved",
      result: participation(),
    },
    offerVerification: {
      status: "resolved",
      projection: offerVerification(),
    },
    ...overrides,
  };
}

test("eligible Organization plus verified lifecycle and approved Offer Verification is publishable", () => {
  const result = evaluateOfferPublicationEligibility(input());
  assert.equal(result.outcome, "publishable");
  assert.deepEqual(result.reasonCodes, []);
  assert.equal(isOfferPublicationEligibilityResult(result), true);
});

test("ineligible Organization is not publishable", () => {
  const result = evaluateOfferPublicationEligibility(
    input({
      organizationParticipation: {
        status: "resolved",
        result: participation("ineligible"),
      },
    }),
  );
  assert.equal(result.outcome, "not_publishable");
  assert.ok(result.reasonCodes.includes("organization_participation_ineligible"));
});

test("wrong Offer lifecycle is not publishable", () => {
  for (const lifecycleStatus of ["draft", "submitted", "active", "closed"]) {
    const result = evaluateOfferPublicationEligibility(
      input({ lifecycleStatus }),
    );
    assert.equal(result.outcome, "not_publishable");
    assert.ok(result.reasonCodes.includes("offer_lifecycle_not_verified"));
  }
});

test("failed and incomplete Offer Verification are not publishable", () => {
  const failed = evaluateOfferPublicationEligibility(
    input({
      offerVerification: {
        status: "resolved",
        projection: offerVerification("revision_required"),
      },
    }),
  );
  const incomplete = evaluateOfferPublicationEligibility(
    input({ offerVerification: { status: "not_found" } }),
  );
  assert.ok(failed.reasonCodes.includes("offer_verification_not_eligible"));
  assert.ok(incomplete.reasonCodes.includes("offer_verification_incomplete"));
});

test("scope mismatches fail closed", () => {
  const organizationMismatch = evaluateOfferPublicationEligibility(
    input({ sellerOrganizationId: "another-organization" }),
  );
  const offerMismatch = evaluateOfferPublicationEligibility(
    input({ offerId: "another-offer" }),
  );
  assert.ok(organizationMismatch.reasonCodes.includes("authority_scope_mismatch"));
  assert.ok(offerMismatch.reasonCodes.includes("authority_scope_mismatch"));
});

test("legacy booleans cannot override Publication Eligibility", () => {
  const legacyShapedInput = {
    ...input({ organizationParticipation: { status: "unavailable" } }),
    verified: true,
    sellerOrgVerified: true,
    status: "active",
  };
  const result = evaluateOfferPublicationEligibility(legacyShapedInput);
  assert.equal(result.outcome, "not_publishable");
  assert.ok(
    result.reasonCodes.includes("organization_participation_unavailable"),
  );
});

test("result authenticity rejects structural copies and remains immutable", () => {
  const result = evaluateOfferPublicationEligibility(input());
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.reasonCodes), true);
  assert.equal(isOfferPublicationEligibilityResult({ ...result }), false);
});

test("same authoritative inputs produce the same Publication Eligibility fingerprint", () => {
  const facts = input();
  assert.equal(
    evaluateOfferPublicationEligibility(facts).publicationEligibilityFingerprint,
    evaluateOfferPublicationEligibility(facts).publicationEligibilityFingerprint,
  );
});
