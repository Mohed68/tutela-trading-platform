export type AttemptLifecycleContractFailureCode =
  | "invalid_artifacts"
  | "unauthentic_record"
  | "unauthentic_revision"
  | "unauthentic_attempt"
  | "unauthentic_transition_record"
  | "organization_mismatch"
  | "record_mismatch"
  | "revision_mismatch"
  | "attempt_mismatch"
  | "attempt_sequence_mismatch"
  | "invalid_transition"
  | "state_continuity_mismatch"
  | "version_continuity_mismatch"
  | "chronology_mismatch"
  | "transition_conflict"
  | "transition_branch_conflict";

export type AttemptLifecycleContractResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; code: AttemptLifecycleContractFailureCode }>;

export function contractSuccess<T>(
  value: T,
): AttemptLifecycleContractResult<T> {
  return Object.freeze({ ok: true, value });
}

export function contractFailure(
  code: AttemptLifecycleContractFailureCode,
): AttemptLifecycleContractResult<never> {
  return Object.freeze({ ok: false, code });
}
