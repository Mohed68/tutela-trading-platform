# Phase 8A — Pure Attempt Lifecycle Runtime

## Responsibility

From baseline `083c6ee387ce1b217434d3e37962f10c661614d3`,
the runtime executes exactly one explicit, already authorized Attempt
transition. It authenticates the predecessor lifecycle execution, invokes the
frozen `transitionAttemptProcess` authority once, authenticates the resulting
Attempt, and binds the result through the approved transition-record and
lifecycle-execution factories.

It contains no transition matrix or alternative Attempt construction.

## Input and authority path

Every identity, predecessor and next lifecycle execution version, expected
state, requested transition, timestamp, provenance, integrity reference,
optional correlation/causation/reason reference, and completion reference is
caller supplied.

```text
Authentic predecessor lifecycle execution
→ frozen Domain transitionAttemptProcess
→ authentic resulting Attempt
→ authenticated transition record
→ authenticated next lifecycle execution
→ authenticated runtime evidence result
```

## Output

`OrganizationVerificationAttemptLifecycleTransitionExecution` contains the
predecessor and resulting authentic Attempts, authenticated transition record,
authenticated next lifecycle execution, explicit identities and versions,
occurred-at timestamp, and a deterministic runtime-scoped fingerprint. Its
private seal and runtime identity protection reject structural copies.

## Continuity and versioning

Record, Revision, Attempt identity, Attempt sequence, predecessor state,
resulting state, execution identity, and explicit predecessor version are
validated. The next lifecycle execution version is exactly predecessor + 1.
Attempt sequence remains unchanged and is never treated as a version.

## Chronology and completion

Only the explicit timestamp is used. It must be parseable and non-decreasing
from execution creation and the prior transition. Equal timestamps remain
allowed. Completion requires an explicit completion reference, passes it
unchanged to the Domain, and verifies it on the authentic result. Other
transitions reject a supplied completion reference through the unchanged
Domain authority.

## Idempotency, conflicts, and fingerprint

Pure deterministic execution makes identical semantic commands yield equal
Attempt semantics and equal transition, next-execution, and runtime
fingerprints. Existing contract factories reject conflicting transition
identity, history branches, malformed evidence, and version discontinuity.
There is no cache, registry, persistence lookup, randomness, environment
input, hidden salt, or system clock.

## Boundaries

The runtime does not implement multi-step progression, Workflow, Attempt
creation, Snapshot, Projection, Evaluation, Policy, Decision, Trust,
Eligibility, failure, cancellation, retry, lease, restart, timeout,
persistence, database, API, providers, workers, queues, startup, or
notifications. Phase 8B remains deferred.
