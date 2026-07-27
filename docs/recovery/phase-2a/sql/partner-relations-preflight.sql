-- Read-only preflight for migrations/0005_partner_relations_reconciliation.sql.
-- This query returns counts only. It does not return relationship or user data.

BEGIN TRANSACTION READ ONLY;

SELECT
  count(*) FILTER (WHERE status IS NULL) AS null_status_count,
  count(*) FILTER (
    WHERE status IS NOT NULL
      AND status NOT IN ('pending', 'approved', 'rejected')
  ) AS invalid_status_count,
  count(*) FILTER (
    WHERE requester_id = partner_id
  ) AS self_relation_count,
  (
    SELECT count(*)
    FROM (
      SELECT
        LEAST(requester_id, partner_id),
        GREATEST(requester_id, partner_id)
      FROM public.partner_relations
      WHERE status IN ('pending', 'approved')
      GROUP BY 1, 2
      HAVING count(*) > 1
    ) duplicate_pairs
  ) AS duplicate_active_pair_count
FROM public.partner_relations;

ROLLBACK;
