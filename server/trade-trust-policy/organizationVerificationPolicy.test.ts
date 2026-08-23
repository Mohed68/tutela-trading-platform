import assert from "node:assert/strict";
import test from "node:test";

import {
  createEvidenceCollectionRequest,
  createLocalPlatformEvidenceProvider,
  type ProviderEvidenceEnvelope,
} from "../evidence-provider/index.js";
import type { OrganizationVerificationPolicyEvaluationFactView } from "../organization-verification/domain/policy-runtime-contract/index.js";
import {
  createOrganizationId,
  createOrganizationProfileFingerprint,
  createOrganizationProfileRevisionId,
  createOrganizationProfileRevisionSequence,
  parseActorAuthorityReference,
} from "../organization-registry/index.js";
import * as core from "../organization-verification/domain/index.js";
import * as decision from "../organization-verification/domain/decision/index.js";
import * as trust from "../organization-verification/domain/trust-status/index.js";
import {
  adaptPlatformEvidenceToOrganizationVerificationReference,
} from "../organization-verification/application/production-evidence-adapter/platformEvidenceAdapter.js";
import { createMinimumTradeTrustOrganizationPolicyBundle } from "./organizationVerificationPolicy.js";

async function evidence(
  category: "organization_existence" | "representative_association",
  assertions: readonly { readonly assertionCode: string; readonly value: string }[],
): Promise<ProviderEvidenceEnvelope> {
  const request = createEvidenceCollectionRequest({
    requestId: `request-${category}`,
    providerKind: "platform_submitted",
    subject: {
      subjectKind: "organization",
      subjectId: "organization-1",
      subjectVersion: "profile-version-1",
    },
    requestedAt: "2026-08-23T10:00:00.000Z",
  });
  assert.ok(request);
  const provider = createLocalPlatformEvidenceProvider({
    async resolveSubmittedEvidence() {
      return {
        evidenceId: `evidence-${category}`,
        evidenceVersion: "evidence-version-1",
        subjectId: "organization-1",
        subjectVersion: "profile-version-1",
        assertions: [
          { assertionCode: "evidence_category", value: category },
          ...assertions,
        ],
        submittedAt: "2026-08-23T09:00:00.000Z",
        provenanceReference: `platform-upload:${category}`,
        integrityReference: `platform-upload-integrity:${category}`,
      };
    },
  });
  const result = await provider.collectEvidence(request);
  assert.equal(result.status, "evidence_available");
  if (result.status !== "evidence_available") throw new Error(result.status);
  return result.evidence;
}

async function factView(): Promise<OrganizationVerificationPolicyEvaluationFactView> {
  const existence = await evidence("organization_existence", [
    { assertionCode: "document_type", value: "business_registration" },
    { assertionCode: "legal_name", value: "Example Trading Ltd" },
    { assertionCode: "registration_jurisdiction", value: "AE" },
    { assertionCode: "registration_identifier", value: "trade_license:12345" },
  ]);
  const representative = await evidence("representative_association", [
    { assertionCode: "association_asserted", value: "true" },
    { assertionCode: "representative_reference", value: "member-1" },
  ]);
  const adapted = [existence, representative].map((item, index) =>
    adaptPlatformEvidenceToOrganizationVerificationReference({
      evidence: item,
      organizationId: "organization-1",
      organizationVersion: "profile-version-1",
      category:
        index === 0 ? "organization_existence" : "representative_association",
      revisionEvidenceReferenceId: `revision-evidence-${index + 1}`,
      correlationReference: "correlation-1",
    }),
  );
  assert.ok(adapted.every((item) => item.ok));
  const evidenceFacts = adapted.map((item) => {
    if (!item.ok) throw new Error(item.code);
    return Object.freeze({
      evidenceReferenceId: item.value.evidenceReferenceId,
      evidenceReferenceVersion: item.value.evidenceReferenceVersion,
      revisionEvidenceReferenceId: item.value.revisionEvidenceReferenceId,
      evidenceKind: item.value.evidenceKind,
      category: item.value.category,
      sourceAuthority: item.value.sourceAuthority,
      contentDigest: item.value.contentDigest,
      capturedAt: item.value.capturedAt as string,
      attributes: item.value.attributes ?? Object.freeze([]),
    });
  });
  return Object.freeze({
    registryFacts: Object.freeze({
      profileRevisionSequence: 1,
      profileFingerprint: "profile-fingerprint-1",
      legalIdentity: Object.freeze({
        legalName: "Example Trading Ltd",
        tradingNames: Object.freeze([]),
        registrationJurisdiction: "AE",
        registrationIdentifiers: Object.freeze([
          Object.freeze({ scheme: "trade_license", value: "12345" }),
        ]),
      }),
      organizationType: "company",
      jurisdiction: "AE",
      declaredActivities: Object.freeze([]),
    }),
    evidenceFacts: Object.freeze(evidenceFacts),
  });
}

test("real platform-submitted evidence satisfies the minimum Organization Verification policy", async () => {
  const bundle = createMinimumTradeTrustOrganizationPolicyBundle();
  const facts = await factView();
  assert.equal(bundle.rules.length, 5);
  assert.deepEqual(
    bundle.implementationSet.bindings.map((binding) =>
      binding.implementation.evaluate(facts),
    ),
    ["satisfied", "satisfied", "satisfied", "satisfied", "satisfied"],
  );
  assert.equal(bundle.policySet.status, "active");
});

test("incomplete evidence fails closed through revision or manual review", async () => {
  const bundle = createMinimumTradeTrustOrganizationPolicyBundle();
  const complete = await factView();
  const incomplete = Object.freeze({
    ...complete,
    evidenceFacts: Object.freeze([]),
  });
  const outcomes = bundle.implementationSet.bindings.map((binding) =>
    binding.implementation.evaluate(incomplete),
  );
  assert.ok(outcomes.includes("revision_required"));
  assert.ok(outcomes.includes("manual_review_required"));
  assert.ok(outcomes.includes("rejection_required"));
});

test("production policy contains no product, finance, ownership, transaction, or delivery rule", () => {
  const bundle = createMinimumTradeTrustOrganizationPolicyBundle();
  const serialized = JSON.stringify({ policy: bundle.policySet, rules: bundle.rules });
  for (const forbidden of [
    "product_existence",
    "financial_capability",
    "commodity_ownership",
    "transaction_legitimacy",
    "delivery_assurance",
  ]) {
    assert.equal(serialized.includes(forbidden), false);
  }
});

test("plain or wrong-subject evidence cannot enter Organization Verification", async () => {
  const authentic = await evidence("organization_existence", []);
  const fake = { ...authentic };
  assert.equal(
    adaptPlatformEvidenceToOrganizationVerificationReference({
      evidence: fake,
      organizationId: "organization-1",
      organizationVersion: "profile-version-1",
      category: "organization_existence",
      revisionEvidenceReferenceId: "revision-evidence-1",
      correlationReference: "correlation-1",
    }).ok,
    false,
  );
  assert.equal(
    adaptPlatformEvidenceToOrganizationVerificationReference({
      evidence: authentic,
      organizationId: "different-organization",
      organizationVersion: "profile-version-1",
      category: "organization_existence",
      revisionEvidenceReferenceId: "revision-evidence-1",
      correlationReference: "correlation-1",
    }).ok,
    false,
  );
});

function must<T>(result: { readonly ok: boolean; readonly value?: T; readonly code?: string }): T {
  assert.equal(result.ok, true, result.code);
  if (!result.ok || result.value === undefined) throw new Error(result.code);
  return result.value;
}

test("valid real evidence reaches trusted only through Decision and Trust authorities", async () => {
  const facts = await factView();
  const bundle = createMinimumTradeTrustOrganizationPolicyBundle();
  const approvalReady = bundle.implementationSet.bindings.every(
    (binding) => binding.implementation.evaluate(facts) === "satisfied",
  );
  assert.equal(approvalReady, true);

  const organizationId = must(createOrganizationId("organization-1"));
  const profileRevisionId = must(
    createOrganizationProfileRevisionId("profile-version-1"),
  );
  const profileRevisionSequence = must(
    createOrganizationProfileRevisionSequence(1),
  );
  const profileFingerprint = must(
    createOrganizationProfileFingerprint("profile-fingerprint-1"),
  );
  const authority = must(
    parseActorAuthorityReference({
      actor_id: "representative-1",
      authority_reference_id: "membership-authority-1",
      authority_version: "authority.v1",
      organization_scope: organizationId,
      issued_at: "2026-08-23T08:00:00.000Z",
      delegated_scopes: ["verification.submit"],
    }),
  );
  const record = must(
    core.createOrganizationVerificationRecord({
      recordId: must(
        core.createOrganizationVerificationRecordId("verification-record-1"),
      ),
      organizationId,
      createdAt: "2026-08-23T08:00:00.000Z",
    }),
  );
  const draft = must(
    core.createDraftForRecord(record, {
      draftId: must(core.createOrganizationVerificationDraftId("verification-draft-1")),
      organizationId,
      profileRevisionId,
      profileRevisionSequence,
      profileFingerprint,
      declaredInputs: {
        sections: [
          {
            key: "legal_identity",
            values: [{ key: "legal_name", value: "Example Trading Ltd" }],
          },
        ],
      },
      evidenceReferenceIds: [
        must(core.createOrganizationEvidenceReferenceId("evidence-organization_existence")),
      ],
      draftVersion: must(core.createDraftVersion(1)),
      at: "2026-08-23T08:10:00.000Z",
      actorAuthorityReference: authority,
    }),
  );
  const submitted = must(
    core.submitDraftToRevision(
      must(core.attachDraftToRecord(record, draft)),
      draft,
      {
        draftId: draft.draftId,
        expectedDraftVersion: draft.draftVersion,
        revisionId: must(
          core.createOrganizationVerificationRevisionId("verification-revision-1"),
        ),
        revisionSequence: must(core.createVerificationRevisionSequence(1)),
        profileRevisionId,
        profileRevisionSequence,
        profileFingerprint,
        submissionActorAuthorityReference: authority,
        submittedAt: "2026-08-23T08:20:00.000Z",
        submissionIdempotencyKey: must(
          core.createSubmissionIdempotencyKey("verification-submission-1"),
        ),
        correlationId: must(core.createCorrelationId("verification-correlation-1")),
      },
    ),
  );
  const snapshotId = must(core.createSnapshotId("evidence-snapshot-1"));
  const snapshotFingerprint = must(
    core.createSnapshotFingerprint("evidence-snapshot-fingerprint-1"),
  );
  const created = must(
    core.createAttemptForRevision(submitted.record, submitted.revision, {
      attemptId: must(core.createOrganizationVerificationAttemptId("attempt-1")),
      sequence: must(core.createVerificationAttemptSequence(1)),
      snapshotId,
      snapshotFingerprint,
      createdAt: "2026-08-23T08:30:00.000Z",
      correlationId: must(core.createCorrelationId("attempt-correlation-1")),
    }),
  );
  const queued = must(
    core.transitionAttemptProcess(created.attempt, {
      nextState: "queued",
      at: "2026-08-23T08:31:00.000Z",
    }),
  );
  const running = must(
    core.transitionAttemptProcess(queued, {
      nextState: "running",
      at: "2026-08-23T08:32:00.000Z",
    }),
  );
  const completed = must(
    core.transitionAttemptProcess(running, {
      nextState: "completed",
      at: "2026-08-23T08:33:00.000Z",
      completionReference: must(core.createCompletionReference("evaluation-completion-1")),
    }),
  );
  const completionId = must(
    decision.createEvaluationCompletionId("evaluation-completion-1"),
  );
  const sealed = must(
    decision.sealNormalizedEvaluationCompletion({
      recordId: created.record.recordId,
      revisionId: submitted.revision.revisionId,
      attemptId: completed.attemptId,
      organizationId,
      snapshotId,
      snapshotFingerprint,
      evaluationCompletionId: completionId,
      policySetReference: must(
        decision.createPolicySetReference(bundle.policySet.policySetId),
      ),
      policySetVersion: must(
        decision.createPolicySetVersion(bundle.policySet.policySetVersion),
      ),
      completedAt: completed.completedAt!,
      evaluationComplete: true,
      evaluationIntegrityValid: true,
      approvalReady,
      revisionRequired: false,
      manualReviewRequired: false,
      rejectionRequired: false,
      categorySummaries: ["minimum_trade_trust_policy_satisfied"],
      correlationId: must(core.createCorrelationId("evaluation-correlation-1")),
    }),
  );
  const approved = must(
    decision.decideOrganizationVerification(sealed, {
      decisionId: must(decision.createOrganizationVerificationDecisionId("decision-1")),
      decisionEngineVersion: must(
        decision.createDecisionEngineVersion("decision-engine.v1"),
      ),
      decidedAt: "2026-08-23T08:34:00.000Z",
      integrityReference: must(
        decision.createDecisionIntegrityReference("decision-integrity-1"),
      ),
      record: created.record,
      revision: submitted.revision,
      attempt: completed,
    }),
  );
  assert.equal(approved.outcome, "approved");
  const applicability = must(
    trust.createDecisionApplicability({
      applicabilityId: must(trust.createDecisionApplicabilityId("applicability-1")),
      version: trust.DECISION_APPLICABILITY_VERSION,
      decisionId: approved.decisionId,
      effectiveAt: "2026-08-23T08:35:00.000Z",
      provenanceReference: must(
        trust.createTrustStatusProvenanceReference("applicability-source-1"),
      ),
      correlationId: must(core.createCorrelationId("applicability-correlation-1")),
      integrityReference: must(
        trust.createTrustStatusIntegrityReference("applicability-integrity-1"),
      ),
      applicable: true,
      superseded: false,
      expired: false,
      invalidated: false,
    }),
  );
  const sourceFacts = must(
    trust.createOrganizationVerificationTrustStatusSourceFacts({
      sourceFactsVersion: trust.TRUST_STATUS_SOURCE_FACTS_VERSION,
      sourceFactsComplete: true,
      sourceFactsIntegrityValid: true,
      organizationId,
      recordId: approved.recordId,
      currentVerificationRevisionId: approved.revisionId,
      authoritativeDecisionId: approved.decisionId,
      authoritativeAttemptId: approved.attemptId,
      authoritativeSnapshotId: approved.snapshotId,
      authoritativeSnapshotFingerprint: approved.snapshotFingerprint,
      decision: approved,
      decisionApplicability: applicability,
      derivationAsOf: "2026-08-23T08:36:00.000Z",
      provenanceReference: must(
        trust.createTrustStatusProvenanceReference("trust-source-facts-1"),
      ),
      correlationId: must(core.createCorrelationId("trust-correlation-1")),
      integrityReference: must(
        trust.createTrustStatusIntegrityReference("trust-source-integrity-1"),
      ),
    }),
  );
  const trusted = must(
    trust.deriveOrganizationVerificationTrustStatus(sourceFacts, {
      projectionId: must(trust.createTrustStatusProjectionId("trust-projection-1")),
      deriverVersion: trust.TRUST_STATUS_DERIVER_VERSION,
      derivedAt: "2026-08-23T08:36:00.000Z",
      integrityReference: must(
        trust.createTrustStatusIntegrityReference("trust-projection-integrity-1"),
      ),
    }),
  );
  assert.equal(trusted.status, "trusted");
});
