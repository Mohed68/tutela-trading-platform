export type OrganizationVerificationPersistenceFailureCode =
  | "stream_not_found"
  | "expected_stream_version_conflict"
  | "evidence_identity_conflict"
  | "evidence_fingerprint_conflict"
  | "stream_identity_mismatch"
  | "invalid_evidence_order"
  | "unsupported_evidence_kind"
  | "unauthentic_evidence"
  | "malformed_append_metadata"
  | "stored_integrity_failure";

export type OrganizationVerificationPersistenceResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{
      ok: false;
      code: OrganizationVerificationPersistenceFailureCode;
      detail?: string;
    }>;

export function persistenceSuccess<T>(
  value: T,
): OrganizationVerificationPersistenceResult<T> {
  return Object.freeze({ ok: true, value });
}

export function persistenceFailure(
  code: OrganizationVerificationPersistenceFailureCode,
  detail?: string,
): OrganizationVerificationPersistenceResult<never> {
  return Object.freeze({
    ok: false,
    code,
    ...(detail === undefined ? {} : { detail }),
  });
}
