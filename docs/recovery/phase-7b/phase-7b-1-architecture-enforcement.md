# Phase 7B-1 — Architecture Enforcement Skeleton

Date: 2026-07-28

Status: **COMPLETED — PENDING REVIEW**

## 1. Slice Summary

Phase 7B-1 establishes inert, test-enforced capability boundaries for:

- Organization Verification;
- Organization Registry;
- existing Phase 6 Offer Verification;
- external Confidential Evidence Storage ownership; and
- future Participation Eligibility ownership.

It adds no business behavior. The new production-included files contain only
architecture ownership metadata and re-exports. They are not imported by
startup, routes, workers, APIs, or frontend code.

A repository-native Node/TypeScript architecture suite scans production source
and validates isolated intentional-violation fixtures. No third-party
dependency was added.

## 2. Authorization Boundary

Authorized and completed:

- inert capability roots;
- architecture-only ownership markers;
- prohibited-dependency scanning;
- namespace enforcement;
- reserved authority metadata;
- intentional violation tests;
- one dedicated test script; and
- this slice report.

Not implemented:

- Organization or Profile Revision contracts;
- domain entities or aggregates;
- Drafts, Submissions, Revisions, Snapshots, Attempts, or Findings;
- Decisions or Decision Engine behavior;
- Trust Status values or derivation;
- policies or evidence semantics;
- persistence, schema, migrations, repositories, routes, APIs, workers,
  coordinator, UI, providers, OCR, AI, or legacy reconciliation.

## 3. Baseline Commit and Validation

Branch:

`architecture/phase-7a-organization-trust`

Approved predecessor and baseline HEAD:

`480f43db0cec960677e2023e1219f58f907e9cfa`

Baseline state:

- approved predecessor was the exact HEAD;
- working tree was clean;
- no pending `shared/schema.ts` or `migrations/` change existed;
- `.env` was not loaded;
- no database connection was required;
- no application/runtime startup was performed.

Baseline validation:

| Command | Result |
|---|---|
| `npm run check` | PASS |
| `npm run build` | PASS; existing non-blocking Browserslist/chunk-size warnings only |
| `npm run test:verification-engine` | PASS — 20/20 |

## 4. Files Added or Changed

| File | Change and purpose |
|---|---|
| `server/organization-verification/architecture.ts` | Added inert Organization Verification ownership/boundary marker |
| `server/organization-verification/index.ts` | Added architecture-only public root re-export |
| `server/organization-verification/architecture.test.ts` | Added deterministic source scanner, repository assertions, and intentional violation fixtures |
| `server/organization-registry/architecture.ts` | Added inert Registry ownership marker |
| `server/organization-registry/index.ts` | Added architecture-only Registry root re-export |
| `package.json` | Added narrow `test:organization-verification-architecture` script; no dependency change |
| `docs/recovery/phase-7b/phase-7b-1-architecture-enforcement.md` | Added this completion report |

No existing file under `server/verification/` was modified.

## 5. Capability Boundaries Enforced

### Organization Verification

Root:

`server/organization-verification/`

Marker:

- capability ID: `organization_verification`;
- runtime namespace prefix: `org_verification.`;
- current status: inert architecture boundary;
- future Decision authority reserved for the Organization Verification
  Decision Engine;
- future workflow authority reserved for the Workflow Coordinator;
- future Trust Status authority reserved for the Trust Status Deriver.

### Organization Registry

Root:

`server/organization-registry/`

Marker reserves Registry authority for:

- Organization identity;
- Organization Profile Revisions; and
- Organization Lifecycle.

It contains no contracts, domain types, persistence, or runtime behavior.

### External and sibling boundaries

The Organization Verification marker identifies:

- `server/verification/` as the independent Phase 6 Offer Verification root;
- Confidential Evidence Storage as external raw-artifact authority; and
- future Participation Eligibility as external downstream authority.

These markers do not implement or import those capabilities.

## 6. Architecture Rules Implemented

1. **No generic trust runtime:** rejects generic roots such as
   `server/trust/`, `server/trust-engine/`, and `server/shared-trust/`.
2. **Offer Verification independence:** rejects Organization Verification
   imports of `server/verification/` internals.
3. **Reverse capability isolation:** rejects Offer Verification imports of
   Organization Verification internals.
4. **Registry persistence separation:** rejects direct Registry internals,
   `shared/schema`, current DB/storage modules, and database-library imports
   from Organization Verification.
5. **Raw artifact ownership:** rejects raw/blob/upload/artifact storage modules,
   clients, imports, and ownership identifiers under Organization
   Verification.
6. **No downstream eligibility authority:** rejects participation,
   publication, marketplace-permission, and transaction-authorization
   Decisions/modules inside Organization Verification.
7. **Capability-specific namespaces:** reserves `org_verification.*` and
   rejects generic `trust.*` or `verification.*` runtime identifiers.
8. **Decision authority reservation:** rejects Decision-authority metadata
   other than the future Organization Verification Decision Engine.
9. **Trust Status authority reservation:** rejects status-authority metadata
   other than the future Trust Status Deriver.
10. **No startup or route wiring:** rejects production imports of the inert
    Organization Verification root from server bootstrap/routes/workers or
    frontend production source.

Tests scan production TypeScript/TSX beneath `server/` and `client/src/` while
excluding test files. Governance documentation is not scanned as runtime
ownership.

## 7. Intentional Violation Test Evidence

Isolated in-memory/source-string fixtures prove the scanner rejects:

| Intentional violation | Expected rule | Result |
|---|---|---|
| Organization Verification imports Offer engine internals | `ORG_VERIFICATION_IMPORTS_OFFER_INTERNAL` | DETECTED |
| Offer Verification imports Organization Verification internals | `OFFER_IMPORTS_ORG_VERIFICATION_INTERNAL` | DETECTED |
| Organization Verification imports Registry repository | `ORG_VERIFICATION_IMPORTS_REGISTRY_INTERNAL` | DETECTED |
| Organization Verification imports `@shared/schema` table authority | `ORG_VERIFICATION_IMPORTS_REGISTRY_INTERNAL` | DETECTED |
| Organization Verification owns raw artifact storage | `ORG_VERIFICATION_OWNS_RAW_ARTIFACT` | DETECTED |
| Generic `server/trust/` runtime is introduced | `GENERIC_TRUST_RUNTIME` | DETECTED |
| Organization Verification defines Participation Eligibility | `ORG_VERIFICATION_OWNS_ELIGIBILITY` | DETECTED |
| Reviewer is marked as Decision authority | `UNAUTHORIZED_DECISION_AUTHORITY` | DETECTED |
| Coordinator is marked as Trust Status authority | `UNAUTHORIZED_TRUST_STATUS_AUTHORITY` | DETECTED |
| Generic `trust.*` identifier namespace is used | `GENERIC_ORG_VERIFICATION_NAMESPACE` | DETECTED |
| Startup imports the inert capability | `ORG_VERIFICATION_STARTUP_WIRING` | DETECTED |

No forbidden production module was created. Fixtures exist only as strings
inside the test suite and cannot be imported by runtime code.

## 8. Phase 6 Regression Evidence

The existing Phase 6 capability remains at:

`server/verification/`

It was not renamed, moved, or modified.

`npm run test:verification-engine` passes all 20 existing tests, including:

- Rule catalog completeness;
- Decision Engine dependency isolation;
- Coordinator/engine separation;
- repository completion sealing;
- severity metadata behavior;
- policy independence;
- snapshot/fingerprint determinism; and
- fail-closed version resolution.

The new reverse-isolation rule also prevents future Phase 6 production code
from importing Organization Verification internals.

## 9. Runtime and Schema Impact

Runtime impact: **none**

- markers are inert;
- no startup/route/worker/frontend import exists;
- no application behavior changed;
- no runtime process was started.

Schema impact: **none**

- `shared/schema.ts` was not modified;
- no migration was created or changed;
- no table, repository, adapter, or database configuration was added;
- no database was accessed.

Environment impact: **none**

- `.env` was not loaded or printed;
- no credential or environment value entered source, tests, reports, or logs.

## 10. Risks and Limitations

| Risk/limitation | Treatment |
|---|---|
| Static scanning cannot prove every possible computed/dynamic import | Literal imports and capability paths are enforced now; later slices retain architecture review and TypeScript tests |
| Regex rules may need extension when approved contracts appear in 7B-2 | Current rule intentionally blocks all Registry imports; 7B-2 may allow only the reviewed contracts/ports path |
| Architecture marker constants compile to inert JavaScript | No production module imports them; a dedicated rule prevents wiring |
| File/name scanning can produce future false positives | Rules use path/import/authority patterns rather than broad business prose scanning |
| New file extensions or generated sources may evade current scan roots | Phase 7B-15 must audit scanner coverage; generated runtime sources are not currently part of repository conventions |
| Namespace checking covers literal runtime identifiers | Later domain slices must add type/catalog-specific assertions when identifiers exist |

These limitations do not weaken current acceptance: there is no domain/runtime
implementation to inspect yet, and every authorized boundary and violation is
represented by executable tests.

## 11. Rollback Strategy

Rollback is fully reversible:

1. revert the Phase 7B-1 commit;
2. remove the two inert capability directories;
3. remove the dedicated package test script; and
4. remove this report.

No database, schema, migration, runtime state, business row, or immutable
history exists to roll back.

## 12. Validation Results

Final required validation:

| Command | Result |
|---|---|
| `npm run check` | PASS |
| `npm run build` | PASS; existing non-blocking Browserslist/chunk-size warnings only |
| `npm run test:verification-engine` | PASS — 20/20 |
| `npm run test:organization-verification-architecture` | PASS — 12/12 |

The new architecture suite proves both:

- current production source has zero detected Phase 7B-1 violations; and
- isolated forbidden fixtures are rejected.

## 13. Stop Confirmation

Phase 7B-1 stops at architecture enforcement.

Confirmed:

- no business behavior was implemented;
- no domain model was implemented;
- no schema or migration was created;
- no database was accessed;
- no `.env` value was loaded or printed;
- no route/startup/worker/API/frontend wiring was introduced;
- no Phase 6 business behavior was changed;
- no Phase 7B-2 Organization Registry contract work began.

The next slice remains unauthorized:

**Phase 7B-2 — Organization Registry Contracts**
