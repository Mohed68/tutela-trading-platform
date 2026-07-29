import {
  isOrganizationVerificationAttemptLifecycleExecution,
  type OrganizationVerificationAttemptLifecycleExecution,
} from "../attempt-lifecycle-contract/index.js";
import type { ExecuteAttemptTransitionInput } from "../attempt-lifecycle-runtime/index.js";
import {
  isOrganizationVerificationWorkflowStreamIdentity,
  type OrganizationVerificationWorkflowStreamIdentity,
} from "../persistence-contract/index.js";
import type {
  OrganizationVerificationWorkflowStage,
} from "../workflow-contract/index.js";
import type {
  BuildOrganizationVerificationEvidenceSnapshotInput,
} from "../../domain/evidence-snapshot/index.js";
import type {
  BuildOrganizationVerificationEvaluationProjectionInput,
} from "../../domain/evaluation-projection/index.js";
import type {
  BuildOrganizationVerificationPolicyEvaluationInput,
} from "../../domain/evaluation-input/index.js";
import {
  isOrganizationVerificationExecutionArtifacts,
  isOrganizationVerificationRuleImplementationSet,
} from "../../domain/policy-runtime-contract/index.js";
import type {
  ExecuteOrganizationVerificationPolicyEvaluationInput,
} from "../../domain/policy-runtime/index.js";
import {
  isOrganizationVerificationPolicySet,
} from "../../domain/policy/index.js";
import type {
  ExecuteOrganizationVerificationDecisionTrustIntegrationInput,
} from "../../domain/decision-trust-integration/index.js";
import {
  immutableApplicationCopyInternal,
  isApplicationRequestAuthenticInternal,
  sealApplicationRequestInternal,
} from "./applicationServiceAuthenticity.js";
import {
  applicationFailureInternal,
  type OrganizationVerificationApplicationRequestCreationResult,
} from "./applicationServiceFailures.js";
import { fingerprintApplicationServiceContract } from "./applicationServiceFingerprint.js";
import {
  isExactApplicationIdentity,
  isExplicitApplicationTimestamp,
  normalizeAppendMetadataInternal,
  normalizeCommandMetadataInternal,
  normalizeQueryMetadataInternal,
  normalizeReplayMetadataInternal,
  type OrganizationVerificationApplicationAppendMetadata,
  type OrganizationVerificationApplicationCommandMetadata,
  type OrganizationVerificationApplicationQueryMetadata,
  type OrganizationVerificationApplicationReplayMetadata,
} from "./applicationServiceMetadata.js";

export type OrganizationVerificationAttemptTransitionAuthorityInput = Omit<
  ExecuteAttemptTransitionInput,
  "predecessorLifecycleExecution"
>;

export type OrganizationVerificationSnapshotAuthorityInput = Omit<
  BuildOrganizationVerificationEvidenceSnapshotInput,
  "existingSnapshot"
>;

export type OrganizationVerificationProjectionAuthorityInput = Omit<
  BuildOrganizationVerificationEvaluationProjectionInput,
  "evidenceSnapshot"
>;

export type OrganizationVerificationEvaluationInputAuthorityInput = Omit<
  BuildOrganizationVerificationPolicyEvaluationInput,
  "evaluationProjection" | "existingInput"
>;

export type OrganizationVerificationPolicyAuthorityInput = Omit<
  ExecuteOrganizationVerificationPolicyEvaluationInput,
  "evaluationInput"
>;

export type OrganizationVerificationDecisionTrustAuthorityInput = Omit<
  ExecuteOrganizationVerificationDecisionTrustIntegrationInput,
  "policyRuntimeExecution" | "existingExecution"
>;

export type OrganizationVerificationAdvanceStepRequest =
  | Readonly<{
      requestedStep: "attempt_transition";
      expectedWorkflowStage: "attempt_in_progress";
      authorityInput: OrganizationVerificationAttemptTransitionAuthorityInput;
    }>
  | Readonly<{
      requestedStep: "bind_snapshot";
      expectedWorkflowStage: "attempt_completed";
      authorityInput: OrganizationVerificationSnapshotAuthorityInput;
    }>
  | Readonly<{
      requestedStep: "bind_projection";
      expectedWorkflowStage: "snapshot_bound";
      authorityInput: OrganizationVerificationProjectionAuthorityInput;
    }>
  | Readonly<{
      requestedStep: "bind_evaluation_input";
      expectedWorkflowStage: "projection_bound";
      authorityInput: OrganizationVerificationEvaluationInputAuthorityInput;
    }>
  | Readonly<{
      requestedStep: "complete_policy";
      expectedWorkflowStage: "evaluation_input_bound";
      authorityInput: OrganizationVerificationPolicyAuthorityInput;
    }>
  | Readonly<{
      requestedStep: "complete_decision_trust_integration";
      expectedWorkflowStage: "policy_completed";
      authorityInput: OrganizationVerificationDecisionTrustAuthorityInput;
    }>;

export interface CreateStartOrganizationVerificationRequestInput {
  readonly metadata: OrganizationVerificationApplicationCommandMetadata;
  readonly streamIdentity: OrganizationVerificationWorkflowStreamIdentity;
  readonly expectedPersistenceStreamVersion: 0;
  readonly initialWorkflowExecutionVersion: 1;
  readonly initialLifecycleExecution: OrganizationVerificationAttemptLifecycleExecution;
  readonly workflowCreatedAt: string;
  readonly workflowProvenanceReferences: readonly string[];
  readonly workflowIntegrityReferences: readonly string[];
  readonly persistence: OrganizationVerificationApplicationAppendMetadata;
}

export interface StartOrganizationVerificationRequest
  extends Readonly<CreateStartOrganizationVerificationRequestInput> {
  readonly useCase: "start_organization_verification";
  readonly requestFingerprint: string;
}

export interface CreateAdvanceOrganizationVerificationWorkflowRequestInput {
  readonly metadata: OrganizationVerificationApplicationCommandMetadata;
  readonly streamIdentity: OrganizationVerificationWorkflowStreamIdentity;
  readonly expectedPersistenceStreamVersion: number;
  readonly expectedWorkflowExecutionId: string;
  readonly expectedWorkflowVersion: number;
  readonly workflowStepId: string;
  readonly occurredAt: string;
  readonly provenanceReferences: readonly string[];
  readonly integrityReferences: readonly string[];
  readonly correlationId: string;
  readonly causationId: string;
  readonly reasonReference?: string;
  readonly persistence: OrganizationVerificationApplicationAppendMetadata;
  readonly step: OrganizationVerificationAdvanceStepRequest;
}

export interface AdvanceOrganizationVerificationWorkflowRequest
  extends Readonly<
    CreateAdvanceOrganizationVerificationWorkflowRequestInput
  > {
  readonly useCase: "advance_organization_verification_workflow";
  readonly requestFingerprint: string;
}

export interface CreateLoadOrganizationVerificationStateRequestInput {
  readonly metadata: OrganizationVerificationApplicationQueryMetadata;
  readonly streamIdentity: OrganizationVerificationWorkflowStreamIdentity;
  readonly replay: OrganizationVerificationApplicationReplayMetadata;
}

export interface LoadOrganizationVerificationStateRequest
  extends Readonly<CreateLoadOrganizationVerificationStateRequestInput> {
  readonly useCase: "load_organization_verification_state";
  readonly requestFingerprint: string;
}

export interface CreateReplayOrganizationVerificationHistoryRequestInput {
  readonly metadata: OrganizationVerificationApplicationQueryMetadata;
  readonly streamIdentity: OrganizationVerificationWorkflowStreamIdentity;
  readonly replay: OrganizationVerificationApplicationReplayMetadata;
}

export interface ReplayOrganizationVerificationHistoryRequest
  extends Readonly<CreateReplayOrganizationVerificationHistoryRequestInput> {
  readonly useCase: "replay_organization_verification_history";
  readonly requestFingerprint: string;
}

function authenticStreamAndIdentityContinuity(
  streamIdentity: OrganizationVerificationWorkflowStreamIdentity,
  lifecycleExecution: OrganizationVerificationAttemptLifecycleExecution,
): boolean {
  return (
    isOrganizationVerificationWorkflowStreamIdentity(streamIdentity) &&
    isOrganizationVerificationAttemptLifecycleExecution(lifecycleExecution) &&
    streamIdentity.organizationId === lifecycleExecution.organizationId &&
    streamIdentity.recordId === lifecycleExecution.recordId &&
    streamIdentity.revisionId === lifecycleExecution.revisionId &&
    streamIdentity.attemptId === lifecycleExecution.attemptId
  );
}

function exactObjectKeys(
  value: unknown,
  required: readonly string[],
  optional: readonly string[] = [],
): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const keys = Object.keys(value);
  const allowed = new Set([...required, ...optional]);
  return (
    required.every((key) => keys.includes(key)) &&
    keys.every((key) => allowed.has(key))
  );
}

function validReferences(value: unknown): value is readonly string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((entry) => isExactApplicationIdentity(entry)) &&
    new Set(value).size === value.length
  );
}

function authorityInputFingerprint(
  step: OrganizationVerificationAdvanceStepRequest,
): string | undefined {
  if (step.requestedStep === "complete_policy") {
    const input = step.authorityInput;
    if (
      !isOrganizationVerificationPolicySet(input.policySet) ||
      !isOrganizationVerificationRuleImplementationSet(
        input.implementationSet,
      ) ||
      !isOrganizationVerificationExecutionArtifacts(input.executionArtifacts)
    ) {
      return undefined;
    }
    return fingerprintApplicationServiceContract("policy_authority_input", {
      policySetId: input.policySet.policySetId,
      policySetVersion: input.policySet.policySetVersion,
      policySetIntegrityReference: input.policySet.integrityReference,
      implementationSetId: input.implementationSet.implementationSetId,
      implementationSetVersion:
        input.implementationSet.implementationSetVersion,
      implementationSetFingerprint:
        input.implementationSet.implementationSetFingerprint,
      executionArtifactsFingerprint:
        input.executionArtifacts.executionArtifactsFingerprint,
      expectedExecutionFingerprint: input.expectedExecutionFingerprint,
    });
  }
  return fingerprintApplicationServiceContract(
    `${step.requestedStep}_authority_input`,
    step.authorityInput,
  );
}

function validAuthorityInput(
  step: OrganizationVerificationAdvanceStepRequest,
): boolean {
  switch (step.requestedStep) {
    case "attempt_transition": {
      const input = step.authorityInput;
      return exactObjectKeys(
        input,
        [
          "lifecycleExecutionId",
          "expectedPredecessorLifecycleExecutionVersion",
          "nextLifecycleExecutionVersion",
          "transitionId",
          "requestedTransition",
          "expectedPredecessorAttemptState",
          "expectedResultingAttemptState",
          "recordId",
          "revisionId",
          "attemptId",
          "attemptSequence",
          "occurredAt",
          "provenanceReferences",
          "integrityReferences",
        ],
        [
          "completionReference",
          "correlationId",
          "causationId",
          "reasonReference",
        ],
      );
    }
    case "bind_snapshot": {
      const input = step.authorityInput;
      return exactObjectKeys(input, [
        "context",
        "registrySource",
        "submissionSource",
        "evidenceReferences",
      ]);
    }
    case "bind_projection": {
      const input = step.authorityInput;
      return exactObjectKeys(input, ["context"]);
    }
    case "bind_evaluation_input": {
      const input = step.authorityInput;
      return exactObjectKeys(
        input,
        [
          "policyEvaluationInputId",
          "policyEvaluationInputVersion",
          "inputContractVersion",
          "inputBuilderVersion",
          "createdAt",
          "policySetBinding",
          "evaluationContext",
          "evaluationScope",
        ],
        ["expectedInputFingerprint"],
      );
    }
    case "complete_policy": {
      const input = step.authorityInput;
      return (
        exactObjectKeys(
          input,
          ["policySet", "implementationSet", "executionArtifacts"],
          ["expectedExecutionFingerprint"],
        ) &&
        isOrganizationVerificationPolicySet(input.policySet) &&
        isOrganizationVerificationRuleImplementationSet(
          input.implementationSet,
        ) &&
        isOrganizationVerificationExecutionArtifacts(input.executionArtifacts)
      );
    }
    case "complete_decision_trust_integration": {
      const input = step.authorityInput;
      return exactObjectKeys(input, [
        "inputBindingArtifacts",
        "decisionContext",
        "trustSourceFactsArtifacts",
        "trustDerivationContext",
        "bindingArtifacts",
        "executionArtifacts",
      ]);
    }
  }
}

function immutableStep(
  step: OrganizationVerificationAdvanceStepRequest,
): OrganizationVerificationAdvanceStepRequest {
  if (step.requestedStep === "complete_policy") {
    const input = step.authorityInput;
    return Object.freeze({
      requestedStep: step.requestedStep,
      expectedWorkflowStage: step.expectedWorkflowStage,
      authorityInput: Object.freeze({
        policySet: input.policySet,
        implementationSet: input.implementationSet,
        executionArtifacts: input.executionArtifacts,
        ...(input.expectedExecutionFingerprint !== undefined
          ? {
              expectedExecutionFingerprint:
                input.expectedExecutionFingerprint,
            }
          : {}),
      }),
    });
  }
  return immutableApplicationCopyInternal(step);
}

function stageMatchesStep(
  step: OrganizationVerificationAdvanceStepRequest,
): boolean {
  const expected: Readonly<
    Record<
      OrganizationVerificationAdvanceStepRequest["requestedStep"],
      OrganizationVerificationWorkflowStage
    >
  > = {
    attempt_transition: "attempt_in_progress",
    bind_snapshot: "attempt_completed",
    bind_projection: "snapshot_bound",
    bind_evaluation_input: "projection_bound",
    complete_policy: "evaluation_input_bound",
    complete_decision_trust_integration: "policy_completed",
  };
  return expected[step.requestedStep] === step.expectedWorkflowStage;
}

export function createStartOrganizationVerificationRequest(
  input: CreateStartOrganizationVerificationRequestInput,
): OrganizationVerificationApplicationRequestCreationResult<StartOrganizationVerificationRequest> {
  const metadata = normalizeCommandMetadataInternal(input.metadata);
  const persistence = normalizeAppendMetadataInternal(
    input.persistence,
    "genesis",
  );
  if (metadata === undefined || persistence === undefined) {
    return Object.freeze({
      ok: false,
      failure: applicationFailureInternal("malformed_application_metadata"),
    });
  }
  if (
    input.expectedPersistenceStreamVersion !== 0 ||
    input.initialWorkflowExecutionVersion !== 1
  ) {
    return Object.freeze({
      ok: false,
      failure: applicationFailureInternal("invalid_start_expected_version"),
    });
  }
  if (
    !authenticStreamAndIdentityContinuity(
      input.streamIdentity,
      input.initialLifecycleExecution,
    ) ||
    input.streamIdentity.workflowExecutionId.trim().length === 0
  ) {
    return Object.freeze({
      ok: false,
      failure: applicationFailureInternal("application_identity_mismatch"),
    });
  }
  if (
    !isExplicitApplicationTimestamp(input.workflowCreatedAt) ||
    Date.parse(input.workflowCreatedAt) <
      Date.parse(input.initialLifecycleExecution.createdAt) ||
    !validReferences(input.workflowProvenanceReferences) ||
    !validReferences(input.workflowIntegrityReferences)
  ) {
    return Object.freeze({
      ok: false,
      failure: applicationFailureInternal("invalid_workflow_genesis"),
    });
  }
  const semantic = {
    useCase: "start_organization_verification",
    metadata,
    streamIdentityFingerprint: input.streamIdentity.streamIdentityFingerprint,
    expectedPersistenceStreamVersion: 0,
    initialWorkflowExecutionVersion: 1,
    initialLifecycleExecutionFingerprint:
      input.initialLifecycleExecution.attemptLifecycleExecutionFingerprint,
    workflowCreatedAt: input.workflowCreatedAt,
    workflowProvenanceReferences: [...input.workflowProvenanceReferences].sort(),
    workflowIntegrityReferences: [...input.workflowIntegrityReferences].sort(),
    persistence,
  };
  return Object.freeze({
    ok: true,
    value: sealApplicationRequestInternal({
      useCase: "start_organization_verification" as const,
      metadata,
      streamIdentity: input.streamIdentity,
      expectedPersistenceStreamVersion: 0 as const,
      initialWorkflowExecutionVersion: 1 as const,
      initialLifecycleExecution: input.initialLifecycleExecution,
      workflowCreatedAt: input.workflowCreatedAt,
      workflowProvenanceReferences: Object.freeze(
        [...input.workflowProvenanceReferences].sort(),
      ),
      workflowIntegrityReferences: Object.freeze(
        [...input.workflowIntegrityReferences].sort(),
      ),
      persistence,
      requestFingerprint: fingerprintApplicationServiceContract(
        "start_request",
        semantic,
      ),
    }),
  });
}

export function createAdvanceOrganizationVerificationWorkflowRequest(
  input: CreateAdvanceOrganizationVerificationWorkflowRequestInput,
): OrganizationVerificationApplicationRequestCreationResult<AdvanceOrganizationVerificationWorkflowRequest> {
  const metadata = normalizeCommandMetadataInternal(input.metadata);
  const persistence = normalizeAppendMetadataInternal(
    input.persistence,
    "step",
  );
  const stepFingerprint = authorityInputFingerprint(input.step);
  if (
    metadata === undefined ||
    persistence === undefined ||
    stepFingerprint === undefined
  ) {
    return Object.freeze({
      ok: false,
      failure: applicationFailureInternal("malformed_application_metadata"),
    });
  }
  if (
    !isOrganizationVerificationWorkflowStreamIdentity(input.streamIdentity) ||
    !isExactApplicationIdentity(input.expectedWorkflowExecutionId) ||
    input.expectedWorkflowExecutionId !==
      input.streamIdentity.workflowExecutionId ||
    !Number.isSafeInteger(input.expectedPersistenceStreamVersion) ||
    input.expectedPersistenceStreamVersion < 1 ||
    !Number.isSafeInteger(input.expectedWorkflowVersion) ||
    input.expectedWorkflowVersion < 1
  ) {
    return Object.freeze({
      ok: false,
      failure: applicationFailureInternal("application_identity_mismatch"),
    });
  }
  if (
    !stageMatchesStep(input.step) ||
    !validAuthorityInput(input.step) ||
    !isExactApplicationIdentity(input.workflowStepId) ||
    !isExplicitApplicationTimestamp(input.occurredAt) ||
    !validReferences(input.provenanceReferences) ||
    !validReferences(input.integrityReferences) ||
    !isExactApplicationIdentity(input.correlationId) ||
    !isExactApplicationIdentity(input.causationId) ||
    (input.reasonReference !== undefined &&
      !isExactApplicationIdentity(input.reasonReference))
  ) {
    return Object.freeze({
      ok: false,
      failure: applicationFailureInternal("invalid_application_request"),
    });
  }
  const step = immutableStep(input.step);
  const semantic = {
    useCase: "advance_organization_verification_workflow",
    metadata,
    streamIdentityFingerprint: input.streamIdentity.streamIdentityFingerprint,
    expectedPersistenceStreamVersion:
      input.expectedPersistenceStreamVersion,
    expectedWorkflowExecutionId: input.expectedWorkflowExecutionId,
    expectedWorkflowVersion: input.expectedWorkflowVersion,
    workflowStepId: input.workflowStepId,
    occurredAt: input.occurredAt,
    provenanceReferences: [...input.provenanceReferences].sort(),
    integrityReferences: [...input.integrityReferences].sort(),
    correlationId: input.correlationId,
    causationId: input.causationId,
    reasonReference: input.reasonReference,
    persistence,
    requestedStep: step.requestedStep,
    expectedWorkflowStage: step.expectedWorkflowStage,
    authorityInputFingerprint: stepFingerprint,
  };
  return Object.freeze({
    ok: true,
    value: sealApplicationRequestInternal({
      useCase: "advance_organization_verification_workflow" as const,
      metadata,
      streamIdentity: input.streamIdentity,
      expectedPersistenceStreamVersion:
        input.expectedPersistenceStreamVersion,
      expectedWorkflowExecutionId: input.expectedWorkflowExecutionId,
      expectedWorkflowVersion: input.expectedWorkflowVersion,
      workflowStepId: input.workflowStepId,
      occurredAt: input.occurredAt,
      provenanceReferences: Object.freeze(
        [...input.provenanceReferences].sort(),
      ),
      integrityReferences: Object.freeze(
        [...input.integrityReferences].sort(),
      ),
      correlationId: input.correlationId,
      causationId: input.causationId,
      ...(input.reasonReference !== undefined
        ? { reasonReference: input.reasonReference }
        : {}),
      persistence,
      step,
      requestFingerprint: fingerprintApplicationServiceContract(
        "advance_request",
        semantic,
      ),
    }),
  });
}

function createQueryRequest<
  T extends
    | LoadOrganizationVerificationStateRequest
    | ReplayOrganizationVerificationHistoryRequest,
>(
  useCase: T["useCase"],
  input:
    | CreateLoadOrganizationVerificationStateRequestInput
    | CreateReplayOrganizationVerificationHistoryRequestInput,
): OrganizationVerificationApplicationRequestCreationResult<T> {
  const metadata = normalizeQueryMetadataInternal(input.metadata);
  const replay = normalizeReplayMetadataInternal(input.replay);
  if (
    metadata === undefined ||
    replay === undefined ||
    !isOrganizationVerificationWorkflowStreamIdentity(input.streamIdentity)
  ) {
    return Object.freeze({
      ok: false,
      failure: applicationFailureInternal("malformed_application_metadata"),
    });
  }
  const semantic = {
    useCase,
    metadata,
    streamIdentityFingerprint: input.streamIdentity.streamIdentityFingerprint,
    replay,
  };
  const request = sealApplicationRequestInternal({
    useCase,
    metadata,
    streamIdentity: input.streamIdentity,
    replay,
    requestFingerprint: fingerprintApplicationServiceContract(
      `${useCase}_request`,
      semantic,
    ),
  });
  return Object.freeze({ ok: true, value: request as T });
}

export function createLoadOrganizationVerificationStateRequest(
  input: CreateLoadOrganizationVerificationStateRequestInput,
): OrganizationVerificationApplicationRequestCreationResult<LoadOrganizationVerificationStateRequest> {
  return createQueryRequest("load_organization_verification_state", input);
}

export function createReplayOrganizationVerificationHistoryRequest(
  input: CreateReplayOrganizationVerificationHistoryRequestInput,
): OrganizationVerificationApplicationRequestCreationResult<ReplayOrganizationVerificationHistoryRequest> {
  return createQueryRequest(
    "replay_organization_verification_history",
    input,
  );
}

export function isStartOrganizationVerificationRequest(
  value: unknown,
): value is StartOrganizationVerificationRequest {
  return (
    isApplicationRequestAuthenticInternal(value) &&
    "useCase" in value &&
    value.useCase === "start_organization_verification"
  );
}

export function isAdvanceOrganizationVerificationWorkflowRequest(
  value: unknown,
): value is AdvanceOrganizationVerificationWorkflowRequest {
  return (
    isApplicationRequestAuthenticInternal(value) &&
    "useCase" in value &&
    value.useCase === "advance_organization_verification_workflow"
  );
}

export function isLoadOrganizationVerificationStateRequest(
  value: unknown,
): value is LoadOrganizationVerificationStateRequest {
  return (
    isApplicationRequestAuthenticInternal(value) &&
    "useCase" in value &&
    value.useCase === "load_organization_verification_state"
  );
}

export function isReplayOrganizationVerificationHistoryRequest(
  value: unknown,
): value is ReplayOrganizationVerificationHistoryRequest {
  return (
    isApplicationRequestAuthenticInternal(value) &&
    "useCase" in value &&
    value.useCase === "replay_organization_verification_history"
  );
}
