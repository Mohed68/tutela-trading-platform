CREATE TABLE IF NOT EXISTS public.platform_ownership_assignments (
  id varchar PRIMARY KEY,
  principal_id varchar NOT NULL REFERENCES public.platform_principals(id) ON DELETE RESTRICT,
  status varchar NOT NULL CHECK (status IN ('active', 'revoked')),
  authority_source varchar NOT NULL CHECK (authority_source IN ('initial_bootstrap', 'owner_succession')),
  granted_by_principal_id varchar REFERENCES public.platform_principals(id) ON DELETE RESTRICT,
  granted_at timestamptz NOT NULL,
  grant_reason text NOT NULL CHECK (length(trim(grant_reason)) > 0),
  revoked_by_principal_id varchar REFERENCES public.platform_principals(id) ON DELETE RESTRICT,
  revoked_at timestamptz,
  revocation_reason text,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  CONSTRAINT platform_ownership_grant_authority CHECK (
    (authority_source = 'initial_bootstrap' AND granted_by_principal_id IS NULL)
    OR (authority_source = 'owner_succession' AND granted_by_principal_id IS NOT NULL)
  ),
  CONSTRAINT platform_ownership_revocation_consistency CHECK (
    (status = 'active' AND revoked_by_principal_id IS NULL AND revoked_at IS NULL AND revocation_reason IS NULL)
    OR (status = 'revoked' AND revoked_by_principal_id IS NOT NULL AND revoked_at IS NOT NULL AND length(trim(revocation_reason)) > 0)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS platform_ownership_active_principal_unique
  ON public.platform_ownership_assignments(principal_id) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS public.platform_ownership_bootstrap_events (
  id varchar PRIMARY KEY,
  assignment_id varchar NOT NULL UNIQUE REFERENCES public.platform_ownership_assignments(id) ON DELETE RESTRICT,
  target_user_id varchar NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  target_principal_id varchar NOT NULL REFERENCES public.platform_principals(id) ON DELETE RESTRICT,
  operator_identity varchar NOT NULL CHECK (length(trim(operator_identity)) > 0),
  reason text NOT NULL CHECK (length(trim(reason)) > 0),
  execution_context varchar NOT NULL DEFAULT 'server_cli',
  severity varchar NOT NULL DEFAULT 'critical' CHECK (severity = 'critical'),
  occurred_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS platform_ownership_status_idx
  ON public.platform_ownership_assignments(status, granted_at);
