import {
  isOrganizationVerificationAttemptLifecycleExecution,
  type OrganizationVerificationAttemptLifecycleExecution,
} from "../attempt-lifecycle-contract/index.js";
import {
  isOrganizationVerificationAttemptLifecycleTransitionExecution,
  type OrganizationVerificationAttemptLifecycleTransitionExecution,
} from "../attempt-lifecycle-runtime/index.js";
import {
  isOrganizationVerificationDecisionTrustIntegrationExecution,
  type OrganizationVerificationDecisionTrustIntegrationExecution,
} from "../../domain/decision-trust-integration/index.js";
import {
  isOrganizationVerificationPolicyEvaluationInput,
  type OrganizationVerificationPolicyEvaluationInput,
} from "../../domain/evaluation-input/index.js";
import {
  isOrganizationVerificationEvaluationProjection,
  type OrganizationVerificationEvaluationProjection,
} from "../../domain/evaluation-projection/index.js";
import {
  isOrganizationVerificationEvidenceSnapshot,
  type OrganizationVerificationEvidenceSnapshot,
} from "../../domain/evidence-snapshot/index.js";
import {
  isOrganizationVerificationPolicyEvaluationExecution,
  type OrganizationVerificationPolicyEvaluationExecution,
} from "../../domain/policy-runtime/index.js";
import {
  workflowFailure,
  workflowSuccess,
  type OrganizationVerificationWorkflowContractResult,
} from "./workflowErrors.js";
import { fingerprintWorkflowValue } from "./workflowFingerprint.js";
import {
  workflowAuthorityForStep,
} from "./workflowAuthorityMatrix.js";
import type {
  OrganizationVerificationWorkflowStage,
  OrganizationVerificationWorkflowStep,
} from "./workflowStages.js";

type LifecycleExecution = OrganizationVerificationAttemptLifecycleExecution;

export interface OrganizationVerificationWorkflowArtifactFingerprint {
  readonly artifactType: string;
  readonly fingerprint: string;
}

export type OrganizationVerificationWorkflowStepArtifacts =
  | Readonly<{
      requestedStep: "attempt_transition";
      predecessorLifecycleExecution: LifecycleExecution;
      transitionExecution: OrganizationVerificationAttemptLifecycleTransitionExecution;
    }>
  | Readonly<{
      requestedStep: "bind_snapshot";
      lifecycleExecution: LifecycleExecution;
      snapshot: OrganizationVerificationEvidenceSnapshot;
    }>
  | Readonly<{
      requestedStep: "bind_projection";
      snapshot: OrganizationVerificationEvidenceSnapshot;
      projection: OrganizationVerificationEvaluationProjection;
    }>
  | Readonly<{
      requestedStep: "bind_evaluation_input";
      projection: OrganizationVerificationEvaluationProjection;
      evaluationInput: OrganizationVerificationPolicyEvaluationInput;
    }>
  | Readonly<{
      requestedStep: "complete_policy";
      evaluationInput: OrganizationVerificationPolicyEvaluationInput;
      policyExecution: OrganizationVerificationPolicyEvaluationExecution;
    }>
  | Readonly<{
      requestedStep: "complete_decision_trust_integration";
      policyExecution: OrganizationVerificationPolicyEvaluationExecution;
      integrationExecution: OrganizationVerificationDecisionTrustIntegrationExecution;
    }>;

export interface CreateOrganizationVerificationWorkflowStepRecordInput {
  readonly workflowStepId: string;
  readonly workflowExecutionId: string;
  readonly predecessorWorkflowExecutionVersion: number;
  readonly nextWorkflowExecutionVersion: number;
  readonly predecessorStage: OrganizationVerificationWorkflowStage;
  readonly resultingStage: OrganizationVerificationWorkflowStage;
  readonly organizationId: LifecycleExecution["organizationId"];
  readonly recordId: LifecycleExecution["recordId"];
  readonly revisionId: LifecycleExecution["revisionId"];
  readonly attemptId: LifecycleExecution["attemptId"];
  readonly occurredAt: string;
  readonly provenanceReferences: readonly string[];
  readonly integrityReferences: readonly string[];
  readonly correlationId?: string;
  readonly causationId?: string;
  readonly reasonReference?: string;
  readonly artifacts: OrganizationVerificationWorkflowStepArtifacts;
  readonly existingStepRecords?: readonly OrganizationVerificationWorkflowStepRecord[];
}

export interface OrganizationVerificationWorkflowStepRecord {
  readonly workflowStepId: string;
  readonly workflowExecutionId: string;
  readonly predecessorWorkflowExecutionVersion: number;
  readonly nextWorkflowExecutionVersion: number;
  readonly predecessorStage: OrganizationVerificationWorkflowStage;
  readonly requestedStep: OrganizationVerificationWorkflowStep;
  readonly resultingStage: OrganizationVerificationWorkflowStage;
  readonly organizationId: LifecycleExecution["organizationId"];
  readonly recordId: LifecycleExecution["recordId"];
  readonly revisionId: LifecycleExecution["revisionId"];
  readonly attemptId: LifecycleExecution["attemptId"];
  readonly occurredAt: string;
  readonly inputArtifactFingerprints: readonly OrganizationVerificationWorkflowArtifactFingerprint[];
  readonly outputArtifactFingerprints: readonly OrganizationVerificationWorkflowArtifactFingerprint[];
  readonly provenanceReferences: readonly string[];
  readonly integrityReferences: readonly string[];
  readonly correlationId?: string;
  readonly causationId?: string;
  readonly reasonReference?: string;
  readonly workflowStepBindingFingerprint: string;
}

interface ValidatedArtifacts {
  readonly requestedStep: OrganizationVerificationWorkflowStep;
  readonly expectedPredecessorStage: OrganizationVerificationWorkflowStage;
  readonly expectedResultingStage: OrganizationVerificationWorkflowStage;
  readonly organizationId: LifecycleExecution["organizationId"];
  readonly recordId: LifecycleExecution["recordId"];
  readonly revisionId: LifecycleExecution["revisionId"];
  readonly attemptId: LifecycleExecution["attemptId"];
  readonly outputCreatedAt: string;
  readonly inputs: readonly OrganizationVerificationWorkflowArtifactFingerprint[];
  readonly outputs: readonly OrganizationVerificationWorkflowArtifactFingerprint[];
}

const workflowStepSeal = Symbol(
  "organization-verification-workflow-step-record",
);
const authenticWorkflowStepRecords = new WeakSet<object>();

function validIdentity(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    !["latest", "current", "head", "default"].includes(
      value.trim().toLowerCase(),
    )
  );
}

function normalizeReferences(
  values: readonly string[],
): readonly string[] | undefined {
  if (
    !Array.isArray(values) ||
    values.length === 0 ||
    values.some((value) => !validIdentity(value)) ||
    new Set(values).size !== values.length
  ) {
    return undefined;
  }
  return Object.freeze(
    [...values].sort((left, right) => left.localeCompare(right)),
  );
}

function artifact(
  artifactType: string,
  fingerprint: string,
): OrganizationVerificationWorkflowArtifactFingerprint {
  return Object.freeze({ artifactType, fingerprint });
}

function artifacts(
  values: readonly OrganizationVerificationWorkflowArtifactFingerprint[],
): readonly OrganizationVerificationWorkflowArtifactFingerprint[] {
  return Object.freeze(
    [...values].sort((left, right) =>
      left.artifactType.localeCompare(right.artifactType),
    ),
  );
}

function sameWorkflowIdentity(
  input: CreateOrganizationVerificationWorkflowStepRecordInput,
  validated: ValidatedArtifacts,
): boolean {
  return (
    input.organizationId === validated.organizationId &&
    input.recordId === validated.recordId &&
    input.revisionId === validated.revisionId &&
    input.attemptId === validated.attemptId
  );
}

function validateArtifacts(
  value: OrganizationVerificationWorkflowStepArtifacts,
): ValidatedArtifacts | undefined {
  switch (value.requestedStep) {
    case "attempt_transition": {
      const predecessor = value.predecessorLifecycleExecution;
      const transition = value.transitionExecution;
      if (
        !isOrganizationVerificationAttemptLifecycleExecution(predecessor) ||
        !isOrganizationVerificationAttemptLifecycleTransitionExecution(
          transition,
        ) ||
        transition.lifecycleExecutionId !== predecessor.lifecycleExecutionId ||
        transition.predecessorLifecycleExecutionVersion !==
          predecessor.lifecycleExecutionVersion ||
        transition.nextLifecycleExecutionVersion !==
          predecessor.lifecycleExecutionVersion + 1 ||
        transition.predecessorAttempt !== predecessor.attempt ||
        transition.nextLifecycleExecution.lifecycleExecutionId !==
          predecessor.lifecycleExecutionId ||
        transition.nextLifecycleExecution.attempt !==
          transition.resultingAttempt
      ) {
        return undefined;
      }
      const next = transition.nextLifecycleExecution;
      return {
        requestedStep: value.requestedStep,
        expectedPredecessorStage: "attempt_in_progress",
        expectedResultingStage:
          next.attempt.processState === "completed"
            ? "attempt_completed"
            : "attempt_in_progress",
        organizationId: next.organizationId,
        recordId: next.recordId,
        revisionId: next.revisionId,
        attemptId: next.attemptId,
        outputCreatedAt: transition.occurredAt,
        inputs: artifacts([
          artifact(
            "attempt_lifecycle_execution",
            predecessor.attemptLifecycleExecutionFingerprint,
          ),
        ]),
        outputs: artifacts([
          artifact(
            "attempt_lifecycle_transition_execution",
            transition.attemptLifecycleTransitionExecutionFingerprint,
          ),
          artifact(
            "attempt_lifecycle_execution",
            next.attemptLifecycleExecutionFingerprint,
          ),
        ]),
      };
    }
    case "bind_snapshot": {
      const lifecycle = value.lifecycleExecution;
      const snapshot = value.snapshot;
      if (
        !isOrganizationVerificationAttemptLifecycleExecution(lifecycle) ||
        !isOrganizationVerificationEvidenceSnapshot(snapshot) ||
        lifecycle.attempt.processState !== "completed" ||
        snapshot.organizationId !== lifecycle.organizationId ||
        snapshot.recordId !== lifecycle.recordId ||
        snapshot.revisionId !== lifecycle.revisionId ||
        snapshot.attemptBinding?.attemptId !== lifecycle.attemptId
      ) {
        return undefined;
      }
      return {
        requestedStep: value.requestedStep,
        expectedPredecessorStage: "attempt_completed",
        expectedResultingStage: "snapshot_bound",
        organizationId: lifecycle.organizationId,
        recordId: lifecycle.recordId,
        revisionId: lifecycle.revisionId,
        attemptId: lifecycle.attemptId,
        outputCreatedAt: snapshot.createdAt,
        inputs: artifacts([
          artifact(
            "attempt_lifecycle_execution",
            lifecycle.attemptLifecycleExecutionFingerprint,
          ),
        ]),
        outputs: artifacts([
          artifact("evidence_snapshot", snapshot.snapshotFingerprint),
        ]),
      };
    }
    case "bind_projection": {
      const snapshot = value.snapshot;
      const projection = value.projection;
      if (
        !isOrganizationVerificationEvidenceSnapshot(snapshot) ||
        !isOrganizationVerificationEvaluationProjection(projection) ||
        projection.identity.organizationId !== snapshot.organizationId ||
        projection.identity.recordId !== snapshot.recordId ||
        projection.identity.revisionId !== snapshot.revisionId ||
        projection.identity.attemptId !== snapshot.attemptBinding?.attemptId ||
        projection.source.evidenceSnapshotId !== snapshot.evidenceSnapshotId ||
        projection.source.evidenceSnapshotVersion !==
          snapshot.evidenceSnapshotVersion ||
        projection.source.snapshotFingerprint !== snapshot.snapshotFingerprint
      ) {
        return undefined;
      }
      if (projection.identity.attemptId === undefined) return undefined;
      return {
        requestedStep: value.requestedStep,
        expectedPredecessorStage: "snapshot_bound",
        expectedResultingStage: "projection_bound",
        organizationId: projection.identity.organizationId,
        recordId: projection.identity.recordId,
        revisionId: projection.identity.revisionId,
        attemptId: projection.identity.attemptId,
        outputCreatedAt: projection.projectedAt,
        inputs: artifacts([
          artifact("evidence_snapshot", snapshot.snapshotFingerprint),
        ]),
        outputs: artifacts([
          artifact(
            "evaluation_projection",
            projection.projectionFingerprint,
          ),
        ]),
      };
    }
    case "bind_evaluation_input": {
      const projection = value.projection;
      const evaluationInput = value.evaluationInput;
      const binding = evaluationInput.projectionBinding;
      if (
        !isOrganizationVerificationEvaluationProjection(projection) ||
        !isOrganizationVerificationPolicyEvaluationInput(evaluationInput) ||
        binding.evaluationProjectionId !== projection.evaluationProjectionId ||
        binding.evaluationProjectionVersion !==
          projection.evaluationProjectionVersion ||
        binding.projectionFingerprint !== projection.projectionFingerprint ||
        binding.sourceSnapshotId !== projection.source.evidenceSnapshotId ||
        binding.sourceSnapshotFingerprint !==
          projection.source.snapshotFingerprint ||
        binding.organizationId !== projection.identity.organizationId ||
        binding.recordId !== projection.identity.recordId ||
        binding.revisionId !== projection.identity.revisionId ||
        binding.attemptId !== projection.identity.attemptId
      ) {
        return undefined;
      }
      return {
        requestedStep: value.requestedStep,
        expectedPredecessorStage: "projection_bound",
        expectedResultingStage: "evaluation_input_bound",
        organizationId: binding.organizationId,
        recordId: binding.recordId,
        revisionId: binding.revisionId,
        attemptId: binding.attemptId,
        outputCreatedAt: evaluationInput.createdAt,
        inputs: artifacts([
          artifact(
            "evaluation_projection",
            projection.projectionFingerprint,
          ),
        ]),
        outputs: artifacts([
          artifact("policy_evaluation_input", evaluationInput.inputFingerprint),
        ]),
      };
    }
    case "complete_policy": {
      const evaluationInput = value.evaluationInput;
      const execution = value.policyExecution;
      const binding = evaluationInput.projectionBinding;
      if (
        !isOrganizationVerificationPolicyEvaluationInput(evaluationInput) ||
        !isOrganizationVerificationPolicyEvaluationExecution(execution) ||
        execution.policyEvaluationInputId !==
          evaluationInput.policyEvaluationInputId ||
        execution.policyEvaluationInputVersion !==
          evaluationInput.policyEvaluationInputVersion ||
        execution.policyEvaluationInputFingerprint !==
          evaluationInput.inputFingerprint ||
        execution.completion.organizationId !== binding.organizationId ||
        execution.completion.recordId !== binding.recordId ||
        execution.completion.revisionId !== binding.revisionId ||
        execution.completion.attemptId !== binding.attemptId ||
        String(execution.completion.snapshotId) !==
          String(binding.sourceSnapshotId) ||
        String(execution.completion.snapshotFingerprint) !==
          String(binding.sourceSnapshotFingerprint)
      ) {
        return undefined;
      }
      return {
        requestedStep: value.requestedStep,
        expectedPredecessorStage: "evaluation_input_bound",
        expectedResultingStage: "policy_completed",
        organizationId: binding.organizationId,
        recordId: binding.recordId,
        revisionId: binding.revisionId,
        attemptId: binding.attemptId,
        outputCreatedAt: execution.completedAt,
        inputs: artifacts([
          artifact("policy_evaluation_input", evaluationInput.inputFingerprint),
        ]),
        outputs: artifacts([
          artifact("policy_runtime_execution", execution.executionFingerprint),
        ]),
      };
    }
    case "complete_decision_trust_integration": {
      const policy = value.policyExecution;
      const integration = value.integrationExecution;
      const continuity = integration.inputBinding;
      if (
        !isOrganizationVerificationPolicyEvaluationExecution(policy) ||
        !isOrganizationVerificationDecisionTrustIntegrationExecution(
          integration,
        ) ||
        continuity.runtimeExecution !== policy ||
        continuity.runtimeExecutionFingerprint !== policy.executionFingerprint ||
        continuity.organizationId !== policy.completion.organizationId ||
        continuity.recordId !== policy.completion.recordId ||
        continuity.revisionId !== policy.completion.revisionId ||
        continuity.attemptId !== policy.completion.attemptId
      ) {
        return undefined;
      }
      return {
        requestedStep: value.requestedStep,
        expectedPredecessorStage: "policy_completed",
        expectedResultingStage: "completed",
        organizationId: continuity.organizationId,
        recordId: continuity.recordId,
        revisionId: continuity.revisionId,
        attemptId: continuity.attemptId,
        outputCreatedAt: integration.completedAt,
        inputs: artifacts([
          artifact("policy_runtime_execution", policy.executionFingerprint),
        ]),
        outputs: artifacts([
          artifact(
            "decision_trust_integration_execution",
            integration.executionFingerprint,
          ),
        ]),
      };
    }
  }
}

function sameStepSemantics(
  left: OrganizationVerificationWorkflowStepRecord,
  right: OrganizationVerificationWorkflowStepRecord,
): boolean {
  return (
    left.workflowStepId === right.workflowStepId &&
    left.workflowStepBindingFingerprint ===
      right.workflowStepBindingFingerprint
  );
}

export function isOrganizationVerificationWorkflowStepRecord(
  value: unknown,
): value is OrganizationVerificationWorkflowStepRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    authenticWorkflowStepRecords.has(value) &&
    Object.getOwnPropertyDescriptor(value, workflowStepSeal)?.value === true &&
    Object.isFrozen(value)
  );
}

export function createOrganizationVerificationWorkflowStepRecord(
  input: CreateOrganizationVerificationWorkflowStepRecordInput,
): OrganizationVerificationWorkflowContractResult<OrganizationVerificationWorkflowStepRecord> {
  if (
    !validIdentity(input.workflowStepId) ||
    !validIdentity(input.workflowExecutionId)
  ) {
    return workflowFailure("invalid_identity");
  }
  if (
    !Number.isSafeInteger(input.predecessorWorkflowExecutionVersion) ||
    input.predecessorWorkflowExecutionVersion < 1
  ) {
    return workflowFailure("stale_version");
  }
  if (
    input.nextWorkflowExecutionVersion !==
    input.predecessorWorkflowExecutionVersion + 1
  ) {
    return workflowFailure("skipped_version");
  }
  const authority = workflowAuthorityForStep(input.artifacts.requestedStep);
  const validated = validateArtifacts(input.artifacts);
  if (!authority || !validated) {
    return workflowFailure("unauthentic_artifact");
  }
  if (
    input.predecessorStage !== validated.expectedPredecessorStage ||
    input.resultingStage !== validated.expectedResultingStage ||
    !authority.predecessorStages.includes(input.predecessorStage) ||
    !authority.resultingStages.includes(input.resultingStage)
  ) {
    return workflowFailure("invalid_stage_progression");
  }
  if (!sameWorkflowIdentity(input, validated)) {
    return workflowFailure("continuity_mismatch");
  }
  if (
    !Number.isFinite(Date.parse(input.occurredAt)) ||
    Date.parse(input.occurredAt) < Date.parse(validated.outputCreatedAt)
  ) {
    return workflowFailure("chronology_mismatch");
  }
  const provenanceReferences = normalizeReferences(
    input.provenanceReferences,
  );
  const integrityReferences = normalizeReferences(input.integrityReferences);
  if (
    !provenanceReferences ||
    !integrityReferences ||
    (input.correlationId !== undefined &&
      !validIdentity(input.correlationId)) ||
    (input.causationId !== undefined &&
      !validIdentity(input.causationId)) ||
    (input.reasonReference !== undefined &&
      !validIdentity(input.reasonReference))
  ) {
    return workflowFailure("invalid_evidence");
  }

  const data = {
    workflowStepId: input.workflowStepId,
    workflowExecutionId: input.workflowExecutionId,
    predecessorWorkflowExecutionVersion:
      input.predecessorWorkflowExecutionVersion,
    nextWorkflowExecutionVersion: input.nextWorkflowExecutionVersion,
    predecessorStage: input.predecessorStage,
    requestedStep: validated.requestedStep,
    resultingStage: input.resultingStage,
    organizationId: input.organizationId,
    recordId: input.recordId,
    revisionId: input.revisionId,
    attemptId: input.attemptId,
    occurredAt: input.occurredAt,
    inputArtifactFingerprints: validated.inputs,
    outputArtifactFingerprints: validated.outputs,
    provenanceReferences,
    integrityReferences,
    ...(input.correlationId === undefined
      ? {}
      : { correlationId: input.correlationId }),
    ...(input.causationId === undefined
      ? {}
      : { causationId: input.causationId }),
    ...(input.reasonReference === undefined
      ? {}
      : { reasonReference: input.reasonReference }),
  };
  const fingerprint = fingerprintWorkflowValue({
    scope: "organization_verification_workflow_step_binding",
    ...data,
  });
  const candidate = {
    ...data,
    workflowStepBindingFingerprint: fingerprint,
  };
  Object.defineProperty(candidate, workflowStepSeal, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  authenticWorkflowStepRecords.add(candidate);
  const record = Object.freeze(candidate);

  for (const existing of input.existingStepRecords ?? []) {
    if (
      !isOrganizationVerificationWorkflowStepRecord(existing) ||
      existing.workflowExecutionId !== input.workflowExecutionId
    ) {
      return workflowFailure("workflow_conflict");
    }
    if (existing.workflowStepId === record.workflowStepId) {
      return sameStepSemantics(existing, record)
        ? workflowSuccess(existing)
        : workflowFailure("duplicate_step_conflict");
    }
    if (
      existing.predecessorWorkflowExecutionVersion ===
        record.predecessorWorkflowExecutionVersion
    ) {
      return workflowFailure("branch_conflict");
    }
  }
  return workflowSuccess(record);
}
