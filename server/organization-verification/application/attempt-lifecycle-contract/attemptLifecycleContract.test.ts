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
import * as contract from "./index.js";
import type { AttemptLifecycleContractResult } from "./index.js";

function value<T>(
  result: CoreDomainResult<T> | AttemptLifecycleContractResult<T>,
): T {
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error(result.code);
  return result.value;
}

function domainFixture() {
  const organizationId = value(createOrganizationId("lifecycle-org"));
  const profileRevisionId = value(
    createOrganizationProfileRevisionId("lifecycle-profile"),
  );
  const profileRevisionSequence = value(
    createOrganizationProfileRevisionSequence(1),
  );
  const profileFingerprint = value(
    createOrganizationProfileFingerprint("lifecycle-profile-fingerprint"),
  );
  const authority = value(
    parseActorAuthorityReference({
      actor_id: "lifecycle-actor",
      authority_reference_id: "lifecycle-authority",
      authority_version: "authority.v1",
      organization_scope: organizationId,
      issued_at: "2026-07-29T00:00:00.000Z",
      delegated_scopes: ["verification.submit"],
    }),
  );
  const record = value(
    domain.createOrganizationVerificationRecord({
      recordId: value(
        domain.createOrganizationVerificationRecordId("lifecycle-record"),
      ),
      organizationId,
      createdAt: "2026-07-29T00:00:00.000Z",
    }),
  );
  const draft = value(
    domain.createDraftForRecord(record, {
      draftId: value(
        domain.createOrganizationVerificationDraftId("lifecycle-draft"),
      ),
      organizationId,
      profileRevisionId,
      profileRevisionSequence,
      profileFingerprint,
      declaredInputs: {
        sections: [
          {
            key: "organization",
            values: [{ key: "statement", value: "synthetic" }],
          },
        ],
      },
      evidenceReferenceIds: [
        value(domain.createOrganizationEvidenceReferenceId("lifecycle-evidence")),
      ],
      draftVersion: value(domain.createDraftVersion(1)),
      at: "2026-07-29T00:01:00.000Z",
      actorAuthorityReference: authority,
    }),
  );
  const recordWithDraft = value(domain.attachDraftToRecord(record, draft));
  const submission = value(
    domain.submitDraftToRevision(recordWithDraft, draft, {
      draftId: draft.draftId,
      expectedDraftVersion: draft.draftVersion,
      revisionId: value(
        domain.createOrganizationVerificationRevisionId("lifecycle-revision"),
      ),
      revisionSequence: value(domain.createVerificationRevisionSequence(1)),
      profileRevisionId,
      profileRevisionSequence,
      profileFingerprint,
      submissionActorAuthorityReference: authority,
      submittedAt: "2026-07-29T00:02:00.000Z",
      submissionIdempotencyKey: value(
        domain.createSubmissionIdempotencyKey("lifecycle-submission"),
      ),
      correlationId: value(domain.createCorrelationId("lifecycle-correlation")),
    }),
  );
  const creation = value(
    domain.createAttemptForRevision(submission.record, submission.revision, {
      attemptId: value(
        domain.createOrganizationVerificationAttemptId("lifecycle-attempt"),
      ),
      sequence: value(domain.createVerificationAttemptSequence(1)),
      createdAt: "2026-07-29T00:03:00.000Z",
      correlationId: value(
        domain.createCorrelationId("lifecycle-attempt-correlation"),
      ),
    }),
  );
  return {
    organizationId,
    record: creation.record,
    revision: submission.revision,
    attempt: creation.attempt,
  };
}

const evidence = Object.freeze({
  provenanceReferences: Object.freeze(["provenance-b", "provenance-a"]),
  integrityReferences: Object.freeze(["integrity-b", "integrity-a"]),
});

function transition(
  fixture: ReturnType<typeof domainFixture>,
  transitionId: string,
  predecessorLifecycleExecutionVersion: number,
  predecessorAttemptState: domain.AttemptProcessState,
  requestedTransition: contract.AttemptLifecycleRequestedTransition,
  occurredAt: string,
  extras: Readonly<Record<string, unknown>> = {},
) {
  return contract.createOrganizationVerificationAttemptLifecycleTransitionRecord({
    transitionId,
    lifecycleExecutionId: "lifecycle-execution-1",
    predecessorLifecycleExecutionVersion,
    nextLifecycleExecutionVersion: predecessorLifecycleExecutionVersion + 1,
    attemptId: fixture.attempt.attemptId,
    predecessorAttemptState,
    requestedTransition,
    resultingAttemptState: requestedTransition,
    occurredAt,
    ...evidence,
    ...extras,
  });
}

function scenario() {
  const fixture = domainFixture();
  let attempt = fixture.attempt;
  const specifications = [
    ["transition-1", "not_started", "queued", "2026-07-29T00:04:00.000Z"],
    ["transition-2", "queued", "running", "2026-07-29T00:05:00.000Z"],
    ["transition-3", "running", "queued", "2026-07-29T00:06:00.000Z"],
    ["transition-4", "queued", "running", "2026-07-29T00:07:00.000Z"],
    ["transition-5", "running", "completed", "2026-07-29T00:08:00.000Z"],
  ] as const;
  const records: contract.OrganizationVerificationAttemptLifecycleTransitionRecord[] =
    [];
  for (let index = 0; index < specifications.length; index += 1) {
    const [id, predecessor, next, at] = specifications[index]!;
    attempt = value(
      domain.transitionAttemptProcess(attempt, {
        nextState: next,
        at,
        ...(next === "completed"
          ? {
              completionReference: value(
                domain.createCompletionReference("lifecycle-completion"),
              ),
            }
          : {}),
      }),
    );
    records.push(
      value(
        transition(fixture, id, index + 1, predecessor, next, at, {
          ...(id === "transition-5"
            ? { reasonReference: "completion-evidence" }
            : {}),
        }),
      ),
    );
  }
  return { ...fixture, attempt, records };
}

function executionInput(
  input: ReturnType<typeof scenario>,
  overrides: Readonly<Record<string, unknown>> = {},
) {
  return {
    lifecycleExecutionId: "lifecycle-execution-1",
    lifecycleExecutionVersion: input.records.length + 1,
    organizationId: input.organizationId,
    recordId: input.record.recordId,
    revisionId: input.revision.revisionId,
    attemptId: input.attempt.attemptId,
    attemptSequence: input.attempt.sequence,
    record: input.record,
    revision: input.revision,
    attempt: input.attempt,
    transitionRecords: input.records,
    createdAt: "2026-07-29T00:03:00.000Z",
    lastTransitionAt: input.records.at(-1)?.occurredAt,
    ...evidence,
    ...overrides,
  };
}

test("binds an authentic Organization–Record–Revision–Attempt chain and all frozen transitions", () => {
  const input = scenario();
  const execution = value(
    contract.createOrganizationVerificationAttemptLifecycleExecution(
      executionInput(input),
    ),
  );
  assert.equal(execution.lifecycleExecutionVersion, 6);
  assert.equal(execution.transitionRecords.length, 5);
  assert.equal(execution.attempt, input.attempt);
  assert.equal(
    contract.isOrganizationVerificationAttemptLifecycleExecution(execution),
    true,
  );
  assert.equal(Object.isFrozen(execution), true);
  assert.equal(Object.isFrozen(execution.transitionRecords), true);
  assert.equal(execution.transitionRecords.at(-1)?.reasonReference, "completion-evidence");
});

test("accepts the explicit initial execution convention without transition history", () => {
  const input = scenario();
  const initial = domainFixture();
  const result =
    contract.createOrganizationVerificationAttemptLifecycleExecution({
      ...executionInput(input),
      lifecycleExecutionVersion: 1,
      record: initial.record,
      revision: initial.revision,
      attempt: initial.attempt,
      organizationId: initial.organizationId,
      recordId: initial.record.recordId,
      revisionId: initial.revision.revisionId,
      attemptId: initial.attempt.attemptId,
      attemptSequence: initial.attempt.sequence,
      transitionRecords: [],
      lastTransitionAt: undefined,
    });
  assert.equal(result.ok, true);
});

test("rejects fake Record, Revision, and Attempt values", () => {
  const input = scenario();
  for (const override of [
    { record: Object.freeze({ ...input.record }) },
    { revision: Object.freeze({ ...input.revision }) },
    { attempt: Object.freeze({ ...input.attempt }) },
  ]) {
    assert.equal(
      contract.createOrganizationVerificationAttemptLifecycleExecution(
        executionInput(input, override),
      ).ok,
      false,
    );
  }
});

test("rejects every identity and sequence discontinuity", () => {
  const input = scenario();
  for (const override of [
    { organizationId: "other" },
    { recordId: "other" },
    { revisionId: "other" },
    { attemptId: "other" },
    { attemptSequence: 2 },
  ]) {
    assert.equal(
      contract.createOrganizationVerificationAttemptLifecycleExecution(
        executionInput(input, override),
      ).ok,
      false,
    );
  }
});

test("represents exactly the four frozen transition pairs and rejects all others", () => {
  const fixture = domainFixture();
  const allowed = [
    ["not_started", "queued"],
    ["queued", "running"],
    ["running", "queued"],
    ["running", "completed"],
  ] as const;
  for (const [from, to] of allowed) {
    assert.equal(
      transition(fixture, `${from}-${to}`, 1, from, to, "2026-07-29T00:04:00.000Z")
        .ok,
      true,
    );
  }
  assert.equal(
    transition(
      fixture,
      "invalid",
      1,
      "not_started",
      "completed",
      "2026-07-29T00:04:00.000Z",
    ).ok,
    false,
  );
});

test("enforces exact transition and execution version continuity", () => {
  const fixture = domainFixture();
  assert.equal(
    contract.createOrganizationVerificationAttemptLifecycleTransitionRecord({
      ...value(
        transition(
          fixture,
          "version",
          1,
          "not_started",
          "queued",
          "2026-07-29T00:04:00.000Z",
        ),
      ),
      nextLifecycleExecutionVersion: 3,
    }).ok,
    false,
  );
  const input = scenario();
  assert.equal(
    contract.createOrganizationVerificationAttemptLifecycleExecution(
      executionInput(input, { lifecycleExecutionVersion: 5 }),
    ).ok,
    false,
  );
});

test("enforces chronology and exact lastTransitionAt", () => {
  const input = scenario();
  assert.equal(
    contract.createOrganizationVerificationAttemptLifecycleExecution(
      executionInput(input, { createdAt: "2026-07-29T00:09:00.000Z" }),
    ).ok,
    false,
  );
  assert.equal(
    contract.createOrganizationVerificationAttemptLifecycleExecution(
      executionInput(input, {
        lastTransitionAt: "2026-07-29T00:07:59.000Z",
      }),
    ).ok,
    false,
  );
});

test("identical transition identity is idempotent and conflicting semantics fail closed", () => {
  const fixture = domainFixture();
  const first = value(
    transition(
      fixture,
      "same-id",
      1,
      "not_started",
      "queued",
      "2026-07-29T00:04:00.000Z",
    ),
  );
  const same = value(
    transition(
      fixture,
      "same-id",
      1,
      "not_started",
      "queued",
      "2026-07-29T00:04:00.000Z",
    ),
  );
  const conflict = value(
    transition(
      fixture,
      "same-id",
      1,
      "not_started",
      "queued",
      "2026-07-29T00:04:01.000Z",
    ),
  );
  assert.equal(
    value(
      contract.compareOrganizationVerificationAttemptLifecycleTransitionRecords(
        first,
        same,
      ),
    ),
    "idempotent",
  );
  assert.equal(
    contract.compareOrganizationVerificationAttemptLifecycleTransitionRecords(
      first,
      conflict,
    ).ok,
    false,
  );
});

test("different transitions cannot branch from one predecessor version", () => {
  const fixture = domainFixture();
  const first = value(
    transition(fixture, "a", 1, "not_started", "queued", "2026-07-29T00:04:00.000Z"),
  );
  const branch = value(
    transition(fixture, "b", 1, "not_started", "queued", "2026-07-29T00:04:00.000Z"),
  );
  assert.equal(
    contract.compareOrganizationVerificationAttemptLifecycleTransitionRecords(
      first,
      branch,
    ).ok,
    false,
  );
});

test("fingerprints are deterministic and reference-order independent", () => {
  const fixture = domainFixture();
  const first = value(
    transition(fixture, "deterministic", 1, "not_started", "queued", "2026-07-29T00:04:00.000Z"),
  );
  const reordered = value(
    transition(
      fixture,
      "deterministic",
      1,
      "not_started",
      "queued",
      "2026-07-29T00:04:00.000Z",
      {
        provenanceReferences: ["provenance-a", "provenance-b"],
        integrityReferences: ["integrity-a", "integrity-b"],
      },
    ),
  );
  assert.equal(
    first.attemptLifecycleTransitionBindingFingerprint,
    reordered.attemptLifecycleTransitionBindingFingerprint,
  );
});

test("semantic changes alter transition and execution fingerprints", () => {
  const fixture = domainFixture();
  const a = value(
    transition(fixture, "semantic-a", 1, "not_started", "queued", "2026-07-29T00:04:00.000Z"),
  );
  const b = value(
    transition(fixture, "semantic-b", 1, "not_started", "queued", "2026-07-29T00:04:00.000Z"),
  );
  assert.notEqual(
    a.attemptLifecycleTransitionBindingFingerprint,
    b.attemptLifecycleTransitionBindingFingerprint,
  );
  const input = scenario();
  const one = value(
    contract.createOrganizationVerificationAttemptLifecycleExecution(
      executionInput(input),
    ),
  );
  const two = value(
    contract.createOrganizationVerificationAttemptLifecycleExecution(
      executionInput(input, {
        integrityReferences: ["integrity-a", "integrity-c"],
      }),
    ),
  );
  assert.notEqual(
    one.attemptLifecycleExecutionFingerprint,
    two.attemptLifecycleExecutionFingerprint,
  );
});

test("new guards reject every copy and serialization impersonation", () => {
  const input = scenario();
  const transitionRecord = input.records[0]!;
  const execution = value(
    contract.createOrganizationVerificationAttemptLifecycleExecution(
      executionInput(input),
    ),
  );
  for (const [authentic, guard] of [
    [
      transitionRecord,
      contract.isOrganizationVerificationAttemptLifecycleTransitionRecord,
    ],
    [execution, contract.isOrganizationVerificationAttemptLifecycleExecution],
  ] as const) {
    for (const copy of [
      {},
      { ...authentic },
      Object.assign({}, authentic),
      Object.freeze({ ...authentic }),
      JSON.parse(JSON.stringify(authentic)),
      structuredClone(authentic),
    ]) {
      assert.equal(guard(copy), false);
    }
  }
});

test("caller-owned collections are copied, sorted, and deeply immutable", () => {
  const fixture = domainFixture();
  const provenance = ["z", "a"];
  const integrity = ["y", "b"];
  const record = value(
    transition(
      fixture,
      "mutation",
      1,
      "not_started",
      "queued",
      "2026-07-29T00:04:00.000Z",
      { provenanceReferences: provenance, integrityReferences: integrity },
    ),
  );
  provenance[0] = "mutated";
  integrity[0] = "mutated";
  assert.deepEqual(record.provenanceReferences, ["a", "z"]);
  assert.deepEqual(record.integrityReferences, ["b", "y"]);
  assert.equal(Object.isFrozen(record.provenanceReferences), true);
  assert.equal(Object.isFrozen(record.integrityReferences), true);
});

test("public exports remain exact and exclude seals, canonicalization, and constructors", () => {
  const expectedValues = [
    "compareOrganizationVerificationAttemptLifecycleTransitionRecords",
    "createOrganizationVerificationAttemptLifecycleExecution",
    "createOrganizationVerificationAttemptLifecycleTransitionRecord",
    "isOrganizationVerificationAttemptLifecycleExecution",
    "isOrganizationVerificationAttemptLifecycleTransitionRecord",
  ];
  assert.deepEqual(Object.keys(contract).sort(), expectedValues);
});
