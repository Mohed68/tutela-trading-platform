import type { AttemptLifecycleRuntimeFailure } from "../attempt-lifecycle-runtime/index.js";
import type { OrganizationVerificationWorkflowContractFailureCode } from "../workflow-contract/index.js";
import type { EvidenceSnapshotDomainFailureCode } from "../../domain/evidence-snapshot/index.js";
import type { EvaluationProjectionDomainFailureCode } from "../../domain/evaluation-projection/index.js";
import type { PolicyEvaluationInputDomainFailureCode } from "../../domain/evaluation-input/index.js";
import type { OrganizationVerificationPolicyRuntimeFailureCode } from "../../domain/policy-runtime/index.js";
import type { OrganizationVerificationDecisionTrustIntegrationFailure } from "../../domain/decision-trust-integration/index.js";

export type OrganizationVerificationWorkflowRuntimeFailure =
  | Readonly<{
      ok: false;
      stage: "workflow_runtime";
      code:
        | "unauthentic_workflow_execution"
        | "invalid_workflow_step_for_stage"
        | "workflow_step_execution_conflict"
        | "authority_result_authenticity_failed"
        | "invalid_runtime_artifacts";
    }>
  | Readonly<{
      ok: false;
      stage: "attempt_authority";
      cause: AttemptLifecycleRuntimeFailure;
    }>
  | Readonly<{
      ok: false;
      stage: "snapshot_authority";
      code: EvidenceSnapshotDomainFailureCode;
    }>
  | Readonly<{
      ok: false;
      stage: "projection_authority";
      code: EvaluationProjectionDomainFailureCode;
    }>
  | Readonly<{
      ok: false;
      stage: "evaluation_input_authority";
      code: PolicyEvaluationInputDomainFailureCode;
    }>
  | Readonly<{
      ok: false;
      stage: "policy_authority";
      code: OrganizationVerificationPolicyRuntimeFailureCode;
      path?: string;
      cause?: string;
    }>
  | Readonly<{
      ok: false;
      stage: "decision_trust_integration_authority";
      cause: OrganizationVerificationDecisionTrustIntegrationFailure;
    }>
  | Readonly<{
      ok: false;
      stage: "workflow_step_record" | "next_workflow_execution";
      code: OrganizationVerificationWorkflowContractFailureCode;
    }>;

export type OrganizationVerificationWorkflowRuntimeResult<T> =
  | Readonly<{ ok: true; value: T }>
  | OrganizationVerificationWorkflowRuntimeFailure;

type WithoutFailureFlag<T> = T extends unknown ? Omit<T, "ok"> : never;
type OrganizationVerificationWorkflowRuntimeFailureInput =
  WithoutFailureFlag<OrganizationVerificationWorkflowRuntimeFailure>;

export function workflowRuntimeSuccess<T>(
  value: T,
): OrganizationVerificationWorkflowRuntimeResult<T> {
  return Object.freeze({ ok: true, value });
}

export function workflowRuntimeFailure<
  T extends OrganizationVerificationWorkflowRuntimeFailureInput,
>(failure: T): Readonly<T & { ok: false }> {
  const result: T & { ok: false } = { ...failure, ok: false };
  Object.freeze(result);
  return result;
}
