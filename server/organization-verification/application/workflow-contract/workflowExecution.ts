import {
  isOrganizationVerificationAttemptLifecycleExecution,
  type OrganizationVerificationAttemptLifecycleExecution,
} from "../attempt-lifecycle-contract/index.js";
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
  isOrganizationVerificationWorkflowStepRecord,
  type OrganizationVerificationWorkflowStepRecord,
} from "./workflowStepRecord.js";
import {
  ORGANIZATION_VERIFICATION_WORKFLOW_STAGES,
  isOrganizationVerificationWorkflowStage,
  type OrganizationVerificationWorkflowStage,
  type OrganizationVerificationWorkflowStep,
} from "./workflowStages.js";
import {
  hasExactDurableKeys,
  isDurableIdentity,
  isDurablePlainObject,
  isDurablePositiveVersion,
  isDurableStringArray,
  isDurableTimestamp,
} from "../../domain/durableRehydrationValidation.js";

type LifecycleExecution = OrganizationVerificationAttemptLifecycleExecution;

export interface CreateOrganizationVerificationWorkflowExecutionInput {
  readonly workflowExecutionId: string;
  readonly workflowExecutionVersion: number;
  readonly organizationId: LifecycleExecution["organizationId"];
  readonly recordId: LifecycleExecution["recordId"];
  readonly revisionId: LifecycleExecution["revisionId"];
  readonly attemptId: LifecycleExecution["attemptId"];
  readonly workflowStage: OrganizationVerificationWorkflowStage;
  readonly lifecycleExecution: LifecycleExecution;
  readonly evidenceSnapshot?: OrganizationVerificationEvidenceSnapshot;
  readonly evaluationProjection?: OrganizationVerificationEvaluationProjection;
  readonly policyEvaluationInput?: OrganizationVerificationPolicyEvaluationInput;
  readonly policyEvaluationExecution?: OrganizationVerificationPolicyEvaluationExecution;
  readonly decisionTrustIntegrationExecution?: OrganizationVerificationDecisionTrustIntegrationExecution;
  readonly stepRecords: readonly OrganizationVerificationWorkflowStepRecord[];
  readonly createdAt: string;
  readonly lastStepAt?: string;
  readonly provenanceReferences: readonly string[];
  readonly integrityReferences: readonly string[];
  readonly existingWorkflowExecution?: OrganizationVerificationWorkflowExecution;
}

export interface OrganizationVerificationWorkflowExecution {
  readonly workflowExecutionId: string;
  readonly workflowExecutionVersion: number;
  readonly organizationId: LifecycleExecution["organizationId"];
  readonly recordId: LifecycleExecution["recordId"];
  readonly revisionId: LifecycleExecution["revisionId"];
  readonly attemptId: LifecycleExecution["attemptId"];
  readonly workflowStage: OrganizationVerificationWorkflowStage;
  readonly lifecycleExecution: LifecycleExecution;
  readonly evidenceSnapshot?: OrganizationVerificationEvidenceSnapshot;
  readonly evaluationProjection?: OrganizationVerificationEvaluationProjection;
  readonly policyEvaluationInput?: OrganizationVerificationPolicyEvaluationInput;
  readonly policyEvaluationExecution?: OrganizationVerificationPolicyEvaluationExecution;
  readonly decisionTrustIntegrationExecution?: OrganizationVerificationDecisionTrustIntegrationExecution;
  readonly stepRecords: readonly OrganizationVerificationWorkflowStepRecord[];
  readonly createdAt: string;
  readonly lastStepAt?: string;
  readonly provenanceReferences: readonly string[];
  readonly integrityReferences: readonly string[];
  readonly workflowExecutionFingerprint: string;
}

const workflowExecutionSeal = Symbol(
  "organization-verification-workflow-execution",
);
const authenticWorkflowExecutions = new WeakSet<object>();

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

function fingerprintFromStep(
  records: readonly OrganizationVerificationWorkflowStepRecord[],
  step: OrganizationVerificationWorkflowStep,
  artifactType: string,
): string | undefined {
  const record = [...records]
    .reverse()
    .find((entry) => entry.requestedStep === step);
  return record?.outputArtifactFingerprints.find(
    (artifact) => artifact.artifactType === artifactType,
  )?.fingerprint;
}

function validateHistory(
  input: CreateOrganizationVerificationWorkflowExecutionInput,
): OrganizationVerificationWorkflowContractResult<true> {
  const records = input.stepRecords;
  if (input.workflowExecutionVersion !== records.length + 1) {
    return workflowFailure(
      input.workflowExecutionVersion <= records.length
        ? "stale_version"
        : "skipped_version",
    );
  }
  if (records.length === 0) {
    if (input.lastStepAt !== undefined) {
      return workflowFailure("chronology_mismatch");
    }
    return workflowSuccess(true);
  }
  if (
    input.lastStepAt === undefined ||
    input.lastStepAt !== records[records.length - 1]?.occurredAt
  ) {
    return workflowFailure("chronology_mismatch");
  }
  const stepIds = new Set<string>();
  let priorStage = records[0]?.predecessorStage;
  let priorAt = input.createdAt;
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (
      !record ||
      !isOrganizationVerificationWorkflowStepRecord(record) ||
      record.workflowExecutionId !== input.workflowExecutionId ||
      record.organizationId !== input.organizationId ||
      record.recordId !== input.recordId ||
      record.revisionId !== input.revisionId ||
      record.attemptId !== input.attemptId
    ) {
      return workflowFailure("continuity_mismatch");
    }
    if (
      stepIds.has(record.workflowStepId) ||
      record.predecessorWorkflowExecutionVersion !== index + 1 ||
      record.nextWorkflowExecutionVersion !== index + 2
    ) {
      return workflowFailure("branch_conflict");
    }
    if (
      record.predecessorStage !== priorStage ||
      !Number.isFinite(Date.parse(record.occurredAt)) ||
      Date.parse(record.occurredAt) < Date.parse(priorAt)
    ) {
      return workflowFailure("chronology_mismatch");
    }
    if (priorStage === "completed") {
      return workflowFailure("invalid_stage_progression");
    }
    stepIds.add(record.workflowStepId);
    priorStage = record.resultingStage;
    priorAt = record.occurredAt;
  }
  return priorStage === input.workflowStage
    ? workflowSuccess(true)
    : workflowFailure("invalid_stage_progression");
}

function validateArtifactChain(
  input: CreateOrganizationVerificationWorkflowExecutionInput,
): OrganizationVerificationWorkflowContractResult<OrganizationVerificationWorkflowStage> {
  const lifecycle = input.lifecycleExecution;
  if (
    !isOrganizationVerificationAttemptLifecycleExecution(lifecycle) ||
    lifecycle.organizationId !== input.organizationId ||
    lifecycle.recordId !== input.recordId ||
    lifecycle.revisionId !== input.revisionId ||
    lifecycle.attemptId !== input.attemptId
  ) {
    return workflowFailure("unauthentic_artifact");
  }
  const snapshot = input.evidenceSnapshot;
  const projection = input.evaluationProjection;
  const evaluationInput = input.policyEvaluationInput;
  const policy = input.policyEvaluationExecution;
  const integration = input.decisionTrustIntegrationExecution;
  if (
    (projection !== undefined && snapshot === undefined) ||
    (evaluationInput !== undefined && projection === undefined) ||
    (policy !== undefined && evaluationInput === undefined) ||
    (integration !== undefined && policy === undefined)
  ) {
    return workflowFailure("continuity_mismatch");
  }

  let stage: OrganizationVerificationWorkflowStage =
    lifecycle.attempt.processState === "completed"
      ? "attempt_completed"
      : "attempt_in_progress";
  if (snapshot !== undefined) {
    if (
      !isOrganizationVerificationEvidenceSnapshot(snapshot) ||
      lifecycle.attempt.processState !== "completed" ||
      snapshot.organizationId !== input.organizationId ||
      snapshot.recordId !== input.recordId ||
      snapshot.revisionId !== input.revisionId ||
      snapshot.attemptBinding?.attemptId !== input.attemptId
    ) {
      return workflowFailure("continuity_mismatch");
    }
    stage = "snapshot_bound";
  }
  if (projection !== undefined && snapshot !== undefined) {
    if (
      !isOrganizationVerificationEvaluationProjection(projection) ||
      projection.identity.organizationId !== input.organizationId ||
      projection.identity.recordId !== input.recordId ||
      projection.identity.revisionId !== input.revisionId ||
      projection.identity.attemptId !== input.attemptId ||
      projection.source.evidenceSnapshotId !== snapshot.evidenceSnapshotId ||
      projection.source.evidenceSnapshotVersion !==
        snapshot.evidenceSnapshotVersion ||
      projection.source.snapshotFingerprint !== snapshot.snapshotFingerprint
    ) {
      return workflowFailure("continuity_mismatch");
    }
    stage = "projection_bound";
  }
  if (evaluationInput !== undefined && projection !== undefined) {
    const binding = evaluationInput.projectionBinding;
    if (
      !isOrganizationVerificationPolicyEvaluationInput(evaluationInput) ||
      binding.evaluationProjectionId !== projection.evaluationProjectionId ||
      binding.evaluationProjectionVersion !==
        projection.evaluationProjectionVersion ||
      binding.projectionFingerprint !== projection.projectionFingerprint ||
      binding.sourceSnapshotId !== projection.source.evidenceSnapshotId ||
      binding.sourceSnapshotFingerprint !==
        projection.source.snapshotFingerprint ||
      binding.organizationId !== input.organizationId ||
      binding.recordId !== input.recordId ||
      binding.revisionId !== input.revisionId ||
      binding.attemptId !== input.attemptId
    ) {
      return workflowFailure("continuity_mismatch");
    }
    stage = "evaluation_input_bound";
  }
  if (policy !== undefined && evaluationInput !== undefined) {
    if (
      !isOrganizationVerificationPolicyEvaluationExecution(policy) ||
      policy.policyEvaluationInputId !==
        evaluationInput.policyEvaluationInputId ||
      policy.policyEvaluationInputVersion !==
        evaluationInput.policyEvaluationInputVersion ||
      policy.policyEvaluationInputFingerprint !==
        evaluationInput.inputFingerprint ||
      policy.completion.organizationId !== input.organizationId ||
      policy.completion.recordId !== input.recordId ||
      policy.completion.revisionId !== input.revisionId ||
      policy.completion.attemptId !== input.attemptId
    ) {
      return workflowFailure("continuity_mismatch");
    }
    stage = "policy_completed";
  }
  if (integration !== undefined && policy !== undefined) {
    if (
      !isOrganizationVerificationDecisionTrustIntegrationExecution(
        integration,
      ) ||
      integration.inputBinding.runtimeExecution !== policy ||
      integration.inputBinding.runtimeExecutionFingerprint !==
        policy.executionFingerprint ||
      integration.inputBinding.organizationId !== input.organizationId ||
      integration.inputBinding.recordId !== input.recordId ||
      integration.inputBinding.revisionId !== input.revisionId ||
      integration.inputBinding.attemptId !== input.attemptId
    ) {
      return workflowFailure("continuity_mismatch");
    }
    stage = "completed";
  }
  return workflowSuccess(stage);
}

function validateBoundFingerprints(
  input: CreateOrganizationVerificationWorkflowExecutionInput,
): boolean {
  const records = input.stepRecords;
  const lastAttemptFingerprint = fingerprintFromStep(
    records,
    "attempt_transition",
    "attempt_lifecycle_execution",
  );
  if (
    lastAttemptFingerprint !== undefined &&
    lastAttemptFingerprint !==
      input.lifecycleExecution.attemptLifecycleExecutionFingerprint
  ) {
    return false;
  }
  const bindings: ReadonlyArray<
    readonly [
      OrganizationVerificationWorkflowStep,
      string,
      string | undefined,
    ]
  > = [
    [
      "bind_snapshot",
      "evidence_snapshot",
      input.evidenceSnapshot?.snapshotFingerprint,
    ],
    [
      "bind_projection",
      "evaluation_projection",
      input.evaluationProjection?.projectionFingerprint,
    ],
    [
      "bind_evaluation_input",
      "policy_evaluation_input",
      input.policyEvaluationInput?.inputFingerprint,
    ],
    [
      "complete_policy",
      "policy_runtime_execution",
      input.policyEvaluationExecution?.executionFingerprint,
    ],
    [
      "complete_decision_trust_integration",
      "decision_trust_integration_execution",
      input.decisionTrustIntegrationExecution?.executionFingerprint,
    ],
  ];
  return bindings.every(([step, artifactType, expected]) => {
    const recorded = fingerprintFromStep(records, step, artifactType);
    return expected === undefined
      ? recorded === undefined
      : recorded === expected;
  });
}

export function isOrganizationVerificationWorkflowExecution(
  value: unknown,
): value is OrganizationVerificationWorkflowExecution {
  return (
    typeof value === "object" &&
    value !== null &&
    authenticWorkflowExecutions.has(value) &&
    Object.getOwnPropertyDescriptor(value, workflowExecutionSeal)?.value ===
      true &&
    Object.isFrozen(value)
  );
}

export function createOrganizationVerificationWorkflowExecution(
  input: CreateOrganizationVerificationWorkflowExecutionInput,
): OrganizationVerificationWorkflowContractResult<OrganizationVerificationWorkflowExecution> {
  if (
    !validIdentity(input.workflowExecutionId) ||
    !isOrganizationVerificationWorkflowStage(input.workflowStage)
  ) {
    return workflowFailure("invalid_identity");
  }
  if (
    !Number.isSafeInteger(input.workflowExecutionVersion) ||
    input.workflowExecutionVersion < 1
  ) {
    return workflowFailure("invalid_version");
  }
  if (!Number.isFinite(Date.parse(input.createdAt))) {
    return workflowFailure("invalid_timestamp");
  }
  const lifecycleAvailableAt =
    input.lifecycleExecution.lastTransitionAt ??
    input.lifecycleExecution.createdAt;
  if (
    !Number.isFinite(Date.parse(lifecycleAvailableAt)) ||
    Date.parse(input.createdAt) <
      Date.parse(input.lifecycleExecution.createdAt) ||
    (input.stepRecords.length === 0 &&
      Date.parse(input.createdAt) < Date.parse(lifecycleAvailableAt))
  ) {
    return workflowFailure("chronology_mismatch");
  }
  const provenanceReferences = normalizeReferences(
    input.provenanceReferences,
  );
  const integrityReferences = normalizeReferences(input.integrityReferences);
  if (!provenanceReferences || !integrityReferences) {
    return workflowFailure("invalid_evidence");
  }
  const artifactChain = validateArtifactChain(input);
  if (!artifactChain.ok) return artifactChain;
  if (artifactChain.value !== input.workflowStage) {
    return workflowFailure("invalid_stage");
  }
  const history = validateHistory(input);
  if (!history.ok) return history;
  if (!validateBoundFingerprints(input)) {
    return workflowFailure("artifact_fingerprint_mismatch");
  }
  if (
    input.stepRecords.length === 0 &&
    !["attempt_in_progress", "attempt_completed"].includes(
      input.workflowStage,
    )
  ) {
    return workflowFailure("invalid_stage_progression");
  }

  const stepRecords = Object.freeze([...input.stepRecords]);
  const data = {
    workflowExecutionId: input.workflowExecutionId,
    workflowExecutionVersion: input.workflowExecutionVersion,
    organizationId: input.organizationId,
    recordId: input.recordId,
    revisionId: input.revisionId,
    attemptId: input.attemptId,
    workflowStage: input.workflowStage,
    lifecycleExecution: input.lifecycleExecution,
    ...(input.evidenceSnapshot === undefined
      ? {}
      : { evidenceSnapshot: input.evidenceSnapshot }),
    ...(input.evaluationProjection === undefined
      ? {}
      : { evaluationProjection: input.evaluationProjection }),
    ...(input.policyEvaluationInput === undefined
      ? {}
      : { policyEvaluationInput: input.policyEvaluationInput }),
    ...(input.policyEvaluationExecution === undefined
      ? {}
      : { policyEvaluationExecution: input.policyEvaluationExecution }),
    ...(input.decisionTrustIntegrationExecution === undefined
      ? {}
      : {
          decisionTrustIntegrationExecution:
            input.decisionTrustIntegrationExecution,
        }),
    stepRecords,
    createdAt: input.createdAt,
    ...(input.lastStepAt === undefined
      ? {}
      : { lastStepAt: input.lastStepAt }),
    provenanceReferences,
    integrityReferences,
  };
  const fingerprint = fingerprintWorkflowValue({
    scope: "organization_verification_workflow_execution",
    workflowExecutionId: data.workflowExecutionId,
    workflowExecutionVersion: data.workflowExecutionVersion,
    organizationId: data.organizationId,
    recordId: data.recordId,
    revisionId: data.revisionId,
    attemptId: data.attemptId,
    workflowStage: data.workflowStage,
    lifecycleExecutionFingerprint:
      data.lifecycleExecution.attemptLifecycleExecutionFingerprint,
    ...(input.evidenceSnapshot === undefined
      ? {}
      : {
          evidenceSnapshotFingerprint:
            input.evidenceSnapshot.snapshotFingerprint,
        }),
    ...(input.evaluationProjection === undefined
      ? {}
      : {
          evaluationProjectionFingerprint:
            input.evaluationProjection.projectionFingerprint,
        }),
    ...(input.policyEvaluationInput === undefined
      ? {}
      : {
          policyEvaluationInputFingerprint:
            input.policyEvaluationInput.inputFingerprint,
        }),
    ...(input.policyEvaluationExecution === undefined
      ? {}
      : {
          policyEvaluationExecutionFingerprint:
            input.policyEvaluationExecution.executionFingerprint,
        }),
    ...(input.decisionTrustIntegrationExecution === undefined
      ? {}
      : {
          decisionTrustIntegrationExecutionFingerprint:
            input.decisionTrustIntegrationExecution.executionFingerprint,
        }),
    stepFingerprints: stepRecords.map(
      (record) => record.workflowStepBindingFingerprint,
    ),
    createdAt: data.createdAt,
    ...(input.lastStepAt === undefined
      ? {}
      : { lastStepAt: input.lastStepAt }),
    provenanceReferences,
    integrityReferences,
  });
  const candidate = {
    ...data,
    workflowExecutionFingerprint: fingerprint,
  };
  Object.defineProperty(candidate, workflowExecutionSeal, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  authenticWorkflowExecutions.add(candidate);
  const execution = Object.freeze(candidate);

  if (input.existingWorkflowExecution !== undefined) {
    const existing = input.existingWorkflowExecution;
    if (
      !isOrganizationVerificationWorkflowExecution(existing) ||
      existing.workflowExecutionId !== execution.workflowExecutionId
    ) {
      return workflowFailure("workflow_conflict");
    }
    return existing.workflowExecutionFingerprint ===
      execution.workflowExecutionFingerprint
      ? workflowSuccess(existing)
      : workflowFailure("workflow_conflict");
  }
  return workflowSuccess(execution);
}

function isDurableWorkflowGenesis(value: unknown): value is OrganizationVerificationWorkflowExecution {
  if (!isDurablePlainObject(value)) return false;
  const required = [
    "workflowExecutionId", "workflowExecutionVersion", "organizationId", "recordId", "revisionId",
    "attemptId", "workflowStage", "lifecycleExecution", "stepRecords", "createdAt",
    "provenanceReferences", "integrityReferences", "workflowExecutionFingerprint",
  ];
  if (!hasExactDurableKeys(value, required, ["lastStepAt"])) return false;
  return ["workflowExecutionId", "organizationId", "recordId", "revisionId", "attemptId", "workflowExecutionFingerprint"]
    .every((key) => isDurableIdentity(value[key])) && isDurablePositiveVersion(value.workflowExecutionVersion) &&
    ORGANIZATION_VERIFICATION_WORKFLOW_STAGES.some((stage) => stage === value.workflowStage) &&
    Array.isArray(value.stepRecords) && value.stepRecords.length === 0 && isDurableTimestamp(value.createdAt) &&
    (value.lastStepAt === undefined || isDurableTimestamp(value.lastStepAt)) &&
    isDurableStringArray(value.provenanceReferences) && isDurableStringArray(value.integrityReferences);
}

export function rehydrateOrganizationVerificationWorkflowGenesis(
  durableData: unknown,
  lifecycleExecution: OrganizationVerificationAttemptLifecycleExecution,
): OrganizationVerificationWorkflowContractResult<OrganizationVerificationWorkflowExecution> {
  if (!isDurableWorkflowGenesis(durableData)) return workflowFailure("invalid_evidence");
  const result = createOrganizationVerificationWorkflowExecution({
    ...durableData,
    lifecycleExecution,
    stepRecords: Object.freeze([]),
  });
  if (!result.ok) return result;
  return result.value.workflowExecutionFingerprint === durableData.workflowExecutionFingerprint
    ? result
    : workflowFailure("artifact_fingerprint_mismatch");
}
