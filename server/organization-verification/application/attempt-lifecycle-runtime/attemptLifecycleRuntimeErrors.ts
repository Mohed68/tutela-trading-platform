import type { CoreDomainFailureCode } from "../../domain/errors.js";
import type { AttemptLifecycleContractFailureCode } from "../attempt-lifecycle-contract/index.js";

export type AttemptLifecycleRuntimeFailureData =
  | {
      stage: "runtime";
      code:
        | "unauthentic_lifecycle_execution"
        | "invalid_runtime_artifacts"
        | "continuity_mismatch"
        | "chronology_mismatch"
        | "resulting_attempt_authenticity_failed";
    }
  | {
      stage: "domain_transition";
      code: CoreDomainFailureCode;
    }
  | {
      stage: "transition_record" | "next_execution";
      code: AttemptLifecycleContractFailureCode;
    };

type WithFailureFlag<T> = T extends AttemptLifecycleRuntimeFailureData
  ? Readonly<T & { ok: false }>
  : never;

export type AttemptLifecycleRuntimeFailure =
  WithFailureFlag<AttemptLifecycleRuntimeFailureData>;

export type AttemptLifecycleRuntimeResult<T> =
  | Readonly<{ ok: true; value: T }>
  | AttemptLifecycleRuntimeFailure;

export function runtimeSuccess<T>(
  value: T,
): AttemptLifecycleRuntimeResult<T> {
  return Object.freeze({ ok: true, value });
}

export function runtimeFailure<T extends AttemptLifecycleRuntimeFailureData>(
  failure: T,
): Readonly<T & { ok: false }> {
  const result: T & { ok: false } = { ...failure, ok: false };
  Object.freeze(result);
  return result;
}
