export type OrganizationVerificationWorkflowContractFailureCode =
  | "invalid_identity"
  | "invalid_version"
  | "invalid_stage"
  | "invalid_stage_progression"
  | "invalid_timestamp"
  | "invalid_evidence"
  | "unauthentic_artifact"
  | "continuity_mismatch"
  | "artifact_fingerprint_mismatch"
  | "chronology_mismatch"
  | "stale_version"
  | "skipped_version"
  | "duplicate_step_conflict"
  | "branch_conflict"
  | "workflow_conflict";

export type OrganizationVerificationWorkflowContractResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{
      ok: false;
      code: OrganizationVerificationWorkflowContractFailureCode;
      detail?: string;
    }>;

export function workflowSuccess<T>(
  value: T,
): OrganizationVerificationWorkflowContractResult<T> {
  return Object.freeze({ ok: true, value });
}

export function workflowFailure(
  code: OrganizationVerificationWorkflowContractFailureCode,
  detail?: string,
): OrganizationVerificationWorkflowContractResult<never> {
  return Object.freeze({
    ok: false,
    code,
    ...(detail === undefined ? {} : { detail }),
  });
}
