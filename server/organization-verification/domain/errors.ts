export type CoreDomainFailureCode =
  | "organization_id_mismatch"
  | "record_id_mismatch"
  | "draft_version_mismatch"
  | "profile_revision_mismatch"
  | "invalid_revision_sequence"
  | "non_monotonic_revision_sequence"
  | "duplicate_evidence_reference"
  | "invalid_attempt_sequence"
  | "invalid_process_transition"
  | "attempt_already_completed"
  | "mutable_input_rejected"
  | "invalid_opaque_identifier";

export type CoreDomainResult<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false;
      readonly code: CoreDomainFailureCode;
      readonly path?: string;
    };

export function domainSuccess<T>(value: T): CoreDomainResult<T> {
  return Object.freeze({ ok: true, value });
}

export function domainFailure<T>(
  code: CoreDomainFailureCode,
  path?: string,
): CoreDomainResult<T> {
  return Object.freeze(path ? { ok: false, code, path } : { ok: false, code });
}
