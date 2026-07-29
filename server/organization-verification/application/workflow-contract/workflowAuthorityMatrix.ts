import type {
  OrganizationVerificationWorkflowStage,
  OrganizationVerificationWorkflowStep,
} from "./workflowStages.js";

export interface OrganizationVerificationWorkflowStepAuthority {
  readonly requestedStep: OrganizationVerificationWorkflowStep;
  readonly predecessorStages: readonly OrganizationVerificationWorkflowStage[];
  readonly resultingStages: readonly OrganizationVerificationWorkflowStage[];
  readonly requiredAuthenticInputs: readonly string[];
  readonly exactAuthority: string;
  readonly authenticOutput: string;
  readonly continuity: readonly string[];
  readonly chronology: string;
  readonly terminal: boolean;
}

function authority(
  value: OrganizationVerificationWorkflowStepAuthority,
): OrganizationVerificationWorkflowStepAuthority {
  return Object.freeze({
    ...value,
    predecessorStages: Object.freeze([...value.predecessorStages]),
    resultingStages: Object.freeze([...value.resultingStages]),
    requiredAuthenticInputs: Object.freeze([
      ...value.requiredAuthenticInputs,
    ]),
    continuity: Object.freeze([...value.continuity]),
  });
}

export const ORGANIZATION_VERIFICATION_WORKFLOW_STEP_AUTHORITY_MATRIX =
  Object.freeze([
    authority({
      requestedStep: "attempt_transition",
      predecessorStages: ["attempt_in_progress"],
      resultingStages: ["attempt_in_progress", "attempt_completed"],
      requiredAuthenticInputs: [
        "OrganizationVerificationAttemptLifecycleExecution",
      ],
      exactAuthority:
        "executeOrganizationVerificationAttemptTransition",
      authenticOutput:
        "OrganizationVerificationAttemptLifecycleTransitionExecution",
      continuity: [
        "workflow",
        "organization",
        "record",
        "revision",
        "attempt",
        "attempt_sequence",
        "lifecycle_execution",
      ],
      chronology: "transition occurredAt",
      terminal: false,
    }),
    authority({
      requestedStep: "bind_snapshot",
      predecessorStages: ["attempt_completed"],
      resultingStages: ["snapshot_bound"],
      requiredAuthenticInputs: [
        "OrganizationVerificationAttemptLifecycleExecution",
      ],
      exactAuthority: "buildOrganizationVerificationEvidenceSnapshot",
      authenticOutput: "OrganizationVerificationEvidenceSnapshot",
      continuity: ["organization", "record", "revision", "attempt"],
      chronology: "snapshot createdAt",
      terminal: false,
    }),
    authority({
      requestedStep: "bind_projection",
      predecessorStages: ["snapshot_bound"],
      resultingStages: ["projection_bound"],
      requiredAuthenticInputs: [
        "OrganizationVerificationEvidenceSnapshot",
      ],
      exactAuthority: "buildOrganizationVerificationEvaluationProjection",
      authenticOutput: "OrganizationVerificationEvaluationProjection",
      continuity: [
        "organization",
        "record",
        "revision",
        "attempt",
        "snapshot",
      ],
      chronology: "projection projectedAt",
      terminal: false,
    }),
    authority({
      requestedStep: "bind_evaluation_input",
      predecessorStages: ["projection_bound"],
      resultingStages: ["evaluation_input_bound"],
      requiredAuthenticInputs: [
        "OrganizationVerificationEvaluationProjection",
      ],
      exactAuthority: "buildOrganizationVerificationPolicyEvaluationInput",
      authenticOutput: "OrganizationVerificationPolicyEvaluationInput",
      continuity: [
        "organization",
        "record",
        "revision",
        "attempt",
        "snapshot",
        "projection",
      ],
      chronology: "evaluation input createdAt",
      terminal: false,
    }),
    authority({
      requestedStep: "complete_policy",
      predecessorStages: ["evaluation_input_bound"],
      resultingStages: ["policy_completed"],
      requiredAuthenticInputs: [
        "OrganizationVerificationPolicyEvaluationInput",
      ],
      exactAuthority: "executeOrganizationVerificationPolicyEvaluation",
      authenticOutput: "OrganizationVerificationPolicyEvaluationExecution",
      continuity: [
        "organization",
        "record",
        "revision",
        "attempt",
        "snapshot",
        "evaluation_input",
      ],
      chronology: "policy execution completedAt",
      terminal: false,
    }),
    authority({
      requestedStep: "complete_decision_trust_integration",
      predecessorStages: ["policy_completed"],
      resultingStages: ["completed"],
      requiredAuthenticInputs: [
        "OrganizationVerificationPolicyEvaluationExecution",
      ],
      exactAuthority:
        "executeOrganizationVerificationDecisionTrustIntegration",
      authenticOutput:
        "OrganizationVerificationDecisionTrustIntegrationExecution",
      continuity: [
        "organization",
        "record",
        "revision",
        "attempt",
        "snapshot",
        "policy_execution",
        "decision",
        "trust",
        "integration_binding",
      ],
      chronology: "integration execution completedAt",
      terminal: true,
    }),
  ] satisfies readonly OrganizationVerificationWorkflowStepAuthority[]);

export function workflowAuthorityForStep(
  step: OrganizationVerificationWorkflowStep,
): OrganizationVerificationWorkflowStepAuthority | undefined {
  return ORGANIZATION_VERIFICATION_WORKFLOW_STEP_AUTHORITY_MATRIX.find(
    (entry) => entry.requestedStep === step,
  );
}
