# Phase 6C — Verification Engine Architecture Compliance Report

Date: 2026-07-28

Status: complete; final architecture compliance audit

Authoritative reference:
`docs/architecture/verification-engine-v2.md`

Implementation audited: Phase 6B through commit
`ccc21174e64cf79d962b47b60a319c5a770c9efc`

Audit mode: documentation-only and read-only

## 1. Executive conclusion

The Phase 6B implementation is **substantially but not fully compliant** with
the approved Phase 6A Architecture Specification Version 2.

The implementation correctly preserves the major domain separations:

- Verification Process and Verification Decision are distinct contracts and
  persistence fields.
- the Decision Engine contains no database or offer-lifecycle mutation;
- the Workflow Coordinator is the only runtime Phase 6 component that changes
  an offer after verification;
- snapshots are allowlisted and fingerprinted;
- findings and events are written as history;
- Reason Codes, Rule IDs, severity, dispositions, and policy versions are
  structured;
- severity does not participate in decision reduction;
- excluded business domains are absent from the verification implementation;
- marketplace publication remains separate and fail-closed.

However, two implementation paths prevent a finding of full compliance:

1. `server/verification/repository.ts` can replace the Decision Engine's
   completed decision with `manual_review`, change confidence, and append a
   `SYSTEM-003` finding when it detects an offer-state conflict. This assigns
   decision ownership to persistence/orchestration as well as the Decision
   Engine.
2. `completeClaimedVerification` accepts a caller-provided
   `VerificationEngineResult` and persists it without an enforceable
   provenance boundary. An internal caller holding a valid claim can therefore
   bypass the Decision Engine.

Additional partial-compliance concerns exist around cross-family policy
coupling and enforcement of immutability at the database boundary.

No behavior was changed during this audit. No database operation or migration
was executed.

## 2. Audit scope and method

The audit compared the authoritative Version 2 specification against:

- `shared/verification.ts`;
- all modules under `server/verification/`;
- the submission integration in `server/drafts/storage.ts`;
- worker startup integration in `server/index.ts`;
- `migrations/0009_verification_engine.sql`;
- Phase 6B static, unit, architecture, and runtime tests;
- all runtime-source references to the new verification tables and public
  orchestration functions;
- all runtime-source writes to offer lifecycle and verification history;
- all imports and textual references to excluded domains.

The audit also ran:

- `npm run test:verification-engine`;
- `npm run check`;
- `npm run build`.

The database-backed Phase 6B regression was not repeated because Phase 6C is a
read-only architecture audit and the existing Phase 6B evidence was sufficient
to characterize runtime behavior.

## 3. Architecture Compliance Matrix

| ID | Architecture requirement | Status | Evidence | Audit conclusion |
|---|---|---|---|---|
| AC-01 | Decision Engine owns only verification decisions | **Deviation** | `server/verification/engine.ts`; `server/verification/repository.ts:352-373` | The engine itself is pure, but the repository also creates a finding and replaces decision/confidence. Decision authority is therefore split. |
| AC-02 | Workflow Coordinator owns lifecycle transitions | **Compliant** | `server/verification/coordinator.ts:13-147`; repository-wide lifecycle-write scan | Post-verification `submitted → verified/draft/submitted` mapping is isolated in the coordinator. Owner submission remains the approved exception. |
| AC-03 | Verification Process remains independent from Verification Decision | **Compliant** | `shared/verification.ts:1-17`; migration attempt consistency constraints | Process has independent `queued/running/completed` state and decision remains null until completion. `not_started` remains a domain state but is not persisted because submission queues atomically. |
| AC-04 | Offer Lifecycle remains independent from Verification Engine | **Compliant** | `server/verification/engine.ts`; `server/verification/architecture.test.ts:28-48` | The engine imports neither database nor lifecycle code and never updates offers. Lifecycle application occurs after decision persistence through the coordinator. |
| AC-05 | Snapshots remain immutable | **Partial** | `server/verification/snapshot.ts`; migration snapshot/fingerprint columns; repository insert-only snapshot paths | Runtime code does not update snapshots, and canonical fingerprints exist. The TypeScript snapshot is mutable, completion does not revalidate the stored fingerprint, and the database has no update/delete guard. |
| AC-06 | Verification history remains append-only | **Partial** | repository event/finding inserts; `ON DELETE RESTRICT` relations | Production repository paths append findings, events, and transitions. Database permissions/triggers do not independently prohibit update/delete by the application role. Test cleanup deliberately deletes recovery-owned history. |
| AC-07 | Reason Codes remain machine-readable | **Compliant** | `shared/verification.ts:57-84`; `server/verification/catalog.ts`; migration checks | Codes are closed, stable identifiers without human copy, customer values, or exception text. |
| AC-08 | Rule IDs remain stable | **Compliant** | `shared/verification.ts:87-103`; catalog and migration checks | Rule identity is independent from reason code and policy version and is constrained in code and SQL. |
| AC-09 | Severity remains metadata only | **Compliant** | `server/verification/engine.ts:20-30`; architecture and engine tests | Decision reduction reads disposition only. Severity does not affect decision, confidence, lifecycle, or publication. |
| AC-10 | Technical and Commercial Policy remain independent | **Partial** | `server/verification/policy.ts`; `server/verification/rules.ts:153-190` | Versions and configuration objects are separate. Commercial validation nevertheless reads Technical Policy's recognized-unit list and currency pattern, so a technical change can change commercial findings without a commercial-policy change. |
| AC-11 | No KYB, Marketplace, Compliance, Payments, Orders, Contracts, Notifications, Blockchain, or AI decisions | **Compliant** | exact-term scan of shared verification contract and runtime verification modules | No excluded-domain dependency or side effect is present. Marketplace code does not query Phase 6 verification tables. |
| AC-12 | No bypass of Workflow Coordinator | **Compliant in production runtime** | call-site and lifecycle-write scans | The worker invokes the coordinator after persisted completion. No other production Phase 6 path applies verification-driven lifecycle transitions. Direct calls exist only in controlled tests. |
| AC-13 | No bypass of Decision Engine | **Deviation** | `server/verification/repository.ts:376-539` | Completion accepts any structurally valid `VerificationEngineResult`; the repository does not prove that the result came from `evaluateVerification`. |
| AC-14 | No bypass of history | **Compliant in active workflow; enforcement gap** | `queueVerificationAttempt`, `completeClaimedVerification`, coordinator transactions | Active queue, completion, and transition paths record their required history atomically. Direct database privileges remain capable of bypassing append-only intent. |
| AC-15 | No bypass of snapshots | **Partial** | `queueVerificationAttempt`; `claimNextVerification`; completion signature | The active worker evaluates the stored snapshot. The claimed JavaScript object is mutable, and completion does not compare a newly computed fingerprint with the immutable stored fingerprint. |
| AC-16 | Technical and commercial rule execution remains deterministic | **Compliant with reproducibility debt** | engine/rules tests; injected `evaluatedAt` option | Rules perform no I/O. The engine permits implicit current policies and `new Date()` when dependencies are omitted, so strict dependency injection is conventional rather than enforced. |
| AC-17 | Durable automatic trigger and retry model | **Compliant** | `server/drafts/storage.ts:398-480`; repository claim/recovery; migration uniqueness | Submission atomically creates revision, attempt, queued event, and command. Leases, hashes, uniqueness, expiry recovery, and compare-and-set completion are present. |
| AC-18 | Decision and lifecycle history remain distinct | **Compliant** | separate attempt/event/finding and workflow-transition tables | Workflow transitions are stored separately and reference the immutable consumed decision. |
| AC-19 | Manual review remains private and submitted | **Compliant** | coordinator lifecycle mapping; runtime regression | `manual_review` targets `submitted` and grants no publication authority. |
| AC-20 | Downstream publication remains decoupled | **Compliant** | source-wide new-table consumption scan | No marketplace or public DTO consumes Phase 6 internals. `VerificationEligibilityProjection` exists only as a shared internal contract. |

Status meanings:

- **Compliant**: implementation evidence satisfies the approved boundary.
- **Partial**: intended runtime path complies, but the boundary is not fully
  enforced or has a contained coupling.
- **Deviation**: implementation responsibility contradicts an explicit Version
  2 ownership rule.

## 4. Detailed deviations

### DEV-01 — Persistence layer changes the verification decision

Severity: High

Architecture rule:

> The Verification Engine produces decisions; the Workflow Coordinator alone
> changes offer lifecycle.

Observed implementation:

- `stateConflictResult` is implemented inside
  `server/verification/repository.ts`.
- it appends the `SYSTEM-003` finding;
- it replaces any prior engine decision with `manual_review`;
- it replaces confidence with `LOW`;
- `completeClaimedVerification` selects between the original engine result and
  this repository-created result after reading current offer state.

Why this is a deviation:

The state-conflict outcome is fail-closed and safe, but safety does not change
the ownership rule. A persistence repository currently owns part of finding
production, confidence derivation, and decision reduction. The stored decision
is not always the decision returned by the Decision Engine.

Current business/runtime effect:

- stale state cannot approve, which is safe;
- the Phase 6B concurrency regression intentionally proves this behavior;
- changing it requires a separately approved implementation phase because it
  affects verified workflow behavior.

Recommended cleanup:

- retain the same fail-closed `manual_review` outcome and `SYSTEM-003` evidence;
- move authoritative conflict-to-finding/decision production behind a
  Decision Engine-owned interface;
- keep the repository limited to concurrency validation and write-once
  persistence;
- keep the coordinator responsible only for current/stale lifecycle
  application;
- add a test proving that no module outside the Decision Engine can construct
  or replace a terminal decision.

No cleanup is performed in Phase 6C.

### DEV-02 — Completion port does not enforce Decision Engine provenance

Severity: High

Observed implementation:

`completeClaimedVerification(claim, engineResult)` is an exported repository
function. It validates the database claim and process state, but accepts the
decision, confidence, versions, and findings supplied by its caller.

Why this is a deviation:

The normal worker calls `evaluateVerification`, but the boundary does not
prevent another internal caller from constructing a compatible result and
persisting it. TypeScript structural typing is not proof of Decision Engine
authority.

Current exposure:

- no HTTP route, client, administrator, or scheduler currently calls this
  function;
- the only production call site is the verification worker;
- controlled runtime tests call it directly;
- the risk is architectural/internal, not a currently exposed public exploit.

Recommended cleanup:

- make the orchestration service own claim → evaluate → complete as a sealed
  operation;
- narrow repository exports to persistence primitives that cannot accept an
  arbitrary terminal business result;
- use an engine-owned opaque completion contract or keep the result-producing
  call private to the orchestration module;
- add call-site architecture tests across the whole verification directory,
  not only `engine.ts`.

No cleanup is performed in Phase 6C.

## 5. Partial-compliance findings

### PC-01 — Commercial rules depend on Technical Policy

Severity: Medium

`runCommercialValidation` reads:

- `policies.technical.recognizedUnits`;
- `policies.technical.currencyIdentifierPattern`.

This suppresses duplicate commercial findings for technically invalid input,
but it creates a direct family dependency. A Technical Policy change may
change which commercial finding is emitted even when the Commercial Policy
Version is unchanged.

Recommended cleanup:

- pass technical-validation outcomes or an independently defined normalized
  validity signal to the decision pipeline;
- prevent commercial rules from reading Technical Policy configuration;
- preserve separate policy versions and the currently approved decisions.

This is cleanup of dependency direction, not authorization to change current
business rules.

### PC-02 — Immutability is conventional rather than fully enforced

Severity: Medium

Positive controls:

- snapshot and attempt identity fields are insert-only in production
  repository code;
- findings/events/transitions use insert-only production paths;
- foreign keys use `ON DELETE RESTRICT`;
- terminal state constraints ensure a completed attempt has decision,
  confidence, and timestamp;
- fingerprint format and logical uniqueness are constrained.

Remaining gaps:

- no database trigger or privilege boundary rejects updates to immutable
  snapshots, completed attempts, findings, or events;
- the application database role is capable of issuing raw SQL;
- `SubmittedOfferVerificationSnapshot` is not a deep-readonly type;
- the snapshot fingerprint is not rechecked at claim completion;
- no automated negative test proves immutable rows reject mutation.

Recommended cleanup:

- design a compatible database immutability enforcement strategy;
- add database-level negative tests in a disposable environment;
- use deep-readonly domain contracts;
- revalidate stored snapshot identity/fingerprint at claim and completion.

Database enforcement would require an additive migration and therefore needs
separate approval.

### PC-03 — Exact provider resolution is implemented only for current versions

Severity: Low to Medium

Attempts record engine, snapshot, technical policy, commercial policy, and
confidence-model versions. The worker compares them with current constants and
fails closed when they differ.

The implementation does not yet retain provider registries capable of
resolving older versions for deterministic replay. A deployment that changes a
policy while an attempt is queued will therefore produce safe manual review
instead of replaying the recorded version.

This is fail-closed and does not violate data safety, but it does not fully
realize the Version 2 provider extension model.

## 6. Required-boundary verification

### 6.1 Decision Engine

Confirmed:

- contains no database import;
- contains no offer update;
- contains no route, authentication, publication, or excluded-domain import;
- uses structured findings;
- reduces by disposition;
- maps confidence independently;
- catches unexpected errors and returns `SYSTEM-999` manual review.

Exception:

- it is not the sole producer of the stored decision because of DEV-01 and
  DEV-02.

### 6.2 Workflow Coordinator

Confirmed:

- reads only completed persisted attempts;
- never imports the rule engine;
- does not run technical/commercial rules;
- checks offer and Submission Revision;
- owns the lifecycle target mapping;
- locks relevant rows;
- records an idempotent separate transition;
- rejects stale results without rerunning verification.

No coordinator bypass exists in active runtime source.

### 6.3 State independence

Confirmed:

- Process State and Decision use separate types and columns;
- decision is absent during queued/running states;
- migration consistency constraints enforce terminal coupling only at
  completion;
- offer status is a separate enum and table field;
- confidence and severity use separate domains;
- eligibility is a projection contract, not an alias for lifecycle or
  decision.

### 6.4 Reason, rule, and severity contracts

Confirmed:

- every Rule ID has one catalog entry;
- every catalog entry contains Reason Code, severity, disposition, and family;
- findings persist policy family/version and deterministic evaluation order;
- SQL checks constrain all initial identifiers;
- the reducer does not read severity;
- human text and raw values are absent from findings.

### 6.5 Excluded domains

No implementation reference or side effect was found for:

- KYB or organization verification;
- marketplace publication;
- compliance, sanctions, or moderation;
- orders, negotiation, trading, or contracts;
- Stripe, payment, escrow, or settlement;
- blockchain;
- notifications or email;
- AI decisions or risk scoring.

The repository may contain legacy or future code for some of these domains,
but Phase 6 modules do not import or invoke it.

## 7. Bypass audit

| Boundary | Active path | Bypass finding |
|---|---|---|
| Workflow Coordinator | Worker consumes persisted decision through coordinator | No production bypass found |
| Decision Engine | Worker normally calls engine before persistence | Internal completion port permits bypass; repository also replaces decisions |
| Verification History | Queue/completion/coordinator record history transactionally | No active workflow bypass; direct database privilege remains |
| Snapshot | Submission creates allowlisted snapshot; worker evaluates stored JSON | Mutable in-memory object and no completion fingerprint recheck |

## 8. Risk assessment

### High

- Split decision ownership can cause future rule or concurrency work to add
  business outcomes outside the Decision Engine.
- The arbitrary-result completion signature makes architectural enforcement
  dependent on developer convention and call-site discipline.

### Medium

- Cross-family policy reads can produce commercial-output changes under only a
  Technical Policy change.
- Application-only immutability is vulnerable to future accidental raw SQL or
  overly broad repository changes.
- Recorded historical policy versions cannot currently be resolved once code
  constants move forward.

### Low

- Current architecture tests inspect selected source text rather than the full
  import/call graph, allowing DEV-01 and DEV-02 to pass.
- Phase 6 persistence tables are represented by SQL and domain contracts but
  not by the repository's Drizzle schema model, increasing schema-drift risk.
- `VerificationEligibilityProjection` is a contract only; no current-result
  repository projection exists yet. This is acceptable while downstream
  consumption remains unauthorized.

Overall operational risk remains contained because:

- the conflicting path is fail-closed;
- there is no public or administrator decision endpoint;
- marketplace remains decoupled;
- the coordinator checks revision currency;
- terminal persistence is transactional;
- Phase 6B unit and runtime regressions passed.

The deviations are nevertheless architectural and should be resolved before
the engine becomes an authority consumed by additional capabilities.

## 9. Recommended cleanup sequence

No item in this section is authorized for implementation by Phase 6C.

1. Restore sole decision ownership:
   move state-conflict finding and decision production behind the Decision
   Engine while preserving the approved fail-closed outcome.
2. Seal the completion boundary:
   prevent callers from supplying an arbitrary terminal result to the
   repository.
3. Remove cross-family policy reads:
   keep technical validity and commercial policy evaluation reproducible
   without one family importing the other's configuration.
4. Add enforcement-focused architecture tests:
   scan repository, worker, coordinator, routes, and call sites for decision
   construction and lifecycle mutation.
5. Design additive immutability controls:
   database privileges/triggers and negative mutation tests, subject to
   explicit migration approval.
6. Add version registries:
   resolve recorded engine/policy/snapshot/confidence versions for queued
   retries and audit.
7. Add schema-authority representation:
   represent Phase 6 tables in the selected schema authority or document the
   intentional SQL-only boundary.

Items 1 and 2 should be treated as architecture compliance remediation rather
than optional modernization.

## 10. Technical debt register

| ID | Debt | Priority | Consequence if deferred |
|---|---|---|---|
| TD-6C-01 | Repository produces a decision/finding | High | Decision logic can spread outside the engine |
| TD-6C-02 | Completion accepts arbitrary engine-shaped output | High | Internal Decision Engine bypass remains possible |
| TD-6C-03 | Commercial rules read Technical Policy | Medium | Independent policy evolution is weakened |
| TD-6C-04 | No database-enforced append-only/immutable guard | Medium | Accidental raw SQL can rewrite evidence |
| TD-6C-05 | Snapshot type and completion identity are not deeply immutable | Medium | Evaluated input could diverge from recorded fingerprint |
| TD-6C-06 | Only current policy versions are resolvable | Medium | In-flight attempts fail closed after version changes |
| TD-6C-07 | Architecture tests cover selected files only | Medium | Cross-module ownership violations can pass |
| TD-6C-08 | Phase 6 tables absent from Drizzle schema model | Low | Schema and application contracts may drift |
| TD-6C-09 | Eligibility read model has no repository implementation | Low/deferred | Downstream integration must wait, as currently intended |

## 11. Future considerations

Future work must preserve these confirmed boundaries:

- KYB remains an independent eligibility fact.
- marketplace publication must consume a stable eligibility projection and
  must never query engine tables directly.
- AI output remains advisory and cannot construct findings or decisions
  without separately approved authority.
- manual-review resolution remains outside immutable automated attempts.
- payments, contracts, orders, blockchain, and notifications remain
  downstream and independent.
- new currencies, units, and normalized measurement remain Commercial Policy
  or future measurement-layer concerns and do not alter historical snapshots.
- any policy upgrade must preserve resolution of recorded policy versions.
- any immutability migration must be additive, rehearsed, and validated against
  protected legacy data.

## 12. Validation results

### Verification unit and architecture suite

Command: `npm run test:verification-engine`

Result: passed

- tests: 14;
- passed: 14;
- failed: 0;
- skipped: 0.

The passing suite proves its current assertions. It does not negate DEV-01 or
DEV-02 because existing architecture tests inspect `engine.ts` and selected
coordinator properties but do not enforce decision provenance across the
repository/worker boundary.

### TypeScript

Command: `npm run check`

Result: passed

### Production build

Command: `npm run build`

Result: passed

The existing non-blocking Browserslist-age and large-chunk warnings remain
outside this architecture audit.

## 13. Audit disposition

Phase 6C is complete.

Final audit disposition:

**Phase 6B is substantially compliant, with two high-priority architecture
deviations and three partial-compliance areas. Full Architecture V2 compliance
is not yet proven.**

The implementation remains fail-closed and its current runtime behavior is
accepted, but Phase 7 should remain blocked until the repository owner reviews
this report and separately authorizes or defers the recommended architecture
compliance remediation.

This report authorizes no implementation, migration, refactor, or business
behavior change.
