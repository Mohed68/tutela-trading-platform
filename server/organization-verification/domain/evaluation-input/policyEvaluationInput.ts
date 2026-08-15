import type { OrganizationVerificationEvaluationProjection } from "../evaluation-projection/index.js";
import type { OrganizationVerificationEvaluationContext } from "./evaluationContext.js";
import type { OrganizationVerificationEvaluationScope } from "./evaluationScope.js";
import type {
  OrganizationVerificationPolicyEvaluationInputFingerprint,
  OrganizationVerificationPolicyEvaluationInputId,
  OrganizationVerificationPolicyEvaluationInputVersion,
  PolicyEvaluationInputBuilderVersion,
  PolicyEvaluationInputContractVersion,
} from "./ids.js";
import type { OrganizationVerificationPolicySetBinding } from "./policySetBinding.js";
import { inputFailure, inputSuccess, type PolicyEvaluationInputDomainResult } from "./errors.js";
import { computePolicyEvaluationInputFingerprintInternal } from "./evaluationInputCanonicalization.js";
import { deepFreezeDurableValue, hasExactDurableKeys, isDurableIdentity, isDurableJsonValue, isDurablePlainObject, isDurablePositiveVersion, isDurableTimestamp } from "../durableRehydrationValidation.js";

const policyEvaluationInputSeal = Symbol(
  "organization-verification-policy-evaluation-input",
);

type Projection = OrganizationVerificationEvaluationProjection;

export interface OrganizationVerificationEvaluationProjectionBinding {
  readonly evaluationProjectionId: Projection["evaluationProjectionId"];
  readonly evaluationProjectionVersion: Projection["evaluationProjectionVersion"];
  readonly projectionContractVersion: Projection["projectionContractVersion"];
  readonly projectionSchemaVersion: Projection["projectionSchemaVersion"];
  readonly projectionFingerprint: Projection["projectionFingerprint"];
  readonly sourceSnapshotId: Projection["source"]["evidenceSnapshotId"];
  readonly sourceSnapshotFingerprint: Projection["source"]["snapshotFingerprint"];
  readonly organizationId: Projection["identity"]["organizationId"];
  readonly recordId: Projection["identity"]["recordId"];
  readonly revisionId: Projection["identity"]["revisionId"];
  readonly profileRevisionId: Projection["identity"]["profileRevisionId"];
  readonly attemptId: OrganizationVerificationEvaluationContext["attemptId"];
}

export interface OrganizationVerificationPolicyEvaluationFactSurface {
  readonly registryFacts?: Projection["registryFacts"];
  readonly submissionFacts?: Projection["submissionFacts"];
  readonly evidenceFacts?: Projection["evidenceFacts"];
}

export interface OrganizationVerificationPolicyEvaluationInput {
  readonly policyEvaluationInputId: OrganizationVerificationPolicyEvaluationInputId;
  readonly policyEvaluationInputVersion: OrganizationVerificationPolicyEvaluationInputVersion;
  readonly inputContractVersion: PolicyEvaluationInputContractVersion;
  readonly inputBuilderVersion: PolicyEvaluationInputBuilderVersion;
  readonly projectionBinding: OrganizationVerificationEvaluationProjectionBinding;
  readonly policySetBinding: OrganizationVerificationPolicySetBinding;
  readonly evaluationContext: OrganizationVerificationEvaluationContext;
  readonly evaluationScope: OrganizationVerificationEvaluationScope;
  readonly factSurface: OrganizationVerificationPolicyEvaluationFactSurface;
  readonly createdAt: string;
  readonly inputFingerprint: OrganizationVerificationPolicyEvaluationInputFingerprint;
  readonly [policyEvaluationInputSeal]: true;
}

export type OrganizationVerificationPolicyEvaluationInputData = Omit<
  OrganizationVerificationPolicyEvaluationInput,
  typeof policyEvaluationInputSeal
>;

export function createOrganizationVerificationPolicyEvaluationInputInternal(
  data: OrganizationVerificationPolicyEvaluationInputData,
): OrganizationVerificationPolicyEvaluationInput {
  const policyEvaluationInput = {
    ...data,
  } as OrganizationVerificationPolicyEvaluationInput;
  Object.defineProperty(policyEvaluationInput, policyEvaluationInputSeal, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  return Object.freeze(policyEvaluationInput);
}

function isDurablePolicyEvaluationInputData(value: unknown): value is OrganizationVerificationPolicyEvaluationInputData {
  if (!isDurablePlainObject(value) || !isDurableJsonValue(value)) return false;
  const required = ["policyEvaluationInputId", "policyEvaluationInputVersion", "inputContractVersion", "inputBuilderVersion", "projectionBinding", "policySetBinding", "evaluationContext", "evaluationScope", "factSurface", "createdAt", "inputFingerprint"];
  return hasExactDurableKeys(value, required) &&
    ["policyEvaluationInputId", "inputContractVersion", "inputBuilderVersion", "inputFingerprint"].every((key) => isDurableIdentity(value[key])) &&
    isDurableIdentity(value.policyEvaluationInputVersion) && isDurableTimestamp(value.createdAt);
}

export function rehydrateOrganizationVerificationPolicyEvaluationInput(
  durableData: unknown,
): PolicyEvaluationInputDomainResult<OrganizationVerificationPolicyEvaluationInput> {
  if (!isDurablePolicyEvaluationInputData(durableData)) return inputFailure("policy_evaluation_input_construction_failure");
  const { inputFingerprint, ...semantic } = durableData;
  if (computePolicyEvaluationInputFingerprintInternal(semantic) !== inputFingerprint) return inputFailure("invalid_evaluation_input_fingerprint");
  return inputSuccess(createOrganizationVerificationPolicyEvaluationInputInternal(deepFreezeDurableValue({ ...durableData })));
}

export function readOrganizationVerificationPolicyEvaluationInputInternal(
  value: unknown,
): OrganizationVerificationPolicyEvaluationInput | undefined {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Partial<OrganizationVerificationPolicyEvaluationInput>)[
      policyEvaluationInputSeal
    ] === true &&
    Object.isFrozen(value)
  )
    ? (value as OrganizationVerificationPolicyEvaluationInput)
    : undefined;
}

export function isOrganizationVerificationPolicyEvaluationInput(
  value: unknown,
): value is OrganizationVerificationPolicyEvaluationInput {
  return readOrganizationVerificationPolicyEvaluationInputInternal(value) !==
    undefined;
}
