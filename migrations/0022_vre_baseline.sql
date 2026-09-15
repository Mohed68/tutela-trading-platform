-- Additive VRE authorities. No legacy inference or business-data backfill.
CREATE TABLE public.vre_policy_activations (
  policy_version text PRIMARY KEY,
  activated_at timestamptz NOT NULL DEFAULT now(),
  provenance text NOT NULL
);
INSERT INTO public.vre_policy_activations(policy_version,provenance)
VALUES ('minimum-trade-trust-organization-policy/v2','approved-verification-policy-v2:0022_vre_baseline');

CREATE TABLE public.vre_verification_reviews (
  id uuid PRIMARY KEY,
  organization_id varchar NOT NULL,
  profile_revision_id varchar NOT NULL,
  profile_fingerprint text NOT NULL,
  evidence_id varchar NOT NULL,
  evidence_version varchar NOT NULL,
  evidence_digest text NOT NULL CHECK (evidence_digest ~ '^[a-f0-9]{64}$'),
  policy_version text NOT NULL REFERENCES public.vre_policy_activations(policy_version),
  method text NOT NULL CHECK (method IN ('independent_human','trusted_source')),
  outcome text NOT NULL CHECK (outcome IN ('confirmed','revision_requested','inconclusive')),
  reviewer_principal_id varchar NOT NULL REFERENCES public.platform_principals(id),
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 1000),
  source_reference text NOT NULL CHECK (length(trim(source_reference)) BETWEEN 1 AND 500),
  request_id uuid NOT NULL UNIQUE,
  correlation_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id,profile_revision_id)
    REFERENCES public.organization_registry_profile_revisions(organization_id,organization_profile_revision_id)
);
CREATE INDEX vre_reviews_subject ON public.vre_verification_reviews(organization_id,profile_revision_id,created_at DESC,id DESC);

CREATE TABLE public.vre_risk_signals (
  id uuid PRIMARY KEY,
  scope text NOT NULL CHECK (scope IN ('USER','ORGANIZATION','RELATIONSHIP','TRADE_ACTIVITY','TRANSACTION','PLATFORM_WIDE')),
  subject_id varchar NOT NULL,
  signal_type text NOT NULL CHECK (length(trim(signal_type)) BETWEEN 1 AND 100),
  source text NOT NULL CHECK (source IN ('manual','provider','automated','ai_advisory')),
  source_reference text NOT NULL CHECK (length(trim(source_reference)) BETWEEN 1 AND 500),
  severity text NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  evidence_reference text NOT NULL CHECK (length(trim(evidence_reference)) BETWEEN 1 AND 500),
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 1000),
  observed_at timestamptz NOT NULL,
  created_by varchar NOT NULL REFERENCES public.platform_principals(id),
  request_id uuid NOT NULL UNIQUE,
  correlation_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.vre_risk_assessments (
  id uuid PRIMARY KEY,
  signal_id uuid NOT NULL REFERENCES public.vre_risk_signals(id),
  conclusion text NOT NULL CHECK (conclusion IN ('unsubstantiated','needs_review','substantiated')),
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 1000),
  assessed_by varchar NOT NULL REFERENCES public.platform_principals(id),
  request_id uuid NOT NULL UNIQUE,
  correlation_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.vre_risk_dispositions (
  id uuid PRIMARY KEY,
  assessment_id uuid NOT NULL REFERENCES public.vre_risk_assessments(id),
  disposition text NOT NULL CHECK (disposition IN ('closed','monitor','refer_for_case_review')),
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 1000),
  reviewed_by varchar NOT NULL REFERENCES public.platform_principals(id),
  request_id uuid NOT NULL UNIQUE,
  correlation_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.vre_enforcement_cases (
  id uuid PRIMARY KEY,
  scope text NOT NULL CHECK (scope IN ('USER','ORGANIZATION','RELATIONSHIP','TRADE_ACTIVITY','TRANSACTION','PLATFORM_WIDE')),
  subject_id varchar NOT NULL,
  risk_assessment_id uuid REFERENCES public.vre_risk_assessments(id),
  evidence_reference text NOT NULL CHECK (length(trim(evidence_reference)) BETWEEN 1 AND 500),
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 1000),
  opened_by varchar NOT NULL REFERENCES public.platform_principals(id),
  request_id uuid NOT NULL UNIQUE,
  correlation_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.vre_enforcement_decisions (
  id uuid PRIMARY KEY,
  case_id uuid NOT NULL UNIQUE REFERENCES public.vre_enforcement_cases(id),
  state text NOT NULL CHECK (state IN ('NORMAL','MONITORED','RESTRICTED','SUSPENDED','BLOCKED','TERMINATED')),
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 1000),
  remediation text NOT NULL CHECK (length(trim(remediation)) BETWEEN 1 AND 1000),
  decided_by varchar NOT NULL REFERENCES public.platform_principals(id),
  request_id uuid NOT NULL UNIQUE,
  correlation_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.vre_enforcement_actions (
  id uuid PRIMARY KEY,
  decision_id uuid NOT NULL UNIQUE REFERENCES public.vre_enforcement_decisions(id),
  predecessor_action_id uuid UNIQUE REFERENCES public.vre_enforcement_actions(id),
  scope text NOT NULL CHECK (scope IN ('USER','ORGANIZATION','RELATIONSHIP','TRADE_ACTIVITY','TRANSACTION','PLATFORM_WIDE')),
  subject_id varchar NOT NULL,
  state text NOT NULL CHECK (state IN ('NORMAL','MONITORED','RESTRICTED','SUSPENDED','BLOCKED','TERMINATED')),
  effective_at timestamptz NOT NULL DEFAULT now(),
  review_at timestamptz NOT NULL,
  integration_status text NOT NULL DEFAULT 'INACTIVE' CHECK (integration_status = 'INACTIVE'),
  CHECK (review_at > effective_at)
);
CREATE INDEX vre_actions_subject ON public.vre_enforcement_actions(scope,subject_id,effective_at DESC,id DESC);
CREATE INDEX vre_signals_subject ON public.vre_risk_signals(scope,subject_id,created_at DESC);
CREATE INDEX vre_cases_subject ON public.vre_enforcement_cases(scope,subject_id,created_at DESC);

CREATE FUNCTION public.vre_reject_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'VRE_HISTORY_IMMUTABLE'; END;
$$;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['vre_policy_activations','vre_verification_reviews','vre_risk_signals',
    'vre_risk_assessments','vre_risk_dispositions','vre_enforcement_cases','vre_enforcement_decisions','vre_enforcement_actions']
  LOOP
    EXECUTE format('CREATE TRIGGER vre_history_immutable BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.vre_reject_history_mutation()',t);
  END LOOP;
END $$;
