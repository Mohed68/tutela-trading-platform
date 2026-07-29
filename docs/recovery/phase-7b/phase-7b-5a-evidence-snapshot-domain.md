# Phase 7B-5A — Evidence Snapshot Domain

## 1. Slice Summary

This additive, inert slice introduces the pure immutable Organization Verification
Evidence Snapshot Domain. It records one exact, reproducible representation of
selected Registry, Verification Revision, and semantic evidence facts. It does
not evaluate those facts.

## 2. Authorization Boundary

Implementation is limited to domain contracts, deterministic construction,
authenticity, immutability, integrity, completeness, architecture enforcement,
synthetic tests, and this document. No runtime capability was added.

## 3. Baseline and Validation

The slice started from accepted commit
`f8dbd8cf2057cfe5f6f31f66ac9a2f3ae93ed18e` on
`architecture/phase-7a-organization-trust`. The clean baseline passed TypeScript,
build, Phase 6, architecture, Registry, Core, Decision, Trust Status, and Policy
tests (188/188 total).

## 4. Architectural Freeze Preserved

Registry, Core, Decision, Trust Status, Policy, and Phase 6 semantics were not
changed. This slice is additive and has no predecessor-domain reverse dependency.

## 5. Governing Snapshot Principle

Everything evaluated in a future slice must first become an immutable Evidence
Snapshot. This slice stops at that immutable record and supplies no evaluation
projection or policy input.

## 6. Bounded Context Ownership

Registry owns Organization and Profile Revision facts. Verification Core owns
Record, Revision, Submission, and Attempt lifecycle. The Snapshot Domain owns
Snapshot identity, frozen projections, source manifest, integrity,
canonicalization, and construction authority. Confidential storage continues to
own raw artifacts.

## 7. Snapshot Identity

Snapshot IDs and versions are opaque, exact values. Blank values and mutable
pointers (`latest`, `current`, `head`, and `default`) fail closed. Organization,
Record, Revision, and Profile Revision form the mandatory source identity chain.

## 8. Attempt Binding Decision

Attempt binding is optional but explicit. A binding contains an exact Attempt ID
and creation timestamp. The Builder never infers an Attempt, never transitions
one, rejects an Attempt predating the Revision, rejects conflict with a bound
Snapshot, and does not permit an unbound Snapshot to be silently rebound.

## 9. Source Manifest

The immutable manifest records exact Registry and Verification source contract
versions, the source identity chain, optional Attempt ID, canonically ordered
semantic evidence references, source-selection time, provenance, correlation,
integrity, and true completeness/integrity assertions.

## 10. Semantic Evidence Reference Model

References contain exact identity and version, the corresponding Revision
evidence-reference identity, kind, category, source authority, and SHA-256
content digest. They identify selected evidence without asserting authenticity,
acceptability, or compliance.

## 11. Evidence Reference Uniqueness

Duplicate references are rejected, not deduplicated. The same ID with a different
version, digest, or semantics fails closed. Input order is canonicalized by exact
reference identity and version.

## 12. Frozen Registry Projection

The projection defensively copies only the approved Registry Profile Revision
surface: identity, sequence, fingerprint, legal identity, organization type,
jurisdiction, declared activities, approved disclosure, lifecycle source fact,
contract version, publication time, provenance, and integrity.

## 13. Frozen Submission Projection

The projection defensively copies one exact immutable Verification Revision,
including declared inputs, Revision evidence IDs, authority reference,
submission chronology, correlation, idempotency, supersession, provenance, and
integrity. It retains no Draft, request, session, repository, or database row.

## 14. Frozen Evidence Projection

Each evidence projection contains normalized semantic metadata and only supplied
time and structural attributes. Expired evidence may be recorded without
structural rejection. Raw bytes, storage locations, provider payloads, OCR, and
AI output are absent.

## 15. Snapshot Construction Context

The immutable context requires exact Snapshot identity and versions, exact source
identity chain, explicit times, completeness, integrity, provenance,
correlation, and integrity reference. Expected source digest and Snapshot
fingerprint are optional fail-closed assertions.

## 16. Snapshot Builder Authority

`buildOrganizationVerificationEvidenceSnapshot` is the sole public construction
authority. The sealed internal constructor and authenticity reader are private
and architecture-allowlisted only for the model and Builder.

## 17. Source Consistency Rules

The Builder verifies exact Organization, Record, Revision, and Profile Revision
identity; Profile sequence and fingerprint; authority scope; correlation;
Revision evidence membership; and optional Attempt chronology. No current or
latest source is resolved.

## 18. Completeness Model

Construction requires `sourceComplete: true`. Every Revision evidence reference
must have exactly one selected semantic reference, and unauthorized extras fail.
Registry Lifecycle, document-presence flags, legacy user attributes, and UI
state have no completeness authority.

## 19. Integrity Model

Construction requires `sourceIntegrityValid: true`, valid explicit integrity
references, valid exact contract versions, valid content digests, and a
consistent source chain. This is structural integrity, not business
authenticity.

## 20. Canonicalization

Objects are recursively canonicalized by sorted keys. Domain collections and
semantic attributes are sorted by stable identity keys; arrays whose order is
semantic preserve their already normalized order. Undefined values are omitted.

## 21. Snapshot Fingerprint

SHA-256 over canonical semantic values produces a deterministic source digest
and Snapshot fingerprint. It is an integrity fingerprint, not a signature or
external attestation. Caller input ordering cannot change it.

## 22. Chronology Rules

All timestamps are explicit canonical ISO timestamps. Registry publication,
Revision submission, source selection, source cut-off, Attempt creation, and
evidence capture cannot occur after Snapshot creation. Attempt creation cannot
predate its Revision. Issued/captured and valid-from/valid-until contradictions
fail.

## 23. Structural Validation vs Policy Evaluation

The Snapshot records source facts but does not evaluate them. Expiry is preserved
as supplied metadata and is not treated as a structural Policy failure.

## 24. Authenticity Protection

A module-private runtime symbol seals Builder-created Snapshots. Arbitrary frozen
objects cannot satisfy idempotency comparison or impersonate an authentic
Snapshot. The seal and reader are not public.

## 25. Immutability Strategy

Every source projection is defensively copied. Snapshot-owned objects, nested
objects, and arrays are frozen. Source mutations after construction cannot alter
the Snapshot, source digest, or fingerprint.

## 26. Idempotency and Conflict Semantics

An exact reconstruction with the same ID and fingerprint returns the authentic
existing instance. The same ID with changed semantics is a conflict. The same
semantic Snapshot under a different ID is a duplicate. Any unauthentic supplied
existing value fails closed.

## 27. Failure Model

Typed failures cover identity/version errors, chain mismatches, projection
mismatches, evidence duplicates/conflicts, missing/extra evidence, completeness,
integrity, chronology, digest/fingerprint mismatch, unauthenticity, duplicate
Snapshot, and conflicting Snapshot.

## 28. Legacy Authority Protection

`users.verified`, company name, user ID, role, seller/buyer flags, Offer
ownership, document-presence booleans, Registry Lifecycle, reviewer status,
Offer Verification, Participation Eligibility, and mutable current/latest
pointers cannot define identity, completeness, integrity, or authority.

## 29. Decision, Trust, Policy, and Workflow Separation

No Evaluation Projection or Policy Evaluation Input was implemented. No Policy
was executed. No Finding, Decision, Trust Status, Eligibility, or Workflow
Coordinator was created. The Builder does not transition Attempt.

## 30. Public Export Surface

The explicit namespaced surface exports opaque factories, exact versions,
immutable read/input contracts, typed results, construction-context factory, and
the Builder. It uses no unrestricted `export *` and excludes seals, internal
constructors/readers, canonicalizers, hashing helpers, and freezing helpers.

## 31. Architecture Enforcement Updates

Architecture scanning now enforces the sole Builder, private authenticity,
curated exports, allowed dependency direction, frozen predecessor boundaries,
no runtime wiring, and no database, ORM, schema, storage, repository, route,
worker, provider, Policy, Decision, Trust, eligibility, or workflow authority.
Twelve intentional violation fixtures prove these checks activate.

## 32. Files Added or Changed

Added the Evidence Snapshot domain files under
`server/organization-verification/domain/evidence-snapshot/` and this document.
Changed only the Organization Verification domain barrel, architecture test, and
one narrowly scoped package test command.

## 33. Runtime, Schema, and Database Impact

Runtime impact: none. Schema and migration impact: none. Persistence impact:
none. No database was accessed, no `.env` was loaded or printed, and the
application was not started.

## 34. Tests and Results

The new suite contains 75 synthetic, non-personal pure-domain tests covering
identity, versions, evidence semantics, projections, chronology, authenticity,
immutability, canonicalization, fingerprinting, idempotency, conflicts,
forbidden fields, and exports. Architecture enforcement contains 51 tests.
Final command results are recorded in the Phase 7B-5A completion report.

## 35. Risks and Limitations

SHA-256 fingerprints establish deterministic integrity but do not provide
cryptographic signing or external attestation. This in-memory domain has no
persistence or cross-process uniqueness authority. Structural evidence metadata
does not establish authenticity or compliance.

## 36. Deferred Work

Evaluation Projection, Policy Evaluation Input, production Policy execution,
providers, raw evidence retrieval, persistence, workflow, and downstream
Decision/Trust integration remain deferred and require separate authorization.

## 37. Rollback Strategy

Revert the single Phase 7B-5A commit. Because the slice is additive and inert,
has no schema/migration/runtime wiring, and touches no data, rollback requires no
database or operational procedure.

## 38. Formal Slice Verdict

The Evidence Snapshot Domain meets the authorized fail-closed, deterministic,
immutable, additive, and architecture-isolated design. Final acceptance remains
subject to review of the completion report and commit.

## 39. Stop Confirmation

Phase 7B-5A stops here. No Evaluation Projection, Policy Evaluation Input,
Policy execution, Finding, Decision, Trust Status, Workflow Coordinator,
provider integration, persistence, database access, schema change, migration,
runtime wiring, application startup, or Phase 7B-5B work occurred.
