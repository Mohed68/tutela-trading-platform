import type { OrganizationVerificationAttempt } from "../../domain/attempt.js";
import type {
  OrganizationVerificationAttemptLifecycleExecution,
  OrganizationVerificationAttemptLifecycleTransitionRecord,
} from "../attempt-lifecycle-contract/index.js";

export interface OrganizationVerificationAttemptLifecycleTransitionExecution {
  readonly lifecycleExecutionId: string;
  readonly transitionId: string;
  readonly predecessorLifecycleExecutionVersion: number;
  readonly nextLifecycleExecutionVersion: number;
  readonly predecessorAttempt: OrganizationVerificationAttempt;
  readonly resultingAttempt: OrganizationVerificationAttempt;
  readonly transitionRecord: OrganizationVerificationAttemptLifecycleTransitionRecord;
  readonly nextLifecycleExecution: OrganizationVerificationAttemptLifecycleExecution;
  readonly occurredAt: string;
  readonly attemptLifecycleTransitionExecutionFingerprint: string;
}

const runtimeExecutionSeal = Symbol(
  "organization-verification-attempt-lifecycle-transition-execution",
);
const authenticRuntimeExecutions = new WeakSet<object>();

export function createAttemptLifecycleTransitionExecutionInternal<
  T extends OrganizationVerificationAttemptLifecycleTransitionExecution,
>(execution: T): T {
  Object.defineProperty(execution, runtimeExecutionSeal, {
    value: true,
    enumerable: false,
    writable: false,
    configurable: false,
  });
  authenticRuntimeExecutions.add(execution);
  return Object.freeze(execution);
}

export function isOrganizationVerificationAttemptLifecycleTransitionExecution(
  value: unknown,
): value is OrganizationVerificationAttemptLifecycleTransitionExecution {
  return (
    typeof value === "object" &&
    value !== null &&
    authenticRuntimeExecutions.has(value) &&
    Object.getOwnPropertyDescriptor(value, runtimeExecutionSeal)?.value ===
      true &&
    Object.isFrozen(value)
  );
}
