-- Phase 8G.0B: additive reconciliation of the observed legacy staging baseline.
--
-- Existing rows intentionally retain NULL for newly modeled business-state
-- fields. Defaults are installed only after each column is added, so they
-- apply to future rows without fabricating state for legacy records.

-- Current user reads select the complete modeled row. These columns complete
-- that read surface while leaving every existing user's state unknown.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS kyb_status varchar;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS verification_level varchar;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS business_registration_status varchar;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS tax_certificate_status varchar;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS bank_statement_status varchar;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS identity_verification_status varchar;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS admin_role varchar;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_2fa_enabled boolean;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS current_plan varchar;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS plan_status varchar;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS subscription_id varchar;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS billing_cycle varchar;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS next_billing_date timestamp;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS contracts_this_month integer;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS documents_uploaded integer;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS partners_connected integer;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS language varchar;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS timezone varchar;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS currency varchar;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS notifications jsonb;

ALTER TABLE public.users ALTER COLUMN kyb_status SET DEFAULT 'pending';
ALTER TABLE public.users ALTER COLUMN verification_level SET DEFAULT 'unverified';
ALTER TABLE public.users ALTER COLUMN business_registration_status SET DEFAULT 'pending';
ALTER TABLE public.users ALTER COLUMN tax_certificate_status SET DEFAULT 'pending';
ALTER TABLE public.users ALTER COLUMN bank_statement_status SET DEFAULT 'pending';
ALTER TABLE public.users ALTER COLUMN identity_verification_status SET DEFAULT 'pending';
ALTER TABLE public.users ALTER COLUMN is_2fa_enabled SET DEFAULT false;
ALTER TABLE public.users ALTER COLUMN current_plan SET DEFAULT 'freemium';
ALTER TABLE public.users ALTER COLUMN plan_status SET DEFAULT 'active';
ALTER TABLE public.users ALTER COLUMN billing_cycle SET DEFAULT 'monthly';
ALTER TABLE public.users ALTER COLUMN contracts_this_month SET DEFAULT 0;
ALTER TABLE public.users ALTER COLUMN documents_uploaded SET DEFAULT 0;
ALTER TABLE public.users ALTER COLUMN partners_connected SET DEFAULT 0;
ALTER TABLE public.users ALTER COLUMN language SET DEFAULT 'en';
ALTER TABLE public.users ALTER COLUMN timezone SET DEFAULT 'UTC';
ALTER TABLE public.users ALTER COLUMN currency SET DEFAULT 'USD';
ALTER TABLE public.users ALTER COLUMN notifications SET DEFAULT '{}'::jsonb;

-- Complete the current Offer read/write surface. Legacy offers receive no
-- inferred verification, organization, delegation, or moderation authority.
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS verified boolean;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS specifications text;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS delivery_options text;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS seller_org_id varchar(255);
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS seller_org_name varchar(255);
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS seller_org_verified boolean;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS seller_org_rating numeric(3, 2);
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS delegate_id varchar(255);
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS delegate_full_name varchar(255);
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS delegate_role_title varchar(255);
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS delegate_is_authorized boolean;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS bar_spec jsonb;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS packaging jsonb;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS moderation_status varchar;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS moderation_reason text;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS moderated_by varchar;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS moderated_at timestamp;

ALTER TABLE public.offers ALTER COLUMN verified SET DEFAULT false;
ALTER TABLE public.offers ALTER COLUMN seller_org_verified SET DEFAULT false;
ALTER TABLE public.offers ALTER COLUMN delegate_is_authorized SET DEFAULT true;
ALTER TABLE public.offers ALTER COLUMN moderation_status SET DEFAULT 'active';

-- Preserve the legacy contract columns unchanged and add only the operational
-- columns required by the current runtime. Migration 0014 owns authority data.
-- The legacy total_price column is retained, but its write requirement is
-- relaxed because the authoritative runtime writes total_amount instead.
ALTER TABLE public.contracts ALTER COLUMN total_price DROP NOT NULL;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS price_per_unit numeric(15, 2);
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS total_amount numeric(15, 2);
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS currency varchar;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS smart_contract_address varchar;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS smart_contract_status varchar;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS escrow_address varchar;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS payment_terms text;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS delivery_terms text;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS specifications text;

ALTER TABLE public.contracts ALTER COLUMN currency SET DEFAULT 'USD';

-- The observed staging baseline has no orders table. This is the pre-0014
-- storage shape only; 0014 remains the sole owner of trading authority fields.
CREATE TABLE IF NOT EXISTS public.orders (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id varchar NOT NULL REFERENCES public.contracts (id),
  buyer_id varchar NOT NULL REFERENCES public.users (id),
  seller_id varchar NOT NULL REFERENCES public.users (id),
  commodity varchar NOT NULL,
  quantity numeric(15, 2) NOT NULL,
  unit varchar NOT NULL,
  price_per_unit numeric(15, 2) NOT NULL,
  total_amount numeric(15, 2) NOT NULL,
  currency varchar DEFAULT 'USD',
  status varchar DEFAULT 'created',
  payment_status varchar DEFAULT 'pending',
  payment_intent_id varchar,
  escrow_status varchar DEFAULT 'pending',
  tracking_number varchar,
  estimated_delivery timestamp,
  actual_delivery timestamp,
  notes text,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
