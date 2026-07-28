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
  ORGANIZATION_VERIFICATION_DECISION_OUTCOMES,
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
  type RawNormalizedOrganizationVerificationEvaluation,
} from "./index.js";

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

function completedContext() {
  const organizationId = (() => {
    const result = createOrganizationId("org-decision-test");
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.code);
    return result.value;
  })();
  const profileRevisionId = (() => {
    const result = createOrganizationProfileRevisionId("profile-decision-1");
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.code);
    return result.value;
  })();
  const profileSequence = (() => {
    const result = createOrganizationProfileRevisionSequence(1);
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.code);
    return result.value;
  })();
  const fingerprint = (() => {
    const result = createOrganizationProfileFingerprint("registry-fp-1");
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.code);
    return result.value;
  })();
  const authorityResult = parseActorAuthorityReference({
    actor_id: "actor-decision-test",
    authority_reference_id: "authority-decision-test",
    authority_version: "authority.v1",
    organization_scope: organizationId,
    issued_at: "2026-07-28T00:00:00.000Z",
    delegated_scopes: ["verification.submit"],
  });
  assert.equal(authorityResult.ok, true);
  if (!authorityResult.ok) throw new Error(authorityResult.code);

  const record = coreValue(
    createOrganizationVerificationRecord({
      recordId: coreValue(
        createOrganizationVerificationRecordId("record-decision-1"),
      ),
      organizationId,
      createdAt: "2026-07-28T00:00:00.000Z",
    }),
  );
  const draft = coreValue(
    createDraftForRecord(record, {
      draftId: coreValue(
        createOrganizationVerificationDraftId("draft-decision-1"),
      ),
      organizationId,
      profileRevisionId,
      profileRevisionSequence: profileSequence,
      profileFingerprint: fingerprint,
      declaredInputs: {
        sections: [
          { key: "synthetic", values: [{ key: "value", value: "test" }] },
        ],
      },
      evidenceReferenceIds: [
        coreValue(createOrganizationEvidenceReferenceId("evidence-decision-1")),
      ],
      draftVersion: coreValue(createDraftVersion(1)),
      at: "2026-07-28T00:01:00.000Z",
      actorAuthorityReference: authorityResult.value,
    }),
  );
  const recordWithDraft = coreValue(attachDraftToRecord(record, draft));
  const submitted = coreValue(
    submitDraftToRevision(recordWithDraft, draft, {
      draftId: draft.draftId,
      expectedDraftVersion: draft.draftVersion,
      revisionId: coreValue(
        createOrganizationVerificationRevisionId("revision-decision-1"),
      ),
      revisionSequence: coreValue(createVerificationRevisionSequence(1)),
      profileRevisionId,
      profileRevisionSequence: profileSequence,
      profileFingerprint: fingerprint,
      submissionActorAuthorityReference: authorityResult.value,
      submittedAt: "2026-07-28T00:02:00.000Z",
      submissionIdempotencyKey: coreValue(
        createSubmissionIdempotencyKey("submission-decision-1"),
      ),
      correlationId: coreValue(createCorrelationId("correlation-decision-1")),
    }),
  );
  const snapshotId = coreValue(createSnapshotId("snapshot-decision-1"));
  const snapshotFingerprint = coreValue(
    createSnapshotFingerprint("snapshot-fingerprint-decision-1"),
  );
  const completionId = decisionValue(
    createEvaluationCompletionId("evaluation-completion-1"),
  );
  const created = coreValue(
    createAttemptForRevision(submitted.record, submitted.revision, {
      attemptId: coreValue(
        createOrganizationVerificationAttemptId("attempt-decision-1"),
      ),
      sequence: coreValue(createVerificationAttemptSequence(1)),
      snapshotId,
      snapshotFingerprint,
      createdAt: "2026-07-28T00:03:00.000Z",
      correlationId: coreValue(createCorrelationId("attempt-correlation-1")),
    }),
  );
  const queued = coreValue(
    transitionAttemptProcess(created.attempt, {
      nextState: "queued",
      at: "2026-07-28T00:04:00.000Z",
    }),
  );
  const running = coreValue(
    transitionAttemptProcess(queued, {
      nextState: "running",
      at: "2026-07-28T00:05:00.000Z",
    }),
  );
  const completed = coreValue(
    transitionAttemptProcess(running, {
      nextState: "completed",
      at: "2026-07-28T00:06:00.000Z",
      completionReference: coreValue(
        createCompletionReference(String(completionId)),
      ),
    }),
  );
  const rawBase = {
    recordId: submitted.record.recordId,
    revisionId: submitted.revision.revisionId,
    attemptId: completed.attemptId,
    organizationId,
    snapshotId,
    snapshotFingerprint,
    evaluationCompletionId: completionId,
    policySetReference: decisionValue(
      createPolicySetReference("policy-set-reference-1"),
    ),
    policySetVersion: decisionValue(
      createPolicySetVersion("policy-set-version-1"),
    ),
    completedAt: "2026-07-28T00:06:00.000Z",
    evaluationComplete: true,
    evaluationIntegrityValid: true,
    categorySummaries: ["synthetic_summary"],
    correlationId: coreValue(createCorrelationId("evaluation-correlation-1")),
  };
  const decisionContext = {
    decisionId: decisionValue(
      createOrganizationVerificationDecisionId("decision-1"),
    ),
    decisionEngineVersion: decisionValue(
      createDecisionEngineVersion("decision-engine.v1"),
    ),
    decidedAt: "2026-07-28T00:07:00.000Z",
    integrityReference: decisionValue(
      createDecisionIntegrityReference("decision-integrity-1"),
    ),
    record: submitted.record,
    revision: submitted.revision,
    attempt: completed,
  };
  return {
    rawBase,
    decisionContext,
    submitted,
    attempts: { created: created.attempt, queued, running, completed },
  };
}

function rawFor(
  classification: NormalizedEvaluationClassification,
): RawNormalizedOrganizationVerificationEvaluation {
  const { rawBase } = completedContext();
  return {
    ...rawBase,
    approvalReady: classification === "approval_ready",
    revisionRequired: classification === "revision_required",
    manualReviewRequired: classification === "manual_review_required",
    rejectionRequired: classification === "rejection_required",
  };
}

test("maps all four normalized classifications exhaustively", () => {
  const mapping = {
    approval_ready: "approved",
    revision_required: "revision_required",
    manual_review_required: "manual_review",
    rejection_required: "rejected",
  } as const;
  for (const [classification, expected] of Object.entries(mapping)) {
    const fixture = completedContext();
    const sealed = decisionValue(
      sealNormalizedEvaluationCompletion(
        rawFor(classification as NormalizedEvaluationClassification),
      ),
    );
    const result = decisionValue(
      decideOrganizationVerification(sealed, fixture.decisionContext),
    );
    assert.equal(result.outcome, expected);
    assert.equal(Object.isFrozen(result), true);
    assert.equal(Object.isFrozen(result.policyProvenance), true);
  }
  assert.deepEqual(ORGANIZATION_VERIFICATION_DECISION_OUTCOMES, [
    "approved",
    "revision_required",
    "manual_review",
    "rejected",
  ]);
});

test("incomplete and integrity-invalid evaluation produce no Decision", () => {
  for (const override of [
    { evaluationComplete: false },
    { evaluationIntegrityValid: false },
  ]) {
    const result = sealNormalizedEvaluationCompletion({
      ...rawFor("approval_ready"),
      ...override,
    });
    assert.equal(result.ok, false);
  }
});

test("missing and every contradictory classification are rejected", () => {
  const base = rawFor("approval_ready");
  const missing = sealNormalizedEvaluationCompletion({
    ...base,
    approvalReady: false,
  });
  assert.equal(missing.ok, false);
  if (!missing.ok) {
    assert.equal(missing.code, "missing_evaluation_classification");
  }
  for (const second of [
    "revisionRequired",
    "manualReviewRequired",
    "rejectionRequired",
  ] as const) {
    const contradictory = sealNormalizedEvaluationCompletion({
      ...base,
      [second]: true,
    });
    assert.equal(contradictory.ok, false);
    if (!contradictory.ok) {
      assert.equal(
        contradictory.code,
        "contradictory_evaluation_classification",
      );
    }
  }
  const unsupported = sealNormalizedEvaluationCompletion({
    ...base,
    classification: "future_classification",
  } as RawNormalizedOrganizationVerificationEvaluation);
  assert.equal(unsupported.ok, false);
  if (!unsupported.ok) {
    assert.equal(unsupported.code, "unsupported_evaluation_classification");
  }
});

test("non-completed, queued, and running Attempts cannot produce Decisions", () => {
  const fixture = completedContext();
  const sealed = decisionValue(
    sealNormalizedEvaluationCompletion(rawFor("approval_ready")),
  );
  for (const attempt of [
    fixture.attempts.created,
    fixture.attempts.queued,
    fixture.attempts.running,
  ]) {
    const result = decideOrganizationVerification(sealed, {
      ...fixture.decisionContext,
      attempt,
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "attempt_not_completed");
  }
});

test("rejects every identity and Snapshot mismatch", () => {
  const fixture = completedContext();
  const sealedBase = rawFor("approval_ready");
  const cases: Array<
    [Partial<RawNormalizedOrganizationVerificationEvaluation>, string]
  > = [
    [
      {
        attemptId: coreValue(
          createOrganizationVerificationAttemptId("attempt-other"),
        ),
      },
      "attempt_id_mismatch",
    ],
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
        revisionId: coreValue(
          createOrganizationVerificationRevisionId("revision-other"),
        ),
      },
      "verification_revision_id_mismatch",
    ],
    [
      {
        organizationId: (() => {
          const result = createOrganizationId("org-other");
          assert.equal(result.ok, true);
          if (!result.ok) throw new Error(result.code);
          return result.value;
        })(),
      },
      "organization_id_mismatch",
    ],
    [{ snapshotId: coreValue(createSnapshotId("snapshot-other")) }, "snapshot_id_mismatch"],
    [
      {
        snapshotFingerprint: coreValue(
          createSnapshotFingerprint("snapshot-fingerprint-other"),
        ),
      },
      "snapshot_fingerprint_mismatch",
    ],
  ];
  for (const [override, expected] of cases) {
    const sealed = decisionValue(
      sealNormalizedEvaluationCompletion({ ...sealedBase, ...override }),
    );
    const result = decideOrganizationVerification(
      sealed,
      fixture.decisionContext,
    );
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, expected);
  }

  const revisionRecordMismatch = decideOrganizationVerification(
    decisionValue(
      sealNormalizedEvaluationCompletion(rawFor("approval_ready")),
    ),
    {
      ...fixture.decisionContext,
      revision: {
        ...fixture.revision,
        recordId: coreValue(
          createOrganizationVerificationRecordId("record-other"),
        ),
      },
    },
  );
  assert.equal(revisionRecordMismatch.ok, false);
  if (!revisionRecordMismatch.ok) {
    assert.equal(
      revisionRecordMismatch.code,
      "verification_record_id_mismatch",
    );
  }
});

test("sealed completion and Decision defensively copy nested provenance", () => {
  const fixture = completedContext();
  const summaries = ["before"];
  const sealed = decisionValue(
    sealNormalizedEvaluationCompletion({
      ...rawFor("approval_ready"),
      categorySummaries: summaries,
    }),
  );
  summaries.push("after");
  const decision = decisionValue(
    decideOrganizationVerification(sealed, fixture.decisionContext),
  );
  assert.deepEqual(sealed.categorySummaries, ["before"]);
  assert.equal(Object.isFrozen(sealed.categorySummaries), true);
  assert.equal(Object.isFrozen(decision.policyProvenance), true);
});

test("identical retry is idempotent and conflicting second construction fails", () => {
  const fixture = completedContext();
  const sealed = decisionValue(
    sealNormalizedEvaluationCompletion(rawFor("approval_ready")),
  );
  const first = decisionValue(
    decideOrganizationVerification(sealed, fixture.decisionContext),
  );
  const retry = decisionValue(
    decideOrganizationVerification(sealed, {
      ...fixture.decisionContext,
      existingDecision: first,
    }),
  );
  assert.equal(retry, first);

  const otherId = decisionValue(
    createOrganizationVerificationDecisionId("decision-other"),
  );
  const duplicate = decideOrganizationVerification(sealed, {
    ...fixture.decisionContext,
    decisionId: otherId,
    existingDecision: first,
  });
  assert.equal(duplicate.ok, false);
  if (!duplicate.ok) {
    assert.equal(duplicate.code, "duplicate_decision_for_completion");
  }
  assert.equal(first.outcome, "approved");
});

test("arbitrary objects, legacy Booleans, lifecycle, and reviewer outcomes cannot decide", () => {
  const fixture = completedContext();
  for (const raw of [
    { verified: true },
    { company_name: "Legacy", approved: true },
    { role: "reviewer", outcome: "approved" },
    { seller: true },
    { ownsOffer: true },
    { documentPresent: true },
    { uiStatus: "approved" },
    { organization_lifecycle: "active" },
  ]) {
    const result = decideOrganizationVerification(
      raw as never,
      fixture.decisionContext,
    );
    assert.equal(result.ok, false);
  }
});

test("invalid Decision identifiers, engine versions, and mutable pointers fail", () => {
  assert.equal(createOrganizationVerificationDecisionId("").ok, false);
  assert.equal(createDecisionEngineVersion("latest").ok, false);
  assert.equal(createPolicySetVersion("current").ok, false);
  assert.equal(createPolicySetReference(" ").ok, false);
});
