# Phase 7B-2 — Organization Registry Contracts

Date: 2026-07-28

Status: **COMPLETED — PENDING REVIEW**

## 1. Slice Summary

Phase 7B-2 implements the pure, versioned boundary through which Organization
Verification may consume one exact immutable Organization Profile Revision
from Organization Registry.

The slice adds opaque identity/value types, strict allowlisted parsing,
immutable projections, pure resolution ports, an Organization
Verification-side Anti-Corruption Layer (ACL), and executable boundary tests.

No Registry persistence, Organization creation, runtime adapter, or business
policy was implemented.

## 2. Authorization Boundary

Implemented:

- opaque Organization/Profile Revision/fingerprint/sequence types;
- exact Registry contract version;
- Registry Lifecycle, legal identity, activity, and disclosure projections;
- complete immutable Profile Revision contract;
- actor/authority reference;
- pure Profile Revision and authority ports;
- consumer-side ACL;
- strict validation, fail-closed outcomes, tests, and documentation.

Not implemented:

- Registry persistence, tables, repositories, or adapters;
- registration, activation, membership, or reconciliation workflows;
- Verification aggregates, Snapshots, Attempts, Findings, Decisions, policies,
  Trust Status, or evidence semantics;
- routes, APIs, startup, workers, UI, schema, migrations, or database access.

## 3. Baseline Commit and Validation

Branch:
`architecture/phase-7a-organization-trust`

Accepted predecessor:
`64a4a0ddaf5382c9483f0b07ad37787b7e6f04d7`

Baseline was the exact accepted commit with a clean worktree and no pending
schema/migration changes.

| Baseline command | Result |
|---|---|
| `npm run check` | PASS |
| `npm run build` | PASS; existing non-blocking warnings only |
| `npm run test:verification-engine` | PASS — 20/20 |
| `npm run test:organization-verification-architecture` | PASS — 12/12 |

No `.env`, database, or application startup was used.

## 4. Architecture-Frozen Areas Preserved

- Registry remains sole Organization identity/Profile Revision/Lifecycle
  authority.
- Verification consumes published contracts only.
- Verification cannot mutate Registry Lifecycle or infer trust.
- ACL is conceptually and physically on the consumer side.
- Registry contracts contain no Decision or Trust Status authority.
- No direct Registry table/repository/schema/database import exists.
- Legacy fields cannot become Registry authority.
- Offer Verification remains independent and unchanged.

## 5. Contracts Implemented

`server/organization-registry/contracts.ts` defines:

- `OrganizationId`: nonblank opaque identifier with no UUID/business format.
- `OrganizationProfileRevisionId`: nonblank opaque immutable revision ID;
  rejects mutable pointers `current`, `latest`, and `head`.
- `OrganizationProfileRevisionSequence`: opaque positive safe integer.
- `OrganizationProfileFingerprint`: nonblank opaque published fingerprint.
- `RegistryContractVersion`: exact
  `organization_registry_profile_revision.v1`.
- `OrganizationLifecycleProjection`: only `registered`, `active`, `suspended`,
  `closed`.
- `LegalIdentityProjection`: allowlisted structural legal identity fields.
- `DeclaredActivityProjection`: data-only declared activity items.
- `ApprovedDisclosureProjection`: narrow optional allowlisted fields.
- `OrganizationProfileRevisionContract`: immutable complete published
  contract.
- `ActorAuthorityReference`: structural reference only, with no token/session/
  password/role object.

No legal-form, jurisdiction, activity, evidence, trust, or authorization
business rule is encoded.

## 6. Ports Implemented

`OrganizationRegistryProfileRevisionPort` resolves only:

- one exact Organization ID;
- one exact Profile Revision ID; and
- one exact expected Registry contract version.

It has explicit outcomes:

- `resolved`;
- `not_found`;
- `version_unavailable`;
- `integrity_failure`.

There is no latest/current fallback.

`OrganizationRegistryAuthorityPort` structurally validates an already-formed
authority reference and returns `valid` or `invalid`. It contains no adapter,
role rule, authentication, membership resolution, or database behavior.

## 7. ACL Design

Location:

`server/organization-verification/integration/organizationRegistryAcl.ts`

The ACL:

- parses the raw published contract through the strict Registry public API;
- validates exact contract version;
- checks expected Organization and Profile Revision IDs;
- preserves sequence, fingerprint, source/version, Lifecycle, and timestamp;
- copies only allowlisted fields;
- defensively recreates every nested projection;
- returns `verification_input_derived_from_registry_contract`.

The output is not a Registry aggregate, Verification Snapshot, evidence,
Decision, Trust Status, membership, or authority conclusion.

## 8. Exact-Version and Fail-Closed Behavior

Only `organization_registry_profile_revision.v1` is accepted. Empty, unknown,
older, or newer versions return
`unsupported_registry_contract_version`; there is no fallback.

Other typed failures include:

- `organization_id_mismatch`;
- `profile_revision_id_mismatch`;
- `invalid_revision_sequence`;
- `missing_profile_fingerprint`;
- `malformed_legal_identity_projection`;
- `malformed_lifecycle_projection`;
- `unknown_contract_field`;
- `authority_reference_invalid`;
- `profile_revision_not_found`;
- `profile_revision_integrity_failure`.

These are integration failure codes, not Organization Verification Rule IDs,
Reason Codes, Findings, or Decisions.

## 9. Immutability Strategy

- parsers create new objects rather than retaining caller objects;
- accepted top-level and nested objects/arrays are frozen;
- trading names, identifiers, address lines, activities, disclosures, and
  delegated scopes are defensively copied;
- ACL re-copies already validated Registry projections;
- opaque identity and version values are immutable primitives;
- no mutable current-profile pointer is accepted as a Revision ID.

Tests mutate caller arrays/objects after parsing and prove accepted outputs are
unchanged.

## 10. Legacy Protection Evidence

Synthetic tests prove these shapes cannot satisfy the Registry contract:

- `company_name` and `verified`;
- user ID/role/seller flags;
- offer owner and document-presence flags;
- demo/seed labels and UI verification claims;
- user ID plus company-name presented as a partial Organization.

There is no `fromCompanyName` or `fromUserId` constructor and no database row
is read. Opaque IDs are created only through explicit contract construction;
the contract boundary cannot infer their authority from legacy fields.

## 11. Architecture Enforcement Updates

The Phase 7B-1 scanner now:

- permits Organization Verification to import only
  `organization-registry/index.js`, the reviewed public surface;
- still rejects deeper Registry, schema, DB, storage, or ORM imports;
- rejects Registry imports of Organization Verification or Offer Verification
  internals;
- rejects Registry runtime/persistence imports;
- rejects Registry exports of Decision or Trust Status authority;
- rejects ACL imports of DB, routes, workers, startup, or storage runtime.

Four new intentional fixtures prove these rules. Architecture tests increased
from 12 to 16.

## 12. Files Added or Changed

- `server/organization-registry/contracts.ts`
- `server/organization-registry/ports.ts`
- `server/organization-registry/contracts.test.ts`
- `server/organization-registry/index.ts`
- `server/organization-verification/integration/organizationRegistryAcl.ts`
- `server/organization-verification/architecture.test.ts`
- `package.json`
- `docs/recovery/phase-7b/phase-7b-2-organization-registry-contracts.md`

No Phase 6 file changed.

## 13. Runtime, Schema, and Database Impact

Runtime impact: **none**

- no adapter, startup import, route, worker, service, API, or frontend wiring.

Schema impact: **none**

- `shared/schema.ts` and `migrations/` are unchanged;
- no Organization table/repository was created.

Database/environment impact: **none**

- no database was accessed;
- `.env` was not loaded or printed;
- all fixtures are synthetic and non-personal.

## 14. Tests and Results

Added command:

`npm run test:organization-registry-contracts`

Final results:

| Command | Result |
|---|---|
| `npm run check` | PASS |
| `npm run build` | PASS; existing non-blocking warnings only |
| `npm run test:verification-engine` | PASS — 20/20 |
| `npm run test:organization-verification-architecture` | PASS — 16/16 |
| `npm run test:organization-registry-contracts` | PASS — 11/11 |

Coverage includes valid construction, empty IDs, mutable Revision pointers,
sequence/fingerprint validation, exact versioning, strict unknown-field
rejection, nested immutability, Lifecycle vocabulary, ACL mismatch handling,
authority references, legacy protection, and import boundaries.

## 15. Risks and Limitations

- The single supported contract version is structural, not a production
  Registry adapter.
- Opaque ID types prevent accidental type mixing but cannot independently
  prove the upstream semantic source; only a future authorized adapter can
  supply authoritative values.
- Date/timestamp validation is structural and does not impose jurisdictional
  rules.
- Required fields are the minimum contract shape, not an evidence/legal policy.
- Strict unknown-field rejection requires an explicit version change for
  contract expansion.
- Ports define outcomes but have no runtime implementation.
- Deep freezing is applied to defined projections; future fields must preserve
  the same defensive-copy discipline.

## 16. Rollback Strategy

Revert the Phase 7B-2 commit. This removes pure contracts, ports, ACL, tests,
the package script, and this report.

No database, schema, migration, runtime state, Organization row, or business
data requires rollback.

## 17. Stop Confirmation

Confirmed:

- no Registry persistence was implemented;
- no Organization table was created;
- no registration or activation workflow was implemented;
- no Organization membership reconciliation occurred;
- no schema or migration changed;
- no database was accessed;
- no route/startup/worker/API/frontend wiring was added;
- no business policy was invented;
- no Phase 6 behavior changed;
- no Phase 7B-3 core-domain work began.

The next slice remains unauthorized:

**Phase 7B-3 — Organization Verification Core Domain**
