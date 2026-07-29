# Phase 7B-6A — Pure Policy Runtime

## 1. Phase Summary

Phase 7B-6A implements the pure Organization Verification Policy Runtime over
the executable Rule contracts frozen in Phase 7B-6A.0.

The Runtime consumes exactly:

- one authentic Evaluation Input;
- one authentic exact Policy Set;
- one authentic exact Rule Implementation Set;
- one authentic explicit Execution Artifacts contract.

It produces:

- immutable frozen Policy-domain Findings;
- immutable frozen Policy-domain Rule Evaluation Results;
- one immutable frozen Policy Evaluation Completion;
- one authenticated immutable Policy Evaluation Execution;
- one deterministic canonical SHA-256 execution fingerprint.

The Runtime is not wired into startup, workflow, routes, workers, providers, or
persistence.

## 2. Authorization Boundary

Implemented:

- `executeOrganizationVerificationPolicyEvaluation`;
- exact compatibility validation before Rule execution;
- deterministic execution of every exact bound implementation;
- Evaluation Input Fact View consumption;
- technical adaptation into the frozen Policy Input contract;
- Findings through the existing Policy factory;
- Rule Results through the existing Policy factory;
- Completion through the existing frozen aggregator;
- typed framework failures;
- canonical execution fingerprinting;
- deep immutability and authenticity;
- architecture enforcement;
- synthetic pure-domain tests.

Not implemented:

- production business Rules;
- Policy selection, Policy Registry, dynamic loading, or fallback;
- Decision or Decision Engine invocation;
- Trust Status or Trust Status Deriver invocation;
- Participation Eligibility;
- Workflow Coordinator;
- Attempt creation or lifecycle transition;
- persistence, database, schema, or migrations;
- provider, network, storage, queue, worker, route, controller, startup, UI, or
  environment access.

## 3. Accepted Baseline

- Branch: `architecture/phase-7a-organization-trust`
- Accepted predecessor:
  `3b787aca22264f2e069567465f7d56f4930ad4e6`
- Starting HEAD: exactly the accepted predecessor
- Starting working tree: clean
- Baseline tests: 510/510 passed

No `.env` was loaded, no database was accessed, and the application was not
started.

## 4. Frozen Architecture Preserved

No semantic change was made to:

- Registry;
- Organization Verification Core or Attempt lifecycle;
- Evidence Snapshot;
- Evaluation Projection;
- Evaluation Input;
- Policy Set or Rule semantics;
- Finding semantics;
- Rule Evaluation Result semantics;
- aggregation precedence or completeness;
- Policy Evaluation Completion vocabulary;
- normalized adapter;
- Decision or Decision Applicability;
- Trust Status.

The only predecessor-contract correction canonically orders explicit Result
and Finding artifacts inside `ExecutionArtifacts`. That makes the implemented
behavior match the already approved Phase 7B-6A.0 requirement that caller
collection order has no semantic effect.

## 5. Runtime Execution Model

```text
Authenticated Evaluation Input
          +
Authentic exact Policy Set
          +
Authentic exact Implementation Set
          +
Authentic explicit Execution Artifacts
          |
          v
Exact compatibility and chronology validation
          |
          v
Evaluation Input -> approved frozen Fact View
          |
          v
Every bound Rule Implementation exactly once
          |
          v
Frozen Findings + frozen Rule Results
          |
          v
Existing frozen Policy aggregator
          |
          v
Frozen Policy Evaluation Completion
          |
          v
Authenticated immutable Execution + SHA-256 fingerprint
```

No step performs I/O or discovers an input.

## 6. Exact Compatibility Validation

Validation completes before the first Rule executes.

Evaluation Input and Policy Set must match exactly on:

- Policy Set ID;
- Policy Set version;
- Policy contract version;
- Policy provenance reference;
- Policy integrity reference.

Policy Set and Implementation Set must match exactly on:

- Policy Set ID;
- Policy Set version;
- deterministic Policy Set fingerprint.

Execution Artifacts must match exactly on:

- Evaluation Input ID;
- Evaluation Input version;
- Evaluation Input fingerprint;
- Implementation Set ID;
- Implementation Set version;
- Implementation Set fingerprint.

Fake or object-spread inputs fail their respective authenticity guards.

## 7. Policy Set Consumption

The Runtime receives one exact Policy Set from its caller.

It does not:

- select a Policy;
- query a registry;
- infer a Policy from jurisdiction or organization type;
- read UI or environment configuration;
- resolve `latest`, `current`, `default`, or `head`;
- fall back to another Policy.

The Runtime recomputes the canonical Policy Set fingerprint and compares it
with the exact Implementation Set binding.

## 8. Rule Implementation Consumption

The Runtime accepts only an authenticated Implementation Set created by the
Phase 7B-6A.0 contract.

That contract has already proven:

- one Implementation per exact `(Rule ID, Rule version)`;
- no missing Implementation;
- no extra Implementation;
- no duplicate Implementation;
- no version mismatch;
- no Policy Set mismatch;
- deterministic binding order.

The Runtime iterates that frozen order. No hidden Rule is discovered, inserted,
skipped, or loaded.

## 9. Evaluation Fact Boundary

Each Rule receives only
`OrganizationVerificationPolicyEvaluationFactView`.

The view exposes only the fact sections already present in the authenticated
Evaluation Input:

- Registry facts;
- submission facts;
- evidence facts.

The Runtime and Rule contracts do not import Snapshot or Projection. They
cannot re-expand redacted facts or broaden Evaluation Scope.

## 10. Frozen Policy Input Bridge

The existing frozen Finding, Result, and aggregation factories consume the
earlier Policy Evaluation Input shape. A private technical adapter creates that
shape from the authenticated Evaluation Input using public validation
factories.

The adapter:

- preserves Organization, Record, Revision, Attempt, Profile Revision, and
  Policy identities;
- validates Snapshot ID and fingerprint through Core factories;
- validates correlation, provenance, and integrity references through their
  public factories;
- preserves only semantic evidence references already present in the fact
  surface;
- preserves declared Registry activity codes already present;
- uses the frozen v1 Registry contract constant required by the frozen Policy
  Input contract;
- fails closed when Registry facts required by the frozen Policy factory are
  absent;
- creates no business conclusion.

Rules do not receive this bridge object. They receive only the approved Fact
View.

## 11. Rule Execution Contract

Every implementation is invoked exactly once in a successful execution.

The returned value must:

- be a valid frozen Policy disposition;
- exactly match the bound Rule metadata disposition.

An exception, unsupported value, or mismatch becomes a typed Runtime framework
failure. It is never converted into a Finding.

No production implementation is included. Every implementation used by tests
is synthetic and exists only in the test file.

## 12. Findings

Finding identities, timestamps, provenance, and integrity references come only
from explicit authenticated Execution Artifacts.

Finding semantics come only from the exact frozen Rule metadata and validated
Rule disposition.

The Runtime calls only
`createOrganizationVerificationFinding`. It does not construct a Finding
literal or expose a competing Finding model.

Finding artifacts are canonically ordered by Policy Rule order and Finding ID.
Malformed, duplicate, conflicting, or chronologically invalid Findings fail
closed through existing Policy authority.

## 13. Rule Evaluation Results

Each bound Rule receives exactly one explicit Rule Result ID.

The Runtime calls only
`createOrganizationVerificationRuleEvaluationResult` and supplies:

- the exact Rule;
- the adapted exact Policy Input;
- the validated exact disposition;
- explicit execution and result timestamps;
- immutable Findings;
- explicit provenance, correlation, and integrity references.

The output Execution binds each external Rule Result ID to the corresponding
authentic frozen Rule Result without changing the frozen Result vocabulary.

## 14. Policy Evaluation Completion

The Runtime calls the existing
`completeOrganizationVerificationPolicyEvaluation` aggregator.

It supplies:

- the exact Policy Set;
- the adapted exact Policy Input;
- authentic frozen Rule Results;
- explicit completion identity and timestamps;
- explicit provenance, correlation, and integrity references.

The internal Policy Evaluation Completion constructor remains private to the
frozen aggregator.

## 15. Frozen Aggregation

Aggregation logic was not modified.

The existing semantics continue to own:

- required Rule completeness;
- Rule ordering;
- duplicate and conflicting Result rejection;
- identity and chronology checks;
- Finding summarization;
- `evaluation_error` separation;
- classification precedence.

Synthetic tests prove that a satisfied Rule plus a revision-required Rule still
produces the previously frozen `revision_required` classification.

## 16. Framework Failure Separation

Runtime failures use
`OrganizationVerificationPolicyRuntimeFailureCode`.

They are separate from:

- Reason Codes;
- Findings;
- Rule dispositions;
- Completion classifications;
- Decision outcomes;
- Trust Status.

The Runtime returns no partial Execution on failure. A thrown Rule or invalid
Rule disposition produces no returned Finding, Rule Result, or Completion.

## 17. Chronology

All timestamps are caller supplied.

Before Rule execution, the Runtime verifies:

- execution start is not before Evaluation Input request time;
- execution start is not before Evaluation Input effective time;
- completion is not before start;
- execution starts inside the Policy Set effective interval;
- the Policy Set is structurally active.

The existing Finding, Result, and aggregator factories perform their frozen
additional chronology checks.

No system clock is read.

## 18. Deterministic Ordering

Canonical ordering is:

- Rule Implementations: Policy Set `evaluationOrder`;
- Rule Result artifacts: Policy Set `evaluationOrder`;
- Finding artifacts: Policy Set `evaluationOrder`, then Finding ID;
- Rule Results: frozen aggregator Policy order;
- aggregate summaries: existing frozen category ordering.

Caller Rule, Result, and Finding collection order does not alter the Execution
or its fingerprint.

## 19. Execution Fingerprint

The SHA-256 fingerprint covers:

- Execution ID and exact Runtime versions;
- Evaluation Input ID, version, and fingerprint;
- Policy Set ID, version, and fingerprint;
- Implementation Set ID, version, and fingerprint;
- canonical Execution Artifacts fingerprint;
- explicit chronology, provenance, and integrity;
- ordered Rule Result ID bindings and frozen Results;
- ordered Findings;
- frozen Policy Evaluation Completion.

Object-key insertion order and caller collection order are canonicalized.
Semantic changes change the fingerprint. Callers may provide an expected
fingerprint; mismatch fails closed.

## 20. Authenticity and Immutability

The Execution carries a module-private Symbol seal that is non-enumerable,
non-configurable, and non-writable. The object and all Runtime-owned arrays and
bindings are frozen.

Nested Findings, Results, and Completion are already frozen by their existing
Policy factories.

Object spread cannot copy authenticity. The public Boolean guard rejects
spread impersonations.

## 21. Input Mutation Protection

The Runtime does not mutate:

- Evaluation Input;
- Policy Set;
- Implementation Set;
- Execution Artifacts;
- Rule metadata;
- Fact View.

Fact View and artifact contracts defensively copy caller-owned collections.
Synthetic mutation tests prove execution ordering and output remain stable.

## 22. Decision, Trust, Eligibility, and Workflow Separation

The Runtime:

- creates no Decision;
- does not invoke Decision Engine;
- creates no Trust Status;
- does not invoke Trust Status Deriver;
- creates no Eligibility;
- implements no Workflow Coordinator;
- creates no Attempt;
- performs no Attempt transition;
- performs no notification or scheduling.

The output vocabulary contains none of these authorities.

## 23. Infrastructure Separation

Production Runtime dependencies are limited to:

- local Runtime modules;
- Evaluation Input public contracts;
- Policy public contracts and frozen factories;
- Phase 7B-6A.0 execution-contract public surface;
- narrowly curated public Core identity factories for the Policy bridge;
- Node's SHA-256 primitive.

There is no database, ORM, schema, migration, repository, Registry lookup,
provider, environment, storage, network, route, controller, queue, worker,
startup, frontend, OpenAI, Stripe, or Sentry dependency.

## 24. Public Export Surface

The Runtime exports only:

- exact execution and executor versions;
- execution fingerprint value factory and type;
- `executeOrganizationVerificationPolicyEvaluation`;
- execution input and output read contracts;
- typed Runtime failures;
- one narrow Execution authenticity guard.

It does not export:

- seals;
- internal constructors;
- canonicalization or hashing helpers;
- success/failure constructors;
- the private Policy Input adapter;
- mutable collectors;
- Rule dispatch internals;
- test fixtures;
- wildcard module surfaces.

## 25. Architecture Enforcement

Architecture tests now prove:

- Runtime consumes Evaluation Input, not Snapshot or Projection;
- only curated public surfaces are imported;
- database, provider, Registry, environment, clock, and ID generation are
  forbidden;
- Decision, Trust, Eligibility, and Attempt authority are forbidden;
- production business Rule construction is forbidden;
- only the sole Executor may invoke a Rule or the frozen Finding, Result, and
  Completion factories;
- only the model and sole Executor may construct authenticated Executions;
- private seals, adapters, and canonicalization cannot be exported;
- Runtime cannot be wired outside the curated domain boundary.

Ten new intentional violation tests enforce these boundaries.

## 26. Files Added or Changed

Added:

- `server/organization-verification/domain/policy-runtime/errors.ts`
- `server/organization-verification/domain/policy-runtime/ids.ts`
- `server/organization-verification/domain/policy-runtime/canonical.ts`
- `server/organization-verification/domain/policy-runtime/policyInputAdapter.ts`
- `server/organization-verification/domain/policy-runtime/policyEvaluationExecution.ts`
- `server/organization-verification/domain/policy-runtime/policyEvaluationExecutor.ts`
- `server/organization-verification/domain/policy-runtime/index.ts`
- `server/organization-verification/domain/policy-runtime/policyRuntime.test.ts`
- this document

Changed:

- `server/organization-verification/domain/policy-runtime-contract/executionArtifacts.ts`
- `server/organization-verification/domain/index.ts`
- `server/organization-verification/architecture.test.ts`
- `package.json`

## 27. Tests and Results

New Runtime tests: 26/26 passed.

Architecture tests: 100/100 passed, including ten new Runtime-boundary tests.

Final full validation:

- `npm run check`: passed
- `npm run build`: passed with existing advisory warnings only
- `npm run test:verification-engine`: 20/20 passed
- `npm run test:organization-verification-architecture`: 100/100 passed
- `npm run test:organization-registry-contracts`: 11/11 passed
- `npm run test:organization-verification-core-domain`: 11/11 passed
- `npm run test:organization-verification-decision-domain`: 9/9 passed
- `npm run test:organization-verification-trust-status-domain`: 14/14 passed
- `npm run test:organization-verification-policy-domain`: 84/84 passed
- `npm run test:organization-verification-evidence-snapshot-domain`: 75/75
  passed
- `npm run test:organization-verification-evaluation-projection-domain`:
  54/54 passed
- `npm run test:organization-verification-evaluation-input-domain`: 87/87
  passed
- `npm run test:organization-verification-evaluation-preparation-pipeline`:
  26/26 passed
- `npm run test:organization-verification-policy-runtime-contract`: 29/29
  passed
- `npm run test:organization-verification-policy-runtime`: 26/26 passed

Total: 546/546 tests passed.

## 28. Runtime, Schema, and Data Impact

- Pure Runtime capability: implemented but not wired
- Existing application behavior: unchanged
- Startup impact: none
- Schema or migration impact: none
- Database or persistence impact: none
- Business data impact: none
- Provider or network impact: none
- Environment access: none

Findings, Rule Results, and Completion were produced only in memory by
synthetic tests.

## 29. Risks and Limitations

- No production Rule exists, so the Runtime has no live business behavior.
- The frozen Policy Input bridge requires Registry facts in Evaluation Scope;
  inputs without them fail closed.
- The current executable Rule contract returns only the frozen disposition.
  Finding evidence-reference and attribute enrichment is therefore not added
  by this Runtime.
- A future governed package process must verify implementation digests before
  supplying a production Implementation Set.
- Execution is not persisted, scheduled, retried, or coordinated.

## 30. Rollback Strategy

The phase is additive and has no database changes. Rollback consists of
reverting the Phase 7B-6A commit. No data repair is required.

## 31. Formal Verdict and Stop Confirmation

Phase 7B-6A is complete as a pure, deterministic, authenticated, immutable,
fail-closed Policy Runtime.

No production business Rule was invented. No Decision, Trust Status,
Eligibility, Workflow, Attempt transition, database operation, provider call,
startup wiring, or environment access occurred.

The next phase did not begin.
