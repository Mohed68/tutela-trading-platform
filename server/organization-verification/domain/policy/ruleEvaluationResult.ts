import type { OrganizationId } from "../../../organization-registry/index.js";
import type {
  CorrelationId,
  OrganizationVerificationAttemptId,
  OrganizationVerificationRecordId,
  OrganizationVerificationRevisionId,
  SnapshotFingerprint,
  SnapshotId,
} from "../index.js";
import {
  isAuthorityBearingDisposition,
  type OrganizationVerificationFindingDisposition,
} from "./disposition.js";
import {
  policyFailure,
  policySuccess,
  type PolicyDomainResult,
} from "./errors.js";
import type { OrganizationVerificationPolicyEvaluationInput } from "./evaluationInput.js";
import {
  readOrganizationVerificationFinding,
  type OrganizationVerificationFinding,
} from "./finding.js";
import type {
  OrganizationVerificationPolicyProvenanceReference,
  OrganizationVerificationPolicySetId,
  OrganizationVerificationPolicySetVersion,
  OrganizationVerificationRuleEvaluationIntegrityReference,
  OrganizationVerificationRuleId,
  OrganizationVerificationRuleVersion,
} from "./ids.js";
import type {
  OrganizationVerificationPolicyCategory,
  OrganizationVerificationReasonCode,
} from "./reasonCode.js";
import type { OrganizationVerificationRule } from "./rule.js";
import type { OrganizationVerificationFindingSeverity } from "./severity.js";

const ruleEvaluationResultSeal: unique symbol = Symbol(
  "organization_verification_rule_evaluation_result",
);

export interface OrganizationVerificationRuleEvaluationResult {
  readonly ruleId: OrganizationVerificationRuleId;
  readonly ruleVersion: OrganizationVerificationRuleVersion;
  readonly policySetId: OrganizationVerificationPolicySetId;
  readonly policySetVersion: OrganizationVerificationPolicySetVersion;
  readonly organizationId: OrganizationId;
  readonly recordId: OrganizationVerificationRecordId;
  readonly revisionId: OrganizationVerificationRevisionId;
  readonly attemptId: OrganizationVerificationAttemptId;
  readonly snapshotId: SnapshotId;
  readonly snapshotFingerprint: SnapshotFingerprint;
  readonly normalizedCategory: OrganizationVerificationPolicyCategory;
  readonly severity: OrganizationVerificationFindingSeverity;
  readonly reasonCode: OrganizationVerificationReasonCode;
  readonly disposition: OrganizationVerificationFindingDisposition;
  readonly evaluationStartedAt: string;
  readonly evaluationCompletedAt: string;
  readonly resultComplete: true;
  readonly resultIntegrityValid: true;
  readonly findings: readonly OrganizationVerificationFinding[];
  readonly provenanceReference: OrganizationVerificationPolicyProvenanceReference;
  readonly correlationId: CorrelationId;
  readonly integrityReference: OrganizationVerificationRuleEvaluationIntegrityReference;
  readonly [ruleEvaluationResultSeal]: true;
}

export interface CreateOrganizationVerificationRuleEvaluationResultInput {
  readonly rule: OrganizationVerificationRule;
  readonly evaluationInput: OrganizationVerificationPolicyEvaluationInput;
  readonly disposition: OrganizationVerificationFindingDisposition;
  readonly evaluationStartedAt: unknown;
  readonly evaluationCompletedAt: unknown;
  readonly resultComplete: unknown;
  readonly resultIntegrityValid: unknown;
  readonly findings: readonly OrganizationVerificationFinding[];
  readonly provenanceReference: OrganizationVerificationPolicyProvenanceReference;
  readonly correlationId: CorrelationId;
  readonly integrityReference: OrganizationVerificationRuleEvaluationIntegrityReference;
}

function semanticFindingKey(
  finding: OrganizationVerificationFinding,
): string {
  return JSON.stringify({
    ruleId: finding.ruleId,
    ruleVersion: finding.ruleVersion,
    reasonCode: finding.reasonCode,
    disposition: finding.disposition,
    category: finding.normalizedCategory,
    evidence: finding.evidenceReferenceIds,
    attributes: finding.attributes,
  });
}

export function createOrganizationVerificationRuleEvaluationResult(
  input: CreateOrganizationVerificationRuleEvaluationResultInput,
): PolicyDomainResult<OrganizationVerificationRuleEvaluationResult> {
  if (input.resultComplete !== true) {
    return policyFailure("rule_result_incomplete");
  }
  if (input.resultIntegrityValid !== true) {
    return policyFailure("rule_result_integrity_invalid");
  }
  if (input.disposition !== input.rule.evaluationDisposition) {
    return policyFailure("conflicting_rule_result");
  }
  if (
    typeof input.evaluationStartedAt !== "string" ||
    typeof input.evaluationCompletedAt !== "string" ||
    !Number.isFinite(Date.parse(input.evaluationStartedAt)) ||
    !Number.isFinite(Date.parse(input.evaluationCompletedAt)) ||
    Date.parse(input.evaluationStartedAt) <
      Date.parse(input.evaluationInput.evaluationRequestedAt) ||
    Date.parse(input.evaluationCompletedAt) <
      Date.parse(input.evaluationStartedAt)
  ) {
    return policyFailure("invalid_evaluation_chronology");
  }
  if (
    input.rule.policySetId !== input.evaluationInput.policySetId ||
    input.rule.policySetVersion !== input.evaluationInput.policySetVersion
  ) {
    return policyFailure("policy_set_rule_mismatch");
  }
  if (
    typeof input.provenanceReference !== "string" ||
    input.provenanceReference.trim().length === 0 ||
    input.correlationId !== input.evaluationInput.correlationId ||
    typeof input.integrityReference !== "string" ||
    input.integrityReference.trim().length === 0
  ) {
    return policyFailure("invalid_policy_evaluation_identity");
  }
  if (!Array.isArray(input.findings)) {
    return policyFailure("finding_identity_mismatch");
  }

  const findingIds = new Set<string>();
  const findingSemantics = new Set<string>();
  const findings: OrganizationVerificationFinding[] = [];
  let authorityFindingCount = 0;
  let satisfiedFindingCount = 0;

  for (const [index, candidate] of input.findings.entries()) {
    let finding: OrganizationVerificationFinding;
    try {
      finding = readOrganizationVerificationFinding(candidate);
    } catch {
      return policyFailure("finding_identity_mismatch", `findings.${index}`);
    }
    if (findingIds.has(finding.findingId)) {
      return policyFailure("duplicate_finding", `findings.${index}`);
    }
    const semanticKey = semanticFindingKey(finding);
    if (findingSemantics.has(semanticKey)) {
      return policyFailure("duplicate_finding", `findings.${index}`);
    }
    findingIds.add(finding.findingId);
    findingSemantics.add(semanticKey);

    if (
      finding.ruleId !== input.rule.ruleId ||
      finding.ruleVersion !== input.rule.ruleVersion
    ) {
      return policyFailure("finding_rule_mismatch", `findings.${index}`);
    }
    if (
      finding.policySetId !== input.rule.policySetId ||
      finding.policySetVersion !== input.rule.policySetVersion
    ) {
      return policyFailure("finding_policy_mismatch", `findings.${index}`);
    }
    const evaluation = input.evaluationInput;
    if (finding.organizationId !== evaluation.organizationId) {
      return policyFailure("organization_id_mismatch", `findings.${index}`);
    }
    if (finding.recordId !== evaluation.recordId) {
      return policyFailure(
        "verification_record_id_mismatch",
        `findings.${index}`,
      );
    }
    if (finding.revisionId !== evaluation.revisionId) {
      return policyFailure(
        "verification_revision_id_mismatch",
        `findings.${index}`,
      );
    }
    if (finding.attemptId !== evaluation.attemptId) {
      return policyFailure("attempt_id_mismatch", `findings.${index}`);
    }
    if (finding.snapshotId !== evaluation.snapshotId) {
      return policyFailure("snapshot_id_mismatch", `findings.${index}`);
    }
    if (finding.snapshotFingerprint !== evaluation.snapshotFingerprint) {
      return policyFailure(
        "snapshot_fingerprint_mismatch",
        `findings.${index}`,
      );
    }
    if (
      Date.parse(finding.evaluatedAt) < Date.parse(input.evaluationStartedAt) ||
      Date.parse(finding.evaluatedAt) > Date.parse(input.evaluationCompletedAt)
    ) {
      return policyFailure("invalid_evaluation_chronology", `findings.${index}`);
    }
    if (isAuthorityBearingDisposition(finding.disposition)) {
      authorityFindingCount += 1;
    }
    if (finding.disposition === "satisfied") {
      satisfiedFindingCount += 1;
    }
    findings.push(finding);
  }

  if (authorityFindingCount > 1 || satisfiedFindingCount > 1) {
    return policyFailure("contradictory_finding_disposition");
  }
  if (
    isAuthorityBearingDisposition(input.disposition) &&
    !findings.some((finding) => finding.disposition === input.disposition)
  ) {
    return policyFailure("contradictory_finding_disposition");
  }
  if (
    (input.disposition === "informational" ||
      input.disposition === "evaluation_error") &&
    findings.some((finding) => finding.disposition !== "informational")
  ) {
    return policyFailure("contradictory_finding_disposition");
  }
  if (
    input.disposition === "satisfied" &&
    findings.some(
      (finding) =>
        finding.disposition !== "satisfied" &&
        finding.disposition !== "informational",
    )
  ) {
    return policyFailure("contradictory_finding_disposition");
  }

  return policySuccess(
    Object.freeze({
      ruleId: input.rule.ruleId,
      ruleVersion: input.rule.ruleVersion,
      policySetId: input.rule.policySetId,
      policySetVersion: input.rule.policySetVersion,
      organizationId: input.evaluationInput.organizationId,
      recordId: input.evaluationInput.recordId,
      revisionId: input.evaluationInput.revisionId,
      attemptId: input.evaluationInput.attemptId,
      snapshotId: input.evaluationInput.snapshotId,
      snapshotFingerprint: input.evaluationInput.snapshotFingerprint,
      normalizedCategory: input.rule.normalizedCategory,
      severity: input.rule.severity,
      reasonCode: input.rule.reasonCode,
      disposition: input.disposition,
      evaluationStartedAt: input.evaluationStartedAt,
      evaluationCompletedAt: input.evaluationCompletedAt,
      resultComplete: true as const,
      resultIntegrityValid: true as const,
      findings: Object.freeze(findings),
      provenanceReference: input.provenanceReference,
      correlationId: input.correlationId,
      integrityReference: input.integrityReference,
      [ruleEvaluationResultSeal]: true as const,
    }),
  );
}

export function readOrganizationVerificationRuleEvaluationResult(
  input: OrganizationVerificationRuleEvaluationResult,
): OrganizationVerificationRuleEvaluationResult {
  if (
    input[ruleEvaluationResultSeal] !== true ||
    !Object.isFrozen(input) ||
    !Object.isFrozen(input.findings)
  ) {
    throw new TypeError(
      "SEALED_ORGANIZATION_VERIFICATION_RULE_EVALUATION_RESULT_REQUIRED",
    );
  }
  return input;
}
