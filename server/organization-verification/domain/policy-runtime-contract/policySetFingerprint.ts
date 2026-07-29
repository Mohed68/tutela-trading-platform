import {
  isOrganizationVerificationPolicySet,
  type OrganizationVerificationPolicySet,
} from "../policy/index.js";
import {
  runtimeContractFailure,
  runtimeContractSuccess,
  type OrganizationVerificationPolicyRuntimeContractResult,
} from "./errors.js";
import {
  createOrganizationVerificationPolicySetFingerprint,
  type OrganizationVerificationPolicySetFingerprint,
} from "./ids.js";
import { fingerprintInternal } from "./canonical.js";

function policySetFingerprintData(
  policySet: OrganizationVerificationPolicySet,
): Readonly<Record<string, unknown>> {
  return {
    policySetId: policySet.policySetId,
    policySetVersion: policySet.policySetVersion,
    policyContractVersion: policySet.policyContractVersion,
    name: policySet.name,
    effectiveFrom: policySet.effectiveFrom,
    effectiveUntil: policySet.effectiveUntil,
    rules: policySet.rules.map((reference) => ({
      ruleId: reference.ruleId,
      ruleVersion: reference.ruleVersion,
      required: reference.required,
      evaluationOrder: reference.evaluationOrder,
    })),
    evaluationContractVersion: policySet.evaluationContractVersion,
    provenanceReference: policySet.provenanceReference,
    integrityReference: policySet.integrityReference,
    applicabilityMetadata: policySet.applicabilityMetadata
      ? {
          jurisdictionCodes: [
            ...policySet.applicabilityMetadata.jurisdictionCodes,
          ],
        }
      : undefined,
    status: policySet.status,
  };
}

export function fingerprintOrganizationVerificationPolicySet(
  policySet: unknown,
): OrganizationVerificationPolicyRuntimeContractResult<OrganizationVerificationPolicySetFingerprint> {
  if (!isOrganizationVerificationPolicySet(policySet)) {
    return runtimeContractFailure("unauthentic_policy_set");
  }
  const parsed = createOrganizationVerificationPolicySetFingerprint(
    fingerprintInternal(policySetFingerprintData(policySet)),
  );
  return parsed.ok
    ? runtimeContractSuccess(parsed.value)
    : runtimeContractFailure("invalid_runtime_contract_digest");
}
