import type { OrganizationVerificationAttemptLifecycleTransitionExecution } from "../attempt-lifecycle-runtime/index.js";
import type {
  OrganizationVerificationWorkflowExecution,
  OrganizationVerificationWorkflowStage,
  OrganizationVerificationWorkflowStep,
  OrganizationVerificationWorkflowStepRecord,
} from "../workflow-contract/index.js";
import type { OrganizationVerificationEvidenceSnapshot } from "../../domain/evidence-snapshot/index.js";
import type { OrganizationVerificationEvaluationProjection } from "../../domain/evaluation-projection/index.js";
import type { OrganizationVerificationPolicyEvaluationInput } from "../../domain/evaluation-input/index.js";
import type { OrganizationVerificationPolicyEvaluationExecution } from "../../domain/policy-runtime/index.js";
import type { OrganizationVerificationDecisionTrustIntegrationExecution } from "../../domain/decision-trust-integration/index.js";

interface OrganizationVerificationWorkflowStepExecutionBase {
  readonly workflowExecutionId: string;
  readonly workflowStepId: string;
  readonly predecessorWorkflowExecutionVersion: number;
  readonly nextWorkflowExecutionVersion: number;
  readonly predecessorStage: OrganizationVerificationWorkflowStage;
  readonly resultingStage: OrganizationVerificationWorkflowStage;
  readonly predecessorWorkflowExecution: OrganizationVerificationWorkflowExecution;
  readonly workflowStepRecord: OrganizationVerificationWorkflowStepRecord;
  readonly nextWorkflowExecution: OrganizationVerificationWorkflowExecution;
  readonly occurredAt: string;
  readonly workflowStepExecutionFingerprint: string;
}

export type OrganizationVerificationWorkflowStepExecution =
  | Readonly<
      OrganizationVerificationWorkflowStepExecutionBase & {
        requestedStep: "attempt_transition";
        authorityResult: OrganizationVerificationAttemptLifecycleTransitionExecution;
      }
    >
  | Readonly<
      OrganizationVerificationWorkflowStepExecutionBase & {
        requestedStep: "bind_snapshot";
        authorityResult: OrganizationVerificationEvidenceSnapshot;
      }
    >
  | Readonly<
      OrganizationVerificationWorkflowStepExecutionBase & {
        requestedStep: "bind_projection";
        authorityResult: OrganizationVerificationEvaluationProjection;
      }
    >
  | Readonly<
      OrganizationVerificationWorkflowStepExecutionBase & {
        requestedStep: "bind_evaluation_input";
        authorityResult: OrganizationVerificationPolicyEvaluationInput;
      }
    >
  | Readonly<
      OrganizationVerificationWorkflowStepExecutionBase & {
        requestedStep: "complete_policy";
        authorityResult: OrganizationVerificationPolicyEvaluationExecution;
      }
    >
  | Readonly<
      OrganizationVerificationWorkflowStepExecutionBase & {
        requestedStep: "complete_decision_trust_integration";
        authorityResult: OrganizationVerificationDecisionTrustIntegrationExecution;
      }
    >;

export type OrganizationVerificationWorkflowAuthorityResult =
  OrganizationVerificationWorkflowStepExecution["authorityResult"];

const workflowStepExecutionSeal = Symbol(
  "organization-verification-workflow-step-execution",
);
const authenticWorkflowStepExecutions = new WeakSet<object>();

export function createWorkflowStepExecutionInternal<
  T extends OrganizationVerificationWorkflowStepExecution,
>(execution: T): T {
  Object.defineProperty(execution, workflowStepExecutionSeal, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  authenticWorkflowStepExecutions.add(execution);
  return Object.freeze(execution);
}

export function isOrganizationVerificationWorkflowStepExecution(
  value: unknown,
): value is OrganizationVerificationWorkflowStepExecution {
  return (
    typeof value === "object" &&
    value !== null &&
    authenticWorkflowStepExecutions.has(value) &&
    Object.getOwnPropertyDescriptor(value, workflowStepExecutionSeal)?.value ===
      true &&
    Object.isFrozen(value)
  );
}

export function authorityResultFingerprint(
  step: OrganizationVerificationWorkflowStep,
  result: OrganizationVerificationWorkflowAuthorityResult,
): string | undefined {
  switch (step) {
    case "attempt_transition":
      return "attemptLifecycleTransitionExecutionFingerprint" in result
        ? result.attemptLifecycleTransitionExecutionFingerprint
        : undefined;
    case "bind_snapshot":
      return "snapshotFingerprint" in result
        ? String(result.snapshotFingerprint)
        : undefined;
    case "bind_projection":
      return "projectionFingerprint" in result
        ? String(result.projectionFingerprint)
        : undefined;
    case "bind_evaluation_input":
      return "inputFingerprint" in result
        ? String(result.inputFingerprint)
        : undefined;
    case "complete_policy":
    case "complete_decision_trust_integration":
      return "executionFingerprint" in result
        ? String(result.executionFingerprint)
        : undefined;
  }
}
