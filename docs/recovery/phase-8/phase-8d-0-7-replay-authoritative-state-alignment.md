# Phase 8D.0.7 — Replay Authoritative State Alignment

## Status and accepted baseline

Accepted predecessor:
`ab282dce0aa9576e8b1df874f9f862ce4a42639b`.

This phase amends the completed-result contract only. Phase 8D.1
application-service orchestration remains deferred.

## Architectural issue

The former `advance_completed` constructor required object-reference identity
between:

```text
WorkflowStepExecution.nextWorkflowExecution
```

and:

```text
currentWorkflowExecution
```

That made the transient Workflow Runtime object appear authoritative and made
the valid post-append Reload and Replay object unacceptable.

The authoritative state path is:

```text
Persistence append
  -> Reload
  -> Replay
  -> current Workflow and Lifecycle
```

Runtime output is execution evidence only.

## Amended completed-result shape

`advance_completed` retains:

- authentic application execution;
- exact persistence and Workflow version transition;
- requested Workflow step;
- authentic Runtime authority result;
- authentic Workflow Step Record;
- authentic Workflow Step Execution;
- authentic append receipt;
- current Workflow and Lifecycle;
- terminal coordination indicator.

It now also requires:

- authentic `OrganizationVerificationReplayExecution`.

The result's `currentWorkflowExecution` and
`currentLifecycleExecution` represent the state reconstructed by that Replay.
`workflowStepExecution` remains the evidence that one fresh Runtime step
executed.

## Semantic alignment

Runtime and Replay Workflow objects are allowed and expected to be different
instances. Alignment is validated through:

- Workflow execution ID;
- Workflow version;
- Workflow stage;
- Organization, Record, Revision, and Attempt identity;
- Workflow fingerprint;
- Lifecycle execution ID and version;
- Lifecycle fingerprint.

The constructor also validates:

- Replay stream identity against the append receipt;
- Replay persistence version against the committed resulting version;
- Replay authority binding against the persisted authority fingerprint;
- Replay Workflow Step Record binding against the step-record fingerprint;
- append receipt persistence positions against Replay bindings;
- the exact two-entry one-step append shape.

No Runtime-to-Replay object-reference comparison remains.

## Runtime and Replay responsibilities

`OrganizationVerificationWorkflowStepExecution` proves:

- one fresh Workflow Runtime invocation;
- the authority result produced during that invocation;
- the Workflow Step Record produced by Runtime;
- the transient expected resulting Workflow semantics.

`OrganizationVerificationReplayExecution` proves:

- the append is represented in the persisted stream;
- the persisted authority and Workflow Step Record are bound;
- the complete stream was reconstructed;
- the returned current Workflow and Lifecycle represent committed state.

Neither artifact replaces the other.

## Application execution evidence

The canonical lower-layer binding for `advance_completed` now includes:

- request fingerprint through Application Execution;
- Workflow Step Execution fingerprint;
- Replay execution identity;
- Replay fingerprint;
- persistence-stream fingerprint;
- append-receipt fingerprint;
- persisted authority-artifact fingerprint;
- Workflow Step Record fingerprint;
- authoritative current Workflow fingerprint;
- authoritative current Lifecycle fingerprint;
- exact persistence and Workflow version transition;
- `advance_completed` outcome.

The lower-layer collection remains unique and canonically ordered.

## Rejected mismatches

The completed-result constructor fails closed when:

- Replay execution is absent or unauthentic;
- Runtime and Replay differ semantically;
- Replay fingerprint or execution identity is not bound;
- persistence-stream fingerprint is not bound;
- Replay stream identity differs from the receipt;
- Replay persistence version differs from the committed version;
- authority or Workflow Step Record binding differs;
- append positions differ;
- returned current state differs semantically from Replay.

## Unchanged lower layers

This amendment does not change:

- Replay reconstruction or public semantics;
- Workflow Runtime;
- Workflow Step Execution;
- Workflow Step Record;
- authority artifacts;
- Persistence or evidence classification;
- append receipts;
- idempotency;
- database or infrastructure behavior.

Workflow Step Execution remains non-persisted and Replay does not reconstruct
it.

## Deferred work

Phase 8D.1 remains deferred. No application-service orchestration, database,
API, transaction, Unit of Work, or delivery behavior is included.
