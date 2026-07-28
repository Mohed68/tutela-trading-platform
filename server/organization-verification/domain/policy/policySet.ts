import {
  policyFailure,
  policySuccess,
  type PolicyDomainResult,
} from "./errors.js";
import {
  POLICY_CONTRACT_VERSION,
  POLICY_EVALUATION_CONTRACT_VERSION,
  parsePolicyContractVersion,
  parsePolicyEvaluationContractVersion,
  type OrganizationVerificationPolicyProvenanceReference,
  type OrganizationVerificationPolicySetId,
  type OrganizationVerificationPolicySetIntegrityReference,
  type OrganizationVerificationPolicySetVersion,
  type OrganizationVerificationRuleId,
  type OrganizationVerificationRuleVersion,
  type PolicyContractVersion,
  type PolicyEvaluationContractVersion,
} from "./ids.js";

export const ORGANIZATION_VERIFICATION_POLICY_SET_STATUSES = [
  "active",
  "inactive",
] as const;

export type OrganizationVerificationPolicySetStatus =
  (typeof ORGANIZATION_VERIFICATION_POLICY_SET_STATUSES)[number];

export interface OrganizationVerificationPolicyRuleReference {
  readonly ruleId: OrganizationVerificationRuleId;
  readonly ruleVersion: OrganizationVerificationRuleVersion;
  readonly required: boolean;
  readonly evaluationOrder: number;
}

export interface OrganizationVerificationPolicySet {
  readonly policySetId: OrganizationVerificationPolicySetId;
  readonly policySetVersion: OrganizationVerificationPolicySetVersion;
  readonly policyContractVersion: PolicyContractVersion;
  readonly name: string;
  readonly effectiveFrom: string;
  readonly effectiveUntil?: string;
  readonly rules: readonly OrganizationVerificationPolicyRuleReference[];
  readonly evaluationContractVersion: PolicyEvaluationContractVersion;
  readonly provenanceReference: OrganizationVerificationPolicyProvenanceReference;
  readonly integrityReference: OrganizationVerificationPolicySetIntegrityReference;
  readonly applicabilityMetadata?: Readonly<{
    readonly jurisdictionCodes: readonly string[];
  }>;
  readonly status: OrganizationVerificationPolicySetStatus;
}

export interface CreateOrganizationVerificationPolicySetInput {
  readonly policySetId: OrganizationVerificationPolicySetId;
  readonly policySetVersion: OrganizationVerificationPolicySetVersion;
  readonly policyContractVersion: unknown;
  readonly name: unknown;
  readonly effectiveFrom: unknown;
  readonly effectiveUntil?: unknown;
  readonly rules: readonly OrganizationVerificationPolicyRuleReference[];
  readonly evaluationContractVersion: unknown;
  readonly provenanceReference: OrganizationVerificationPolicyProvenanceReference;
  readonly integrityReference: OrganizationVerificationPolicySetIntegrityReference;
  readonly applicabilityMetadata?: {
    readonly jurisdictionCodes: readonly string[];
  };
  readonly status: unknown;
}

function validExactIdentity(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    !["latest", "current", "head", "default"].includes(
      value.trim().toLowerCase(),
    )
  );
}

function validTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    Number.isFinite(Date.parse(value))
  );
}

export function createOrganizationVerificationPolicySet(
  input: CreateOrganizationVerificationPolicySetInput,
): PolicyDomainResult<OrganizationVerificationPolicySet> {
  if (!validExactIdentity(input.policySetId)) {
    return policyFailure("invalid_policy_set_id");
  }
  if (!validExactIdentity(input.policySetVersion)) {
    return policyFailure("invalid_policy_set_version");
  }
  const policyContract = parsePolicyContractVersion(input.policyContractVersion);
  if (!policyContract.ok) return policyContract;
  const evaluationContract = parsePolicyEvaluationContractVersion(
    input.evaluationContractVersion,
  );
  if (!evaluationContract.ok) return evaluationContract;
  if (
    typeof input.name !== "string" ||
    input.name.trim().length === 0 ||
    !validTimestamp(input.effectiveFrom) ||
    !validExactIdentity(input.provenanceReference) ||
    !validExactIdentity(input.integrityReference)
  ) {
    return policyFailure("invalid_policy_set_id");
  }
  if (
    input.effectiveUntil !== undefined &&
    (!validTimestamp(input.effectiveUntil) ||
      Date.parse(input.effectiveUntil) <= Date.parse(input.effectiveFrom))
  ) {
    return policyFailure("invalid_evaluation_chronology");
  }
  if (!ORGANIZATION_VERIFICATION_POLICY_SET_STATUSES.includes(input.status as never)) {
    return policyFailure("invalid_policy_set_status");
  }
  if (!Array.isArray(input.rules) || input.rules.length === 0) {
    return policyFailure("required_rule_missing");
  }

  const ruleIds = new Set<string>();
  const ruleOrders = new Set<number>();
  const rules: OrganizationVerificationPolicyRuleReference[] = [];
  for (const [index, reference] of input.rules.entries()) {
    if (
      !validExactIdentity(reference.ruleId) ||
      !validExactIdentity(reference.ruleVersion) ||
      typeof reference.required !== "boolean" ||
      !Number.isSafeInteger(reference.evaluationOrder) ||
      reference.evaluationOrder <= 0
    ) {
      return policyFailure("policy_set_rule_mismatch", `rules.${index}`);
    }
    if (
      ruleIds.has(reference.ruleId) ||
      ruleOrders.has(reference.evaluationOrder)
    ) {
      return policyFailure("duplicate_rule_reference", `rules.${index}`);
    }
    ruleIds.add(reference.ruleId);
    ruleOrders.add(reference.evaluationOrder);
    rules.push(Object.freeze({ ...reference }));
  }
  rules.sort((left, right) => left.evaluationOrder - right.evaluationOrder);

  let applicabilityMetadata:
    | OrganizationVerificationPolicySet["applicabilityMetadata"]
    | undefined;
  if (input.applicabilityMetadata !== undefined) {
    const jurisdictions = input.applicabilityMetadata.jurisdictionCodes;
    if (
      !Array.isArray(jurisdictions) ||
      jurisdictions.some(
        (value) =>
          typeof value !== "string" ||
          !/^[A-Z]{2}$/.test(value),
      ) ||
      new Set(jurisdictions).size !== jurisdictions.length
    ) {
      return policyFailure("invalid_policy_set_id");
    }
    applicabilityMetadata = Object.freeze({
      jurisdictionCodes: Object.freeze([...jurisdictions]),
    });
  }

  return policySuccess(
    Object.freeze({
      policySetId: input.policySetId,
      policySetVersion: input.policySetVersion,
      policyContractVersion: POLICY_CONTRACT_VERSION,
      name: input.name,
      effectiveFrom: input.effectiveFrom,
      ...(input.effectiveUntil
        ? { effectiveUntil: input.effectiveUntil }
        : {}),
      rules: Object.freeze(rules),
      evaluationContractVersion: POLICY_EVALUATION_CONTRACT_VERSION,
      provenanceReference: input.provenanceReference,
      integrityReference: input.integrityReference,
      ...(applicabilityMetadata ? { applicabilityMetadata } : {}),
      status: input.status as OrganizationVerificationPolicySetStatus,
    }),
  );
}
