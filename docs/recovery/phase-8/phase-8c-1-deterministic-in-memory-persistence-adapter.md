# Phase 8C.1 — Deterministic In-Memory Persistence Adapter

## Accepted baseline

- Branch: `architecture/phase-7a-organization-trust`
- Accepted predecessor: `5af9e84eb75b6fb03f134fc3ce2dc907d1f29e45`
- Scope: one deterministic in-memory reference adapter for the frozen Phase 8C.0 Organization Verification persistence ports

Phase 8C.1 does not change any Domain, Attempt Lifecycle, Workflow, Runtime, or persistence-contract semantics.

## Adapter role

The adapter is a reference infrastructure implementation:

```text
Organization Verification Application
        ↓
Frozen Persistence Ports
        ↓
Deterministic In-Memory Reference Adapter
```

The adapter proves persistence behavior. It is not application wiring, a production database adapter, a Workflow Engine, or a Replay Engine.

The factory is:

```ts
createInMemoryOrganizationVerificationEvidenceRepository():
  OrganizationVerificationEvidenceRepositoryPort
```

Every invocation creates isolated closure-owned state. The returned frozen object implements only:

- `appendOrganizationVerificationEvidence(request)`
- `loadOrganizationVerificationEvidenceStream(request)`

There is no singleton, module-level mutable repository, reset hook, seed hook, delete operation, generic repository API, or exported inspection capability.

## Internal storage model

The private state consists conceptually of:

- a map from canonical stream key to the latest authentic immutable evidence stream;
- a map from append ID to the exact committed batch fingerprint and authentic original receipt.

Both maps are inaccessible outside the factory closure. Each accepted append creates copied candidate maps and replaces the single closure state reference only after all validation succeeds. The adapter never exposes either map, mutable evidence arrays, or mutation methods.

Authentic contract values are already sealed and immutable. The adapter stores only those authentic values and creates a new authentic stream through the frozen stream factory. It never stores an unauthenticated caller object and never authenticates a structural copy.

## Canonical stream key

The private key uses all five frozen identity components in this exact order:

1. Workflow Execution ID
2. Organization ID
3. Record ID
4. Revision ID
5. Attempt ID

Every component is length-prefixed before joining. This avoids ambiguous concatenation and delimiter collision. The key is only an internal lookup mechanism; the authentic `OrganizationVerificationWorkflowStreamIdentity` remains the stream identity and is revalidated on load.

## Append algorithm

The append operation:

1. validates the frozen request, authentic stream identity, authentic batch, exact request-to-batch identity, and expected-version binding;
2. checks the private committed-append index for exact idempotency or append-identity conflict;
3. loads the current exact stream and determines storage version, where an absent stream is version `0`;
4. compares the actual and explicit expected persistence stream versions;
5. verifies the explicit expected head for an existing stream;
6. classifies evidence conflicts using the frozen Phase 8C.0 conflict classifier;
7. builds an isolated candidate entry sequence without reordering caller input;
8. creates and validates the complete authentic candidate stream through the frozen stream-integrity validator;
9. creates the authentic append receipt using the frozen receipt factory;
10. builds copied candidate maps;
11. commits once by replacing the private state reference;
12. returns the frozen append result.

No partial entry, append identity, receipt, stream version, or head is recorded before the complete candidate succeeds.

## Genesis rules

The frozen append-batch contract and complete-stream validator enforce:

- an absent stream has actual version `0`;
- the first accepted batch expects version `0`;
- the first and only genesis-batch entry is `workflow_genesis`;
- the first position is `1`;
- genesis has no predecessor;
- genesis identity exactly matches Workflow, Organization, Record, Revision, and Attempt;
- a non-genesis first append fails closed;
- a different second genesis fails closed;
- an exact replay of the already committed genesis append is idempotent success, not a second genesis.

The adapter never creates or repairs genesis automatically.

## Normal append ordering

After genesis, the frozen batch contract requires complete authority-result and Workflow Step Record pairs. The adapter preserves caller order and relies on the complete-stream validator to verify:

- contiguous persistence positions;
- exact predecessor links;
- nondecreasing explicit artifact and append chronology;
- authority result before its Workflow Step Record;
- exact authority-result fingerprint binding;
- exact Workflow Execution version progression;
- exact Attempt Lifecycle identity and version progression;
- no second genesis;
- no incomplete pair.

The adapter never reorders, filters, repairs, or synthesizes evidence.

## Expected-stream-version behavior

Persistence stream version is storage ordering only:

- absent stream: version `0`;
- a successful append of `N` entries: version increases by `N`;
- positions are contiguous and equal the resulting storage ordering;
- stale and future expected versions return `expected_stream_version_conflict`;
- a different competing append from an already consumed version returns `expected_stream_version_conflict`;
- there is no last-write-wins, automatic merge, retry, reload-and-reapply, or hidden comparison against Workflow, lifecycle, or timestamp versions.

## Exact idempotency

The committed append index binds:

- append ID;
- canonical stream key;
- deterministic append-batch fingerprint;
- authentic original append receipt.

The batch fingerprint already binds the exact stream, expected version, expected head, ordered evidence fingerprints, append timestamp, provenance, and integrity references.

An exact duplicate:

- is detected before the current-version check, so it remains idempotent after later appends;
- returns top-level outcome `duplicate_append_idempotent`;
- reuses the authentic original committed receipt;
- does not append evidence;
- does not advance version;
- does not change head;
- returns the same positions and receipt fingerprint.

The receipt represents the original durable commit. The top-level port outcome describes the current duplicate invocation. This preserves both the frozen receipt contract and the Phase 8C.1 requirement that duplicate invocation classification not create a new receipt with different semantics.

A matching append ID with a different batch fingerprint is `evidence_identity_conflict`. A different append ID trying to consume an already consumed version is `expected_stream_version_conflict`. Evidence conflicts at the current expected version continue to use the frozen Phase 8C.0 classifier:

- reused evidence-entry identity with changed semantics: `evidence_identity_conflict`;
- reused semantic artifact identity/version with a changed artifact fingerprint: `evidence_fingerprint_conflict`;
- exact evidence replay outside the exact committed append: `evidence_identity_conflict`;
- cross-stream evidence: `stream_identity_mismatch`.

No stale unrelated append is treated as idempotent.

## Load behavior

An unknown authentic exact identity returns:

```ts
{ status: "not_found", streamIdentity }
```

An existing stream is not returned directly from internal state. The adapter:

1. locates the stream by the private canonical key;
2. verifies exact authentic stream identity;
3. recreates the complete stream through the frozen stream factory;
4. thereby reruns complete stream-integrity validation;
5. returns an authentic immutable `found` result containing exact identity, version, ordered evidence, head, integrity summary, and deterministic stream fingerprint.

Load never returns `null`, `undefined`, or a fabricated empty found stream. It does not replay Workflow state, call a Domain authority, filter malformed entries, or repair a stream. Inaccessible internal corruption would fail closed as `stored_integrity_failure`; no public mutation path can create that corruption.

## Immutability and determinism

The implementation uses:

- authentic sealed input guards;
- frozen request results and repository surface;
- frozen copied stream entry arrays;
- authentic stream and receipt factories;
- explicit caller-supplied IDs and timestamps;
- deterministic frozen fingerprints;
- normalized provenance and integrity references;
- a candidate-then-commit state replacement.

There is no `Date.now`, zero-argument `new Date`, randomness, environment input, process identity, hidden ID, hidden timestamp, or insertion-order-dependent object hashing.

For identical operation sequences on fresh adapters, append outcomes, receipt fingerprints, positions, stream versions, head references, stream fingerprints, and conflict classifications are semantically identical.

Caller attempts to mutate batches, reference arrays, loaded arrays, nested evidence, stream identity, integrity summaries, or head references fail or cannot affect a later load. One adapter instance cannot observe or mutate another instance.

## Conformance suite

`persistenceAdapterConformance.test.ts` exports:

```ts
runOrganizationVerificationPersistenceAdapterConformance(
  label,
  createAdapter,
): void
```

It tests only the frozen persistence-port behavior and authentic public persistence values. It does not inspect the private maps or depend on synchronous map access, database rows, SQL, transaction classes, or infrastructure-specific error classes. A future adapter can invoke the same suite with its own factory.

The focused in-memory tests additionally verify:

- the exact two-method repository surface;
- a single public factory export;
- frozen repository objects;
- isolated factory instances;
- no shared singleton state.

## Architecture boundaries

Architecture enforcement permits the in-memory adapter to consume only the frozen public persistence contract. It rejects:

- database, ORM, SQL, schema, migration, filesystem, network, provider, worker, queue, API, startup, and environment dependencies;
- hidden time, randomness, and unsafe opaque conversion;
- Domain authority execution;
- Workflow execution or automatic progression;
- Replay, retries, locks, Unit of Work, and transaction-manager abstractions;
- public export of maps, committed-append indexes, reset/seed/mutation hooks, canonical keys, or internal errors;
- imports of this adapter by Domain, Workflow, Runtime, application API, or startup code.

The application contracts do not depend on this infrastructure adapter.

## Explicitly deferred and excluded

Phase 8C.1 does not implement or authorize:

- Workflow Replay or Workflow reconstruction;
- current-state projection;
- execute-until-complete or automatic Workflow progression;
- PostgreSQL, Neon, Drizzle, SQL, schemas, or migrations;
- database transactions, Unit of Work, distributed coordination, locking, or optimistic retry;
- filesystem, Redis, cache, TTL, compaction, pagination, or external storage;
- API, routes, controllers, frontend, startup wiring, dependency injection, workers, queues, or schedulers;
- providers, notifications, permissions, Eligibility, authorization, marketplace behavior, or user-verification flags;
- changes to Record, Revision, Attempt, lifecycle, Snapshot, Projection, Evaluation Input, Policy Runtime, Decision, Trust, Decision–Trust Integration, Workflow, evidence classification, evidence kinds, fingerprints, authenticity guards, or conflict vocabulary.
