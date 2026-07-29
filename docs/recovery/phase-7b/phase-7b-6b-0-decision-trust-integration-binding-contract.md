# Phase 7B-6B.0 — Decision–Trust Integration Binding Contract

## 1. Phase Summary

Phase 7B-6B.0 closes the identity-continuity and integration-fingerprint gap
between the authenticated Policy Runtime Execution, the frozen Decision
Domain, and the frozen Trust Status Domain.

The phase adds contracts only. It does not execute the normalized adapter,
create a Decision, derive Trust Status, transition an Attempt, or wire any
application runtime.

## 2. Accepted Baseline

- Branch: `architecture/phase-7a-organization-trust`
- Accepted predecessor:
  `f629382b4de8fcafeea36af1418994d46b5b5eeb`
- Starting HEAD: exactly the accepted predecessor
- Starting working tree: clean
- Baseline tests: 546/546 passed

No environment file was loaded. No database or application runtime was
accessed.

## 3. Approved Contract Model

```text
Authenticated Policy Runtime Execution
          +
Explicit source-continuity artifacts
          |
          v
Authenticated immutable Integration Input Binding
          |
          + optional authentic Decision + explicit binding evidence
          |
          + optional authentic Trust Status + explicit binding evidence
          |
          v
Authenticated immutable Decision–Trust Integration Binding
```

The binding contract records evidence about already-created authentic domain
objects. It creates none of those objects.

## 4. Trust Status Authenticity Guard Amendment

The approved amendment exports:

`isOrganizationVerificationTrustStatus(value: unknown): boolean`

The guard:

- checks the existing module-private Trust Status seal;
- checks that the value is frozen;
- returns Boolean only;
- exposes no construction capability;
- exposes no seal;
- accepts no trusted structural substitute.

The private Trust Status constructor now installs the existing seal as a
non-enumerable, non-configurable, non-writable property before freezing the
object. This ensures object spread cannot copy authenticity.

The Trust vocabulary, mapping table, applicability, expiry, invalidation,
source-fact validation, chronology, idempotency, and Deriver behavior remain
unchanged.

Architecture enforcement restricts use of the public guard to:

- the Trust Status public validation path; and
- the Decision–Trust integration binding contract.

## 5. Authenticated Input Binding

`createOrganizationVerificationDecisionTrustIntegrationInputBinding` accepts
only:

- an authentic
  `OrganizationVerificationPolicyEvaluationExecution`; and
- explicit integration artifacts.

There is no standalone Policy Completion parameter. The exact Completion is
obtained only from the authentic Runtime Execution.

The input binding preserves:

- binding identity and contract version;
- Runtime execution ID;
- Runtime execution contract version;
- Runtime executor version;
- Runtime execution fingerprint;
- Evaluation Input ID;
- Evaluation Input version;
- Evaluation Input fingerprint;
- Organization ID;
- Verification Record ID;
- Verification Revision ID;
- Attempt ID;
- Snapshot ID and fingerprint;
- Policy Set ID and version;
- Policy Evaluation Completion ID;
- explicit binding time;
- explicit provenance and integrity references;
- `completionBindingFingerprint`.

Every repeated source identity in the explicit artifacts must match the
authenticated Runtime Execution exactly.

## 6. Completion Binding Fingerprint

`completionBindingFingerprint` is integration evidence only.

Its canonical SHA-256 input includes:

- integration contract and binding identities;
- exact Runtime execution identity, versions, and fingerprint;
- exact Evaluation Input identity, version, and fingerprint;
- Organization, Record, Revision, Attempt, and Snapshot continuity;
- Policy Set identity and version;
- Completion identity, classification, completion time, provenance, and
  integrity references;
- explicit integration binding time, provenance, and integrity references.

The fingerprint is not added to or represented as a native Policy Completion
fingerprint.

## 7. Optional Decision Binding

The envelope may bind a Decision only when:

- the Decision passes the existing Decision Domain authenticity guard;
- explicit Decision artifacts are supplied;
- Decision ID matches the artifacts;
- Organization, Record, Revision, Attempt, Snapshot, Completion, Policy Set,
  and correlation references match the authenticated input chain;
- Decision and binding chronology is valid.

The contract does not invoke the Decision Engine, normalized adapter, or any
Decision constructor.

`decisionBindingFingerprint` covers the exact
`completionBindingFingerprint`, authentic Decision fields, and explicit
Decision binding evidence. It is integration evidence, not a native Decision
fingerprint.

## 8. Optional Trust Binding

Trust Status cannot be bound without an authentic bound Decision.

The envelope accepts Trust Status only when:

- the approved Trust Status authenticity guard succeeds;
- explicit Trust artifacts are supplied;
- projection identity and source Decision identity match;
- Organization, Record, Revision, Attempt, Snapshot, outcome, and correlation
  continuity matches the authentic Decision;
- derivation and binding chronology is valid.

The contract never consumes Policy Completion, Findings, Rule Results, or
Evaluation Input to infer Trust.

`trustBindingFingerprint` covers the exact `decisionBindingFingerprint`,
authentic Trust Status fields, and explicit Trust binding evidence. It is
integration evidence, not a native Trust Status fingerprint.

## 9. Determinism and Canonicalization

All three fingerprints use sorted object keys, stable array order, canonical
primitive encoding, and SHA-256.

Caller object-property insertion order has no effect. Semantic changes to the
relevant source identity, artifact, Decision, Trust Status, chronology,
provenance, or integrity reference change the relevant scoped fingerprint.

Callers may provide expected fingerprints. A mismatch fails closed.

## 10. Authenticity, Immutability, and Idempotency

Input bindings and complete envelopes carry separate module-private seals.
Their seals are non-enumerable, non-configurable, and non-writable.

The bindings, copied binding evidence, and all binding-owned structures are
frozen. Authentic Runtime Execution, Decision, and Trust Status inputs are
already frozen by their owning domains.

Plain literals, frozen structural clones, and object-spread copies cannot
impersonate authenticated bindings or Trust Status.

Supplying an identical authenticated existing binding returns that binding.
Same-identity semantic conflicts and duplicate semantic identities fail
closed.

## 11. Authority Boundaries

The contract does not:

- invoke the normalized adapter;
- invoke or construct Decision;
- invoke or construct Trust Status;
- consume Findings, Rule Results, or Rule Executions directly;
- reinterpret a Policy classification, Decision outcome, Severity, or Trust
  Status;
- implement Eligibility or permission;
- implement Workflow or Attempt transitions;
- read current, latest, default, or head state.

Policy Runtime remains the source of the authentic execution and Completion.
Decision Domain remains the sole Decision authority. Trust Status Domain
remains the sole Trust construction and derivation authority.

## 12. Infrastructure Boundary

Production contract dependencies are restricted to:

- local binding modules;
- Policy Runtime public surface;
- Decision public surface;
- Trust Status public surface;
- Node SHA-256 primitive.

There is no database, schema, migration, repository, route, controller,
startup, worker, queue, provider, environment, network, frontend, clock, or
hidden ID dependency.

## 13. Public Surface

The public surface contains:

- exact binding contract version;
- binding ID, provenance, integrity, and fingerprint value factories;
- input-binding and complete-envelope factories;
- Boolean authenticity guards;
- readonly contract and result types.

It excludes:

- authenticity seals;
- constructors;
- canonicalization and hashing internals;
- result constructors;
- Decision or Trust authority;
- mutable collectors;
- infrastructure.

## 14. Files Added

- `server/organization-verification/domain/decision-trust-integration-contract/errors.ts`
- `server/organization-verification/domain/decision-trust-integration-contract/ids.ts`
- `server/organization-verification/domain/decision-trust-integration-contract/canonical.ts`
- `server/organization-verification/domain/decision-trust-integration-contract/inputBinding.ts`
- `server/organization-verification/domain/decision-trust-integration-contract/integrationBinding.ts`
- `server/organization-verification/domain/decision-trust-integration-contract/index.ts`
- `server/organization-verification/domain/decision-trust-integration-contract/decisionTrustIntegrationContract.test.ts`
- this document

## 15. Files Changed

- `server/organization-verification/domain/trust-status/trustStatusDeriver.ts`
  — approved Boolean guard and non-enumerable existing seal
- `server/organization-verification/domain/trust-status/index.ts`
  — approved guard export
- `server/organization-verification/domain/trust-status/trustStatus.test.ts`
  — guard, impersonation, immutability, and public-surface tests
- `server/organization-verification/domain/index.ts`
  — curated namespaced binding-contract export
- `server/organization-verification/architecture.test.ts`
  — contract, guard-consumption, authority, and infrastructure boundaries
- `package.json`
  — focused contract test command

## 16. Focused Test Coverage

The focused contract suite covers:

- authentic and fake Runtime Execution;
- Runtime and Evaluation Input continuity;
- Organization, Record, Revision, Attempt, Snapshot, Policy, and Completion
  continuity;
- all three deterministic scoped fingerprints;
- caller-order independence;
- semantic-change detection;
- expected-fingerprint mismatch;
- authentic and fake Decision;
- authentic and fake Trust Status;
- exact Decision-to-Trust binding;
- chronology;
- mutation protection;
- deep immutability;
- object-spread resistance;
- idempotency and conflict handling;
- narrow public exports;
- absence of downstream authority.

Trust Status tests separately prove authentic, fake, structural-clone,
object-spread, and mutated-copy guard behavior.

Architecture fixtures prove that the binding contract cannot acquire Decision,
Trust, Workflow, Eligibility, Finding/Result consumption, infrastructure,
environment, hidden clock/ID, unsafe conversion, or external wiring authority.

## 17. Runtime and Data Impact

- Application behavior: unchanged
- Decision creation: none
- Trust derivation by integration: none
- Workflow or Attempt transition: none
- Schema or migration impact: none
- Database or persistence impact: none
- Provider or network impact: none
- Startup impact: none
- Environment access: none

Synthetic tests create Decision and Trust Status only through their existing
frozen authorities to test binding acceptance. Production binding code does
not create them.

## 18. Stop Confirmation

Final validation:

- `npm run check`: passed
- `npm run build`: passed with only the existing Browserslist and chunk-size
  advisory warnings
- Phase 6 Verification Engine: 20/20 passed
- Organization Verification architecture: 108/108 passed
- Organization Registry contracts: 11/11 passed
- Organization Verification core domain: 11/11 passed
- Decision domain: 9/9 passed
- Trust Status domain: 16/16 passed
- Policy domain: 84/84 passed
- Evidence Snapshot domain: 75/75 passed
- Evaluation Projection domain: 54/54 passed
- Evaluation Input domain: 87/87 passed
- Evaluation Preparation Pipeline: 26/26 passed
- Policy Runtime Contract: 29/29 passed
- Policy Runtime: 26/26 passed
- Decision–Trust Integration Binding Contract: 22/22 passed

Total: 578/578 tests passed.

New tests in this phase:

- 22 focused binding-contract tests;
- 2 focused Trust Status guard tests;
- 8 architecture violation fixtures.

Total new tests: 32.

Phase 7B-6B.0 stops with the inert binding contract.

Phase 7B-6B Decision–Trust integration execution did not begin. Workflow and
Persistence did not begin.
