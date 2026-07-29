import type {
  OrganizationVerificationFindingDisposition,
  OrganizationVerificationPolicySetId,
  OrganizationVerificationPolicySetVersion,
  OrganizationVerificationRuleId,
  OrganizationVerificationRuleVersion,
} from "../policy/index.js";
import type { OrganizationVerificationPolicyEvaluationFactView } from "./policyEvaluationFactView.js";
import { fingerprintInternal } from "./canonical.js";
import {
  runtimeContractFailure,
  runtimeContractSuccess,
  type OrganizationVerificationPolicyRuntimeContractResult,
} from "./errors.js";
import {
  ORGANIZATION_VERIFICATION_RULE_IMPLEMENTATION_CONTRACT_VERSION,
  createOrganizationVerificationRuleImplementationFingerprint,
  type OrganizationVerificationRuleImplementationContractVersion,
  type OrganizationVerificationRuleImplementationDigest,
  type OrganizationVerificationRuleImplementationFingerprint,
  type OrganizationVerificationRuleImplementationIntegrityReference,
  type OrganizationVerificationRuleImplementationProvenanceReference,
  type OrganizationVerificationRuleImplementationVersion,
} from "./ids.js";

const ruleImplementationSeal = Symbol(
  "organization-verification-rule-implementation",
);

export type OrganizationVerificationRuleEvaluator = (
  facts: OrganizationVerificationPolicyEvaluationFactView,
) => OrganizationVerificationFindingDisposition;

export interface OrganizationVerificationRuleImplementation {
  readonly ruleId: OrganizationVerificationRuleId;
  readonly ruleVersion: OrganizationVerificationRuleVersion;
  readonly policySetId: OrganizationVerificationPolicySetId;
  readonly policySetVersion: OrganizationVerificationPolicySetVersion;
  readonly implementationContractVersion: OrganizationVerificationRuleImplementationContractVersion;
  readonly implementationVersion: OrganizationVerificationRuleImplementationVersion;
  readonly implementationDigest: OrganizationVerificationRuleImplementationDigest;
  readonly implementationFingerprint: OrganizationVerificationRuleImplementationFingerprint;
  readonly provenanceReference: OrganizationVerificationRuleImplementationProvenanceReference;
  readonly integrityReference: OrganizationVerificationRuleImplementationIntegrityReference;
  readonly evaluate: OrganizationVerificationRuleEvaluator;
  readonly [ruleImplementationSeal]: true;
}

export interface CreateOrganizationVerificationRuleImplementationInput
  extends Omit<
    OrganizationVerificationRuleImplementation,
    | "implementationContractVersion"
    | "implementationFingerprint"
    | typeof ruleImplementationSeal
  > {
  readonly implementationContractVersion: unknown;
}

function validIdentity(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    !["latest", "current", "default", "head"].includes(
      value.trim().toLowerCase(),
    )
  );
}

export function createOrganizationVerificationRuleImplementation(
  input: CreateOrganizationVerificationRuleImplementationInput,
): OrganizationVerificationPolicyRuntimeContractResult<OrganizationVerificationRuleImplementation> {
  if (
    input.implementationContractVersion !==
    ORGANIZATION_VERIFICATION_RULE_IMPLEMENTATION_CONTRACT_VERSION
  ) {
    return runtimeContractFailure("invalid_runtime_contract_version");
  }
  if (
    !validIdentity(input.ruleId) ||
    !validIdentity(input.ruleVersion) ||
    !validIdentity(input.policySetId) ||
    !validIdentity(input.policySetVersion) ||
    !validIdentity(input.implementationVersion) ||
    !validIdentity(input.provenanceReference) ||
    typeof input.evaluate !== "function" ||
    !/^[a-f0-9]{64}$/.test(input.implementationDigest) ||
    !validIdentity(input.integrityReference)
  ) {
    return runtimeContractFailure("invalid_runtime_contract_identity");
  }

  const fingerprint = createOrganizationVerificationRuleImplementationFingerprint(
    fingerprintInternal({
      ruleId: input.ruleId,
      ruleVersion: input.ruleVersion,
      policySetId: input.policySetId,
      policySetVersion: input.policySetVersion,
      implementationContractVersion:
        ORGANIZATION_VERIFICATION_RULE_IMPLEMENTATION_CONTRACT_VERSION,
      implementationVersion: input.implementationVersion,
      implementationDigest: input.implementationDigest,
      provenanceReference: input.provenanceReference,
      integrityReference: input.integrityReference,
    }),
  );
  if (!fingerprint.ok) {
    return runtimeContractFailure("invalid_runtime_contract_digest");
  }

  const implementation = {
    ruleId: input.ruleId,
    ruleVersion: input.ruleVersion,
    policySetId: input.policySetId,
    policySetVersion: input.policySetVersion,
    implementationContractVersion:
      ORGANIZATION_VERIFICATION_RULE_IMPLEMENTATION_CONTRACT_VERSION,
    implementationVersion: input.implementationVersion,
    implementationDigest: input.implementationDigest,
    implementationFingerprint: fingerprint.value,
    provenanceReference: input.provenanceReference,
    integrityReference: input.integrityReference,
    evaluate: input.evaluate,
  } as OrganizationVerificationRuleImplementation;
  Object.defineProperty(implementation, ruleImplementationSeal, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  return runtimeContractSuccess(Object.freeze(implementation));
}

export function isOrganizationVerificationRuleImplementation(
  value: unknown,
): value is OrganizationVerificationRuleImplementation {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Partial<OrganizationVerificationRuleImplementation>)[
      ruleImplementationSeal
    ] === true &&
    Object.isFrozen(value)
  );
}
