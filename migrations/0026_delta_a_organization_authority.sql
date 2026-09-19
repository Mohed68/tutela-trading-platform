-- TUTELA Delta A: additive Organization authority, commercial-rights and
-- integrity-extension foundations. No historical membership, signing,
-- verification, contract, trust or commercial record is reinterpreted.

CREATE TABLE public.organization_verified_domains (
  domain_id uuid PRIMARY KEY,
  organization_id varchar NOT NULL,
  normalized_domain varchar NOT NULL,
  status text NOT NULL CHECK (status IN ('UNVERIFIED','PENDING','VERIFIED','REVOKED')),
  verification_method text NOT NULL CHECK (verification_method IN ('DNS_CHALLENGE','CONTROLLED_EMAIL_CHALLENGE','AUTHORIZED_INTERNAL_REVIEW','INDEPENDENT_PROVIDER')),
  verification_provenance text NOT NULL,
  valid_from timestamptz,
  verified_at timestamptz,
  revoked_at timestamptz,
  reason text NOT NULL,
  created_by_user_id varchar NOT NULL REFERENCES public.users(id),
  created_at timestamptz NOT NULL,
  domain_fingerprint varchar NOT NULL UNIQUE CHECK (domain_fingerprint ~ '^sha256:[0-9a-f]{64}$'),
  CHECK (normalized_domain = lower(normalized_domain) AND normalized_domain ~ '^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$'),
  CHECK ((status IN ('VERIFIED','REVOKED')) = (verified_at IS NOT NULL)),
  CHECK ((status = 'REVOKED') = (revoked_at IS NOT NULL))
);
CREATE UNIQUE INDEX organization_one_live_domain
  ON public.organization_verified_domains(normalized_domain)
  WHERE status IN ('PENDING','VERIFIED');
CREATE INDEX organization_verified_domains_org_idx ON public.organization_verified_domains(organization_id,status);

CREATE TABLE public.organization_membership_policies (
  policy_id uuid PRIMARY KEY,
  organization_id varchar NOT NULL,
  policy_version integer NOT NULL CHECK (policy_version > 0),
  policy_kind text NOT NULL CHECK (policy_kind IN ('APPROVAL_REQUIRED','VERIFIED_DOMAIN_AUTO_JOIN')),
  effective_from timestamptz NOT NULL,
  superseded_at timestamptz,
  created_by_user_id varchar NOT NULL REFERENCES public.users(id),
  created_at timestamptz NOT NULL,
  policy_fingerprint varchar NOT NULL UNIQUE CHECK (policy_fingerprint ~ '^sha256:[0-9a-f]{64}$'),
  UNIQUE (organization_id,policy_version)
);
CREATE UNIQUE INDEX organization_one_current_membership_policy
  ON public.organization_membership_policies(organization_id) WHERE superseded_at IS NULL;

CREATE TABLE public.organization_membership_invitations (
  invitation_id uuid PRIMARY KEY,
  organization_id varchar NOT NULL,
  normalized_email varchar NOT NULL,
  token_digest varchar NOT NULL UNIQUE CHECK (token_digest ~ '^sha256:[0-9a-f]{64}$'),
  membership_role text NOT NULL CHECK (membership_role = 'member'),
  invited_by_user_id varchar NOT NULL REFERENCES public.users(id),
  expires_at timestamptz NOT NULL,
  redeemed_at timestamptz,
  redeemed_by_user_id varchar REFERENCES public.users(id),
  revoked_at timestamptz,
  reason text NOT NULL,
  created_at timestamptz NOT NULL,
  invitation_fingerprint varchar NOT NULL UNIQUE CHECK (invitation_fingerprint ~ '^sha256:[0-9a-f]{64}$'),
  CHECK (normalized_email = lower(normalized_email)),
  CHECK (expires_at > created_at),
  CHECK ((redeemed_at IS NULL) = (redeemed_by_user_id IS NULL)),
  CHECK (NOT (redeemed_at IS NOT NULL AND revoked_at IS NOT NULL))
);
CREATE INDEX organization_invitation_email_idx ON public.organization_membership_invitations(normalized_email,expires_at);

CREATE TABLE public.organization_membership_requests (
  request_id uuid PRIMARY KEY,
  organization_id varchar NOT NULL,
  user_id varchar NOT NULL REFERENCES public.users(id),
  normalized_email varchar NOT NULL,
  resolution_basis text NOT NULL CHECK (resolution_basis IN ('VERIFIED_DOMAIN','EXPLICIT_SELECTION','INVITATION')),
  status text NOT NULL CHECK (status IN ('PENDING','APPROVED','REJECTED','CANCELLED')),
  requested_at timestamptz NOT NULL,
  decided_at timestamptz,
  decided_by_user_id varchar REFERENCES public.users(id),
  decision_reason text,
  request_fingerprint varchar NOT NULL UNIQUE CHECK (request_fingerprint ~ '^sha256:[0-9a-f]{64}$'),
  UNIQUE (organization_id,user_id),
  CHECK ((status = 'PENDING') = (decided_at IS NULL AND decided_by_user_id IS NULL))
);
CREATE INDEX organization_membership_requests_org_idx ON public.organization_membership_requests(organization_id,status,requested_at);

CREATE TABLE public.organization_capability_grants (
  capability_grant_id uuid PRIMARY KEY,
  organization_id varchar NOT NULL,
  membership_id varchar NOT NULL,
  user_id varchar NOT NULL REFERENCES public.users(id),
  capability text NOT NULL CHECK (capability IN ('CREATE_OFFER','MANAGE_OFFERS','PREPARE_CONTRACT','APPROVE_COMMERCIAL_TERMS','MANAGE_MEMBERS','MANAGE_SIGNING_POLICY','GRANT_SIGNING_MANDATE')),
  granted_by_user_id varchar NOT NULL REFERENCES public.users(id),
  granted_at timestamptz NOT NULL,
  valid_until timestamptz,
  grant_fingerprint varchar NOT NULL UNIQUE CHECK (grant_fingerprint ~ '^sha256:[0-9a-f]{64}$'),
  FOREIGN KEY (membership_id,organization_id,user_id)
    REFERENCES public.organization_memberships(membership_id,organization_id,user_id),
  CHECK (valid_until IS NULL OR valid_until > granted_at)
);
CREATE TABLE public.organization_capability_revocations (
  revocation_id uuid PRIMARY KEY,
  capability_grant_id uuid NOT NULL UNIQUE REFERENCES public.organization_capability_grants(capability_grant_id),
  revoked_by_user_id varchar NOT NULL REFERENCES public.users(id),
  revoked_at timestamptz NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) >= 3),
  revocation_fingerprint varchar NOT NULL UNIQUE CHECK (revocation_fingerprint ~ '^sha256:[0-9a-f]{64}$')
);

CREATE TABLE public.organization_signing_mandates (
  mandate_id uuid PRIMARY KEY,
  organization_id varchar NOT NULL,
  membership_id varchar NOT NULL,
  user_id varchar NOT NULL REFERENCES public.users(id),
  action_scope text[] NOT NULL CHECK (cardinality(action_scope) > 0),
  contract_type_scope text[] NOT NULL CHECK (cardinality(contract_type_scope) > 0),
  commodity_scope text[],
  maximum_transaction_value numeric(30,8) CHECK (maximum_transaction_value IS NULL OR maximum_transaction_value >= 0),
  value_currency char(3),
  signature_eligibility text NOT NULL CHECK (signature_eligibility IN ('INDIVIDUAL','JOINT','BOTH')),
  valid_from timestamptz NOT NULL,
  valid_until timestamptz,
  granted_by_user_id varchar NOT NULL REFERENCES public.users(id),
  granted_at timestamptz NOT NULL,
  grant_reason text NOT NULL CHECK (length(btrim(grant_reason)) >= 3),
  mandate_fingerprint varchar NOT NULL UNIQUE CHECK (mandate_fingerprint ~ '^sha256:[0-9a-f]{64}$'),
  legacy_authority_id uuid REFERENCES public.mvp_contract_signing_authorities(authority_id),
  FOREIGN KEY (membership_id,organization_id,user_id)
    REFERENCES public.organization_memberships(membership_id,organization_id,user_id),
  CHECK ((maximum_transaction_value IS NULL) = (value_currency IS NULL)),
  CHECK (valid_until IS NULL OR valid_until > valid_from)
);
CREATE INDEX organization_signing_mandate_lookup_idx ON public.organization_signing_mandates(organization_id,user_id,valid_from);
CREATE TABLE public.organization_signing_mandate_revocations (
  revocation_id uuid PRIMARY KEY,
  mandate_id uuid NOT NULL UNIQUE REFERENCES public.organization_signing_mandates(mandate_id),
  revoked_by_user_id varchar NOT NULL REFERENCES public.users(id),
  revoked_at timestamptz NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) >= 3),
  revocation_fingerprint varchar NOT NULL UNIQUE CHECK (revocation_fingerprint ~ '^sha256:[0-9a-f]{64}$')
);

CREATE TABLE public.organization_signing_policies (
  signing_policy_id uuid PRIMARY KEY,
  organization_id varchar NOT NULL,
  policy_version integer NOT NULL CHECK (policy_version > 0),
  policy_kind text NOT NULL CHECK (policy_kind IN ('COMPATIBILITY_SINGLE','VALUE_BANDS')),
  policy_payload jsonb NOT NULL CHECK (jsonb_typeof(policy_payload) = 'object'),
  effective_from timestamptz NOT NULL,
  superseded_at timestamptz,
  created_by_user_id varchar NOT NULL REFERENCES public.users(id),
  created_at timestamptz NOT NULL,
  policy_fingerprint varchar NOT NULL UNIQUE CHECK (policy_fingerprint ~ '^sha256:[0-9a-f]{64}$'),
  UNIQUE (organization_id,policy_version)
);
CREATE UNIQUE INDEX organization_one_current_signing_policy
  ON public.organization_signing_policies(organization_id) WHERE superseded_at IS NULL;

CREATE TABLE public.platform_terms_versions (
  terms_version_id uuid PRIMARY KEY,
  version_label varchar NOT NULL UNIQUE,
  status text NOT NULL CHECK (status IN ('DRAFT','PENDING_LEGAL_REVIEW','ACTIVE','SUPERSEDED','WITHDRAWN')),
  effective_at timestamptz,
  acceptance_requirement text NOT NULL,
  content_reference text NOT NULL,
  approved_authority_reference text,
  created_by_user_id varchar NOT NULL REFERENCES public.users(id),
  created_at timestamptz NOT NULL,
  terms_fingerprint varchar NOT NULL UNIQUE CHECK (terms_fingerprint ~ '^sha256:[0-9a-f]{64}$'),
  CHECK ((status = 'ACTIVE') = (effective_at IS NOT NULL AND approved_authority_reference IS NOT NULL))
);
CREATE TABLE public.platform_terms_acceptances (
  acceptance_id uuid PRIMARY KEY,
  terms_version_id uuid NOT NULL REFERENCES public.platform_terms_versions(terms_version_id),
  organization_id varchar,
  user_id varchar NOT NULL REFERENCES public.users(id),
  accepted_at timestamptz NOT NULL,
  acceptance_fingerprint varchar NOT NULL UNIQUE CHECK (acceptance_fingerprint ~ '^sha256:[0-9a-f]{64}$'),
  UNIQUE (terms_version_id,organization_id,user_id)
);

CREATE TABLE public.commercial_fee_schedules (
  fee_schedule_id uuid PRIMARY KEY,
  organization_id varchar,
  plan_reference varchar,
  schedule_version integer NOT NULL CHECK (schedule_version > 0),
  fee_type text NOT NULL CHECK (fee_type IN ('SUBSCRIPTION','TRANSACTION_FEE','SERVICE_FEE','LOGISTICS_SERVICE','INSPECTION_SERVICE','FINANCE_REFERRAL')),
  payer text NOT NULL,
  calculation_basis text NOT NULL,
  percentage numeric(12,8),
  fixed_amount numeric(30,8),
  currency char(3),
  trigger_event text NOT NULL,
  due_timing text NOT NULL,
  tax_treatment text NOT NULL,
  valid_from timestamptz NOT NULL,
  valid_until timestamptz,
  status text NOT NULL CHECK (status IN ('DRAFT','PENDING_APPROVAL','ACTIVE','SUPERSEDED','WITHDRAWN')),
  provenance_reference text NOT NULL,
  approved_authority_reference text,
  created_by_user_id varchar NOT NULL REFERENCES public.users(id),
  created_at timestamptz NOT NULL,
  schedule_fingerprint varchar NOT NULL UNIQUE CHECK (schedule_fingerprint ~ '^sha256:[0-9a-f]{64}$'),
  CHECK (percentage IS NOT NULL OR fixed_amount IS NOT NULL),
  CHECK (fixed_amount IS NULL OR currency IS NOT NULL),
  CHECK (valid_until IS NULL OR valid_until > valid_from),
  CHECK (status <> 'ACTIVE' OR approved_authority_reference IS NOT NULL)
);
CREATE TABLE public.fee_entitlements (
  fee_entitlement_id uuid PRIMARY KEY,
  organization_id varchar NOT NULL,
  related_reference varchar NOT NULL,
  fee_schedule_id uuid NOT NULL REFERENCES public.commercial_fee_schedules(fee_schedule_id),
  triggering_event_id varchar NOT NULL,
  calculation_inputs jsonb NOT NULL CHECK (jsonb_typeof(calculation_inputs) = 'object'),
  amount numeric(30,8),
  currency char(3),
  tax_treatment text NOT NULL,
  status text NOT NULL CHECK (status IN ('RECORDED','WAIVED','CANCELLED')),
  occurred_at timestamptz NOT NULL,
  provenance_reference text NOT NULL,
  entitlement_fingerprint varchar NOT NULL UNIQUE CHECK (entitlement_fingerprint ~ '^sha256:[0-9a-f]{64}$'),
  UNIQUE (fee_schedule_id,triggering_event_id),
  CHECK ((amount IS NULL) = (currency IS NULL))
);

CREATE TABLE public.trade_relationship_provenance (
  relationship_reference uuid PRIMARY KEY,
  first_organization_id varchar NOT NULL,
  second_organization_id varchar NOT NULL,
  provenance_kind text NOT NULL CHECK (provenance_kind IN ('INTRODUCTION','MATCH','FACILITATION')),
  source_reference varchar NOT NULL,
  applicable_fee_schedule_id uuid REFERENCES public.commercial_fee_schedules(fee_schedule_id),
  protection_starts_at timestamptz,
  protection_ends_at timestamptz,
  related_party_metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(related_party_metadata) = 'object'),
  created_at timestamptz NOT NULL,
  provenance_fingerprint varchar NOT NULL UNIQUE CHECK (provenance_fingerprint ~ '^sha256:[0-9a-f]{64}$'),
  CHECK (first_organization_id <> second_organization_id),
  CHECK (protection_ends_at IS NULL OR protection_starts_at IS NOT NULL AND protection_ends_at > protection_starts_at)
);

CREATE TABLE public.external_integrity_anchors (
  anchor_id uuid PRIMARY KEY,
  subject_type text NOT NULL,
  subject_reference varchar NOT NULL,
  anchor_type text NOT NULL,
  network text,
  network_id text,
  transaction_reference text,
  anchored_hash varchar NOT NULL CHECK (anchored_hash ~ '^sha256:[0-9a-f]{64}$'),
  anchor_timestamp timestamptz,
  anchor_version integer NOT NULL CHECK (anchor_version > 0),
  confirmation_status text NOT NULL CHECK (confirmation_status IN ('PENDING','CONFIRMED','FAILED')),
  confirmation_receipt jsonb,
  created_at timestamptz NOT NULL,
  anchor_fingerprint varchar NOT NULL UNIQUE CHECK (anchor_fingerprint ~ '^sha256:[0-9a-f]{64}$'),
  CHECK (confirmation_status <> 'CONFIRMED' OR (transaction_reference IS NOT NULL AND anchor_timestamp IS NOT NULL AND confirmation_receipt IS NOT NULL))
);

CREATE TABLE public.organization_authority_events (
  event_id uuid PRIMARY KEY,
  organization_id varchar NOT NULL,
  event_type text NOT NULL,
  actor_user_id varchar NOT NULL REFERENCES public.users(id),
  subject_reference varchar NOT NULL,
  event_payload jsonb NOT NULL CHECK (jsonb_typeof(event_payload) = 'object'),
  occurred_at timestamptz NOT NULL,
  event_fingerprint varchar NOT NULL UNIQUE CHECK (event_fingerprint ~ '^sha256:[0-9a-f]{64}$')
);
CREATE INDEX organization_authority_events_org_idx ON public.organization_authority_events(organization_id,occurred_at DESC);

-- Restrained structural links only. Existing and newly prepared snapshots may
-- remain NULL until approved ACTIVE authorities actually apply. Seller and
-- Buyer remain the only sale-contract parties.
ALTER TABLE public.mvp_contract_snapshots
  ADD COLUMN platform_terms_version_id uuid REFERENCES public.platform_terms_versions(terms_version_id),
  ADD COLUMN fee_schedule_id uuid REFERENCES public.commercial_fee_schedules(fee_schedule_id);

CREATE FUNCTION public.delta_a_reject_history_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  RAISE EXCEPTION 'Delta A authority history is immutable';
END; $$;
DO $$ DECLARE table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'organization_capability_grants','organization_capability_revocations',
    'organization_signing_mandates','organization_signing_mandate_revocations',
    'platform_terms_versions','platform_terms_acceptances','commercial_fee_schedules','fee_entitlements',
    'trade_relationship_provenance','external_integrity_anchors','organization_authority_events'
  ] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.delta_a_reject_history_mutation()',table_name || '_immutable',table_name);
  END LOOP;
END $$;
