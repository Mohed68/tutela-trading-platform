# Phase 7B-3B — Decision Model and Decision Engine

## 1. Slice Summary

This slice adds the pure Organization Verification Decision domain. It accepts a
validated, sealed, capability-neutral evaluation completion and deterministically
produces one immutable Organization Verification Decision.

## 2. Authorization Boundary

Work is limited to the Decision model, normalized evaluation contract, sealed
completion boundary, Decision Engine, value objects, typed failures, tests,
architecture enforcement, a test command, and this recovery record.

No Trust Status, policy evaluation, finding, workflow coordination, persistence,
schema, migration, database, route, worker, startup, frontend, or provider work
is included.

## 3. Baseline Commit and Validation

- Branch: `architecture/phase-7a-organization-trust`
- Accepted predecessor: `b214d098f2e6542f000fc6be12386e336c3483fe`
- Starting HEAD: exactly the accepted predecessor
- Starting working tree: clean
- TypeScript check: passed
- Production build: passed with only the pre-existing Browserslist and chunk-size
  warnings
- Phase 6 Verification Engine regression suite: 20/20 passed
- Organization Verification architecture suite: 18/18 passed
- Organization Registry contract suite: 11/11 passed
- Organization Verification core-domain suite: 11/11 passed

No schema or migration change was pending or made. No application startup,
database connection, or environment loading was required.

## 4. Architecture-Frozen Areas Preserved

The Decision Engine is the sole Decision construction authority. The engine does
not complete Attempts or own lifecycle transitions. Organization Registry remains
the authority for organization identity, profile, and lifecycle data. Offer
Verification and Participation Eligibility remain separate capabilities.

There is no legacy authority inference, runtime dependency, database dependency,
or trust inheritance in this domain.

## 5. Decision Vocabulary

The exhaustive production vocabulary is:

- `approved`
- `revision_required`
- `manual_review`
- `rejected`

These values are Decision outcomes only. They are not Attempt process states,
Organization Lifecycle values, Trust Status values, eligibility decisions,
publication permissions, transaction authorizations, user verification, or offer
verification.

## 6. Normalized Evaluation Input Design

`RawNormalizedOrganizationVerificationEvaluation` is a capability-neutral
construction input. It carries exact Record, Revision, Attempt, Organization,
Snapshot, completion, policy-provenance, time, integrity, classification-signal,
summary, and correlation data.

It deliberately exposes no Policy Framework, Finding, Rule, Reason Code,
Severity, provider, compliance, KYB, document-validation, or sanctions types.
Raw Boolean signals exist only at the sealing boundary and cannot reach the
Decision Engine directly.

## 7. Sealed Completion Model

`sealNormalizedEvaluationCompletion` validates:

- evaluation completeness and integrity;
- exact non-empty identity and provenance values;
- immutable policy-set references, rejecting `latest`, `current`, and `head`;
- a valid completion timestamp;
- exactly one mutually exclusive normalized classification;
- valid optional category summaries.

Missing, contradictory, unsupported, incomplete, or integrity-invalid input
returns a typed failure and no completion. The result is defensively copied,
deeply frozen for its nested collection, and carries a module-private seal.
Arbitrary object literals cannot impersonate it.

## 8. Decision Model

`OrganizationVerificationDecision` records one Decision ID, Record, Revision,
completed Attempt, Organization, immutable Snapshot identity and fingerprint,
evaluation completion, outcome, engine version, opaque policy provenance,
decision time, correlation reference, opaque integrity reference, and optional
historical supersession reference.

The Decision and nested provenance are frozen. A module-private seal prevents
unrestricted construction. Decisions are historical facts: there is no reopen,
edit, outcome mutation, or earlier-Decision mutation operation.

## 9. Decision Engine Authority

`decideOrganizationVerification` is pure, deterministic, synchronous, and
side-effect free. All time and identity values are supplied explicitly. It reads
only a genuinely sealed completion and completed core-domain context.

The unrestricted constructor is not exported by the public Decision-domain
surface. Architecture enforcement permits its use only inside
`decisionEngine.ts`; reviewers, routes, repositories, workers, coordinators,
policies, and adapters cannot use it.

## 10. Deterministic Mapping Table

| Normalized classification | Decision |
|---|---|
| approval_ready | approved |
| revision_required | revision_required |
| manual_review_required | manual_review |
| rejection_required | rejected |

There is no fallback outcome. In particular, malformed data is never converted
to `manual_review`.

## 11. Attempt Completion Preconditions

The engine requires `Attempt.processState === "completed"` and validates exact
agreement across the completion and supplied context for:

- Attempt ID;
- Verification Record ID, including Record, Revision, and Attempt links;
- Verification Revision ID, including Revision and Attempt links;
- Organization ID through Record and Revision;
- Snapshot ID;
- Snapshot fingerprint;
- core completion reference and evaluation completion ID.

The engine does not invoke the Attempt transition function.

## 12. Uniqueness and Idempotency Model

The caller supplies a stable Decision identity and may supply an existing
Decision for retry protection. An identical retry returns the existing immutable
Decision. A different Decision ID for the same completion produces
`duplicate_decision_for_completion`. Any changed outcome, identity, provenance,
engine, timestamp, integrity, correlation, or supersession context produces
`conflicting_decision_for_completion`.

Persistence must later enforce a unique constraint for evaluation completion
identity. That persistence work is deliberately deferred.

## 13. Immutability Strategy

The implementation uses readonly opaque value types, defensive array and object
copies, `Object.freeze`, and module-private authenticity seals. Tests demonstrate
that caller mutation cannot change normalized summaries, policy provenance, the
Decision outcome, timestamps, Snapshot references, or a prior Decision.

No third-party immutability dependency was added.

## 14. Reviewer Authority Protection

`manual_review` means only that the sealed normalized evaluation requires
manual-review handling. No reviewer model, workflow, UI, input, Decision factory,
override, or mutation authority exists. Architecture fixtures prove that a
reviewer module attempting to access Decision construction is rejected.

## 15. Legacy Protection Evidence

Synthetic tests prove that arbitrary objects based on legacy verification
Booleans, company names, roles, seller flags, offer ownership, document presence,
UI status, Registry lifecycle, or reviewer-selected outcomes cannot be consumed
as sealed evaluation completions and cannot produce Decisions.

No real database row or personal data was read.

## 16. Architecture Enforcement Updates

The repository scanner now:

- isolates the newly authorized Decision subdomain from the earlier core-domain
  later-slice prohibition;
- restricts Decision-domain imports to approved local Decision modules,
  Phase 7B-3A core surfaces, and the public Organization Registry contract;
- rejects runtime, persistence, schema, provider, Offer Verification, and future
  capability dependencies;
- rejects Trust Status, eligibility, Finding, Rule, Reason Code, Severity, and
  policy-authority artifacts;
- rejects Decision construction outside the Decision Engine;
- rejects Attempt lifecycle transitions inside the Decision Engine;
- rejects runtime wiring of the Decision Engine.

Intentional violation fixtures cover each newly enforced boundary.

## 17. Files Added or Changed

Added:

- `server/organization-verification/domain/decision/errors.ts`
- `server/organization-verification/domain/decision/ids.ts`
- `server/organization-verification/domain/decision/normalizedEvaluation.ts`
- `server/organization-verification/domain/decision/sealedEvaluationCompletion.ts`
- `server/organization-verification/domain/decision/decision.ts`
- `server/organization-verification/domain/decision/decisionEngine.ts`
- `server/organization-verification/domain/decision/index.ts`
- `server/organization-verification/domain/decision/decision.test.ts`
- this document

Changed:

- `server/organization-verification/domain/index.ts` — public Decision-domain
  export only
- `server/organization-verification/architecture.test.ts` — Decision-slice
  enforcement and fixtures
- `package.json` — one narrowly scoped Decision-domain test command

## 18. Runtime, Schema, and Database Impact

There is no runtime wiring and no application behavior change. No route, startup,
worker, frontend, repository, schema, migration, seed, or database operation was
added or executed. No `.env` file was loaded or printed.

## 19. Tests and Results

The dedicated command is:

`npm run test:organization-verification-decision-domain`

It covers the four exact mappings, every invalid completion category, Attempt
states and identity mismatches, immutable construction, idempotent retry,
conflicting construction, legacy non-authority inputs, and value-object
validation.

Final validation results:

- `npm run check`: passed
- `npm run build`: passed; only the pre-existing Browserslist age and chunk-size
  advisory warnings remain
- `npm run test:verification-engine`: 20/20 passed
- `npm run test:organization-verification-architecture`: 23/23 passed
- `npm run test:organization-registry-contracts`: 11/11 passed
- `npm run test:organization-verification-core-domain`: 11/11 passed
- `npm run test:organization-verification-decision-domain`: 9/9 passed

## 20. Risks and Limitations

- Domain-level idempotency cannot replace a future storage unique constraint.
- The policy provenance and Decision integrity values are opaque references;
  canonical policy execution and cryptographic fingerprint generation are
  intentionally absent.
- Sealed completions are constructed in-process. A future evaluator must own
  their creation without exposing its policy internals.
- Supersession is historical metadata only; current applicability belongs to
  the later Trust Status slice.

## 21. Deferred Work

Deferred work includes Trust Status and its Deriver, Policy Framework, Rules,
Findings, Reason Codes, verified facts, evaluator execution, Workflow
Coordinator, review workflow, persistence, database uniqueness, repositories,
runtime adapters, routes, workers, UI, providers, audit persistence, expiry, and
invalidation.

## 22. Rollback Strategy

Revert the single Phase 7B-3B commit. The change is additive and inert, so
rollback requires no schema reversal, data repair, environment change, or
runtime shutdown.

## 23. Stop Confirmation

Phase 7B-3B stops after its pure Decision domain, enforcement, tests,
documentation, and commit.

No Trust Status model or Deriver was implemented. No Policy Framework or Finding
model was implemented. No reviewer Decision authority or Workflow Coordinator
was implemented. No persistence, schema, migration, database, route, startup,
worker, or frontend work occurred. Phase 6 behavior and Phase 7B-3A core
semantics remain unchanged. Phase 7B-3C has not begun.
