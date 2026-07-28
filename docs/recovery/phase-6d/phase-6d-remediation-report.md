# Phase 6D — Verification Architecture Remediation Report

Date: 2026-07-28

Status: complete

Branch: `recovery/phase-6d-architecture-remediation`

Authoritative architecture:
`docs/architecture/verification-engine-v2.md`

Remediation authority:
`docs/recovery/phase-6c/architecture-compliance-report.md`

Starting commit:
`b95a64e145ac813b7cd95060f261ed89fa48d30c`

## 1. Implementation summary

Phase 6D remediates the Phase 6C architecture deviations without adding a
product capability or changing the approved verification decisions, lifecycle
states, commercial policy, or marketplace policy.

The implementation now provides:

- sole Verification Decision ownership inside the Decision Engine;
- a runtime-sealed engine completion object;
- an orchestration-owned claim → evaluate → complete flow;
- a persistence boundary that cannot accept a caller-created
  `VerificationEngineResult`;
- engine-owned fail-closed conversion of state conflicts, snapshot-integrity
  mismatches, and unavailable policies into findings and decisions;
- independent Technical and Commercial Policy providers and registries;
- neutral shared reference data for unit/currency identifier recognition;
- immutable policy objects and version catalogs;
- deep-readonly and runtime-frozen verification snapshots;
- fingerprint revalidation under database locks before completion;
- additive database protection for immutable Phase 6 records;
- broader architecture enforcement and integration regressions.

No implementation was added for KYB, organization verification, marketplace
publication, moderation, compliance, sanctions, orders, negotiation,
contracts, payments, escrow, blockchain, notifications, email, AI decisions,
risk scoring, policy administration, or manual-review workflow.

## 2. Exact remediation of Phase 6C findings

### DEV-01 — Repository changed the verification decision

Previous behavior:

`server/verification/repository.ts` implemented `stateConflictResult`, which
could:

- append a `SYSTEM-003` finding;
- replace the engine decision with `manual_review`;
- replace confidence with `LOW`.

Remediation:

- `stateConflictResult` was removed.
- The repository now reports only neutral
  `VerificationSystemCondition` values.
- The orchestrator passes those conditions back through
  `evaluateClaimedVerification`.
- The Decision Engine maps `offer_state_conflict` to `SYSTEM-003`.
- The normal Decision Engine reducer produces `manual_review`.
- The repository persists the sealed result without creating or replacing any
  decision, confidence, Reason Code, Rule ID, severity, or disposition.

Result: remediated.

### DEV-02 — Completion accepted caller-created engine output

Previous behavior:

`completeClaimedVerification(claim, engineResult)` accepted any structurally
compatible `VerificationEngineResult`.

Remediation:

- the previous function was removed;
- `evaluateClaimedVerification` creates an opaque
  `VerificationEngineCompletion`;
- completion payloads are stored in a module-private `WeakMap`;
- `readVerificationEngineCompletion` rejects fabricated objects at runtime;
- `persistEngineCompletion` accepts only the opaque completion contract;
- the completion is bound to:
  - attempt ID;
  - evaluated snapshot fingerprint;
  - engine-produced conditions;
  - recorded versions;
- the repository revalidates claim token, lease, process state, current offer
  revision, current lifecycle assertion, stored snapshot content, stored
  fingerprint, claim fingerprint, completion fingerprint, and recorded
  versions before persistence;
- the orchestration loop is the only production flow that evaluates and
  completes a claim.

Result: remediated.

### PC-01 — Commercial rules read Technical Policy

Previous behavior:

Commercial validation read Technical Policy's recognized-unit catalog and
currency-identifier pattern.

Remediation:

- Technical and Commercial Policy contracts are independent;
- each family has its own static governed provider and registry;
- commercial validation receives only:
  - `CommercialVerificationPolicy`;
  - neutral `VerificationReferenceData`;
- technical validation receives only:
  - `TechnicalVerificationPolicy`;
  - the same neutral reference-data contract;
- neither policy family imports or reads the other;
- the previously approved commercial rules and outputs remain unchanged.

Result: remediated.

### PC-02 — Immutability was application convention only

Application remediation:

- all snapshot fields are TypeScript `readonly`;
- nested commodity identity is `readonly`;
- claimed snapshots are copied and recursively frozen;
- canonical serialization remains explicitly ordered;
- engine results and findings are frozen before crossing the completion
  boundary;
- immutable attempt and history fields have no ordinary update/delete
  repository method;
- completion recomputes and compares snapshot fingerprints while holding the
  attempt and offer locks;
- mismatches cannot complete an ordinary evaluation and must return through
  the Decision Engine.

Database remediation:

- migration `0010_verification_immutability.sql` adds narrowly scoped guards to
  the six Phase 6 tables;
- Submission Revisions, findings, events, and workflow transitions reject
  ordinary update/delete;
- attempt identity, snapshot, fingerprint, schema, engine/policy versions, and
  creation identity reject mutation;
- completed attempts reject update/delete;
- only approved process transitions are accepted;
- command identity and delivered commands are protected;
- no trigger is attached to a legacy business table.

Result: remediated within the approved recovery scope.

### PC-03 — Recorded versions could not be resolved

Remediation:

- `TechnicalPolicyProvider` resolves exact Technical Policy versions;
- `CommercialPolicyProvider` resolves exact Commercial Policy versions;
- static registries contain every version used to date;
- registered policy objects and their arrays are frozen;
- lookup never substitutes a current version for a missing recorded version;
- missing engine or policy versions create
  `policy_configuration_unavailable`;
- the Decision Engine maps the condition to `SYSTEM-001` and fails closed;
- future governed versions can be added without rewriting historical entries.

Result: remediated for all recorded versions currently present in Tutela.

## 3. Architecture compliance matrix after remediation

| Architecture requirement | Phase 6C | Phase 6D | Evidence |
|---|---|---|---|
| Decision Engine alone produces decisions | Deviation | **Compliant** | Decision literals and reduction remain in `engine.ts`; repository conflict reducer removed |
| Workflow Coordinator alone applies lifecycle transitions | Compliant | **Compliant** | `coordinator.ts` remains the post-verification offer-status writer |
| Verification Process independent from Decision | Compliant | **Compliant** | Separate domain contracts, fields, and migration consistency checks |
| Offer Lifecycle independent from Decision Engine | Compliant | **Compliant** | Engine has no database/lifecycle dependency |
| Snapshots immutable | Partial | **Compliant** | readonly/frozen model, canonical serializer, fingerprint lock-time validation, DB guard |
| History append-only | Partial | **Compliant** | insert-only application paths plus narrow database mutation guards |
| Reason Codes machine-readable | Compliant | **Compliant** | unchanged closed catalog and database checks |
| Rule IDs stable | Compliant | **Compliant** | unchanged independent IDs and catalog |
| Severity metadata only | Compliant | **Compliant** | reducer still reads disposition only |
| Technical/Commercial Policy independent | Partial | **Compliant** | separate contracts/providers/registries; neutral reference provider |
| No excluded domain introduced | Compliant | **Compliant** | cross-module architecture scan and marketplace regressions |
| No Workflow Coordinator bypass | Compliant | **Compliant** | production lifecycle call graph unchanged |
| No Decision Engine bypass | Deviation | **Compliant** | opaque engine completion plus runtime provenance seal |
| No History bypass in ordinary application flow | Partial | **Compliant** | atomic queue/completion/transition plus database guards |
| No Snapshot bypass | Partial | **Compliant** | completion identity and fingerprint comparison |
| Durable automatic verification | Compliant | **Compliant** | submission/claim/lease/recovery model unchanged |
| Independent version resolution | Partial | **Compliant** | exact static version registries; missing versions fail closed |
| Marketplace remains decoupled | Compliant | **Compliant** | no Phase 6 table consumption by marketplace |

Phase 6D conclusion:

**The active Phase 6 implementation now complies with the approved
Architecture Version 2 boundaries covered by the Phase 6C audit.**

## 4. Files changed

### Domain and application

- `shared/verification.ts`
  - readonly snapshot/finding/result contracts;
  - internal system-condition contract.
- `server/verification/engine.ts`
  - engine-owned system findings and decisions;
  - opaque completion creation and validation;
  - sealed immutable results.
- `server/verification/orchestrator.ts`
  - claim evaluation and re-evaluation ownership.
- `server/verification/repository.ts`
  - removed decision manufacture;
  - snapshot/version/precondition validation;
  - opaque completion persistence.
- `server/verification/worker.ts`
  - delegates evaluation/completion to the orchestrator.
- `server/verification/policy.ts`
  - independent frozen policy providers/registries;
  - neutral reference data.
- `server/verification/rules.ts`
  - family-specific policy inputs.
- `server/verification/snapshot.ts`
  - immutable snapshot copier/freezer.

### Migration and safety tooling

- `migrations/0010_verification_immutability.sql`
- `scripts/offers/verification-immutability-migration.ts`
- `package.json`

### Tests

- `server/verification/architecture.test.ts`
- `server/verification/engine.test.ts`
- `scripts/offers/phase-6b.runtime.test.ts`
- `scripts/offers/phase-5c.runtime.test.ts`

### Documentation

- `docs/recovery/phase-6d/phase-6d-remediation-report.md`

## 5. Migration details

Migration identifier:

`0010_verification_immutability`

Migration file:

`migrations/0010_verification_immutability.sql`

SHA-256:

`b180e0ee769d967c0e38ca1385679a603e4e9ad765deaba3adda04d89e4f9714`

Scope:

- three narrowly scoped trigger functions;
- six triggers attached only to tables introduced by migration 0009;
- no table, column, enum, constraint, or legacy business-row change.

Rehearsal:

- executed twice inside one transaction;
- idempotence confirmed;
- complete rollback confirmed;
- objects confirmed absent after rollback;
- legacy hashes remained unchanged.

Execution:

- applied only to the marked disposable Neon recovery branch;
- journal status: `succeeded`;
- base application schema fingerprint remained:
  `aeb77478a423b407e5e69705f78b7948e8020411b7defa26f605568f616fc401`;
- hardening-object fingerprint:
  `ddcaad3f95a71374b58333ef67b712dd9fb3c0795f7a38fd1828bff9412ebee0`.

The base fingerprint is intentionally unchanged because the established
fingerprint covers tables, columns, constraints, indexes, and enums. The new
migration tool separately fingerprints the exact functions and triggers.

Recovery-owned test cleanup uses the explicit
`tutela.verification_maintenance` session flag. Ordinary application code does
not set this flag.

No production or Render database was accessed.

## 6. Test and validation results

### Phase 6 verification

- Verification unit and architecture tests: 20 passed, 0 failed.
- Verification runtime integration: 1 passed, 0 failed.
- Fabricated engine completion: rejected.
- Offer-state conflict: failed closed through Decision Engine.
- Snapshot-fingerprint mismatch: failed closed through Decision Engine as
  `manual_review` with `TECHNICAL-011` /
  `SCHEMA_INCONSISTENCY`.
- Completed-attempt mutation: rejected by database with SQLSTATE `55000`.
- Recorded current versions: resolved exactly.
- Missing recorded versions: failed closed through `SYSTEM-001`.
- Corrected-revision history: preserved.
- Concurrent/stale workflow result: remained safe.

### Marketplace

- Marketplace policy: 4 passed.
- Marketplace presentation: 3 passed.
- Marketplace runtime: 1 passed.
- Public result: HTTP 200, zero published offers.

### Recovery regression suite

- API request contract: 4 passed.
- Authentication characterization: 10 passed.
- Authentication runtime: 1 passed.
- Dashboard unit: 6 passed.
- Dashboard runtime: 1 passed.
- Marketplace characterization: 2 passed.
- Offer characterization: 4 passed.
- Draft validation: 8 passed.
- Draft runtime: 1 passed.
- Submission runtime: 1 passed.
- Migration utility: 5 passed.
- Recovery/OpenAI isolation: 9 passed.

Total observed test cases across the executed commands:

- passed: 81;
- failed: 0;
- skipped: 0.

### Required commands

- `npm run check`: passed.
- `npm run build`: passed.

Non-blocking existing build warnings:

- Browserslist data is outdated;
- one frontend chunk exceeds the configured warning threshold.

## 7. Protected-data validation

Final read-only validation confirmed:

- recovery marker: valid;
- migration 0009: succeeded;
- migration 0010: succeeded;
- legacy users: unchanged;
- legacy offers: unchanged;
- recovery-owned test offers: 0;
- verification test records across all Phase 6 tables: 0;
- sessions: 0;
- marketplace published offers: 0;
- application schema fingerprint: unchanged;
- hardening fingerprint: exact match.

No credential, connection string, personal row content, session identifier, or
secret was printed or stored.

## 8. Remaining technical debt

No remaining known deviation blocks Architecture V2 compliance for the active
Phase 6 scope.

The following contained future work remains:

1. The database maintenance flag is an operational guard, not a security
   boundary against a deliberately malicious database owner. Production
   deployment should use a restricted application role that cannot perform
   migration maintenance.
2. When a new governed policy version is introduced, the previous frozen
   version must remain registered; no dynamic policy administration is
   implemented or authorized.
3. Phase 6 SQL tables remain outside the Drizzle schema model. The SQL
   migration and runtime domain contracts are authoritative for now.
4. The eligibility read model remains a contract only because downstream
   publication integration is not authorized.
5. Browserslist data and frontend chunk size remain repository-wide deployment
   optimization concerns unrelated to verification architecture.

## 9. Commits

- `4669850a5fc0c8c0173ff7d50778b42db24ae8d7`
  — restore Decision Engine ownership, sealed completion, policies, snapshots,
  and architecture tests.
- `bc31d5cbc73e3337eb420a54ce07a664ed52e882`
  — add narrow database immutability protection and integration regressions.
- `eba8eabb25c1cfa8f9dc1ddc952178c56aa13fec`
  — freeze governed policy versions and prove registry immutability.
- Phase 6D report — the commit containing this document.

## 10. Working tree and stop boundary

The working tree is expected to be clean after the report commit.

Phase 6D is complete.

Phase 7 has not been started and remains unauthorized.
