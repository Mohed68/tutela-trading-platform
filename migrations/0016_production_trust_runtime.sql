-- Additive application persistence. Registry/Membership authority remains in 0013.
CREATE TABLE public.platform_submitted_evidence (
  evidence_id varchar PRIMARY KEY,
  evidence_version varchar NOT NULL,
  subject_kind varchar NOT NULL CHECK (subject_kind IN ('organization','offer')),
  subject_id varchar NOT NULL,
  subject_version varchar NOT NULL,
  assertions jsonb NOT NULL CHECK (jsonb_typeof(assertions) = 'array'),
  submitted_by varchar NOT NULL REFERENCES public.users(id),
  submitted_at timestamptz NOT NULL,
  provenance_reference varchar NOT NULL,
  integrity_reference varchar NOT NULL,
  evidence_fingerprint varchar NOT NULL CHECK (evidence_fingerprint ~ '^sha256:[0-9a-f]{64}$'),
  UNIQUE (subject_kind, subject_id, subject_version)
);

CREATE INDEX platform_submitted_evidence_subject_idx
  ON public.platform_submitted_evidence(subject_kind, subject_id, subject_version);

CREATE FUNCTION public.reject_platform_submitted_evidence_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  RAISE EXCEPTION 'platform-submitted evidence is immutable';
END; $$;
CREATE TRIGGER platform_submitted_evidence_immutable_update
  BEFORE UPDATE ON public.platform_submitted_evidence FOR EACH ROW
  EXECUTE FUNCTION public.reject_platform_submitted_evidence_mutation();
CREATE TRIGGER platform_submitted_evidence_immutable_delete
  BEFORE DELETE ON public.platform_submitted_evidence FOR EACH ROW
  EXECUTE FUNCTION public.reject_platform_submitted_evidence_mutation();

CREATE TABLE public.offer_verification_evidence_bindings (
  binding_id varchar PRIMARY KEY,
  attempt_id varchar NOT NULL UNIQUE REFERENCES public.offer_verification_attempts(id),
  offer_id varchar NOT NULL REFERENCES public.offers(id),
  submission_revision integer NOT NULL CHECK (submission_revision > 0),
  evidence_id varchar NOT NULL REFERENCES public.platform_submitted_evidence(evidence_id),
  evidence_version varchar NOT NULL,
  evidence_assurance_level varchar NOT NULL CHECK (evidence_assurance_level IN ('documentary','source_confirmed','independently_inspected')),
  evidence_fingerprint varchar NOT NULL CHECK (evidence_fingerprint ~ '^sha256:[0-9a-f]{64}$'),
  bound_at timestamptz NOT NULL,
  binding_fingerprint varchar NOT NULL CHECK (binding_fingerprint ~ '^sha256:[0-9a-f]{64}$'),
  UNIQUE (offer_id, submission_revision)
);

CREATE FUNCTION public.reject_offer_verification_evidence_binding_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  RAISE EXCEPTION 'offer verification evidence bindings are immutable';
END; $$;
CREATE TRIGGER offer_verification_evidence_binding_immutable_update
  BEFORE UPDATE ON public.offer_verification_evidence_bindings FOR EACH ROW
  EXECUTE FUNCTION public.reject_offer_verification_evidence_binding_mutation();
CREATE TRIGGER offer_verification_evidence_binding_immutable_delete
  BEFORE DELETE ON public.offer_verification_evidence_bindings FOR EACH ROW
  EXECUTE FUNCTION public.reject_offer_verification_evidence_binding_mutation();
