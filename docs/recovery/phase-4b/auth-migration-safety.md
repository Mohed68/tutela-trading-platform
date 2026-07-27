# Phase 4B additive authentication migration safety package

Migration: `0006_additive_auth_recovery`

- Approved pre-migration fingerprint:
  `1654ed34b5a19cef9edc6fe3e996553e59c370f311207a89348811f969e3def8`
- Rehearsed post-migration fingerprint:
  `e79139302ae53b2dafb58a2eaf54ab47873df4a15dd3c0026ea0024d424da659`
- Rehearsal result: postflight passed, legacy snapshot unchanged, transaction
  rolled back

## Purpose

Add only the state required to authorize one local recovery account. The
migration does not activate, classify, backfill, or assign credentials to the
four legacy users.

## Added nullable columns

| Column | Purpose | Legacy value |
|---|---|---|
| `password_hash` | Versioned one-way local password hash | `NULL` |
| `auth_provider` | Explicit provider authority | `NULL` |
| `last_login_at` | Successful-login timestamp | `NULL` |
| `login_enabled` | Explicit login gate | `NULL` |
| `credential_status` | Explicit credential lifecycle | `NULL` |
| `recovery_provenance` | Isolated recovery-account marker | `NULL` |

There are no defaults. `NULL` means no authentication authority is asserted.
Email verification is intentionally not added because it is not required for
the approved loop and must remain unknown.

## Constraints and index

- `credential_status` is nullable and, when present, is `active` or `revoked`.
- `recovery_provenance` is nullable and, when present, is exactly
  `tutela-recovery-test`.
- A partial unique index permits at most one non-null recovery provenance.

Application authority still requires every approved predicate:
provider `local`, login enabled, credentials active, and a present valid hash.

## Preflight

The execution tool must verify:

1. controlled recovery mode is explicit;
2. `NODE_ENV` is not production;
3. Render is absent;
4. the recovery marker is valid;
5. the application fingerprint equals the approved Phase 4A fingerprint;
6. exactly four users exist;
7. the migration journal has no `0006` collision;
8. a snapshot of every original legacy-user column is held in memory.

No secret or user value is printed.

## Rehearsal

The full SQL is executed in one transaction on the disposable branch.
Postflight and the legacy snapshot are checked before the transaction is
rolled back. The resulting structural fingerprint is then recorded in the
execution tool before real execution.

## Postflight

The execution tool verifies:

1. all six columns exist, are nullable, and have no defaults;
2. both constraints exist;
3. the partial unique recovery index exists;
4. every legacy auth field remains null;
5. original legacy-user fields match the in-memory preflight snapshot;
6. the post-migration fingerprint matches the rehearsed value;
7. the journal entry is `succeeded`, has the committed SQL checksum, and
   records SQL execution.

## Journal

- Identifier: `0006_additive_auth_recovery`
- Provenance: `additive_migration`
- Execution path: `existing_database_upgrade`
- SQL executed: true only after successful postflight
- Included in bootstrap: false

The journal record and DDL commit atomically.

## Rollback considerations

Rollback is not automatic. It is unsafe while a recovery user or session
exists. A separately approved rollback must first:

1. stop the recovery server;
2. remove only recovery-account sessions;
3. remove the recovery-only account;
4. verify four unchanged legacy users remain;
5. remove the partial index and two constraints;
6. drop the six additive columns;
7. record the rollback provenance rather than deleting journal history.

The conceptual reverse order is:

```sql
DROP INDEX public.users_recovery_provenance_unique;
ALTER TABLE public.users
  DROP CONSTRAINT users_recovery_provenance_check,
  DROP CONSTRAINT users_credential_status_check,
  DROP COLUMN recovery_provenance,
  DROP COLUMN credential_status,
  DROP COLUMN login_enabled,
  DROP COLUMN last_login_at,
  DROP COLUMN auth_provider,
  DROP COLUMN password_hash;
```

This SQL is documentation only and is not authorized for execution.
