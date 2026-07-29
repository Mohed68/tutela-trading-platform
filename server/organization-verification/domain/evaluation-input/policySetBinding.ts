import {
  POLICY_CONTRACT_VERSION,
  type OrganizationVerificationPolicyProvenanceReference,
  type OrganizationVerificationPolicySetId,
  type OrganizationVerificationPolicySetIntegrityReference,
  type OrganizationVerificationPolicySetVersion,
  type PolicyContractVersion,
} from "../policy/index.js";
import {
  inputFailure,
  inputSuccess,
  type PolicyEvaluationInputDomainResult,
} from "./errors.js";
import { isExactEvaluationInputIdentityInternal } from "./ids.js";

export interface OrganizationVerificationPolicySetBinding {
  readonly policySetId: OrganizationVerificationPolicySetId;
  readonly policySetVersion: OrganizationVerificationPolicySetVersion;
  readonly policyContractVersion: PolicyContractVersion;
  readonly provenanceReference: OrganizationVerificationPolicyProvenanceReference;
  readonly integrityReference: OrganizationVerificationPolicySetIntegrityReference;
}

export interface CreateOrganizationVerificationPolicySetBindingInput {
  readonly policySetId: OrganizationVerificationPolicySetId;
  readonly policySetVersion: OrganizationVerificationPolicySetVersion;
  readonly policyContractVersion: unknown;
  readonly provenanceReference: OrganizationVerificationPolicyProvenanceReference;
  readonly integrityReference: OrganizationVerificationPolicySetIntegrityReference;
}

export function createOrganizationVerificationPolicySetBinding(
  input: CreateOrganizationVerificationPolicySetBindingInput,
): PolicyEvaluationInputDomainResult<OrganizationVerificationPolicySetBinding> {
  if (
    !isExactEvaluationInputIdentityInternal(input.policySetId) ||
    !isExactEvaluationInputIdentityInternal(input.policySetVersion)
  ) {
    const mutablePointer = [input.policySetId, input.policySetVersion].some(
      (value) =>
        ["latest", "current", "head", "default"].includes(
          String(value).trim().toLowerCase(),
        ),
    );
    return inputFailure(
      mutablePointer
        ? "mutable_policy_set_pointer_rejected"
        : "invalid_policy_set_binding",
    );
  }
  if (input.policyContractVersion !== POLICY_CONTRACT_VERSION) {
    return inputFailure("unsupported_policy_set_version");
  }
  if (
    !isExactEvaluationInputIdentityInternal(input.provenanceReference) ||
    !isExactEvaluationInputIdentityInternal(input.integrityReference)
  ) {
    return inputFailure("invalid_policy_set_binding");
  }
  return inputSuccess(
    Object.freeze({
      policySetId: input.policySetId,
      policySetVersion: input.policySetVersion,
      policyContractVersion: POLICY_CONTRACT_VERSION,
      provenanceReference: input.provenanceReference,
      integrityReference: input.integrityReference,
    }),
  );
}
