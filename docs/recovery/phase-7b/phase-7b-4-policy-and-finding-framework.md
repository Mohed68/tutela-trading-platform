# Phase 7B-4 — Policy and Finding Framework

## 1. Slice Summary

Phase 7B-4 implements a pure, deterministic, capability-neutral Policy and
Finding Framework for Organization Verification. It defines exact Policy Set
and Rule contracts, immutable Findings, authenticity-protected Rule Evaluation
Results, deterministic aggregation, a sealed Policy Evaluation Completion, and
a narrow adapter into the Phase 7B-3B normalized evaluation boundary.

No production compliance policy or provider behavior is implemented.

## 2. Authorization Boundary

This slice is limited to:

- policy, rule, finding, completion, provenance, integrity, and version
  contracts;
- pure construction and validation factories;
- deterministic aggregation and completeness validation;
- normalized-evaluation adaptation;
- architecture enforcement;
- synthetic tests;
- documentation.

It does not implement KYB, AML, sanctions, OCR, AI, external providers,
persistence, repositories, schema, migrations, routes, workers, startup,
frontend, Workflow Coordinator, reviewer workflow, Participation Eligibility,
notification, or audit persistence.

## 3. Baseline and Validation

- Branch: `architecture/phase-7a-organization-trust`
- Accepted predecessor:
  `0198fccee757ab273e8aedee736260d042ea53d3`
- Starting HEAD: exactly the accepted predecessor
- Starting working tree: clean
- Pending schema or migration changes: none
- Baseline `npm run check`: passed
- Baseline `npm run build`: passed with only the existing Browserslist-age and
  chunk-size advisory warnings
- Baseline Phase 6 Verification Engine: 20/20 passed
- Baseline Organization Verification architecture: 32/32 passed
- Baseline Organization Registry contracts: 11/11 passed
- Baseline core domain: 11/11 passed
- Baseline Decision domain: 9/9 passed
- Baseline Trust Status domain: 14/14 passed

No `.env` was loaded or printed. No database was accessed. The application was
not started.

## 4. Architectural Freeze Preserved

Architecture Freeze v1 remains intact:

- Record, Draft, Submission, Revision, and Attempt semantics are unchanged.
- Decision outcomes and Decision Engine mapping are unchanged.
- Decision Applicability is unchanged.
- Trust Status values and Trust Status Deriver are unchanged.
- Registry ownership is unchanged.
- Offer Verification remains independent.
- Participation Eligibility remains separate and unimplemented.
- existing construction authorities remain constrained.

The only Decision-boundary adjustment is additive and backward compatible:
the already sealed normalized evaluation can now preserve optional Policy
Evaluation provenance and integrity references. The Decision Engine neither
reads nor changes behavior based on those references.

## 5. Policy Framework Ownership

The framework owns:

- exact Policy Set identity, version, contract, provenance, and integrity;
- exact Rule identity, version, metadata, provenance, and integrity;
- capability-namespaced Reason Codes and categories;
- Finding severity and disposition vocabularies;
- immutable Finding evaluation facts;
- sealed Rule Evaluation Results;
- deterministic completeness and aggregation;
- sealed Policy Evaluation Completion;
- the pure normalized-evaluation adapter.

It does not own Decision, Trust Status, Registry identity or Lifecycle, raw
evidence, provider execution, workflow coordination, reviewer authority, or
eligibility.

## 6. Policy Set Model

`OrganizationVerificationPolicySet` records:

- exact Policy Set ID and version;
- `organization_verification.policy_set.v1`;
- descriptive name that has no identity authority;
- explicit effective-from and optional effective-until timestamps;
- ordered, immutable Rule references;
- exact evaluation contract version;
- separate provenance and Policy Set integrity references;
- optional structural jurisdiction metadata;
- exact `active | inactive` structural status.

The factory rejects blank identities, `latest`, `current`, `head`, `default`,
unknown contract versions, invalid chronology, duplicate Rule IDs, duplicate
orders, and malformed references. Rule references are copied, frozen, and
ordered by their explicit positive evaluation order.

## 7. Rule Model

`OrganizationVerificationRule` records:

- exact Rule ID and version;
- exact parent Policy Set ID and version;
- `organization_verification.rule.v1`;
- descriptive title;
- capability-namespaced normalized category;
- severity metadata;
- exact normalized evaluation disposition;
- exact Reason Code;
- explicit required/optional status;
- positive deterministic evaluation order;
- separate provenance and Rule integrity references.

Rules are immutable contracts. No executable production Rule exists in this
slice. All executable behavior in tests is synthetic fixture construction.

## 8. Reason Code Model

Reason Codes use the exact lowercase format:

```text
organization_verification.<category>.<reason>
```

They reject blanks, whitespace, uppercase, free-form sentences, mutable
pointers, and foreign namespaces. A Reason Code is machine-readable policy
metadata only. It is not a Decision outcome, Trust Status, user-facing message,
provider response, or framework failure.

## 9. Severity Model

The exact severity vocabulary is:

- `informational`
- `low`
- `medium`
- `high`
- `critical`

Severity is metadata only. Aggregation never derives a classification from
severity; a `critical` satisfied Rule remains satisfied.

## 10. Finding Disposition Model

The exact normalized disposition vocabulary is:

- `satisfied`
- `informational`
- `revision_required`
- `manual_review_required`
- `rejection_required`
- `evaluation_error`

Decision and Trust vocabularies are excluded. In particular, the framework
does not define `approved`, `rejected`, `trusted`, `not_trusted`, `expired`, or
`invalidated` as Policy dispositions.

## 11. Finding Model

`OrganizationVerificationFinding` binds one immutable evaluation fact to:

- Finding, Policy Set, Rule, Organization, Record, Revision, Attempt, Snapshot,
  and Snapshot fingerprint identities;
- exact Reason Code, severity, disposition, and category;
- explicit evaluated-at timestamp;
- provenance, correlation, and Finding integrity references;
- allowlisted semantic evidence-reference IDs;
- flat normalized scalar attributes.

Finding construction requires the exact Rule and Evaluation Input context.
It validates the full identity chain and allows only evidence references already
present in that immutable input. Nested arrays and attributes are defensively
copied and frozen. Raw bytes, file paths, provider payloads, personal documents,
mutable objects, and free-form authority statuses are absent.

One Finding ID identifies one immutable Finding. Semantic duplicates within one
Rule result are rejected even when they use different Finding IDs.

## 12. Rule Evaluation Result

`OrganizationVerificationRuleEvaluationResult` is created only by a validating
factory and carries a module-private runtime seal. It records:

- exact Rule and Policy Set identities and versions;
- the complete Organization/Record/Revision/Attempt/Snapshot chain;
- copied Rule category, severity, and Reason Code metadata;
- one exact terminal Rule disposition;
- explicit start/completion timestamps;
- `resultComplete: true`;
- `resultIntegrityValid: true`;
- immutable Findings;
- provenance, correlation, and Rule Evaluation integrity references.

Arbitrary object literals cannot impersonate completed Rule results. Incomplete
or integrity-invalid results are rejected. A Rule result may contain immutable
informational Findings plus at most one authority-bearing Finding. Semantically
duplicate or conflicting Findings fail closed.

## 13. Policy Evaluation Input

`OrganizationVerificationPolicyEvaluationInput` is capability-neutral and
immutable. It includes:

- Organization, Record, Revision, Attempt, Snapshot, and fingerprint;
- exact Policy Set ID and version;
- exact evaluation-context version;
- semantic evidence-reference IDs;
- an allowlisted normalized Registry projection with exact Profile Revision,
  profile fingerprint, Registry contract version, organization type,
  jurisdiction, and declared activity codes;
- explicit requested-at time;
- provenance, correlation, and integrity references;
- explicit completeness and integrity validity.

It excludes database rows, ORM models, raw files, storage paths, mutable
Registry entities, sessions, route requests, provider responses, Offer
Verification state, Decision, and Trust Status.

## 14. Policy Evaluation Completion

`OrganizationVerificationPolicyEvaluationCompletion` is produced only through
the Finding Aggregator and carries a separate module-private runtime seal. It
contains:

- exact completion, Policy Set, Organization, Record, Revision, Attempt, and
  Snapshot identities;
- the exact evaluation contract version;
- deterministically ordered authentic Rule Evaluation Results;
- a deeply frozen aggregate finding/category summary;
- explicit evaluation chronology;
- complete/integrity-valid markers;
- one normalized evaluation classification;
- provenance, correlation, and integrity references.

It contains no Decision, Trust Status, Attempt transition, reviewer selection,
Registry Lifecycle, or Eligibility output.

## 15. Completeness Rules

A completion is valid only when:

- the supplied exact Policy Set is structurally active;
- Evaluation Input and Policy Set identity/version match exactly;
- every required Rule reference has exactly one authentic terminal result;
- an omitted Rule is optional by explicit Policy Set metadata;
- no unknown or unauthorized Rule is present;
- Rule ID and version match the exact reference;
- no duplicate or conflicting result exists;
- Organization, Record, Revision, Attempt, Snapshot, and fingerprint agree;
- chronology is valid and inside the Policy Set effective interval;
- all results are complete and integrity-valid;
- no Finding contradiction exists.

No optionality, current version, or default Policy Set is inferred.

## 16. Aggregation Model

`completeOrganizationVerificationPolicyEvaluation` is pure and deterministic.
It reads only a supplied Policy Set, immutable Evaluation Input, authentic Rule
Evaluation Results, and explicit completion metadata. It performs no I/O,
fetching, provider calls, clock reads, lifecycle transitions, Decision
creation, or Trust derivation.

Results are ordered by Policy Set Rule order before summary and classification.
Category summaries are ordered by capability category. Repeated equivalent
input produces equivalent output.

## 17. Aggregation Precedence

| Highest valid normalized Rule disposition | Normalized evaluation classification |
|---|---|
| rejection_required | rejection_required |
| manual_review_required | manual_review_required |
| revision_required | revision_required |
| all required rules satisfied | approval_ready |
| evaluation_error | failure; no completion |

Informational Findings do not change classification. The precedence is applied
only after identity, authenticity, completeness, integrity, chronology, and
contradiction validation.

## 18. Contradiction Handling

The framework rejects rather than prioritizes malformed input, including:

- a Rule result whose disposition differs from its exact Rule contract;
- multiple authority-bearing Findings for one Rule result;
- satisfied/informational results carrying conflicting authority Findings;
- semantic duplicate Findings;
- duplicate or version-conflicting Rule results;
- missing required or unauthorized Rule results;
- cross-Policy, cross-Organization, cross-Revision, cross-Attempt, or
  cross-Snapshot results;
- invalid chronology;
- incomplete or integrity-invalid results.

An `evaluation_error` yields typed `policy_evaluation_error` and no Policy
Evaluation Completion. It is never converted to manual review.

## 19. Normalized Evaluation Adapter

`adaptPolicyEvaluationCompletionToNormalizedEvaluation` accepts only an
authentic sealed Policy Evaluation Completion. It:

- preserves exact Organization, Record, Revision, Attempt, Snapshot, and
  fingerprint identities;
- preserves the exact completion ID and Policy Set identity/version;
- preserves completion time and correlation;
- preserves Policy Evaluation provenance and integrity references;
- serializes structured category summaries deterministically;
- maps the one Policy classification to the existing mutually exclusive
  normalized evaluation signals;
- delegates final authenticity sealing to the existing Phase 7B-3B boundary.

It does not call Decision Engine, create a Decision, create Trust Status, alter
Attempt state, select versions, or invent IDs/timestamps.

## 20. Framework Failure vs Finding

A Finding is a valid policy conclusion about evaluated facts.

A Framework Failure means the framework could not establish a valid evaluation,
for example because of conflicting dispositions, identity mismatch, unknown
version, incomplete results, or invalid integrity.

Framework failures use typed `PolicyDomainFailureCode` values and never become
Reason Codes or Findings. Findings never hide framework failures.

## 21. Versioning

Separate branded types and factories exist for:

- Policy Set ID and version;
- Rule ID and version;
- Finding ID;
- Policy Evaluation Completion ID;
- Policy, Rule, and Evaluation contract versions;
- evaluation-context version;
- Policy Set, Rule, Rule Evaluation, Finding, and Policy Evaluation integrity
  references;
- Policy provenance;
- Reason Code and category.

Blank and mutable-pointer values are rejected. There is no implicit default,
fallback, company-name-derived Organization identity, or user-ID-derived
Organization identity.

## 22. Immutability Strategy

The framework uses:

- defensive copies for every caller-owned array;
- frozen nested Registry projections, Rule references, Findings, attributes,
  Rule results, summaries, and completions;
- module-private runtime seals for Findings, Rule Results, and Policy
  Evaluation Completions;
- narrow internal authenticity readers restricted by architecture tests;
- separate branded identities and semantic vocabularies.

Tests mutate caller-owned metadata, evidence lists, attributes, Rule
references, and Finding collections and prove historical results remain
unchanged.

## 23. Legacy Protection

Synthetic tests prove the framework exposes no authority fields for:

- `users.verified`;
- company name;
- user ID or role;
- buyer/seller flags;
- offer ownership;
- document-presence Boolean;
- UI status;
- Registry Lifecycle;
- reviewer-selected status;
- arbitrary approved/trusted Boolean;
- Offer Verification;
- Participation Eligibility;
- seed/demo labels.

No real row, user, offer, or personal data was read.

## 24. Decision and Trust Authority Separation

The Policy Framework:

- does not import Decision Engine implementation;
- does not create `OrganizationVerificationDecision`;
- does not expose Decision outcomes as dispositions;
- does not import or invoke Trust Status Deriver;
- does not construct Trust Status, Applicability, expiry, or invalidation
  facts;
- does not mutate Attempt;
- does not grant eligibility.

The only Decision-domain dependency is the curated normalized-evaluation public
boundary used by the adapter. Decision creation remains exclusively inside the
existing Decision Engine.

## 25. Public Export Surface

`domain/policy/index.ts` explicitly curates the public framework. It exports
validated factories, immutable contracts, exact vocabularies, the aggregator,
and the normalized adapter.

It does not export:

- internal success/failure constructors;
- authenticity readers;
- private seals;
- the internal Policy Evaluation Completion constructor;
- the internal classification constructor.

The architecture-frozen domain root exposes the curated Policy surface through
one namespaced export rather than adding uncurated wildcard exports.

## 26. Architecture Enforcement Updates

Architecture enforcement now proves:

- Policy cannot import Decision Engine or Trust Status implementation;
- Policy cannot construct Decision or Trust Status;
- Policy cannot transition Attempt or grant Eligibility;
- Policy dependencies are limited to local modules, public Registry identity
  contracts, approved core identity/reference types, and the narrow normalized
  adapter boundary;
- Policy cannot import database, ORM, schema, migration, repository, route,
  worker, startup, frontend, storage, provider, OpenAI, Stripe, Sentry,
  session, or Offer Verification internals;
- Registry, core, Decision, and Trust Status cannot import Policy internals;
- runtime/startup code cannot wire Policy;
- internal authenticity readers and construction helpers cannot leak through
  public indexes.

Seven intentional violation fixtures cover unauthorized Decision creation,
Trust construction, runtime/provider imports, direct Decision/Trust coupling,
and unrestricted internal export.

## 27. Files Added or Changed

Added:

- `server/organization-verification/domain/policy/errors.ts`
- `server/organization-verification/domain/policy/ids.ts`
- `server/organization-verification/domain/policy/reasonCode.ts`
- `server/organization-verification/domain/policy/severity.ts`
- `server/organization-verification/domain/policy/disposition.ts`
- `server/organization-verification/domain/policy/rule.ts`
- `server/organization-verification/domain/policy/policySet.ts`
- `server/organization-verification/domain/policy/evaluationInput.ts`
- `server/organization-verification/domain/policy/finding.ts`
- `server/organization-verification/domain/policy/ruleEvaluationResult.ts`
- `server/organization-verification/domain/policy/policyEvaluationCompletion.ts`
- `server/organization-verification/domain/policy/findingAggregator.ts`
- `server/organization-verification/domain/policy/normalizedEvaluationAdapter.ts`
- `server/organization-verification/domain/policy/index.ts`
- `server/organization-verification/domain/policy/policy.test.ts`
- this document

Changed:

- `server/organization-verification/domain/decision/normalizedEvaluation.ts`
- `server/organization-verification/domain/decision/sealedEvaluationCompletion.ts`
- `server/organization-verification/domain/index.ts`
- `server/organization-verification/architecture.test.ts`
- `package.json`

## 28. Runtime, Schema, and Database Impact

Runtime wiring impact: none.

Schema and migration impact: none.

Database impact: none.

The Policy Framework remains an inert pure-domain capability. No route,
startup module, worker, provider, repository, frontend, or production registry
imports it.

No database was accessed, no `.env` was loaded, and no application startup
occurred.

## 29. Tests and Results

Final validation:

- `npm run check`: passed
- `npm run build`: passed with only existing advisory warnings
- `npm run test:verification-engine`: 20/20 passed
- `npm run test:organization-verification-architecture`: 39/39 passed
- `npm run test:organization-registry-contracts`: 11/11 passed
- `npm run test:organization-verification-core-domain`: 11/11 passed
- `npm run test:organization-verification-decision-domain`: 9/9 passed
- `npm run test:organization-verification-trust-status-domain`: 14/14 passed
- `npm run test:organization-verification-policy-domain`: 84/84 passed

Policy tests cover exact models and versions, mutable-pointer rejection,
authenticity, completeness, identity consistency, deep immutability, all
dispositions, all normalized mappings, precedence, contradictions, retries,
duplicate/conflicting completions, adapter preservation, legacy non-authority,
and export protection.

## 30. Risks and Limitations

- No production Policy Set or Rule catalog exists.
- No provider facts or external evidence evaluation exists.
- Policy selection/activation is not wired at runtime.
- Persistence uniqueness and append-only storage are deferred.
- The Phase 7B-5 canonical Snapshot and Evaluation Input boundary remains
  unimplemented; this slice consumes explicit immutable snapshot identity only.
- Category summaries cross the existing normalized boundary as deterministic
  machine-readable strings because that frozen boundary uses string summaries.
- The optional provenance/integrity fields added to the normalized completion
  are additive and not yet persisted or consumed by Decision.

These limitations are intentional and non-blocking for the pure framework.

## 31. Deferred Work

Deferred:

- Phase 7B-5 Snapshot and Evaluation Input Boundary;
- production policy catalog and governance;
- actual jurisdiction, organization-type, evidence, KYB, AML, sanctions, OCR,
  AI, or provider rules;
- Policy persistence and exact-version repository;
- Workflow Coordinator and evaluator orchestration;
- reviewer workflow;
- Participation Eligibility;
- schema, migration, routes, workers, frontend, notifications, and audit
  persistence.

## 32. Rollback Strategy

Revert the single Phase 7B-4 commit. All changes are pure TypeScript contracts,
tests, architecture enforcement, one additive optional normalized-completion
metadata extension, one package test script, and documentation.

No schema, migration, database data, runtime wiring, or external system rollback
is required.

## 33. Formal Slice Verdict

**IMPLEMENTED AND VALIDATED — READY FOR FORMAL REVIEW**

The Policy and Finding Framework satisfies the authorized Phase 7B-4
acceptance criteria. It fails closed on malformed, contradictory, incomplete,
integrity-invalid, unknown-version, or `evaluation_error` input while preserving
Decision Engine and Trust Status authority boundaries.

## 34. Stop Confirmation

Phase 7B-4 stops after implementation, validation, documentation, and commit.

The Policy Framework does not create Decision, create Trust Status, or mutate
Attempt. No production compliance Rule was implemented. No provider,
persistence, Workflow Coordinator, reviewer workflow, or Eligibility capability
was implemented. Frozen domain semantics and Phase 6 behavior remain unchanged.
No runtime, schema, migration, or database work occurred.

Phase 7B-5 did not begin.
