export const ORGANIZATION_VERIFICATION_WORKFLOW_STAGES = Object.freeze([
  "attempt_in_progress",
  "attempt_completed",
  "snapshot_bound",
  "projection_bound",
  "evaluation_input_bound",
  "policy_completed",
  "completed",
] as const);

export type OrganizationVerificationWorkflowStage =
  (typeof ORGANIZATION_VERIFICATION_WORKFLOW_STAGES)[number];

export const ORGANIZATION_VERIFICATION_WORKFLOW_STEPS = Object.freeze([
  "attempt_transition",
  "bind_snapshot",
  "bind_projection",
  "bind_evaluation_input",
  "complete_policy",
  "complete_decision_trust_integration",
] as const);

export type OrganizationVerificationWorkflowStep =
  (typeof ORGANIZATION_VERIFICATION_WORKFLOW_STEPS)[number];

export function isOrganizationVerificationWorkflowStage(
  value: unknown,
): value is OrganizationVerificationWorkflowStage {
  return (
    typeof value === "string" &&
    ORGANIZATION_VERIFICATION_WORKFLOW_STAGES.some((stage) => stage === value)
  );
}

export function isOrganizationVerificationWorkflowStep(
  value: unknown,
): value is OrganizationVerificationWorkflowStep {
  return (
    typeof value === "string" &&
    ORGANIZATION_VERIFICATION_WORKFLOW_STEPS.some((step) => step === value)
  );
}
