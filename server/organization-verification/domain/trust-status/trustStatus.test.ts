import assert from "node:assert/strict";
import test from "node:test";
import {
  createOrganizationId,
  createOrganizationProfileFingerprint,
  createOrganizationProfileRevisionId,
  createOrganizationProfileRevisionSequence,
  parseActorAuthorityReference,
} from "../../../organization-registry/index.js";
import {
  attachDraftToRecord,
  createAttemptForRevision,
  createCompletionReference,
  createCorrelationId,
  createDraftForRecord,
  createDraftVersion,
  createOrganizationEvidenceReferenceId,
  createOrganizationVerificationAttemptId,
  createOrganizationVerificationDraftId,
  createOrganizationVerificationRecord,
  createOrganizationVerificationRecordId,
  createOrganizationVerificationRevisionId,
  createSnapshotFingerprint,
  createSnapshotId,
  createSubmissionIdempotencyKey,
  createVerificationAttemptSequence,
  createVerificationRevisionSequence,
  submitDraftToRevision,
  transitionAttemptProcess,
  type CoreDomainResult,
} from "../index.js";
import {
  createDecisionEngineVersion,
  createDecisionIntegrityReference,
  createEvaluationCompletionId,
  createOrganizationVerificationDecisionId,
  createPolicySetReference,
  createPolicySetVersion,
  decideOrganizationVerification,
  sealNormalizedEvaluationCompletion,
  type DecisionDomainResult,
  type NormalizedEvaluationClassification,
  type OrganizationVerificationDecision,
  type OrganizationVerificationDecisionOutcome,
} from "../decision/index.js";
import {
  createDecisionApplicability,
  createDecisionApplicabilityId,
  createExpiryFactId,
  createInvalidationFactId,
  createOrganizationVerificationExpiryFact,
  createOrganizationVerificationInvalidationFact,
  createOrganizationVerificationTrustStatusSourceFacts,
  createTrustStatusIntegrityReference,
  createTrustStatusProjectionId,
  createTrustStatusProvenanceReference,
  createTrustStatusSourceAuthorityReference,
  deriveOrganizationVerificationTrustStatus,
  DECISION_APPLICABILITY_VERSION,
  ORGANIZATION_VERIFICATION_TRUST_STATUS_VALUES,
  TRUST_STATUS_DERIVER_VERSION,
  TRUST_STATUS_SOURCE_FACTS_VERSION,
  type DecisionApplicabilityState,
  type OrganizationVerificationDecisionApplicability,
  type OrganizationVerificationExpiryFact,
  type OrganizationVerificationInvalidationFact,
  type OrganizationVerificationTrustStatus,
  type OrganizationVerificationTrustStatusValue,
  type OrganizationVerificationTrustStatusSourceFactsInput,
  type TrustStatusDomainResult,
} from "./index.js";

type IsAssignable<From, To> = From extends To ? true : false;
type AssertFalse<Value extends false> = Value;
type ApplicabilityCannotBecomeTrustStatus = AssertFalse<
  IsAssignable<
    DecisionApplicabilityState,
    OrganizationVerificationTrustStatusValue
  >
>;
type TrustStatusCannotBecomeApplicability = AssertFalse<
  IsAssignable<
    OrganizationVerificationTrustStatusValue,
    DecisionApplicabilityState
  >
>;

function coreValue<T>(result: CoreDomainResult<T>): T {
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error(result.code);
  return result.value;
}

function decisionValue<T>(result: DecisionDomainResult<T>): T {
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error(result.code);
  return result.value;
}

function trustValue<T>(result: TrustStatusDomainResult<T>): T {
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error(result.code);
  return result.value;
}

function registryValue<T>(
  result: { readonly ok: true; readonly value: T } | {
    readonly ok: false;
    readonly code: string;
  },
): T {
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error(result.code);
  return result.value;
}

const CLASSIFICATION_BY_OUTCOME = {
  approved: "approval_ready",
  revision_required: "revision_required",
  manual_review: "manual_review_required",
  rejected: "rejection_required",
} satisfies Record<
  OrganizationVerificationDecisionOutcome,
  NormalizedEvaluationClassification
>;

function createDecisionFixture(
  firstOutcome: OrganizationVerificationDecisionOutcome = "approved",
) {
  const organizationId = registryValue(
    createOrganizationId("org-trust-status-test"),
  );
  const profileRevisionId = registryValue(
    createOrganizationProfileRevisionId("profile-trust-status-1"),
  );
  const profileRevisionSequence = registryValue(
    createOrganizationProfileRevisionSequence(1),
  );
  const profileFingerprint = registryValue(
    createOrganizationProfileFingerprint("profile-fingerprint-trust-status-1"),
  );
  const authority = registryValue(
    parseActorAuthorityReference({
      actor_id: "actor-trust-status-test",
      authority_reference_id: "authority-trust-status-test",
      authority_version: "authority.v1",
      organization_scope: organizationId,
      issued_at: "2026-08-01T00:00:00.000Z",
      delegated_scopes: ["verification.submit"],
    }),
  );
  const initialRecord = coreValue(
    createOrganizationVerificationRecord({
      recordId: coreValue(
        createOrganizationVerificationRecordId("record-trust-status-1"),
      ),
      organizationId,
      createdAt: "2026-08-01T00:00:00.000Z",
    }),
  );
  const draft = coreValue(
    createDraftForRecord(initialRecord, {
      draftId: coreValue(
        createOrganizationVerificationDraftId("draft-trust-status-1"),
      ),
      organizationId,
      profileRevisionId,
      profileRevisionSequence,
      profileFingerprint,
      declaredInputs: {
        sections: [
          { key: "synthetic", values: [{ key: "value", value: "test" }] },
        ],
      },
      evidenceReferenceIds: [
        coreValue(
          createOrganizationEvidenceReferenceId("evidence-trust-status-1"),
        ),
      ],
      draftVersion: coreValue(createDraftVersion(1)),
      at: "2026-08-01T00:01:00.000Z",
      actorAuthorityReference: authority,
    }),
  );
  const submitted = coreValue(
    submitDraftToRevision(
      coreValue(attachDraftToRecord(initialRecord, draft)),
      draft,
      {
        draftId: draft.draftId,
        expectedDraftVersion: draft.draftVersion,
        revisionId: coreValue(
          createOrganizationVerificationRevisionId("revision-trust-status-1"),
        ),
        revisionSequence: coreValue(createVerificationRevisionSequence(1)),
        profileRevisionId,
        profileRevisionSequence,
        profileFingerprint,
        submissionActorAuthorityReference: authority,
        submittedAt: "2026-08-01T00:02:00.000Z",
        submissionIdempotencyKey: coreValue(
          createSubmissionIdempotencyKey("submission-trust-status-1"),
        ),
        correlationId: coreValue(
          createCorrelationId("submission-correlation-trust-status-1"),
        ),
      },
    ),
  );

  function issueDecision(
    record: typeof submitted.record,
    sequence: number,
    outcome: OrganizationVerificationDecisionOutcome,
    supersedesDecisionId?: OrganizationVerificationDecision["decisionId"],
  ) {
    const suffix = String(sequence);
    const completionId = decisionValue(
      createEvaluationCompletionId(`evaluation-completion-trust-${suffix}`),
    );
    const snapshotId = coreValue(
      createSnapshotId(`snapshot-trust-${suffix}`),
    );
    const snapshotFingerprint = coreValue(
      createSnapshotFingerprint(`snapshot-fingerprint-trust-${suffix}`),
    );
    const created = coreValue(
      createAttemptForRevision(record, submitted.revision, {
        attemptId: coreValue(
          createOrganizationVerificationAttemptId(`attempt-trust-${suffix}`),
        ),
        sequence: coreValue(createVerificationAttemptSequence(sequence)),
        snapshotId,
        snapshotFingerprint,
        createdAt: `2026-08-01T00:0${sequence + 2}:00.000Z`,
        correlationId: coreValue(
          createCorrelationId(`attempt-correlation-trust-${suffix}`),
        ),
      }),
    );
    const queued = coreValue(
      transitionAttemptProcess(created.attempt, {
        nextState: "queued",
        at: `2026-08-01T00:1${sequence}:00.000Z`,
      }),
    );
    const running = coreValue(
      transitionAttemptProcess(queued, {
        nextState: "running",
        at: `2026-08-01T00:2${sequence}:00.000Z`,
      }),
    );
    const completed = coreValue(
      transitionAttemptProcess(running, {
        nextState: "completed",
        at: `2026-08-01T00:3${sequence}:00.000Z`,
        completionReference: coreValue(
          createCompletionReference(String(completionId)),
        ),
      }),
    );
    const classification = CLASSIFICATION_BY_OUTCOME[outcome];
    const sealed = decisionValue(
      sealNormalizedEvaluationCompletion({
        recordId: created.record.recordId,
        revisionId: submitted.revision.revisionId,
        attemptId: completed.attemptId,
        organizationId,
        snapshotId,
        snapshotFingerprint,
        evaluationCompletionId: completionId,
        policySetReference: decisionValue(
          createPolicySetReference("policy-set-reference-trust"),
        ),
        policySetVersion: decisionValue(
          createPolicySetVersion("policy-set-version-trust"),
        ),
        completedAt: completed.completedAt!,
        evaluationComplete: true,
        evaluationIntegrityValid: true,
        approvalReady: classification === "approval_ready",
        revisionRequired: classification === "revision_required",
        manualReviewRequired: classification === "manual_review_required",
        rejectionRequired: classification === "rejection_required",
        categorySummaries: ["synthetic_summary"],
        correlationId: coreValue(
          createCorrelationId(`evaluation-correlation-trust-${suffix}`),
        ),
      }),
    );
    const decision = decisionValue(
      decideOrganizationVerification(sealed, {
        decisionId: decisionValue(
          createOrganizationVerificationDecisionId(
            `decision-trust-${suffix}`,
          ),
        ),
        decisionEngineVersion: decisionValue(
          createDecisionEngineVersion("decision-engine.v1"),
        ),
        decidedAt: `2026-08-01T00:4${sequence}:00.000Z`,
        integrityReference: decisionValue(
          createDecisionIntegrityReference(
            `decision-integrity-trust-${suffix}`,
          ),
        ),
        record: created.record,
        revision: submitted.revision,
        attempt: completed,
        ...(supersedesDecisionId ? { supersedesDecisionId } : {}),
      }),
    );
    return { decision, record: created.record };
  }

  const first = issueDecision(submitted.record, 1, firstOutcome);
  return {
    organizationId,
    revision: submitted.revision,
    first,
    issueDecision,
  };
}

function applicability(
  decision: OrganizationVerificationDecision,
  state:
    | "applicable"
    | "superseded"
    | "expired"
    | "invalidated" = "applicable",
  suffix = "1",
  supersedingDecisionId?: OrganizationVerificationDecision["decisionId"],
): OrganizationVerificationDecisionApplicability {
  return trustValue(
    createDecisionApplicability({
      applicabilityId: trustValue(
        createDecisionApplicabilityId(`applicability-${suffix}`),
      ),
      version: DECISION_APPLICABILITY_VERSION,
      decisionId: decision.decisionId,
      effectiveAt: "2026-08-01T00:50:00.000Z",
      provenanceReference: trustValue(
        createTrustStatusProvenanceReference(`applicability-source-${suffix}`),
      ),
      correlationId: coreValue(
        createCorrelationId(`applicability-correlation-${suffix}`),
      ),
      integrityReference: trustValue(
        createTrustStatusIntegrityReference(
          `applicability-integrity-${suffix}`,
        ),
      ),
      applicable: state === "applicable",
      superseded: state === "superseded",
      expired: state === "expired",
      invalidated: state === "invalidated",
      ...(supersedingDecisionId ? { supersedingDecisionId } : {}),
    }),
  );
}

function expiry(
  decision: OrganizationVerificationDecision,
  validUntil = "2026-08-02T00:00:00.000Z",
  suffix = "1",
): OrganizationVerificationExpiryFact {
  return trustValue(
    createOrganizationVerificationExpiryFact({
      expiryFactId: trustValue(createExpiryFactId(`expiry-${suffix}`)),
      decisionId: decision.decisionId,
      validUntil,
      recordedAt: "2026-08-01T00:51:00.000Z",
      provenanceReference: trustValue(
        createTrustStatusProvenanceReference(`expiry-source-${suffix}`),
      ),
      correlationId: coreValue(
        createCorrelationId(`expiry-correlation-${suffix}`),
      ),
      integrityReference: trustValue(
        createTrustStatusIntegrityReference(`expiry-integrity-${suffix}`),
      ),
    }),
  );
}

function invalidation(
  decision: OrganizationVerificationDecision,
  suffix = "1",
): OrganizationVerificationInvalidationFact {
  return trustValue(
    createOrganizationVerificationInvalidationFact({
      invalidationFactId: trustValue(
        createInvalidationFactId(`invalidation-${suffix}`),
      ),
      organizationId: decision.organizationId,
      decisionId: decision.decisionId,
      recordId: decision.recordId,
      invalidatedAt: "2026-08-02T01:00:00.000Z",
      provenanceReference: trustValue(
        createTrustStatusProvenanceReference(`invalidation-source-${suffix}`),
      ),
      sourceAuthorityReference: trustValue(
        createTrustStatusSourceAuthorityReference(
          `invalidation-authority-${suffix}`,
        ),
      ),
      correlationId: coreValue(
        createCorrelationId(`invalidation-correlation-${suffix}`),
      ),
      integrityReference: trustValue(
        createTrustStatusIntegrityReference(
          `invalidation-integrity-${suffix}`,
        ),
      ),
    }),
  );
}

function sourceInput(
  decision?: OrganizationVerificationDecision,
  override: Partial<OrganizationVerificationTrustStatusSourceFactsInput> = {},
): OrganizationVerificationTrustStatusSourceFactsInput {
  const noDecisionIds = {
    organizationId: registryValue(createOrganizationId("org-no-decision")),
    recordId: coreValue(
      createOrganizationVerificationRecordId("record-no-decision"),
    ),
  };
  return {
    sourceFactsVersion: TRUST_STATUS_SOURCE_FACTS_VERSION,
    sourceFactsComplete: true,
    sourceFactsIntegrityValid: true,
    organizationId: decision?.organizationId ?? noDecisionIds.organizationId,
    recordId: decision?.recordId ?? noDecisionIds.recordId,
    ...(decision
      ? {
          currentVerificationRevisionId: decision.revisionId,
          authoritativeDecisionId: decision.decisionId,
          authoritativeAttemptId: decision.attemptId,
          authoritativeSnapshotId: decision.snapshotId,
          authoritativeSnapshotFingerprint: decision.snapshotFingerprint,
          decision,
          decisionApplicability: applicability(decision),
        }
      : {}),
    derivationAsOf: "2026-08-02T02:00:00.000Z",
    provenanceReference: trustValue(
      createTrustStatusProvenanceReference("trust-source-facts"),
    ),
    correlationId: coreValue(
      createCorrelationId("trust-source-facts-correlation"),
    ),
    integrityReference: trustValue(
      createTrustStatusIntegrityReference("trust-source-facts-integrity"),
    ),
    ...override,
  };
}

function derive(
  input: OrganizationVerificationTrustStatusSourceFactsInput,
  suffix = "1",
  existingProjection?: OrganizationVerificationTrustStatus,
) {
  const sourceFacts = trustValue(
    createOrganizationVerificationTrustStatusSourceFacts(input),
  );
  return deriveOrganizationVerificationTrustStatus(sourceFacts, {
    projectionId: trustValue(
      createTrustStatusProjectionId(`trust-projection-${suffix}`),
    ),
    deriverVersion: TRUST_STATUS_DERIVER_VERSION,
    derivedAt: input.derivationAsOf,
    integrityReference: trustValue(
      createTrustStatusIntegrityReference(`projection-integrity-${suffix}`),
    ),
    ...(existingProjection ? { existingProjection } : {}),
  });
}

test("exact Decision mapping and five-value Trust Status vocabulary", () => {
  const expected = {
    approved: "trusted",
    revision_required: "not_trusted",
    manual_review: "unestablished",
    rejected: "not_trusted",
  } as const;
  for (const [outcome, status] of Object.entries(expected)) {
    const fixture = createDecisionFixture(
      outcome as OrganizationVerificationDecisionOutcome,
    );
    const projection = trustValue(derive(sourceInput(fixture.first.decision)));
    assert.equal(projection.status, status);
  }
  assert.deepEqual(ORGANIZATION_VERIFICATION_TRUST_STATUS_VALUES, [
    "unestablished",
    "trusted",
    "not_trusted",
    "expired",
    "invalidated",
  ]);
});

test("no authoritative Decision produces unestablished", () => {
  const projection = trustValue(derive(sourceInput()));
  assert.equal(projection.status, "unestablished");
  assert.equal(projection.sourceDecisionId, undefined);
});

test("explicit expiry produces expired for every historical outcome", () => {
  for (const outcome of [
    "approved",
    "revision_required",
    "manual_review",
    "rejected",
  ] as const) {
    const decision = createDecisionFixture(outcome).first.decision;
    const projection = trustValue(
      derive(
        sourceInput(decision, {
          expiryFact: expiry(
            decision,
            "2026-08-02T00:00:00.000Z",
            outcome,
          ),
        }),
        outcome,
      ),
    );
    assert.equal(projection.status, "expired");
  }
});

test("explicit invalidation overrides outcome and expiry", () => {
  for (const outcome of ["approved", "rejected"] as const) {
    const decision = createDecisionFixture(outcome).first.decision;
    const projection = trustValue(
      derive(
        sourceInput(decision, {
          expiryFact: expiry(decision),
          invalidationFact: invalidation(decision, outcome),
        }),
        outcome,
      ),
    );
    assert.equal(projection.status, "invalidated");
    assert.ok(projection.invalidationFactId);
  }
});

test("superseded Decision is ignored and newer authoritative Decision is used", () => {
  const fixture = createDecisionFixture("approved");
  const second = fixture.issueDecision(
    fixture.first.record,
    2,
    "rejected",
    fixture.first.decision.decisionId,
  );
  const projection = trustValue(
    derive(
      sourceInput(fixture.first.decision, {
        currentVerificationRevisionId: second.decision.revisionId,
        authoritativeDecisionId: second.decision.decisionId,
        authoritativeAttemptId: second.decision.attemptId,
        authoritativeSnapshotId: second.decision.snapshotId,
        authoritativeSnapshotFingerprint:
          second.decision.snapshotFingerprint,
        decisionApplicability: applicability(
          fixture.first.decision,
          "superseded",
          "old",
          second.decision.decisionId,
        ),
        supersedingDecision: second.decision,
        supersedingDecisionApplicability: applicability(
          second.decision,
          "applicable",
          "new",
        ),
      }),
    ),
  );
  assert.equal(projection.status, "not_trusted");
  assert.equal(projection.sourceDecisionId, second.decision.decisionId);
  assert.equal(
    projection.supersededDecisionId,
    fixture.first.decision.decisionId,
  );
});

test("missing or mismatched superseding Decision fails closed", () => {
  const fixture = createDecisionFixture();
  const missing = createOrganizationVerificationTrustStatusSourceFacts(
    sourceInput(fixture.first.decision, {
      decisionApplicability: applicability(
        fixture.first.decision,
        "superseded",
        "missing",
        decisionValue(createOrganizationVerificationDecisionId("missing")),
      ),
    }),
  );
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(missing.code, "superseding_decision_missing");

  const second = fixture.issueDecision(
    fixture.first.record,
    2,
    "rejected",
    fixture.first.decision.decisionId,
  ).decision;
  const declaredOtherDecisionId = decisionValue(
    createOrganizationVerificationDecisionId("declared-other-decision"),
  );
  const mismatch = createOrganizationVerificationTrustStatusSourceFacts(
    sourceInput(fixture.first.decision, {
      decisionApplicability: applicability(
        fixture.first.decision,
        "superseded",
        "mismatch",
        declaredOtherDecisionId,
      ),
      supersedingDecision: second,
      supersedingDecisionApplicability: applicability(
        second,
        "applicable",
        "unrelated",
      ),
    }),
  );
  assert.equal(mismatch.ok, false);
  if (!mismatch.ok) {
    assert.equal(mismatch.code, "superseding_decision_mismatch");
  }
});

test("invalid and contradictory applicability fail closed", () => {
  const decision = createDecisionFixture().first.decision;
  const base = {
    applicabilityId: trustValue(
      createDecisionApplicabilityId("applicability-invalid"),
    ),
    version: DECISION_APPLICABILITY_VERSION,
    decisionId: decision.decisionId,
    effectiveAt: "2026-08-01T00:50:00.000Z",
    provenanceReference: trustValue(
      createTrustStatusProvenanceReference("applicability-source-invalid"),
    ),
    correlationId: coreValue(createCorrelationId("applicability-invalid")),
    integrityReference: trustValue(
      createTrustStatusIntegrityReference("applicability-integrity-invalid"),
    ),
    applicable: false,
    superseded: false,
    expired: false,
    invalidated: false,
  };
  const missing = createDecisionApplicability(base);
  assert.equal(missing.ok, false);
  const contradictory = createDecisionApplicability({
    ...base,
    applicable: true,
    expired: true,
  });
  assert.equal(contradictory.ok, false);
  if (!contradictory.ok) {
    assert.equal(contradictory.code, "contradictory_decision_applicability");
  }
  const unsupportedVersion = createDecisionApplicability({
    ...base,
    version: "latest" as never,
    applicable: true,
  });
  assert.equal(unsupportedVersion.ok, false);
  if (!unsupportedVersion.ok) {
    assert.equal(unsupportedVersion.code, "invalid_decision_applicability");
  }
});

test("incomplete, integrity-invalid, and unknown versions produce no status", () => {
  const decision = createDecisionFixture().first.decision;
  for (const override of [
    { sourceFactsComplete: false },
    { sourceFactsIntegrityValid: false },
    { sourceFactsVersion: "latest" },
    { sourceFactsVersion: "organization-verification-trust-source-facts/v2" },
  ]) {
    const result = createOrganizationVerificationTrustStatusSourceFacts(
      sourceInput(decision, override as never),
    );
    assert.equal(result.ok, false);
  }
  const sourceFacts = trustValue(
    createOrganizationVerificationTrustStatusSourceFacts(sourceInput(decision)),
  );
  const result = deriveOrganizationVerificationTrustStatus(sourceFacts, {
    projectionId: trustValue(createTrustStatusProjectionId("projection-v")),
    deriverVersion: "latest" as never,
    derivedAt: "2026-08-02T02:00:00.000Z",
    integrityReference: trustValue(
      createTrustStatusIntegrityReference("projection-integrity-v"),
    ),
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "unsupported_trust_deriver_version");
  }
});

test("every independent source identity mismatch is rejected", () => {
  const fixture = createDecisionFixture();
  const decision = fixture.first.decision;
  const otherDecision = fixture.issueDecision(
    fixture.first.record,
    2,
    "approved",
    fixture.first.decision.decisionId,
  ).decision;
  const otherOrganizationId = registryValue(createOrganizationId("org-other"));
  const cases: Array<[Record<string, unknown>, string]> = [
    [{ organizationId: otherOrganizationId }, "organization_id_mismatch"],
    [
      {
        recordId: coreValue(
          createOrganizationVerificationRecordId("record-other"),
        ),
      },
      "verification_record_id_mismatch",
    ],
    [
      {
        currentVerificationRevisionId: coreValue(
          createOrganizationVerificationRevisionId("revision-other"),
        ),
      },
      "verification_revision_id_mismatch",
    ],
    [
      {
        authoritativeDecisionId: decisionValue(
          createOrganizationVerificationDecisionId("decision-other"),
        ),
      },
      "decision_id_mismatch",
    ],
    [
      {
        authoritativeAttemptId: coreValue(
          createOrganizationVerificationAttemptId("attempt-other"),
        ),
      },
      "attempt_id_mismatch",
    ],
    [
      {
        authoritativeSnapshotId: coreValue(createSnapshotId("snapshot-other")),
      },
      "snapshot_id_mismatch",
    ],
    [
      {
        authoritativeSnapshotFingerprint: coreValue(
          createSnapshotFingerprint("snapshot-fingerprint-other"),
        ),
      },
      "snapshot_fingerprint_mismatch",
    ],
    [
      {
        decisionApplicability: applicability(
          otherDecision,
          "applicable",
          "wrong-reference",
        ),
      },
      "decision_id_mismatch",
    ],
  ];
  for (const [override, expected] of cases) {
    const result = createOrganizationVerificationTrustStatusSourceFacts(
      sourceInput(decision, override),
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, expected);
  }
});

test("expiry and invalidation facts require exact references and boundaries", () => {
  const fixture = createDecisionFixture();
  const decision = fixture.first.decision;
  const missingExpiry = createOrganizationVerificationTrustStatusSourceFacts(
    sourceInput(decision, {
      decisionApplicability: applicability(decision, "expired"),
    }),
  );
  assert.equal(missingExpiry.ok, false);
  if (!missingExpiry.ok) {
    assert.equal(missingExpiry.code, "missing_expiry_boundary");
  }

  const otherDecision = fixture.issueDecision(
    fixture.first.record,
    2,
    "approved",
    fixture.first.decision.decisionId,
  ).decision;
  const wrongExpiry = createOrganizationVerificationTrustStatusSourceFacts(
    sourceInput(decision, { expiryFact: expiry(otherDecision) }),
  );
  assert.equal(wrongExpiry.ok, false);
  if (!wrongExpiry.ok) assert.equal(wrongExpiry.code, "decision_id_mismatch");

  const wrongInvalidation =
    createOrganizationVerificationTrustStatusSourceFacts(
      sourceInput(decision, {
        invalidationFact: invalidation(otherDecision),
      }),
    );
  assert.equal(wrongInvalidation.ok, false);
  if (!wrongInvalidation.ok) {
    assert.equal(wrongInvalidation.code, "invalidation_reference_mismatch");
  }
});

test("source facts, facts, applicability, and status are immutable", () => {
  const decision = createDecisionFixture().first.decision;
  const app = applicability(decision);
  const expiryFact = expiry(decision, "2026-08-03T00:00:00.000Z");
  const invalidationFact = invalidation(decision);
  assert.ok(Object.isFrozen(app));
  assert.ok(Object.isFrozen(expiryFact));
  assert.ok(Object.isFrozen(invalidationFact));

  const input = sourceInput(decision, {
    decisionApplicability: app,
    expiryFact,
  });
  const facts = trustValue(
    createOrganizationVerificationTrustStatusSourceFacts(input),
  );
  const projection = trustValue(derive(input));
  assert.ok(Object.isFrozen(facts));
  assert.ok(Object.isFrozen(facts.authoritativeDecision));
  assert.notEqual(facts.authoritativeDecision, decision);
  assert.ok(Object.isFrozen(projection));
  assert.throws(() => {
    (projection as { status: string }).status = "invalidated";
  }, TypeError);
  assert.equal(projection.status, "trusted");
  assert.equal(decision.outcome, "approved");
});

test("identical derivation is idempotent and conflicting identity is rejected", () => {
  const decision = createDecisionFixture().first.decision;
  const input = sourceInput(decision);
  const first = trustValue(derive(input));
  const retry = trustValue(derive(input, "1", first));
  assert.equal(retry, first);

  const sourceFacts = trustValue(
    createOrganizationVerificationTrustStatusSourceFacts(input),
  );
  const conflict = deriveOrganizationVerificationTrustStatus(sourceFacts, {
    projectionId: first.projectionId,
    deriverVersion: TRUST_STATUS_DERIVER_VERSION,
    derivedAt: "2026-08-02T03:00:00.000Z",
    integrityReference: first.integrityReference,
    existingProjection: first,
  });
  assert.equal(conflict.ok, false);
  if (!conflict.ok) {
    assert.equal(conflict.code, "conflicting_trust_status_projection");
  }

  const duplicate = deriveOrganizationVerificationTrustStatus(sourceFacts, {
    projectionId: trustValue(
      createTrustStatusProjectionId("trust-projection-different"),
    ),
    deriverVersion: TRUST_STATUS_DERIVER_VERSION,
    derivedAt: input.derivationAsOf,
    integrityReference: first.integrityReference,
    existingProjection: first,
  });
  assert.equal(duplicate.ok, false);
  if (!duplicate.ok) {
    assert.equal(duplicate.code, "duplicate_trust_status_projection");
  }
});

test("later as-of re-derivation may expire without changing prior projection", () => {
  const decision = createDecisionFixture().first.decision;
  const futureExpiry = expiry(decision, "2026-08-03T00:00:00.000Z");
  const before = trustValue(
    derive(
      sourceInput(decision, {
        derivationAsOf: "2026-08-02T00:00:00.000Z",
        expiryFact: futureExpiry,
      }),
      "before",
    ),
  );
  const after = trustValue(
    derive(
      sourceInput(decision, {
        derivationAsOf: "2026-08-04T00:00:00.000Z",
        expiryFact: futureExpiry,
      }),
      "after",
      before,
    ),
  );
  assert.equal(before.status, "trusted");
  assert.equal(after.status, "expired");
  assert.equal(before.status, "trusted");
  assert.notEqual(before.projectionId, after.projectionId);
});

test("legacy, reviewer, Registry lifecycle, Offer, and eligibility data have no authority", () => {
  for (const raw of [
    { verified: true },
    { companyName: "Legacy" },
    { userId: "legacy-user", role: "admin" },
    { seller: true, ownsOffer: true },
    { documentPresent: true },
    { uiStatus: "trusted" },
    { lifecycle: "active" },
    { lifecycle: "suspended" },
    { trusted: true },
    { reviewerSelectedStatus: "trusted" },
    { decisionOutcome: "approved" },
    { offerVerification: "verified" },
    { participationEligibility: "allowed" },
  ]) {
    const result = deriveOrganizationVerificationTrustStatus(raw as never, {
      projectionId: trustValue(
        createTrustStatusProjectionId("legacy-projection"),
      ),
      deriverVersion: TRUST_STATUS_DERIVER_VERSION,
      derivedAt: "2026-08-02T00:00:00.000Z",
      integrityReference: trustValue(
        createTrustStatusIntegrityReference("legacy-integrity"),
      ),
    });
    assert.equal(result.ok, false);
  }
});
