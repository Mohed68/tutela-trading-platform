# Phase 8A.0 — Attempt Lifecycle Execution Contract

## Status

Implemented from accepted baseline
`620cb5cb2cf192556df9322ac76aa7c64ac06633` as pure, immutable application
evidence contracts. No Attempt transition is executed by this package.

## Frozen Domain authority

The Attempt Domain remains the sole owner of the unchanged matrix:

```text
not_started → queued
queued → running
running → queued
running → completed
```

The application contract validates evidence against this matrix. It neither
imports nor invokes `transitionAttemptProcess`, constructs Attempts, nor
mutates state.

## Lifecycle execution envelope

`OrganizationVerificationAttemptLifecycleExecution` binds explicit execution
identity and version, the authentic Organization–Record–Revision–Attempt
chain, immutable ordered transition evidence, mechanical timestamps,
canonical provenance and integrity references, and an application-scoped
SHA-256 fingerprint.

The initial envelope version is `1`. With N unique transition records the
envelope version is exactly `1 + N`. This is exclusively an application
execution version and is unrelated to Attempt sequence.

## Authentic continuity

Creation requires the approved guards for authentic Record, Revision, and
Attempt values. It proves:

- supplied Organization equals the authentic Record organization;
- Revision and Attempt bind the authentic Record;
- Attempt binds the authentic Revision;
- supplied Record, Revision, Attempt, and sequence identities match;
- the authentic Record contains the exact Revision and Attempt references.

Structural clones and copied values fail closed.

## Transition record

`OrganizationVerificationAttemptLifecycleTransitionRecord` records execution
evidence only: transition and execution identities, predecessor/next envelope
versions, Attempt identity, predecessor/requested/resulting states, timestamp,
canonical provenance and integrity references, optional correlation,
causation, and reason references, and an application-scoped binding
fingerprint.

The optional reason reference is preserved without interpretation.

## Chronology

Only mechanical ordering is enforced:

- parseable execution and transition timestamps;
- first transition not before execution creation;
- non-decreasing subsequent timestamps;
- `lastTransitionAt` equals the final transition timestamp;
- it is absent for empty history;
- the final record matches the bound Attempt state and its corresponding
  Domain-produced timestamp.

No current time, duration, expiry, timeout, or lease policy is consulted.

## Idempotency and conflicts

Canonical transition identity includes every explicit semantic field. Equal
transition IDs with equal fingerprints are idempotent. Equal IDs with
different semantics fail closed. Different IDs consuming the same predecessor
execution version are branch conflicts. Execution history deduplicates only
identical semantic records and enforces exact version and state continuity.

No registry, cache, persistence, or current/latest resolution exists.

## Fingerprints and immutability

Canonicalization recursively sorts object keys. Provenance and integrity
collections are validated, deduplicated by rejection, sorted, copied, and
frozen. Caller ordering and object property insertion order do not change
fingerprints; semantic changes do.

Execution and transition values have independent private seals and private
runtime identity registries. Public guards reject plain objects, frozen
clones, spread and `Object.assign` copies, JSON round trips, and
`structuredClone` results. Seals, constructors, canonicalization, and stamping
helpers remain private.

## Deferred work

Explicitly excluded are transition orchestration, Workflow, persistence,
database, API, providers, startup, environment access, failure, cancellation,
retry, lease, restart, timeout, scheduling, Snapshot, Evaluation, Policy,
Decision, Trust, and Eligibility behavior.
