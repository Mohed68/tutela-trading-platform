# TUTELA schema authority matrix

This matrix compares the observed legacy Neon structure with
`shared/schema.ts`, active server behavior, active client consumers, existing
migrations, and repository documentation. It records evidence and unresolved
decisions; it does not declare `shared/schema.ts` authoritative where the
business meaning is ambiguous.

## Classification legend

- **Legacy retained**: preserve during recovery; removal is not authorized.
- **Shared approved**: explicitly approved in an earlier recovery checkpoint.
- **Equivalent rename**: mechanically equivalent only after a data/type
  preflight proves equivalence.
- **Additive**: can be introduced without changing existing values.
- **Backfill required**: new non-null or interpreted data needs an explicit,
  reviewed transformation.
- **Business decision**: lifecycle or semantic ownership is unresolved.
- **Obsolete, retained**: not used by active code, but not proven safe to remove.
- **Unsafe/ambiguous**: no defensible automatic mapping exists.

## Users and authentication

| Field or behavior | Observed legacy | Shared / active evidence | Classification and design consequence |
|---|---|---|---|
| `id`, `email`, names, profile image | Present in `public.users` | Queried by `DatabaseStorage`, local Passport, and client session | Legacy retained; structurally compatible |
| `company_name`, `role`, ratings, `verified` | Present | Used throughout offer, partner, marketplace, and admin UI | Legacy retained |
| `password_hash` | Absent | Required by active local login and registration | Additive schema; existing-user behavior requires a separate decision |
| `auth_provider` | Absent | Active registration writes `local`; migration `0001` later labels passwordless users `legacy` | Additive schema plus explicit backfill |
| `email_verified_at`, `last_login_at` | Absent | `last_login_at` is written after local login; both required by startup health check | Additive and nullable |
| `neon_auth.users_sync` identity | Separate Neon-managed table; no application FK or query | Active code does not import or query it | Unsafe/ambiguous account-linking source |
| KYB status and verification-level user columns | Absent | Active auth/KYB routes and admin UI read/write them | Additive fields; defaults on existing users require business review |
| Admin role and 2FA columns | Absent | Admin authorization reads `admin_role`; UI assumes role data | Additive; never backfill privileges automatically |
| Plan/subscription columns | Absent | `/api/auth/plan` and checkout flows consume them | Additive; assigning plans to existing users is a business backfill |
| Usage counters | Absent | Plan/usage responses consume them | Additive with zero defaults only after confirming zero means “not previously measured” |
| Preferences and notification JSON | Absent | Preference route writes them | Additive; timezone/currency defaults may label existing users and need review |
| Authentication documentation | README says Replit Auth; `auth.ts` implements local Passport; legacy Replit module is excluded | Render guide describes local auth and migration `0001` | Active `auth.ts` is implementation evidence; README is obsolete, retained documentation |

Authentication authority remains unresolved for existing identities. Local and
Neon/external authentication do not currently coexist in active code.

## Commodities

| Field or behavior | Observed legacy | Shared / active evidence | Classification |
|---|---|---|---|
| All columns and `commodity_type` values | Match shared schema | Storage, offer joins, filters, seed definitions, and client lists use them | Legacy retained and structurally authoritative |
| Identifier generation | `varchar` + `gen_random_uuid()` | Shared schema matches | Mechanically compatible |

No commodity migration is required by current evidence.

## Offers

| Field or status | Observed legacy | Shared / active evidence | Classification and consequence |
|---|---|---|---|
| Core IDs, type, quantity, unit, price, currency, location | Present and used | Shared schema and marketplace routes match | Legacy retained |
| `min_quantity` / `minOrderQty` | Live DB column is `min_quantity`; Drizzle property is `minOrderQty` | Active create/seed code uses the property | Equivalent ORM property mapping; no physical rename |
| `valid_until`, delivery/payment terms | Present | Shared and client use them | Legacy retained |
| `verified` | Absent | Marketplace filters and cards consume it | Additive; existing-offer backfill requires evidence |
| `specifications`, `delivery_options` | Absent | Active offer clients and current schema consume them | Additive, initially nullable |
| Seller organization fields | Absent | Active marketplace normalization and cards consume them | Additive; organization identity/verification backfills require business data |
| Delegate fields | Absent | Shared schema marks authorization non-null; create flows provide delegate information inconsistently | Additive; non-null/default behavior needs preflight and business review |
| Bar and packaging JSON | Absent | Active commodity-specific offer UI can produce them | Additive, nullable |
| Moderation fields | Absent | Admin moderation routes write them | Additive; status values must align before execution |
| `offer_status` | Legacy: `active`, `pending`, `closed`, `cancelled` | Shared also contains `hidden`, `archived`; admin routes use moderation concepts | Business decision: extend enum additively, never replace existing values |
| README “verified offers” claims | Documentation claim | Database lacks verification columns | Documentation is not migration authority |

## Interested offers

| Field or behavior | Observed legacy | Shared / active evidence | Classification |
|---|---|---|---|
| Entire table | Absent | Shared table, storage methods, and authenticated add/remove/check routes are active | Additive active feature |
| IDs and user/offer FKs | Absent | Directly required by storage joins | Shared field approved by active contract |
| Message and proposed quantity/price | Absent | Not required by current add-interest route but present in shared model | Additive, nullable; retained until product usage is characterized |
| Status `pending/accepted/rejected` | Absent | Shared model only; active add route defaults status | Requires workflow characterization before status transitions are declared authoritative |

## Orders

| Field or status | Observed legacy | Shared / active evidence | Classification and consequence |
|---|---|---|---|
| Entire table | Absent | Shared table plus active order routes and page | Additive active feature |
| Buyer/seller identity | Absent | Earlier approved contract: rows belong to session user when buyer or seller | Shared approved |
| `total_amount` | Absent | Earlier approved as authoritative UI field | Shared approved |
| Contract link and commodity snapshot | Absent | Shared schema requires both; create route does not currently validate them | Requires API characterization before migration is called runtime-ready |
| Order lifecycle | Shared: `created`, `payment_pending`, `paid`, `in_transit`, `delivered`, `completed`, `cancelled`, `disputed` | Client display still contains `pending` and `confirmed` | Business decision; schema and active client statuses conflict |
| Payment and escrow lifecycles | Shared model only | Client labels include `escrowed`/`released`, which do not equal shared payment statuses | Business decision |
| Enriched offer/counterparty response | Storage returns raw order rows; client type expects nested offer/user | Frontend/backend contract mismatch | Unsafe to solve through schema alone |

The orders table can be created additively later, but application startup should
not be described as workflow-safe until lifecycle and DTO conflicts are
resolved.

## Contracts

| Field or status | Observed legacy | Shared / active evidence | Classification |
|---|---|---|---|
| IDs, offer/buyer/seller FKs, quantity, delivery date, timestamps | Present | Shared and storage agree | Legacy retained |
| `total_price` | Non-null legacy numeric | Shared uses `price_per_unit` and `total_amount`; no rows currently exist | Unsafe/ambiguous semantic mapping |
| `price_per_unit` | Absent | Required by shared schema and metrics | Additive; cannot fabricate |
| `total_amount` | Absent | Earlier approved as current contract/order value field | Additive; backfill only after approving whether `total_price` is equivalent |
| `currency` | Absent | Shared and client consume it | Additive; defaulting legacy rows to USD would be a business assertion |
| `terms` JSON | Present | Shared separates payment, delivery, and specification text | Legacy retained; parsing requires documented keys |
| `payment_terms`, `delivery_terms`, `specifications` | Absent | Active simulation and UI consume them | Additive; optional compatibility fields |
| `blockchain_tx_hash` | Present | Current service is explicitly simulated and uses smart-contract address/status | Legacy retained; never map to an address |
| `smart_contract_address/status` | Absent | Earlier approved simulated-state persistence | Additive |
| `escrow_address` | Absent | Shared field; no current authoritative escrow implementation | Additive nullable; no backfill |
| `signed_at` | Present | Shared does not model it | Legacy retained |
| Lifecycle | Legacy includes `pending_approval`; shared replaces it with `pending` | Client still displays `pending_approval`; current route no longer forces it | Business decision; `pending_approval` must not be removed |

See `migration-recovery-design.md` for the contract decision package.

## Verification documents and KYB

| Field or status | Observed legacy | Shared / active evidence | Classification |
|---|---|---|---|
| IDs, user, filename, upload/review timestamps | Present | Active routes and shared schema use related concepts | Legacy retained |
| `file_path` | Non-null legacy locator | Active object-storage route constructs a path; shared requires S3 key/bucket | Legacy retained; storage-provider decision required |
| `s3_key`, `s3_bucket` | Absent, shared non-null | Object storage may not be S3-compatible in every environment | Unsafe to backfill without provider rules |
| `document_type` | Legacy `varchar` | Shared requires a PostgreSQL enum | Retain varchar during compatibility; enum conversion requires value preflight |
| `file_size`, `mime_type` nullability | Nullable legacy, non-null shared | Upload route can supply values, but legacy rows may not | Additive validation for new writes; existing nulls cannot be fabricated |
| `status` | Legacy PostgreSQL enum | Current storage mixes legacy `status` writes with shared `verificationStatus` reads | Legacy retained during transition |
| `verification_status` | Absent | Shared uses varchar `pending/verified/rejected` | Unsafe duplicate status authority |
| `approved` vs `verified` | Both appear in active layers | No evidence that they are semantically identical | Business decision |
| `under_review` | Legacy enum and active client/route | Absent from shared status set | Business decision; retain |
| `requires_additional_docs` | Legacy enum and client/AI behavior | Absent from shared status set | Business decision; retain |
| AI result and review notes | Present legacy | Storage still writes legacy property names through untyped objects | Legacy retained; do not silently fold into metadata |
| Reviewer/rejection/metadata fields | Absent | Shared expects them | Additive nullable, with ownership and meaning reviewed first |
| `contract_id` | Absent | Shared makes it optional; current KYB routes are user-centric | Additive optional only; not proven required for KYB |

See `migration-recovery-design.md` for the KYB decision package.

## Partner relations

| Field or rule | Observed legacy | Shared / active evidence | Classification |
|---|---|---|---|
| IDs, requester, partner, notes, timestamps | Present | Storage/routes/client match | Legacy retained |
| Status values | Nullable varchar; observed table currently empty | Active client uses `pending`, `approved`, `rejected` | Shared approved |
| Non-null status | Missing | Previously approved | Additive constraint after preflight |
| Self-partnership prevention | Missing | Previously approved | Additive check |
| Requester/partner indexes | Missing | Required for active user relationship query | Additive indexes |
| Active unordered-pair uniqueness | Missing | Previously approved for `pending/approved` only | Additive partial unique index |
| Rejected history | No uniqueness rule | Previously approved to permit new requests | Retain; partial predicate excludes `rejected` |

Read-only preflight on the disposable branch found zero null statuses, invalid
statuses, self-relations, and duplicate active unordered pairs.

## Offer verification

| Field or behavior | Observed legacy | Shared / active evidence | Classification |
|---|---|---|---|
| Entire table | Absent | Active routes create submissions; Phase 1 migration `0003` defines persistence | Additive active feature |
| Offer/submitter FKs, documents, notes, submission timestamps | Absent | Directly written by active routes | Shared approved |
| Status | Active code creates only `pending` | Migration constrains status to `pending` | Shared approved for current submission behavior |
| Reviewer fields | Absent everywhere active | No review route consumes them | Do not invent |
| Relationship to KYB | Separate offer-scoped route and document manifest | User KYB table is user-scoped | Distinct domain |

## Performance insights

| Field or behavior | Observed legacy | Shared / active evidence | Classification |
|---|---|---|---|
| Entire table | Absent | Active latest/generate routes, service, and UI consume persisted reports | Additive active feature |
| User, summary, insights, recommendations, risks, opportunities, generation time | Absent | Produced and consumed as one report contract | Shared approved |
| Failure fallback | No persistence in legacy | Current service returns only an actually stored report | No fabricated data |

Migration `0004` is the evidence-backed additive model.

## Sessions

| Field or behavior | Observed legacy | Shared / active evidence | Classification |
|---|---|---|---|
| `sid`, `sess`, `expire` | Exact structural match | `connect-pg-simple` uses the table with creation disabled | Legacy retained |
| Expiry index | Present | Required by shared schema/migration `0001` | Legacy retained |
| Session ownership | No direct user FK | Session payload is managed by library | Library-owned contract |

## Activity and audit logs

| Field or behavior | Observed legacy | Shared / active evidence | Classification |
|---|---|---|---|
| `activity_logs` | Present and empty | No active storage method queries this table | Legacy retained until proven obsolete |
| `audit_logs` | Absent | Current `logActivity`, dashboard activity, admin audit, and audit logger expect it | Additive active table |
| Basic action/entity/details fields | Present in legacy activity table | Partially overlap audit fields | Unsafe to rename: audit schema has role, before/after, reason, IP, agent, timestamp |
| Audit indexes | Absent | Shared declares user/entity/timestamp indexes | Additive with new audit table |

The two log tables must coexist during recovery unless a reviewed data and
semantic migration proves that `activity_logs` is obsolete.

## Documentation authority

- `README.md` claims Replit Auth, real blockchain behavior, automated Drizzle
  migrations, and recommends `db:push`. These claims conflict with active code
  and current recovery safety rules; the README is not schema authority.
- `docs/RENDER_DEPLOYMENT.md` more accurately documents local authentication
  and the startup schema guard, but assumes the core schema already exists and
  only runs migration `0001`.
- Source code and observed database structure provide implementation evidence,
  but business lifecycle semantics still require explicit approval.
