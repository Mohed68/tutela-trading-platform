# Phase 8D.0.8 — Replay Request and Execution Identity Ownership Amendment

## Status and baseline

Implemented from repository HEAD
`a6c6d0922ca92c60fb68efe5d59a53df0ca51b9d` while preserving the accepted
Organization Verification baseline
`9670b89632e643ec37378ee8a0ebcc70a651f540` and every later unrelated commit.

This is a contract amendment only. Phase 8D.1 Application Service
orchestration remains unimplemented.

## Resolved conflict

The previous Replay Request used `replayExecutionId` as both request metadata
and execution identity. Cross-Layer Conformance assigned that identity to
Replay Runtime even though the caller supplied it. Start supplied no Replay
metadata, while Advance required two Replay executions but supplied none.

The amendment separates caller-owned request and execution metadata from the
authentic execution evidence constructed by Replay Runtime.

## Replay Request model

An `OrganizationVerificationReplayRequest` now has an explicit
`replayRequestId` and deterministic `replayRequestFingerprint`.

- The Application Service contract owns the identity and validation contract.
- The Application Service caller supplies the exact identity.
- The identity is distinct from `replayExecutionId` and from Application,
  command/query, append, Workflow, and evidence identities.
- The request is transient and is not persisted.
- Replay Runtime alone authenticates and seals the request.
- The request fingerprint binds the request ID, proposed execution ID, exact
  stream identity/version/fingerprint, explicit Replay time, provenance, and
  integrity references.

## Replay Execution model

`replayExecutionId` is explicit caller-supplied execution metadata governed by
the Application Service contract. Replay Runtime does not generate or derive
it. Replay Runtime remains the sole construction authority for authentic
`OrganizationVerificationReplayExecution` evidence and binds:

- Replay Request identity and fingerprint;
- Replay Execution identity;
- exact consumed persistence stream;
- reconstructed Workflow and Lifecycle state;
- ordered evidence bindings and diagnostics;
- explicit Replay time and references.

Thus metadata allocation and execution-evidence construction are separate.
No caller can construct an authentic Replay Execution.

## Replay time

`replayedAt` is supplied explicitly by the Application Service caller and
validated by the Application Service and Replay Request contracts. Replay
Runtime copies and fingerprints it. No clock, environment lookup, suffix,
random generator, or hidden identity authority exists.

## Start canonical sequence

The canonical Start sequence is:

```text
Guard
  -> Append Workflow Genesis
  -> Reload exact committed stream
  -> Authoritative Replay
  -> Result
```

Start supplies one `authoritativeReplay` metadata value. Both
`start_completed` and `start_idempotent` return current Workflow and Lifecycle
state only from that Replay. The committed genesis remains durable append
evidence; it is not used as a competing current-state object.

## Advance canonical sequence

The canonical Advance sequence remains:

```text
Guard
  -> Load
  -> Pre-execution Replay
  -> exactly one Workflow Runtime step
  -> Append
  -> Reload
  -> Authoritative Replay
  -> Result
```

Advance supplies distinct `preExecutionReplay` and `authoritativeReplay`
metadata. Their Replay Request IDs and Replay Execution IDs must all be
different. No identity is derived from a command, application execution,
append, or Workflow step identity.

## Duplicate behavior

Phase 8D.0.6 remains unchanged. Exact duplicate Advance:

- does not rerun Workflow Runtime;
- does not rerun an authority;
- produces no fresh Workflow Step Execution;
- relies on durable evidence and Persistence duplicate proof;
- reloads and Replays authoritative committed state.

Workflow Step Execution remains transient, is not persisted, and is not
reconstructed by Replay.

## Chronology

All timestamps are explicit and non-decreasing.

Start requires:

```text
requestedAt <= workflowCreatedAt <= appendedAt
            <= authoritativeReplay.replayedAt <= applicationCompletedAt
```

Advance requires:

```text
requestedAt <= preExecutionReplay.replayedAt <= occurredAt <= appendedAt
            <= authoritativeReplay.replayedAt <= applicationCompletedAt
```

Replay-backed queries require:

```text
requestedAt <= replayedAt <= applicationCompletedAt
```

Impossible ordering fails closed during authentic Application Request
construction.

## Fingerprint and ownership lineage

Cross-Layer Conformance now records:

- `replay_request_id`: owned by the Application Service contract and supplied
  by the Application Service caller;
- `replay_execution_id`: governed by the Application Service metadata
  contract and supplied by the caller;
- `replay_request_fingerprint`: constructed by Replay Runtime;
- `replay_fingerprint`: constructed by Replay Runtime and transitively bound
  to the request fingerprint and persistence stream;
- authentic current Workflow and Lifecycle state: owned only by Replay
  reconstruction;
- authentic Replay Execution evidence: constructed only by Replay Runtime.

Application command fingerprints bind their exact Replay metadata. Start
success fingerprints additionally bind the authoritative Replay Request,
Replay Execution, persistence stream, append receipt, Workflow, and Lifecycle
evidence.

## Explicitly unchanged

This amendment does not implement or change:

- Application Service orchestration;
- Workflow Runtime or authority behavior;
- Persistence or duplicate semantics;
- Replay reconstruction semantics;
- PostgreSQL, Neon, schemas, migrations, routes, UI, registration, Render, or
  deployment behavior;
- business rules, automatic progression, or multi-step execution.

