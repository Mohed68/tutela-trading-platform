# Phase 8D.0 — Organization Verification Application Service Contracts

## Status and accepted baseline

Accepted predecessor:
`3039e762d357159aaac8891988b406c67511b2e3`.

This phase defines contracts only. It introduces no application-service
implementation, orchestration, persistence access, Replay invocation,
Workflow Runtime invocation, infrastructure, transaction, delivery mechanism,
authorization, or Eligibility behavior.

The boundary is:

`server/organization-verification/application/application-service-contract/`

## Architectural role

The required delivery direction is:

```text
HTTP / Worker / CLI / Administration / Command Handler
  -> OrganizationVerificationApplicationServicePort
  -> future Phase 8D.1 application-service implementation
  -> Persistence Port + Replay Runtime + Workflow Runtime
  -> future infrastructure adapter
```

Future delivery code must not coordinate persistence, Replay, or Workflow
Runtime directly. The application-service port is explicit rather than a
generic command bus.

## Selected public use cases

| Use case | Classification | Mutation in future 8D.1 | Responsibility |
| --- | --- | --- | --- |
| `start_organization_verification` | Command | One genesis append or zero for rejection/exact duplicate | Establish one Workflow genesis |
| `advance_organization_verification_workflow` | Command | One two-entry Workflow-step append or zero | Advance exactly one approved Workflow step |
| `load_organization_verification_state` | Query | Never | Authoritative current-state reader: load then Replay |
| `replay_organization_verification_history` | Query | Never | Audit/diagnostic view of bindings and full-stream consumption |

The Replay-history query is retained because it exposes audit bindings and
deterministic Replay diagnostics that the normal current-state query
deliberately hides. It is not a competing current-state reader:
`loadOrganizationVerificationState` alone is authoritative for current
application state.

No generic `execute`, `dispatch`, arbitrary event append, automatic next-step,
get-or-create, load-and-repair, replay-and-persist, or advance-until-blocked
use case exists.

## Service port

```ts
interface OrganizationVerificationApplicationServicePort {
  startOrganizationVerification(
    request: StartOrganizationVerificationRequest,
  ): Promise<StartOrganizationVerificationResult>;

  advanceOrganizationVerificationWorkflow(
    request: AdvanceOrganizationVerificationWorkflowRequest,
  ): Promise<AdvanceOrganizationVerificationWorkflowResult>;

  loadOrganizationVerificationState(
    request: LoadOrganizationVerificationStateRequest,
  ): Promise<LoadOrganizationVerificationStateResult>;

  replayOrganizationVerificationHistory(
    request: ReplayOrganizationVerificationHistoryRequest,
  ): Promise<ReplayOrganizationVerificationHistoryResult>;
}
```

The future implementation dependency contract contains only:

- the frozen evidence repository port;
- a narrow Replay operation port;
- a narrow one-step Workflow Runtime operation port.

It contains no database client, ORM, logger, clock, ID generator, environment,
service locator, DI container, lock, retry, timeout, Unit of Work, or
transaction manager.

## Start contract

The authentic start request binds:

- application execution ID and command ID;
- requested and explicitly completed application timestamps;
- command provenance, integrity, correlation, and causation;
- authentic exact Workflow stream identity;
- expected persistence stream version `0`;
- initial Workflow execution version `1`;
- authentic initial Attempt Lifecycle Execution;
- explicit Workflow creation time, provenance, and integrity;
- distinct explicit append ID and genesis evidence-entry ID;
- explicit append time, provenance, and integrity.

The stream identity must match the Organization, Record, Revision, and Attempt
identities in the authentic Lifecycle Execution. No Record, Revision, Attempt,
Lifecycle, Workflow, evidence, append, or application identity is generated
inside the contract.

The start result union is:

- `start_completed`;
- `start_idempotent`;
- `start_rejected`.

Completed and idempotent success contain authentic application execution
evidence, the committed genesis, an authentic append receipt, the resulting
persistence version, and the current Workflow. The idempotent outcome is
separate from rejection and requires the frozen persistence outcome
`duplicate_append_idempotent`.

Starting verification establishes coordination genesis only. It does not mean
approved, verified, trusted, eligible, published, or authorized.

## Advance-one-step contract

The authentic advance request binds:

- application execution and command identity;
- exact stream identity;
- expected persistence stream version;
- expected Workflow execution ID and Workflow version;
- exact expected Workflow stage;
- explicit Workflow step ID;
- exactly one closed requested step;
- explicit step occurrence time, provenance, integrity, correlation,
  causation, and optional reason;
- distinct append ID, authority evidence-entry ID, and Workflow Step Record
  evidence-entry ID;
- explicit append time and references;
- exactly one stage-specific authority input.

The stage-to-step relation is fixed:

| Expected stage | Requested step |
| --- | --- |
| `attempt_in_progress` | `attempt_transition` |
| `attempt_completed` | `bind_snapshot` |
| `snapshot_bound` | `bind_projection` |
| `projection_bound` | `bind_evaluation_input` |
| `evaluation_input_bound` | `complete_policy` |
| `policy_completed` | `complete_decision_trust_integration` |

The request cannot contain an arbitrary evidence array, prebuilt append batch,
prebuilt Workflow Step Record, callback, repository, authority function,
generic payload, skip, force, repair, complete-all, or automatic-next
instruction.

The result union is:

- `advance_completed`;
- `advance_idempotent`;
- `advance_rejected`.

`advance_completed` binds one authentic Workflow Step Execution, its one
authority result, one Workflow Step Record, one append receipt, the resulting
Workflow and Lifecycle state, exact before/after versions, and a coordination
terminal indicator. Runtime success without persistence success cannot be an
application success. No partial-success variant exists.

`advance_idempotent` is structurally different. It contains no Workflow Step
Execution and no fresh authority result. It binds the original persisted
authority artifact, original Workflow Step Record, original duplicate append
receipt, authentic Replay execution, Replay-reconstructed current Workflow and
Lifecycle state, exact original before/after versions, and the current
coordination terminal indicator.

## Stage-specific authority-input ownership

Replay owns the reconstructed current Workflow and all predecessor artifacts.
The external caller supplies only genuinely external, explicit authority
input.

| Step | Caller-owned input | Replay-derived input supplied internally in 8D.1 | Hidden/generated output |
| --- | --- | --- | --- |
| `attempt_transition` | transition identity, expected Lifecycle versions/states, target transition, explicit time and references | predecessor Lifecycle Execution | None |
| `bind_snapshot` | Snapshot construction context, Registry source, submission source, semantic evidence references | completed Lifecycle/Workflow continuity used for validation | None |
| `bind_projection` | Projection construction context | Evidence Snapshot | None |
| `bind_evaluation_input` | Evaluation Input identity/version, Policy Set binding, evaluation context/scope, explicit time and optional expected fingerprint | Evaluation Projection | None |
| `complete_policy` | authentic Policy Set, authentic Rule Implementation Set, authentic Execution Artifacts, optional expected execution fingerprint | Policy Evaluation Input | None |
| `complete_decision_trust_integration` | input-binding artifacts, Decision context, Trust source facts, Trust derivation context, binding artifacts, execution artifacts | Policy Runtime Execution | None |

Existing idempotency artifacts such as `existingSnapshot`, `existingInput`, or
`existingExecution` are not caller inputs. Application idempotency is decided
from durable persistence evidence before authority execution.

## Authoritative current-state query

The future implementation of `loadOrganizationVerificationState` must:

1. load the exact stream;
2. return `state_not_found` when absent;
3. create an authentic Replay request from explicit request metadata;
4. Replay the authentic loaded stream;
5. return the reconstructed current Workflow and Lifecycle state.

`state_found` contains the stream identity and version, evidence-stream
fingerprint, authentic Replay execution, reconstructed state, coordination
terminal indicator, and audit-safe read diagnostics. It does not return the
raw evidence stream or mutable repository state.

The state result is the state represented by exactly the loaded stream
version. There is no refresh loop, repair, write, merge, or hidden retry.

## Replay-history query

The audit query returns the authentic Replay execution, authority-result
bindings, Workflow Step Record bindings, deterministic diagnostics, stream
identity/version/fingerprint, and proof of full stream consumption.

It does not invoke authorities, repair or migrate history, append evidence, or
expose infrastructure internals. It is read-only and not authoritative over
the normal current-state query.

## Request metadata and authenticity

Command metadata requires:

- application execution ID;
- command ID;
- requested and application-completed timestamps;
- nonempty canonical provenance and integrity references;
- correlation ID;
- causation ID.

Query metadata uses a query ID and has no write metadata or causation
requirement. Queries that Replay also bind explicit Replay execution ID,
Replay timestamp, provenance, and integrity.

Every trusted request has an independent private authenticity seal and private
identity set. Public constructors copy and freeze mutable caller input. Public
guards reject plain objects, spread copies, `Object.assign` copies, frozen
structural clones, JSON round trips, and `structuredClone` values. Seals,
stampers, mutable registries, and internal construction helpers are not
exported.

## Application execution evidence

Phase 8D.0 introduces a minimal authentic
`OrganizationVerificationApplicationExecution`. It is orchestration evidence
only and binds:

- application execution ID;
- exact application request identity (`commandId` for command use cases);
- exact use case and outcome;
- request fingerprint;
- stream identity fingerprint;
- explicit completion time;
- relevant previous/resulting persistence and Workflow versions;
- fingerprints of the lower-layer evidence used by the result;
- deterministic application execution fingerprint.

It deliberately does not contain a second copy of Workflow state,
persistence state, Replay state, or authority results. Result contracts carry
the authentic lower-layer artifacts themselves where required.

## Consistency and concurrency

Start:

- expected persistence version must be `0`;
- initial Workflow version must be `1`;
- no overwrite or competing genesis is allowed;
- exact duplicate may become `start_idempotent`;
- every other existing-stream case is a conflict.

Advance:

- expected persistence version must match the durable stream;
- expected Workflow ID, version, and stage must match Replay;
- the requested step must be the sole step allowed for that stage;
- completed Workflow rejects as `workflow_already_completed`;
- no last-write-wins, reload-and-retry, merge, or automatic progression.

Queries:

- observe one loaded stream version;
- never write;
- never repair.

Concurrency conflicts remain visible application failures.

## One-step guarantee

One advance request can commit zero or one Workflow step:

- zero for rejection;
- zero for an exact already-committed duplicate;
- one two-entry append for new success.

There is no result type capable of representing multiple Workflow steps and no
loop, recursion, chained authority, or execute-until-complete operation.

## Idempotency ownership

Persistence owns proof of exact append duplication. The application service
owns interpretation of that proof.

`commandId` and persistence `appendId` remain distinct explicit identities.
The request fingerprint binds both, and application execution evidence carries
the request identity explicitly. `appendId` plus the deterministic frozen
append-batch semantics provides durable duplicate proof; `commandId` alone is
never sufficient.

The future service must determine exact duplication before invoking Workflow
Runtime. It translates `duplicate_append_idempotent` to the corresponding
successful application outcome and returns the original durable authority
artifact, original Workflow Step Record, original receipt, and
Replay-reconstructed current state. It must not rerun Workflow Runtime or an
authority, create a new Workflow Step Execution, regenerate evidence, treat
every stale version as idempotent, or return changed semantics.

## Closed failure vocabulary

Application failures are technology-neutral and include:

- common authenticity, identity, metadata, and integrity failures;
- start version, genesis, existing-stream, and persistence conflicts;
- not-found, Replay, expected-version, expected-stage, step, terminal,
  authority, Workflow, append, and idempotency failures;
- current-state integrity and reconstruction failures.

The exact executable mappings are exported as:

- `ORGANIZATION_VERIFICATION_PERSISTENCE_FAILURE_MAPPING`;
- `ORGANIZATION_VERIFICATION_REPLAY_FAILURE_MAPPING`;
- `ORGANIZATION_VERIFICATION_WORKFLOW_FAILURE_STAGE_MAPPING`.

Key mappings include:

| Lower-layer meaning | Application meaning |
| --- | --- |
| `stream_not_found` | `verification_stream_not_found` |
| `expected_stream_version_conflict` | `expected_persistence_version_conflict` |
| exact duplicate append | successful idempotent outcome |
| evidence identity/fingerprint conflict | `application_idempotency_conflict` |
| stored or Replay stream integrity failure | `current_state_integrity_failure` |
| Replay stage/version/history conflict | `current_state_reconstruction_failure` |
| Workflow authority stage failure | `authority_execution_rejected` |
| Workflow binding/runtime failure | `workflow_step_execution_rejected` |

No SQL, ORM, database, Map, HTTP status, stack trace, provider payload, or raw
evidence vocabulary is exposed.

## Terminal Workflow behavior

`completed` is coordination vocabulary only. Advance rejects a completed
Workflow and performs no append. A terminal indicator never implies
Organization approval, Trust, Eligibility, publication, permission, or
authorization.

## Fingerprints, immutability, and determinism

Request fingerprints bind every semantic request field, including exact
stream identity, expected versions/stage, requested step, authority-input
fingerprint, explicit metadata, append identities, times, and references.
Application execution fingerprints bind the request and lower-layer
fingerprints without replacing them.

For `advance_completed`, the lower-layer binding includes the authentic
Workflow Step Execution. For `advance_idempotent`, the binding excludes any
Workflow Step Execution and instead binds the persisted authority artifact,
Workflow Step Record, original append receipt, Replay execution, persistence
stream, and Replay-reconstructed current Workflow and Lifecycle state. The two
outcomes therefore cannot share an application execution fingerprint.

Canonicalization is property-order independent. Semantically unordered
references are sorted; ordered evidence remains order-sensitive. Mutable
caller data is recursively copied and frozen, while existing authentic
lower-layer artifacts retain their authenticated identity.

There is no system clock, random ID generation, environment input, process ID,
mutable global state, hidden salt, or infrastructure-derived metadata.

## Architecture enforcement

Architecture tests enforce:

- contract-only imports from frozen public boundaries;
- no infrastructure or in-memory adapter;
- no persistence, Replay, Workflow Runtime, or authority invocation;
- no database, ORM, SQL, schema, migration, filesystem, network, API,
  controller, route, worker, queue, startup, DI, transaction, Unit of Work,
  lock, retry, timeout, automatic progression, Workflow Engine, Eligibility,
  or authorization behavior;
- no generic service locator or command bus;
- no hidden clock, IDs, randomness, or environment;
- no public authenticity seals, internal result constructors, or fingerprint
  helpers.

## Deferred work

Explicitly deferred:

- Phase 8D.1 application-service implementation and orchestration;
- PostgreSQL/Neon persistence;
- transactions, Unit of Work, and distributed concurrency mechanisms;
- Workflow Engine or automatic progression;
- API, routes, controllers, frontend, workers, queues, and startup wiring;
- authorization, Eligibility, permissions, marketplace behavior, and user
  verification flags.

No existing Domain, Workflow, Persistence, Replay, or in-memory adapter
semantics were changed in Phase 8D.0.
