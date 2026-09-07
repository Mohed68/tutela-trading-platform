CREATE TABLE IF NOT EXISTS public.platform_principals (
  id varchar PRIMARY KEY,
  user_id varchar NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  status varchar NOT NULL CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT platform_principals_user_unique UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS public.platform_role_assignments (
  id varchar PRIMARY KEY,
  principal_id varchar NOT NULL REFERENCES public.platform_principals(id) ON DELETE RESTRICT,
  role varchar NOT NULL CHECK (role IN ('PLATFORM_ADMIN', 'VERIFICATION_REVIEWER', 'OPERATIONS', 'SUPPORT')),
  status varchar NOT NULL CHECK (status IN ('active', 'revoked')),
  granted_by_principal_id varchar NOT NULL REFERENCES public.platform_principals(id) ON DELETE RESTRICT,
  granted_at timestamptz NOT NULL,
  grant_reason text NOT NULL CHECK (length(trim(grant_reason)) > 0),
  revoked_by_principal_id varchar REFERENCES public.platform_principals(id) ON DELETE RESTRICT,
  revoked_at timestamptz,
  revocation_reason text,
  CONSTRAINT platform_role_assignment_revocation_consistency CHECK (
    (status = 'active' AND revoked_by_principal_id IS NULL AND revoked_at IS NULL AND revocation_reason IS NULL)
    OR
    (status = 'revoked' AND revoked_by_principal_id IS NOT NULL AND revoked_at IS NOT NULL AND length(trim(revocation_reason)) > 0)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS platform_role_assignments_active_unique
  ON public.platform_role_assignments(principal_id, role)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS platform_role_assignments_principal_idx
  ON public.platform_role_assignments(principal_id, status);

CREATE TABLE IF NOT EXISTS public.security_audit_events (
  id varchar PRIMARY KEY,
  request_id varchar NOT NULL,
  correlation_id varchar NOT NULL,
  actor_user_id varchar NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  actor_principal_id varchar NOT NULL REFERENCES public.platform_principals(id) ON DELETE RESTRICT,
  actor_roles jsonb NOT NULL,
  effective_permission varchar NOT NULL,
  session_assurance varchar NOT NULL CHECK (session_assurance IN ('authenticated', 'mfa', 'recent_step_up')),
  action varchar NOT NULL,
  target_type varchar NOT NULL,
  target_id varchar NOT NULL,
  before_value jsonb,
  after_value jsonb,
  reason text NOT NULL,
  ip_address varchar,
  user_agent text,
  severity varchar NOT NULL CHECK (severity IN ('info', 'medium', 'high', 'critical')),
  occurred_at timestamptz NOT NULL,
  CONSTRAINT security_audit_reason_required CHECK (length(trim(reason)) > 0)
);

CREATE INDEX IF NOT EXISTS security_audit_events_actor_idx
  ON public.security_audit_events(actor_principal_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS security_audit_events_target_idx
  ON public.security_audit_events(target_type, target_id, occurred_at DESC);
