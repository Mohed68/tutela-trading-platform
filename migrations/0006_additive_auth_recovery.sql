-- Phase 4B additive local-authentication reconciliation.
--
-- Legacy users intentionally retain NULL in every new field. This migration
-- does not activate, classify, or assign credentials to an existing account.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS password_hash text,
  ADD COLUMN IF NOT EXISTS auth_provider varchar,
  ADD COLUMN IF NOT EXISTS last_login_at timestamp,
  ADD COLUMN IF NOT EXISTS login_enabled boolean,
  ADD COLUMN IF NOT EXISTS credential_status varchar,
  ADD COLUMN IF NOT EXISTS recovery_provenance varchar;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.users'::regclass
      AND conname = 'users_credential_status_check'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_credential_status_check
      CHECK (
        credential_status IS NULL
        OR credential_status IN ('active', 'revoked')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.users'::regclass
      AND conname = 'users_recovery_provenance_check'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_recovery_provenance_check
      CHECK (
        recovery_provenance IS NULL
        OR recovery_provenance = 'tutela-recovery-test'
      );
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS users_recovery_provenance_unique
  ON public.users (recovery_provenance)
  WHERE recovery_provenance IS NOT NULL;

