# TUTELA observed legacy-schema baseline

Status: observed structure only

Observed on: 2026-07-27

Source: confirmed disposable Neon recovery branch

PostgreSQL: 17.10

This document records database structure observed through read-only catalog
queries. It contains no business rows or personal data. It is not an executable
migration and does not claim that the legacy database was historically created
from repository migrations.

The `public.recovery_environment_marker` table is intentionally excluded from
the legacy baseline. It was created afterward as an isolated recovery-branch
control marker.

## Schemas

- `neon_auth`
- `public`

## PostgreSQL enum types

| Enum | Ordered values |
|---|---|
| `commodity_type` | `fuel_hydrocarbons`, `metals_precious`, `agricultural` |
| `contract_status` | `draft`, `pending_approval`, `active`, `completed`, `cancelled` |
| `offer_status` | `active`, `pending`, `closed`, `cancelled` |
| `offer_type` | `buy`, `sell` |
| `verification_status` | `pending`, `under_review`, `approved`, `rejected`, `requires_additional_docs` |

No legacy `document_type` PostgreSQL enum was observed.

## `neon_auth.users_sync`

This is a Neon-managed synchronization table. The application repository does
not currently query it.

| Column | PostgreSQL type | Nullable | Default |
|---|---|---:|---|
| `raw_json` | `jsonb` | no | none |
| `id` | `text` | no | none |
| `name` | `text` | yes | none |
| `email` | `text` | yes | none |
| `created_at` | `timestamptz` | yes | none |
| `updated_at` | `timestamptz` | yes | none |
| `deleted_at` | `timestamptz` | yes | none |

Constraints and indexes:

- Primary key: `users_sync_pkey (id)`.
- Index: `users_sync_deleted_at_idx (deleted_at)`.

## `public.users`

| Column | PostgreSQL type | Nullable | Default |
|---|---|---:|---|
| `id` | `varchar` | no | `gen_random_uuid()` |
| `email` | `varchar` | yes | none |
| `first_name` | `varchar` | yes | none |
| `last_name` | `varchar` | yes | none |
| `profile_image_url` | `varchar` | yes | none |
| `company_name` | `varchar` | yes | none |
| `role` | `varchar` | yes | `'trader'` |
| `financial_rating` | `numeric(3,1)` | yes | `0` |
| `credit_rating` | `varchar` | yes | `'unrated'` |
| `verified` | `boolean` | yes | `false` |
| `created_at` | `timestamp` | yes | `now()` |
| `updated_at` | `timestamp` | yes | `now()` |

Constraints and indexes:

- Primary key: `users_pkey (id)`.
- Unique constraint and index: `users_email_unique (email)`.

## `public.commodities`

| Column | PostgreSQL type | Nullable | Default |
|---|---|---:|---|
| `id` | `varchar` | no | `gen_random_uuid()` |
| `name` | `varchar` | no | none |
| `type` | `commodity_type` | no | none |
| `description` | `text` | yes | none |
| `specifications` | `jsonb` | yes | none |
| `created_at` | `timestamp` | yes | `now()` |

Constraints and indexes:

- Primary key: `commodities_pkey (id)`.

## `public.offers`

| Column | PostgreSQL type | Nullable | Default |
|---|---|---:|---|
| `id` | `varchar` | no | `gen_random_uuid()` |
| `user_id` | `varchar` | no | none |
| `commodity_id` | `varchar` | no | none |
| `type` | `offer_type` | no | none |
| `quantity` | `numeric(15,2)` | no | none |
| `unit` | `varchar` | no | none |
| `price_per_unit` | `numeric(15,2)` | no | none |
| `currency` | `varchar` | yes | `'USD'` |
| `location` | `varchar` | no | none |
| `status` | `offer_status` | yes | `'active'` |
| `valid_until` | `timestamp` | yes | none |
| `min_quantity` | `numeric(15,2)` | yes | none |
| `delivery_terms` | `text` | yes | none |
| `payment_terms` | `text` | yes | none |
| `created_at` | `timestamp` | yes | `now()` |
| `updated_at` | `timestamp` | yes | `now()` |

Constraints and indexes:

- Primary key: `offers_pkey (id)`.
- Foreign key: `user_id -> public.users(id)`.
- Foreign key: `commodity_id -> public.commodities(id)`.

No non-primary-key indexes were observed.

## `public.contracts`

| Column | PostgreSQL type | Nullable | Default |
|---|---|---:|---|
| `id` | `varchar` | no | `gen_random_uuid()` |
| `offer_id` | `varchar` | no | none |
| `buyer_id` | `varchar` | no | none |
| `seller_id` | `varchar` | no | none |
| `quantity` | `numeric(15,2)` | no | none |
| `total_price` | `numeric(15,2)` | no | none |
| `status` | `contract_status` | yes | `'draft'` |
| `terms` | `jsonb` | yes | none |
| `blockchain_tx_hash` | `varchar` | yes | none |
| `signed_at` | `timestamp` | yes | none |
| `delivery_date` | `timestamp` | yes | none |
| `created_at` | `timestamp` | yes | `now()` |
| `updated_at` | `timestamp` | yes | `now()` |

Constraints and indexes:

- Primary key: `contracts_pkey (id)`.
- Foreign key: `offer_id -> public.offers(id)`.
- Foreign key: `buyer_id -> public.users(id)`.
- Foreign key: `seller_id -> public.users(id)`.

No non-primary-key indexes were observed.

## `public.verification_documents`

| Column | PostgreSQL type | Nullable | Default |
|---|---|---:|---|
| `id` | `varchar` | no | `gen_random_uuid()` |
| `user_id` | `varchar` | no | none |
| `document_type` | `varchar` | no | none |
| `file_name` | `varchar` | no | none |
| `file_path` | `varchar` | no | none |
| `file_size` | `integer` | yes | none |
| `mime_type` | `varchar` | yes | none |
| `status` | `verification_status` | yes | `'pending'` |
| `ai_validation_result` | `jsonb` | yes | none |
| `review_notes` | `text` | yes | none |
| `uploaded_at` | `timestamp` | yes | `now()` |
| `reviewed_at` | `timestamp` | yes | none |

Constraints and indexes:

- Primary key: `verification_documents_pkey (id)`.
- Foreign key: `user_id -> public.users(id)`.

No non-primary-key indexes were observed.

## `public.partner_relations`

| Column | PostgreSQL type | Nullable | Default |
|---|---|---:|---|
| `id` | `varchar` | no | `gen_random_uuid()` |
| `requester_id` | `varchar` | no | none |
| `partner_id` | `varchar` | no | none |
| `status` | `varchar` | yes | `'pending'` |
| `notes` | `text` | yes | none |
| `created_at` | `timestamp` | yes | `now()` |
| `updated_at` | `timestamp` | yes | `now()` |

Constraints and indexes:

- Primary key: `partner_relations_pkey (id)`.
- Foreign key: `requester_id -> public.users(id)`.
- Foreign key: `partner_id -> public.users(id)`.

The observed table has no self-partnership check, status-value check,
requester/partner lookup indexes, or active unordered-pair uniqueness rule.

## `public.activity_logs`

| Column | PostgreSQL type | Nullable | Default |
|---|---|---:|---|
| `id` | `varchar` | no | `gen_random_uuid()` |
| `user_id` | `varchar` | no | none |
| `action` | `varchar` | no | none |
| `entity_type` | `varchar` | yes | none |
| `entity_id` | `varchar` | yes | none |
| `details` | `jsonb` | yes | none |
| `created_at` | `timestamp` | yes | `now()` |

Constraints and indexes:

- Primary key: `activity_logs_pkey (id)`.
- Foreign key: `user_id -> public.users(id)`.

## `public.sessions`

| Column | PostgreSQL type | Nullable | Default |
|---|---|---:|---|
| `sid` | `varchar` | no | none |
| `sess` | `jsonb` | no | none |
| `expire` | `timestamp` | no | none |

Constraints and indexes:

- Primary key: `sessions_pkey (sid)`.
- Index: `IDX_session_expire (expire)`.

## Identifier generation

- Legacy application entity IDs use `varchar` with `gen_random_uuid()`.
- `gen_random_uuid()` is available in the observed database.
- Session IDs and `neon_auth.users_sync.id` have no database default.
- No application-owned legacy sequence was observed.

## Absent structures expected by current repository code

The following `shared/schema.ts` tables were not present in the observed legacy
baseline:

- `audit_logs`
- `temp_doc_links`
- `interested_offers`
- `orders`
- `offer_verifications`
- `performance_insights_reports`

The absence of these tables is a schema fact, not evidence that their active
features are obsolete.
