CREATE TABLE public.password_reset_tokens (
  id uuid PRIMARY KEY,
  user_id varchar NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token_digest char(64) NOT NULL UNIQUE CHECK (token_digest ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at)
);
CREATE INDEX password_reset_tokens_user_created_idx
  ON public.password_reset_tokens(user_id, created_at DESC);

CREATE TABLE public.account_security_events (
  id uuid PRIMARY KEY,
  user_id varchar NOT NULL REFERENCES public.users(id),
  event_type text NOT NULL CHECK (event_type IN ('password_reset_completed')),
  request_id uuid NOT NULL UNIQUE,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.vre_enforcement_action_restrictions (
  id uuid PRIMARY KEY,
  action_id uuid NOT NULL REFERENCES public.vre_enforcement_actions(id),
  action_kind text NOT NULL CHECK (action_kind IN (
    'offer.create','offer.edit','offer.submit',
    'order.create','order.accept','contract.create'
  )),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(action_id, action_kind)
);
CREATE INDEX vre_enforcement_restrictions_action_idx
  ON public.vre_enforcement_action_restrictions(action_id);

ALTER TABLE public.vre_enforcement_actions
  DROP CONSTRAINT vre_enforcement_actions_integration_status_check;
ALTER TABLE public.vre_enforcement_actions
  ADD CONSTRAINT vre_enforcement_actions_integration_status_check
  CHECK (integration_status IN ('INACTIVE','ACTIVE_V2_COMMAND_GUARD'));

CREATE TRIGGER account_security_events_immutable
  BEFORE UPDATE OR DELETE ON public.account_security_events
  FOR EACH ROW EXECUTE FUNCTION public.vre_reject_history_mutation();
CREATE TRIGGER vre_history_immutable
  BEFORE UPDATE OR DELETE ON public.vre_enforcement_action_restrictions
  FOR EACH ROW EXECUTE FUNCTION public.vre_reject_history_mutation();
