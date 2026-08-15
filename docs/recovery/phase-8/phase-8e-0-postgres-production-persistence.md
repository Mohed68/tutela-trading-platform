# Phase 8E.0 — Organization Verification PostgreSQL Production Persistence

## Status

Repository implementation is complete. No live database was accessed because this phase did not identify an explicitly authorized disposable PostgreSQL/Neon environment. Applying migration `0012` and the live restart/recovery proof remain pending explicit disposable-database authorization.

## Architecture

The adapter implements the frozen Organization Verification persistence port without changing Application Service, Replay, Workflow, or durable evidence semantics:

`Application Service → Persistence Port → PostgreSQL Adapter → PostgreSQL`

On load:

`canonical durable envelopes → strict parse → domain-owned rehydration session → authentic evidence stream → Replay`

The adapter is created explicitly and has no singleton, global mutable state, environment lookup, hidden clock, or ID generation. The Node PostgreSQL connection wrapper accepts a caller-owned `pg.Pool`; connection lifecycle and secrets remain outside the domain and adapter.

## Schema

Migration `0012_organization_verification_persistence.sql` creates only:

1. `organization_verification_persistence_streams`
   - immutable stream identity lineage;
   - current persistence version and evidence head for database concurrency;
   - genesis creation fingerprint.
2. `organization_verification_persistence_appends`
   - append identity and batch fingerprint;
   - expected/resulting versions and heads;
   - exact explicit timestamp value and database timestamp;
   - provenance, integrity, and receipt fingerprint.
3. `organization_verification_durable_evidence`
   - deterministic stream position and append binding;
   - evidence identity, kind, semantic identity, version, and fingerprints;
   - canonical `organization-verification-durable-evidence/v1` envelope text.

The schema is additive and append-only. It contains no mutable business current-state table. Stream version and head are concurrency metadata; Replay remains the only authoritative state reconstruction mechanism.

SQL migration and `shared/schema.ts` declare the same tables, columns, indexes, unique constraints, foreign keys, and checks. No historical migration was edited.

## Atomic append and concurrency

A fresh append runs in one PostgreSQL transaction:

1. validate the authentic request and serialize every entry before database mutation;
2. create the empty stream row only for genesis;
3. lock the stream row with `SELECT ... FOR UPDATE`;
4. resolve exact duplicate append identity;
5. verify expected version and head;
6. load and rehydrate committed evidence before extending it;
7. validate the candidate complete stream;
8. insert one append and all canonical evidence entries;
9. update stream version/head with an expected-version predicate;
10. commit once.

Any failure throws across the transaction boundary and rolls back the stream, append, evidence, and version update together. Competing writers cannot both commit the same expected version; no process-local lock is used by production code.

## Idempotency

An existing append ID is idempotent only when stream identity, append batch fingerprint, expected/resulting versions, and receipt fingerprint match exactly. A changed payload or changed semantic operation under the same identity fails closed. Evidence identity and semantic uniqueness constraints prevent overwrite.

## Load and integrity

Load orders evidence by stream position, parses only canonical durable envelopes, verifies envelope and stored fingerprints, and rehydrates through the Phase 8E.0a owner-controlled session. It then reconstructs every committed Append Batch and Receipt to verify:

- continuous expected/resulting versions;
- expected/resulting heads;
- append-to-evidence position coverage;
- exact append IDs;
- batch and receipt fingerprints;
- genesis creation fingerprint;
- complete stream fingerprint and integrity.

Plain JSON is never returned to Replay. Corruption raises only the existing sanitized persistence failure vocabulary.

## Verification performed without a live database

The deterministic PostgreSQL test database implements transaction commit/rollback and database-serialized writes behind the same query contract. Tests prove:

- full persistence adapter conformance;
- exact duplicate and conflicting idempotency behavior;
- rollback after a forced mid-batch failure;
- one winner for competing expected-version writers;
- canonical envelope corruption rejection;
- adapter destruction/recreation followed by rehydration and Replay;
- unchanged Application Service start, advance, fresh adapter creation, load, and authoritative Replay state.

This test database is not represented as live PostgreSQL proof. Migration application, native PostgreSQL constraints, native row locking, and a real process restart against a disposable database remain the phase exit gate.

## Explicit exclusions

This phase does not modify or wire API routes, frontend, registration, Demo, Render, Eligibility, Offer publication, Orders, Contracts, payments, escrow, blockchain, or AI. It does not access production or run any migration.
