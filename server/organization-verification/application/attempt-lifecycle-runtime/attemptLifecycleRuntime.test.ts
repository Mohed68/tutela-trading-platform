import assert from "node:assert/strict";
import test from "node:test";
import {
  createOrganizationId,
  createOrganizationProfileFingerprint,
  createOrganizationProfileRevisionId,
  createOrganizationProfileRevisionSequence,
  parseActorAuthorityReference,
} from "../../../organization-registry/index.js";
import * as domain from "../../domain/index.js";
import type { CoreDomainResult } from "../../domain/index.js";
import {
  createOrganizationVerificationAttemptLifecycleExecution,
  type AttemptLifecycleContractResult,
} from "../attempt-lifecycle-contract/index.js";
import * as runtime from "./index.js";

function value<T>(
  result:
    | CoreDomainResult<T>
    | AttemptLifecycleContractResult<T>
    | runtime.AttemptLifecycleRuntimeResult<T>,
): T {
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error(result.code);
  return result.value;
}

function initial() {
  const organizationId = value(createOrganizationId("runtime-org"));
  const profileRevisionId = value(
    createOrganizationProfileRevisionId("runtime-profile"),
  );
  const profileRevisionSequence = value(
    createOrganizationProfileRevisionSequence(1),
  );
  const profileFingerprint = value(
    createOrganizationProfileFingerprint("runtime-profile-fingerprint"),
  );
  const authority = value(
    parseActorAuthorityReference({
      actor_id: "runtime-actor",
      authority_reference_id: "runtime-authority",
      authority_version: "authority.v1",
      organization_scope: organizationId,
      issued_at: "2026-07-29T00:00:00.000Z",
      delegated_scopes: ["verification.submit"],
    }),
  );
  const record = value(
    domain.createOrganizationVerificationRecord({
      recordId: value(
        domain.createOrganizationVerificationRecordId("runtime-record"),
      ),
      organizationId,
      createdAt: "2026-07-29T00:00:00.000Z",
    }),
  );
  const draft = value(
    domain.createDraftForRecord(record, {
      draftId: value(domain.createOrganizationVerificationDraftId("runtime-draft")),
      organizationId,
      profileRevisionId,
      profileRevisionSequence,
      profileFingerprint,
      declaredInputs: {
        sections: [
          { key: "organization", values: [{ key: "statement", value: "x" }] },
        ],
      },
      evidenceReferenceIds: [
        value(domain.createOrganizationEvidenceReferenceId("runtime-evidence")),
      ],
      draftVersion: value(domain.createDraftVersion(1)),
      at: "2026-07-29T00:01:00.000Z",
      actorAuthorityReference: authority,
    }),
  );
  const withDraft = value(domain.attachDraftToRecord(record, draft));
  const submitted = value(
    domain.submitDraftToRevision(withDraft, draft, {
      draftId: draft.draftId,
      expectedDraftVersion: draft.draftVersion,
      revisionId: value(
        domain.createOrganizationVerificationRevisionId("runtime-revision"),
      ),
      revisionSequence: value(domain.createVerificationRevisionSequence(1)),
      profileRevisionId,
      profileRevisionSequence,
      profileFingerprint,
      submissionActorAuthorityReference: authority,
      submittedAt: "2026-07-29T00:02:00.000Z",
      submissionIdempotencyKey: value(
        domain.createSubmissionIdempotencyKey("runtime-submission"),
      ),
      correlationId: value(domain.createCorrelationId("runtime-correlation")),
    }),
  );
  const created = value(
    domain.createAttemptForRevision(submitted.record, submitted.revision, {
      attemptId: value(
        domain.createOrganizationVerificationAttemptId("runtime-attempt"),
      ),
      sequence: value(domain.createVerificationAttemptSequence(1)),
      createdAt: "2026-07-29T00:03:00.000Z",
      correlationId: value(
        domain.createCorrelationId("runtime-attempt-correlation"),
      ),
    }),
  );
  const execution = value(
    createOrganizationVerificationAttemptLifecycleExecution({
      lifecycleExecutionId: "runtime-execution",
      lifecycleExecutionVersion: 1,
      organizationId,
      recordId: created.record.recordId,
      revisionId: submitted.revision.revisionId,
      attemptId: created.attempt.attemptId,
      attemptSequence: created.attempt.sequence,
      record: created.record,
      revision: submitted.revision,
      attempt: created.attempt,
      transitionRecords: [],
      createdAt: "2026-07-29T00:03:00.000Z",
      provenanceReferences: ["execution-provenance"],
      integrityReferences: ["execution-integrity"],
    }),
  );
  return execution;
}

function command(
  execution: ReturnType<typeof initial>,
  transitionId: string,
  requestedTransition: "queued" | "running" | "completed",
  occurredAt: string,
  extras: Readonly<Record<string, unknown>> = {},
) {
  return {
    predecessorLifecycleExecution: execution,
    lifecycleExecutionId: execution.lifecycleExecutionId,
    expectedPredecessorLifecycleExecutionVersion:
      execution.lifecycleExecutionVersion,
    nextLifecycleExecutionVersion: execution.lifecycleExecutionVersion + 1,
    transitionId,
    requestedTransition,
    expectedPredecessorAttemptState: execution.attempt.processState,
    expectedResultingAttemptState: requestedTransition,
    recordId: execution.recordId,
    revisionId: execution.revisionId,
    attemptId: execution.attemptId,
    attemptSequence: execution.attemptSequence,
    occurredAt,
    provenanceReferences: ["z-provenance", "a-provenance"],
    integrityReferences: ["z-integrity", "a-integrity"],
    ...extras,
  };
}

test("executes exactly the four frozen transitions one invocation at a time", () => {
  let execution = initial();
  const predecessor = execution;
  for (const [id, next, at] of [
    ["runtime-transition-1", "queued", "2026-07-29T00:04:00.000Z"],
    ["runtime-transition-2", "running", "2026-07-29T00:05:00.000Z"],
    ["runtime-transition-3", "queued", "2026-07-29T00:06:00.000Z"],
    ["runtime-transition-4", "running", "2026-07-29T00:07:00.000Z"],
  ] as const) {
    const result = value(
      runtime.executeOrganizationVerificationAttemptTransition(
        command(execution, id, next, at),
      ),
    );
    assert.equal(result.predecessorAttempt, execution.attempt);
    assert.equal(result.resultingAttempt.processState, next);
    assert.equal(result.resultingAttempt.attemptId, execution.attemptId);
    assert.equal(result.resultingAttempt.sequence, execution.attemptSequence);
    assert.equal(
      result.nextLifecycleExecution.lifecycleExecutionVersion,
      execution.lifecycleExecutionVersion + 1,
    );
    assert.equal(
      runtime.isOrganizationVerificationAttemptLifecycleTransitionExecution(
        result,
      ),
      true,
    );
    execution = result.nextLifecycleExecution;
  }
  const completed = value(
    runtime.executeOrganizationVerificationAttemptTransition(
      command(
        execution,
        "runtime-transition-5",
        "completed",
        "2026-07-29T00:08:00.000Z",
        {
          completionReference: value(
            domain.createCompletionReference("runtime-completion"),
          ),
        },
      ),
    ),
  );
  assert.equal(completed.resultingAttempt.processState, "completed");
  assert.equal(completed.resultingAttempt.completionReference, "runtime-completion");
  assert.equal(predecessor.lifecycleExecutionVersion, 1);
  assert.equal(predecessor.transitionRecords.length, 0);
});

test("same semantic command is deterministic and idempotent", () => {
  const execution = initial();
  const input = command(
    execution,
    "deterministic",
    "queued",
    "2026-07-29T00:04:00.000Z",
  );
  const one = value(
    runtime.executeOrganizationVerificationAttemptTransition(input),
  );
  const two = value(
    runtime.executeOrganizationVerificationAttemptTransition(input),
  );
  assert.equal(
    one.transitionRecord.attemptLifecycleTransitionBindingFingerprint,
    two.transitionRecord.attemptLifecycleTransitionBindingFingerprint,
  );
  assert.equal(
    one.nextLifecycleExecution.attemptLifecycleExecutionFingerprint,
    two.nextLifecycleExecution.attemptLifecycleExecutionFingerprint,
  );
  assert.equal(
    one.attemptLifecycleTransitionExecutionFingerprint,
    two.attemptLifecycleTransitionExecutionFingerprint,
  );
});

test("preserves explicit evidence and returns deeply immutable evidence", () => {
  const provenanceReferences = ["z-provenance", "a-provenance"];
  const integrityReferences = ["z-integrity", "a-integrity"];
  const result = value(
    runtime.executeOrganizationVerificationAttemptTransition({
      ...command(
        initial(),
        "immutable",
        "queued",
        "2026-07-29T00:04:00.000Z",
        {
          correlationId: "runtime-correlation",
          causationId: "runtime-causation",
          reasonReference: "runtime-reason",
        },
      ),
      provenanceReferences,
      integrityReferences,
    }),
  );

  provenanceReferences.push("caller-mutation");
  integrityReferences.reverse();

  assert.deepEqual(result.transitionRecord.provenanceReferences, [
    "a-provenance",
    "z-provenance",
  ]);
  assert.deepEqual(result.transitionRecord.integrityReferences, [
    "a-integrity",
    "z-integrity",
  ]);
  assert.equal(result.transitionRecord.correlationId, "runtime-correlation");
  assert.equal(result.transitionRecord.causationId, "runtime-causation");
  assert.equal(result.transitionRecord.reasonReference, "runtime-reason");
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.predecessorAttempt), true);
  assert.equal(Object.isFrozen(result.resultingAttempt), true);
  assert.equal(Object.isFrozen(result.transitionRecord), true);
  assert.equal(Object.isFrozen(result.nextLifecycleExecution), true);
  assert.equal(
    Object.isFrozen(result.nextLifecycleExecution.transitionRecords),
    true,
  );
});

test("canonical evidence ordering and equal timestamps remain deterministic", () => {
  const execution = initial();
  const first = value(
    runtime.executeOrganizationVerificationAttemptTransition({
      ...command(
        execution,
        "ordered",
        "queued",
        "2026-07-29T00:03:00.000Z",
      ),
      provenanceReferences: ["z", "a"],
      integrityReferences: ["z", "a"],
    }),
  );
  const second = value(
    runtime.executeOrganizationVerificationAttemptTransition({
      ...command(
        execution,
        "ordered",
        "queued",
        "2026-07-29T00:03:00.000Z",
      ),
      integrityReferences: ["a", "z"],
      provenanceReferences: ["a", "z"],
    }),
  );

  assert.equal(first.occurredAt, execution.createdAt);
  assert.equal(
    first.transitionRecord.attemptLifecycleTransitionBindingFingerprint,
    second.transitionRecord.attemptLifecycleTransitionBindingFingerprint,
  );
  assert.equal(
    first.nextLifecycleExecution.attemptLifecycleExecutionFingerprint,
    second.nextLifecycleExecution.attemptLifecycleExecutionFingerprint,
  );
  assert.equal(
    first.attemptLifecycleTransitionExecutionFingerprint,
    second.attemptLifecycleTransitionExecutionFingerprint,
  );
});

test("semantic changes alter fingerprints and malformed evidence fails closed", () => {
  const execution = initial();
  const first = value(
    runtime.executeOrganizationVerificationAttemptTransition(
      command(execution, "semantic-one", "queued", "2026-07-29T00:04:00.000Z"),
    ),
  );
  const second = value(
    runtime.executeOrganizationVerificationAttemptTransition(
      command(execution, "semantic-two", "queued", "2026-07-29T00:04:00.000Z"),
    ),
  );
  assert.notEqual(
    first.attemptLifecycleTransitionExecutionFingerprint,
    second.attemptLifecycleTransitionExecutionFingerprint,
  );

  for (const malformed of [
    { provenanceReferences: [""] },
    { integrityReferences: [""] },
    { correlationId: "" },
    { causationId: "" },
    { reasonReference: "" },
  ]) {
    assert.equal(
      runtime.executeOrganizationVerificationAttemptTransition({
        ...command(
          execution,
          "malformed",
          "queued",
          "2026-07-29T00:04:00.000Z",
        ),
        ...malformed,
      }).ok,
      false,
    );
  }
});

test("completion requires exactly the Domain completion artifact", () => {
  let execution = initial();
  execution = value(
    runtime.executeOrganizationVerificationAttemptTransition(
      command(execution, "q", "queued", "2026-07-29T00:04:00.000Z"),
    ),
  ).nextLifecycleExecution;
  execution = value(
    runtime.executeOrganizationVerificationAttemptTransition(
      command(execution, "r", "running", "2026-07-29T00:05:00.000Z"),
    ),
  ).nextLifecycleExecution;
  const missing = runtime.executeOrganizationVerificationAttemptTransition(
    command(execution, "c", "completed", "2026-07-29T00:06:00.000Z"),
  );
  assert.equal(missing.ok, false);
  assert.equal(
    runtime.executeOrganizationVerificationAttemptTransition(
      command(execution, "q2", "queued", "2026-07-29T00:06:00.000Z", {
        completionReference: value(
          domain.createCompletionReference("conflicting"),
        ),
      }),
    ).ok,
    false,
  );
});

test("rejects every non-frozen transition pair including transitions from completed", () => {
  const notStarted = initial();
  for (const requestedTransition of ["running", "completed"] as const) {
    assert.equal(
      runtime.executeOrganizationVerificationAttemptTransition({
        ...command(
          notStarted,
          `invalid-${requestedTransition}`,
          requestedTransition,
          "2026-07-29T00:04:00.000Z",
        ),
        ...(requestedTransition === "completed"
          ? {
              completionReference: value(
                domain.createCompletionReference("invalid-completion"),
              ),
            }
          : {}),
      }).ok,
      false,
    );
  }

  const queued = value(
    runtime.executeOrganizationVerificationAttemptTransition(
      command(
        notStarted,
        "valid-queued",
        "queued",
        "2026-07-29T00:04:00.000Z",
      ),
    ),
  ).nextLifecycleExecution;
  for (const requestedTransition of ["not_started", "completed"] as const) {
    const invalid = {
      ...command(
        queued,
        `invalid-queued-${requestedTransition}`,
        "running",
        "2026-07-29T00:05:00.000Z",
      ),
      requestedTransition,
      expectedResultingAttemptState: requestedTransition,
      ...(requestedTransition === "completed"
        ? {
            completionReference: value(
              domain.createCompletionReference("invalid-queued-completion"),
            ),
          }
        : {}),
    } as runtime.ExecuteAttemptTransitionInput;
    assert.equal(
      runtime.executeOrganizationVerificationAttemptTransition(invalid).ok,
      false,
    );
  }

  const running = value(
    runtime.executeOrganizationVerificationAttemptTransition(
      command(
        queued,
        "valid-running",
        "running",
        "2026-07-29T00:05:00.000Z",
      ),
    ),
  ).nextLifecycleExecution;
  const completed = value(
    runtime.executeOrganizationVerificationAttemptTransition(
      command(
        running,
        "valid-completed",
        "completed",
        "2026-07-29T00:06:00.000Z",
        {
          completionReference: value(
            domain.createCompletionReference("valid-completion"),
          ),
        },
      ),
    ),
  ).nextLifecycleExecution;
  assert.equal(
    runtime.executeOrganizationVerificationAttemptTransition(
      command(
        completed,
        "invalid-after-completed",
        "queued",
        "2026-07-29T00:07:00.000Z",
      ),
    ).ok,
    false,
  );
});

test("rejects fake execution, continuity conflicts, chronology, and invalid transitions", () => {
  const execution = initial();
  assert.equal(
    runtime.executeOrganizationVerificationAttemptTransition(
      command(Object.freeze({ ...execution }), "x", "queued", "2026-07-29T00:04:00.000Z"),
    ).ok,
    false,
  );
  for (const overrides of [
    { lifecycleExecutionId: "other" },
    { expectedPredecessorLifecycleExecutionVersion: 2 },
    { nextLifecycleExecutionVersion: 3 },
    { attemptId: "other" },
    { recordId: "other" },
    { revisionId: "other" },
    { attemptSequence: 2 },
    { expectedPredecessorAttemptState: "running" },
    { occurredAt: "2026-07-29T00:02:00.000Z" },
    { occurredAt: "invalid" },
  ]) {
    assert.equal(
      runtime.executeOrganizationVerificationAttemptTransition({
        ...command(execution, "x", "queued", "2026-07-29T00:04:00.000Z"),
        ...overrides,
      }).ok,
      false,
    );
  }
  assert.equal(
    runtime.executeOrganizationVerificationAttemptTransition(
      command(execution, "invalid", "running", "2026-07-29T00:04:00.000Z"),
    ).ok,
    false,
  );
});

test("runtime result guard rejects every structural copy", () => {
  const result = value(
    runtime.executeOrganizationVerificationAttemptTransition(
      command(initial(), "guard", "queued", "2026-07-29T00:04:00.000Z"),
    ),
  );
  for (const copy of [
    {},
    { ...result },
    Object.assign({}, result),
    Object.freeze({ ...result }),
    JSON.parse(JSON.stringify(result)),
    structuredClone(result),
  ]) {
    assert.equal(
      runtime.isOrganizationVerificationAttemptLifecycleTransitionExecution(
        copy,
      ),
      false,
    );
  }
});

test("public runtime exports are exact and contain no construction internals", () => {
  assert.deepEqual(Object.keys(runtime).sort(), [
    "executeOrganizationVerificationAttemptTransition",
    "isOrganizationVerificationAttemptLifecycleTransitionExecution",
  ]);
});
