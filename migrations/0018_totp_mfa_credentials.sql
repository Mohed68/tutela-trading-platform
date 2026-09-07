-- Phase A1.2b: additive TOTP MFA credential and recovery-code storage.
-- Credential secrets are encrypted by the application with AES-256-GCM.

CREATE TABLE public.user_mfa_credentials (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  factor_type varchar NOT NULL DEFAULT 'totp',
  status varchar NOT NULL,
  encrypted_secret bytea NOT NULL,
  secret_iv bytea NOT NULL,
  secret_auth_tag bytea NOT NULL,
  encryption_key_version varchar NOT NULL,
  last_accepted_counter bigint,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,
  revoked_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1,
  CONSTRAINT user_mfa_credentials_factor_check
    CHECK (factor_type = 'totp'),
  CONSTRAINT user_mfa_credentials_status_check
    CHECK (status IN ('pending_enrollment', 'active', 'revoked')),
  CONSTRAINT user_mfa_credentials_crypto_check
    CHECK (
      octet_length(secret_iv) = 12
      AND octet_length(secret_auth_tag) = 16
      AND octet_length(encrypted_secret) > 0
    ),
  CONSTRAINT user_mfa_credentials_attempts_check
    CHECK (failed_attempts >= 0),
  CONSTRAINT user_mfa_credentials_version_check
    CHECK (version > 0),
  CONSTRAINT user_mfa_credentials_lifecycle_check
    CHECK (
      (status = 'pending_enrollment'
        AND activated_at IS NULL
        AND revoked_at IS NULL)
      OR (status = 'active'
        AND activated_at IS NOT NULL
        AND revoked_at IS NULL)
      OR (status = 'revoked'
        AND revoked_at IS NOT NULL)
    )
);

CREATE UNIQUE INDEX user_mfa_credentials_current_user_unique
  ON public.user_mfa_credentials (user_id)
  WHERE status IN ('pending_enrollment', 'active');

CREATE INDEX user_mfa_credentials_user_history_idx
  ON public.user_mfa_credentials (user_id, created_at DESC);

CREATE TABLE public.user_mfa_recovery_codes (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id varchar NOT NULL
    REFERENCES public.user_mfa_credentials(id) ON DELETE CASCADE,
  code_salt bytea NOT NULL,
  code_hash bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz,
  CONSTRAINT user_mfa_recovery_codes_crypto_check
    CHECK (
      octet_length(code_salt) = 16
      AND octet_length(code_hash) = 32
    )
);

CREATE INDEX user_mfa_recovery_codes_credential_idx
  ON public.user_mfa_recovery_codes (credential_id, used_at);
