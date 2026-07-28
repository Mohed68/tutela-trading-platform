import {
  policyFailure,
  policySuccess,
  type PolicyDomainResult,
} from "./errors.js";
import type { OrganizationVerificationPolicyEvaluationInput } from "./evaluationInput.js";
import type {
  OrganizationVerificationPolicyEvaluationCompletionId,
  OrganizationVerificationPolicyEvaluationIntegrityReference,
  OrganizationVerificationPolicyProvenanceReference,
} from "./ids.js";
import { POLICY_EVALUATION_CONTRACT_VERSION } from "./ids.js";
import {
  createOrganizationVerificationPolicyEvaluationCompletionInternal,
  policyEvaluationClassification,
  readOrganizationVerificationPolicyEvaluationCompletion,
  type OrganizationVerificationPolicyCategorySummary,
  type OrganizationVerificationPolicyEvaluationClassification,
  type OrganizationVerificationPolicyEvaluationCompletion,
  type OrganizationVerificationPolicyFindingSummary,
} from "./policyEvaluationCompletion.js";
import type { OrganizationVerificationPolicySet } from "./policySet.js";
import {
  readOrganizationVerificationRuleEvaluationResult,
  type OrganizationVerificationRuleEvaluationResult,
} from "./ruleEvaluationResult.js";
import type { CorrelationId } from "../index.js";

export interface CompleteOrganizationVerificationPolicyEvaluationInput {
  readonly evaluationCompletionId: OrganizationVerificationPolicyEvaluationCompletionId;
  readonly policySet: OrganizationVerificationPolicySet;
  readonly evaluationInput: OrganizationVerificationPolicyEvaluationInput;
  readonly ruleResults: readonly OrganizationVerificationRuleEvaluationResult[];
  readonly evaluationStartedAt: unknown;
  readonly evaluationCompletedAt: unknown;
  readonly completionComplete: unknown;
  readonly completionIntegrityValid: unknown;
  readonly provenanceReference: OrganizationVerificationPolicyProvenanceReference;
  readonly correlationId: CorrelationId;
  readonly integrityReference: OrganizationVerificationPolicyEvaluationIntegrityReference;
  readonly existingCompletion?: OrganizationVerificationPolicyEvaluationCompletion;
}

const DISPOSITION_PRECEDENCE = [
  "rejection_required",
  "manual_review_required",
  "revision_required",
] as const;

function validIdentity(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    !["latest", "current", "head", "default"].includes(
      value.trim().toLowerCase(),
    )
  );
}

function classify(
  results: readonly OrganizationVerificationRuleEvaluationResult[],
): PolicyDomainResult<OrganizationVerificationPolicyEvaluationClassification> {
  if (results.some((result) => result.disposition === "evaluation_error")) {
    return policyFailure("policy_evaluation_error");
  }
  for (const disposition of DISPOSITION_PRECEDENCE) {
    if (results.some((result) => result.disposition === disposition)) {
      return policySuccess(policyEvaluationClassification(disposition));
    }
  }
  if (
    results.some(
      (result) =>
        result.disposition !== "satisfied" &&
        result.disposition !== "informational",
    )
  ) {
    return policyFailure("contradictory_finding_disposition");
  }
  return policySuccess(policyEvaluationClassification("approval_ready"));
}

function summarize(
  results: readonly OrganizationVerificationRuleEvaluationResult[],
): OrganizationVerificationPolicyFindingSummary {
  const byCategory = new Map<
    string,
    {
      category: OrganizationVerificationRuleEvaluationResult["normalizedCategory"];
      ruleCount: number;
      findingCount: number;
      dispositions: {
        satisfied: number;
        informational: number;
        revision_required: number;
        manual_review_required: number;
        rejection_required: number;
        evaluation_error: number;
      };
    }
  >();

  for (const result of results) {
    const existing = byCategory.get(result.normalizedCategory) ?? {
      category: result.normalizedCategory,
      ruleCount: 0,
      findingCount: 0,
      dispositions: {
        satisfied: 0,
        informational: 0,
        revision_required: 0,
        manual_review_required: 0,
        rejection_required: 0,
        evaluation_error: 0,
      },
    };
    existing.ruleCount += 1;
    existing.findingCount += result.findings.length;
    switch (String(result.disposition)) {
      case "satisfied":
        existing.dispositions.satisfied += 1;
        break;
      case "informational":
        existing.dispositions.informational += 1;
        break;
      case "revision_required":
        existing.dispositions.revision_required += 1;
        break;
      case "manual_review_required":
        existing.dispositions.manual_review_required += 1;
        break;
      case "rejection_required":
        existing.dispositions.rejection_required += 1;
        break;
      case "evaluation_error":
        existing.dispositions.evaluation_error += 1;
        break;
    }
    byCategory.set(result.normalizedCategory, existing);
  }

  const categorySummaries: OrganizationVerificationPolicyCategorySummary[] = [
    ...byCategory.values(),
  ]
    .sort((left, right) => left.category.localeCompare(right.category))
    .map((entry) => ({
      category: entry.category,
      ruleCount: entry.ruleCount,
      findingCount: entry.findingCount,
      dispositions: entry.dispositions,
    }));

  return {
    ruleResultCount: results.length,
    findingCount: results.reduce(
      (total, result) => total + result.findings.length,
      0,
    ),
    categorySummaries,
  };
}

function semanticCompletion(
  completion: OrganizationVerificationPolicyEvaluationCompletion,
): string {
  return JSON.stringify({
    evaluationCompletionId: completion.evaluationCompletionId,
    policySetId: completion.policySetId,
    policySetVersion: completion.policySetVersion,
    policyContractVersion: completion.policyContractVersion,
    organizationId: completion.organizationId,
    recordId: completion.recordId,
    revisionId: completion.revisionId,
    attemptId: completion.attemptId,
    snapshotId: completion.snapshotId,
    snapshotFingerprint: completion.snapshotFingerprint,
    ruleResults: completion.ruleResults,
    findingSummary: completion.findingSummary,
    evaluationStartedAt: completion.evaluationStartedAt,
    evaluationCompletedAt: completion.evaluationCompletedAt,
    classification: completion.classification,
    provenanceReference: completion.provenanceReference,
    correlationId: completion.correlationId,
    integrityReference: completion.integrityReference,
  });
}

export function completeOrganizationVerificationPolicyEvaluation(
  input: CompleteOrganizationVerificationPolicyEvaluationInput,
): PolicyDomainResult<OrganizationVerificationPolicyEvaluationCompletion> {
  if (input.completionComplete !== true) {
    return policyFailure("policy_evaluation_incomplete");
  }
  if (input.completionIntegrityValid !== true) {
    return policyFailure("policy_evaluation_integrity_invalid");
  }
  if (
    !validIdentity(input.evaluationCompletionId) ||
    !validIdentity(input.provenanceReference) ||
    !validIdentity(input.integrityReference) ||
    input.correlationId !== input.evaluationInput.correlationId
  ) {
    return policyFailure("invalid_policy_evaluation_identity");
  }
  if (
    input.policySet.status !== "active" ||
    input.policySet.policySetId !== input.evaluationInput.policySetId ||
    input.policySet.policySetVersion !== input.evaluationInput.policySetVersion
  ) {
    return policyFailure("policy_set_version_mismatch");
  }
  if (
    typeof input.evaluationStartedAt !== "string" ||
    typeof input.evaluationCompletedAt !== "string" ||
    !Number.isFinite(Date.parse(input.evaluationStartedAt)) ||
    !Number.isFinite(Date.parse(input.evaluationCompletedAt)) ||
    Date.parse(input.evaluationStartedAt) <
      Date.parse(input.evaluationInput.evaluationRequestedAt) ||
    Date.parse(input.evaluationCompletedAt) <
      Date.parse(input.evaluationStartedAt) ||
    Date.parse(input.evaluationStartedAt) <
      Date.parse(input.policySet.effectiveFrom) ||
    (input.policySet.effectiveUntil !== undefined &&
      Date.parse(input.evaluationStartedAt) >=
        Date.parse(input.policySet.effectiveUntil))
  ) {
    return policyFailure("invalid_evaluation_chronology");
  }

  const referencesByRuleId = new Map(
    input.policySet.rules.map((reference) => [reference.ruleId, reference]),
  );
  const resultsByRuleId = new Map<
    string,
    OrganizationVerificationRuleEvaluationResult
  >();

  for (const [index, candidate] of input.ruleResults.entries()) {
    let result: OrganizationVerificationRuleEvaluationResult;
    try {
      result = readOrganizationVerificationRuleEvaluationResult(candidate);
    } catch {
      return policyFailure("rule_result_integrity_invalid", `ruleResults.${index}`);
    }
    const reference = referencesByRuleId.get(result.ruleId);
    if (!reference) {
      return policyFailure("unauthorized_rule_result", `ruleResults.${index}`);
    }
    if (resultsByRuleId.has(result.ruleId)) {
      const prior = resultsByRuleId.get(result.ruleId);
      return policyFailure(
        prior?.ruleVersion === result.ruleVersion
          ? "duplicate_rule_result"
          : "conflicting_rule_result",
        `ruleResults.${index}`,
      );
    }
    if (reference.ruleVersion !== result.ruleVersion) {
      return policyFailure("conflicting_rule_result", `ruleResults.${index}`);
    }
    if (
      result.policySetId !== input.policySet.policySetId ||
      result.policySetVersion !== input.policySet.policySetVersion
    ) {
      return policyFailure("policy_set_version_mismatch", `ruleResults.${index}`);
    }
    const evaluation = input.evaluationInput;
    if (result.organizationId !== evaluation.organizationId) {
      return policyFailure("organization_id_mismatch", `ruleResults.${index}`);
    }
    if (result.recordId !== evaluation.recordId) {
      return policyFailure(
        "verification_record_id_mismatch",
        `ruleResults.${index}`,
      );
    }
    if (result.revisionId !== evaluation.revisionId) {
      return policyFailure(
        "verification_revision_id_mismatch",
        `ruleResults.${index}`,
      );
    }
    if (result.attemptId !== evaluation.attemptId) {
      return policyFailure("attempt_id_mismatch", `ruleResults.${index}`);
    }
    if (result.snapshotId !== evaluation.snapshotId) {
      return policyFailure("snapshot_id_mismatch", `ruleResults.${index}`);
    }
    if (result.snapshotFingerprint !== evaluation.snapshotFingerprint) {
      return policyFailure(
        "snapshot_fingerprint_mismatch",
        `ruleResults.${index}`,
      );
    }
    if (
      Date.parse(result.evaluationStartedAt) <
        Date.parse(input.evaluationStartedAt) ||
      Date.parse(result.evaluationCompletedAt) >
        Date.parse(input.evaluationCompletedAt)
    ) {
      return policyFailure("invalid_evaluation_chronology", `ruleResults.${index}`);
    }
    resultsByRuleId.set(result.ruleId, result);
  }

  for (const reference of input.policySet.rules) {
    if (reference.required && !resultsByRuleId.has(reference.ruleId)) {
      return policyFailure("required_rule_missing");
    }
  }

  const orderedResults = input.policySet.rules
    .map((reference) => resultsByRuleId.get(reference.ruleId))
    .filter(
      (
        result,
      ): result is OrganizationVerificationRuleEvaluationResult =>
        result !== undefined,
    );

  const classification = classify(orderedResults);
  if (!classification.ok) return classification;

  const completion =
    createOrganizationVerificationPolicyEvaluationCompletionInternal({
      evaluationCompletionId: input.evaluationCompletionId,
      policySetId: input.policySet.policySetId,
      policySetVersion: input.policySet.policySetVersion,
      policyContractVersion: POLICY_EVALUATION_CONTRACT_VERSION,
      organizationId: input.evaluationInput.organizationId,
      recordId: input.evaluationInput.recordId,
      revisionId: input.evaluationInput.revisionId,
      attemptId: input.evaluationInput.attemptId,
      snapshotId: input.evaluationInput.snapshotId,
      snapshotFingerprint: input.evaluationInput.snapshotFingerprint,
      ruleResults: orderedResults,
      findingSummary: summarize(orderedResults),
      evaluationStartedAt: input.evaluationStartedAt,
      evaluationCompletedAt: input.evaluationCompletedAt,
      completionIntegrityValid: true,
      completionComplete: true,
      classification: classification.value,
      provenanceReference: input.provenanceReference,
      correlationId: input.correlationId,
      integrityReference: input.integrityReference,
    });

  if (input.existingCompletion) {
    let existing: OrganizationVerificationPolicyEvaluationCompletion;
    try {
      existing = readOrganizationVerificationPolicyEvaluationCompletion(
        input.existingCompletion,
      );
    } catch {
      return policyFailure("conflicting_policy_evaluation_completion");
    }
    if (existing.evaluationCompletionId === completion.evaluationCompletionId) {
      return semanticCompletion(existing) === semanticCompletion(completion)
        ? policySuccess(existing)
        : policyFailure("conflicting_policy_evaluation_completion");
    }
    if (
      existing.attemptId === completion.attemptId &&
      existing.snapshotId === completion.snapshotId &&
      existing.policySetId === completion.policySetId &&
      existing.policySetVersion === completion.policySetVersion
    ) {
      return policyFailure("duplicate_policy_evaluation_completion");
    }
    return policyFailure("conflicting_policy_evaluation_completion");
  }

  return policySuccess(completion);
}
