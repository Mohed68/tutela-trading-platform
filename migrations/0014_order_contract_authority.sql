-- Phase 8F.0C: additive authority binding for the first-cycle trading flow.
-- Legacy rows remain readable but gain no publication, order, or contract authority.

ALTER TABLE public.orders ALTER COLUMN contract_id DROP NOT NULL;
ALTER TABLE public.orders ADD COLUMN offer_id varchar REFERENCES public.offers (id);
ALTER TABLE public.orders ADD COLUMN buyer_organization_id varchar;
ALTER TABLE public.orders ADD COLUMN seller_organization_id varchar;
ALTER TABLE public.orders ADD COLUMN offer_version varchar;
ALTER TABLE public.orders ADD COLUMN offer_fingerprint varchar;
ALTER TABLE public.orders ADD COLUMN publication_eligibility_fingerprint varchar;
ALTER TABLE public.orders ADD COLUMN buyer_participation_eligibility_fingerprint varchar;
ALTER TABLE public.orders ADD COLUMN accepted_terms_version integer;
ALTER TABLE public.orders ADD COLUMN accepted_terms_fingerprint varchar;
ALTER TABLE public.orders ADD COLUMN accepted_terms_snapshot jsonb;
ALTER TABLE public.orders ADD COLUMN order_version integer;
ALTER TABLE public.orders ADD COLUMN order_fingerprint varchar;
ALTER TABLE public.orders ADD COLUMN accepted_at timestamptz;

ALTER TABLE public.orders ADD CONSTRAINT orders_authority_completeness_check CHECK (
  (offer_id IS NULL AND buyer_organization_id IS NULL AND seller_organization_id IS NULL
    AND offer_version IS NULL AND offer_fingerprint IS NULL
    AND publication_eligibility_fingerprint IS NULL
    AND buyer_participation_eligibility_fingerprint IS NULL
    AND accepted_terms_version IS NULL AND accepted_terms_fingerprint IS NULL
    AND accepted_terms_snapshot IS NULL AND order_version IS NULL
    AND order_fingerprint IS NULL AND accepted_at IS NULL)
  OR
  (offer_id IS NOT NULL AND buyer_organization_id IS NOT NULL AND seller_organization_id IS NOT NULL
    AND offer_version IS NOT NULL AND offer_fingerprint IS NOT NULL
    AND publication_eligibility_fingerprint IS NOT NULL
    AND buyer_participation_eligibility_fingerprint IS NOT NULL
    AND accepted_terms_version = 1 AND accepted_terms_fingerprint IS NOT NULL
    AND accepted_terms_snapshot IS NOT NULL AND order_version > 0
    AND order_fingerprint IS NOT NULL)
);
ALTER TABLE public.orders ADD CONSTRAINT orders_authority_fingerprints_check CHECK (
  order_fingerprint IS NULL OR (
    order_fingerprint ~ '^sha256:[0-9a-f]{64}$'
    AND offer_fingerprint ~ '^sha256:[0-9a-f]{64}$'
    AND publication_eligibility_fingerprint ~ '^sha256:[0-9a-f]{64}$'
    AND buyer_participation_eligibility_fingerprint ~ '^sha256:[0-9a-f]{64}$'
    AND accepted_terms_fingerprint ~ '^sha256:[0-9a-f]{64}$'
  )
);
ALTER TABLE public.orders ADD CONSTRAINT orders_acceptance_state_check CHECK (
  (status = 'accepted' AND accepted_at IS NOT NULL AND order_version >= 2)
  OR (status <> 'accepted')
);
CREATE INDEX orders_offer_authority_idx ON public.orders (offer_id);

ALTER TABLE public.contracts ADD COLUMN order_id varchar UNIQUE REFERENCES public.orders (id);
ALTER TABLE public.contracts ADD COLUMN buyer_organization_id varchar;
ALTER TABLE public.contracts ADD COLUMN seller_organization_id varchar;
ALTER TABLE public.contracts ADD COLUMN contract_version integer;
ALTER TABLE public.contracts ADD COLUMN accepted_order_version integer;
ALTER TABLE public.contracts ADD COLUMN accepted_order_fingerprint varchar;
ALTER TABLE public.contracts ADD COLUMN accepted_terms_version integer;
ALTER TABLE public.contracts ADD COLUMN accepted_terms_fingerprint varchar;
ALTER TABLE public.contracts ADD COLUMN contract_fingerprint varchar;

ALTER TABLE public.contracts ADD CONSTRAINT contracts_order_authority_check CHECK (
  (order_id IS NULL AND buyer_organization_id IS NULL AND seller_organization_id IS NULL
    AND contract_version IS NULL AND accepted_order_version IS NULL
    AND accepted_order_fingerprint IS NULL AND accepted_terms_version IS NULL
    AND accepted_terms_fingerprint IS NULL AND contract_fingerprint IS NULL)
  OR
  (order_id IS NOT NULL AND buyer_organization_id IS NOT NULL AND seller_organization_id IS NOT NULL
    AND contract_version = 1 AND accepted_order_version >= 2
    AND accepted_order_fingerprint ~ '^sha256:[0-9a-f]{64}$'
    AND accepted_terms_version = 1
    AND accepted_terms_fingerprint ~ '^sha256:[0-9a-f]{64}$'
    AND contract_fingerprint ~ '^sha256:[0-9a-f]{64}$')
);
