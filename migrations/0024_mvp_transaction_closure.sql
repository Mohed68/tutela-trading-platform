-- Additive MVP transaction closure. Existing Orders, Contracts and history are
-- preserved. New authority is established only through explicit immutable
-- snapshots, approvals, signatures, artifacts and execution events.

ALTER TABLE public.vre_enforcement_action_restrictions
  DROP CONSTRAINT vre_enforcement_action_restrictions_action_kind_check;
ALTER TABLE public.vre_enforcement_action_restrictions
  ADD CONSTRAINT vre_enforcement_action_restrictions_action_kind_check
  CHECK (action_kind IN (
    'offer.create','offer.edit','offer.submit',
    'order.create','order.accept','contract.create',
    'contract.prepare','contract.approve','contract.sign',
    'contract.execute','contract.evidence','contract.delivery',
    'contract.settlement','contract.close','contract.dispute'
  ));

CREATE TABLE public.mvp_contract_signing_authorities (
  authority_id uuid PRIMARY KEY,
  organization_id varchar NOT NULL,
  user_id varchar NOT NULL REFERENCES public.users(id),
  membership_id varchar NOT NULL REFERENCES public.organization_memberships(membership_id),
  granted_by_user_id varchar NOT NULL REFERENCES public.users(id),
  authority_scope text NOT NULL DEFAULT 'all_mvp_sale_contracts'
    CHECK (authority_scope = 'all_mvp_sale_contracts'),
  granted_at timestamptz NOT NULL,
  authority_fingerprint varchar NOT NULL UNIQUE
    CHECK (authority_fingerprint ~ '^sha256:[0-9a-f]{64}$'),
  UNIQUE (organization_id, user_id),
  FOREIGN KEY (membership_id, organization_id, user_id)
    REFERENCES public.organization_memberships(membership_id, organization_id, user_id)
);

CREATE TABLE public.mvp_contract_transactions (
  transaction_id uuid PRIMARY KEY,
  contract_id varchar NOT NULL UNIQUE REFERENCES public.contracts(id),
  order_id varchar NOT NULL UNIQUE REFERENCES public.orders(id),
  seller_organization_id varchar NOT NULL,
  buyer_organization_id varchar NOT NULL,
  current_state text NOT NULL CHECK (current_state IN (
    'CONTRACT_PREPARATION','CONTRACT_READY','AWAITING_SELLER_SIGNATURE',
    'AWAITING_BUYER_SIGNATURE','EXECUTED','EXECUTION_STARTED',
    'DOCUMENTS_SUBMITTED','DELIVERY_CONFIRMED','SETTLEMENT_CONFIRMED',
    'TRADE_CLOSED','DISPUTED','TERMINATED'
  )),
  current_contract_version integer NOT NULL CHECK (current_contract_version > 0),
  current_snapshot_id uuid,
  projection_version integer NOT NULL DEFAULT 1 CHECK (projection_version > 0),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL CHECK (updated_at >= created_at),
  executed_at timestamptz,
  closed_at timestamptz,
  CHECK (seller_organization_id <> buyer_organization_id),
  CHECK ((current_state = 'TRADE_CLOSED') = (closed_at IS NOT NULL))
);

CREATE TABLE public.mvp_contract_snapshots (
  snapshot_id uuid PRIMARY KEY,
  transaction_id uuid NOT NULL REFERENCES public.mvp_contract_transactions(transaction_id),
  contract_id varchar NOT NULL REFERENCES public.contracts(id),
  contract_version integer NOT NULL CHECK (contract_version > 0),
  template_version text NOT NULL CHECK (template_version = 'tutela-international-commodity-sale-contract/v1'),
  commercial_profile_version text NOT NULL,
  snapshot_payload jsonb NOT NULL CHECK (jsonb_typeof(snapshot_payload) = 'object'),
  readiness_payload jsonb NOT NULL CHECK (jsonb_typeof(readiness_payload) = 'object'),
  snapshot_fingerprint varchar NOT NULL UNIQUE CHECK (snapshot_fingerprint ~ '^sha256:[0-9a-f]{64}$'),
  created_by_user_id varchar NOT NULL REFERENCES public.users(id),
  created_at timestamptz NOT NULL,
  UNIQUE (contract_id, contract_version)
);

ALTER TABLE public.mvp_contract_transactions
  ADD CONSTRAINT mvp_contract_transactions_current_snapshot_fk
  FOREIGN KEY (current_snapshot_id) REFERENCES public.mvp_contract_snapshots(snapshot_id);

CREATE TABLE public.mvp_contract_terms_approvals (
  approval_id uuid PRIMARY KEY,
  transaction_id uuid NOT NULL REFERENCES public.mvp_contract_transactions(transaction_id),
  snapshot_id uuid NOT NULL REFERENCES public.mvp_contract_snapshots(snapshot_id),
  party text NOT NULL CHECK (party IN ('SELLER','BUYER')),
  organization_id varchar NOT NULL,
  user_id varchar NOT NULL REFERENCES public.users(id),
  approved_at timestamptz NOT NULL,
  approval_fingerprint varchar NOT NULL UNIQUE CHECK (approval_fingerprint ~ '^sha256:[0-9a-f]{64}$'),
  UNIQUE (snapshot_id, party)
);

CREATE TABLE public.mvp_contract_artifacts (
  artifact_id uuid PRIMARY KEY,
  transaction_id uuid NOT NULL REFERENCES public.mvp_contract_transactions(transaction_id),
  snapshot_id uuid NOT NULL REFERENCES public.mvp_contract_snapshots(snapshot_id),
  contract_version integer NOT NULL CHECK (contract_version > 0),
  artifact_kind text NOT NULL CHECK (artifact_kind IN ('PREVIEW','EXECUTED')),
  media_type text NOT NULL CHECK (media_type = 'application/pdf'),
  document_bytes bytea NOT NULL CHECK (octet_length(document_bytes) > 100),
  document_sha256 varchar NOT NULL UNIQUE CHECK (document_sha256 ~ '^sha256:[0-9a-f]{64}$'),
  generated_at timestamptz NOT NULL,
  UNIQUE (snapshot_id, artifact_kind)
);

CREATE TABLE public.mvp_contract_signatures (
  signature_id uuid PRIMARY KEY,
  transaction_id uuid NOT NULL REFERENCES public.mvp_contract_transactions(transaction_id),
  snapshot_id uuid NOT NULL REFERENCES public.mvp_contract_snapshots(snapshot_id),
  contract_version integer NOT NULL CHECK (contract_version > 0),
  party text NOT NULL CHECK (party IN ('SELLER','BUYER')),
  organization_id varchar NOT NULL,
  signer_user_id varchar NOT NULL REFERENCES public.users(id),
  signing_authority_id uuid NOT NULL REFERENCES public.mvp_contract_signing_authorities(authority_id),
  preview_document_sha256 varchar NOT NULL CHECK (preview_document_sha256 ~ '^sha256:[0-9a-f]{64}$'),
  explicit_consent boolean NOT NULL CHECK (explicit_consent),
  session_assurance text NOT NULL CHECK (session_assurance = 'recent_step_up'),
  audit_correlation_id uuid NOT NULL UNIQUE,
  signed_at timestamptz NOT NULL,
  signature_fingerprint varchar NOT NULL UNIQUE CHECK (signature_fingerprint ~ '^sha256:[0-9a-f]{64}$'),
  UNIQUE (snapshot_id, party)
);

CREATE TABLE public.mvp_contract_events (
  event_id uuid PRIMARY KEY,
  transaction_id uuid NOT NULL REFERENCES public.mvp_contract_transactions(transaction_id),
  event_type text NOT NULL CHECK (event_type IN (
    'PREPARATION_CREATED','TERMS_APPROVED','CONTRACT_READY','SELLER_SIGNED',
    'BUYER_SIGNED','CONTRACT_EXECUTED','EXECUTION_STARTED','DOCUMENTS_SUBMITTED',
    'DELIVERY_CONFIRMED','SETTLEMENT_CONFIRMED','TRADE_CLOSED','DISPUTE_OPENED','TERMINATED'
  )),
  from_state text,
  to_state text NOT NULL,
  actor_user_id varchar NOT NULL REFERENCES public.users(id),
  actor_organization_id varchar NOT NULL,
  party text NOT NULL CHECK (party IN ('SELLER','BUYER','SYSTEM')),
  reason text NOT NULL CHECK (length(btrim(reason)) >= 3),
  correlation_id uuid NOT NULL UNIQUE,
  event_payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(event_payload) = 'object'),
  occurred_at timestamptz NOT NULL
);
CREATE INDEX mvp_contract_events_transaction_idx
  ON public.mvp_contract_events(transaction_id, occurred_at, event_id);

CREATE TABLE public.mvp_contract_evidence (
  evidence_id uuid PRIMARY KEY,
  transaction_id uuid NOT NULL REFERENCES public.mvp_contract_transactions(transaction_id),
  evidence_type text NOT NULL CHECK (evidence_type IN (
    'COMMERCIAL_INVOICE','BILL_OF_LADING','CERTIFICATE_OF_ORIGIN',
    'QUALITY_CERTIFICATE','QUANTITY_CERTIFICATE','PACKING_LIST',
    'INSURANCE_CERTIFICATE','SETTLEMENT_CONFIRMATION','OTHER'
  )),
  reference text NOT NULL CHECK (length(btrim(reference)) BETWEEN 3 AND 500),
  description text CHECK (description IS NULL OR length(description) <= 2000),
  asserted_by_user_id varchar NOT NULL REFERENCES public.users(id),
  asserted_by_organization_id varchar NOT NULL,
  assertion_notice text NOT NULL CHECK (assertion_notice = 'EVIDENCE_IS_NOT_VERIFIED_TRUTH'),
  created_at timestamptz NOT NULL,
  evidence_fingerprint varchar NOT NULL UNIQUE CHECK (evidence_fingerprint ~ '^sha256:[0-9a-f]{64}$')
);

CREATE TABLE public.mvp_contract_disputes (
  dispute_id uuid PRIMARY KEY,
  transaction_id uuid NOT NULL REFERENCES public.mvp_contract_transactions(transaction_id),
  opened_by_user_id varchar NOT NULL REFERENCES public.users(id),
  opened_by_organization_id varchar NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 10 AND 2000),
  opened_at timestamptz NOT NULL,
  dispute_fingerprint varchar NOT NULL UNIQUE CHECK (dispute_fingerprint ~ '^sha256:[0-9a-f]{64}$')
);
CREATE UNIQUE INDEX mvp_contract_one_open_dispute
  ON public.mvp_contract_disputes(transaction_id);

CREATE FUNCTION public.mvp_contract_projection_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.contract_id <> NEW.contract_id OR OLD.order_id <> NEW.order_id
     OR OLD.seller_organization_id <> NEW.seller_organization_id
     OR OLD.buyer_organization_id <> NEW.buyer_organization_id THEN
    RAISE EXCEPTION 'MVP contract authority binding is immutable';
  END IF;
  IF OLD.current_state IN ('EXECUTED','EXECUTION_STARTED','DOCUMENTS_SUBMITTED',
      'DELIVERY_CONFIRMED','SETTLEMENT_CONFIRMED','TRADE_CLOSED','DISPUTED','TERMINATED')
     AND (OLD.current_snapshot_id IS DISTINCT FROM NEW.current_snapshot_id
       OR OLD.current_contract_version <> NEW.current_contract_version) THEN
    RAISE EXCEPTION 'Executed MVP contract snapshot is immutable';
  END IF;
  IF OLD.current_state IN ('TRADE_CLOSED','TERMINATED') THEN
    RAISE EXCEPTION 'Terminal MVP contract projection is immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER mvp_contract_projection_guard
  BEFORE UPDATE ON public.mvp_contract_transactions
  FOR EACH ROW EXECUTE FUNCTION public.mvp_contract_projection_guard();

CREATE TRIGGER mvp_contract_snapshot_immutable
  BEFORE UPDATE OR DELETE ON public.mvp_contract_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.vre_reject_history_mutation();
CREATE TRIGGER mvp_contract_approval_immutable
  BEFORE UPDATE OR DELETE ON public.mvp_contract_terms_approvals
  FOR EACH ROW EXECUTE FUNCTION public.vre_reject_history_mutation();
CREATE TRIGGER mvp_contract_artifact_immutable
  BEFORE UPDATE OR DELETE ON public.mvp_contract_artifacts
  FOR EACH ROW EXECUTE FUNCTION public.vre_reject_history_mutation();
CREATE TRIGGER mvp_contract_signature_immutable
  BEFORE UPDATE OR DELETE ON public.mvp_contract_signatures
  FOR EACH ROW EXECUTE FUNCTION public.vre_reject_history_mutation();
CREATE TRIGGER mvp_contract_event_immutable
  BEFORE UPDATE OR DELETE ON public.mvp_contract_events
  FOR EACH ROW EXECUTE FUNCTION public.vre_reject_history_mutation();
CREATE TRIGGER mvp_contract_evidence_immutable
  BEFORE UPDATE OR DELETE ON public.mvp_contract_evidence
  FOR EACH ROW EXECUTE FUNCTION public.vre_reject_history_mutation();
CREATE TRIGGER mvp_contract_dispute_immutable
  BEFORE UPDATE OR DELETE ON public.mvp_contract_disputes
  FOR EACH ROW EXECUTE FUNCTION public.vre_reject_history_mutation();
CREATE TRIGGER mvp_contract_signing_authority_immutable
  BEFORE UPDATE OR DELETE ON public.mvp_contract_signing_authorities
  FOR EACH ROW EXECUTE FUNCTION public.vre_reject_history_mutation();
