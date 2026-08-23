-- Phase 8G narrow staging blocker reconciliation.
--
-- The temporary direct-registration bridge uses an explicit provenance marker
-- that is not an email-verification assertion. Preserve the recovery marker's
-- uniqueness while allowing multiple temporary registration records.

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_recovery_provenance_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_recovery_provenance_check
  CHECK (
    recovery_provenance IS NULL
    OR recovery_provenance IN (
      'tutela-recovery-test',
      'tutela-temporary-direct-registration'
    )
  );

DROP INDEX IF EXISTS public.users_recovery_provenance_unique;

CREATE UNIQUE INDEX users_recovery_marker_unique
  ON public.users (recovery_provenance)
  WHERE recovery_provenance = 'tutela-recovery-test';
