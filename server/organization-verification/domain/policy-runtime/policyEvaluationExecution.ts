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
  createOrganizationVerificationPolicyRuntimeExecutionFingerprint,
  type OrganizationVerificationPolicyRuntimeExecutionContractVersion,
  type OrganizationVerificationPolicyRuntimeExecutionFingerprint,
  type OrganizationVerificationPolicyRuntimeExecutorVersion,
} from "./ids.js";
import { fingerprintPolicyRuntimeExecutionInternal } from "./canonical.js";
import { policyRuntimeFailure, policyRuntimeSuccess, type OrganizationVerificationPolicyRuntimeResult } from "./errors.js";
import { deepFreezeDurableValue, hasExactDurableKeys, isDurableIdentity, isDurableJsonValue, isDurablePlainObject, isDurablePositiveVersion, isDurableTimestamp } from "../durableRehydrationValidation.js";

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

function isDurablePolicyExecutionData(value: unknown): value is OrganizationVerificationPolicyEvaluationExecutionData {
  if (!isDurablePlainObject(value) || !isDurableJsonValue(value)) return false;
  const required = ["executionId", "executionContractVersion", "executorVersion", "policyEvaluationInputId", "policyEvaluationInputVersion", "policyEvaluationInputFingerprint", "policySetId", "policySetVersion", "policySetFingerprint", "implementationSetId", "implementationSetVersion", "implementationSetFingerprint", "executionArtifactsFingerprint", "startedAt", "completedAt", "provenanceReference", "integrityReference", "ruleExecutions", "findings", "completion", "executionFingerprint"];
  return hasExactDurableKeys(value, required) && required.filter((key) => !["policyEvaluationInputVersion", "implementationSetVersion", "ruleExecutions", "findings", "completion", "startedAt", "completedAt"].includes(key)).every((key) => isDurableIdentity(value[key])) &&
    isDurableIdentity(value.policyEvaluationInputVersion) && isDurableIdentity(value.implementationSetVersion) &&
    isDurableTimestamp(value.startedAt) && isDurableTimestamp(value.completedAt) && Date.parse(value.completedAt) >= Date.parse(value.startedAt) &&
    Array.isArray(value.ruleExecutions) && Array.isArray(value.findings);
}

export function rehydrateOrganizationVerificationPolicyEvaluationExecution(
  durableData: unknown,
): OrganizationVerificationPolicyRuntimeResult<OrganizationVerificationPolicyEvaluationExecution> {
  if (!isDurablePolicyExecutionData(durableData)) return policyRuntimeFailure("execution_fingerprint_mismatch");
  const { executionFingerprint, ...semantic } = durableData;
  const expected = createOrganizationVerificationPolicyRuntimeExecutionFingerprint(fingerprintPolicyRuntimeExecutionInternal(semantic));
  if (!expected.ok || expected.value !== executionFingerprint) return policyRuntimeFailure("execution_fingerprint_mismatch");
  return policyRuntimeSuccess(createOrganizationVerificationPolicyEvaluationExecutionInternal(deepFreezeDurableValue({ ...durableData })));
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
