# Phase 7B-6B — Pure Decision–Trust Integration

## Status

Implemented as a pure, deterministic, fail-closed domain integration on the
accepted predecessor `2f65e38041ce546a3d34e4f20c2f943a6303fd63`.

This phase does not wire the capability into workflow, persistence, database,
API, startup, providers, workers, queues, eligibility, or marketplace
authorization.

## Execution boundary

The public execution authority is:

`executeOrganizationVerificationDecisionTrustIntegration(...)`

It accepts only:

- an authentic `OrganizationVerificationPolicyEvaluationExecution`;
- explicit Decision construction artifacts required by the frozen Decision
  Domain;
- explicit Trust source-fact and derivation artifacts required by the frozen
  Trust Status Domain;
- the approved Phase 7B-6B.0 input-binding and Decision–Trust binding
  artifacts;
- explicit integration execution identity, contract version, timestamps,
  provenance, integrity reference, and optional expected fingerprint;
- an optional authentic existing integration execution for idempotency and
  conflict detection.

It does not read environment state, system time, random sources, repositories,
registries, databases, or runtime infrastructure.

## Authorized execution flow

1. Authenticate the supplied Policy Runtime execution.
2. Validate explicit integration execution artifacts and initial chronology.
3. Create the approved input binding, proving the complete upstream identity
   chain.
4. Obtain the Policy Evaluation Completion only from the authenticated Runtime
   execution.
5. Pass that Completion through the existing frozen normalized adapter without
   modification.
6. Invoke the existing frozen Decision authority.
7. Authenticate the returned Decision.
8. Pass only that authentic Decision and explicit Trust artifacts into the
   isolated Decision-to-Trust boundary.
9. Let the frozen Trust Status Domain construct source facts and invoke its
   existing Deriver.
10. Authenticate the returned Trust Status.
11. Create the approved Phase 7B-6B.0 immutable binding envelope.
12. Validate end-to-end chronology.
13. Calculate a deterministic integration evidence fingerprint.
14. enforce idempotency and fail closed on duplicate or conflicting execution.
15. return a sealed, deeply immutable integration execution.

The integration never interprets Findings, Rule Results, severity, or raw
evaluation facts. It creates neither Decision nor Trust objects directly.

## Integration execution model

`OrganizationVerificationDecisionTrustIntegrationExecution` contains:

- explicit execution ID and exact contract version;
- the authentic immutable upstream input binding;
- the authentic immutable Decision;
- the authentic immutable Trust Status;
- the authentic immutable Decision–Trust binding envelope;
- explicit start and completion timestamps;
- explicit provenance and integrity references;
- a deterministic integration execution fingerprint.

The model has a private runtime authenticity seal. Its public Boolean guard
accepts authentic frozen executions and rejects plain objects, structural
clones, and object-spread copies. Neither the seal nor the internal constructor
is exported.

## Identity continuity

The approved binding contracts prove continuity across:

- Organization ID;
- Verification Record and Revision;
- Attempt;
- Snapshot ID and fingerprint;
- Evaluation Input ID, version, and fingerprint;
- Policy Set ID and version;
- Policy Runtime execution ID, contract version, executor version, and
  fingerprint;
- Policy Evaluation Completion ID and integration evidence fingerprint;
- Decision ID, engine version, and integration evidence fingerprint;
- Trust Status projection ID, version, and integration evidence fingerprint.

All integration-level fingerprints are evidence fingerprints. They do not
claim to be native fingerprints owned by Policy, Decision, or Trust models.

## Chronology

All timestamps are caller-supplied and validated. The required order is:

1. Policy Runtime execution completion;
2. integration execution start;
3. input binding;
4. Decision time;
5. Decision binding;
6. Trust derivation-as-of time;
7. Trust derived time;
8. Trust binding;
9. integration execution completion.

Invalid timestamps or ordering fail closed. Equal adjacent timestamps are
permitted by the existing contracts; no system clock is consulted.

## Determinism and idempotency

The integration fingerprint uses canonical, recursively sorted object keys and
SHA-256. Caller property order does not affect the result. The fingerprint
binds the execution identity and version, upstream runtime identity and
fingerprint, Evaluation Input identity and fingerprint, all three approved
binding fingerprints, the authentic Decision and Trust Status, timestamps,
provenance, and integrity reference.

An identical retry with the same authentic existing execution returns that
execution. The same execution ID with different evidence is a conflict. A
different execution ID supplied as an existing semantic execution is rejected
as a duplicate. An explicit expected fingerprint mismatch fails closed.

## Failure boundaries

Failures retain their owning stage:

- `execution`;
- `normalized_adapter`;
- `decision`;
- `trust_source_facts`;
- `trust_derivation`;
- `binding`.

This preserves frozen Policy, Decision, Trust, and binding semantics and avoids
reinterpreting their business results.

## Architecture enforcement

Static architecture tests enforce:

- curated imports only;
- no database, persistence, provider, workflow, API, frontend, startup,
  marketplace, eligibility, or infrastructure dependency;
- no direct Finding, Rule Result, or Rule Execution consumption;
- no environment, hidden clock, randomness, or hidden ID generation;
- no unsafe opaque-type double assertion;
- no direct Decision or Trust constructor access;
- normalized adaptation and Decision sequencing only in the integration
  executor;
- Trust construction and derivation only inside the isolated Decision-to-Trust
  boundary;
- no Completion, Policy, Finding, Rule Result, Snapshot, or Projection access
  from that Trust boundary;
- narrow public exports and private seals, constructors, canonicalization, and
  helper functions;
- no external runtime wiring of this pure capability.

## Tests

The focused suite covers successful execution, complete identity and chronology
continuity, frozen authority usage, authenticity rejection, fail-closed
mismatches, deterministic fingerprints, caller-order independence, immutable
outputs, spread-copy rejection, idempotency, conflict handling, and exact
public exports.

The architecture suite includes intentional violation fixtures for every new
dependency and authority boundary.

## Explicit non-capabilities

Phase 7B-6B produces no Eligibility or permission result. It performs no
Workflow or Attempt transition and has no persistence, database, transaction,
provider, registry lookup, API, controller, route, startup, worker, queue,
notification, schedule, or frontend behavior.

Workflow, Attempt Lifecycle, persistence, and runtime wiring require separate
explicit authorization.
