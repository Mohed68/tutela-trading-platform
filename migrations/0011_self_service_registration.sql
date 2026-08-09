-- Additive self-service registration and email-verification persistence.
-- Existing users and authentication authority are not modified.

CREATE TABLE IF NOT EXISTS public.email_verification_tokens (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL
    REFERENCES public.users (id) ON DELETE CASCADE,
  token_digest varchar(64) NOT NULL,
  expires_at timestamp NOT NULL,
  consumed_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT email_verification_tokens_digest_check
    CHECK (token_digest ~ '^[a-f0-9]{64}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS email_verification_tokens_digest_unique
  ON public.email_verification_tokens (token_digest);

CREATE INDEX IF NOT EXISTS email_verification_tokens_user_idx
  ON public.email_verification_tokens (user_id);
