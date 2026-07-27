# Phase 2B migration execution plan

Status: approved disposable-branch rehearsal only

This plan applies only to the marked Neon recovery branch and the
`existing_database_upgrade` path. It does not authorize production access or
changes to authentication, contracts, KYB, offers, orders, logs, or other
unresolved domains.

## Required isolation gate

Execution stops unless all of the following are true:

- the copied legacy row counts match the approved baseline;
- the application schema fingerprint is
  `0ff84f064026bb8e918a9ffc1725a8fb611eb753169bf07b9c166e81ee9f143f`;
- the previous recovery marker, migration journal, migrations 0003 and 0004
  tables, and migration 0005 objects were absent before marking the branch;
- the newly created marker contains exactly one
  `tutela-recovery-test` row.

The runner reads `DATABASE_URL` through Node's normal `.env` loading. It never
prints the URL, database result rows, user identifiers, or raw database error
messages.

## Journal representation before execution

The journal is `public.tutela_migration_journal`. It records immutable
identifiers, filenames, SHA-256 checksums, provenance, execution path, Git
revision, recorded/execution timestamps, status, execution mode, and optional
redacted failure information.

Initial records:

| Identifier | Provenance | Status | SQL executed | Meaning |
|---|---|---|---:|---|
| `0000_migration_journal` | `additive_migration` | `succeeded` | yes | Journal DDL executed and structurally verified. |
| `observed_legacy_neon_baseline_v1` | `observed_legacy_baseline` | `verified` | no | Structure was observed and fingerprinted; repository SQL did not create it. |
| `0002_partner_relations` | `legacy_reconciliation` | `superseded` | no | Not executed; existing-database treatment is baseline plus 0005. |

Migration 0001 remains unresolved, unapplied, and absent from the journal.
Migrations 0003, 0004, and 0005 are first recorded as `running`; each becomes
`succeeded` only after transactional SQL execution and post-verification. A
failure is recorded as `failed` with a redacted category.

All records use execution path `existing_database_upgrade`,
`included_in_bootstrap = false`, and the Git revision containing the runner and
reviewed SQL.

## Approved checksums

| Artifact | SHA-256 |
|---|---|
| `migrations/0000_migration_journal.sql` | `35c534ac940af5ce8bc7b77c0fa4fd0e8edd977f7c07248a23caaff855e87a4c` |
| `docs/recovery/phase-2a/observed-legacy-schema-baseline.md` | `ea285e13806212cefca771c8e440b38a43ace580df1f52a4d1551bbb727a5245` |
| `migrations/0002_partner_relations.sql` | `d234e83d6bdb6a3ea420f8dff0361b0084b0016b668a28f6cd19fa0665727859` |
| `migrations/0003_offer_verifications.sql` | `936fb67c77b5db782d5c070379ff331eb14cde06eb67f11904669528ac0135b6` |
| `migrations/0004_performance_insights_reports.sql` | `184040f05ba0572959624678b771d0df5160007a004165a4b38bd5369419cbcf` |
| `migrations/0005_partner_relations_reconciliation.sql` | `dc3afbf40d9abcdef07b532b965d60e257b490c1f78c1bdd7787ef71bf341e40` |

The runner computes these from repository files, rechecks them immediately
before SQL execution, records them in the journal, and later compares every
journaled checksum with the repository.

## Execution order and expected delta

1. Create and verify the migration journal.
2. Record the observed legacy baseline without claiming execution.
3. Record migration 0002 as superseded without executing it.
4. Preflight, execute, and verify migration 0003:
   `public.offer_verifications`, two foreign keys, one status check, and two
   lookup indexes.
5. Preflight, execute, and verify migration 0004:
   `public.performance_insights_reports`, its user foreign key, JSONB columns,
   and the user/generated-time index.
6. Preflight, execute, and verify migration 0005:
   non-null partner status, status and no-self checks, two lookup indexes, and
   one partial unique unordered-active-pair index.
7. Generate the resulting structural fingerprint.
8. Test journal reapplication rejection, checksum mismatch rejection, UUID
   defaults, and partner constraint behavior using transactions that roll back.

The runner removes migration 0005's file-level transaction boundary only in
memory so that its SQL and the independent post-verifier execute within one
runner-controlled transaction. The reviewed SQL file and checksum are not
modified.

## Failure and rollback

No migration is manually patched after a failure. The runner rolls back the
active transaction and records a safe failure category where the journal
exists. The preferred rollback is deletion/recreation of the disposable Neon
branch from the original source branch.

Object-level rollback SQL is documented for emergency analysis only and is not
the preferred recovery path:

```sql
DROP TABLE public.performance_insights_reports;
DROP TABLE public.offer_verifications;

DROP INDEX public.partner_relations_active_pair_unique;
DROP INDEX public.partner_relations_partner_idx;
DROP INDEX public.partner_relations_requester_idx;
ALTER TABLE public.partner_relations
  DROP CONSTRAINT partner_relations_no_self,
  DROP CONSTRAINT partner_relations_status_check,
  ALTER COLUMN status DROP NOT NULL;

DROP TABLE public.tutela_migration_journal;
DROP TABLE public.recovery_environment_marker;
```

This SQL must never be used on the original branch. Final rehearsal validation
uses branch recreation and read-only fingerprint verification instead.
