-- Contract Engine V1.1 is prospective. Historical V1 snapshots remain valid
-- and immutable; this migration only admits the new form identifier.
ALTER TABLE public.mvp_contract_snapshots
  DROP CONSTRAINT mvp_contract_snapshots_template_version_check;

ALTER TABLE public.mvp_contract_snapshots
  ADD CONSTRAINT mvp_contract_snapshots_template_version_check
  CHECK (template_version IN (
    'tutela-international-commodity-sale-contract/v1',
    'tutela-international-commodity-sale-contract/v1.1'
  ));
