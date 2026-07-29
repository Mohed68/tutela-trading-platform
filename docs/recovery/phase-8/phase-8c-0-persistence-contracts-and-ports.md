# Phase 8C.0 — Pure Organization Verification Persistence Contracts and Repository Ports

## Status and scope

This phase defines the application-facing persistence boundary for Organization Verification evidence. It is a contract phase only. It does not contain a database, schema, migration, query, adapter, transaction, filesystem store, cache, network client, startup wiring, replay engine, or in-memory repository.

Accepted baseline: `77d26add5ded0a87f5373760852924d1e0046b54`.

The boundary is located at:

`server/organization-verification/application/persistence-contract/`

The dependency direction is:

`Application runtime → persistence ports → future infrastructure adapter`

The current phase does not wire the Workflow runtime to these ports.

## Preflight decision

The frozen evidence chain has one non-competing durable representation:

- the initial `OrganizationVerificationWorkflowExecution` establishes the stream identity and genesis lifecycle baseline;
- every Workflow step persists the authentic authority result and its authentic `OrganizationVerificationWorkflowStepRecord`;
- the next `OrganizationVerificationWorkflowExecution` is reconstructable from genesis plus the ordered step records and is not persisted independently;
- `OrganizationVerificationAttemptLifecycleTransitionExecution` and `OrganizationVerificationWorkflowStepExecution` are derived runtime envelopes and do not become sources of truth;
- Record, Revision, Attempt, and transition records remain authoritative while nested within the authenticated Attempt Lifecycle Execution that already owns them.

All standalone replay evidence has an existing public authenticity guard, deterministic semantic identity, explicit version or sequence, and deterministic fingerprint. No frozen Domain or Workflow semantics had to change.

## Durable evidence classification

| Artifact | Class | Mode | Source of truth | Identity | Version/sequence | Fingerprint | Predecessor linkage | Replay necessity | Competing-authority risk |
|---|---|---|---|---|---|---|---|---|---|
| Organization Verification Record | A | Nested | Attempt Lifecycle Execution | recordId | record version | nested authentic lifecycle fingerprint | lifecycle history | Required as lifecycle baseline | A second standalone copy would compete |
| Organization Verification Revision | A | Nested | Attempt Lifecycle Execution | revisionId | revision sequence | nested authentic lifecycle fingerprint | record/revision binding | Required as submitted revision | A second standalone copy would compete |
| Organization Verification Attempt | A | Nested | Attempt Lifecycle Execution | attemptId | attempt sequence | nested authentic lifecycle fingerprint | revision/attempt binding | Required for process state | A second standalone copy would compete |
| Attempt Lifecycle Execution | A | Standalone | Lifecycle execution contract | lifecycleExecutionId | lifecycleExecutionVersion | attemptLifecycleExecutionFingerprint | prior lifecycle version | Required after each Attempt transition | Sole durable lifecycle authority |
| Attempt Lifecycle Transition Record | A | Nested | Attempt Lifecycle Execution transition history | transitionId | ordered transition history | nested authentic lifecycle fingerprint | predecessor/resulting Attempt state | Required through lifecycle history | Standalone duplication would compete |
| Attempt Lifecycle Transition Execution | C | Never | Lifecycle executions plus transition record | execution envelope identity | derived | runtime envelope fingerprint | predecessor/next lifecycle | Reconstructable | Persisting it would duplicate the transition |
| Evidence Snapshot | A | Standalone | Snapshot authority | evidenceSnapshotId | evidenceSnapshotVersion | snapshotFingerprint | bound lifecycle completion | Required for audit and projection | Sole snapshot authority |
| Evaluation Projection | A | Standalone | Projection authority | evaluationProjectionId | evaluationProjectionVersion | projectionFingerprint | source Snapshot | Required for exact fact surface | Sole projection authority |
| Policy Evaluation Input | A | Standalone | Evaluation Input authority | policyEvaluationInputId | policyEvaluationInputVersion | inputFingerprint | source Projection | Required for exact Policy input | Sole input authority |
| Policy Evaluation Execution | A | Standalone | Policy Runtime authority | executionId | executionContractVersion | executionFingerprint | Policy Evaluation Input | Required for findings/completion audit | Sole Policy execution authority |
| Decision–Trust Integration Execution | A | Standalone | Integration authority | executionId | executionContractVersion | executionFingerprint | Policy Runtime Execution | Required for Decision/Trust binding audit | Sole integration authority |
| Workflow Execution | B | Genesis only | Initial Workflow contract | workflowExecutionId | workflowExecutionVersion = 1 | workflowExecutionFingerprint | none | Establishes stream and lifecycle genesis | Later copies would compete with reconstruction |
| Workflow Step Record | A | Standalone | Workflow step contract | workflowStepId | nextWorkflowExecutionVersion | workflowStepBindingFingerprint | predecessor Workflow version | Required for coordination history | Sole durable Workflow-step authority |
| Workflow Step Execution | C | Never | Authority result plus step record | execution envelope identity | derived | workflowStepExecutionFingerprint | predecessor/next Workflow execution | Reconstructable | Persisting it would duplicate all constituents |
| Authority inputs and external provider references | D | Never | Provider or resulting authentic artifact | provider-owned | provider-owned | provider-owned | provider-owned | Not independently replayed here | Storage here would create unowned authority |

A = durable authoritative evidence. B = durable binding/index evidence. C = derived runtime envelope. D = non-persisted input/reference.

## Stream model

The only primary stream is `OrganizationVerificationWorkflowStream`.

Its authenticated identity binds:

- workflowExecutionId;
- organizationId;
- recordId;
- revisionId;
- attemptId;
- deterministic stream identity fingerprint.

Attempt lifecycle evidence remains in the Workflow stream. It does not require a nested persistence stream because lifecycle identity and lifecycle version remain explicit on every lifecycle artifact. Persistence stream version never replaces or reinterprets Record version, Revision sequence, Attempt sequence, lifecycle execution version, or Workflow execution version.

There is no mutable “current verification” aggregate.

## Closed evidence-kind vocabulary

The only durable evidence kinds are:

- `workflow_genesis`;
- `attempt_lifecycle_execution`;
- `evidence_snapshot`;
- `evaluation_projection`;
- `policy_evaluation_input`;
- `policy_runtime_execution`;
- `decision_trust_integration_execution`;
- `workflow_step_record`.

Each kind maps to exactly one existing authentic artifact type. Generic object, event, payload, document, unknown, and arbitrary-string kinds are prohibited.

## Persistence envelope

`OrganizationVerificationStoredEvidence` is an authenticated, immutable envelope. It binds:

- caller-supplied evidence entry ID;
- authentic stream identity;
- contiguous stream position;
- predecessor evidence entry ID;
- closed evidence kind;
- derived semantic artifact identity;
- derived artifact version or sequence;
- existing authentic artifact fingerprint;
- artifact occurrence timestamp;
- the authentic artifact value itself;
- explicit appendedAt;
- canonical provenance and integrity references;
- deterministic storage-envelope fingerprint.

Semantic identity, version, fingerprint, and occurrence time are derived only from the authentic artifact. A caller cannot substitute them. The contract does not serialize the artifact and does not define storage columns or transport DTOs.

## Append ordering and batches

An empty stream has persistence stream version `0`.

The genesis batch contains exactly one `workflow_genesis` entry at position `1`.

Every later Workflow step appends the minimum non-competing pair:

1. the durable authority result;
2. the corresponding `workflow_step_record`.

A batch may contain one or more complete pairs. It may not end between an authority result and its step record. A batch of `N` entries advances persistence stream version by exactly `N`.

Positions are explicit and contiguous. The first entry links to the caller’s exact expected head entry ID and every later entry links to the immediately prior entry in the batch. Ordering never relies on timestamps alone.

Loaded-stream validation additionally requires:

- genesis at position 1 and nowhere else;
- complete authority-result/step-record pairs;
- exact authority kind for the requested Workflow step;
- the authority fingerprint among the step record’s output fingerprints;
- contiguous Workflow predecessor and next versions;
- contiguous lifecycle versions for Attempt transitions;
- a stable lifecycle execution identity;
- unique evidence entry IDs;
- unique semantic kind/identity/version keys;
- non-regressing artifact and append chronology;
- recomputed persistence-envelope fingerprints.

Integrity validation does not invoke authorities and does not reconstruct business state.

## Expected-version concurrency

The caller supplies `expectedStreamVersion` on every append. A future adapter must compare it with the durable actual persistence stream version and fail closed on mismatch.

- empty stream: version 0;
- first one-entry append: version 1;
- an N-entry append: previous version + N;
- no last-write-wins;
- no hidden retry;
- no automatic re-read, merge, or reorder;
- no timestamp concurrency;
- no mapping to a Domain or Workflow version.

## Idempotency and conflicts

`appendId` and the deterministic append-batch fingerprint bind the exact stream identity, expected version, ordered evidence identities/fingerprints, explicit metadata, and explicit timestamp.

The semantic outcomes are:

- exact duplicate already committed: successful receipt with outcome `duplicate_append_idempotent` and `idempotentReplay: true`;
- same evidence identity with changed semantics: `evidence_identity_conflict`;
- same semantic identity/version with changed fingerprint: `evidence_fingerprint_conflict`;
- same expected version with a different competing batch: `expected_stream_version_conflict`;
- stale expected version after another append: `expected_stream_version_conflict`.

Only an exact duplicate is idempotent success. A future adapter detects it from durable evidence; this phase defines no mutable idempotency registry.

## Conflict vocabulary

The technology-neutral failure vocabulary is:

- `stream_not_found`;
- `expected_stream_version_conflict`;
- `evidence_identity_conflict`;
- `evidence_fingerprint_conflict`;
- `stream_identity_mismatch`;
- `invalid_evidence_order`;
- `unsupported_evidence_kind`;
- `unauthentic_evidence`;
- `malformed_append_metadata`;
- `stored_integrity_failure`.

`duplicate_append_idempotent` is deliberately a successful append outcome, not an error.

No SQL, connection, HTTP, timeout, retry-count, vendor, or authorization error is part of this vocabulary.

## Append receipt

`OrganizationVerificationEvidenceAppendReceipt` is independently authenticated and immutable. It binds:

- append ID and append-batch fingerprint;
- stream identity;
- expected and previous stream versions;
- resulting stream version;
- first and last appended positions;
- ordered evidence entry IDs, positions, and stored fingerprints;
- appended or exact-idempotent outcome;
- idempotent replay indicator;
- explicit appendedAt;
- provenance and integrity references;
- deterministic receipt fingerprint.

It is persistence evidence only. It does not imply Workflow completion, business approval, verification, Trust, Eligibility, publication, or authorization.

## Load result and integrity boundary

The load result is a closed immutable union:

- `not_found`, with the exact authentic stream identity;
- `found`, with an authenticated `OrganizationVerificationEvidenceStream`.

A found stream includes:

- authentic stream identity;
- persistence stream version;
- immutable ordered entries;
- head evidence reference;
- verified structural integrity summary;
- deterministic ordered stream fingerprint.

There is no ambiguous `null`. The contract does not interpret a found stream into current business state. Replay is a future phase.

## Repository ports

The boundary exposes two narrow capabilities:

- `appendOrganizationVerificationEvidence`;
- `loadOrganizationVerificationEvidenceStream`.

They are combined only as the type alias `OrganizationVerificationEvidenceRepositoryPort`. There are no save, update, delete, upsert, patch, arbitrary query, list-all, pagination, transaction, or infrastructure methods.

A separate head port is not justified: expected-version and expected-head semantics already travel with an append batch, and load returns an authenticated head reference.

Future adapters must:

- validate the authentic stream identity and append batch;
- verify request identity/version equals the batch identity/version;
- implement atomic expected-version comparison;
- preserve append-only ordering;
- return only the closed result vocabulary and authenticated receipt/load values;
- map vendor failures outside this semantic contract.

## Authenticity and deterministic fingerprints

Independent private runtime seals protect:

- Workflow stream identity;
- stored evidence;
- append batch;
- append receipt;
- loaded evidence stream.

Public guards return Boolean and reject plain objects, spread copies, `Object.assign` copies, frozen structural clones, JSON round trips, and `structuredClone` results. Seals, WeakSets, constructors that bypass validation, and canonical fingerprint helpers are not exported.

Persistence fingerprints:

- are SHA-256 over canonical values;
- sort object keys;
- canonicalize semantically unordered reference arrays before hashing;
- preserve stream sequence order;
- include every meaningful identity, position, version, timestamp, metadata reference, and upstream artifact fingerprint;
- use no randomness, environment, system clock, database-generated value, or infrastructure representation;
- never replace an existing Domain/Application artifact fingerprint.

## Architecture enforcement

Architecture tests prohibit persistence-contract imports from database/ORM, filesystem, network, provider, service, route, worker, queue, configuration, transaction, and infrastructure modules. They also prohibit:

- Domain or Workflow authority execution;
- Replay, Workflow Engine, Eligibility, and publication authority;
- hidden clocks, IDs, and environment inputs;
- SQL and repository/adapter/store implementations;
- public seals, authenticity registries, canonical fingerprint helpers, or result constructors;
- wiring outside the persistence-contract boundary before an explicitly authorized integration phase.

## Explicit exclusions

Phase 8C.0 does not implement persistence, replay, a Workflow Engine, corrections, compensation, cancellation, retries, database transactions, provider storage, or current-state interpretation. It makes no change to Organization Verification business semantics and begins no Phase 8C.1 work.
