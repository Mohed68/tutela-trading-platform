# Phase 7B-6A.0 — Executable Rule Contract Amendment

## 1. Phase Summary

Phase 7B-6A.0 resolves only the execution-contract gaps identified at the
mandatory Phase 7B-6A stop. It adds authenticated immutable Rule
Implementation contracts, exact Policy Set-to-Implementation Set binding, a
fact-only evaluator boundary, explicit execution artifacts, and deterministic
binding fingerprints.

This is a contract amendment. It does not execute a Rule and it does not
implement the Phase 7B-6A Policy Evaluation Runtime.

## 2. Authorization Boundary

Implemented:

- authenticated immutable `OrganizationVerificationRuleImplementation`;
- authenticated immutable
  `OrganizationVerificationRuleImplementationSet`;
- exact Rule ID and Rule version matching;
- deterministic Policy Set and Implementation Set fingerprints;
- a pure evaluator function contract;
- an explicit Evaluation Input-to-fact-view adapter;
- authenticated immutable explicit Execution Artifacts;
- a non-enumerable authenticity seal and guard for Policy Set;
- typed fail-closed contract failures;
- architecture enforcement, synthetic tests, and documentation.

Not implemented:

- Rule execution orchestration;
- production Rule implementations;
- Findings or Rule Evaluation Result production;
- Policy Evaluation Completion production;
- Decision, Trust Status, Eligibility, Workflow, or Attempt transitions;
- persistence, database, Registry lookup, providers, routes, workers, startup,
  frontend, or environment-based configuration.

## 3. Accepted Baseline

- Branch: `architecture/phase-7a-organization-trust`
- Accepted predecessor:
  `006799e8e0521a355281c8a1c6f57247d1020ed4`
- Starting HEAD: exactly the accepted predecessor
- Starting working tree: clean
- No `.env` was loaded
- No database was accessed
- The application was not started

The baseline comprised 470 passing tests across the 11 approved suites.

## 4. Frozen Architecture Preserved

The amendment does not change:

- Registry ownership or contracts;
- Organization Verification Core or Attempt lifecycle;
- Evidence Snapshot, Evaluation Projection, or Evaluation Input semantics;
- Rule metadata, Reason Codes, severity, Finding, Rule Evaluation Result,
  aggregation, or Policy Evaluation Completion semantics;
- Decision, Decision Applicability, or Trust Status semantics.

The only narrow Policy Set change is a non-enumerable module-private
authenticity seal applied by its existing factory, plus a Boolean public guard.
Visible Policy Set data and ordering remain unchanged.

## 5. Rule Metadata and Rule Implementation Separation

`OrganizationVerificationRule` remains declarative Policy metadata. It does
not contain executable code.

`OrganizationVerificationRuleImplementation` contains:

- exact Rule ID and Rule version;
- exact Policy Set ID and Policy Set version;
- an exact implementation contract version;
- an explicit implementation version;
- an explicit SHA-256 implementation digest representing the governed code
  artifact;
- separate implementation provenance and integrity references;
- a pure evaluator function;
- a deterministic metadata fingerprint;
- a non-enumerable module-private authenticity seal.

No production implementation is constructed in this phase. All evaluator
functions exist only in synthetic tests.

The explicit implementation digest, provenance, and integrity references are
part of the authenticated fingerprint. The function object itself is not
serialized or hashed. JavaScript cannot inspect a closure to prove semantic
purity; code-governance must therefore verify the supplied digest before a
future Runtime accepts an implementation artifact.

## 6. Pure Evaluator Contract

The evaluator accepts exactly one
`OrganizationVerificationPolicyEvaluationFactView`.

The fact view contains only the three approved optional Evaluation Input fact
sections:

- Registry facts;
- submission facts;
- evidence facts.

It does not expose Evaluation Input identity metadata, Evaluation Context,
Projection binding, Snapshot binding, Policy binding, request objects, or
infrastructure. The contract module does not import Snapshot or Projection.

Phase 7B-6A.0 defines the callable type but never invokes a production
evaluator.

## 7. Evaluation Input Fact-View Adapter

`adaptOrganizationVerificationEvaluationInputToPolicyEvaluationFactView`:

- accepts only an authentic sealed Evaluation Input;
- reads only the Evaluation Input public contract;
- copies each approved fact explicitly;
- preserves absence as absence;
- does not add defaults or infer facts;
- creates new deeply frozen arrays and objects;
- does not broaden Evaluation Scope;
- does not import or access Snapshot or Projection;
- does not use unsafe opaque-type substitution.

## 8. Exact Implementation Set Binding

The Implementation Set factory requires all of the following explicitly:

- one authentic exact Policy Set;
- the separate Rule metadata definitions;
- the separate authenticated Rule Implementations;
- Implementation Set ID, version, contract version, provenance, and integrity;
- optional expected Policy Set and Implementation Set fingerprints.

It validates one-to-one matching by the tuple:

```text
(Rule ID, Rule version)
```

It rejects:

- missing implementations;
- extra implementations;
- duplicate implementations;
- Rule version mismatches;
- Policy Set identity or version mismatches;
- invalid or mismatched Rule metadata;
- fake Policy Sets and fake Rule Implementations;
- expected fingerprint mismatches.

Bindings are ordered only by the Policy Set's explicit evaluation order.
Caller-supplied implementation order has no semantic effect.

## 9. Deterministic Fingerprints

Canonical SHA-256 fingerprints cover:

- all visible, semantically relevant Policy Set fields;
- Implementation Set identity and contract;
- the exact Policy Set fingerprint;
- ordered Rule metadata;
- each exact implementation fingerprint;
- explicit provenance and integrity references.

Functions, private seals, object key insertion order, and caller collection
order are excluded from canonical semantics. Canonicalization and raw hashing
helpers remain private.

## 10. Explicit Execution Artifacts

`OrganizationVerificationExecutionArtifacts` supplies rather than generates:

- Execution ID;
- exact Evaluation Input ID, version, and fingerprint binding;
- exact Implementation Set ID, version, and fingerprint binding;
- execution start and completion timestamps;
- execution provenance and integrity references;
- one Rule Result ID, timestamp, provenance, and integrity reference for every
  exact bound Rule;
- zero or more explicit Finding IDs with Rule binding, timestamp, provenance,
  and integrity reference;
- Completion ID, timestamp, provenance, and integrity reference;
- a deterministic artifacts fingerprint.

The factory rejects missing, duplicate, mismatched, or chronologically invalid
artifacts. It calls no clock, ID generator, random source, registry, or
infrastructure. These are execution inputs for a future Runtime; they are not
Findings, Rule Evaluation Results, or a Policy Evaluation Completion.

## 11. Authenticity and Immutability

Policy Sets, Rule Implementations, Implementation Sets, and Execution
Artifacts use module-private Symbol seals that are:

- non-enumerable;
- non-configurable;
- non-writable;
- attached before the object is frozen.

Object spread copies visible data but not authenticity. Public guards reject
spread impersonations. Caller-owned arrays and nested fact collections are
defensively copied and frozen.

## 12. Fail-Closed Behavior

Contract failures remain typed framework failures. They do not become Reason
Codes or Findings. No missing value is defaulted, no mutable alias is
resolved, and no implementation is discovered or loaded.

Exact fingerprints may be supplied by the caller for verification. A mismatch
fails closed before any future execution could begin.

## 13. Architecture Enforcement

Architecture tests now recognize the contract amendment as a distinct,
downstream pure-domain boundary.

Allowed production dependencies are limited to:

- local contract modules;
- the curated Policy public surface;
- the curated Evaluation Input public surface;
- Node's SHA-256 hashing primitive.

Intentional fixtures prove rejection of:

- Snapshot and Projection imports;
- database and provider imports;
- dynamic Registry lookup;
- Decision, Trust, and Attempt authority;
- Finding, Rule Evaluation Result, and Completion production;
- environment access;
- hidden clocks and generated IDs;
- unsafe opaque-type substitution;
- production Rule construction or evaluator invocation in Phase 7B-6A.0;
- public seal, canonicalization, or internal-helper exports.

## 14. Public Export Surface

The namespaced domain export exposes only:

- explicit opaque value factories and types;
- exact contract versions;
- the Policy Set fingerprint operation;
- fact-view adapter;
- authenticated immutable Rule Implementation and Set factories and guards;
- authenticated immutable Execution Artifacts factory and guard;
- typed contract failures and read contracts.

It does not re-export the Policy Domain, use wildcard exports, or expose
private seals, raw constructors, result helpers, canonicalization, or hashing
internals.

## 15. Files Added or Changed

Added:

- `server/organization-verification/domain/policy-runtime-contract/errors.ts`
- `server/organization-verification/domain/policy-runtime-contract/ids.ts`
- `server/organization-verification/domain/policy-runtime-contract/canonical.ts`
- `server/organization-verification/domain/policy-runtime-contract/policySetFingerprint.ts`
- `server/organization-verification/domain/policy-runtime-contract/policyEvaluationFactView.ts`
- `server/organization-verification/domain/policy-runtime-contract/ruleImplementation.ts`
- `server/organization-verification/domain/policy-runtime-contract/ruleImplementationSet.ts`
- `server/organization-verification/domain/policy-runtime-contract/executionArtifacts.ts`
- `server/organization-verification/domain/policy-runtime-contract/index.ts`
- `server/organization-verification/domain/policy-runtime-contract/policyRuntimeContract.test.ts`
- this document

Changed:

- `server/organization-verification/domain/policy/policySet.ts`
- `server/organization-verification/domain/policy/index.ts`
- `server/organization-verification/domain/index.ts`
- `server/organization-verification/architecture.test.ts`
- `package.json`

## 16. Validation Results

Final validation:

- `npm run check`: passed
- `npm run build`: passed with the existing advisory warnings only
- `npm run test:verification-engine`: 20/20 passed
- `npm run test:organization-verification-architecture`: 90/90 passed
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

Total: 510/510 tests passed.

## 17. Runtime, Schema, and Data Impact

- Runtime wiring: none
- Application behavior: unchanged
- Schema or migration impact: none
- Database or persistence impact: none
- Business data impact: none
- Environment access: none
- Application startup: none

## 18. Risks and Limitations

- No production Rule catalog or Rule implementation exists.
- A future governed build/package process must verify that the explicit
  implementation digest corresponds to the deployed function artifact.
- The future Runtime must remain the sole caller of evaluators and must use the
  exact authenticated Implementation Set.
- Execution Artifacts establish explicit identity inputs; they do not prove
  that a future execution actually produced the corresponding domain objects.
- Persistence uniqueness and append-only constraints remain deferred.

## 19. Rollback

The amendment is additive except for the invisible Policy Set authenticity
seal. Rollback consists of reverting this phase commit. There are no database
or data changes to reverse.

## 20. Formal Verdict and Stop Confirmation

Phase 7B-6A.0 is complete as an inert, pure, fail-closed execution-contract
amendment.

Phase 7B-6A Policy Evaluation Runtime execution did not begin. No Rule was
executed in production, and no Finding, Rule Evaluation Result, Policy
Evaluation Completion, Decision, Trust Status, Eligibility, Workflow action,
Attempt transition, or persistent record was produced.
