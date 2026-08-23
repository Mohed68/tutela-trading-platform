import assert from "node:assert/strict";
import test from "node:test";

import {
  deriveAuthoritativeOfferVerificationEligibility,
  isAuthoritativeOfferVerificationEligibility,
} from "./eligibilityReadModel.js";

const approvedSource = Object.freeze({
  offerId: "offer-publication-1",
  submissionRevision: 2,
  attemptId: "offer-attempt-2",
  processState: "completed" as const,
  decision: "approved" as const,
  completedAt: "2026-09-03T00:00:00.000Z",
  engineVersion: "verification-engine/v1",
  technicalPolicyVersion: "technical/v1",
  commercialPolicyVersion: "commercial/v1",
  inputFingerprint: "a".repeat(64),
  evidenceSource: "platform_submitted" as const,
  evidenceAssuranceLevel: "documentary" as const,
});

test("current completed approval derives authentic eligible Offer Verification", () => {
  const projection = deriveAuthoritativeOfferVerificationEligibility(approvedSource);
  assert.ok(projection);
  assert.equal(projection.eligibility, "eligible");
  assert.equal(isAuthoritativeOfferVerificationEligibility(projection), true);
  assert.equal(Object.isFrozen(projection), true);
});

test("pending and non-approved decisions never derive eligible", () => {
  const pending = deriveAuthoritativeOfferVerificationEligibility({
    ...approvedSource,
    processState: "running",
    decision: null,
    completedAt: null,
  });
  const revision = deriveAuthoritativeOfferVerificationEligibility({
    ...approvedSource,
    decision: "revision_required",
  });
  assert.equal(pending?.eligibility, "pending");
  assert.equal(revision?.eligibility, "not_eligible");
});

test("inconsistent process and decision combinations fail closed", () => {
  assert.equal(
    deriveAuthoritativeOfferVerificationEligibility({
      ...approvedSource,
      processState: "running",
    }),
    undefined,
  );
  assert.equal(
    deriveAuthoritativeOfferVerificationEligibility({
      ...approvedSource,
      decision: null,
    }),
    undefined,
  );
});

test("structural and object-spread copies are not authoritative", () => {
  const projection = deriveAuthoritativeOfferVerificationEligibility(approvedSource);
  assert.ok(projection);
  assert.equal(
    isAuthoritativeOfferVerificationEligibility({ ...projection }),
    false,
  );
  assert.equal(
    isAuthoritativeOfferVerificationEligibility(
      Object.freeze(JSON.parse(JSON.stringify(projection))),
    ),
    false,
  );
});

test("identical source facts produce deterministic fingerprints", () => {
  const first = deriveAuthoritativeOfferVerificationEligibility(approvedSource);
  const second = deriveAuthoritativeOfferVerificationEligibility(approvedSource);
  assert.equal(first?.projectionFingerprint, second?.projectionFingerprint);
});
