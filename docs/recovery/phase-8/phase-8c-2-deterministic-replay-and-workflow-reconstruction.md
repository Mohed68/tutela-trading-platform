# Phase 8C.2 — Deterministic Replay and Workflow Reconstruction

## Accepted baseline

- Branch: `architecture/phase-7a-organization-trust`
- Accepted predecessor: `afedef21b47bbb9bd78ceeb567aa99e672c65472`
- Scope: pure deterministic Organization Verification replay from one authentic, integrity-validated persistence evidence stream

## Architectural role

Replay is an application-layer interpreter:

```text
Authentic loaded evidence stream
        ↓
Pure Replay runtime
        ↓
Authentic reconstructed coordination state
```

Repository loading and Replay remain separate. Replay accepts the authentic stream extracted from a `found` load result. It accepts no repository port, adapter, database client, callback, provider, repair handler, or event mapper.

The public operation is:

```ts
replayOrganizationVerificationWorkflow(
  request: OrganizationVerificationReplayRequest,
): OrganizationVerificationReplayResult
```

The operation performs no I/O and has no hidden state, clock, randomness, cache, retry, or write.

## Replay versus re-execution

Replay consumes authentic durable evidence. It does not call the authorities that originally produced that evidence.

Replay never invokes:

- Attempt Lifecycle transition execution;
- Evidence Snapshot construction;
- Evaluation Projection construction;
- Evaluation Input construction;
- Policy evaluation;
- Decision–Trust integration;
- Workflow Runtime execution;
- a provider or external evidence service.

The runtime uses the frozen public Workflow and Attempt Lifecycle contract constructors only as pure authenticity and deterministic-fingerprint validators. These constructors interpret already-authenticated evidence and do not select or execute a business transition.

## Accepted input

`createOrganizationVerificationReplayRequest(...)` creates the authentic immutable request. The input binds:

- explicit Replay Execution ID;
- one authentic `OrganizationVerificationEvidenceStream`;
- exact stream identity, version, ordered entries, head, integrity summary, and stream fingerprint through that authentic stream;
- explicit `replayedAt`;
- explicit normalized provenance references;
- explicit normalized integrity references.

The request factory rebuilds the complete stream through the frozen stream factory and compares version and stream fingerprint before stamping the request.

The factory rejects:

- a `not_found` load result;
- a found wrapper instead of the authentic stream;
- plain and frozen structural objects;
- spread and `Object.assign` copies;
- JSON round trips;
- `structuredClone` values;
- any stream that fails the frozen authenticity or integrity boundary.

The load-result wrapper itself has no frozen authenticity seal. Therefore the exact strong boundary is the authentic `stream` value inside a `found` result, rather than the structurally typed wrapper.

## Result model

The closed result union is:

```ts
type OrganizationVerificationReplayResult =
  | {
      outcome: "replay_completed";
      execution: OrganizationVerificationReplayExecution;
    }
  | {
      outcome: "replay_rejected";
      failure: OrganizationVerificationReplayFailure;
    };
```

`replay_completed` means only that the entire stored stream was consumed and reconstructed consistently. It does not mean approved, verified, trusted, eligible, authorized, or commercially accepted.

Expected stream semantics return `replay_rejected`; they do not throw. Unexpected programmer defects remain ordinary failures.

## Replay execution

The authentic immutable `OrganizationVerificationReplayExecution` binds:

- explicit Replay Execution ID;
- authentic persistence stream identity;
- persistence stream version;
- source evidence stream fingerprint;
- authentic reconstructed Workflow Execution;
- authentic reconstructed Attempt Lifecycle Execution;
- ordered authority-result bindings;
- ordered authentic Workflow Step Records;
- consumed persistence range;
- completion status `stream_consumed`;
- deterministic diagnostics;
- explicit replay timestamp;
- provenance and integrity references;
- deterministic Replay fingerprint.

Private seals and internal constructors are not exported.

## Genesis reconstruction

Replay begins from exactly one `workflow_genesis` at position `1`. It validates:

- no predecessor;
- exact stream identity;
- Workflow, Organization, Record, Revision, and Attempt continuity;
- authentic Workflow Execution;
- Workflow version `1`;
- empty initial step history;
- exact Workflow fingerprint bound by the stored evidence envelope.

The stored genesis Workflow Execution is the initial state. Replay does not rebuild genesis independently from Record, Revision, or Attempt and never creates missing genesis.

## Replay unit and stage mapping

After genesis, Replay consumes fixed two-entry units:

```text
durable authority result
        ↓
corresponding Workflow Step Record
```

The mapping is:

| Current Workflow stage | Expected Workflow step | Required durable evidence |
|---|---|---|
| `attempt_in_progress` | `attempt_transition` | `attempt_lifecycle_execution` |
| `attempt_completed` | `bind_snapshot` | `evidence_snapshot` |
| `snapshot_bound` | `bind_projection` | `evaluation_projection` |
| `projection_bound` | `bind_evaluation_input` | `policy_evaluation_input` |
| `evaluation_input_bound` | `complete_policy` | `policy_runtime_execution` |
| `policy_completed` | `complete_decision_trust_integration` | `decision_trust_integration_execution` |

`completed` has no next Replay unit.

The authority result alone does not complete a step. A Step Record without its authority result is also invalid.

## Workflow reconstruction

For every unit Replay:

1. derives the single expected step and evidence kind from the current stage;
2. preserves persistence position order;
3. validates predecessor evidence links;
4. validates Workflow, Organization, Record, Revision, and Attempt identity;
5. validates exact Workflow version `+1`;
6. validates current and resulting stages;
7. validates explicit chronology;
8. validates the Step Record input fingerprint against the current reconstructed artifact;
9. validates the Step Record output fingerprint against the exact stored authority result;
10. binds the newly consumed authentic artifact;
11. appends the authentic Step Record;
12. invokes the pure frozen Workflow contract constructor with only accumulated stored evidence;
13. invokes the constructor's existing-workflow comparison path to verify the reconstructed fingerprint deterministically;
14. advances to the authentic reconstructed Workflow Execution.

No next step is selected beyond interpreting the already-stored Step Record. No authority is dispatched.

## Lifecycle reconstruction

For every `attempt_lifecycle_execution`, Replay validates structural successor continuity:

- authentic predecessor and successor;
- lifecycle execution identity;
- Organization, Record, Revision, and Attempt identity;
- Attempt sequence;
- lifecycle version `+1`;
- identical creation baseline;
- transition-history prefix preservation;
- exactly one additional transition record;
- transition predecessor and next versions;
- Attempt process-state continuity;
- nonregressing chronology;
- deterministic lifecycle fingerprint through the pure lifecycle contract constructor.

This validates that the durable Lifecycle Execution is a structurally authentic successor. It does not rerun original transition eligibility or the Attempt Transition authority.

## Authority-result bindings

Each completed Workflow step produces one authentic immutable Replay binding containing:

- Workflow Step ID;
- Workflow step and predecessor/resulting stages;
- authority-result evidence kind;
- authority-result semantic ID and fingerprint;
- authority-result persistence position;
- Workflow Step Record ID and fingerprint;
- Step Record persistence position;
- resulting Workflow version.

Bindings retain references and fingerprints, not duplicate generic payloads. The authentic reconstructed Workflow Execution remains the source of truth for bound artifacts.

## Partial and terminal streams

A valid genesis-only or partial stream returns `replay_completed` after consuming the entire available history. The reconstructed Workflow stage remains intermediate and `terminalCoordinationReached` remains `false`.

An incomplete trailing unit is rejected at the persistence-integrity boundary and again by Replay defense-in-depth.

When Replay reconstructs `completed`:

- terminal coordination is recorded as `true`;
- any following evidence is rejected as `replay_evidence_after_completion`;
- no approval, verification, Trust, Eligibility, or authorization meaning is inferred.

## Evidence ordering

Persistence integrity is the first boundary. Replay stage semantics are the second.

Replay never:

- sorts by time or kind;
- changes evidence position;
- groups entries;
- skips unknown entries;
- repairs predecessors;
- chooses a latest duplicate;
- resolves a competing branch;
- ignores trailing evidence.

It rejects gaps, duplicate semantic evidence, broken predecessors, stage mismatch, lifecycle conflict, competing history, and evidence after terminal coordination.

## Failure vocabulary

The closed vocabulary is:

- `replay_stream_not_found_input`
- `replay_unauthentic_stream`
- `replay_stream_integrity_failure`
- `replay_missing_genesis`
- `replay_duplicate_genesis`
- `replay_invalid_genesis`
- `replay_unexpected_evidence_kind`
- `replay_incomplete_step_unit`
- `replay_stage_mismatch`
- `replay_authority_result_mismatch`
- `replay_authority_fingerprint_mismatch`
- `replay_step_record_mismatch`
- `replay_workflow_version_conflict`
- `replay_workflow_fingerprint_conflict`
- `replay_lifecycle_version_conflict`
- `replay_lifecycle_identity_conflict`
- `replay_predecessor_conflict`
- `replay_chronology_conflict`
- `replay_duplicate_semantic_evidence`
- `replay_competing_history`
- `replay_evidence_after_completion`
- `replay_reconstructed_integrity_failure`

Diagnostics contain only deterministic safe references such as persistence position, expected/actual kind, stage, version, safe identity, or fingerprint. No full evidence payload or sensitive data is copied into a failure.

## Diagnostics

Successful diagnostics contain:

- total evidence entries consumed;
- total Workflow steps reconstructed;
- final Workflow version and stage;
- final Lifecycle Execution version;
- first and last persistence positions;
- exact counts for all eight durable evidence kinds;
- terminal coordination indicator.

There is no duration, machine information, process information, environment, mutable log, approval, Trust, or Eligibility field.

## Replay fingerprint

The Replay-scoped SHA-256 fingerprint canonically binds:

- Replay Execution ID;
- source stream identity, version, and fingerprint;
- reconstructed Workflow fingerprint;
- reconstructed Lifecycle fingerprint;
- ordered authority-result bindings;
- ordered Workflow Step Record fingerprints;
- consumed evidence range;
- completion status;
- diagnostics;
- explicit replay timestamp;
- provenance and integrity references.

Object keys are canonicalized, while ordered sequences remain order-sensitive. The Replay fingerprint does not replace any source fingerprint.

## Authenticity and immutability

Independent private seals protect:

- Replay request;
- Replay evidence binding;
- Replay execution;
- Replay result.

Public Boolean guards reject plain objects, spread copies, `Object.assign` copies, frozen structural clones, JSON round trips, and `structuredClone` values.

All Replay-owned arrays and nested summaries are frozen. The reconstructed Workflow and Lifecycle values retain their existing authentic immutable forms. Caller mutation cannot alter a completed Replay or a later Replay.

## Determinism

The same explicit Replay ID, timestamp, references, and authentic stream produce the same:

- result outcome;
- Workflow and Lifecycle fingerprints;
- bindings;
- diagnostics;
- Replay fingerprint.

There is no system clock, randomness, environment, cache, process identity, mutable global semantic state, or adapter-specific behavior.

## No-write and authority-isolation boundaries

Architecture enforcement rejects:

- Workflow Runtime and Attempt Lifecycle Runtime imports;
- every original business authority call;
- in-memory adapter or repository dependency;
- append/load ports and persistence constructors that create evidence or receipts;
- database, ORM, SQL, schema, migration, filesystem, network, environment, API, worker, queue, provider, and startup dependencies;
- Workflow Engine, automatic progression, generic reducers, repair, event upcasting, retries, locks, and transaction managers;
- public export of Replay seals, fingerprint helpers, or internal constructors;
- wiring Replay into API or startup.

## Integration test

The focused integration test composes only public boundaries:

```text
Runtime-produced authentic evidence
        ↓
In-memory append
        ↓
Found authentic stream
        ↓
Pure Replay
        ↓
Authentic reconstructed Workflow
```

It appends genesis and every complete evidence pair, loads the stream, replays it, and loads again. Stream version, ordered evidence fingerprints, and stream fingerprint remain unchanged, proving Replay wrote no evidence.

## Durable-evidence limitation

Later `OrganizationVerificationWorkflowExecution` envelopes are intentionally classified as derived runtime values and are not persisted. Therefore there is no independently stored later Workflow Execution fingerprint to compare byte-for-byte with Replay output.

This is not a deterministic-reconstruction gap:

- genesis supplies the immutable Workflow identity, creation metadata, provenance, integrity references, and initial Lifecycle Execution;
- every later authentic artifact is persisted;
- every Workflow Step Record supplies exact version, stage, chronology, input/output fingerprints, and binding fingerprint;
- the frozen Workflow constructor deterministically recomputes and authenticates each later Workflow Execution;
- its existing-workflow comparison path verifies repeatable fingerprint construction.

Replay proves that the stored evidence has one deterministic reconstructed state. It does not claim an independent persisted copy of each derived Workflow envelope.

## Deferred and excluded

Phase 8C.2 does not implement:

- PostgreSQL, Neon, database adapters, schemas, migrations, or transactions;
- Replay persistence, snapshots, checkpoints, caching, repair, compensation, migration, or upcasting;
- Workflow Engine, execute-until-complete, automatic next-step selection, or authority dispatch;
- API, routes, controllers, frontend, startup, workers, queues, schedulers, providers, or notifications;
- policy reevaluation, Decision recomputation, Trust recomputation, Eligibility, permissions, authorization, or user-verification behavior.
