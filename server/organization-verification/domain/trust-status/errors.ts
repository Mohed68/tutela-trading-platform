export type TrustStatusDomainFailureCode =
  | "trust_source_facts_incomplete"
  | "trust_source_facts_integrity_invalid"
  | "unsupported_trust_source_facts_version"
  | "unsupported_trust_deriver_version"
  | "invalid_decision_applicability"
  | "contradictory_decision_applicability"
  | "organization_id_mismatch"
  | "verification_record_id_mismatch"
  | "verification_revision_id_mismatch"
  | "attempt_id_mismatch"
  | "decision_id_mismatch"
  | "snapshot_id_mismatch"
  | "snapshot_fingerprint_mismatch"
  | "invalidation_reference_mismatch"
  | "invalid_invalidation_fact"
  | "invalid_expiry_fact"
  | "missing_expiry_boundary"
  | "superseding_decision_missing"
  | "superseding_decision_mismatch"
  | "unsupported_decision_outcome"
  | "invalid_derivation_timestamp"
  | "duplicate_trust_status_projection"
  | "conflicting_trust_status_projection"
  | "invalid_opaque_identifier";

export type TrustStatusDomainResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly code: TrustStatusDomainFailureCode };

export const trustStatusSuccess = <T>(
  value: T,
): TrustStatusDomainResult<T> => Object.freeze({ ok: true, value });

export const trustStatusFailure = <T>(
  code: TrustStatusDomainFailureCode,
): TrustStatusDomainResult<T> => Object.freeze({ ok: false, code });
