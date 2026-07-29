import {
  executeOrganizationVerificationAttemptTransition,
  isOrganizationVerificationAttemptLifecycleTransitionExecution,
  type ExecuteAttemptTransitionInput,
  type OrganizationVerificationAttemptLifecycleTransitionExecution,
} from "../attempt-lifecycle-runtime/index.js";
import {
  createOrganizationVerificationWorkflowExecution,
  createOrganizationVerificationWorkflowStepRecord,
  isOrganizationVerificationWorkflowExecution,
  type OrganizationVerificationWorkflowExecution,
  type OrganizationVerificationWorkflowStage,
  type OrganizationVerificationWorkflowStepArtifacts,
  type OrganizationVerificationWorkflowStepRecord,
} from "../workflow-contract/index.js";
import {
  buildOrganizationVerificationEvidenceSnapshot,
  isOrganizationVerificationEvidenceSnapshot,
  type BuildOrganizationVerificationEvidenceSnapshotInput,
  type OrganizationVerificationEvidenceSnapshot,
} from "../../domain/evidence-snapshot/index.js";
import {
  buildOrganizationVerificationEvaluationProjection,
  isOrganizationVerificationEvaluationProjection,
  type BuildOrganizationVerificationEvaluationProjectionInput,
  type OrganizationVerificationEvaluationProjection,
} from "../../domain/evaluation-projection/index.js";
import {
  buildOrganizationVerificationPolicyEvaluationInput,
  isOrganizationVerificationPolicyEvaluationInput,
  type BuildOrganizationVerificationPolicyEvaluationInput,
  type OrganizationVerificationPolicyEvaluationInput,
} from "../../domain/evaluation-input/index.js";
import {
  executeOrganizationVerificationPolicyEvaluation,
  isOrganizationVerificationPolicyEvaluationExecution,
  type ExecuteOrganizationVerificationPolicyEvaluationInput,
  type OrganizationVerificationPolicyEvaluationExecution,
} from "../../domain/policy-runtime/index.js";
import {
  executeOrganizationVerificationDecisionTrustIntegration,
  isOrganizationVerificationDecisionTrustIntegrationExecution,
  type ExecuteOrganizationVerificationDecisionTrustIntegrationInput,
  type OrganizationVerificationDecisionTrustIntegrationExecution,
} from "../../domain/decision-trust-integration/index.js";
import {
  workflowRuntimeFailure,
  workflowRuntimeSuccess,
  type OrganizationVerificationWorkflowRuntimeResult,
} from "./workflowRuntimeErrors.js";
import { fingerprintOrganizationVerificationWorkflowRuntime } from "./workflowRuntimeFingerprint.js";
import {
  authorityResultFingerprint,
  createWorkflowStepExecutionInternal,
  isOrganizationVerificationWorkflowStepExecution,
  type OrganizationVerificationWorkflowStepExecution,
} from "./workflowStepExecution.js";

interface ExecuteWorkflowStepCommonInput {
  readonly workflowExecution: OrganizationVerificationWorkflowExecution;
  readonly workflowStepId: string;
  readonly occurredAt: string;
  readonly provenanceReferences: readonly string[];
  readonly integrityReferences: readonly string[];
  readonly correlationId?: string;
  readonly causationId?: string;
  readonly reasonReference?: string;
  readonly existingWorkflowStepExecution?: OrganizationVerificationWorkflowStepExecution;
}

export type ExecuteOrganizationVerificationWorkflowStepInput =
  | Readonly<
      ExecuteWorkflowStepCommonInput & {
        requestedStep: "attempt_transition";
        attemptTransitionInput: Omit<
          ExecuteAttemptTransitionInput,
          "predecessorLifecycleExecution"
        >;
      }
    >
  | Readonly<
      ExecuteWorkflowStepCommonInput & {
        requestedStep: "bind_snapshot";
        snapshotInput: BuildOrganizationVerificationEvidenceSnapshotInput;
      }
    >
  | Readonly<
      ExecuteWorkflowStepCommonInput & {
        requestedStep: "bind_projection";
        projectionInput: Omit<
          BuildOrganizationVerificationEvaluationProjectionInput,
          "evidenceSnapshot"
        >;
      }
    >
  | Readonly<
      ExecuteWorkflowStepCommonInput & {
        requestedStep: "bind_evaluation_input";
        evaluationInput: Omit<
          BuildOrganizationVerificationPolicyEvaluationInput,
          "evaluationProjection"
        >;
      }
    >
  | Readonly<
      ExecuteWorkflowStepCommonInput & {
        requestedStep: "complete_policy";
        policyInput: Omit<
          ExecuteOrganizationVerificationPolicyEvaluationInput,
          "evaluationInput"
        >;
      }
    >
  | Readonly<
      ExecuteWorkflowStepCommonInput & {
        requestedStep: "complete_decision_trust_integration";
        decisionTrustIntegrationInput: Omit<
          ExecuteOrganizationVerificationDecisionTrustIntegrationInput,
          "policyRuntimeExecution"
        >;
      }
    >;

type ExecutedStep =
  | Readonly<{
      requestedStep: "attempt_transition";
      resultingStage: "attempt_in_progress" | "attempt_completed";
      authorityResult: OrganizationVerificationAttemptLifecycleTransitionExecution;
      artifacts: Extract<
        OrganizationVerificationWorkflowStepArtifacts,
        { requestedStep: "attempt_transition" }
      >;
    }>
  | Readonly<{
      requestedStep: "bind_snapshot";
      resultingStage: "snapshot_bound";
      authorityResult: OrganizationVerificationEvidenceSnapshot;
      artifacts: Extract<
        OrganizationVerificationWorkflowStepArtifacts,
        { requestedStep: "bind_snapshot" }
      >;
    }>
  | Readonly<{
      requestedStep: "bind_projection";
      resultingStage: "projection_bound";
      authorityResult: OrganizationVerificationEvaluationProjection;
      artifacts: Extract<
        OrganizationVerificationWorkflowStepArtifacts,
        { requestedStep: "bind_projection" }
      >;
    }>
  | Readonly<{
      requestedStep: "bind_evaluation_input";
      resultingStage: "evaluation_input_bound";
      authorityResult: OrganizationVerificationPolicyEvaluationInput;
      artifacts: Extract<
        OrganizationVerificationWorkflowStepArtifacts,
        { requestedStep: "bind_evaluation_input" }
      >;
    }>
  | Readonly<{
      requestedStep: "complete_policy";
      resultingStage: "policy_completed";
      authorityResult: OrganizationVerificationPolicyEvaluationExecution;
      artifacts: Extract<
        OrganizationVerificationWorkflowStepArtifacts,
        { requestedStep: "complete_policy" }
      >;
    }>
  | Readonly<{
      requestedStep: "complete_decision_trust_integration";
      resultingStage: "completed";
      authorityResult: OrganizationVerificationDecisionTrustIntegrationExecution;
      artifacts: Extract<
        OrganizationVerificationWorkflowStepArtifacts,
        { requestedStep: "complete_decision_trust_integration" }
      >;
    }>;

const COMMON_INPUT_KEYS = Object.freeze([
  "workflowExecution",
  "workflowStepId",
  "requestedStep",
  "occurredAt",
  "provenanceReferences",
  "integrityReferences",
  "correlationId",
  "causationId",
  "reasonReference",
  "existingWorkflowStepExecution",
]);

function hasExactInputBoundary(
  input: ExecuteOrganizationVerificationWorkflowStepInput,
  authorityInputKey: string,
): boolean {
  const allowed = new Set([...COMMON_INPUT_KEYS, authorityInputKey]);
  const authorityInput = Object.getOwnPropertyDescriptor(
    input,
    authorityInputKey,
  )?.value;
  return (
    typeof authorityInput === "object" &&
    authorityInput !== null &&
    Object.keys(input).every((key) => allowed.has(key))
  );
}

function expectedStageForStep(
  requestedStep: ExecuteOrganizationVerificationWorkflowStepInput["requestedStep"],
): OrganizationVerificationWorkflowStage {
  switch (requestedStep) {
    case "attempt_transition":
      return "attempt_in_progress";
    case "bind_snapshot":
      return "attempt_completed";
    case "bind_projection":
      return "snapshot_bound";
    case "bind_evaluation_input":
      return "projection_bound";
    case "complete_policy":
      return "evaluation_input_bound";
    case "complete_decision_trust_integration":
      return "policy_completed";
  }
}

function isApprovedWorkflowStep(
  value: unknown,
): value is ExecuteOrganizationVerificationWorkflowStepInput["requestedStep"] {
  switch (value) {
    case "attempt_transition":
    case "bind_snapshot":
    case "bind_projection":
    case "bind_evaluation_input":
    case "complete_policy":
    case "complete_decision_trust_integration":
      return true;
    default:
      return false;
  }
}

function bindAuthenticatedExecution(
  executed: ExecutedStep,
  base: Readonly<{
    workflowExecutionId: string;
    workflowStepId: string;
    predecessorWorkflowExecutionVersion: number;
    nextWorkflowExecutionVersion: number;
    predecessorStage: OrganizationVerificationWorkflowStage;
    predecessorWorkflowExecution: OrganizationVerificationWorkflowExecution;
    workflowStepRecord: OrganizationVerificationWorkflowStepRecord;
    nextWorkflowExecution: OrganizationVerificationWorkflowExecution;
    occurredAt: string;
    workflowStepExecutionFingerprint: string;
  }>,
): OrganizationVerificationWorkflowStepExecution {
  switch (executed.requestedStep) {
    case "attempt_transition":
      return createWorkflowStepExecutionInternal({
        ...base,
        requestedStep: executed.requestedStep,
        resultingStage: executed.resultingStage,
        authorityResult: executed.authorityResult,
      });
    case "bind_snapshot":
      return createWorkflowStepExecutionInternal({
        ...base,
        requestedStep: executed.requestedStep,
        resultingStage: executed.resultingStage,
        authorityResult: executed.authorityResult,
      });
    case "bind_projection":
      return createWorkflowStepExecutionInternal({
        ...base,
        requestedStep: executed.requestedStep,
        resultingStage: executed.resultingStage,
        authorityResult: executed.authorityResult,
      });
    case "bind_evaluation_input":
      return createWorkflowStepExecutionInternal({
        ...base,
        requestedStep: executed.requestedStep,
        resultingStage: executed.resultingStage,
        authorityResult: executed.authorityResult,
      });
    case "complete_policy":
      return createWorkflowStepExecutionInternal({
        ...base,
        requestedStep: executed.requestedStep,
        resultingStage: executed.resultingStage,
        authorityResult: executed.authorityResult,
      });
    case "complete_decision_trust_integration":
      return createWorkflowStepExecutionInternal({
        ...base,
        requestedStep: executed.requestedStep,
        resultingStage: executed.resultingStage,
        authorityResult: executed.authorityResult,
      });
  }
}

export function executeOrganizationVerificationWorkflowStep(
  input: ExecuteOrganizationVerificationWorkflowStepInput,
): OrganizationVerificationWorkflowRuntimeResult<OrganizationVerificationWorkflowStepExecution> {
  const predecessor = input.workflowExecution;
  if (!isOrganizationVerificationWorkflowExecution(predecessor)) {
    return workflowRuntimeFailure({
      stage: "workflow_runtime",
      code: "unauthentic_workflow_execution",
    });
  }
  if (
    !isApprovedWorkflowStep(input.requestedStep) ||
    predecessor.workflowStage === "completed" ||
    predecessor.workflowStage !== expectedStageForStep(input.requestedStep)
  ) {
    return workflowRuntimeFailure({
      stage: "workflow_runtime",
      code: "invalid_workflow_step_for_stage",
    });
  }
  if (
    !Number.isFinite(Date.parse(input.occurredAt)) ||
    Date.parse(input.occurredAt) < Date.parse(predecessor.createdAt) ||
    (predecessor.lastStepAt !== undefined &&
      Date.parse(input.occurredAt) < Date.parse(predecessor.lastStepAt))
  ) {
    return workflowRuntimeFailure({
      stage: "workflow_runtime",
      code: "invalid_runtime_artifacts",
    });
  }

  const existing = input.existingWorkflowStepExecution;
  if (
    existing !== undefined &&
    (!isOrganizationVerificationWorkflowStepExecution(existing) ||
      existing.predecessorWorkflowExecution.workflowExecutionFingerprint !==
        predecessor.workflowExecutionFingerprint ||
      existing.predecessorWorkflowExecutionVersion !==
        predecessor.workflowExecutionVersion ||
      existing.workflowStepId !== input.workflowStepId ||
      existing.requestedStep !== input.requestedStep)
  ) {
    return workflowRuntimeFailure({
      stage: "workflow_runtime",
      code: "workflow_step_execution_conflict",
    });
  }

  let executed: ExecutedStep;
  switch (input.requestedStep) {
    case "attempt_transition": {
      if (!hasExactInputBoundary(input, "attemptTransitionInput")) {
        return workflowRuntimeFailure({
          stage: "workflow_runtime",
          code: "invalid_runtime_artifacts",
        });
      }
      const result = executeOrganizationVerificationAttemptTransition({
        ...input.attemptTransitionInput,
        predecessorLifecycleExecution: predecessor.lifecycleExecution,
      });
      if (!result.ok) {
        return workflowRuntimeFailure({
          stage: "attempt_authority",
          cause: result,
        });
      }
      if (
        !isOrganizationVerificationAttemptLifecycleTransitionExecution(
          result.value,
        )
      ) {
        return workflowRuntimeFailure({
          stage: "workflow_runtime",
          code: "authority_result_authenticity_failed",
        });
      }
      const resultingStage =
        result.value.nextLifecycleExecution.attempt.processState === "completed"
          ? "attempt_completed"
          : "attempt_in_progress";
      executed = Object.freeze({
        requestedStep: input.requestedStep,
        resultingStage,
        authorityResult: result.value,
        artifacts: Object.freeze({
          requestedStep: input.requestedStep,
          predecessorLifecycleExecution: predecessor.lifecycleExecution,
          transitionExecution: result.value,
        }),
      });
      break;
    }
    case "bind_snapshot": {
      if (!hasExactInputBoundary(input, "snapshotInput")) {
        return workflowRuntimeFailure({
          stage: "workflow_runtime",
          code: "invalid_runtime_artifacts",
        });
      }
      const result = buildOrganizationVerificationEvidenceSnapshot(
        input.snapshotInput,
      );
      if (!result.ok) {
        return workflowRuntimeFailure({
          stage: "snapshot_authority",
          code: result.code,
        });
      }
      if (!isOrganizationVerificationEvidenceSnapshot(result.value)) {
        return workflowRuntimeFailure({
          stage: "workflow_runtime",
          code: "authority_result_authenticity_failed",
        });
      }
      executed = Object.freeze({
        requestedStep: input.requestedStep,
        resultingStage: "snapshot_bound",
        authorityResult: result.value,
        artifacts: Object.freeze({
          requestedStep: input.requestedStep,
          lifecycleExecution: predecessor.lifecycleExecution,
          snapshot: result.value,
        }),
      });
      break;
    }
    case "bind_projection": {
      if (
        !hasExactInputBoundary(input, "projectionInput") ||
        predecessor.evidenceSnapshot === undefined
      ) {
        return workflowRuntimeFailure({
          stage: "workflow_runtime",
          code: "invalid_runtime_artifacts",
        });
      }
      const result = buildOrganizationVerificationEvaluationProjection({
        ...input.projectionInput,
        evidenceSnapshot: predecessor.evidenceSnapshot,
      });
      if (!result.ok) {
        return workflowRuntimeFailure({
          stage: "projection_authority",
          code: result.code,
        });
      }
      if (!isOrganizationVerificationEvaluationProjection(result.value)) {
        return workflowRuntimeFailure({
          stage: "workflow_runtime",
          code: "authority_result_authenticity_failed",
        });
      }
      executed = Object.freeze({
        requestedStep: input.requestedStep,
        resultingStage: "projection_bound",
        authorityResult: result.value,
        artifacts: Object.freeze({
          requestedStep: input.requestedStep,
          snapshot: predecessor.evidenceSnapshot,
          projection: result.value,
        }),
      });
      break;
    }
    case "bind_evaluation_input": {
      if (
        !hasExactInputBoundary(input, "evaluationInput") ||
        predecessor.evaluationProjection === undefined
      ) {
        return workflowRuntimeFailure({
          stage: "workflow_runtime",
          code: "invalid_runtime_artifacts",
        });
      }
      const result = buildOrganizationVerificationPolicyEvaluationInput({
        ...input.evaluationInput,
        evaluationProjection: predecessor.evaluationProjection,
      });
      if (!result.ok) {
        return workflowRuntimeFailure({
          stage: "evaluation_input_authority",
          code: result.code,
        });
      }
      if (!isOrganizationVerificationPolicyEvaluationInput(result.value)) {
        return workflowRuntimeFailure({
          stage: "workflow_runtime",
          code: "authority_result_authenticity_failed",
        });
      }
      executed = Object.freeze({
        requestedStep: input.requestedStep,
        resultingStage: "evaluation_input_bound",
        authorityResult: result.value,
        artifacts: Object.freeze({
          requestedStep: input.requestedStep,
          projection: predecessor.evaluationProjection,
          evaluationInput: result.value,
        }),
      });
      break;
    }
    case "complete_policy": {
      if (
        !hasExactInputBoundary(input, "policyInput") ||
        predecessor.policyEvaluationInput === undefined
      ) {
        return workflowRuntimeFailure({
          stage: "workflow_runtime",
          code: "invalid_runtime_artifacts",
        });
      }
      const result = executeOrganizationVerificationPolicyEvaluation({
        ...input.policyInput,
        evaluationInput: predecessor.policyEvaluationInput,
      });
      if (!result.ok) {
        return workflowRuntimeFailure({
          stage: "policy_authority",
          code: result.code,
          ...(result.path === undefined ? {} : { path: result.path }),
          ...(result.cause === undefined ? {} : { cause: result.cause }),
        });
      }
      if (!isOrganizationVerificationPolicyEvaluationExecution(result.value)) {
        return workflowRuntimeFailure({
          stage: "workflow_runtime",
          code: "authority_result_authenticity_failed",
        });
      }
      executed = Object.freeze({
        requestedStep: input.requestedStep,
        resultingStage: "policy_completed",
        authorityResult: result.value,
        artifacts: Object.freeze({
          requestedStep: input.requestedStep,
          evaluationInput: predecessor.policyEvaluationInput,
          policyExecution: result.value,
        }),
      });
      break;
    }
    case "complete_decision_trust_integration": {
      if (
        !hasExactInputBoundary(input, "decisionTrustIntegrationInput") ||
        predecessor.policyEvaluationExecution === undefined
      ) {
        return workflowRuntimeFailure({
          stage: "workflow_runtime",
          code: "invalid_runtime_artifacts",
        });
      }
      const result =
        executeOrganizationVerificationDecisionTrustIntegration({
          ...input.decisionTrustIntegrationInput,
          policyRuntimeExecution: predecessor.policyEvaluationExecution,
        });
      if (!result.ok) {
        return workflowRuntimeFailure({
          stage: "decision_trust_integration_authority",
          cause: result,
        });
      }
      if (
        !isOrganizationVerificationDecisionTrustIntegrationExecution(
          result.value,
        )
      ) {
        return workflowRuntimeFailure({
          stage: "workflow_runtime",
          code: "authority_result_authenticity_failed",
        });
      }
      executed = Object.freeze({
        requestedStep: input.requestedStep,
        resultingStage: "completed",
        authorityResult: result.value,
        artifacts: Object.freeze({
          requestedStep: input.requestedStep,
          policyExecution: predecessor.policyEvaluationExecution,
          integrationExecution: result.value,
        }),
      });
      break;
    }
  }

  const nextVersion = predecessor.workflowExecutionVersion + 1;
  const stepRecord = createOrganizationVerificationWorkflowStepRecord({
    workflowStepId: input.workflowStepId,
    workflowExecutionId: predecessor.workflowExecutionId,
    predecessorWorkflowExecutionVersion:
      predecessor.workflowExecutionVersion,
    nextWorkflowExecutionVersion: nextVersion,
    predecessorStage: predecessor.workflowStage,
    resultingStage: executed.resultingStage,
    organizationId: predecessor.organizationId,
    recordId: predecessor.recordId,
    revisionId: predecessor.revisionId,
    attemptId: predecessor.attemptId,
    occurredAt: input.occurredAt,
    provenanceReferences: input.provenanceReferences,
    integrityReferences: input.integrityReferences,
    ...(input.correlationId === undefined
      ? {}
      : { correlationId: input.correlationId }),
    ...(input.causationId === undefined
      ? {}
      : { causationId: input.causationId }),
    ...(input.reasonReference === undefined
      ? {}
      : { reasonReference: input.reasonReference }),
    artifacts: executed.artifacts,
    existingStepRecords: predecessor.stepRecords,
  });
  if (!stepRecord.ok) {
    return workflowRuntimeFailure({
      stage: "workflow_step_record",
      code: stepRecord.code,
    });
  }

  let lifecycleExecution = predecessor.lifecycleExecution;
  let evidenceSnapshot = predecessor.evidenceSnapshot;
  let evaluationProjection = predecessor.evaluationProjection;
  let policyEvaluationInput = predecessor.policyEvaluationInput;
  let policyEvaluationExecution = predecessor.policyEvaluationExecution;
  let decisionTrustIntegrationExecution =
    predecessor.decisionTrustIntegrationExecution;
  switch (executed.requestedStep) {
    case "attempt_transition":
      lifecycleExecution = executed.authorityResult.nextLifecycleExecution;
      break;
    case "bind_snapshot":
      evidenceSnapshot = executed.authorityResult;
      break;
    case "bind_projection":
      evaluationProjection = executed.authorityResult;
      break;
    case "bind_evaluation_input":
      policyEvaluationInput = executed.authorityResult;
      break;
    case "complete_policy":
      policyEvaluationExecution = executed.authorityResult;
      break;
    case "complete_decision_trust_integration":
      decisionTrustIntegrationExecution = executed.authorityResult;
      break;
  }

  const nextWorkflow = createOrganizationVerificationWorkflowExecution({
    workflowExecutionId: predecessor.workflowExecutionId,
    workflowExecutionVersion: nextVersion,
    organizationId: predecessor.organizationId,
    recordId: predecessor.recordId,
    revisionId: predecessor.revisionId,
    attemptId: predecessor.attemptId,
    workflowStage: executed.resultingStage,
    lifecycleExecution,
    ...(evidenceSnapshot === undefined ? {} : { evidenceSnapshot }),
    ...(evaluationProjection === undefined ? {} : { evaluationProjection }),
    ...(policyEvaluationInput === undefined ? {} : { policyEvaluationInput }),
    ...(policyEvaluationExecution === undefined
      ? {}
      : { policyEvaluationExecution }),
    ...(decisionTrustIntegrationExecution === undefined
      ? {}
      : { decisionTrustIntegrationExecution }),
    stepRecords: [...predecessor.stepRecords, stepRecord.value],
    createdAt: predecessor.createdAt,
    lastStepAt: input.occurredAt,
    provenanceReferences: predecessor.provenanceReferences,
    integrityReferences: predecessor.integrityReferences,
    ...(existing === undefined
      ? {}
      : { existingWorkflowExecution: existing.nextWorkflowExecution }),
  });
  if (!nextWorkflow.ok) {
    return workflowRuntimeFailure({
      stage: "next_workflow_execution",
      code: nextWorkflow.code,
    });
  }

  const resultFingerprint =
    authorityResultFingerprint(
      executed.requestedStep,
      executed.authorityResult,
    );
  if (resultFingerprint === undefined) {
    return workflowRuntimeFailure({
      stage: "workflow_runtime",
      code: "authority_result_authenticity_failed",
    });
  }
  const workflowStepExecutionFingerprint =
    fingerprintOrganizationVerificationWorkflowRuntime({
      scope: "organization_verification_workflow_step_execution",
      predecessorWorkflowFingerprint:
        predecessor.workflowExecutionFingerprint,
      workflowStepRecordFingerprint:
        stepRecord.value.workflowStepBindingFingerprint,
      nextWorkflowFingerprint:
        nextWorkflow.value.workflowExecutionFingerprint,
      requestedStep: executed.requestedStep,
      authorityResultFingerprint: resultFingerprint,
      workflowExecutionId: predecessor.workflowExecutionId,
      workflowStepId: input.workflowStepId,
      predecessorWorkflowExecutionVersion:
        predecessor.workflowExecutionVersion,
      nextWorkflowExecutionVersion: nextVersion,
      predecessorStage: predecessor.workflowStage,
      resultingStage: executed.resultingStage,
      occurredAt: input.occurredAt,
    });
  const execution = bindAuthenticatedExecution(executed, {
    workflowExecutionId: predecessor.workflowExecutionId,
    workflowStepId: input.workflowStepId,
    predecessorWorkflowExecutionVersion:
      predecessor.workflowExecutionVersion,
    nextWorkflowExecutionVersion: nextVersion,
    predecessorStage: predecessor.workflowStage,
    predecessorWorkflowExecution: predecessor,
    workflowStepRecord: stepRecord.value,
    nextWorkflowExecution: nextWorkflow.value,
    occurredAt: input.occurredAt,
    workflowStepExecutionFingerprint,
  });
  if (
    existing !== undefined &&
    existing.workflowStepExecutionFingerprint !==
      execution.workflowStepExecutionFingerprint
  ) {
    return workflowRuntimeFailure({
      stage: "workflow_runtime",
      code: "workflow_step_execution_conflict",
    });
  }
  return workflowRuntimeSuccess(existing ?? execution);
}
