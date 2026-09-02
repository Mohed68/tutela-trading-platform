# Phase A1.2 Preflight — Controlled Auth Test Database Baseline

## Scope and historical disposition

The accepted historical database identity verdict remains **D — IDENTITY
UNRESOLVED**. The old PostgreSQL `28P01` failure is classified as an external
credential/environment failure against an unresolved historical database.
That database is not being recovered, and it is not future test authority.

Once the controlled test target succeeds, the old failure is non-blocking
historical test-environment debt.

## Explicit test authority

DB-backed Auth integration tests consume only:

```text
TEST_DATABASE_URL=
```

`TEST_DATABASE_URL` must identify an explicitly configured, isolated,
non-production PostgreSQL target. The test harness never falls back to
`DATABASE_URL`, never selects a database from `NODE_ENV`, and rejects a test
URL that exactly matches the configured runtime `DATABASE_URL`.

Missing, invalid, or ambiguous configuration fails before a connection is
created. Hostname heuristics are not treated as proof of isolation; explicit
test configuration and owner-controlled target provisioning remain the
authority.

## Current Auth and Session dependency map

Pure tests:

- `server/password.test.ts`
- `server/auth.security.test.ts`
- `scripts/auth/recovery-user-lib.test.ts`
- `scripts/auth/test-database.test.ts`

DB-backed historical characterization:

- `scripts/auth/legacy-auth.characterization.test.ts`
- `scripts/auth/phase-4a.runtime.characterization.test.ts`
- `scripts/auth/phase-4b.runtime.test.ts`

The historical tests retain their old fixture/fingerprint expectations, but
their connection authority must be the explicit test database—not runtime
`DATABASE_URL`. They are not the new reproducible baseline.

Current controlled integration baseline:

- `scripts/auth/auth-session.integration.test.ts`

Production runtime continues to use `DATABASE_URL` for Drizzle and the
`connect-pg-simple` Session store. The test helper is test-only and production
runtime cannot import it.

## Schema and migration baseline

The repository migration journal begins at
`0000_migration_journal.sql`. The current latest migration is
`0017_organization_verification_artifact_fingerprint_compatibility.sql`.
The controlled target must contain:

- `public.users`
- `public.sessions` with `sid`, `sess`, and `expire`
- `public.tutela_migration_journal`
- a successful or verified `0017` journal record

No new business migration is part of this preflight. Existing migration files
and the TUTELA migration journal remain the schema authority.

During this preflight an explicitly configured target was available. It was
distinct from the configured runtime URL, identified itself as PostgreSQL
17.11 with database name `neondb`, and its journal was already current through
`0017`. It contained prior staging/test records, so it was neither reset nor
seeded and no migration was executed. The preflight did not inspect row
contents. Its only write was the namespaced Session described below.

## Test lifecycle and cleanup

The Session integration test:

1. resolves only `TEST_DATABASE_URL`;
2. verifies the current schema/journal baseline;
3. creates one UUID-namespaced `a1-2-auth-test:*` Session;
4. reads its Passport identity;
5. expires only that Session;
6. destroys it;
7. deletes the exact test SID again in `finally` as defensive cleanup;
8. proves unrelated Session count is unchanged.

It does not create or modify users, Organizations, evidence, offers, orders,
contracts, Trust, Eligibility, or other business data. It does not seed data.

## Commands

Pure contract and safety tests:

```bash
npm run test:auth-test-db-contract
```

Controlled PostgreSQL Session integration:

```bash
npm run test:auth:integration
```

The integration command fails clearly with `TEST_DATABASE_URL_REQUIRED` when
the test target is not explicitly configured.

## Safety invariants

- No `TEST_DATABASE_URL ?? DATABASE_URL` fallback.
- No production hostname or credential is hard-coded.
- No secret value is logged or committed.
- No production environment file is changed.
- No runtime startup behavior changes.
- No schema, migration, MFA, Platform Authority, or Admin activation changes.
- Production and test DB identity are distinct explicit inputs.

## Remaining A1.2 work

This preflight supplies only the controlled Auth/Session integration baseline.
A1.2 remains responsible for its separately approved privileged-session and
MFA contracts, persistence, assurance transitions, tests, and security review.
