import {
  isOrganizationVerificationDecision,
  type OrganizationVerificationDecision,
} from "../decision/index.js";
import {
  isOrganizationVerificationDecisionTrustIntegrationBinding,
  type OrganizationVerificationDecisionTrustIntegrationBinding,
  type OrganizationVerificationDecisionTrustIntegrationInputBinding,
} from "../decision-trust-integration-contract/index.js";
import {
  isOrganizationVerificationTrustStatus,
  type OrganizationVerificationTrustStatus,
} from "../trust-status/index.js";
import type {
  OrganizationVerificationDecisionTrustIntegrationExecutionContractVersion,
  OrganizationVerificationDecisionTrustIntegrationExecutionFingerprint,
  OrganizationVerificationDecisionTrustIntegrationExecutionId,
  OrganizationVerificationDecisionTrustIntegrationExecutionIntegrityReference,
  OrganizationVerificationDecisionTrustIntegrationExecutionProvenanceReference,
} from "./decisionTrustIntegrationIds.js";
import { type OrganizationVerificationPolicyEvaluationExecution } from "../policy-runtime/index.js";
import { createOrganizationVerificationDecisionTrustIntegrationBinding, createOrganizationVerificationDecisionTrustIntegrationInputBinding } from "../decision-trust-integration-contract/index.js";
import { createOrganizationVerificationDecisionTrustIntegrationExecutionFingerprint } from "./decisionTrustIntegrationIds.js";
import { fingerprintDecisionTrustIntegrationExecutionInternal } from "./decisionTrustIntegrationFingerprint.js";
import { integrationFailure, integrationSuccess, type OrganizationVerificationDecisionTrustIntegrationResult } from "./decisionTrustIntegrationErrors.js";
import { deepFreezeDurableValue, hasExactDurableKeys, isDurableIdentity, isDurableJsonValue, isDurablePlainObject, isDurableTimestamp } from "../durableRehydrationValidation.js";

const integrationExecutionSeal = Symbol(
  "organization-verification-decision-trust-integration-execution",
);

export interface OrganizationVerificationDecisionTrustIntegrationExecution {
  readonly executionId: OrganizationVerificationDecisionTrustIntegrationExecutionId;
  readonly executionContractVersion: OrganizationVerificationDecisionTrustIntegrationExecutionContractVersion;
  readonly inputBinding: OrganizationVerificationDecisionTrustIntegrationInputBinding;
  readonly decision: OrganizationVerificationDecision;
  readonly trustStatus: OrganizationVerificationTrustStatus;
  readonly binding: OrganizationVerificationDecisionTrustIntegrationBinding;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly provenanceReference: OrganizationVerificationDecisionTrustIntegrationExecutionProvenanceReference;
  readonly integrityReference: OrganizationVerificationDecisionTrustIntegrationExecutionIntegrityReference;
  readonly executionFingerprint: OrganizationVerificationDecisionTrustIntegrationExecutionFingerprint;
  readonly [integrationExecutionSeal]: true;
}

export type OrganizationVerificationDecisionTrustIntegrationExecutionData =
  Omit<
    OrganizationVerificationDecisionTrustIntegrationExecution,
    typeof integrationExecutionSeal
  >;

export function createOrganizationVerificationDecisionTrustIntegrationExecutionInternal(
  data: OrganizationVerificationDecisionTrustIntegrationExecutionData,
): OrganizationVerificationDecisionTrustIntegrationExecution {
  const execution = { ...data };
  Object.defineProperty(execution, integrationExecutionSeal, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  return Object.freeze(
    execution,
  ) as OrganizationVerificationDecisionTrustIntegrationExecution;
}

function isDurableIntegrationExecutionData(value: unknown): value is OrganizationVerificationDecisionTrustIntegrationExecutionData {
  if (!isDurablePlainObject(value) || !isDurableJsonValue(value)) return false;
  const required = ["executionId", "executionContractVersion", "inputBinding", "decision", "trustStatus", "binding", "startedAt", "completedAt", "provenanceReference", "integrityReference", "executionFingerprint"];
  return hasExactDurableKeys(value, required) &&
    ["executionId", "executionContractVersion", "provenanceReference", "integrityReference", "executionFingerprint"].every((key) => isDurableIdentity(value[key])) &&
    isDurableTimestamp(value.startedAt) && isDurableTimestamp(value.completedAt) && Date.parse(value.completedAt) >= Date.parse(value.startedAt);
}

export function rehydrateOrganizationVerificationDecisionTrustIntegrationExecution(
  durableData: unknown,
  artifacts: Readonly<{
    policyExecution: OrganizationVerificationPolicyEvaluationExecution;
    decision: OrganizationVerificationDecision;
    trustStatus: OrganizationVerificationTrustStatus;
  }>,
): OrganizationVerificationDecisionTrustIntegrationResult<OrganizationVerificationDecisionTrustIntegrationExecution> {
  if (!isDurableIntegrationExecutionData(durableData)) return integrationFailure({ stage: "execution", code: "invalid_execution_artifacts" });
  if (artifacts.policyExecution.executionFingerprint !== durableData.inputBinding.runtimeExecutionFingerprint) {
    return integrationFailure({ stage: "execution", code: "invalid_execution_artifacts" });
  }
  const runtime = artifacts.policyExecution;
  const decision = artifacts.decision;
  const trust = artifacts.trustStatus;
  const storedInput = durableData.inputBinding;
  const inputBinding = createOrganizationVerificationDecisionTrustIntegrationInputBinding({
    runtimeExecution: runtime,
    artifacts: {
      bindingId: storedInput.bindingId,
      bindingContractVersion: storedInput.bindingContractVersion,
      runtimeExecutionId: storedInput.runtimeExecutionId,
      runtimeExecutionContractVersion: storedInput.runtimeExecutionContractVersion,
      runtimeExecutorVersion: storedInput.runtimeExecutorVersion,
      runtimeExecutionFingerprint: storedInput.runtimeExecutionFingerprint,
      policyEvaluationInputId: storedInput.policyEvaluationInputId,
      policyEvaluationInputVersion: storedInput.policyEvaluationInputVersion,
      policyEvaluationInputFingerprint: storedInput.policyEvaluationInputFingerprint,
      organizationId: storedInput.organizationId,
      recordId: storedInput.recordId,
      revisionId: storedInput.revisionId,
      attemptId: storedInput.attemptId,
      snapshotId: storedInput.snapshotId,
      snapshotFingerprint: storedInput.snapshotFingerprint,
      policySetId: storedInput.policySetId,
      policySetVersion: storedInput.policySetVersion,
      policyEvaluationCompletionId: storedInput.policyEvaluationCompletionId,
      boundAt: storedInput.boundAt,
      provenanceReference: storedInput.provenanceReference,
      integrityReference: storedInput.integrityReference,
      expectedCompletionBindingFingerprint: storedInput.completionBindingFingerprint,
    },
  });
  if (!inputBinding.ok) return integrationFailure({ stage: "binding", code: inputBinding.code });
  const storedBinding = durableData.binding;
  const binding = createOrganizationVerificationDecisionTrustIntegrationBinding({
    inputBinding: inputBinding.value,
    decision,
    trustStatus: trust,
    artifacts: {
      decision: storedBinding.decisionEvidence === undefined ? undefined : {
        ...storedBinding.decisionEvidence,
        expectedDecisionBindingFingerprint: storedBinding.decisionBindingFingerprint,
      },
      trust: storedBinding.trustEvidence === undefined ? undefined : {
        ...storedBinding.trustEvidence,
        expectedTrustBindingFingerprint: storedBinding.trustBindingFingerprint,
      },
    },
  });
  if (!binding.ok) return integrationFailure({ stage: "binding", code: binding.code });
  const expected = createOrganizationVerificationDecisionTrustIntegrationExecutionFingerprint(
    fingerprintDecisionTrustIntegrationExecutionInternal({
      scope: "decision_trust_integration_execution",
      executionId: durableData.executionId,
      executionContractVersion: durableData.executionContractVersion,
      policyRuntimeExecutionId: inputBinding.value.runtimeExecutionId,
      policyRuntimeExecutionContractVersion: inputBinding.value.runtimeExecutionContractVersion,
      policyRuntimeExecutorVersion: inputBinding.value.runtimeExecutorVersion,
      policyRuntimeExecutionFingerprint: inputBinding.value.runtimeExecutionFingerprint,
      policyEvaluationInputId: inputBinding.value.policyEvaluationInputId,
      policyEvaluationInputVersion: inputBinding.value.policyEvaluationInputVersion,
      policyEvaluationInputFingerprint: inputBinding.value.policyEvaluationInputFingerprint,
      completionBindingFingerprint: binding.value.completionBindingFingerprint,
      decisionBindingFingerprint: binding.value.decisionBindingFingerprint,
      trustBindingFingerprint: binding.value.trustBindingFingerprint,
      decision,
      trustStatus: trust,
      startedAt: durableData.startedAt,
      completedAt: durableData.completedAt,
      provenanceReference: durableData.provenanceReference,
      integrityReference: durableData.integrityReference,
    }),
  );
  if (!expected.ok || expected.value !== durableData.executionFingerprint) return integrationFailure({ stage: "execution", code: "execution_fingerprint_mismatch" });
  return integrationSuccess(createOrganizationVerificationDecisionTrustIntegrationExecutionInternal(deepFreezeDurableValue({
    ...durableData,
    inputBinding: inputBinding.value,
    decision,
    trustStatus: trust,
    binding: binding.value,
  })));
}

export function isOrganizationVerificationDecisionTrustIntegrationExecution(
  value: unknown,
): value is OrganizationVerificationDecisionTrustIntegrationExecution {
  if (typeof value !== "object" || value === null) return false;
  return (
    Object.getOwnPropertyDescriptor(value, integrationExecutionSeal)?.value ===
      true &&
    Object.isFrozen(value) &&
    isOrganizationVerificationDecisionTrustIntegrationBinding(
      Object.getOwnPropertyDescriptor(value, "binding")?.value,
    ) &&
    isOrganizationVerificationDecision(
      Object.getOwnPropertyDescriptor(value, "decision")?.value,
    ) &&
    isOrganizationVerificationTrustStatus(
      Object.getOwnPropertyDescriptor(value, "trustStatus")?.value,
    )
  );
}
