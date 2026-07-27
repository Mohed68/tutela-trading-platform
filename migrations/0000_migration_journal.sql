-- TUTELA migration provenance journal.
-- This object is created only after a disposable/recovery environment has
-- passed the approved legacy structural fingerprint check.

CREATE TABLE public.tutela_migration_journal (
  migration_identifier varchar PRIMARY KEY,
  migration_filename text NOT NULL,
  checksum char(64) NOT NULL,
  provenance varchar NOT NULL,
  execution_path varchar NOT NULL,
  git_revision char(40) NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  execution_timestamp timestamptz,
  execution_status varchar NOT NULL,
  sql_executed boolean NOT NULL DEFAULT false,
  included_in_bootstrap boolean NOT NULL DEFAULT false,
  failure_message text,
  notes text,
  CONSTRAINT tutela_migration_journal_checksum_check
    CHECK (checksum ~ '^[0-9a-f]{64}$'),
  CONSTRAINT tutela_migration_journal_provenance_check
    CHECK (provenance IN (
      'observed_legacy_baseline',
      'legacy_reconciliation',
      'additive_migration',
      'fresh_bootstrap',
      'common_post_cutover'
    )),
  CONSTRAINT tutela_migration_journal_execution_path_check
    CHECK (execution_path IN (
      'existing_database_upgrade',
      'fresh_database_bootstrap'
    )),
  CONSTRAINT tutela_migration_journal_status_check
    CHECK (execution_status IN (
      'running',
      'verified',
      'succeeded',
      'failed',
      'superseded'
    )),
  CONSTRAINT tutela_migration_journal_execution_mode_check
    CHECK (NOT (sql_executed AND included_in_bootstrap)),
  CONSTRAINT tutela_migration_journal_success_check
    CHECK (
      execution_status <> 'succeeded'
      OR (sql_executed AND execution_timestamp IS NOT NULL)
    ),
  CONSTRAINT tutela_migration_journal_nonexecution_check
    CHECK (
      execution_status NOT IN ('verified', 'superseded')
      OR (NOT sql_executed AND execution_timestamp IS NULL)
    )
);

CREATE INDEX tutela_migration_journal_status_idx
  ON public.tutela_migration_journal (execution_status, recorded_at);
