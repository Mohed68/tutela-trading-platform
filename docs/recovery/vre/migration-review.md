# Formal review: 0022 VRE baseline

Reviewed implementation scope: additive tables, indexes and immutable-history
triggers; predecessor `0021_controlled_platform_owner_correction`. No existing
business table is altered. Foreign keys reference canonical profile and principal
identities, never old verification flags. No legacy backfill, cases, signals or
review decisions are inserted. The sole initial record is prospective policy V2
activation metadata, which is not an Organization decision.

Authorities: policy activation; independent review artifacts; risk signals,
assessments and dispositions; enforcement cases, decisions and scoped actions.
Separate tables preserve distinctions. Enforcement actions reference explicit
decisions and predecessor actions. History rejects UPDATE/DELETE. Privileged
application writes require Security Audit in the same transaction.

Execution: explicit TEST or PRODUCTION target, TEST_DATABASE_URL distinct from
DATABASE_URL, migration lock, predecessor status, exact SQL checksum, collision
checks, one transactional migration and journal update. The runner snapshots and
rechecks row counts for users, trading, verification, participation, membership,
registry, and Platform Ownership tables inside that transaction. Reexecution
verifies the recorded checksum and history triggers rather than executing SQL
again. Initial domain tables must be empty. Test fixtures use rolled-back
transactions.

Rollback: failure before COMMIT rolls back the entire additive migration. After
successful activation, retain tables and all historical V2 facts. Do not drop
tables, reset activation or run V1 for new decisions. A code rollback must disable
new verification commands until V2-capable code is restored; historical read
availability is not authority to issue V1 decisions. Prefer forward fixes.

Production prerequisites: successful TEST rehearsal and regression gates,
verified host/repository/service, recoverable database checkpoint, exact prior
schema, no concurrent deployment. Production mutation is limited to this
migration's additive objects and journal. Record final rehearsal/deployment
evidence in the delivery report; this review does not claim execution success.
