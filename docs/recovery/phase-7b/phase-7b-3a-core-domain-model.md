# Phase 7B-3A — Organization Verification Core Domain Model

Date: 2026-07-28

Status: **COMPLETED — PENDING REVIEW**

## 1. Slice Summary

Phase 7B-3A implements the pure immutable Organization Verification core
domain through Attempt process state. It establishes the coordination
aggregate, Draft, Submission, Revision, evidence-reference, Attempt, value
object, construction, and transition boundaries.

No outcome, status, policy, finding, persistence, or runtime behavior was
implemented.

## 2. Authorization Boundary

Implemented:

- opaque identifiers and positive sequences;
- `OrganizationVerificationRecord`;
- immutable Draft creation/update;
- Submission-to-Revision boundary;
- immutable Revision history references;
- semantic evidence-reference identifiers;
- Attempt creation and process transitions;
- typed domain failures, tests, and architecture enforcement.

Not implemented:

- Decision model/engine or sealed engine completion;
- Trust Status model/Deriver;
- policy/finding framework;
- Snapshot construction/fingerprinting;
- evidence assessment or raw storage;
- persistence/schema/migrations;
- coordinator/runtime/routes/workers/startup/frontend.

## 3. Baseline Commit and Validation

Branch: `architecture/phase-7a-organization-trust`

Accepted predecessor:
`d66671a3f72f963946e888a3edd57e9e8e18230f`

Baseline was exact and clean with no schema/migration changes.

| Command | Baseline |
|---|---|
| `npm run check` | PASS |
| `npm run build` | PASS; existing non-blocking warnings only |
| `npm run test:verification-engine` | PASS — 20/20 |
| `npm run test:organization-verification-architecture` | PASS — 16/16 |
| `npm run test:organization-registry-contracts` | PASS — 11/11 |

No `.env`, database, or runtime startup was used.

## 4. Architecture-Frozen Areas Preserved

- Registry remains sole Organization identity/Profile/Lifecycle authority.
- Core domain imports only Registry public types.
- Verification Record holds one opaque Organization reference, not a Profile
  or Lifecycle.
- Decision, workflow-effect, and status authorities remain reserved.
- Raw artifacts remain external; only semantic IDs exist.
- Offer Verification and Participation Eligibility remain independent.
- no legacy inference or trust inheritance exists.

## 5. Domain Concepts Implemented

- `OrganizationVerificationRecord`: subject coordination root with Draft,
  Revision, Attempt references and concurrency version.
- `OrganizationVerificationDraft`: immutable editable-state instance; updates
  return a new version.
- `OrganizationVerificationSubmission`: exact immutable submission intent.
- `OrganizationVerificationRevision`: frozen submitted owner/Registry/evidence
  input identity.
- `OrganizationVerificationAttempt`: one execution identity for one Revision.
- `AttemptProcessState`: operational state only.
- semantic evidence IDs, including evidence/snapshot/artifact/association
  reference placeholders.
- opaque Record/Draft/Revision/Attempt/Snapshot/correlation/idempotency IDs and
  positive Draft/Revision/Attempt sequences.

## 6. Aggregate Ownership

`OrganizationVerificationRecord` owns:

- its Record ID and one Organization ID reference;
- current Draft reference;
- ordered immutable Revision references;
- ordered Attempt references;
- monotonic sequences and concurrency version.

It does not own Registry Profile/Lifecycle, membership, raw artifacts,
outcomes, current trust standing, or eligibility.

Attempt sequence is monotonic per Verification Record. Each Attempt also
references exactly one Revision belonging to that Record.

## 7. Construction Authority

- Record creation: `createOrganizationVerificationRecord`.
- Draft creation: `createDraftForRecord`.
- Draft update: `updateDraft`, producing a new instance.
- Revision creation: only `submitDraftToRevision`; no unrestricted Revision
  constructor is exported.
- Attempt creation: `createAttemptForRevision`, representing pure
  submission/re-evaluation intent.
- Attempt transition: `transitionAttemptProcess`.

Routes, repositories, workers, and coordinators are absent and cannot be
represented as creators.

## 8. Domain Invariants

Implemented:

1. one Record has exactly one Organization ID;
2. Draft Record/Organization must match;
3. submission Record/Draft/Organization/authority scope must match;
4. submission Profile Revision ID/sequence/fingerprint must match Draft;
5. Revision sequence begins at one and increments by one;
6. duplicate Revision IDs are rejected;
7. submitted Revision and nested inputs are frozen;
8. evidence set is frozen on submission;
9. duplicate evidence references are rejected;
10. Attempt belongs to a Revision recorded by its Record;
11. Attempt sequence is positive and monotonic per Record;
12. only approved process transitions are accepted;
13. completed Attempt cannot reopen;
14. process contains no outcome semantics;
15. later Revision references append; prior references remain;
16. Registry Lifecycle is not stored;
17. Organization equality prevents cross-Organization state transfer;
18. legacy-shaped values cannot create Record authority.

## 9. Attempt Process Model

Allowed:

```text
not_started → queued
queued → running
running → queued
running → completed
```

Explicitly rejected:

- `not_started → running/completed`;
- `queued → completed`;
- every transition from `completed`.

Completion stores only an opaque completion reference placeholder. It contains
no outcome payload. Transport/lease recovery can transition the same Attempt
from running back to queued without changing Attempt identity.

## 10. Immutability Strategy

- factory outputs and nested arrays/objects are frozen;
- caller-declared sections/values are defensively copied;
- evidence arrays are copied and frozen;
- actor authority scopes are copied and frozen;
- Draft update returns a new instance;
- Revision append returns a new Record instance;
- Attempt transition returns a new Attempt instance;
- old Drafts, Revisions, Attempts, and Record reference arrays are not mutated.

Tests mutate caller-owned declared input after construction and prove submitted
Revision data remains unchanged.

## 11. Legacy Protection Evidence

Synthetic tests prove:

- company/verified-shaped objects cannot become Organization IDs;
- Organization mismatch blocks Draft/Submission authority;
- duplicate/document-like references do not bypass evidence invariants;
- process state is a closed four-value vocabulary;
- later-slice outcome/status strings are absent from production domain code.

No database rows, user IDs, offers, seeds, or documents were read.

## 12. Architecture Enforcement Updates

Architecture scanning now additionally rejects:

- domain files/modules for later Decision, status, finding, or policy slices;
- later-slice outcome/status string values in core production code;
- unrestricted exported Revision factory/class construction.

Existing rules continue to reject DB/ORM/schema/repository/routes/startup/
workers/frontend/storage/Offer Verification imports and runtime wiring.

Two new intentional fixtures raise the architecture suite from 16 to 18 tests.

## 13. Files Added or Changed

- `server/organization-verification/domain/errors.ts`
- `server/organization-verification/domain/ids.ts`
- `server/organization-verification/domain/evidenceReferences.ts`
- `server/organization-verification/domain/draft.ts`
- `server/organization-verification/domain/record.ts`
- `server/organization-verification/domain/revision.ts`
- `server/organization-verification/domain/submission.ts`
- `server/organization-verification/domain/process.ts`
- `server/organization-verification/domain/attempt.ts`
- `server/organization-verification/domain/index.ts`
- `server/organization-verification/domain/core.test.ts`
- `server/organization-verification/index.ts`
- `server/organization-verification/architecture.test.ts`
- `package.json`
- this report.

## 14. Runtime, Schema, and Database Impact

Runtime: **none** — no startup, route, API, worker, coordinator, adapter, or
frontend import.

Schema: **none** — no schema, table, repository, migration, or database
configuration change.

Database/environment: **none** — no DB access and no `.env` load/print.

Phase 6 files and behavior are unchanged.

## 15. Tests and Results

New command:

`npm run test:organization-verification-core-domain`

| Command | Final result |
|---|---|
| `npm run check` | PASS |
| `npm run build` | PASS; existing non-blocking warnings only |
| `npm run test:verification-engine` | PASS — 20/20 |
| `npm run test:organization-verification-architecture` | PASS — 18/18 |
| `npm run test:organization-registry-contracts` | PASS — 11/11 |
| `npm run test:organization-verification-core-domain` | PASS — 11/11 |

## 16. Risks and Limitations

- Domain factories rely on approved branded Registry values; future adapters
  must remain authoritative.
- In-memory uniqueness/monotonicity is aggregate-scoped; persistence-level
  concurrency constraints belong to reviewed later slices.
- Declared inputs are structural key/value sections, not production policy.
- Snapshot placeholders are opaque only; canonicalization is not implemented.
- Completion reference is opaque and carries no engine result.
- Process timestamps are structurally validated; ordering policy is deferred.
- No attempt retry transport/runtime behavior exists.

## 17. Rollback Strategy

Revert the Phase 7B-3A commit. All changes are pure source/tests/docs with no
runtime wiring or persisted state. No database rollback is needed.

## 18. Stop Confirmation

Confirmed:

- no Decision model or Decision Engine was implemented;
- no Trust Status model or Deriver was implemented;
- no policy/finding framework was implemented;
- no persistence/schema/migration was implemented;
- no database was accessed;
- no `.env` was loaded;
- no route/startup/worker/frontend wiring was added;
- no Phase 6 behavior changed;
- no Phase 7B-3B work began.

The next slice remains unauthorized:

**Phase 7B-3B — Decision Model and Decision Engine**
