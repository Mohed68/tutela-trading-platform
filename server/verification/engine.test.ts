import assert from "node:assert/strict";
import test from "node:test";
import type {
  SubmittedOfferVerificationSnapshot,
  VerificationRuleFinding,
} from "../../shared/verification.js";
import {
  confidenceForDecision,
  decideVerification,
  evaluateClaimedVerification,
  evaluateVerification,
  policyUnavailableVerificationResult,
  readVerificationEngineCompletion,
} from "./engine.js";
import {
  PHASE_6_COMMERCIAL_POLICY,
  PHASE_6_TECHNICAL_POLICY,
  commercialPolicyProvider,
  resolveVerificationPolicies,
  technicalPolicyProvider,
  VERIFICATION_SNAPSHOT_SCHEMA_VERSION,
} from "./policy.js";
import {
  canonicalVerificationSnapshot,
  fingerprintVerificationSnapshot,
  immutableVerificationSnapshot,
} from "./snapshot.js";

function validSnapshot(
  overrides: Partial<SubmittedOfferVerificationSnapshot> = {},
): SubmittedOfferVerificationSnapshot {
  return {
    snapshotSchemaVersion: VERIFICATION_SNAPSHOT_SCHEMA_VERSION,
    offerId: "1f45a665-0cb2-49ce-a945-e9a5e73c5fe6",
    submissionRevision: 1,
    submittedRecordVersion: "2026-07-28T10:00:00.000Z",
    offerType: "sell",
    commodity: {
      id: "b1f23a10-d52a-4cef-8a7f-a2dd83586239",
      name: "West Texas Intermediate (WTI) Crude Oil",
      category: "energy",
    },
    quantity: "100.00",
    unit: "bbl",
    amountPerUnit: "75.50",
    currency: "USD",
    location: "Houston",
    validUntil: "2026-08-30T00:00:00.000Z",
    lifecycleStatus: "submitted",
    ...overrides,
  };
}

const evaluatedAt = new Date("2026-07-28T12:00:00.000Z");

test("valid current-policy offer is approved with high confidence", () => {
  const result = evaluateVerification(validSnapshot(), { evaluatedAt });
  assert.equal(result.decision, "approved");
  assert.equal(result.confidence, "HIGH");
  assert.deepEqual(result.findings, []);
  assert.equal(
    result.technicalPolicyVersion,
    PHASE_6_TECHNICAL_POLICY.version,
  );
  assert.equal(
    result.commercialPolicyVersion,
    PHASE_6_COMMERCIAL_POLICY.version,
  );
});

test("owner-correctable technical failure requires revision", () => {
  const result = evaluateVerification(validSnapshot({ quantity: "0" }), {
    evaluatedAt,
  });
  assert.equal(result.decision, "revision_required");
  assert.equal(result.confidence, "HIGH");
  assert.deepEqual(
    result.findings.map(({ ruleId, reasonCode, severity }) => ({
      ruleId,
      reasonCode,
      severity,
    })),
    [
      {
        ruleId: "TECHNICAL-004",
        reasonCode: "INVALID_QUANTITY",
        severity: "ERROR",
      },
    ],
  );
});

test("invalid snapshot schema fails closed to manual review", () => {
  const result = evaluateVerification(
    validSnapshot({ snapshotSchemaVersion: "unknown-schema" }),
    { evaluatedAt },
  );
  assert.equal(result.decision, "manual_review");
  assert.equal(result.confidence, "LOW");
  assert.equal(result.findings[0].ruleId, "TECHNICAL-011");
  assert.equal(result.findings[0].severity, "CRITICAL");
});

test("non-submitted lifecycle fails closed without inventing approval", () => {
  const result = evaluateVerification(
    validSnapshot({ lifecycleStatus: "draft" }),
    { evaluatedAt },
  );
  assert.equal(result.decision, "manual_review");
  assert.equal(result.findings.at(-1)?.reasonCode, "OFFER_STATE_CONFLICT");
});

test("commercial policy rejects valid but disallowed unit and currency", () => {
  const result = evaluateVerification(
    validSnapshot({ unit: "kg", currency: "EUR" }),
    { evaluatedAt },
  );
  assert.equal(result.decision, "revision_required");
  assert.deepEqual(
    result.findings.map((finding) => finding.ruleId),
    ["COMMERCIAL-014", "COMMERCIAL-015"],
  );
});

test("unsupported commodity is revision required", () => {
  const result = evaluateVerification(
    validSnapshot({
      commodity: {
        id: "7cc4d6e4-c08f-40f1-a3ed-535852cb2282",
        name: "Unsupported Commodity",
        category: "other",
      },
    }),
    { evaluatedAt },
  );
  assert.equal(result.decision, "revision_required");
  assert.equal(result.findings[0].reasonCode, "UNSUPPORTED_COMMODITY");
});

test("severity metadata does not influence decision reduction", () => {
  const finding: VerificationRuleFinding = {
    ruleId: "TECHNICAL-004",
    reasonCode: "INVALID_QUANTITY",
    severity: "CRITICAL",
    disposition: "owner_correctable",
    policyFamily: "technical",
    policyVersion: "test",
    evaluationOrder: 1,
  };
  assert.equal(decideVerification([finding]), "revision_required");
  assert.equal(confidenceForDecision("revision_required"), "HIGH");
});

test("manual-review disposition has deterministic precedence", () => {
  const ownerFinding: VerificationRuleFinding = {
    ruleId: "TECHNICAL-004",
    reasonCode: "INVALID_QUANTITY",
    severity: "ERROR",
    disposition: "owner_correctable",
    policyFamily: "technical",
    policyVersion: "test",
    evaluationOrder: 1,
  };
  const platformFinding: VerificationRuleFinding = {
    ruleId: "SYSTEM-002",
    reasonCode: "VALIDATION_DATA_UNAVAILABLE",
    severity: "WARNING",
    disposition: "requires_platform_review",
    policyFamily: "system",
    policyVersion: "test",
    evaluationOrder: 2,
  };
  assert.equal(
    decideVerification([ownerFinding, platformFinding]),
    "manual_review",
  );
});

test("snapshot serialization and fingerprint are stable", () => {
  const snapshot = immutableVerificationSnapshot(validSnapshot());
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(Object.isFrozen(snapshot.commodity), true);
  assert.equal(
    canonicalVerificationSnapshot(snapshot),
    canonicalVerificationSnapshot({ ...snapshot }),
  );
  assert.match(fingerprintVerificationSnapshot(snapshot), /^[a-f0-9]{64}$/);
  assert.equal(
    fingerprintVerificationSnapshot(snapshot),
    fingerprintVerificationSnapshot({ ...snapshot }),
  );
});

test("recorded technical and commercial policy versions resolve independently", () => {
  assert.equal(
    technicalPolicyProvider.resolve(PHASE_6_TECHNICAL_POLICY.version),
    PHASE_6_TECHNICAL_POLICY,
  );
  assert.equal(
    commercialPolicyProvider.resolve(PHASE_6_COMMERCIAL_POLICY.version),
    PHASE_6_COMMERCIAL_POLICY,
  );
  assert.deepEqual(
    resolveVerificationPolicies({
      technicalPolicyVersion: PHASE_6_TECHNICAL_POLICY.version,
      commercialPolicyVersion: PHASE_6_COMMERCIAL_POLICY.version,
    }),
    {
      technical: PHASE_6_TECHNICAL_POLICY,
      commercial: PHASE_6_COMMERCIAL_POLICY,
    },
  );
  assert.equal(
    resolveVerificationPolicies({
      technicalPolicyVersion: "missing-technical",
      commercialPolicyVersion: PHASE_6_COMMERCIAL_POLICY.version,
    }),
    undefined,
  );
  assert.equal(
    resolveVerificationPolicies({
      technicalPolicyVersion: PHASE_6_TECHNICAL_POLICY.version,
      commercialPolicyVersion: "missing-commercial",
    }),
    undefined,
  );
});

test("unavailable recorded policy versions fail closed", () => {
  const result = policyUnavailableVerificationResult(validSnapshot(), {
    engineVersion: "unavailable-engine",
    technicalPolicyVersion: "unavailable-technical",
    commercialPolicyVersion: "unavailable-commercial",
  });
  assert.equal(result.decision, "manual_review");
  assert.equal(result.confidence, "LOW");
  assert.equal(result.findings[0].ruleId, "SYSTEM-001");
  assert.equal(result.findings[0].policyVersion, "unavailable-engine");
});

test("sealed claimed evaluation fails closed for unresolved recorded versions", () => {
  const completion = evaluateClaimedVerification({
    attemptId: "attempt-with-historical-policy",
    snapshot: immutableVerificationSnapshot(validSnapshot()),
    recordedVersions: {
      engineVersion: "unavailable-engine",
      technicalPolicyVersion: "unavailable-technical",
      commercialPolicyVersion: "unavailable-commercial",
    },
    policies: undefined,
    systemConditions: ["policy_configuration_unavailable"],
    evaluatedAt,
  });
  const payload = readVerificationEngineCompletion(completion);
  assert.equal(payload.result.decision, "manual_review");
  assert.equal(payload.result.confidence, "LOW");
  assert.equal(
    payload.result.findings[0].reasonCode,
    "POLICY_CONFIGURATION_UNAVAILABLE",
  );
});
