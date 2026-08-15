# Phase 8E.0a — Durable Evidence Serialization and Rehydration

## Status

This phase defines the frozen boundary between authentic Organization Verification runtime evidence and storage-safe durable data. It does not implement PostgreSQL, SQL, migrations, APIs, or deployment wiring.

## Evidence classification

Durable evidence supported by the persistence contract:

1. `workflow_genesis`
2. `attempt_lifecycle_execution`
3. `evidence_snapshot`
4. `evaluation_projection`
5. `policy_evaluation_input`
6. `policy_runtime_execution`
7. `decision_trust_integration_execution`
8. `workflow_step_record`

`WorkflowStepExecution` and authority/runtime result wrappers are runtime-only. Current Workflow and Lifecycle state, Replay diagnostics, application results, and append receipts are derived views or persistence metadata rather than additional business evidence.

## Durable model

Each stored evidence item becomes an immutable `organization-verification-durable-evidence/v1` envelope containing:

- an exact evidence discriminator;
- plain storage-safe payload data;
- a deterministic SHA-256 payload fingerprint;
- explicit identities, versions, chronology, provenance, integrity references, artifact fingerprint, and stored-evidence fingerprint already present in the frozen persistence contract.

Private symbols, authenticity seals, functions, prototypes, runtime references, clocks, and generated identities are not serialized. Canonical serialization sorts every object key recursively and rejects unsupported or non-finite values.

## Rehydration ownership

| Evidence | Rehydration owner |
| --- | --- |
| Record, Revision, Attempt | Core domain modules that own their seals |
| Attempt transition and lifecycle execution | Attempt Lifecycle Contract |
| Workflow genesis and step record | Workflow Contract |
| Snapshot | Evidence Snapshot domain |
| Projection | Evaluation Projection domain |
| Evaluation input | Evaluation Input domain |
| Policy execution | Policy Runtime domain |
| Decision | Decision domain |
| Trust Status | Trust Status domain |
| Decision–Trust integration | Decision–Trust Integration domain |
| Stored evidence envelope | Durable Evidence Contract dispatcher |

The durable evidence dispatcher never imports seals or private constructors. It delegates to owner-controlled rehydration functions. Those functions validate exact durable shape, identities, versions, chronology, semantic fingerprints, and nested bindings before applying their existing private authenticity construction path.

## Reference binding session

The frozen Workflow Contract requires the Policy execution embedded by Decision–Trust Integration to be the same authenticated object reference as the earlier Policy authority evidence. A per-stream rehydration session preserves this binding after restart by indexing only newly rehydrated Policy executions by their immutable fingerprint.

The session is explicit, local to one loaded evidence stream, and contains no global registry, latest/current/default lookup, runtime authority, or hidden resolution.

## Corruption behavior

Rehydration fails closed for malformed envelopes, wrong or unsupported discriminators, missing or extra envelope fields, altered canonical bytes, changed payload fingerprints, identity or version corruption, chronology mismatch, artifact or stored-evidence fingerprint mismatch, and Decision–Trust binding mismatch. Plain clones remain unauthentic and cannot enter Replay directly.

## Replay boundary

The process-boundary test performs canonical serialization, JSON parsing into plain data, domain-owned rehydration in a fresh per-stream session, stored-evidence reconstruction, evidence-stream validation, and unchanged Replay. Replay accepts only the newly authenticated objects and reconstructs the same semantic Workflow and Lifecycle state.

Rehydration reconstructs previously committed evidence. It does not rerun Decision Engine, Trust Deriver, Policy Runtime, Workflow Runtime, lifecycle business transitions, or any external authority.

## Next phase

Phase 8E.0 PostgreSQL persistence may consume only this public durable evidence boundary. The adapter must not import owner rehydration modules, private seals, or constructors directly.
