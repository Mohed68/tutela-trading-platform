export type EvaluationProjectionDomainFailureCode =
  | "invalid_evaluation_projection_id"
  | "invalid_evaluation_projection_version"
  | "unsupported_evaluation_projection_contract_version"
  | "unsupported_evaluation_projection_builder_version"
  | "unsupported_evaluation_projection_schema_version"
  | "invalid_evaluation_projection_provenance_reference"
  | "invalid_evaluation_projection_integrity_reference"
  | "invalid_evaluation_projection_timestamp"
  | "unauthentic_evidence_snapshot"
  | "evaluation_projection_fingerprint_mismatch"
  | "evaluation_projection_construction_failure";

export type EvaluationProjectionDomainResult<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false;
      readonly code: EvaluationProjectionDomainFailureCode;
      readonly path?: string;
    };

export function evaluationProjectionSuccess<T>(
  value: T,
): EvaluationProjectionDomainResult<T> {
  return Object.freeze({ ok: true, value });
}

export function evaluationProjectionFailure<T>(
  code: EvaluationProjectionDomainFailureCode,
  path?: string,
): EvaluationProjectionDomainResult<T> {
  return Object.freeze(path ? { ok: false, code, path } : { ok: false, code });
}
