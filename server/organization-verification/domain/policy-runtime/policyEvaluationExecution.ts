import type { OrganizationVerificationPolicyEvaluationInput } from "../evaluation-input/index.js";
import type {
  OrganizationVerificationFinding,
  OrganizationVerificationPolicyEvaluationCompletion,
  OrganizationVerificationPolicySet,
  OrganizationVerificationRuleEvaluationResult,
} from "../policy/index.js";
import type {
  OrganizationVerificationExecutionArtifactIntegrityReference,
  OrganizationVerificationExecutionArtifactProvenanceReference,
  OrganizationVerificationExecutionArtifactsFingerprint,
  OrganizationVerificationExecutionId,
  OrganizationVerificationPolicySetFingerprint,
  OrganizationVerificationRuleImplementationSetFingerprint,
  OrganizationVerificationRuleImplementationSetId,
  OrganizationVerificationRuleImplementationSetVersion,
  OrganizationVerificationRuleResultId,
} from "../policy-runtime-contract/index.js";
import {
  ORGANIZATION_VERIFICATION_POLICY_RUNTIME_EXECUTION_CONTRACT_VERSION,
  ORGANIZATION_VERIFICATION_POLICY_RUNTIME_EXECUTOR_VERSION,
  type OrganizationVerificationPolicyRuntimeExecutionContractVersion,
  type OrganizationVerificationPolicyRuntimeExecutionFingerprint,
  type OrganizationVerificationPolicyRuntimeExecutorVersion,
} from "./ids.js";

const policyRuntimeExecutionSeal = Symbol(
  "organization-verification-policy-runtime-execution",
);

export interface OrganizationVerificationExecutedRuleResult {
  readonly ruleResultId: OrganizationVerificationRuleResultId;
  readonly result: OrganizationVerificationRuleEvaluationResult;
}

export interface OrganizationVerificationPolicyEvaluationExecution {
  readonly executionId: OrganizationVerificationExecutionId;
  readonly executionContractVersion: OrganizationVerificationPolicyRuntimeExecutionContractVersion;
  readonly executorVersion: OrganizationVerificationPolicyRuntimeExecutorVersion;
  readonly policyEvaluationInputId: OrganizationVerificationPolicyEvaluationInput["policyEvaluationInputId"];
  readonly policyEvaluationInputVersion: OrganizationVerificationPolicyEvaluationInput["policyEvaluationInputVersion"];
  readonly policyEvaluationInputFingerprint: OrganizationVerificationPolicyEvaluationInput["inputFingerprint"];
  readonly policySetId: OrganizationVerificationPolicySet["policySetId"];
  readonly policySetVersion: OrganizationVerificationPolicySet["policySetVersion"];
  readonly policySetFingerprint: OrganizationVerificationPolicySetFingerprint;
  readonly implementationSetId: OrganizationVerificationRuleImplementationSetId;
  readonly implementationSetVersion: OrganizationVerificationRuleImplementationSetVersion;
  readonly implementationSetFingerprint: OrganizationVerificationRuleImplementationSetFingerprint;
  readonly executionArtifactsFingerprint: OrganizationVerificationExecutionArtifactsFingerprint;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly provenanceReference: OrganizationVerificationExecutionArtifactProvenanceReference;
  readonly integrityReference: OrganizationVerificationExecutionArtifactIntegrityReference;
  readonly ruleExecutions: readonly OrganizationVerificationExecutedRuleResult[];
  readonly findings: readonly OrganizationVerificationFinding[];
  readonly completion: OrganizationVerificationPolicyEvaluationCompletion;
  readonly executionFingerprint: OrganizationVerificationPolicyRuntimeExecutionFingerprint;
  readonly [policyRuntimeExecutionSeal]: true;
}

export type OrganizationVerificationPolicyEvaluationExecutionData = Omit<
  OrganizationVerificationPolicyEvaluationExecution,
  typeof policyRuntimeExecutionSeal
>;

export function createOrganizationVerificationPolicyEvaluationExecutionInternal(
  data: OrganizationVerificationPolicyEvaluationExecutionData,
): OrganizationVerificationPolicyEvaluationExecution {
  const execution = {
    ...data,
    executionContractVersion:
      ORGANIZATION_VERIFICATION_POLICY_RUNTIME_EXECUTION_CONTRACT_VERSION,
    executorVersion:
      ORGANIZATION_VERIFICATION_POLICY_RUNTIME_EXECUTOR_VERSION,
    ruleExecutions: Object.freeze(
      data.ruleExecutions.map((entry) => Object.freeze({ ...entry })),
    ),
    findings: Object.freeze([...data.findings]),
  } as OrganizationVerificationPolicyEvaluationExecution;
  Object.defineProperty(execution, policyRuntimeExecutionSeal, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  return Object.freeze(execution);
}

export function isOrganizationVerificationPolicyEvaluationExecution(
  value: unknown,
): value is OrganizationVerificationPolicyEvaluationExecution {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Partial<OrganizationVerificationPolicyEvaluationExecution>)[
      policyRuntimeExecutionSeal
    ] === true &&
    Object.isFrozen(value)
  );
}
