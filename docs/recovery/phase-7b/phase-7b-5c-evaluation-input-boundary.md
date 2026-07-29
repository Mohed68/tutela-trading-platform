# Phase 7B-5C — Evaluation Input Boundary

## 1. Slice Summary

This slice adds a pure immutable Organization Verification Policy Evaluation
Input boundary representing one exact authorized evaluation execution request.
It binds an authenticated Evaluation Projection, exact Policy Set identity,
mandatory Attempt, Context, Scope, and construction metadata.

## 2. Authorization Boundary

Implementation is limited to identities, versions, Context, Scope, Policy Set
binding, Projection binding, fact shaping, fingerprints, authenticity,
immutability, idempotency, conflicts, tests, architecture enforcement, and this
document. Phase 7B-5D is excluded.

## 3. Baseline and Validation

Work began from accepted commit
`75e7e1e50746e67991a9a734a1783f60127283fe` on
`architecture/phase-7a-organization-trust`. The clean baseline passed
TypeScript, production build, and all nine existing suites (339 tests).

## 4. Frozen Architecture Preserved

Registry, Core, Evidence Snapshot, Evaluation Projection, Policy aggregation,
Decision, Trust Status, and Phase 6 semantics were not changed. The new slice is
additive and inert.

## 5. Governing Principles

Policies never consume Snapshots. They may later consume only authenticated
Evaluation Inputs. Every Input binds one authenticated Projection, one exact
Policy Set identity/version, and one mandatory Attempt. The Input is an
execution contract, not an execution result.

## 6. Boundary Ownership

Projection owns available capability facts. Evaluation Input owns evaluation
identity, Projection/Policy/Attempt binding, Context, Scope, provenance,
correlation, integrity, fingerprint, and construction authority. Policy retains
Rule, Finding, aggregation, and completion authority.

## 7. Evaluation Input Identity

Input ID and version are opaque exact types. Blank values and mutable pointers
(`latest`, `current`, `head`, `default`) fail closed. IDs and timestamps are
caller-supplied; no clock, random identity, company-name identity, or user-ID
identity is used.

## 8. Projection Binding

The Input binds exact Projection ID, version, contract, schema, fingerprint,
originating Snapshot ID/fingerprint, Organization, Record, Revision, Profile
Revision, and Attempt. The Builder accepts only a runtime-authentic Projection
and copies the scoped facts defensively.

Evaluation Input binds one authenticated Evaluation Projection. Evaluation
Input does not consume Snapshot directly.

## 9. Attempt Binding Decision

Attempt is mandatory because the Input represents one concrete execution.
Snapshot Attempt remains optional; Projection only preserves it. An unbound
Projection may be explicitly bound once by this Builder. A bound Projection
must match. An existing Input cannot be rebound, and no Attempt is inferred,
generated, created, or transitioned.

## 10. Exact Policy Set Binding

The binding uses only the frozen Policy public identity surface: exact Policy
Set ID, exact version, Policy contract version, provenance, and integrity.
Policy Set identity and version are exact. No latest/current/default/head
resolution, registry lookup, status interpretation, fallback, Rule loading, or
Policy execution exists.

## 11. Evaluation Context

The immutable Context carries exact context version, requested/effective/source
cut-off times, execution reference, Attempt, Organization chain, Projection and
Snapshot references, provenance, correlation, and integrity. Every value is
explicit.

## 12. Evaluation Scope

The immutable Scope contains exact scope version, the
`organization_verification` capability, selected Projection sections, selected
evidence categories, selected declared-fact sections, provenance, and
integrity. It can narrow but never broaden the authenticated Projection.

## 13. Capability Scoping

The only production capability identifier in v1 is
`organization_verification`. No AML, sanctions, tax, ESG, beneficial-ownership,
or other production sub-capability was introduced.

## 14. Data Minimization

The Input contains only exact bindings, execution metadata, and the facts
selected by Scope. It contains no Source Manifest, construction context, seals,
Registry Lifecycle, database/ORM entities, raw evidence, paths, storage
locations, provider payloads, sessions, requests, routes, Policy internals, or
Rule implementations.

## 15. Structural Shaping Rules

The Builder copies the complete Registry fact section only when authorized,
filters declared sections by exact key, and filters evidence by exact category.
Arrays are canonically ordered by their upstream contracts and Scope factories.
No value is interpreted, normalized semantically, or replaced with a derived
Boolean.

## 16. Builder Authority

`buildOrganizationVerificationPolicyEvaluationInput` is the sole public Input
construction authority. It consumes one authentic Projection plus frozen,
revalidated Policy binding, Context, Scope, explicit identity/version/time, and
optional existing authenticated Input.

## 17. Consistency Validation

The Builder verifies Organization, Record, Revision, Profile Revision,
Projection identity/fingerprint, Snapshot identity/fingerprint, mandatory
Attempt, Policy binding, Context, Scope, capability, provenance/integrity
shapes, and scoped category/section availability. Mismatches fail closed.

## 18. Chronology Rules

Requested time cannot precede Projection creation. Effective time cannot
precede Snapshot creation. Source cut-off cannot precede Snapshot creation or
follow effective time. Input creation cannot precede Projection creation or
requested time. Retrospective evaluation (`effectiveAt < requestedAt`) is not
supported by v1 and fails closed. Evidence expiry is not evaluated.

## 19. Fingerprint and Canonicalization

SHA-256 binds Input identity/version, exact contract/Builder versions,
Projection/Snapshot chain, Attempt, Policy binding, Context, Scope, exposed
facts, and creation time. Object keys are recursively sorted and unordered
collections are normalized by their factories. The fingerprint is deterministic
integrity evidence, not a signature or external attestation.

## 20. Authenticity Protection

A private module-scoped symbol seals Builder-created Inputs. Arbitrary object
literals cannot impersonate one. The public Boolean guard exposes no seal,
constructor, reader, canonicalizer, hash helper, or unsafe cast.

## 21. Immutability Strategy

Context, Scope, Policy binding, Projection binding, selected facts, nested
objects/arrays, and final Input are copied and frozen. No Projection object
reference is retained. Caller mutation or later construction cannot change an
earlier Input.

## 22. Idempotency and Conflicts

Identical reconstruction with the same ID/fingerprint returns the authenticated
existing instance. Same ID with changed semantics, Attempt, Projection,
execution reference, or Policy fails as conflict. Identical semantics under a
different ID fail as duplicate. Persistence uniqueness remains future work.

## 23. Failure Model

Typed failures cover invalid identity/version, unsupported contracts, invalid
Context/Scope/execution/provenance/correlation/integrity/fingerprint,
unauthentic Projection, chain/fingerprint/Snapshot mismatches, missing or
conflicting Attempt, Policy binding/pointer failures, scope expansion,
chronology, duplicate/conflicting Input, and construction failure. Failures are
not converted to Findings or outcomes.

## 24. Legacy Authority Protection

User verification, company name, user ID, roles, buyer/seller flags, Offer
ownership/verification, Registry Lifecycle, document presence, reviewer result,
approved/trusted flags, eligibility, UI-selected Policy, mutable revision/profile
pointers, and seed/demo labels cannot select Policy, define Scope, bind Attempt,
or influence authority.

## 25. Policy Execution Separation

No Policy was executed. No Rule was executed. No Finding or Rule Evaluation
Result was created. No Policy Evaluation Completion or normalized
classification was created. Only narrow Policy identity types are imported.

## 26. Decision and Trust Separation

No Decision was created or invoked. No Decision Applicability, Trust Status,
expiry fact, or invalidation fact was created or derived.

## 27. Workflow Separation

No Workflow Coordinator was implemented. No Attempt lifecycle transition,
queue, retry, reviewer assignment, provider coordination, scheduling,
notification, or execution-state persistence occurred.

## 28. Public Export Surface

The explicit namespaced surface exposes opaque factories, exact versions,
Context/Scope/Policy binding factories and contracts, immutable Input contract,
Builder, typed failures, and Boolean authenticity guard. It uses no unrestricted
`export *` and exposes no internal construction or hashing authority.

## 29. Architecture Enforcement

Architecture tests now enforce sole construction, private authenticity,
Projection-only consumption, no Snapshot dependency, no reverse predecessor
dependency, narrow Policy identity dependency, no execution/inference/workflow
authority, no runtime/persistence/provider dependencies, and curated exports.
Eleven intentional fixtures prove these boundaries.

## 30. Files Added or Changed

Added the Evaluation Input domain under
`server/organization-verification/domain/evaluation-input/` and this document.
Narrow changes are limited to the domain namespace barrel, architecture test,
and one package test command.

## 31. Runtime, Schema, and Database Impact

There is no runtime, schema, migration, persistence, repository, route, worker,
startup, provider, frontend, or database impact. No `.env` was loaded, no
database was accessed, and the application was not started.

## 32. Tests and Results

The new suite contains 87 synthetic non-personal tests covering the 77 required
areas and additional fail-closed cases. Architecture enforcement contains 72
tests. Final TypeScript, build, and all regression results are recorded in the
completion report.

## 33. Risks and Limitations

Domain idempotency compares one optionally supplied existing Input; it is not a
global uniqueness guarantee. Cross-process uniqueness requires future
persistence constraints. Fingerprints do not provide signing. Scope v1 selects
whole Registry facts and narrows submission/evidence by exact identifiers.

## 34. Deferred Work

Policy execution, Rule execution, Findings, completion, Decision, Trust,
eligibility, workflow, persistence, orchestration, providers, and runtime
integration remain separately authorized future work.

## 35. Future Capability Projection Layer

Future capability-specific scopes may add exact versioned section vocabularies
and narrower fact projections. They must remain downstream of authenticated
Projection, never regain redacted Snapshot fields, and require explicit
architecture approval and version changes.

## 36. Rollback Strategy

Revert the single Phase 7B-5C commit. Because the slice is additive and inert
with no data/schema/runtime effects, rollback requires no operational or
database procedure.

## 37. Formal Slice Verdict

The boundary meets the immutable, deterministic, fail-closed,
capability-scoped, exact-binding, no-execution design subject to final validation
and formal review.

## 38. Stop Confirmation

No Policy, Rule, Finding, Policy Evaluation Completion, Decision, Trust Status,
Eligibility, Workflow Coordinator, Attempt transition, provider, persistence,
database, `.env`, or application startup was used. Phase 7B-5D did not begin.
