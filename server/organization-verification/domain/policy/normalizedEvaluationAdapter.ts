import {
  createEvaluationCompletionId,
  createPolicySetReference,
  createPolicySetVersion,
  sealNormalizedEvaluationCompletion,
  type RawNormalizedOrganizationVerificationEvaluation,
  type SealedNormalizedEvaluationCompletion,
} from "../decision/index.js";
import {
  policyFailure,
  policySuccess,
  type PolicyDomainResult,
} from "./errors.js";
import {
  readOrganizationVerificationPolicyEvaluationCompletion,
  type OrganizationVerificationPolicyEvaluationCompletion,
} from "./policyEvaluationCompletion.js";

function categorySummaryStrings(
  completion: OrganizationVerificationPolicyEvaluationCompletion,
): readonly string[] {
  return Object.freeze(
    completion.findingSummary.categorySummaries.map(
      (summary) =>
        [
          summary.category,
          `rules=${summary.ruleCount}`,
          `findings=${summary.findingCount}`,
          `satisfied=${summary.dispositions.satisfied}`,
          `informational=${summary.dispositions.informational}`,
          `revision_required=${summary.dispositions.revision_required}`,
          `manual_review_required=${summary.dispositions.manual_review_required}`,
          `rejection_required=${summary.dispositions.rejection_required}`,
        ].join("|"),
    ),
  );
}

export function adaptPolicyEvaluationCompletionToNormalizedEvaluation(
  input: OrganizationVerificationPolicyEvaluationCompletion,
): PolicyDomainResult<SealedNormalizedEvaluationCompletion> {
  let completion: OrganizationVerificationPolicyEvaluationCompletion;
  try {
    completion = readOrganizationVerificationPolicyEvaluationCompletion(input);
  } catch {
    return policyFailure("normalized_evaluation_adapter_failure");
  }

  const evaluationCompletionId = createEvaluationCompletionId(
    completion.evaluationCompletionId,
  );
  const policySetReference = createPolicySetReference(completion.policySetId);
  const policySetVersion = createPolicySetVersion(
    completion.policySetVersion,
  );
  if (
    !evaluationCompletionId.ok ||
    !policySetReference.ok ||
    !policySetVersion.ok
  ) {
    return policyFailure("normalized_evaluation_adapter_failure");
  }

  const raw: RawNormalizedOrganizationVerificationEvaluation = {
    recordId: completion.recordId,
    revisionId: completion.revisionId,
    attemptId: completion.attemptId,
    organizationId: completion.organizationId,
    snapshotId: completion.snapshotId,
    snapshotFingerprint: completion.snapshotFingerprint,
    evaluationCompletionId: evaluationCompletionId.value,
    policySetReference: policySetReference.value,
    policySetVersion: policySetVersion.value,
    completedAt: completion.evaluationCompletedAt,
    evaluationComplete: true,
    evaluationIntegrityValid: true,
    approvalReady: completion.classification === "approval_ready",
    revisionRequired: completion.classification === "revision_required",
    manualReviewRequired:
      completion.classification === "manual_review_required",
    rejectionRequired: completion.classification === "rejection_required",
    categorySummaries: categorySummaryStrings(completion),
    correlationId: completion.correlationId,
    policyEvaluationProvenanceReference: completion.provenanceReference,
    policyEvaluationIntegrityReference: completion.integrityReference,
  };
  const sealed = sealNormalizedEvaluationCompletion(raw);
  return sealed.ok
    ? policySuccess(sealed.value)
    : policyFailure("normalized_evaluation_adapter_failure");
}
