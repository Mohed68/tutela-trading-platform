# Phase 8D.0.5 — Organization Verification Cross-Layer Conformance

## Status and accepted baseline

Accepted predecessor:
`95df70472ba6975e630507c4447bd559598386a8`.

This phase is architecture validation only. It adds no business capability,
orchestration, persistence access, Replay execution, Workflow Runtime
execution, authority invocation, infrastructure, transport, or startup
wiring.

The inert conformance boundary is:

`server/organization-verification/application/cross-layer-conformance/`

Its public surface contains frozen matrices only.

## Architectural purpose

The conformance layer proves that the existing Organization Verification
contracts form one coherent deterministic system:

- identity is continuous from Organization through Application Execution;
- every trusted upper-layer fingerprint traces to frozen persisted evidence;
- every lower-layer public failure has one application interpretation;
- every state and execution concept has one authoritative owner;
- dependency direction is acyclic and contains no infrastructure leakage.

It reads existing public contracts and mapping constants. It neither creates
nor replaces Domain, Workflow, Persistence, Replay, or Application Service
semantics.

## Identity lineage

| Order | Identity | Sole owner | Bound into next layer by |
| --- | --- | --- | --- |
| 1 | Organization ID | Organization Registry | `OrganizationVerificationRecord.organizationId` |
| 2 | Record ID | Organization Verification Domain | `OrganizationVerificationRevision.recordId` |
| 3 | Revision ID | Organization Verification Domain | `OrganizationVerificationAttempt.revisionId` |
| 4 | Attempt ID | Organization Verification Domain | `OrganizationVerificationWorkflowExecution.attemptId` |
| 5 | Workflow Execution ID | Workflow Contract | `OrganizationVerificationWorkflowStreamIdentity.workflowExecutionId` |
| 6 | Persistence Stream Identity | Persistence Contract | `OrganizationVerificationReplayExecution.streamIdentity` |
| 7 | Replay Execution ID | Replay Runtime | Replay fingerprint bound into Application Execution lower-layer references |
| 8 | Application Execution ID | Application Service Contract | Application execution binds the unchanged stream identity fingerprint |

Every entry is required. No `latest`, `current`, `head`, default, optional, or
generated identity participates in the chain. A later execution identity
identifies its own evidence envelope; it does not replace any upstream
business or stream identity.

Persistence, Replay, and the future Application Service consume the existing
Organization, Record, Revision, Attempt, and Workflow identities. They do not
recreate them.

## Fingerprint lineage

The trust-trace direction is:

```text
Application Execution fingerprint
  -> Replay fingerprint
  -> reconstructed Workflow fingerprint
  -> Persistence Stream fingerprint
  -> ordered Stored Evidence fingerprints
  -> authentic authority artifact fingerprints
```

The executable matrix records these nodes:

| Fingerprint | Sole owner | Parent evidence |
| --- | --- | --- |
| Authority artifact | Frozen authority | Authentic authority artifact stored by Persistence |
| Stored Evidence | Persistence Contract | Authority or Workflow artifact fingerprint |
| Persistence Stream | Persistence Contract | Ordered Stored Evidence fingerprints |
| Workflow Execution | Workflow Contract | Authentic authority artifacts and Workflow Step Records |
| Replay | Replay Runtime | Stream, reconstructed Workflow, and authority binding fingerprints |
| Application Execution | Application Service Contract | Replay, Workflow, and Persistence fingerprints |

The graph is a directed acyclic graph. Every non-root trusted fingerprint has
at least one explicit parent. No fingerprint replaces a parent or becomes a
competing state source. The conformance boundary computes no hash and creates
no new fingerprint.

The authority fingerprint is the evidence root, but it is trusted upward only
through its authentic Stored Evidence binding. The Persistence Stream
fingerprint commits to the ordered stored envelopes, and Replay commits to the
exact stream it consumed.

## Failure lineage

The conformance view imports, rather than duplicates:

- `ORGANIZATION_VERIFICATION_PERSISTENCE_FAILURE_MAPPING`;
- `ORGANIZATION_VERIFICATION_REPLAY_FAILURE_MAPPING`;
- `ORGANIZATION_VERIFICATION_WORKFLOW_FAILURE_STAGE_MAPPING`.

The maps remain compile-time exhaustive through
`satisfies Record<LowerLayerFailure, ApplicationFailure>`. Adding a new
Persistence failure, Replay failure, or Workflow Runtime failure stage without
updating its map causes TypeScript validation to fail.

Every runtime lineage entry uses a qualified origin:

```text
persistence:<failure>
replay:<failure>
workflow_runtime:<stage>
```

Qualified origins are unique. Many lower failures may intentionally map to one
application meaning, but no lower failure has multiple application meanings.

Application-owned failures are limited to request authenticity/metadata,
start preconditions, current-state coordination, expected Workflow
version/stage, requested-step validation, and terminal Workflow behavior.
Every application failure is explained by either:

- exactly one lower-layer mapping; or
- the explicit application-owned list.

No SQL, ORM, database code, HTTP status, Map error, stack trace, or
infrastructure vocabulary appears in the lineage.

## Layer ownership matrix

| Layer | Sole responsibility | Explicitly does not own |
| --- | --- | --- |
| Organization Verification Domain | Record, Revision, Attempt semantics and identity continuity | Workflow, persistence, reconstruction, orchestration, transport |
| Workflow Contract | Stage vocabulary, Workflow Execution, Workflow Step Record semantics | authority execution, persistence, reconstruction, orchestration |
| Workflow Runtime | one approved Workflow step of progression | persistence, reconstruction, orchestration, transport |
| Persistence Contract | durable evidence semantics, stream identity, append idempotency | Workflow progression, reconstruction, orchestration |
| Persistence Adapter | durable storage mechanism only | Domain, Workflow, Replay, orchestration |
| Replay Runtime | deterministic reconstruction | authority execution, progression, writes, orchestration |
| Application Service Contract | use-case boundary, result/failure vocabulary, Application Execution evidence | lower-layer semantics, infrastructure, transport |
| Application Service Runtime — deferred | orchestration across approved ports and runtimes | Domain authority, persistence implementation, reconstruction ownership |
| Delivery Layer — deferred | transport only | persistence, Replay, Workflow, orchestration |

No owned capability appears under two layer owners.

## Source-of-truth matrix

| Concept | Sole authoritative owner/artifact | Consumers | Forbidden competing owner |
| --- | --- | --- | --- |
| Current Workflow State | Replay Runtime reconstructed Workflow | Application Service Runtime | Workflow Runtime, adapter, delivery |
| Current Lifecycle State | Replay Runtime reconstructed Lifecycle Execution | Application Service Runtime | Workflow Runtime, adapter, delivery |
| Workflow History | Workflow Contract Step Records | Persistence and Replay | Application Service and delivery |
| Persistence History | Persistence Contract Evidence Stream | Replay and Application Service | Workflow Runtime and delivery |
| Authority Result | Frozen authority artifact | Workflow, Persistence, Replay | Application Service and delivery |
| Workflow Step | Workflow Runtime Step Execution | Persistence and Application Service | adapter, Replay, delivery |
| Replay State | Replay Runtime Execution | Application Service | adapter, Workflow, delivery |
| Application Execution | Application Service Contract evidence | Application Service Runtime and delivery | Persistence, Replay, Workflow, delivery |

The authoritative current-state reader remains
`loadOrganizationVerificationState`. Its future implementation must load one
authentic stream and return the state reconstructed by Replay. Neither the
repository adapter nor Workflow Runtime maintains a competing current-state
pointer.

Workflow Runtime owns the act of progressing one step. Workflow Contract owns
the semantic Step Record. Persistence owns the durable history. Replay owns
the current state reconstructed from that history. These are distinct
responsibilities, not duplicate ownership.

## Dependency graph

Approved direction:

```text
Organization Registry
  <- Organization Verification Domain
  <- Workflow Contract
  <- Workflow Runtime

Frozen authorities
  <- Workflow Runtime
  <- Persistence Contract

Persistence Contract
  <- Persistence Adapter
  <- Replay Runtime
  <- Application Service Contract
  <- future Application Service Runtime

Application Service Contract
  <- future Delivery Layer

Application Service Contract + frozen lower contracts
  <- Cross-Layer Conformance validation only
```

The executable dependency matrix is acyclic. Architecture and focused tests
also inspect production imports and enforce:

- Domain imports no Workflow Runtime, Persistence, Replay, Application
  Service, conformance, or infrastructure layer;
- Workflow Runtime imports no Persistence implementation;
- Persistence Contract imports no Replay, Application Service, or
  infrastructure implementation;
- Replay imports no Application Service or infrastructure;
- Application Service Contract imports no infrastructure;
- no runtime or lower layer imports the validation-only conformance boundary;
- future delivery code may consume only the Application Service boundary.

## Architecture guarantees

The architecture scanner rejects:

- database, ORM, SQL, schema, migration, filesystem, network, route,
  controller, worker, queue, startup, provider, transaction, Unit of Work, or
  infrastructure imports;
- Persistence, Replay, Workflow Runtime, or authority invocation from the
  conformance boundary;
- clock, randomness, environment, unsafe opaque substitution, automatic
  progression, Workflow Engine, authorization, or Eligibility behavior;
- reverse imports of conformance data by Domain, Workflow, Persistence,
  Replay, Application Service, infrastructure, or delivery code;
- callable public conformance exports.

The focused suite verifies:

- complete and contiguous identity lineage;
- an acyclic fingerprint trust graph;
- full lower-layer and application-owned failure coverage;
- one owner per source-of-truth concept;
- nonduplicated layer capabilities;
- an acyclic declared dependency graph;
- actual production import direction;
- a frozen inert public surface.

## Deferred behavior

Still deferred and not implemented:

- Phase 8D.1 Application Service orchestration;
- repository loading or append coordination;
- Replay or Workflow Runtime invocation;
- PostgreSQL/Neon adapters;
- Unit of Work and transactions;
- API, HTTP, routes, controllers, frontend, workers, and queues;
- Workflow Engine and automatic progression;
- authorization, Eligibility, and permissions.

No existing Domain, Workflow, Persistence, Replay, Application Service
Contract, or adapter semantic changed in Phase 8D.0.5.
