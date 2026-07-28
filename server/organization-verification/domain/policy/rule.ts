import {
  policyFailure,
  policySuccess,
  type PolicyDomainResult,
} from "./errors.js";
import {
  RULE_CONTRACT_VERSION,
  parseRuleContractVersion,
  type OrganizationVerificationPolicyProvenanceReference,
  type OrganizationVerificationPolicySetId,
  type OrganizationVerificationPolicySetVersion,
  type OrganizationVerificationRuleId,
  type OrganizationVerificationRuleIntegrityReference,
  type OrganizationVerificationRuleVersion,
  type RuleContractVersion,
} from "./ids.js";
import {
  createOrganizationVerificationPolicyCategory,
  createOrganizationVerificationReasonCode,
  type OrganizationVerificationPolicyCategory,
  type OrganizationVerificationReasonCode,
} from "./reasonCode.js";
import {
  parseOrganizationVerificationFindingSeverity,
  type OrganizationVerificationFindingSeverity,
} from "./severity.js";
import {
  parseOrganizationVerificationFindingDisposition,
  type OrganizationVerificationFindingDisposition,
} from "./disposition.js";

export interface OrganizationVerificationRule {
  readonly ruleId: OrganizationVerificationRuleId;
  readonly ruleVersion: OrganizationVerificationRuleVersion;
  readonly policySetId: OrganizationVerificationPolicySetId;
  readonly policySetVersion: OrganizationVerificationPolicySetVersion;
  readonly ruleContractVersion: RuleContractVersion;
  readonly title: string;
  readonly normalizedCategory: OrganizationVerificationPolicyCategory;
  readonly severity: OrganizationVerificationFindingSeverity;
  readonly evaluationDisposition: OrganizationVerificationFindingDisposition;
  readonly reasonCode: OrganizationVerificationReasonCode;
  readonly required: boolean;
  readonly evaluationOrder: number;
  readonly provenanceReference: OrganizationVerificationPolicyProvenanceReference;
  readonly integrityReference: OrganizationVerificationRuleIntegrityReference;
}

export interface CreateOrganizationVerificationRuleInput {
  readonly ruleId: OrganizationVerificationRuleId;
  readonly ruleVersion: OrganizationVerificationRuleVersion;
  readonly policySetId: OrganizationVerificationPolicySetId;
  readonly policySetVersion: OrganizationVerificationPolicySetVersion;
  readonly ruleContractVersion: unknown;
  readonly title: unknown;
  readonly normalizedCategory: unknown;
  readonly severity: unknown;
  readonly evaluationDisposition: unknown;
  readonly reasonCode: unknown;
  readonly required: unknown;
  readonly evaluationOrder: unknown;
  readonly provenanceReference: OrganizationVerificationPolicyProvenanceReference;
  readonly integrityReference: OrganizationVerificationRuleIntegrityReference;
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

export function createOrganizationVerificationRule(
  input: CreateOrganizationVerificationRuleInput,
): PolicyDomainResult<OrganizationVerificationRule> {
  if (!validExactIdentity(input.ruleId)) {
    return policyFailure("invalid_rule_id");
  }
  if (!validExactIdentity(input.ruleVersion)) {
    return policyFailure("invalid_rule_version");
  }
  if (!validExactIdentity(input.policySetId)) {
    return policyFailure("invalid_policy_set_id");
  }
  if (!validExactIdentity(input.policySetVersion)) {
    return policyFailure("invalid_policy_set_version");
  }
  const contractVersion = parseRuleContractVersion(input.ruleContractVersion);
  if (!contractVersion.ok) return contractVersion;
  if (
    typeof input.title !== "string" ||
    input.title.trim().length === 0 ||
    typeof input.required !== "boolean" ||
    !Number.isSafeInteger(input.evaluationOrder) ||
    Number(input.evaluationOrder) <= 0 ||
    !validExactIdentity(input.provenanceReference) ||
    !validExactIdentity(input.integrityReference)
  ) {
    return policyFailure("invalid_rule_id");
  }
  const category = createOrganizationVerificationPolicyCategory(
    input.normalizedCategory,
  );
  if (!category.ok) return category;
  const severity = parseOrganizationVerificationFindingSeverity(
    input.severity,
  );
  if (!severity.ok) return severity;
  const disposition = parseOrganizationVerificationFindingDisposition(
    input.evaluationDisposition,
  );
  if (!disposition.ok) return disposition;
  const reasonCode = createOrganizationVerificationReasonCode(input.reasonCode);
  if (!reasonCode.ok) return reasonCode;

  return policySuccess(
    Object.freeze({
      ruleId: input.ruleId,
      ruleVersion: input.ruleVersion,
      policySetId: input.policySetId,
      policySetVersion: input.policySetVersion,
      ruleContractVersion: RULE_CONTRACT_VERSION,
      title: input.title,
      normalizedCategory: category.value,
      severity: severity.value,
      evaluationDisposition: disposition.value,
      reasonCode: reasonCode.value,
      required: input.required,
      evaluationOrder: Number(input.evaluationOrder),
      provenanceReference: input.provenanceReference,
      integrityReference: input.integrityReference,
    }),
  );
}
