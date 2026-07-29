# Phase 7B-5B — Evaluation Projection Domain

## Slice Summary

Phase 7B-5B adds an inert, pure, immutable Organization Verification Evaluation
Projection Domain. It establishes the one-way boundary:

`Evidence Snapshot → Evaluation Projection`

The slice stops at the read contract. No Evaluation Input exists.

## Architectural Purpose

The domain provides a controlled capability-specific read surface derived
exclusively from one authentic immutable Organization Verification Evidence
Snapshot. It minimizes and freezes the source facts a later, separately
authorized evaluation-input capability may consume.

## Read-Contract Principle

The Projection is a read contract, not a transformation result. The Projection
performs structural selection only. It selects, omits, orders, copies, and
freezes. It does not evaluate the selected values.

## Projection Ownership

The domain owns exact opaque Projection identity, contract version, Builder
version, schema version, construction context, immutable projection contract,
projection provenance, integrity reference, deterministic fingerprint, runtime
authenticity, structural selection, and structural redaction.

The Evidence Snapshot Domain remains the source-fact authority. Registry,
Verification Core, Policy, Decision, Trust Status, and workflow ownership are
unchanged.

## Approved Read Surface

The allowlisted surface contains:

- exact Organization, Record, Verification Revision, and Profile Revision
  identities;
- optional Attempt identity only when already bound in the source Snapshot;
- source Snapshot ID, version, contract version, creation time, source digest,
  and fingerprint;
- Profile Revision sequence and fingerprint;
- copied legal identity facts;
- organization type, jurisdiction, and declared activities;
- Revision sequence, submission time, and declared input sections;
- semantic evidence identity, kind, category, authority, digest, supplied
  dates, and structural attributes;
- Projection identity, exact versions, creation time, fingerprint, provenance,
  and integrity reference.

## Structural Redaction Model

Redaction means omission only. Removed information is never replaced with an
inferred Boolean, classification, status, or conclusion. A missing field means
only that it is outside this Projection contract.

The Projection omits:

- Snapshot source manifest and manifest version;
- Snapshot Builder version and source cut-off;
- completeness and source-integrity assertions;
- Registry Lifecycle and approved disclosure;
- submission actor authority and delegated scopes;
- submission idempotency, correlation, and supersession internals;
- frozen-source projection versions and source contract internals;
- source provenance/integrity internals;
- construction context, authenticity seals, and canonicalization helpers.

## Data Minimization

Only source facts with a foreseeable Organization Verification evaluation use
are copied. Operational Registry state, marketplace disclosure, submission
authorization details, orchestration metadata, and Snapshot implementation
details are excluded. The Projection retains no reference to the source
Snapshot or its nested objects.

## Structural Normalization

Ordering is canonical and contains no business interpretation:

- trading names are sorted lexically;
- registration identifiers are sorted by scheme and value;
- declared activities are sorted by code and description;
- declared sections and values are sorted by stable keys;
- evidence facts are sorted by exact evidence identity and version;
- evidence attributes are sorted by key.

Caller input ordering therefore cannot alter Projection semantics or its
fingerprint.

## Projection Identity and Versioning

Projection ID and version are opaque exact values. Blank values and mutable
pointers (`latest`, `current`, `head`, and `default`) fail closed. Contract,
Builder, and schema versions are explicit exact constants; unknown versions
fail closed.

## Construction Context

The immutable context supplies every Projection ID, version, creation timestamp,
provenance reference, and integrity reference. An optional expected fingerprint
provides a fail-closed reconstruction assertion. The Builder uses no system
clock and generates no identity.

## Builder Authority

`buildOrganizationVerificationEvaluationProjection` is the sole public
construction authority. It accepts only an immutable construction context and
an authentic Evidence Snapshot. A fabricated object, even if frozen and shaped
like a Snapshot, is rejected.

## Authenticity

Projection instances carry a module-private runtime seal. The public guard
returns only a read-only authenticity result and does not expose the seal or an
internal reader.

The Evidence Snapshot public surface was narrowly extended with a Boolean
authenticity guard required by this downstream Builder. The existing private
seal and internal reader remain private; Snapshot semantics were not changed.

## Immutability

All selected objects, nested objects, arrays, and attribute entries are
defensively copied and frozen. Mutating caller-owned data or retaining the
source Snapshot cannot alter a constructed Projection.

## Fingerprint

The Projection fingerprint is SHA-256 over deterministic canonical Projection
semantics excluding the fingerprint itself. It is an integrity fingerprint,
not a signature, authenticity decision, or provider attestation.

## Chronology

Projection creation time is explicit canonical ISO time and cannot predate its
source Snapshot. Evidence dates are copied exactly. Expired evidence remains an
uninterpreted source fact; no expiry conclusion is produced.

## Prohibited Responsibilities

The Projection performs no business interpretation. It does not determine:

- completeness;
- compliance;
- validity or authenticity;
- expiry;
- trust;
- eligibility;
- risk;
- jurisdiction support;
- document sufficiency.

It creates no Finding, Decision, Trust Status, Policy result, classification,
reviewer state, or workflow transition.

## Dependency Rules

The only non-local domain dependency is the curated Evidence Snapshot public
surface. `node:crypto` is used for deterministic SHA-256.

Architecture enforcement prohibits Policy, Decision, Trust Status, database,
ORM, schema, repository, route, worker, startup, provider, storage, frontend,
session, OpenAI, Stripe, and Sentry dependencies. Predecessor domains cannot
import Evaluation Projection, and runtime modules cannot wire the Builder.

## Public Surface

The explicit namespaced public surface exposes opaque factories, exact version
parsers, immutable read contracts, typed failures, construction-context
factory, Builder, and read-only authenticity guard. It contains no `export *`,
seal, internal constructor, canonicalizer, fingerprint helper, unsafe cast, or
test fixture.

## Tests

The 54-test focused synthetic suite covers exact identity and versions, valid
construction, source and Projection authenticity, Builder authority, defensive
copying, deep immutability, canonical ordering, deterministic fingerprint,
input-order independence, expected-fingerprint failure, chronology, structural
redaction, prohibited inference, absence of Evaluation Input, and public export
protection.

Architecture fixtures prove enforcement for unauthorized construction,
unrestricted exports, Policy/database/storage dependencies, business inference,
Decision/workflow authority, runtime wiring, and reverse Snapshot dependency.

## Runtime, Schema, and Data Impact

The domain is additive and inert. No runtime/startup wiring, persistence,
repository, provider, route, schema, migration, database access, application
startup, `.env` access, or data mutation occurred.

## Deferred Work

Evaluation Input, Policy execution, production rules, Findings, Decisions,
Trust Status, eligibility, workflow, persistence, providers, and runtime
integration remain deferred and require separate explicit authorization.

## Formal Stop

The Projection performs structural selection only.

The Projection performs no business interpretation.

The Projection performs no policy evaluation.

The Projection performs no Decision creation.

The Projection performs no Trust Status derivation.

Phase 7B-5C has not begun.
