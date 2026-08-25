import type { OrganizationId } from "../../../organization-registry/index.js";
import type {
  CorrelationId,
  OrganizationVerificationAttemptId,
  OrganizationVerificationRecordId,
  OrganizationVerificationRevisionId,
  SnapshotFingerprint,
  SnapshotId,
} from "../index.js";
import type {
  OrganizationVerificationPolicyEvaluationCompletionId,
  OrganizationVerificationPolicyEvaluationIntegrityReference,
  OrganizationVerificationPolicyProvenanceReference,
  OrganizationVerificationPolicySetId,
  OrganizationVerificationPolicySetVersion,
  PolicyEvaluationContractVersion,
} from "./ids.js";
import type { OrganizationVerificationPolicyCategory } from "./reasonCode.js";
import type { OrganizationVerificationRuleEvaluationResult } from "./ruleEvaluationResult.js";
import {
  deepFreezeDurableValue,
  hasExactDurableKeys,
  isDurableIdentity,
  isDurablePlainObject,
  isDurableTimestamp,
} from "../durableRehydrationValidation.js";
import { policyFailure, policySuccess, type PolicyDomainResult } from "./errors.js";

const policyEvaluationCompletionSeal: unique symbol = Symbol(
  "organization_verification_policy_evaluation_completion",
);

export const ORGANIZATION_VERIFICATION_POLICY_EVALUATION_CLASSIFICATIONS = [
  "approval_ready",
  "revision_required",
  "manual_review_required",
  "rejection_required",
] as const;

declare const policyEvaluationClassificationBrand: unique symbol;
type PolicyEvaluationClassificationLiteral =
  (typeof ORGANIZATION_VERIFICATION_POLICY_EVALUATION_CLASSIFICATIONS)[number];
export type OrganizationVerificationPolicyEvaluationClassification =
  PolicyEvaluationClassificationLiteral & {
    readonly [policyEvaluationClassificationBrand]: "OrganizationVerificationPolicyEvaluationClassification";
  };

export interface OrganizationVerificationPolicyCategorySummary {
  readonly category: OrganizationVerificationPolicyCategory;
  readonly ruleCount: number;
  readonly findingCount: number;
  readonly dispositions: Readonly<{
    readonly satisfied: number;
    readonly informational: number;
    readonly revision_required: number;
    readonly manual_review_required: number;
    readonly rejection_required: number;
    readonly evaluation_error: number;
  }>;
}

export interface OrganizationVerificationPolicyFindingSummary {
  readonly ruleResultCount: number;
  readonly findingCount: number;
  readonly categorySummaries: readonly OrganizationVerificationPolicyCategorySummary[];
}

export interface OrganizationVerificationPolicyEvaluationCompletion {
  readonly evaluationCompletionId: OrganizationVerificationPolicyEvaluationCompletionId;
  readonly policySetId: OrganizationVerificationPolicySetId;
  readonly policySetVersion: OrganizationVerificationPolicySetVersion;
  readonly policyContractVersion: PolicyEvaluationContractVersion;
  readonly organizationId: OrganizationId;
  readonly recordId: OrganizationVerificationRecordId;
  readonly revisionId: OrganizationVerificationRevisionId;
  readonly attemptId: OrganizationVerificationAttemptId;
  readonly snapshotId: SnapshotId;
  readonly snapshotFingerprint: SnapshotFingerprint;
  readonly ruleResults: readonly OrganizationVerificationRuleEvaluationResult[];
  readonly findingSummary: OrganizationVerificationPolicyFindingSummary;
  readonly evaluationStartedAt: string;
  readonly evaluationCompletedAt: string;
  readonly completionIntegrityValid: true;
  readonly completionComplete: true;
  readonly classification: OrganizationVerificationPolicyEvaluationClassification;
  readonly provenanceReference: OrganizationVerificationPolicyProvenanceReference;
  readonly correlationId: CorrelationId;
  readonly integrityReference: OrganizationVerificationPolicyEvaluationIntegrityReference;
  readonly [policyEvaluationCompletionSeal]: true;
}

export type OrganizationVerificationPolicyEvaluationCompletionData = Omit<
  OrganizationVerificationPolicyEvaluationCompletion,
  typeof policyEvaluationCompletionSeal
>;

function freezeSummary(
  summary: OrganizationVerificationPolicyFindingSummary,
): OrganizationVerificationPolicyFindingSummary {
  return Object.freeze({
    ruleResultCount: summary.ruleResultCount,
    findingCount: summary.findingCount,
    categorySummaries: Object.freeze(
      summary.categorySummaries.map((category) =>
        Object.freeze({
          ...category,
          dispositions: Object.freeze({ ...category.dispositions }),
        }),
      ),
    ),
  });
}

export function createOrganizationVerificationPolicyEvaluationCompletionInternal(
  input: OrganizationVerificationPolicyEvaluationCompletionData,
): OrganizationVerificationPolicyEvaluationCompletion {
  return Object.freeze({
    ...input,
    ruleResults: Object.freeze([...input.ruleResults]),
    findingSummary: freezeSummary(input.findingSummary),
    [policyEvaluationCompletionSeal]: true as const,
  });
}

function isDurablePolicyEvaluationCompletionData(
  durableData: unknown,
): durableData is OrganizationVerificationPolicyEvaluationCompletionData {
  const keys = [
    "evaluationCompletionId", "policySetId", "policySetVersion",
    "policyContractVersion", "organizationId", "recordId", "revisionId",
    "attemptId", "snapshotId", "snapshotFingerprint", "ruleResults",
    "findingSummary", "evaluationStartedAt", "evaluationCompletedAt",
    "completionIntegrityValid", "completionComplete", "classification",
    "provenanceReference", "correlationId", "integrityReference",
  ];
  if (
    !isDurablePlainObject(durableData) ||
    !hasExactDurableKeys(durableData, keys) ||
    !keys.filter((key) => ![
      "ruleResults", "findingSummary", "evaluationStartedAt",
      "evaluationCompletedAt", "completionIntegrityValid", "completionComplete",
    ].includes(key)).every((key) => isDurableIdentity(durableData[key])) ||
    !Array.isArray(durableData.ruleResults) ||
    !isDurablePlainObject(durableData.findingSummary) ||
    !isDurableTimestamp(durableData.evaluationStartedAt) ||
    !isDurableTimestamp(durableData.evaluationCompletedAt) ||
    Date.parse(durableData.evaluationCompletedAt) < Date.parse(durableData.evaluationStartedAt) ||
    durableData.completionIntegrityValid !== true ||
    durableData.completionComplete !== true ||
    !ORGANIZATION_VERIFICATION_POLICY_EVALUATION_CLASSIFICATIONS.some(
      (classification) => classification === durableData.classification,
    )
  ) {
    return false;
  }
  return true;
}

export function rehydrateOrganizationVerificationPolicyEvaluationCompletion(
  durableData: unknown,
): PolicyDomainResult<OrganizationVerificationPolicyEvaluationCompletion> {
  if (!isDurablePolicyEvaluationCompletionData(durableData)) {
    return policyFailure("normalized_evaluation_adapter_failure");
  }
  const frozen = deepFreezeDurableValue(durableData);
  return policySuccess(
    createOrganizationVerificationPolicyEvaluationCompletionInternal(frozen),
  );
}

export function readOrganizationVerificationPolicyEvaluationCompletion(
  input: OrganizationVerificationPolicyEvaluationCompletion,
): OrganizationVerificationPolicyEvaluationCompletion {
  if (
    input[policyEvaluationCompletionSeal] !== true ||
    !Object.isFrozen(input) ||
    !Object.isFrozen(input.ruleResults) ||
    !Object.isFrozen(input.findingSummary) ||
    !Object.isFrozen(input.findingSummary.categorySummaries) ||
    input.findingSummary.categorySummaries.some(
      (category) =>
        !Object.isFrozen(category) || !Object.isFrozen(category.dispositions),
    )
  ) {
    throw new TypeError(
      "SEALED_ORGANIZATION_VERIFICATION_POLICY_EVALUATION_COMPLETION_REQUIRED",
    );
  }
  return input;
}

export function policyEvaluationClassification(
  value: PolicyEvaluationClassificationLiteral,
): OrganizationVerificationPolicyEvaluationClassification {
  return value as OrganizationVerificationPolicyEvaluationClassification;
}
