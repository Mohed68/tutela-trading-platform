import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  REGISTRY_CONTRACT_VERSION,
  createOrganizationId,
  createOrganizationProfileFingerprint,
  createOrganizationProfileRevisionId,
  createOrganizationProfileRevisionSequence,
  parseActorAuthorityReference,
} from "../../organization-registry/index.js";
import {
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
  createSubmissionIdempotencyKey,
  createVerificationAttemptSequence,
  createVerificationRevisionSequence,
  attachDraftToRecord,
  submitDraftToRevision,
  transitionAttemptProcess,
  updateDraft,
  type CoreDomainResult,
} from "./index.js";

function value<T>(result: CoreDomainResult<T>): T {
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error(result.code);
  return result.value;
}

function registryValues(suffix = "1") {
  return {
    organizationId: value(createOrganizationId(`org-${suffix}`)),
    profileRevisionId: value(
      createOrganizationProfileRevisionId(`profile-${suffix}`),
    ),
    profileRevisionSequence: value(
      createOrganizationProfileRevisionSequence(1),
    ),
    profileFingerprint: value(
      createOrganizationProfileFingerprint(`fingerprint-${suffix}`),
    ),
    authority: (() => {
      const result = parseActorAuthorityReference({
        actor_id: `actor-${suffix}`,
        authority_reference_id: `authority-${suffix}`,
        authority_version: "authority.v1",
        organization_scope: `org-${suffix}`,
        issued_at: "2026-07-28T00:00:00.000Z",
        delegated_scopes: ["verification.submit"],
      });
      assert.equal(result.ok, true);
      if (!result.ok) throw new Error(result.code);
      return result.value;
    })(),
  };
}

function createFixture() {
  const registry = registryValues();
  const record = value(
    createOrganizationVerificationRecord({
      recordId: value(createOrganizationVerificationRecordId("record-1")),
      organizationId: registry.organizationId,
      createdAt: "2026-07-28T00:00:00.000Z",
    }),
  );
  const declaredInputs = {
    sections: [
      {
        key: "organization",
        values: [{ key: "statement", value: "synthetic" }],
      },
    ],
  };
  const evidenceReference = value(
    createOrganizationEvidenceReferenceId("evidence-1"),
  );
  const draft = value(
    createDraftForRecord(record, {
      draftId: value(createOrganizationVerificationDraftId("draft-1")),
      organizationId: registry.organizationId,
      profileRevisionId: registry.profileRevisionId,
      profileRevisionSequence: registry.profileRevisionSequence,
      profileFingerprint: registry.profileFingerprint,
      declaredInputs,
      evidenceReferenceIds: [evidenceReference],
      draftVersion: value(createDraftVersion(1)),
      at: "2026-07-28T00:01:00.000Z",
      actorAuthorityReference: registry.authority,
    }),
  );
  const recordWithDraft = value(attachDraftToRecord(record, draft));
  return {
    registry,
    record,
    recordWithDraft,
    draft,
    declaredInputs,
    evidenceReference,
  };
}

function submitFixture() {
  const fixture = createFixture();
  const revisionId = value(
    createOrganizationVerificationRevisionId("revision-1"),
  );
  const result = value(
    submitDraftToRevision(fixture.recordWithDraft, fixture.draft, {
      draftId: fixture.draft.draftId,
      expectedDraftVersion: fixture.draft.draftVersion,
      revisionId,
      revisionSequence: value(createVerificationRevisionSequence(1)),
      profileRevisionId: fixture.registry.profileRevisionId,
      profileRevisionSequence: fixture.registry.profileRevisionSequence,
      profileFingerprint: fixture.registry.profileFingerprint,
      submissionActorAuthorityReference: fixture.registry.authority,
      submittedAt: "2026-07-28T00:02:00.000Z",
      submissionIdempotencyKey: value(
        createSubmissionIdempotencyKey("submission-1"),
      ),
      correlationId: value(createCorrelationId("correlation-1")),
    }),
  );
  return { ...fixture, ...result };
}

test("creates one immutable Verification Record for exactly one Organization", () => {
  const fixture = createFixture();
  assert.equal(fixture.record.organizationId, fixture.registry.organizationId);
  assert.equal(fixture.record.concurrencyVersion, 1);
  assert.equal(Object.isFrozen(fixture.record), true);

  const legacy = createOrganizationVerificationRecord({
    recordId: value(createOrganizationVerificationRecordId("legacy-record")),
    organizationId: { company_name: "Legacy", verified: true } as never,
    createdAt: "2026-07-28T00:00:00.000Z",
  });
  assert.equal(legacy.ok, false);
});

test("rejects Draft Organization mismatch and duplicate evidence references", () => {
  const fixture = createFixture();
  const other = registryValues("2");
  const mismatch = createDraftForRecord(fixture.record, {
    ...fixture.draft,
    organizationId: other.organizationId,
    at: fixture.draft.createdAt,
  });
  assert.equal(mismatch.ok, false);
  if (!mismatch.ok) assert.equal(mismatch.code, "organization_id_mismatch");

  const duplicate = createDraftForRecord(fixture.record, {
    ...fixture.draft,
    at: fixture.draft.createdAt,
    evidenceReferenceIds: [
      fixture.evidenceReference,
      fixture.evidenceReference,
    ],
  });
  assert.equal(duplicate.ok, false);
  if (!duplicate.ok) {
    assert.equal(duplicate.code, "duplicate_evidence_reference");
  }
});

test("Draft update returns a new immutable instance and preserves the prior Draft", () => {
  const fixture = createFixture();
  const mutableInputs = {
    sections: [
      { key: "updated", values: [{ key: "field", value: "before" }] },
    ],
  };
  const updated = value(
    updateDraft(fixture.draft, {
      expectedDraftVersion: fixture.draft.draftVersion,
      nextDraftVersion: value(createDraftVersion(2)),
      declaredInputs: mutableInputs,
      evidenceReferenceIds: [fixture.evidenceReference],
      updatedAt: "2026-07-28T00:03:00.000Z",
      actorAuthorityReference: fixture.registry.authority,
    }),
  );
  mutableInputs.sections[0]!.values[0]!.value = "after";
  assert.equal(fixture.draft.declaredInputs.sections[0]!.key, "organization");
  assert.equal(updated.declaredInputs.sections[0]!.values[0]!.value, "before");
  assert.notEqual(updated, fixture.draft);
  assert.equal(Object.isFrozen(updated), true);
});

test("Submission boundary alone creates an immutable Revision and advances Record", () => {
  const fixture = submitFixture();
  assert.equal(fixture.revision.sequence, 1);
  assert.equal(fixture.record.revisions.length, 1);
  assert.equal(fixture.record.currentDraftId, undefined);
  assert.equal(Object.isFrozen(fixture.revision), true);
  assert.equal(Object.isFrozen(fixture.revision.evidenceReferenceIds), true);
  assert.equal(Object.isFrozen(fixture.revision.declaredInputs.sections), true);
});

test("Submission rejects Profile Revision mismatch and non-monotonic sequence", () => {
  const fixture = createFixture();
  const other = registryValues("2");
  const base = {
    draftId: fixture.draft.draftId,
    expectedDraftVersion: fixture.draft.draftVersion,
    revisionId: value(createOrganizationVerificationRevisionId("revision-x")),
    revisionSequence: value(createVerificationRevisionSequence(1)),
    profileRevisionId: fixture.registry.profileRevisionId,
    profileRevisionSequence: fixture.registry.profileRevisionSequence,
    profileFingerprint: fixture.registry.profileFingerprint,
    submissionActorAuthorityReference: fixture.registry.authority,
    submittedAt: "2026-07-28T00:02:00.000Z",
    submissionIdempotencyKey: value(
      createSubmissionIdempotencyKey("submission-x"),
    ),
    correlationId: value(createCorrelationId("correlation-x")),
  };
  const mismatch = submitDraftToRevision(
    fixture.recordWithDraft,
    fixture.draft,
    { ...base, profileRevisionId: other.profileRevisionId },
  );
  assert.equal(mismatch.ok, false);
  if (!mismatch.ok) assert.equal(mismatch.code, "profile_revision_mismatch");

  const sequence = submitDraftToRevision(
    fixture.recordWithDraft,
    fixture.draft,
    { ...base, revisionSequence: value(createVerificationRevisionSequence(2)) },
  );
  assert.equal(sequence.ok, false);
  if (!sequence.ok) {
    assert.equal(sequence.code, "non_monotonic_revision_sequence");
  }
});

test("caller mutations cannot alter submitted inputs, evidence, or authority", () => {
  const fixture = createFixture();
  const submitted = submitFixture();
  fixture.declaredInputs.sections[0]!.values[0]!.value = "mutated";
  assert.equal(
    submitted.revision.declaredInputs.sections[0]!.values[0]!.value,
    "synthetic",
  );
  assert.deepEqual(submitted.revision.evidenceReferenceIds, [
    fixture.evidenceReference,
  ]);
  assert.deepEqual(
    submitted.revision.submissionActorAuthorityReference.delegatedScopes,
    ["verification.submit"],
  );
  assert.equal(
    Object.isFrozen(
      submitted.revision.submissionActorAuthorityReference.delegatedScopes,
    ),
    true,
  );
});

test("creates one not-started Attempt for exactly one submitted Revision", () => {
  const fixture = submitFixture();
  const creation = value(
    createAttemptForRevision(fixture.record, fixture.revision, {
      attemptId: value(createOrganizationVerificationAttemptId("attempt-1")),
      sequence: value(createVerificationAttemptSequence(1)),
      createdAt: "2026-07-28T00:03:00.000Z",
      correlationId: value(createCorrelationId("attempt-correlation-1")),
    }),
  );
  assert.equal(creation.attempt.revisionId, fixture.revision.revisionId);
  assert.equal(creation.attempt.processState, "not_started");
  assert.equal(creation.record.attempts.length, 1);
  assert.equal(Object.isFrozen(creation.attempt), true);
});

test("Attempt creation rejects wrong Record ownership and sequence", () => {
  const fixture = submitFixture();
  const other = createFixture();
  const input = {
    attemptId: value(createOrganizationVerificationAttemptId("attempt-x")),
    sequence: value(createVerificationAttemptSequence(1)),
    createdAt: "2026-07-28T00:03:00.000Z",
    correlationId: value(createCorrelationId("attempt-correlation-x")),
  };
  const ownership = createAttemptForRevision(
    other.record,
    fixture.revision,
    input,
  );
  assert.equal(ownership.ok, false);
  const sequence = createAttemptForRevision(
    fixture.record,
    fixture.revision,
    { ...input, sequence: value(createVerificationAttemptSequence(2)) },
  );
  assert.equal(sequence.ok, false);
  if (!sequence.ok) assert.equal(sequence.code, "invalid_attempt_sequence");
});

test("allows only the four approved process transitions", () => {
  const fixture = submitFixture();
  let attempt = value(
    createAttemptForRevision(fixture.record, fixture.revision, {
      attemptId: value(createOrganizationVerificationAttemptId("attempt-1")),
      sequence: value(createVerificationAttemptSequence(1)),
      createdAt: "2026-07-28T00:03:00.000Z",
      correlationId: value(createCorrelationId("attempt-correlation-1")),
    }),
  ).attempt;
  attempt = value(
    transitionAttemptProcess(attempt, {
      nextState: "queued",
      at: "2026-07-28T00:04:00.000Z",
    }),
  );
  attempt = value(
    transitionAttemptProcess(attempt, {
      nextState: "running",
      at: "2026-07-28T00:05:00.000Z",
    }),
  );
  attempt = value(
    transitionAttemptProcess(attempt, {
      nextState: "queued",
      at: "2026-07-28T00:06:00.000Z",
    }),
  );
  attempt = value(
    transitionAttemptProcess(attempt, {
      nextState: "running",
      at: "2026-07-28T00:07:00.000Z",
    }),
  );
  attempt = value(
    transitionAttemptProcess(attempt, {
      nextState: "completed",
      at: "2026-07-28T00:08:00.000Z",
      completionReference: value(
        createCompletionReference("completion-reference-1"),
      ),
    }),
  );
  assert.equal(attempt.processState, "completed");
  assert.equal(Object.isFrozen(attempt), true);
});

test("rejects every prohibited process transition and completed reopening", () => {
  const fixture = submitFixture();
  const original = value(
    createAttemptForRevision(fixture.record, fixture.revision, {
      attemptId: value(createOrganizationVerificationAttemptId("attempt-1")),
      sequence: value(createVerificationAttemptSequence(1)),
      createdAt: "2026-07-28T00:03:00.000Z",
      correlationId: value(createCorrelationId("attempt-correlation-1")),
    }),
  ).attempt;
  for (const nextState of ["running", "completed"] as const) {
    const result = transitionAttemptProcess(original, {
      nextState,
      at: "2026-07-28T00:04:00.000Z",
    });
    assert.equal(result.ok, false);
  }
  const queued = value(
    transitionAttemptProcess(original, {
      nextState: "queued",
      at: "2026-07-28T00:04:00.000Z",
    }),
  );
  const queuedComplete = transitionAttemptProcess(queued, {
    nextState: "completed",
    at: "2026-07-28T00:05:00.000Z",
    completionReference: value(createCompletionReference("completion-x")),
  });
  assert.equal(queuedComplete.ok, false);
  const running = value(
    transitionAttemptProcess(queued, {
      nextState: "running",
      at: "2026-07-28T00:05:00.000Z",
    }),
  );
  const completed = value(
    transitionAttemptProcess(running, {
      nextState: "completed",
      at: "2026-07-28T00:06:00.000Z",
      completionReference: value(createCompletionReference("completion-y")),
    }),
  );
  for (const nextState of ["not_started", "queued", "running"] as const) {
    const result = transitionAttemptProcess(completed, {
      nextState,
      at: "2026-07-28T00:07:00.000Z",
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "attempt_already_completed");
  }
});

test("production core domain contains no later-slice vocabulary or raw storage", () => {
  const modules = [
    "attempt.ts",
    "draft.ts",
    "errors.ts",
    "evidenceReferences.ts",
    "ids.ts",
    "process.ts",
    "record.ts",
    "revision.ts",
    "submission.ts",
  ];
  const forbidden = [
    '"approved"',
    '"revision_required"',
    '"manual_review"',
    '"rejected"',
    '"unestablished"',
    '"trusted"',
    '"not_trusted"',
    '"expired"',
    '"invalidated"',
    "DecisionEngine",
    "TrustStatus",
    "ReasonCode",
    "PolicyVersion",
    "RawArtifactStore",
  ];
  for (const module of modules) {
    const source = fs.readFileSync(new URL(`./${module}`, import.meta.url), "utf8");
    for (const term of forbidden) {
      assert.equal(source.includes(term), false, `${module}: ${term}`);
    }
  }
  assert.equal(REGISTRY_CONTRACT_VERSION.endsWith(".v1"), true);
});
