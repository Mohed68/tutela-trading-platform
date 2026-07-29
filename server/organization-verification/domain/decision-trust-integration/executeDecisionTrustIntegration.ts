import {
  decideOrganizationVerification,
  isOrganizationVerificationDecision,
  type DecisionConstructionContext,
} from "../decision/index.js";
import {
  createOrganizationVerificationDecisionTrustIntegrationBinding,
  createOrganizationVerificationDecisionTrustIntegrationInputBinding,
  type OrganizationVerificationDecisionTrustBindingArtifacts,
  type OrganizationVerificationDecisionTrustInputBindingArtifacts,
} from "../decision-trust-integration-contract/index.js";
import { adaptPolicyEvaluationCompletionToNormalizedEvaluation } from "../policy/index.js";
import {
  isOrganizationVerificationPolicyEvaluationExecution,
  type OrganizationVerificationPolicyEvaluationExecution,
} from "../policy-runtime/index.js";
import type { TrustStatusDerivationContext } from "../trust-status/index.js";
import {
  fingerprintDecisionTrustIntegrationExecutionInternal,
} from "./decisionTrustIntegrationFingerprint.js";
import {
  integrationFailure,
  integrationSuccess,
  type OrganizationVerificationDecisionTrustIntegrationResult,
} from "./decisionTrustIntegrationErrors.js";
import {
  createOrganizationVerificationDecisionTrustIntegrationExecutionInternal,
  isOrganizationVerificationDecisionTrustIntegrationExecution,
  type OrganizationVerificationDecisionTrustIntegrationExecution,
} from "./decisionTrustIntegrationExecution.js";
import {
  ORGANIZATION_VERIFICATION_DECISION_TRUST_INTEGRATION_EXECUTION_CONTRACT_VERSION,
  createOrganizationVerificationDecisionTrustIntegrationExecutionFingerprint,
  type OrganizationVerificationDecisionTrustIntegrationExecutionContractVersion,
  type OrganizationVerificationDecisionTrustIntegrationExecutionFingerprint,
  type OrganizationVerificationDecisionTrustIntegrationExecutionId,
  type OrganizationVerificationDecisionTrustIntegrationExecutionIntegrityReference,
  type OrganizationVerificationDecisionTrustIntegrationExecutionProvenanceReference,
} from "./decisionTrustIntegrationIds.js";
import {
  deriveTrustStatusFromAuthenticDecision,
  type OrganizationVerificationTrustSourceFactsArtifacts,
} from "./trustDerivation.js";

export interface OrganizationVerificationDecisionTrustIntegrationExecutionArtifacts {
  readonly executionId: OrganizationVerificationDecisionTrustIntegrationExecutionId;
  readonly executionContractVersion: OrganizationVerificationDecisionTrustIntegrationExecutionContractVersion;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly provenanceReference: OrganizationVerificationDecisionTrustIntegrationExecutionProvenanceReference;
  readonly integrityReference: OrganizationVerificationDecisionTrustIntegrationExecutionIntegrityReference;
  readonly expectedExecutionFingerprint?: OrganizationVerificationDecisionTrustIntegrationExecutionFingerprint;
}

export interface ExecuteOrganizationVerificationDecisionTrustIntegrationInput {
  readonly policyRuntimeExecution: OrganizationVerificationPolicyEvaluationExecution;
  readonly inputBindingArtifacts: OrganizationVerificationDecisionTrustInputBindingArtifacts;
  readonly decisionContext: DecisionConstructionContext;
  readonly trustSourceFactsArtifacts: OrganizationVerificationTrustSourceFactsArtifacts;
  readonly trustDerivationContext: TrustStatusDerivationContext;
  readonly bindingArtifacts: OrganizationVerificationDecisionTrustBindingArtifacts;
  readonly executionArtifacts: OrganizationVerificationDecisionTrustIntegrationExecutionArtifacts;
  readonly existingExecution?: OrganizationVerificationDecisionTrustIntegrationExecution;
}

function validReference(value: unknown): boolean {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    !["latest", "current", "head"].includes(value.trim().toLowerCase())
  );
}

function validateExecutionArtifacts(
  input: ExecuteOrganizationVerificationDecisionTrustIntegrationInput,
): OrganizationVerificationDecisionTrustIntegrationResult<true> {
  const artifacts = input.executionArtifacts;
  if (
    artifacts.executionContractVersion !==
      ORGANIZATION_VERIFICATION_DECISION_TRUST_INTEGRATION_EXECUTION_CONTRACT_VERSION ||
    !validReference(artifacts.executionId) ||
    !validReference(artifacts.provenanceReference) ||
    !validReference(artifacts.integrityReference) ||
    !Number.isFinite(Date.parse(artifacts.startedAt)) ||
    !Number.isFinite(Date.parse(artifacts.completedAt))
  ) {
    return integrationFailure({
      stage: "execution",
      code: "invalid_execution_artifacts",
    });
  }
  if (
    Date.parse(artifacts.startedAt) <
      Date.parse(input.policyRuntimeExecution.completedAt) ||
    Date.parse(artifacts.completedAt) < Date.parse(artifacts.startedAt)
  ) {
    return integrationFailure({
      stage: "execution",
      code: "invalid_execution_chronology",
    });
  }
  return integrationSuccess(true);
}

function validateCompletedChronology(
  input: ExecuteOrganizationVerificationDecisionTrustIntegrationInput,
  execution: Readonly<{
    inputBindingBoundAt: string;
    decisionDecidedAt: string;
    decisionBoundAt: string;
    trustDerivationAsOf: string;
    trustDerivedAt: string;
    trustBoundAt: string;
  }>,
): OrganizationVerificationDecisionTrustIntegrationResult<true> {
  const startedAt = Date.parse(input.executionArtifacts.startedAt);
  const completedAt = Date.parse(input.executionArtifacts.completedAt);
  const ordered = [
    Date.parse(execution.inputBindingBoundAt),
    Date.parse(execution.decisionDecidedAt),
    Date.parse(execution.decisionBoundAt),
    Date.parse(execution.trustDerivationAsOf),
    Date.parse(execution.trustDerivedAt),
    Date.parse(execution.trustBoundAt),
  ];
  if (
    ordered.some((timestamp) => !Number.isFinite(timestamp)) ||
    ordered[0]! < startedAt ||
    ordered.some(
      (timestamp, index) =>
        index > 0 && timestamp < (ordered[index - 1] ?? timestamp),
    ) ||
    ordered.at(-1)! > completedAt
  ) {
    return integrationFailure({
      stage: "execution",
      code: "invalid_execution_chronology",
    });
  }
  return integrationSuccess(true);
}

export function executeOrganizationVerificationDecisionTrustIntegration(
  input: ExecuteOrganizationVerificationDecisionTrustIntegrationInput,
): OrganizationVerificationDecisionTrustIntegrationResult<OrganizationVerificationDecisionTrustIntegrationExecution> {
  if (
    !isOrganizationVerificationPolicyEvaluationExecution(
      input.policyRuntimeExecution,
    )
  ) {
    return integrationFailure({
      stage: "execution",
      code: "unauthentic_runtime_execution",
    });
  }
  const executionArtifacts = validateExecutionArtifacts(input);
  if (!executionArtifacts.ok) return executionArtifacts;

  const inputBinding =
    createOrganizationVerificationDecisionTrustIntegrationInputBinding({
      runtimeExecution: input.policyRuntimeExecution,
      artifacts: input.inputBindingArtifacts,
    });
  if (!inputBinding.ok) {
    return integrationFailure({
      stage: "binding",
      code: inputBinding.code,
    });
  }

  const normalized = adaptPolicyEvaluationCompletionToNormalizedEvaluation(
    input.policyRuntimeExecution.completion,
  );
  if (!normalized.ok) {
    return integrationFailure({
      stage: "normalized_adapter",
      code: normalized.code,
    });
  }

  const decision = decideOrganizationVerification(
    normalized.value,
    input.decisionContext,
  );
  if (!decision.ok) {
    return integrationFailure({
      stage: "decision",
      code: decision.code,
    });
  }
  if (!isOrganizationVerificationDecision(decision.value)) {
    return integrationFailure({
      stage: "execution",
      code: "unauthentic_decision",
    });
  }

  const trustStatus = deriveTrustStatusFromAuthenticDecision(
    decision.value,
    input.trustSourceFactsArtifacts,
    input.trustDerivationContext,
  );
  if (!trustStatus.ok) {
    return integrationFailure({
      stage: trustStatus.stage,
      code: trustStatus.code,
    });
  }

  const binding =
    createOrganizationVerificationDecisionTrustIntegrationBinding({
      inputBinding: inputBinding.value,
      decision: decision.value,
      trustStatus: trustStatus.value,
      artifacts: input.bindingArtifacts,
    });
  if (!binding.ok) {
    return integrationFailure({
      stage: "binding",
      code: binding.code,
    });
  }

  const decisionBoundAt = binding.value.decisionEvidence?.boundAt;
  const trustBoundAt = binding.value.trustEvidence?.boundAt;
  if (decisionBoundAt === undefined || trustBoundAt === undefined) {
    return integrationFailure({
      stage: "execution",
      code: "invalid_execution_artifacts",
    });
  }
  const chronology = validateCompletedChronology(input, {
    inputBindingBoundAt: inputBinding.value.boundAt,
    decisionDecidedAt: decision.value.decidedAt,
    decisionBoundAt,
    trustDerivationAsOf: trustStatus.value.derivationAsOf,
    trustDerivedAt: trustStatus.value.derivedAt,
    trustBoundAt,
  });
  if (!chronology.ok) return chronology;

  const fingerprint =
    createOrganizationVerificationDecisionTrustIntegrationExecutionFingerprint(
      fingerprintDecisionTrustIntegrationExecutionInternal({
        scope: "decision_trust_integration_execution",
        executionId: input.executionArtifacts.executionId,
        executionContractVersion:
          input.executionArtifacts.executionContractVersion,
        policyRuntimeExecutionId: inputBinding.value.runtimeExecutionId,
        policyRuntimeExecutionContractVersion:
          inputBinding.value.runtimeExecutionContractVersion,
        policyRuntimeExecutorVersion:
          inputBinding.value.runtimeExecutorVersion,
        policyRuntimeExecutionFingerprint:
          inputBinding.value.runtimeExecutionFingerprint,
        policyEvaluationInputId:
          inputBinding.value.policyEvaluationInputId,
        policyEvaluationInputVersion:
          inputBinding.value.policyEvaluationInputVersion,
        policyEvaluationInputFingerprint:
          inputBinding.value.policyEvaluationInputFingerprint,
        completionBindingFingerprint:
          binding.value.completionBindingFingerprint,
        decisionBindingFingerprint:
          binding.value.decisionBindingFingerprint,
        trustBindingFingerprint: binding.value.trustBindingFingerprint,
        decision: decision.value,
        trustStatus: trustStatus.value,
        startedAt: input.executionArtifacts.startedAt,
        completedAt: input.executionArtifacts.completedAt,
        provenanceReference: input.executionArtifacts.provenanceReference,
        integrityReference: input.executionArtifacts.integrityReference,
      }),
    );
  if (!fingerprint.ok) return fingerprint;
  if (
    input.executionArtifacts.expectedExecutionFingerprint !== undefined &&
    input.executionArtifacts.expectedExecutionFingerprint !==
      fingerprint.value
  ) {
    return integrationFailure({
      stage: "execution",
      code: "execution_fingerprint_mismatch",
    });
  }

  if (input.existingExecution !== undefined) {
    if (
      !isOrganizationVerificationDecisionTrustIntegrationExecution(
        input.existingExecution,
      )
    ) {
      return integrationFailure({
        stage: "execution",
        code: "conflicting_execution",
      });
    }
    if (
      input.existingExecution.executionId ===
        input.executionArtifacts.executionId &&
      input.existingExecution.executionFingerprint === fingerprint.value
    ) {
      return integrationSuccess(input.existingExecution);
    }
    return integrationFailure({
      stage: "execution",
      code:
        input.existingExecution.executionId ===
        input.executionArtifacts.executionId
          ? "conflicting_execution"
          : "duplicate_execution",
    });
  }

  return integrationSuccess(
    createOrganizationVerificationDecisionTrustIntegrationExecutionInternal({
      executionId: input.executionArtifacts.executionId,
      executionContractVersion:
        input.executionArtifacts.executionContractVersion,
      inputBinding: inputBinding.value,
      decision: decision.value,
      trustStatus: trustStatus.value,
      binding: binding.value,
      startedAt: input.executionArtifacts.startedAt,
      completedAt: input.executionArtifacts.completedAt,
      provenanceReference: input.executionArtifacts.provenanceReference,
      integrityReference: input.executionArtifacts.integrityReference,
      executionFingerprint: fingerprint.value,
    }),
  );
}
