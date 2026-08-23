-- Additive runtime persistence for authoritative Organization Registry profile
-- revisions, explicit Organization Membership, and exact Participation runtime
-- reference bindings. No legacy KYB or users.verified value is interpreted.

CREATE TABLE public.organization_registry_profile_revisions (
  organization_id varchar NOT NULL,
  organization_profile_revision_id varchar NOT NULL,
  registry_contract_version varchar NOT NULL,
  contract_payload jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  integrity_reference varchar NOT NULL,
  PRIMARY KEY (organization_id, organization_profile_revision_id),
  CONSTRAINT organization_registry_profile_revision_version_check
    CHECK (registry_contract_version = 'organization_registry_profile_revision.v1'),
  CONSTRAINT organization_registry_profile_revision_identity_check
    CHECK (
      length(btrim(organization_id)) > 0
      AND length(btrim(organization_profile_revision_id)) > 0
      AND lower(organization_profile_revision_id) NOT IN ('latest', 'current', 'head', 'default')
    ),
  CONSTRAINT organization_registry_profile_revision_payload_check
    CHECK (jsonb_typeof(contract_payload) = 'object'),
  CONSTRAINT organization_registry_profile_revision_integrity_check
    CHECK (length(btrim(integrity_reference)) > 0)
);

CREATE UNIQUE INDEX organization_registry_profile_revision_contract_unique
  ON public.organization_registry_profile_revisions (
    organization_id,
    organization_profile_revision_id,
    registry_contract_version
  );

CREATE FUNCTION public.reject_organization_registry_profile_revision_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'organization registry profile revisions are immutable';
END;
$$;

CREATE TRIGGER organization_registry_profile_revision_immutable_update
BEFORE UPDATE ON public.organization_registry_profile_revisions
FOR EACH ROW EXECUTE FUNCTION public.reject_organization_registry_profile_revision_mutation();

CREATE TRIGGER organization_registry_profile_revision_immutable_delete
BEFORE DELETE ON public.organization_registry_profile_revisions
FOR EACH ROW EXECUTE FUNCTION public.reject_organization_registry_profile_revision_mutation();

CREATE TABLE public.organization_memberships (
  membership_id varchar PRIMARY KEY,
  user_id varchar NOT NULL REFERENCES public.users (id),
  organization_id varchar NOT NULL,
  role varchar NOT NULL,
  status varchar NOT NULL,
  membership_version integer NOT NULL,
  effective_from timestamptz NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  provenance_reference varchar NOT NULL,
  integrity_reference varchar NOT NULL,
  membership_fingerprint varchar NOT NULL,
  CONSTRAINT organization_membership_role_check
    CHECK (role IN ('owner', 'member')),
  CONSTRAINT organization_membership_status_check
    CHECK (status IN ('active', 'inactive')),
  CONSTRAINT organization_membership_version_check
    CHECK (membership_version > 0),
  CONSTRAINT organization_membership_chronology_check
    CHECK (updated_at >= created_at),
  CONSTRAINT organization_membership_identity_check
    CHECK (
      length(btrim(membership_id)) > 0
      AND length(btrim(user_id)) > 0
      AND length(btrim(organization_id)) > 0
      AND length(btrim(provenance_reference)) > 0
      AND length(btrim(integrity_reference)) > 0
    ),
  CONSTRAINT organization_membership_fingerprint_check
    CHECK (membership_fingerprint ~ '^sha256:[0-9a-f]{64}$'),
  CONSTRAINT organization_membership_scope_unique
    UNIQUE (membership_id, organization_id, user_id)
);

CREATE INDEX organization_membership_user_organization_idx
  ON public.organization_memberships (user_id, organization_id);

CREATE TABLE public.organization_participation_runtime_bindings (
  binding_id varchar NOT NULL UNIQUE,
  organization_id varchar NOT NULL,
  user_id varchar NOT NULL,
  membership_id varchar NOT NULL,
  organization_profile_revision_id varchar NOT NULL,
  registry_contract_version varchar NOT NULL,
  verification_stream_identity_fingerprint varchar NOT NULL,
  binding_version integer NOT NULL,
  integrity_reference varchar NOT NULL,
  binding_fingerprint varchar NOT NULL,
  PRIMARY KEY (organization_id, user_id),
  CONSTRAINT organization_participation_binding_membership_fk
    FOREIGN KEY (membership_id, organization_id, user_id)
    REFERENCES public.organization_memberships (
      membership_id,
      organization_id,
      user_id
    ),
  CONSTRAINT organization_participation_binding_profile_revision_fk
    FOREIGN KEY (
      organization_id,
      organization_profile_revision_id,
      registry_contract_version
    )
    REFERENCES public.organization_registry_profile_revisions (
      organization_id,
      organization_profile_revision_id,
      registry_contract_version
    ),
  CONSTRAINT organization_participation_binding_verification_stream_fk
    FOREIGN KEY (verification_stream_identity_fingerprint)
    REFERENCES public.organization_verification_persistence_streams (
      stream_identity_fingerprint
    ),
  CONSTRAINT organization_participation_binding_version_check
    CHECK (binding_version > 0),
  CONSTRAINT organization_participation_binding_registry_version_check
    CHECK (registry_contract_version = 'organization_registry_profile_revision.v1'),
  CONSTRAINT organization_participation_binding_identity_check
    CHECK (
      length(btrim(binding_id)) > 0
      AND length(btrim(organization_id)) > 0
      AND length(btrim(user_id)) > 0
      AND length(btrim(membership_id)) > 0
      AND length(btrim(organization_profile_revision_id)) > 0
      AND length(btrim(verification_stream_identity_fingerprint)) > 0
      AND length(btrim(integrity_reference)) > 0
    ),
  CONSTRAINT organization_participation_binding_fingerprint_check
    CHECK (binding_fingerprint ~ '^sha256:[0-9a-f]{64}$')
);

CREATE INDEX organization_participation_binding_membership_idx
  ON public.organization_participation_runtime_bindings (membership_id);

CREATE INDEX organization_participation_binding_verification_stream_idx
  ON public.organization_participation_runtime_bindings (
    verification_stream_identity_fingerprint
  );
