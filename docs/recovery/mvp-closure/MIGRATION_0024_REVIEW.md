# Migration 0024 — MVP Transaction Closure Review

## Decision

Approved as an additive, prospective migration for the bounded MVP closure release, subject to TEST-first execution, a fresh production backup, checksum journaling and protected-count verification.

## Authority ownership

The migration does not alter the authority of existing Offers, Orders or Contracts. It adds one closure projection per existing Contract and one immutable terms-snapshot stream. Approvals, signing grants, signatures, artifacts, events, evidence references and disputes are created only by governed application commands. No row is backfilled, no historical Contract is declared ready/executed and no legacy state is reinterpreted.

## Safety properties

- additive tables and indexes; no business-row deletion or column rewrite;
- existing VRE restriction check is expanded only with explicit closure actions;
- current Contract/Order foreign keys preserve source binding;
- snapshots, approvals, artifacts, signatures, events, evidence, disputes and grants reject update/delete;
- executed snapshot/version and terminal projection guards fail closed;
- exact fingerprints and unique constraints prevent duplicate party signature and duplicate open dispute;
- the runner requires successful `0023_pre_v3_closure`, takes an advisory lock, validates the migration checksum, journals success and checks protected row counts.

## Forward and rollback analysis

Before any executed record exists, the deployment can be rolled back at application level by removing route exposure while retaining unused additive schema. After any signature/artifact/event exists, destructive schema rollback is prohibited; the only safe rollback is application disablement plus preservation and forward repair. The migration does not auto-run at server startup.

## Validation

Applied first to `TEST_DATABASE_URL`; table, trigger and journal checks succeeded. Integration uses real PostgreSQL and rolls test business fixtures back. Production execution requires a new `pg_dump`, catalog check, migration, protected-count comparison and post-deploy absence of synthetic closure/signature/closeout rows.
