import {
  createOrganizationVerificationAttemptLifecycleExecution,
  isOrganizationVerificationAttemptLifecycleExecution,
  type OrganizationVerificationAttemptLifecycleExecution,
} from "../attempt-lifecycle-contract/index.js";
import {
  createOrganizationVerificationEvidenceStream,
  isOrganizationVerificationStoredEvidence,
  sameOrganizationVerificationWorkflowStreamIdentity,
  type OrganizationVerificationDurableEvidenceKind,
  type OrganizationVerificationStoredEvidence,
} from "../persistence-contract/index.js";
import {
  createOrganizationVerificationWorkflowExecution,
  isOrganizationVerificationWorkflowExecution,
  isOrganizationVerificationWorkflowStepRecord,
  type OrganizationVerificationWorkflowExecution,
  type OrganizationVerificationWorkflowStage,
  type OrganizationVerificationWorkflowStep,
  type OrganizationVerificationWorkflowStepRecord,
} from "../workflow-contract/index.js";
import {
  createReplayEvidenceBindingInternal,
  createReplayExecutionInternal,
  isOrganizationVerificationReplayRequest,
  replayCompletedInternal,
  replayRejectedInternal,
  type OrganizationVerificationReplayDiagnostics,
  type OrganizationVerificationReplayEvidenceBinding,
  type OrganizationVerificationReplayEvidenceKindCounts,
  type OrganizationVerificationReplayFailureCode,
  type OrganizationVerificationReplayFailureDiagnostic,
  type OrganizationVerificationReplayRequest,
  type OrganizationVerificationReplayResult,
  type ReplayAuthorityEvidence,
} from "./replayContracts.js";

type SnapshotArtifact = Extract<
  OrganizationVerificationStoredEvidence,
  { evidenceKind: "evidence_snapshot" }
>["artifact"];
type ProjectionArtifact = Extract<
  OrganizationVerificationStoredEvidence,
  { evidenceKind: "evaluation_projection" }
>["artifact"];
type EvaluationInputArtifact = Extract<
  OrganizationVerificationStoredEvidence,
  { evidenceKind: "policy_evaluation_input" }
>["artifact"];
type PolicyExecutionArtifact = Extract<
  OrganizationVerificationStoredEvidence,
  { evidenceKind: "policy_runtime_execution" }
>["artifact"];
type IntegrationExecutionArtifact = Extract<
  OrganizationVerificationStoredEvidence,
  { evidenceKind: "decision_trust_integration_execution" }
>["artifact"];

interface ReplayStagePlan {
  readonly workflowStep: OrganizationVerificationWorkflowStep;
  readonly authorityEvidenceKind: ReplayAuthorityEvidence["evidenceKind"];
}

const stagePlans: Readonly<
  Partial<Record<OrganizationVerificationWorkflowStage, ReplayStagePlan>>
> = Object.freeze({
  attempt_in_progress: Object.freeze({
    workflowStep: "attempt_transition",
    authorityEvidenceKind: "attempt_lifecycle_execution",
  }),
  attempt_completed: Object.freeze({
    workflowStep: "bind_snapshot",
    authorityEvidenceKind: "evidence_snapshot",
  }),
  snapshot_bound: Object.freeze({
    workflowStep: "bind_projection",
    authorityEvidenceKind: "evaluation_projection",
  }),
  projection_bound: Object.freeze({
    workflowStep: "bind_evaluation_input",
    authorityEvidenceKind: "policy_evaluation_input",
  }),
  evaluation_input_bound: Object.freeze({
    workflowStep: "complete_policy",
    authorityEvidenceKind: "policy_runtime_execution",
  }),
  policy_completed: Object.freeze({
    workflowStep: "complete_decision_trust_integration",
    authorityEvidenceKind: "decision_trust_integration_execution",
  }),
});

function reject(
  code: OrganizationVerificationReplayFailureCode,
  diagnostic: OrganizationVerificationReplayFailureDiagnostic = {},
): OrganizationVerificationReplayResult {
  return replayRejectedInternal(code, diagnostic);
}

function sameIdentity(
  workflow: OrganizationVerificationWorkflowExecution,
  evidence: OrganizationVerificationStoredEvidence,
): boolean {
  return (
    evidence.streamIdentity.workflowExecutionId ===
      workflow.workflowExecutionId &&
    evidence.streamIdentity.organizationId === workflow.organizationId &&
    evidence.streamIdentity.recordId === workflow.recordId &&
    evidence.streamIdentity.revisionId === workflow.revisionId &&
    evidence.streamIdentity.attemptId === workflow.attemptId
  );
}

function expectedInputFingerprint(
  step: OrganizationVerificationWorkflowStep,
  lifecycle: OrganizationVerificationAttemptLifecycleExecution,
  snapshot: SnapshotArtifact | undefined,
  projection: ProjectionArtifact | undefined,
  evaluationInput: EvaluationInputArtifact | undefined,
  policy: PolicyExecutionArtifact | undefined,
): Readonly<{ artifactType: string; fingerprint: string }> | undefined {
  switch (step) {
    case "attempt_transition":
    case "bind_snapshot":
      return Object.freeze({
        artifactType: "attempt_lifecycle_execution",
        fingerprint: lifecycle.attemptLifecycleExecutionFingerprint,
      });
    case "bind_projection":
      return snapshot === undefined
        ? undefined
        : Object.freeze({
            artifactType: "evidence_snapshot",
            fingerprint: snapshot.snapshotFingerprint,
          });
    case "bind_evaluation_input":
      return projection === undefined
        ? undefined
        : Object.freeze({
            artifactType: "evaluation_projection",
            fingerprint: projection.projectionFingerprint,
          });
    case "complete_policy":
      return evaluationInput === undefined
        ? undefined
        : Object.freeze({
            artifactType: "policy_evaluation_input",
            fingerprint: evaluationInput.inputFingerprint,
          });
    case "complete_decision_trust_integration":
      return policy === undefined
        ? undefined
        : Object.freeze({
            artifactType: "policy_runtime_execution",
            fingerprint: policy.executionFingerprint,
          });
  }
}

function exactArtifactFingerprint(
  values: readonly Readonly<{
    artifactType: string;
    fingerprint: string;
  }>[],
  expected: Readonly<{ artifactType: string; fingerprint: string }>,
): boolean {
  const matches = values.filter(
    (value) => value.artifactType === expected.artifactType,
  );
  return (
    matches.length === 1 &&
    matches[0]?.fingerprint === expected.fingerprint
  );
}

function validateLifecycleSuccessor(
  predecessor: OrganizationVerificationAttemptLifecycleExecution,
  successor: OrganizationVerificationAttemptLifecycleExecution,
  persistencePosition: number,
):
  | Readonly<{ ok: true; value: OrganizationVerificationAttemptLifecycleExecution }>
  | Readonly<{
      ok: false;
      code: OrganizationVerificationReplayFailureCode;
      diagnostic: OrganizationVerificationReplayFailureDiagnostic;
    }> {
  const diagnostic = Object.freeze({ persistencePosition });
  if (
    !isOrganizationVerificationAttemptLifecycleExecution(predecessor) ||
    !isOrganizationVerificationAttemptLifecycleExecution(successor)
  ) {
    return Object.freeze({
      ok: false,
      code: "replay_lifecycle_identity_conflict",
      diagnostic,
    });
  }
  if (
    successor.lifecycleExecutionId !== predecessor.lifecycleExecutionId ||
    successor.organizationId !== predecessor.organizationId ||
    successor.recordId !== predecessor.recordId ||
    successor.revisionId !== predecessor.revisionId ||
    successor.attemptId !== predecessor.attemptId ||
    successor.attemptSequence !== predecessor.attemptSequence
  ) {
    return Object.freeze({
      ok: false,
      code: "replay_lifecycle_identity_conflict",
      diagnostic,
    });
  }
  if (
    successor.lifecycleExecutionVersion !==
      predecessor.lifecycleExecutionVersion + 1
  ) {
    return Object.freeze({
      ok: false,
      code: "replay_lifecycle_version_conflict",
      diagnostic,
    });
  }
  if (
    successor.createdAt !== predecessor.createdAt ||
    successor.transitionRecords.length !==
      predecessor.transitionRecords.length + 1
  ) {
    return Object.freeze({
      ok: false,
      code: "replay_competing_history",
      diagnostic,
    });
  }
  for (
    let index = 0;
    index < predecessor.transitionRecords.length;
    index += 1
  ) {
    if (
      predecessor.transitionRecords[index]
        ?.attemptLifecycleTransitionBindingFingerprint !==
      successor.transitionRecords[index]
        ?.attemptLifecycleTransitionBindingFingerprint
    ) {
      return Object.freeze({
        ok: false,
        code: "replay_competing_history",
        diagnostic,
      });
    }
  }
  const transition = successor.transitionRecords.at(-1);
  if (
    transition === undefined ||
    transition.predecessorLifecycleExecutionVersion !==
      predecessor.lifecycleExecutionVersion ||
    transition.nextLifecycleExecutionVersion !==
      successor.lifecycleExecutionVersion ||
    transition.predecessorAttemptState !==
      predecessor.attempt.processState ||
    transition.resultingAttemptState !== successor.attempt.processState
  ) {
    return Object.freeze({
      ok: false,
      code: "replay_lifecycle_version_conflict",
      diagnostic,
    });
  }
  const predecessorAt =
    predecessor.lastTransitionAt ?? predecessor.createdAt;
  if (
    successor.lastTransitionAt !== transition.occurredAt ||
    Date.parse(transition.occurredAt) < Date.parse(predecessorAt)
  ) {
    return Object.freeze({
      ok: false,
      code: "replay_chronology_conflict",
      diagnostic,
    });
  }

  const reconstructed =
    createOrganizationVerificationAttemptLifecycleExecution({
      lifecycleExecutionId: successor.lifecycleExecutionId,
      lifecycleExecutionVersion: successor.lifecycleExecutionVersion,
      organizationId: successor.organizationId,
      recordId: successor.recordId,
      revisionId: successor.revisionId,
      attemptId: successor.attemptId,
      attemptSequence: successor.attemptSequence,
      record: successor.record,
      revision: successor.revision,
      attempt: successor.attempt,
      transitionRecords: successor.transitionRecords,
      createdAt: successor.createdAt,
      ...(successor.lastTransitionAt === undefined
        ? {}
        : { lastTransitionAt: successor.lastTransitionAt }),
      provenanceReferences: successor.provenanceReferences,
      integrityReferences: successor.integrityReferences,
    });
  if (
    !reconstructed.ok ||
    reconstructed.value.attemptLifecycleExecutionFingerprint !==
      successor.attemptLifecycleExecutionFingerprint
  ) {
    return Object.freeze({
      ok: false,
      code: "replay_reconstructed_integrity_failure",
      diagnostic: Object.freeze({
        persistencePosition,
        expectedFingerprint:
          successor.attemptLifecycleExecutionFingerprint,
        ...(!reconstructed.ok
          ? {}
          : {
              actualFingerprint:
                reconstructed.value
                  .attemptLifecycleExecutionFingerprint,
            }),
      }),
    });
  }
  return Object.freeze({ ok: true, value: reconstructed.value });
}

function workflowFailureCode(
  code: string,
): OrganizationVerificationReplayFailureCode {
  if (code === "stale_version" || code === "skipped_version") {
    return "replay_workflow_version_conflict";
  }
  if (code === "invalid_stage" || code === "invalid_stage_progression") {
    return "replay_stage_mismatch";
  }
  if (code === "artifact_fingerprint_mismatch") {
    return "replay_authority_fingerprint_mismatch";
  }
  if (code === "chronology_mismatch" || code === "invalid_timestamp") {
    return "replay_chronology_conflict";
  }
  if (
    code === "branch_conflict" ||
    code === "duplicate_step_conflict" ||
    code === "workflow_conflict"
  ) {
    return "replay_competing_history";
  }
  return "replay_reconstructed_integrity_failure";
}

function evidenceKindCounts(
  entries: readonly OrganizationVerificationStoredEvidence[],
): OrganizationVerificationReplayEvidenceKindCounts {
  const counts: Record<OrganizationVerificationDurableEvidenceKind, number> = {
    workflow_genesis: 0,
    attempt_lifecycle_execution: 0,
    evidence_snapshot: 0,
    evaluation_projection: 0,
    policy_evaluation_input: 0,
    policy_runtime_execution: 0,
    decision_trust_integration_execution: 0,
    workflow_step_record: 0,
  };
  for (const entry of entries) {
    counts[entry.evidenceKind] += 1;
  }
  return Object.freeze(counts);
}

export function replayOrganizationVerificationWorkflow(
  request: OrganizationVerificationReplayRequest,
): OrganizationVerificationReplayResult {
  if (!isOrganizationVerificationReplayRequest(request)) {
    return reject("replay_unauthentic_stream");
  }
  const source = request.sourceEvidenceStream;
  const verifiedStream = createOrganizationVerificationEvidenceStream({
    streamIdentity: source.streamIdentity,
    entries: source.entries,
  });
  if (
    !verifiedStream.ok ||
    verifiedStream.value.evidenceStreamFingerprint !==
      source.evidenceStreamFingerprint ||
    verifiedStream.value.streamVersion !== source.streamVersion
  ) {
    return reject("replay_stream_integrity_failure");
  }

  const genesisEntries = source.entries.filter(
    (entry) => entry.evidenceKind === "workflow_genesis",
  );
  if (genesisEntries.length === 0) {
    return reject("replay_missing_genesis");
  }
  if (genesisEntries.length > 1) {
    return reject("replay_duplicate_genesis");
  }
  const genesis = source.entries[0];
  if (
    genesis === undefined ||
    genesis.evidenceKind !== "workflow_genesis" ||
    genesis.streamPosition !== 1 ||
    genesis.predecessorEvidenceEntryId !== undefined ||
    !isOrganizationVerificationStoredEvidence(genesis) ||
    !isOrganizationVerificationWorkflowExecution(genesis.artifact) ||
    !sameOrganizationVerificationWorkflowStreamIdentity(
      source.streamIdentity,
      genesis.streamIdentity,
    ) ||
    genesis.artifact.workflowExecutionVersion !== 1 ||
    genesis.artifact.stepRecords.length !== 0 ||
    genesis.artifact.workflowExecutionFingerprint !==
      genesis.artifactFingerprint ||
    !sameIdentity(genesis.artifact, genesis)
  ) {
    return reject("replay_invalid_genesis", {
      persistencePosition: genesis?.streamPosition,
    });
  }

  let currentWorkflow = genesis.artifact;
  let currentLifecycle = genesis.artifact.lifecycleExecution;
  let snapshot = genesis.artifact.evidenceSnapshot;
  let projection = genesis.artifact.evaluationProjection;
  let evaluationInput = genesis.artifact.policyEvaluationInput;
  let policy = genesis.artifact.policyEvaluationExecution;
  let integration =
    genesis.artifact.decisionTrustIntegrationExecution;
  const bindings: OrganizationVerificationReplayEvidenceBinding[] = [];
  const stepRecords: OrganizationVerificationWorkflowStepRecord[] = [];

  for (let index = 1; index < source.entries.length; index += 2) {
    const authority = source.entries[index];
    const stepEvidence = source.entries[index + 1];
    if (currentWorkflow.workflowStage === "completed") {
      return reject("replay_evidence_after_completion", {
        persistencePosition: authority?.streamPosition,
      });
    }
    if (authority === undefined || stepEvidence === undefined) {
      return reject("replay_incomplete_step_unit", {
        persistencePosition: authority?.streamPosition ?? index + 1,
      });
    }
    if (
      authority.evidenceKind === "workflow_genesis" ||
      authority.evidenceKind === "workflow_step_record"
    ) {
      return reject("replay_unexpected_evidence_kind", {
        persistencePosition: authority.streamPosition,
        actualEvidenceKind: authority.evidenceKind,
      });
    }
    if (stepEvidence.evidenceKind !== "workflow_step_record") {
      return reject("replay_incomplete_step_unit", {
        persistencePosition: stepEvidence.streamPosition,
        expectedEvidenceKind: "workflow_step_record",
        actualEvidenceKind: stepEvidence.evidenceKind,
      });
    }
    const stepRecord = stepEvidence.artifact;
    if (!isOrganizationVerificationWorkflowStepRecord(stepRecord)) {
      return reject("replay_step_record_mismatch", {
        persistencePosition: stepEvidence.streamPosition,
      });
    }
    const plan = stagePlans[currentWorkflow.workflowStage];
    if (plan === undefined) {
      return reject("replay_stage_mismatch", {
        persistencePosition: authority.streamPosition,
        actualWorkflowStage: currentWorkflow.workflowStage,
      });
    }
    if (
      stepRecord.requestedStep !== plan.workflowStep ||
      stepRecord.predecessorStage !== currentWorkflow.workflowStage
    ) {
      return reject("replay_stage_mismatch", {
        persistencePosition: stepEvidence.streamPosition,
        expectedWorkflowStage: currentWorkflow.workflowStage,
        actualWorkflowStage: stepRecord.predecessorStage,
      });
    }
    if (authority.evidenceKind !== plan.authorityEvidenceKind) {
      return reject("replay_authority_result_mismatch", {
        persistencePosition: authority.streamPosition,
        expectedEvidenceKind: plan.authorityEvidenceKind,
        actualEvidenceKind: authority.evidenceKind,
      });
    }
    if (
      !sameIdentity(currentWorkflow, authority) ||
      !sameIdentity(currentWorkflow, stepEvidence) ||
      stepRecord.workflowExecutionId !==
        currentWorkflow.workflowExecutionId ||
      stepRecord.organizationId !== currentWorkflow.organizationId ||
      stepRecord.recordId !== currentWorkflow.recordId ||
      stepRecord.revisionId !== currentWorkflow.revisionId ||
      stepRecord.attemptId !== currentWorkflow.attemptId
    ) {
      return reject("replay_step_record_mismatch", {
        persistencePosition: stepEvidence.streamPosition,
        safeIdentityReference: stepRecord.workflowStepId,
      });
    }
    if (
      stepRecord.predecessorWorkflowExecutionVersion !==
        currentWorkflow.workflowExecutionVersion ||
      stepRecord.nextWorkflowExecutionVersion !==
        currentWorkflow.workflowExecutionVersion + 1
    ) {
      return reject("replay_workflow_version_conflict", {
        persistencePosition: stepEvidence.streamPosition,
        expectedWorkflowVersion:
          currentWorkflow.workflowExecutionVersion + 1,
        actualWorkflowVersion:
          stepRecord.nextWorkflowExecutionVersion,
      });
    }
    if (
      authority.predecessorEvidenceEntryId !==
        source.entries[index - 1]?.evidenceEntryId ||
      stepEvidence.predecessorEvidenceEntryId !==
        authority.evidenceEntryId
    ) {
      return reject("replay_predecessor_conflict", {
        persistencePosition: authority.streamPosition,
      });
    }
    if (
      Date.parse(stepRecord.occurredAt) <
        Date.parse(authority.artifactOccurredAt) ||
      Date.parse(authority.artifactOccurredAt) <
        Date.parse(
          currentWorkflow.lastStepAt ?? currentWorkflow.createdAt,
        )
    ) {
      return reject("replay_chronology_conflict", {
        persistencePosition: authority.streamPosition,
      });
    }

    const expectedInput = expectedInputFingerprint(
      plan.workflowStep,
      currentLifecycle,
      snapshot,
      projection,
      evaluationInput,
      policy,
    );
    if (
      expectedInput === undefined ||
      !exactArtifactFingerprint(
        stepRecord.inputArtifactFingerprints,
        expectedInput,
      )
    ) {
      return reject("replay_authority_fingerprint_mismatch", {
        persistencePosition: stepEvidence.streamPosition,
        expectedFingerprint: expectedInput?.fingerprint,
      });
    }
    const expectedOutput = Object.freeze({
      artifactType: authority.evidenceKind,
      fingerprint: authority.artifactFingerprint,
    });
    if (
      !exactArtifactFingerprint(
        stepRecord.outputArtifactFingerprints,
        expectedOutput,
      )
    ) {
      return reject("replay_authority_fingerprint_mismatch", {
        persistencePosition: stepEvidence.streamPosition,
        expectedFingerprint: authority.artifactFingerprint,
      });
    }

    switch (authority.evidenceKind) {
      case "attempt_lifecycle_execution": {
        const lifecycle = validateLifecycleSuccessor(
          currentLifecycle,
          authority.artifact,
          authority.streamPosition,
        );
        if (!lifecycle.ok) {
          return reject(lifecycle.code, lifecycle.diagnostic);
        }
        currentLifecycle = lifecycle.value;
        break;
      }
      case "evidence_snapshot":
        snapshot = authority.artifact;
        break;
      case "evaluation_projection":
        projection = authority.artifact;
        break;
      case "policy_evaluation_input":
        evaluationInput = authority.artifact;
        break;
      case "policy_runtime_execution":
        policy = authority.artifact;
        break;
      case "decision_trust_integration_execution":
        integration = authority.artifact;
        break;
    }

    const nextStepRecords = Object.freeze([
      ...stepRecords,
      stepRecord,
    ]);
    const reconstructed = createOrganizationVerificationWorkflowExecution({
      workflowExecutionId: currentWorkflow.workflowExecutionId,
      workflowExecutionVersion:
        stepRecord.nextWorkflowExecutionVersion,
      organizationId: currentWorkflow.organizationId,
      recordId: currentWorkflow.recordId,
      revisionId: currentWorkflow.revisionId,
      attemptId: currentWorkflow.attemptId,
      workflowStage: stepRecord.resultingStage,
      lifecycleExecution: currentLifecycle,
      ...(snapshot === undefined ? {} : { evidenceSnapshot: snapshot }),
      ...(projection === undefined
        ? {}
        : { evaluationProjection: projection }),
      ...(evaluationInput === undefined
        ? {}
        : { policyEvaluationInput: evaluationInput }),
      ...(policy === undefined
        ? {}
        : { policyEvaluationExecution: policy }),
      ...(integration === undefined
        ? {}
        : { decisionTrustIntegrationExecution: integration }),
      stepRecords: nextStepRecords,
      createdAt: genesis.artifact.createdAt,
      lastStepAt: stepRecord.occurredAt,
      provenanceReferences: genesis.artifact.provenanceReferences,
      integrityReferences: genesis.artifact.integrityReferences,
    });
    if (!reconstructed.ok) {
      return reject(workflowFailureCode(reconstructed.code), {
        persistencePosition: stepEvidence.streamPosition,
        expectedWorkflowVersion:
          stepRecord.nextWorkflowExecutionVersion,
        expectedWorkflowStage: stepRecord.resultingStage,
      });
    }
    const fingerprintVerification =
      createOrganizationVerificationWorkflowExecution({
        workflowExecutionId:
          reconstructed.value.workflowExecutionId,
        workflowExecutionVersion:
          reconstructed.value.workflowExecutionVersion,
        organizationId: reconstructed.value.organizationId,
        recordId: reconstructed.value.recordId,
        revisionId: reconstructed.value.revisionId,
        attemptId: reconstructed.value.attemptId,
        workflowStage: reconstructed.value.workflowStage,
        lifecycleExecution:
          reconstructed.value.lifecycleExecution,
        ...(reconstructed.value.evidenceSnapshot === undefined
          ? {}
          : {
              evidenceSnapshot:
                reconstructed.value.evidenceSnapshot,
            }),
        ...(reconstructed.value.evaluationProjection === undefined
          ? {}
          : {
              evaluationProjection:
                reconstructed.value.evaluationProjection,
            }),
        ...(reconstructed.value.policyEvaluationInput === undefined
          ? {}
          : {
              policyEvaluationInput:
                reconstructed.value.policyEvaluationInput,
            }),
        ...(reconstructed.value.policyEvaluationExecution === undefined
          ? {}
          : {
              policyEvaluationExecution:
                reconstructed.value.policyEvaluationExecution,
            }),
        ...(reconstructed.value
          .decisionTrustIntegrationExecution === undefined
          ? {}
          : {
              decisionTrustIntegrationExecution:
                reconstructed.value
                  .decisionTrustIntegrationExecution,
            }),
        stepRecords: reconstructed.value.stepRecords,
        createdAt: reconstructed.value.createdAt,
        ...(reconstructed.value.lastStepAt === undefined
          ? {}
          : { lastStepAt: reconstructed.value.lastStepAt }),
        provenanceReferences:
          reconstructed.value.provenanceReferences,
        integrityReferences:
          reconstructed.value.integrityReferences,
        existingWorkflowExecution: reconstructed.value,
      });
    if (
      !fingerprintVerification.ok ||
      fingerprintVerification.value !== reconstructed.value
    ) {
      return reject("replay_workflow_fingerprint_conflict", {
        persistencePosition: stepEvidence.streamPosition,
        expectedFingerprint:
          reconstructed.value.workflowExecutionFingerprint,
      });
    }

    const binding = createReplayEvidenceBindingInternal({
      workflowStepId: stepRecord.workflowStepId,
      workflowStep: stepRecord.requestedStep,
      workflowStage: stepRecord.predecessorStage,
      resultingWorkflowStage: stepRecord.resultingStage,
      authorityResultEvidenceKind: authority.evidenceKind,
      authorityResultSemanticId: authority.semanticArtifactIdentity,
      authorityResultFingerprint: authority.artifactFingerprint,
      authorityResultPersistencePosition: authority.streamPosition,
      workflowStepRecordId: stepRecord.workflowStepId,
      workflowStepRecordFingerprint:
        stepRecord.workflowStepBindingFingerprint,
      workflowStepRecordPersistencePosition:
        stepEvidence.streamPosition,
      resultingWorkflowVersion:
        stepRecord.nextWorkflowExecutionVersion,
    });
    if (binding === undefined) {
      return reject("replay_reconstructed_integrity_failure", {
        persistencePosition: stepEvidence.streamPosition,
      });
    }
    bindings.push(binding);
    stepRecords.push(stepRecord);
    currentWorkflow = reconstructed.value;
  }

  const diagnostics: OrganizationVerificationReplayDiagnostics =
    Object.freeze({
      totalEvidenceEntriesConsumed: source.entries.length,
      totalWorkflowStepsReconstructed: bindings.length,
      finalWorkflowVersion: currentWorkflow.workflowExecutionVersion,
      finalWorkflowStage: currentWorkflow.workflowStage,
      finalLifecycleExecutionVersion:
        currentLifecycle.lifecycleExecutionVersion,
      firstPersistencePosition: 1,
      lastPersistencePosition: source.streamVersion,
      evidenceKindCounts: evidenceKindCounts(source.entries),
      terminalCoordinationReached:
        currentWorkflow.workflowStage === "completed",
    });
  const execution = createReplayExecutionInternal({
    request,
    reconstructedWorkflowExecution: currentWorkflow,
    reconstructedAttemptLifecycleExecution: currentLifecycle,
    authorityResultBindings: bindings,
    workflowStepRecordBindings: stepRecords,
    diagnostics,
  });
  return execution === undefined
    ? reject("replay_reconstructed_integrity_failure")
    : replayCompletedInternal(execution);
}
