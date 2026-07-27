-- Reconcile the observed legacy partner_relations table with the approved
-- partnership integrity contract.
--
-- This migration intentionally does not create the table and does not use
-- IF NOT EXISTS. The legacy schema fingerprint and the read-only preflight in
-- docs/recovery/phase-2a/sql/partner-relations-preflight.sql must be reviewed
-- before execution.
--
-- No violating row is modified or deleted. Any violation aborts the
-- transaction before schema changes are attempted.

BEGIN;

DO $preflight$
DECLARE
  missing_column_count integer;
  null_status_count bigint;
  invalid_status_count bigint;
  self_relation_count bigint;
  duplicate_active_pair_count bigint;
BEGIN
  IF to_regclass('public.partner_relations') IS NULL THEN
    RAISE EXCEPTION
      '0005 preflight failed: public.partner_relations does not exist';
  END IF;

  SELECT count(*)
  INTO missing_column_count
  FROM (
    VALUES ('requester_id'), ('partner_id'), ('status')
  ) required(column_name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.columns existing
    WHERE existing.table_schema = 'public'
      AND existing.table_name = 'partner_relations'
      AND existing.column_name = required.column_name
      AND existing.data_type = 'character varying'
  );

  IF missing_column_count <> 0 THEN
    RAISE EXCEPTION
      '0005 preflight failed: required partner columns or types do not match the observed baseline';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.partner_relations'::regclass
      AND conname IN (
        'partner_relations_no_self',
        'partner_relations_status_check'
      )
  ) THEN
    RAISE EXCEPTION
      '0005 preflight failed: a target constraint already exists; reconcile migration history first';
  END IF;

  IF to_regclass('public.partner_relations_requester_idx') IS NOT NULL
     OR to_regclass('public.partner_relations_partner_idx') IS NOT NULL
     OR to_regclass('public.partner_relations_active_pair_unique') IS NOT NULL
  THEN
    RAISE EXCEPTION
      '0005 preflight failed: a target index already exists; reconcile migration history first';
  END IF;

  SELECT
    count(*) FILTER (WHERE status IS NULL),
    count(*) FILTER (
      WHERE status IS NOT NULL
        AND status NOT IN ('pending', 'approved', 'rejected')
    ),
    count(*) FILTER (WHERE requester_id = partner_id)
  INTO
    null_status_count,
    invalid_status_count,
    self_relation_count
  FROM public.partner_relations;

  SELECT count(*)
  INTO duplicate_active_pair_count
  FROM (
    SELECT
      LEAST(requester_id, partner_id),
      GREATEST(requester_id, partner_id)
    FROM public.partner_relations
    WHERE status IN ('pending', 'approved')
    GROUP BY 1, 2
    HAVING count(*) > 1
  ) duplicate_pairs;

  IF null_status_count <> 0 THEN
    RAISE EXCEPTION
      '0005 preflight failed: % partner relation(s) have a null status',
      null_status_count;
  END IF;

  IF invalid_status_count <> 0 THEN
    RAISE EXCEPTION
      '0005 preflight failed: % partner relation(s) have an unsupported status',
      invalid_status_count;
  END IF;

  IF self_relation_count <> 0 THEN
    RAISE EXCEPTION
      '0005 preflight failed: % self-partnership relation(s) exist',
      self_relation_count;
  END IF;

  IF duplicate_active_pair_count <> 0 THEN
    RAISE EXCEPTION
      '0005 preflight failed: % duplicate active unordered partner pair(s) exist',
      duplicate_active_pair_count;
  END IF;
END
$preflight$;

ALTER TABLE public.partner_relations
  ALTER COLUMN status SET NOT NULL;

ALTER TABLE public.partner_relations
  ADD CONSTRAINT partner_relations_status_check
  CHECK (status IN ('pending', 'approved', 'rejected'));

ALTER TABLE public.partner_relations
  ADD CONSTRAINT partner_relations_no_self
  CHECK (requester_id <> partner_id);

CREATE INDEX partner_relations_requester_idx
  ON public.partner_relations (requester_id);

CREATE INDEX partner_relations_partner_idx
  ON public.partner_relations (partner_id);

CREATE UNIQUE INDEX partner_relations_active_pair_unique
  ON public.partner_relations (
    LEAST(requester_id, partner_id),
    GREATEST(requester_id, partner_id)
  )
  WHERE status IN ('pending', 'approved');

DO $postconditions$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'partner_relations'
      AND column_name = 'status'
      AND is_nullable <> 'NO'
  ) THEN
    RAISE EXCEPTION
      '0005 postcondition failed: partner_relations.status remains nullable';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.partner_relations'::regclass
      AND conname = 'partner_relations_status_check'
      AND contype = 'c'
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.partner_relations'::regclass
      AND conname = 'partner_relations_no_self'
      AND contype = 'c'
  ) THEN
    RAISE EXCEPTION
      '0005 postcondition failed: expected partner constraints are missing';
  END IF;

  IF to_regclass('public.partner_relations_requester_idx') IS NULL
     OR to_regclass('public.partner_relations_partner_idx') IS NULL
     OR to_regclass('public.partner_relations_active_pair_unique') IS NULL
  THEN
    RAISE EXCEPTION
      '0005 postcondition failed: expected partner indexes are missing';
  END IF;
END
$postconditions$;

COMMIT;
