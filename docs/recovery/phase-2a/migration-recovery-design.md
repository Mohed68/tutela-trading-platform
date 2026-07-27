# TUTELA migration recovery design

Status: design only; no SQL in this package has been executed.

## Executive design summary

The observed database is a legacy schema with no migration journal. Current
repository code expects a newer and partly conflicting schema. Recovery must
therefore use two controlled paths:

1. An existing-database upgrade path that fingerprints and preserves the
   observed legacy structures before applying reviewed reconciliation changes.
2. A fresh-database bootstrap path that creates a reviewed canonical schema
   without pretending to replay undocumented history.

Both paths must meet at a named canonical schema cutover. Only migrations after
that cutover become a single common chain.

`shared/schema.ts` is implementation evidence, not automatic authority for
contract, KYB, order-lifecycle, authentication, or legacy-field semantics.

## Migration-history strategy

### Proposed history model

Before any migration execution, introduce a repository-owned migration manifest
and a database journal capable of distinguishing provenance. The future journal
should record:

- immutable migration identifier;
- SHA-256 checksum of the reviewed SQL;
- kind: `observed_baseline`, `executed`, or `included_in_bootstrap`;
- execution path: `legacy_upgrade` or `fresh_bootstrap`;
- application Git revision;
- timestamp;
- operator-supplied approval/reference.

The exact DDL for this journal is intentionally deferred. Creating or populating
it is a database write and was not authorized in Phase 2A.

### Legacy schema baseline

`observed-legacy-schema-baseline.md` is the formal structural record. It is not
an executable migration and must never be represented as historically
executed.

For a future existing-database upgrade:

1. Require the recovery marker and a disposable/staging environment.
2. Run a read-only schema fingerprint check against the observed baseline.
3. Fail if tables, columns, enums, constraints, or relevant indexes differ.
4. Create the journal only after review.
5. Record an `observed_baseline` entry with the baseline document checksum.
6. Do not record `0001` through `0004` as executed unless each migration was
   actually executed and its postconditions were verified.

### Reconciliation migrations

Reconciliation migrations transform a known legacy fingerprint. They must:

- contain explicit preflight assertions;
- avoid `IF NOT EXISTS` as a substitute for drift detection;
- run transactionally where PostgreSQL supports it;
- fail before modification when data violates a new rule;
- separate schema changes from data backfills;
- record checksums only after successful postcondition verification.

`0005_partner_relations_reconciliation.sql` is the first draft following this
pattern.

### New additive migrations

Migrations `0003` and `0004` create absent, evidence-backed feature tables.
Their current `IF NOT EXISTS` clauses are acceptable only when an external
preflight first proves the tables are absent. If a table already exists, the
runner must stop instead of letting `IF NOT EXISTS` hide drift.

### Fresh-database bootstrap path

A future bootstrap series must create the approved canonical schema from an
empty PostgreSQL database. It must record actual execution, not an observed
legacy baseline. Where a reconciliation is already incorporated into bootstrap
DDL, the journal may record `included_in_bootstrap` with the bootstrap checksum;
it must not falsely claim that legacy reconciliation SQL ran.

### Canonical cutover

Both paths join only after:

- all required tables exist;
- an approved enum and constraint set matches;
- contract and KYB decisions are implemented;
- required backfills have completed or are proven unnecessary;
- an offline-generated schema fingerprint matches on both paths.

Post-cutover migrations use one ordered chain for all environments.

### Failure modes prevented

- Legacy table creation is never replayed against an unverified existing
  database.
- Incompatible migrations are not marked as applied.
- `IF NOT EXISTS` cannot silently accept a mismatched object.
- Data-changing migrations have separate identifiers and approvals.
- Checksums prevent edited SQL from masquerading as a previously reviewed
  migration.

Drizzle `push` is not part of either recovery path.

## Partner-relations reconciliation

### Read-only preflight result

The disposable recovery branch currently contains zero:

- null partner statuses;
- statuses outside `pending`, `approved`, `rejected`;
- self-partnership rows;
- duplicate unordered pairs in `pending` or `approved`.

These results do not eliminate the preflight. The migration repeats the checks
and fails before DDL if the database changes.

### Upgrade-path treatment of `0002`

Do not execute `0002` unchanged against the observed legacy table. Its
`CREATE TABLE IF NOT EXISTS` would skip column nullability and checks, while its
standalone index statements would create only the indexes. That would appear
successful without reaching the declared schema.

For the legacy-upgrade path:

1. Verify the legacy table fingerprint.
2. Record `0002` as superseded by the observed baseline plus `0005`; do not mark
   it executed.
3. Execute and verify `0005` only after approval.

For a fresh bootstrap, create the canonical partner table directly and record
the reconciliation as `included_in_bootstrap` at the canonical cutover.

### `0005` postconditions

- `status` is non-null.
- Allowed statuses are exactly `pending`, `approved`, `rejected`.
- Requester and partner lookup indexes exist.
- Requester cannot equal partner.
- Only one `pending` or `approved` row exists for an unordered user pair.
- Any number of rejected historical rows can coexist and do not block a new
  request.

## Ordering for `0003` and `0004`

Neither migration was changed.

### `0003_offer_verifications.sql`

Prerequisites:

- `public.users(id)` exists as `varchar`.
- `public.offers(id)` exists as `varchar`.
- `gen_random_uuid()` is available.
- `public.offer_verifications` is absent.
- Offer verification remains a distinct offer-scoped workflow.

Postconditions:

- Table, status check, and two FK lookup indexes match the Phase 1 contract.

### `0004_performance_insights_reports.sql`

Prerequisites:

- `public.users(id)` exists as `varchar`.
- `gen_random_uuid()` and `jsonb` are available.
- `public.performance_insights_reports` is absent.
- Persisted report shape remains the active service/UI contract.

### Proposed existing-upgrade order

1. Verify and record the observed legacy baseline.
2. Apply approved safe authentication schema additions, when authorized.
3. Execute `0003`.
4. Execute `0004`.
5. Execute `0005` partner reconciliation.
6. Apply later domain reconciliation migrations only after their decision
   packages are approved.
7. Verify the canonical cutover fingerprint.

`0003`, `0004`, and `0005` are independent after their prerequisites. Their
numeric order is retained for deterministic execution.

### Rollback considerations

- Before feature data exists, `0003` and `0004` can be rolled back by dropping
  their new tables. After use, dropping them is destructive and requires export
  or forward repair.
- `0005` indexes and checks can be removed, and `status` can be made nullable,
  but rollback weakens integrity. Recreating the disposable branch is the
  preferred test rollback.
- No production rollback should depend on destructive down migrations.

## Contract mapping decision package

The observed contract table currently has zero rows, but the migration design
must remain valid if rows appear before execution.

### Field analysis

| Legacy field | Current field candidate | Derivability and risk |
|---|---|---|
| `total_price` | `total_amount` | Plausible but not proven. Name alone cannot establish whether it is a line total, negotiated price, or another value. |
| `total_price` + `quantity` | `price_per_unit` | Mathematically derivable only if `total_price` is a total amount and quantity is non-zero. Rounding and unit semantics remain risks. |
| absent | `currency` | Not derivable. Defaulting to USD could mislabel legacy agreements. |
| `terms` JSON | payment/delivery/specification fields | Derivable only when documented JSON keys and value formats are proven. |
| `blockchain_tx_hash` | `smart_contract_address` | Not equivalent and explicitly forbidden as a mapping. |
| absent | `smart_contract_status` | Not derivable from a transaction-like string. |
| absent | escrow fields | Additive only; no legacy backfill source. |
| `signed_at` | none | Retain through compatibility; it carries information not represented in the current shared model. |
| `pending_approval` | `pending` | Lifecycle meaning is unresolved. Never replace automatically. |

### Option A — compatibility-first additive migration (recommended)

- Retain `total_price`, `terms`, `blockchain_tx_hash`, `signed_at`, and
  `pending_approval`.
- Add current fields as nullable compatibility columns.
- Extend application types/adapters to read both contracts explicitly.
- New writes populate the current fields and, only where semantics are defined,
  compatibility legacy fields.
- Backfill nothing until semantic preflights and approvals exist.

Risk: temporary schema and application complexity. Benefit: no information loss
and no fabricated values.

### Option B — approved in-place semantic conversion

- Approve `total_price == total_amount`.
- Backfill total amount and derive unit price when quantity is non-zero.
- Parse approved `terms` keys into current columns.
- Retain transaction hash and signed timestamp in archival compatibility
  columns.
- Preserve both lifecycle values until a separate transition is approved.

Risk: a wrong semantic assumption corrupts financial meaning. This option
requires sample-data review and business-owner approval.

### Option C — versioned `contracts_v2`

- Leave legacy contracts untouched.
- Create a new table for the current model.
- Add explicit adapters and migration/linkage between versions.

Risk: highest application complexity and dual lifecycle handling. Use only if
legacy meanings cannot be reconciled safely.

### Required contract decisions

1. Is `total_price` definitively the same business value as `total_amount`?
2. May `price_per_unit` be derived by division, including rounding rules?
3. What currency applies to legacy contracts?
4. Which JSON keys, if any, make legacy `terms` mechanically separable?
5. How do `pending_approval` and `pending` differ, and can both remain active?
6. Is `signed_at` required in the current contract model?

No contract migration should be authored until these are answered.

## KYB and verification-document decision package

The observed verification table currently has zero rows. Active code nevertheless
contains both legacy and shared property names, so a destructive replacement
would hide an application contract defect.

### Field analysis

| Legacy field | Current field candidate | Decision |
|---|---|---|
| `file_path` | `s3_key` / `s3_bucket` | Retain path. Splitting requires a storage-provider URI contract; not mechanically safe. |
| `document_type` varchar | `document_type` enum | Preflight every value before conversion. Existing values cannot be inferred when missing or outside the enum. |
| nullable size/MIME | non-null size/MIME | Enforce for new uploads; do not fabricate legacy values. |
| `status` enum | `verification_status` varchar | Competing authorities; do not duplicate or overwrite automatically. |
| `approved` | `verified` | Plausible but not proven equivalent. |
| `under_review` | no shared value | Retain; active client and route use it. |
| `requires_additional_docs` | no shared value | Retain; active client and AI service use it. |
| `ai_validation_result` | `metadata` | Not automatically equivalent; retain separately. |
| `review_notes` | rejection reason or metadata | Meaning depends on status; retain separately. |
| `reviewed_at` | `verified_at` | Only equivalent for an approved/verified outcome; ambiguous otherwise. |
| absent reviewer | `verified_by` | Additive nullable; cannot backfill without audit evidence. |
| absent contract link | `contract_id` | Additive optional. Current user-KYB routes do not require it. |

### Option A — compatibility-first extension (recommended)

- Preserve all legacy columns and status values.
- Add optional current metadata/reviewer/contract columns only after API
  ownership is approved.
- Keep `file_path` as the authoritative locator during transition.
- Require new writes to populate provider-neutral metadata through an adapter.
- Delay non-null S3 columns and enum conversion.

Risk: temporary dual models in code. Benefit: supports current client statuses
without inventing mappings.

### Option B — new provider-neutral document locator

- Add a structured JSON locator with provider, bucket/container, key/path, and
  version.
- Populate it for new uploads.
- Migrate legacy paths only through provider-specific parsing rules.

Risk: requires a storage architecture decision beyond Phase 2A.

### Option C — replacement table

- Create a versioned verification table and migrate only documents whose
  locator and status can be proven.

Risk: dual reads, partial migration, and orphaning. Not recommended while the
table contract is unresolved.

### Required KYB decisions

1. Is `approved` business-equivalent to `verified`?
2. Which status set is canonical, and how are `under_review` and
   `requires_additional_docs` represented?
3. Is storage provider-specific S3 metadata required, or should locators remain
   provider-neutral?
4. Can existing `file_path` values be parsed reliably?
5. Are file size and MIME required for historical records or only new uploads?
6. Is offer/contract document linkage part of KYB or a separate document
   domain?
7. Which review outcomes require reviewer identity and rejection reason?

No verification-document migration should be authored until these are answered.

## Users and authentication analysis

### `0001_local_auth.sql` schema-only operations

- Adds nullable `password_hash`.
- Adds `auth_provider` with default `local`.
- Adds nullable `email_verified_at`.
- Adds nullable `last_login_at`.
- Creates `sessions` and the expiry index if absent.

The observed sessions table and index already match.

### Data-changing operation

`0001` updates every passwordless user whose provider is null or `local` to
`legacy`. This is not a schema-only migration. It assumes passwordless existing
users should be classified as legacy.

### Identity and access implications

- Active authentication is local Passport and requires a password hash.
- The legacy Replit Auth module is excluded from compilation.
- `neon_auth.users_sync` exists, but active code has no account-linking path.
- A public user labeled `legacy` still cannot log in through active local auth
  without a password.
- It is unknown whether `neon_auth.users_sync.id` corresponds to
  `public.users.id`; inspecting personal rows was intentionally avoided.
- Adding `auth_provider DEFAULT 'local'` can temporarily label passwordless
  existing users as local before the update runs.
- `0001` does not grant admin or verification privileges, but later shared
  defaults for plans and verification could incorrectly classify existing
  users if applied without backfill review.

### Future split

1. **Safe additive schema migration**
   - Add nullable auth columns without provider defaults for existing rows.
   - Preserve the existing sessions table.
   - Add a default for new rows only after application behavior is coordinated.
2. **Explicit data backfill**
   - Classify existing accounts from reviewed identity evidence.
   - Never create password hashes or link external IDs automatically.
3. **Authentication behavior decision**
   - Choose local-only, Neon/external-only, or coexistence/account linking.
   - Provide an activation/password-setting path before disabling any existing
     authentication route.

`0001` should not be executed or rewritten until this split is approved.

## Fresh-database bootstrap plan

### Principles

- Structural migrations contain no users, commodities, offers, or demo rows.
- Neon-managed `neon_auth` objects are not created by application migrations.
- Every enum and table has documented provenance: observed legacy, approved
  shared contract, or explicit business decision.
- Foreign keys are added only after both referenced tables exist.
- Demo seeding is a separate, development-only command requiring an explicit
  disposable-environment marker.

### Proposed creation order

1. Migration journal and bootstrap identity.
2. Approved enums:
   - `commodity_type`;
   - `offer_type`;
   - approved superset of `offer_status`;
   - approved contract lifecycle enum;
   - approved verification/document enums.
3. Root tables:
   - `users`;
   - `sessions`;
   - `commodities`.
4. Offer domain:
   - `offers`;
   - `interested_offers`;
   - `offer_verifications`.
5. Relationship and logging domain:
   - canonical `partner_relations`;
   - `audit_logs`;
   - retained `activity_logs` only if compatibility is approved.
6. Contract and trading domain:
   - approved canonical/compatibility `contracts`;
   - `orders`.
7. Document domain:
   - approved compatibility `verification_documents`;
   - `temp_doc_links`.
8. Insights:
   - `performance_insights_reports`.
9. Secondary indexes, partial unique indexes, and validated check constraints.
10. Canonical schema fingerprint and cutover record.

### Existing database joining the chain

1. Verify the recovery marker and legacy fingerprint.
2. Record the observed baseline provenance.
3. Apply schema-only reconciliation migrations.
4. Apply separately approved data backfills.
5. Apply `0003`, `0004`, and `0005` according to their path rules.
6. Resolve contract, KYB, orders, offers, authentication, and logging decisions.
7. Verify the same canonical fingerprint produced by fresh bootstrap.
8. Record the cutover.
9. Begin the shared post-cutover chain.

### Seed separation

- Structural SQL never calls `seedDemoData` or `clearDemoData`.
- Demo seed routes must not participate in bootstrap or deployment.
- Future demo seeding must require non-production mode, an explicit recovery
  marker, authentication/authorization, and a separate operator action.

## Approval gates before migration execution

1. Approve the migration journal/provenance model.
2. Approve execution of `0003`, `0004`, and `0005` on a recreated disposable
   branch.
3. Approve contract field and lifecycle decisions.
4. Approve KYB status and storage-locator decisions.
5. Approve authentication coexistence and existing-user treatment.
6. Approve offer enum/backfill policy.
7. Approve order, payment, and escrow lifecycle values plus DTO shape.
8. Decide whether `activity_logs` and `audit_logs` coexist permanently or enter
   a reviewed migration.
9. Review all data-changing backfills separately from structural DDL.

The recommended next checkpoint is an executable migration-plan review on a
freshly recreated disposable Neon branch, starting only with the journal
prototype and the already evidence-backed `0003`, `0004`, and `0005` changes.
