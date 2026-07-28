# Phase 7B-3C — Trust Status Domain and Deriver

## 1. Slice Summary

This slice implements the pure Organization Verification Trust Status domain.
It models immutable Decision Applicability, expiry and invalidation facts,
sealed Trust Status Source Facts, an immutable projection, and the deterministic
Trust Status Deriver.

## 2. Authorization Boundary

The implementation is limited to pure domain contracts, construction
boundaries, typed failures, deterministic derivation, architecture enforcement,
synthetic tests, one test command, and this recovery record.

No policy evaluation, finding, workflow coordination, persistence, schema,
migration, database, route, worker, startup, frontend, notification, eligibility,
transaction authorization, or Offer Verification coupling is included.

## 3. Baseline Commit and Validation

- Branch: `architecture/phase-7a-organization-trust`
- Accepted predecessor: `703c4d238705eb05e7296b46e62bae174ef4ca04`
- Starting HEAD: exactly the accepted predecessor
- Starting working tree: clean
- `npm run check`: passed
- `npm run build`: passed with only the pre-existing Browserslist age and
  chunk-size advisory warnings
- Phase 6 Verification Engine: 20/20 passed
- Organization Verification architecture: 23/23 passed
- Organization Registry contracts: 11/11 passed
- Organization Verification core domain: 11/11 passed
- Organization Verification Decision domain: 9/9 passed

There was no pending schema or migration change. No environment file, database,
or application startup was required or used.

## 4. Architecture-Frozen Areas Preserved

The Decision Engine remains the sole Decision authority. The Trust Status
Deriver is the sole Trust Status construction authority. Decision remains an
immutable historical fact and is never edited, reopened, recreated, or invoked
by status derivation.

Organization Registry remains identity/profile/lifecycle authority. Offer
Verification and Participation Eligibility remain separate. Reviewers, routes,
repositories, workers, coordinators, policies, adapters, and Registry cannot
create Trust Status.

## 5. Trust Status Vocabulary

The exhaustive production vocabulary is:

- `unestablished`
- `trusted`
- `not_trusted`
- `expired`
- `invalidated`

These values are not Decision outcomes, process states, Registry Lifecycle,
eligibility, marketplace permission, transaction authorization, Offer
Verification, user verification, or compliance certification.

## 6. Decision Applicability Model

`OrganizationVerificationDecisionApplicability` is a separately sealed,
immutable fact with exactly one state:

- `applicable`
- `superseded`
- `expired`
- `invalidated`

It references one Decision, an exact applicability version, effective time,
provenance, correlation, and integrity. `superseded` additionally requires one
different superseding Decision ID. Multiple, missing, malformed, or contradictory
classifications fail closed. Applicability never changes the Decision outcome or
Decision object.

## 7. Invalidation Fact Model

`OrganizationVerificationInvalidationFact` is an explicit, attributable,
immutable fact. It contains exact invalidation, Organization, Decision, and
Record identities; invalidation time; source authority; provenance; correlation;
and integrity references.

A Boolean such as `invalidated: true` has no authority. The fact must be sealed,
must match the selected Decision chain, and must be effective no later than the
requested derivation time.

## 8. Expiry Fact Model

`OrganizationVerificationExpiryFact` contains an exact fact ID, Decision ID,
explicit `validUntil`, recorded time, provenance, correlation, and integrity.

There is no hidden clock, default duration, inferred validity period, or policy
lookup. The caller supplies `derivationAsOf`. Crossing the explicit boundary
derives `expired` without changing the historical Decision. An asserted expired
applicability without its exact expiry boundary fails closed.

## 9. Trust Status Source Facts

`OrganizationVerificationTrustStatusSourceFacts` is created through a sealed
construction boundary. It includes exact:

- source-facts version and integrity/completeness assertions;
- Organization and Verification Record identities;
- current Verification Revision reference;
- authoritative Decision, Attempt, Snapshot, and fingerprint references;
- Decision Applicability;
- optional superseding Decision chain;
- optional expiry and invalidation facts;
- derivation-as-of time;
- provenance, correlation, and integrity references.

The input accepts only an authentic immutable Decision from the public Decision
surface. It copies the required Decision fields into a separate frozen source
fact rather than retaining the Decision object. It contains no database,
Registry runtime, Policy Framework, Offer Verification, eligibility, or legacy
objects.

## 10. Trust Status Model

`OrganizationVerificationTrustStatus` is an immutable current projection with:

- projection identity;
- Organization and Record identity;
- selected Decision, Revision, Attempt, Snapshot, fingerprint, outcome, and
  applicability provenance where present;
- exact Trust Status value;
- source-facts and Deriver versions;
- derivation-as-of, derived-at, effective-from, and optional effective-until;
- optional invalidation and supersession references;
- provenance, correlation, and integrity references.

It has a module-private authenticity seal and no public constructor, edit,
reopen, eligibility, or Registry Lifecycle operation.

## 11. Trust Status Deriver Authority

`deriveOrganizationVerificationTrustStatus` is pure, deterministic,
side-effect free, independent of persistence, and independent of the system
clock. Projection identity, Deriver version, derivation time, and integrity are
explicit inputs.

The internal constructor exists only inside the Deriver module. Architecture
tests prohibit construction elsewhere and prohibit the Deriver from invoking or
constructing Decisions.

## 12. Decision-to-Status Mapping

For an applicable, non-expired, non-invalidated Decision:

| Decision outcome | Trust Status |
|---|---|
| approved | trusted |
| revision_required | not_trusted |
| manual_review | unestablished |
| rejected | not_trusted |

The mapping is exact and exhaustive. There are no aliases or fallback mappings.

## 13. Precedence Rules

The exact precedence is:

1. invalid source facts → failure
2. invalidated → invalidated
3. expired → expired
4. superseded → require newer Decision
5. no Decision → unestablished
6. applicable Decision → map outcome

Malformed input is never converted to `unestablished`. A superseded Decision is
never used, and a missing or mismatched newer Decision fails closed.

## 14. Source-Fact Consistency

The source-facts boundary validates exact consistency across Organization,
Record, Revision, Attempt, Decision, Snapshot, fingerprint, Applicability,
invalidation, expiry, and supersession references. It also validates exact
versions and chronological consistency between Decision time, Applicability
time, fact times, and derivation-as-of time.

Every mismatch returns a typed pure-domain failure and no Trust Status.

## 15. Idempotency and Re-Derivation

Identical sealed source facts and identical derivation context return the same
existing immutable projection when supplied. A different projection ID for the
same semantic derivation is rejected as a duplicate. Reusing one projection ID
with changed semantics is rejected as a conflict.

A later explicit derivation-as-of time may legitimately create a new projection,
including transition to `expired` after the supplied boundary. The prior
projection remains unchanged. Future persistence must enforce projection and
source-chain uniqueness; no storage constraint is implemented here.

## 16. Immutability Strategy

The implementation uses readonly opaque values, exact version factories,
module-private seals, defensive Decision copying, and `Object.freeze`.
Applicability, expiry facts, invalidation facts, source facts, copied Decision
facts, and Trust Status projections are immutable.

Tests prove caller mutation cannot change the status, source Decision, time,
Snapshot references, provenance, or prior projection. No third-party
immutability dependency was added.

## 17. Legacy Protection Evidence

Synthetic tests prove that Trust Status cannot be created or influenced by:

- `users.verified`, company name, user ID, role, or seller flag;
- offer ownership or document-presence Booleans;
- UI or reviewer-selected status;
- Registry `active`, `suspended`, or other lifecycle values;
- arbitrary trusted Booleans or Decision strings;
- Offer Verification state;
- Participation Eligibility output.

No database row or personal data was read.

## 18. Eligibility Separation

The domain defines no participation, publication, marketplace, seller, buyer,
trade, or transaction eligibility. Trust Status is a source fact that a future
separate eligibility capability may consume; it grants or denies no action.

## 19. Architecture Enforcement Updates

The repository scanner now:

- recognizes only the authorized Trust Status subdomain;
- restricts its imports to local status modules, the Phase 7B-3A ID surface,
  the public Decision surface, and the public Registry identity contract;
- rejects database, ORM, schema, repository, route, startup, worker, frontend,
  storage, provider, Offer Verification, and future capability dependencies;
- rejects eligibility, policy, finding, Rule, Reason Code, Severity, and
  reviewer override authority;
- rejects Decision Engine invocation or Decision construction;
- rejects Trust Status construction outside the Deriver;
- rejects runtime wiring of the Deriver.

Intentional violation fixtures prove each new authority boundary.

## 20. Files Added or Changed

Added under `server/organization-verification/domain/trust-status/`:

- `errors.ts`
- `ids.ts`
- `applicability.ts`
- `expiryFact.ts`
- `invalidationFact.ts`
- `sourceFacts.ts`
- `trustStatus.ts`
- `trustStatusDeriver.ts`
- `index.ts`
- `trustStatus.test.ts`

Changed:

- `server/organization-verification/domain/decision/decisionEngine.ts` —
  read-only Decision authenticity guard
- `server/organization-verification/domain/decision/index.ts` — exports that
  guard through the approved public Decision surface
- `server/organization-verification/domain/index.ts` — Trust Status public
  domain export
- `server/organization-verification/architecture.test.ts` — architecture
  enforcement and fixtures
- `package.json` — one narrowly scoped test command
- this document

## 21. Runtime, Schema, and Database Impact

Runtime impact is zero: no startup, route, worker, adapter, or frontend imports
the Deriver. There is no persistence, schema, migration, seed, or database
operation. No `.env` value was loaded or printed.

## 22. Tests and Results

Dedicated command:

`npm run test:organization-verification-trust-status-domain`

It covers the exact truth table, all five statuses, expiry across historical
outcomes, invalidation precedence, supersession, source identity mismatches,
version failures, malformed facts, idempotency, legitimate later expiry,
immutability, and legacy non-authority.

Final validation results:

- `npm run check`: passed
- `npm run build`: passed; only the pre-existing Browserslist age and chunk-size
  advisory warnings remain
- `npm run test:verification-engine`: 20/20 passed
- `npm run test:organization-verification-architecture`: 28/28 passed
- `npm run test:organization-registry-contracts`: 11/11 passed
- `npm run test:organization-verification-core-domain`: 11/11 passed
- `npm run test:organization-verification-decision-domain`: 9/9 passed
- `npm run test:organization-verification-trust-status-domain`: 14/14 passed

## 23. Risks and Limitations

- Domain idempotency does not replace future database uniqueness.
- Validity windows are supplied facts; no duration or renewal policy is
  invented.
- Invalidation is intentionally structural; policy-specific categories and
  Reason Codes are deferred.
- One supersession hop is normalized per source-facts input. A future history
  resolver must supply the selected authoritative chain and cannot use a stale
  superseded Decision.
- The projection is inert and not persisted or published.

## 24. Deferred Work

Deferred work includes the Domain Compliance Review, Policy Framework, Rules,
Findings, Reason Codes, evaluator runtime, Workflow Coordinator, reviewer
workflow, Participation Eligibility, marketplace access, persistence,
repositories, schema, migrations, routes, workers, frontend, notifications,
providers, audit history storage, OCR, AI, and legacy backfill.

## 25. Rollback Strategy

Revert the single Phase 7B-3C commit. The implementation is additive and inert,
so rollback requires no database reversal, data repair, environment change, or
runtime shutdown. Historical Decision behavior is unchanged.

## 26. Stop Confirmation

Phase 7B-3C stops after the pure Trust Status domain, Deriver, enforcement,
tests, documentation, and commit.

Decision Applicability is separate from Decision outcome, and Decision remains
an immutable historical fact. No Policy Framework or Finding, Workflow
Coordinator, Participation Eligibility, reviewer Trust Status authority,
persistence, schema, migration, database, route, startup, worker, or frontend
work was implemented. Phase 7B-3D has not begun.
