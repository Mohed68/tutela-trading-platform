# Phase 8D.0.6 — Advance Idempotent Contract Amendment

## Status and accepted baseline

Accepted predecessor:
`38bb8bdde03f67ac32b4bd8ede88ff6679a94149`.

This is a contract-only correction. Phase 8D.1 application-service
orchestration remains deferred.

## Architectural conflict

The original `advance_idempotent` success shape reused the
`advance_completed` shape and therefore required an authentic
`OrganizationVerificationWorkflowStepExecution`.

That requirement conflicted with the frozen lower layers:

- Workflow Step Execution is a derived Runtime envelope;
- Persistence does not store it;
- Replay does not reconstruct it;
- its constructor is private to Workflow Runtime;
- reconstructing it would require rerunning Workflow Runtime and potentially
  the authority;
- rerunning either for an already committed duplicate is forbidden.

## Approved resolution

The two success outcomes now have distinct constructors and structurally
distinct result shapes.

### `advance_completed`

The fresh-completion result contains:

- authentic application execution;
- original persistence before/after versions;
- Workflow before/after versions;
- executed Workflow step;
- authentic Workflow Runtime authority result;
- authentic Workflow Step Record;
- authentic Workflow Step Execution;
- committed append receipt;
- resulting Workflow Execution;
- resulting Attempt Lifecycle Execution;
- terminal coordination indicator.

Its application execution fingerprint binds the Workflow Step Execution,
Replay execution identity and fingerprint, persistence stream, persisted
authority artifact, Workflow Step Record, append receipt, and resulting
Replay-reconstructed Workflow and Lifecycle evidence. Phase 8D.0.7 removed
the former Runtime-to-current-state reference coupling.

### `advance_idempotent`

The idempotent result contains:

- authentic application execution with explicit command identity;
- original persistence before/after versions;
- original Workflow before/after versions;
- requested Workflow step;
- authentic persisted authority artifact;
- authentic persisted Workflow Step Record;
- original `duplicate_append_idempotent` append receipt;
- authentic Replay execution;
- Replay-reconstructed current Workflow Execution;
- Replay-reconstructed current Attempt Lifecycle Execution;
- current terminal coordination indicator.

It contains no `workflowStepExecution` field and no fresh authority result.
The exact enumerable-key check rejects optional, nullable, synthetic, or
extra Runtime fields.

## Exact contract diff

Before:

```text
AdvanceSuccess
  + workflowStepExecution
  + authorityResult

advance_completed = AdvanceSuccess
advance_idempotent = AdvanceSuccess
```

After:

```text
AdvanceCompletedSuccess
  + workflowStepExecution
  + authorityResult

AdvanceIdempotentSuccess
  + persistedAuthorityResult
  + replayExecution
  - workflowStepExecution
  - authorityResult
```

The internal shared outcome-taking success factory was replaced by:

- `createAdvanceCompletedResultInternal`;
- `createAdvanceIdempotentResultInternal`.

Neither factory is public.

## Execution semantics

`advance_completed` means one Workflow Runtime step executed, one authority
executed through that Runtime step, one durable append committed, and a
successful application result was produced.

`advance_idempotent` means Persistence proved an exact duplicate append. For
the duplicate request:

- Workflow Runtime did not execute;
- no authority executed;
- no Workflow Step Execution was created;
- no authority artifact or Workflow Step Record was regenerated;
- the original durable artifact, record, and receipt were returned;
- current state came from the authentic Replay execution.

Idempotent success is successful retrieval of an existing commit, not a fresh
Runtime execution.

## Persistence and Replay compatibility

Persistence remains the sole owner of duplicate proof. The application
contract accepts idempotent success only when:

- the receipt outcome is `duplicate_append_idempotent`;
- the receipt explicitly marks idempotent replay;
- original authority and Workflow Step Record persistence positions match the
  authentic Replay binding;
- the persisted authority fingerprint and Workflow Step Record fingerprint
  match that binding;
- stream identity and original versions remain continuous;
- current Workflow and Lifecycle are the exact objects reconstructed by
  Replay.

Workflow Step Execution remains derived and non-persisted. Replay still does
not reconstruct it.

## Fingerprint and identity lineage

Application execution evidence now includes the exact application request
identity. For an advance command this is the command identity; append identity
remains owned by the authentic append receipt.

The idempotent application execution fingerprint is accepted only when its
canonical lower-layer fingerprint set binds:

- persisted authority artifact;
- Workflow Step Record;
- original append receipt;
- Replay execution;
- Replay source persistence stream;
- current Workflow Execution;
- current Attempt Lifecycle Execution.

It cannot bind a Workflow Step Execution. Property insertion order remains
irrelevant, while the lower-layer fingerprint collection must use its
deterministic canonical order.

The cross-layer conformance model records the fresh and idempotent lineages
separately. Both retain `persistence_contract` as duplicate-proof owner.

## Authenticity and immutability

Both amended results retain the private application-result authenticity seal.
Plain objects, spread copies, `Object.assign` copies, JSON round trips, and
`structuredClone` values cannot impersonate them.

All nested evidence is authentic and frozen. Mutating the caller-owned
top-level input after construction cannot change the result, and nested
durable or replayed state cannot be mutated.

## Excluded alternatives

The amendment does not:

- make Workflow Step Execution optional or nullable;
- persist Workflow Step Execution;
- reconstruct Workflow Step Execution in Replay;
- export a Runtime reconstruction factory;
- rerun Workflow Runtime or an authority for duplicates;
- synthesize Runtime envelopes;
- weaken Persistence duplicate proof;
- create a second current-state owner;
- add application orchestration, infrastructure, database access, or delivery
  behavior.

## Deferred work

Phase 8D.1 remains deferred. No start, advance, load, or replay-history use
case implementation was added in this phase.
