import {
  isOrganizationVerificationPolicyEvaluationExecution,
  type OrganizationVerificationPolicyEvaluationExecution,
} from "../policy-runtime/index.js";
import { fingerprintDecisionTrustBindingInternal } from "./canonical.js";
import {
  bindingFailure,
  bindingSuccess,
  type OrganizationVerificationDecisionTrustBindingResult,
} from "./errors.js";
import {
  ORGANIZATION_VERIFICATION_DECISION_TRUST_BINDING_CONTRACT_VERSION,
  createCompletionBindingFingerprint,
  type CompletionBindingFingerprint,
  type OrganizationVerificationDecisionTrustBindingContractVersion,
  type OrganizationVerificationDecisionTrustBindingId,
  type OrganizationVerificationDecisionTrustBindingIntegrityReference,
  type OrganizationVerificationDecisionTrustBindingProvenanceReference,
} from "./ids.js";

const integrationInputBindingSeal = Symbol(
  "organization-verification-decision-trust-integration-input-binding",
);

type RuntimeExecution = OrganizationVerificationPolicyEvaluationExecution;
type RuntimeCompletion = RuntimeExecution["completion"];

export interface OrganizationVerificationDecisionTrustInputContinuity {
  readonly runtimeExecutionId: RuntimeExecution["executionId"];
  readonly runtimeExecutionContractVersion: RuntimeExecution["executionContractVersion"];
  readonly runtimeExecutorVersion: RuntimeExecution["executorVersion"];
  readonly runtimeExecutionFingerprint: RuntimeExecution["executionFingerprint"];
  readonly policyEvaluationInputId: RuntimeExecution["policyEvaluationInputId"];
  readonly policyEvaluationInputVersion: RuntimeExecution["policyEvaluationInputVersion"];
  readonly policyEvaluationInputFingerprint: RuntimeExecution["policyEvaluationInputFingerprint"];
  readonly organizationId: RuntimeCompletion["organizationId"];
  readonly recordId: RuntimeCompletion["recordId"];
  readonly revisionId: RuntimeCompletion["revisionId"];
  readonly attemptId: RuntimeCompletion["attemptId"];
  readonly snapshotId: RuntimeCompletion["snapshotId"];
  readonly snapshotFingerprint: RuntimeCompletion["snapshotFingerprint"];
  readonly policySetId: RuntimeExecution["policySetId"];
  readonly policySetVersion: RuntimeExecution["policySetVersion"];
  readonly policyEvaluationCompletionId: RuntimeCompletion["evaluationCompletionId"];
}

export interface OrganizationVerificationDecisionTrustInputBindingArtifacts
  extends OrganizationVerificationDecisionTrustInputContinuity {
  readonly bindingId: OrganizationVerificationDecisionTrustBindingId;
  readonly bindingContractVersion: OrganizationVerificationDecisionTrustBindingContractVersion;
  readonly boundAt: string;
  readonly provenanceReference: OrganizationVerificationDecisionTrustBindingProvenanceReference;
  readonly integrityReference: OrganizationVerificationDecisionTrustBindingIntegrityReference;
  readonly expectedCompletionBindingFingerprint?: CompletionBindingFingerprint;
}

export interface OrganizationVerificationDecisionTrustIntegrationInputBinding
  extends OrganizationVerificationDecisionTrustInputContinuity {
  readonly bindingId: OrganizationVerificationDecisionTrustBindingId;
  readonly bindingContractVersion: OrganizationVerificationDecisionTrustBindingContractVersion;
  readonly runtimeExecution: RuntimeExecution;
  readonly boundAt: string;
  readonly provenanceReference: OrganizationVerificationDecisionTrustBindingProvenanceReference;
  readonly integrityReference: OrganizationVerificationDecisionTrustBindingIntegrityReference;
  readonly completionBindingFingerprint: CompletionBindingFingerprint;
  readonly [integrationInputBindingSeal]: true;
}

export interface CreateOrganizationVerificationDecisionTrustInputBindingInput {
  readonly runtimeExecution: RuntimeExecution;
  readonly artifacts: OrganizationVerificationDecisionTrustInputBindingArtifacts;
  readonly existingBinding?: OrganizationVerificationDecisionTrustIntegrationInputBinding;
}

function validReference(value: unknown): boolean {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    !["latest", "current", "head"].includes(value.trim().toLowerCase())
  );
}

function exactContinuity(
  execution: RuntimeExecution,
  artifacts: OrganizationVerificationDecisionTrustInputBindingArtifacts,
): OrganizationVerificationDecisionTrustBindingResult<true> {
  const completion = execution.completion;
  if (
    artifacts.runtimeExecutionId !== execution.executionId ||
    artifacts.runtimeExecutionContractVersion !==
      execution.executionContractVersion ||
    artifacts.runtimeExecutorVersion !== execution.executorVersion ||
    artifacts.runtimeExecutionFingerprint !== execution.executionFingerprint
  ) {
    return bindingFailure("runtime_execution_mismatch");
  }
  if (
    artifacts.policyEvaluationInputId !==
      execution.policyEvaluationInputId ||
    artifacts.policyEvaluationInputVersion !==
      execution.policyEvaluationInputVersion ||
    artifacts.policyEvaluationInputFingerprint !==
      execution.policyEvaluationInputFingerprint
  ) {
    return bindingFailure("evaluation_input_mismatch");
  }
  if (artifacts.organizationId !== completion.organizationId) {
    return bindingFailure("organization_id_mismatch");
  }
  if (artifacts.recordId !== completion.recordId) {
    return bindingFailure("verification_record_id_mismatch");
  }
  if (artifacts.revisionId !== completion.revisionId) {
    return bindingFailure("verification_revision_id_mismatch");
  }
  if (artifacts.attemptId !== completion.attemptId) {
    return bindingFailure("attempt_id_mismatch");
  }
  if (artifacts.snapshotId !== completion.snapshotId) {
    return bindingFailure("snapshot_id_mismatch");
  }
  if (artifacts.snapshotFingerprint !== completion.snapshotFingerprint) {
    return bindingFailure("snapshot_fingerprint_mismatch");
  }
  if (
    artifacts.policySetId !== execution.policySetId ||
    artifacts.policySetVersion !== execution.policySetVersion ||
    completion.policySetId !== execution.policySetId ||
    completion.policySetVersion !== execution.policySetVersion
  ) {
    return bindingFailure("policy_set_mismatch");
  }
  if (
    artifacts.policyEvaluationCompletionId !==
    completion.evaluationCompletionId
  ) {
    return bindingFailure("completion_mismatch");
  }
  return bindingSuccess(true);
}

export function isOrganizationVerificationDecisionTrustIntegrationInputBinding(
  value: unknown,
): value is OrganizationVerificationDecisionTrustIntegrationInputBinding {
  if (typeof value !== "object" || value === null) return false;
  return (
    Object.getOwnPropertyDescriptor(value, integrationInputBindingSeal)
      ?.value === true &&
    Object.isFrozen(value) &&
    isOrganizationVerificationPolicyEvaluationExecution(
      Object.getOwnPropertyDescriptor(value, "runtimeExecution")?.value,
    )
  );
}

export function createOrganizationVerificationDecisionTrustIntegrationInputBinding(
  input: CreateOrganizationVerificationDecisionTrustInputBindingInput,
): OrganizationVerificationDecisionTrustBindingResult<OrganizationVerificationDecisionTrustIntegrationInputBinding> {
  if (
    !isOrganizationVerificationPolicyEvaluationExecution(
      input.runtimeExecution,
    )
  ) {
    return bindingFailure("unauthentic_runtime_execution");
  }
  const artifacts = input.artifacts;
  if (
    artifacts.bindingContractVersion !==
      ORGANIZATION_VERIFICATION_DECISION_TRUST_BINDING_CONTRACT_VERSION ||
    !validReference(artifacts.bindingId) ||
    !validReference(artifacts.provenanceReference) ||
    !validReference(artifacts.integrityReference) ||
    !Number.isFinite(Date.parse(artifacts.boundAt))
  ) {
    return bindingFailure("invalid_binding_artifacts");
  }
  if (
    Date.parse(artifacts.boundAt) <
    Date.parse(input.runtimeExecution.completedAt)
  ) {
    return bindingFailure("invalid_binding_chronology");
  }
  const continuity = exactContinuity(input.runtimeExecution, artifacts);
  if (!continuity.ok) return continuity;

  const completionBindingFingerprint = createCompletionBindingFingerprint(
    fingerprintDecisionTrustBindingInternal({
      scope: "completion_binding",
      bindingContractVersion: artifacts.bindingContractVersion,
      bindingId: artifacts.bindingId,
      runtimeExecutionId: artifacts.runtimeExecutionId,
      runtimeExecutionContractVersion:
        artifacts.runtimeExecutionContractVersion,
      runtimeExecutorVersion: artifacts.runtimeExecutorVersion,
      runtimeExecutionFingerprint: artifacts.runtimeExecutionFingerprint,
      policyEvaluationInputId: artifacts.policyEvaluationInputId,
      policyEvaluationInputVersion: artifacts.policyEvaluationInputVersion,
      policyEvaluationInputFingerprint:
        artifacts.policyEvaluationInputFingerprint,
      organizationId: artifacts.organizationId,
      recordId: artifacts.recordId,
      revisionId: artifacts.revisionId,
      attemptId: artifacts.attemptId,
      snapshotId: artifacts.snapshotId,
      snapshotFingerprint: artifacts.snapshotFingerprint,
      policySetId: artifacts.policySetId,
      policySetVersion: artifacts.policySetVersion,
      policyEvaluationCompletionId:
        artifacts.policyEvaluationCompletionId,
      completionClassification: input.runtimeExecution.completion.classification,
      completionCompletedAt:
        input.runtimeExecution.completion.evaluationCompletedAt,
      completionProvenanceReference:
        input.runtimeExecution.completion.provenanceReference,
      completionIntegrityReference:
        input.runtimeExecution.completion.integrityReference,
      boundAt: artifacts.boundAt,
      provenanceReference: artifacts.provenanceReference,
      integrityReference: artifacts.integrityReference,
    }),
  );
  if (!completionBindingFingerprint.ok) {
    return bindingFailure("invalid_binding_artifacts");
  }
  if (
    artifacts.expectedCompletionBindingFingerprint !== undefined &&
    artifacts.expectedCompletionBindingFingerprint !==
      completionBindingFingerprint.value
  ) {
    return bindingFailure("completion_binding_fingerprint_mismatch");
  }

  if (input.existingBinding !== undefined) {
    if (
      !isOrganizationVerificationDecisionTrustIntegrationInputBinding(
        input.existingBinding,
      )
    ) {
      return bindingFailure("unauthentic_input_binding");
    }
    if (
      input.existingBinding.bindingId !== artifacts.bindingId ||
      input.existingBinding.completionBindingFingerprint !==
        completionBindingFingerprint.value
    ) {
      return bindingFailure(
        input.existingBinding.bindingId === artifacts.bindingId
          ? "conflicting_binding"
          : "duplicate_binding",
      );
    }
    return bindingSuccess(input.existingBinding);
  }

  const binding = {
    bindingId: artifacts.bindingId,
    bindingContractVersion: artifacts.bindingContractVersion,
    runtimeExecution: input.runtimeExecution,
    runtimeExecutionId: artifacts.runtimeExecutionId,
    runtimeExecutionContractVersion:
      artifacts.runtimeExecutionContractVersion,
    runtimeExecutorVersion: artifacts.runtimeExecutorVersion,
    runtimeExecutionFingerprint: artifacts.runtimeExecutionFingerprint,
    policyEvaluationInputId: artifacts.policyEvaluationInputId,
    policyEvaluationInputVersion: artifacts.policyEvaluationInputVersion,
    policyEvaluationInputFingerprint:
      artifacts.policyEvaluationInputFingerprint,
    organizationId: artifacts.organizationId,
    recordId: artifacts.recordId,
    revisionId: artifacts.revisionId,
    attemptId: artifacts.attemptId,
    snapshotId: artifacts.snapshotId,
    snapshotFingerprint: artifacts.snapshotFingerprint,
    policySetId: artifacts.policySetId,
    policySetVersion: artifacts.policySetVersion,
    policyEvaluationCompletionId:
      artifacts.policyEvaluationCompletionId,
    boundAt: artifacts.boundAt,
    provenanceReference: artifacts.provenanceReference,
    integrityReference: artifacts.integrityReference,
    completionBindingFingerprint: completionBindingFingerprint.value,
  };
  Object.defineProperty(binding, integrationInputBindingSeal, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  return bindingSuccess(
    Object.freeze(
      binding,
    ) as OrganizationVerificationDecisionTrustIntegrationInputBinding,
  );
}
