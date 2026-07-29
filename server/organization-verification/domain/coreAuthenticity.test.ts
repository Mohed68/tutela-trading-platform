import assert from "node:assert/strict";
import test from "node:test";
import {
  createOrganizationId,
  createOrganizationProfileFingerprint,
  createOrganizationProfileRevisionId,
  createOrganizationProfileRevisionSequence,
  parseActorAuthorityReference,
} from "../../organization-registry/index.js";
import * as domain from "./index.js";
import type { CoreDomainResult } from "./index.js";

function value<T>(result: CoreDomainResult<T>): T {
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error(result.code);
  return result.value;
}

function fixture() {
  const organizationId = value(createOrganizationId("authenticity-org"));
  const profileRevisionId = value(
    createOrganizationProfileRevisionId("authenticity-profile"),
  );
  const profileRevisionSequence = value(
    createOrganizationProfileRevisionSequence(1),
  );
  const profileFingerprint = value(
    createOrganizationProfileFingerprint("authenticity-profile-fingerprint"),
  );
  const authority = value(
    parseActorAuthorityReference({
      actor_id: "authenticity-actor",
      authority_reference_id: "authenticity-authority",
      authority_version: "authority.v1",
      organization_scope: organizationId,
      issued_at: "2026-07-29T00:00:00.000Z",
      delegated_scopes: ["verification.submit"],
    }),
  );
  const record = value(
    domain.createOrganizationVerificationRecord({
      recordId: value(
        domain.createOrganizationVerificationRecordId(
          "authenticity-record",
        ),
      ),
      organizationId,
      createdAt: "2026-07-29T00:00:00.000Z",
    }),
  );
  const draft = value(
    domain.createDraftForRecord(record, {
      draftId: value(
        domain.createOrganizationVerificationDraftId("authenticity-draft"),
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
        value(
          domain.createOrganizationEvidenceReferenceId(
            "authenticity-evidence",
          ),
        ),
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
        domain.createOrganizationVerificationRevisionId(
          "authenticity-revision",
        ),
      ),
      revisionSequence: value(domain.createVerificationRevisionSequence(1)),
      profileRevisionId,
      profileRevisionSequence,
      profileFingerprint,
      submissionActorAuthorityReference: authority,
      submittedAt: "2026-07-29T00:02:00.000Z",
      submissionIdempotencyKey: value(
        domain.createSubmissionIdempotencyKey("authenticity-submission"),
      ),
      correlationId: value(
        domain.createCorrelationId("authenticity-submission-correlation"),
      ),
    }),
  );
  const attemptCreation = value(
    domain.createAttemptForRevision(submission.record, submission.revision, {
      attemptId: value(
        domain.createOrganizationVerificationAttemptId(
          "authenticity-attempt",
        ),
      ),
      sequence: value(domain.createVerificationAttemptSequence(1)),
      createdAt: "2026-07-29T00:03:00.000Z",
      correlationId: value(
        domain.createCorrelationId("authenticity-attempt-correlation"),
      ),
    }),
  );
  return {
    record,
    draft,
    recordWithDraft,
    revision: submission.revision,
    recordWithRevision: submission.record,
    attempt: attemptCreation.attempt,
    recordWithAttempt: attemptCreation.record,
  };
}

function assertPrivateSealDescriptor(value: object): void {
  const symbols = Object.getOwnPropertySymbols(value);
  assert.equal(symbols.length, 1);
  const descriptor = Object.getOwnPropertyDescriptor(value, symbols[0]!);
  assert.equal(descriptor?.value, true);
  assert.equal(descriptor?.enumerable, false);
  assert.equal(descriptor?.writable, false);
  assert.equal(descriptor?.configurable, false);
}

function impersonations<T extends object>(value: T): readonly unknown[] {
  const spread = { ...value };
  const assigned = Object.assign({}, value);
  const structural = Object.freeze({ ...value });
  const roundTrip = JSON.parse(JSON.stringify(value));
  const mutated = { ...value };
  Object.defineProperty(mutated, "createdAt", {
    value: "2099-01-01T00:00:00.000Z",
    enumerable: true,
    writable: true,
    configurable: true,
  });
  return [{}, spread, assigned, structural, roundTrip, mutated];
}

test("Record authenticity is established and preserved by every existing authority", () => {
  const input = fixture();
  for (const record of [
    input.record,
    input.recordWithDraft,
    input.recordWithRevision,
    input.recordWithAttempt,
  ]) {
    assert.equal(domain.isOrganizationVerificationRecord(record), true);
    assert.equal(Object.isFrozen(record), true);
    assert.equal(Object.isFrozen(record.revisions), true);
    assert.equal(Object.isFrozen(record.attempts), true);
    assertPrivateSealDescriptor(record);
  }
});

test("Record guard rejects every structural impersonation and copy mechanism", () => {
  const { recordWithAttempt } = fixture();
  for (const candidate of impersonations(recordWithAttempt)) {
    assert.equal(domain.isOrganizationVerificationRecord(candidate), false);
  }
  assert.equal(
    domain.isOrganizationVerificationRecord(structuredClone(recordWithAttempt)),
    false,
  );
});

test("Revision authenticity belongs only to the existing submission authority", () => {
  const { revision } = fixture();
  assert.equal(domain.isOrganizationVerificationRevision(revision), true);
  assert.equal(Object.isFrozen(revision), true);
  assert.equal(Object.isFrozen(revision.declaredInputs), true);
  assert.equal(Object.isFrozen(revision.evidenceReferenceIds), true);
  assertPrivateSealDescriptor(revision);
  for (const candidate of impersonations(revision)) {
    assert.equal(domain.isOrganizationVerificationRevision(candidate), false);
  }
  assert.equal(
    domain.isOrganizationVerificationRevision(structuredClone(revision)),
    false,
  );
});

test("Attempt authenticity is established at creation and preserved through every transition", () => {
  const { attempt } = fixture();
  const attempts = [attempt];
  attempts.push(
    value(
      domain.transitionAttemptProcess(attempts.at(-1)!, {
        nextState: "queued",
        at: "2026-07-29T00:04:00.000Z",
      }),
    ),
  );
  attempts.push(
    value(
      domain.transitionAttemptProcess(attempts.at(-1)!, {
        nextState: "running",
        at: "2026-07-29T00:05:00.000Z",
      }),
    ),
  );
  attempts.push(
    value(
      domain.transitionAttemptProcess(attempts.at(-1)!, {
        nextState: "queued",
        at: "2026-07-29T00:06:00.000Z",
      }),
    ),
  );
  attempts.push(
    value(
      domain.transitionAttemptProcess(attempts.at(-1)!, {
        nextState: "running",
        at: "2026-07-29T00:07:00.000Z",
      }),
    ),
  );
  attempts.push(
    value(
      domain.transitionAttemptProcess(attempts.at(-1)!, {
        nextState: "completed",
        at: "2026-07-29T00:08:00.000Z",
        completionReference: value(
          domain.createCompletionReference("authenticity-completion"),
        ),
      }),
    ),
  );
  assert.deepEqual(
    attempts.map((candidate) => candidate.processState),
    ["not_started", "queued", "running", "queued", "running", "completed"],
  );
  for (const candidate of attempts) {
    assert.equal(domain.isOrganizationVerificationAttempt(candidate), true);
    assert.equal(Object.isFrozen(candidate), true);
    assertPrivateSealDescriptor(candidate);
  }
});

test("Attempt guard rejects every structural impersonation and copy mechanism", () => {
  const { attempt } = fixture();
  for (const candidate of impersonations(attempt)) {
    assert.equal(domain.isOrganizationVerificationAttempt(candidate), false);
  }
  assert.equal(
    domain.isOrganizationVerificationAttempt(structuredClone(attempt)),
    false,
  );
});

test("a reflected seal descriptor cannot forge runtime authenticity", () => {
  const input = fixture();
  const cases: ReadonlyArray<readonly [object, (value: unknown) => boolean]> = [
    [input.recordWithAttempt, domain.isOrganizationVerificationRecord],
    [input.revision, domain.isOrganizationVerificationRevision],
    [input.attempt, domain.isOrganizationVerificationAttempt],
  ];
  for (const [authentic, guard] of cases) {
    const symbol = Object.getOwnPropertySymbols(authentic)[0]!;
    const descriptor = Object.getOwnPropertyDescriptor(authentic, symbol)!;
    const fabricated = { ...authentic };
    Object.defineProperty(fabricated, symbol, descriptor);
    Object.freeze(fabricated);
    assert.equal(guard(fabricated), false);
  }
});

test("caller mutation cannot alter authentic values or create authenticity", () => {
  const input = fixture();
  const recordCopy = { ...input.recordWithAttempt };
  recordCopy.revisions = [];
  const revisionCopy = { ...input.revision };
  revisionCopy.evidenceReferenceIds = [];
  const attemptCopy = { ...input.attempt };
  attemptCopy.processState = "completed";

  assert.equal(input.recordWithAttempt.revisions.length, 1);
  assert.equal(input.revision.evidenceReferenceIds.length, 1);
  assert.equal(input.attempt.processState, "not_started");
  assert.equal(domain.isOrganizationVerificationRecord(recordCopy), false);
  assert.equal(domain.isOrganizationVerificationRevision(revisionCopy), false);
  assert.equal(domain.isOrganizationVerificationAttempt(attemptCopy), false);
});

test("structural predecessors cannot be laundered through existing authorities", () => {
  const input = fixture();
  const fakeRecord = Object.freeze({ ...input.recordWithDraft });
  const fakeRevision = Object.freeze({ ...input.revision });
  const fakeAttempt = Object.freeze({ ...input.attempt });

  assert.equal(
    domain.attachDraftToRecord(fakeRecord, input.draft).ok,
    false,
  );
  assert.equal(
    domain.createAttemptForRevision(
      fakeRecord,
      input.revision,
      {
        attemptId: value(
          domain.createOrganizationVerificationAttemptId("fake-attempt"),
        ),
        sequence: value(domain.createVerificationAttemptSequence(1)),
        createdAt: "2026-07-29T00:03:00.000Z",
        correlationId: value(domain.createCorrelationId("fake-correlation")),
      },
    ).ok,
    false,
  );
  assert.equal(
    domain.createAttemptForRevision(
      input.recordWithRevision,
      fakeRevision,
      {
        attemptId: value(
          domain.createOrganizationVerificationAttemptId("fake-attempt"),
        ),
        sequence: value(domain.createVerificationAttemptSequence(1)),
        createdAt: "2026-07-29T00:03:00.000Z",
        correlationId: value(domain.createCorrelationId("fake-correlation")),
      },
    ).ok,
    false,
  );
  assert.equal(
    domain.transitionAttemptProcess(fakeAttempt, {
      nextState: "queued",
      at: "2026-07-29T00:04:00.000Z",
    }).ok,
    false,
  );
});

test("public surface adds only the three approved core authenticity guards", () => {
  const expected = [
    "isOrganizationVerificationAttempt",
    "isOrganizationVerificationRecord",
    "isOrganizationVerificationRevision",
  ];
  for (const name of expected) {
    assert.equal(typeof Reflect.get(domain, name), "function");
  }
  const coreAuthenticityExports = Object.keys(domain)
    .filter((name) =>
      /^isOrganizationVerification(?:Attempt|Record|Revision)$/.test(name),
    )
    .sort();
  assert.deepEqual(coreAuthenticityExports, expected);
  for (const name of Object.keys(domain)) {
    assert.equal(
      /(?:record|revision|attempt).*(?:seal|stamp|constructor|authenticity)/i.test(
        name,
      ),
      false,
    );
  }
});

test("frozen lifecycle vocabulary and transition matrix remain unchanged", () => {
  assert.deepEqual(domain.ATTEMPT_PROCESS_STATES, [
    "not_started",
    "queued",
    "running",
    "completed",
  ]);
  const allowed = [
    ["not_started", "queued"],
    ["queued", "running"],
    ["running", "queued"],
    ["running", "completed"],
  ] as const;
  for (const current of domain.ATTEMPT_PROCESS_STATES) {
    for (const next of domain.ATTEMPT_PROCESS_STATES) {
      assert.equal(
        domain.validateAttemptProcessTransition(current, next).ok,
        allowed.some(
          ([allowedCurrent, allowedNext]) =>
            allowedCurrent === current && allowedNext === next,
        ),
      );
    }
  }
});
