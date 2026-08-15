# Phase 8D.1 — Organization Verification Application Service

## Status

Implemented from accepted Phase 8D.0.8 commit
`992f9a47bbc182efd2e4eb7f00e046613e87d0f9`.

This phase implements application orchestration only. It adds no PostgreSQL,
Neon, HTTP, controller, route, frontend, schema, migration, registration,
deployment, eligibility, publication, payment, blockchain, or AI behavior.

## Public boundary

The public runtime surface exports only:

```ts
createOrganizationVerificationApplicationService(dependencies)
```

Each factory call returns a new frozen service exposing exactly:

- `startOrganizationVerification`;
- `advanceOrganizationVerificationWorkflow`;
- `loadOrganizationVerificationState`;
- `replayOrganizationVerificationHistory`.

The service has no singleton, global mutable state, clock, ID generator,
environment lookup, registry, retry loop, transaction manager, or
infrastructure dependency.

## Start orchestration

The implemented sequence is:

```text
Guard
  -> construct authentic Workflow genesis
  -> construct one-entry persistence batch
  -> append exactly once
  -> reload committed stream
  -> authoritative Replay
  -> authentic Application result
```

The result's current Workflow and Lifecycle objects are taken only from the
Replay Execution. The transient genesis constructor output is retained only
as committed-genesis evidence.

Exact duplicate Start is proven by the Persistence port's duplicate outcome.
Every competing existing-stream append fails closed as
`start_persistence_conflict`.

## Advance orchestration

The fresh sequence is:

```text
Guard
  -> load
  -> pre-execution Replay
  -> validate stream, Workflow identity, version, and stage
  -> execute exactly one Workflow Runtime step
  -> persist only authority artifact + Workflow Step Record
  -> append exactly once
  -> reload
  -> authoritative Replay
  -> semantic Runtime–Replay alignment
  -> authentic Application result
```

Workflow Step Execution remains transient. It is neither stored nor
reconstructed by Replay. Current Workflow and Lifecycle state always comes
from the authoritative post-append Replay.

## Duplicate Advance

After load and pre-execution Replay, the service inspects authentic durable
evidence for the exact Workflow Step identity. Matching step metadata and the
original authority/record evidence are used to reconstruct the exact frozen
append batch. Persistence then remains the final duplicate authority by
returning `duplicate_append_idempotent`.

Only after that proof, the service derives the frozen duplicate-operation
receipt through the existing pure Persistence receipt factory. This is an
interpretation of the port outcome; it does not change stored state or replace
Persistence as duplicate authority.

The duplicate path:

- invokes Workflow Runtime zero times;
- invokes business Authority zero times;
- creates no Workflow Step Execution;
- performs one duplicate-proof append call and no new durable write;
- reloads and Replays current authoritative state;
- returns `advance_idempotent` with original durable authority evidence and
  Workflow Step Record.

Changed step metadata under an already committed Workflow Step ID is rejected
as `application_idempotency_conflict` before Runtime.

## Queries

Both read operations implement:

```text
Guard -> load -> Replay -> result
```

Queries perform no append, Workflow Runtime call, Authority call, repair, or
state mutation. Not-found streams return the frozen not-found result without
Replay.

## Failure behavior

The implementation uses the frozen failure mappings for Persistence, Replay,
and Workflow Runtime. It additionally maps orchestration boundary failures
for:

- unauthentic requests;
- Start genesis and persistence conflicts;
- missing streams;
- stale persistence and Workflow versions;
- stage and completed-Workflow conflicts;
- dependency rejection or malformed authentic output;
- post-append reload failure;
- Replay request, execution, identity, or fingerprint mismatch;
- Runtime–Replay semantic mismatch.

All failures are fail-closed. No automatic retry, progression, repair, or
identity substitution is performed.

## Call-count guarantees

| Operation | Load | Replay | Workflow Runtime | Authority | Append call |
| --- | ---: | ---: | ---: | ---: | ---: |
| Start completed/idempotent | 1 | 1 | 0 | 0 | 1 |
| Advance fresh | 2 | 2 | 1 | 1 | 1 |
| Advance duplicate | 2 | 2 | 0 | 0 | 1 duplicate proof |
| State/history found | 1 | 1 | 0 | 0 | 0 |
| State/history not found | 1 | 0 | 0 | 0 | 0 |

The one Runtime call owns exactly one frozen authority dispatch according to
the Workflow Runtime authority matrix.

## Deferred work

PostgreSQL persistence, Neon integration, delivery/API wiring, controllers,
frontend integration, Participation Eligibility, marketplace publication,
and all later capabilities remain unimplemented.
