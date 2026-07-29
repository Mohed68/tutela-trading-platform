import type { OrganizationVerificationAttemptLifecycleExecution } from "../attempt-lifecycle-contract/index.js";
import type {
  OrganizationVerificationWorkflowExecution,
  OrganizationVerificationWorkflowStepRecord,
} from "../workflow-contract/index.js";
import type { OrganizationVerificationDecisionTrustIntegrationExecution } from "../../domain/decision-trust-integration/index.js";
import type { OrganizationVerificationPolicyEvaluationInput } from "../../domain/evaluation-input/index.js";
import type { OrganizationVerificationEvaluationProjection } from "../../domain/evaluation-projection/index.js";
import type { OrganizationVerificationEvidenceSnapshot } from "../../domain/evidence-snapshot/index.js";
import type { OrganizationVerificationPolicyEvaluationExecution } from "../../domain/policy-runtime/index.js";

export const ORGANIZATION_VERIFICATION_DURABLE_EVIDENCE_KINDS = Object.freeze([
  "workflow_genesis",
  "attempt_lifecycle_execution",
  "evidence_snapshot",
  "evaluation_projection",
  "policy_evaluation_input",
  "policy_runtime_execution",
  "decision_trust_integration_execution",
  "workflow_step_record",
] as const);

export type OrganizationVerificationDurableEvidenceKind =
  (typeof ORGANIZATION_VERIFICATION_DURABLE_EVIDENCE_KINDS)[number];

export type OrganizationVerificationDurableEvidence =
  | Readonly<{
      evidenceKind: "workflow_genesis";
      artifact: OrganizationVerificationWorkflowExecution;
    }>
  | Readonly<{
      evidenceKind: "attempt_lifecycle_execution";
      artifact: OrganizationVerificationAttemptLifecycleExecution;
    }>
  | Readonly<{
      evidenceKind: "evidence_snapshot";
      artifact: OrganizationVerificationEvidenceSnapshot;
    }>
  | Readonly<{
      evidenceKind: "evaluation_projection";
      artifact: OrganizationVerificationEvaluationProjection;
    }>
  | Readonly<{
      evidenceKind: "policy_evaluation_input";
      artifact: OrganizationVerificationPolicyEvaluationInput;
    }>
  | Readonly<{
      evidenceKind: "policy_runtime_execution";
      artifact: OrganizationVerificationPolicyEvaluationExecution;
    }>
  | Readonly<{
      evidenceKind: "decision_trust_integration_execution";
      artifact: OrganizationVerificationDecisionTrustIntegrationExecution;
    }>
  | Readonly<{
      evidenceKind: "workflow_step_record";
      artifact: OrganizationVerificationWorkflowStepRecord;
    }>;

export function isOrganizationVerificationDurableEvidenceKind(
  value: unknown,
): value is OrganizationVerificationDurableEvidenceKind {
  return (
    typeof value === "string" &&
    ORGANIZATION_VERIFICATION_DURABLE_EVIDENCE_KINDS.some(
      (kind) => kind === value,
    )
  );
}
