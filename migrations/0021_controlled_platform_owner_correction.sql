-- One-time controlled recovery authority for correcting the initial Platform Owner.
-- This authority is intentionally distinct from HTTP session/MFA succession.

ALTER TABLE public.platform_ownership_assignments
  DROP CONSTRAINT platform_ownership_grant_authority;

ALTER TABLE public.platform_ownership_assignments
  ADD CONSTRAINT platform_ownership_grant_authority CHECK (
    (authority_source IN ('initial_bootstrap', 'initial_owner_correction')
      AND granted_by_principal_id IS NULL)
    OR
    (authority_source = 'owner_succession' AND granted_by_principal_id IS NOT NULL)
  );

ALTER TABLE public.platform_ownership_assignments
  DROP CONSTRAINT platform_ownership_assignments_authority_source_check;

ALTER TABLE public.platform_ownership_assignments
  ADD CONSTRAINT platform_ownership_assignments_authority_source_check
  CHECK (authority_source IN (
    'initial_bootstrap',
    'owner_succession',
    'initial_owner_correction'
  ));

ALTER TABLE public.platform_ownership_assignments
  ADD COLUMN revocation_authority_source varchar;

ALTER TABLE public.platform_ownership_assignments
  ADD CONSTRAINT platform_ownership_revocation_authority_check
  CHECK (revocation_authority_source IS NULL
    OR revocation_authority_source = 'controlled_recovery');

ALTER TABLE public.platform_ownership_assignments
  DROP CONSTRAINT platform_ownership_revocation_consistency;

ALTER TABLE public.platform_ownership_assignments
  ADD CONSTRAINT platform_ownership_revocation_consistency CHECK (
    (status = 'active'
      AND revoked_by_principal_id IS NULL
      AND revoked_at IS NULL
      AND revocation_reason IS NULL
      AND revocation_authority_source IS NULL)
    OR
    (status = 'revoked'
      AND revoked_at IS NOT NULL
      AND length(trim(revocation_reason)) > 0
      AND (
        (revoked_by_principal_id IS NOT NULL
          AND revocation_authority_source IS NULL)
        OR
        (revoked_by_principal_id IS NULL
          AND revocation_authority_source = 'controlled_recovery')
      ))
  );

ALTER TABLE public.security_audit_events
  DROP CONSTRAINT security_audit_events_session_assurance_check;

ALTER TABLE public.security_audit_events
  ADD CONSTRAINT security_audit_events_session_assurance_check
  CHECK (session_assurance IN (
    'authenticated', 'mfa', 'recent_step_up', 'controlled_recovery'
  ));

ALTER TABLE public.security_audit_events
  ALTER COLUMN actor_user_id DROP NOT NULL,
  ALTER COLUMN actor_principal_id DROP NOT NULL;

ALTER TABLE public.security_audit_events
  ADD CONSTRAINT security_audit_actor_context_check CHECK (
    (session_assurance = 'controlled_recovery'
      AND actor_user_id IS NULL
      AND actor_principal_id IS NULL
      AND action = 'PLATFORM_OWNER_IDENTITY_CORRECTION')
    OR
    (session_assurance <> 'controlled_recovery'
      AND actor_user_id IS NOT NULL
      AND actor_principal_id IS NOT NULL)
  );

