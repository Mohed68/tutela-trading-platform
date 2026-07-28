import type { OrganizationId } from "../../../organization-registry/index.js";
import type {
  CorrelationId,
  OrganizationEvidenceReferenceId,
  OrganizationVerificationAttemptId,
  OrganizationVerificationRecordId,
  OrganizationVerificationRevisionId,
  SnapshotFingerprint,
  SnapshotId,
} from "../index.js";
import type { OrganizationVerificationFindingDisposition } from "./disposition.js";
import {
  policyFailure,
  policySuccess,
  type PolicyDomainResult,
} from "./errors.js";
import type { OrganizationVerificationPolicyEvaluationInput } from "./evaluationInput.js";
import type {
  OrganizationVerificationFindingId,
  OrganizationVerificationFindingIntegrityReference,
  OrganizationVerificationPolicyProvenanceReference,
  OrganizationVerificationPolicySetId,
  OrganizationVerificationPolicySetVersion,
  OrganizationVerificationRuleId,
  OrganizationVerificationRuleVersion,
} from "./ids.js";
import type {
  OrganizationVerificationPolicyCategory,
  OrganizationVerificationReasonCode,
} from "./reasonCode.js";
import type { OrganizationVerificationRule } from "./rule.js";
import type { OrganizationVerificationFindingSeverity } from "./severity.js";

const findingSeal: unique symbol = Symbol(
  "organization_verification_policy_finding",
);

export type NormalizedFindingAttributeValue = string | number | boolean;

export interface NormalizedFindingAttribute {
  readonly key: string;
  readonly value: NormalizedFindingAttributeValue;
}

export interface OrganizationVerificationFinding {
  readonly findingId: OrganizationVerificationFindingId;
  readonly policySetId: OrganizationVerificationPolicySetId;
  readonly policySetVersion: OrganizationVerificationPolicySetVersion;
  readonly ruleId: OrganizationVerificationRuleId;
  readonly ruleVersion: OrganizationVerificationRuleVersion;
  readonly organizationId: OrganizationId;
  readonly recordId: OrganizationVerificationRecordId;
  readonly revisionId: OrganizationVerificationRevisionId;
  readonly attemptId: OrganizationVerificationAttemptId;
  readonly snapshotId: SnapshotId;
  readonly snapshotFingerprint: SnapshotFingerprint;
  readonly reasonCode: OrganizationVerificationReasonCode;
  readonly severity: OrganizationVerificationFindingSeverity;
  readonly disposition: OrganizationVerificationFindingDisposition;
  readonly normalizedCategory: OrganizationVerificationPolicyCategory;
  readonly evaluatedAt: string;
  readonly provenanceReference: OrganizationVerificationPolicyProvenanceReference;
  readonly evidenceReferenceIds: readonly OrganizationEvidenceReferenceId[];
  readonly correlationId: CorrelationId;
  readonly integrityReference: OrganizationVerificationFindingIntegrityReference;
  readonly attributes: readonly NormalizedFindingAttribute[];
  readonly [findingSeal]: true;
}

export interface CreateOrganizationVerificationFindingInput {
  readonly findingId: OrganizationVerificationFindingId;
  readonly policySetId: OrganizationVerificationPolicySetId;
  readonly policySetVersion: OrganizationVerificationPolicySetVersion;
  readonly ruleId: OrganizationVerificationRuleId;
  readonly ruleVersion: OrganizationVerificationRuleVersion;
  readonly organizationId: OrganizationId;
  readonly recordId: OrganizationVerificationRecordId;
  readonly revisionId: OrganizationVerificationRevisionId;
  readonly attemptId: OrganizationVerificationAttemptId;
  readonly snapshotId: SnapshotId;
  readonly snapshotFingerprint: SnapshotFingerprint;
  readonly reasonCode: OrganizationVerificationReasonCode;
  readonly severity: OrganizationVerificationFindingSeverity;
  readonly disposition: OrganizationVerificationFindingDisposition;
  readonly normalizedCategory: OrganizationVerificationPolicyCategory;
  readonly evaluatedAt: unknown;
  readonly provenanceReference: OrganizationVerificationPolicyProvenanceReference;
  readonly evidenceReferenceIds?: readonly OrganizationEvidenceReferenceId[];
  readonly correlationId: CorrelationId;
  readonly integrityReference: OrganizationVerificationFindingIntegrityReference;
  readonly attributes?: readonly NormalizedFindingAttribute[];
}

export interface FindingConstructionContext {
  readonly rule: OrganizationVerificationRule;
  readonly evaluationInput: OrganizationVerificationPolicyEvaluationInput;
}

function validIdentity(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function createOrganizationVerificationFinding(
  input: CreateOrganizationVerificationFindingInput,
  context: FindingConstructionContext,
): PolicyDomainResult<OrganizationVerificationFinding> {
  if (
    !validIdentity(input.findingId) ||
    !validIdentity(input.provenanceReference) ||
    !validIdentity(input.correlationId) ||
    !validIdentity(input.integrityReference)
  ) {
    return policyFailure("invalid_finding_id");
  }
  if (
    input.policySetId !== context.rule.policySetId ||
    input.policySetVersion !== context.rule.policySetVersion
  ) {
    return policyFailure("finding_policy_mismatch");
  }
  if (
    input.ruleId !== context.rule.ruleId ||
    input.ruleVersion !== context.rule.ruleVersion ||
    input.reasonCode !== context.rule.reasonCode ||
    input.severity !== context.rule.severity ||
    input.normalizedCategory !== context.rule.normalizedCategory
  ) {
    return policyFailure("finding_rule_mismatch");
  }
  if (
    input.disposition === "evaluation_error" ||
    (input.disposition !== "informational" &&
      input.disposition !== context.rule.evaluationDisposition)
  ) {
    return policyFailure("contradictory_finding_disposition");
  }

  const evaluation = context.evaluationInput;
  if (input.organizationId !== evaluation.organizationId) {
    return policyFailure("organization_id_mismatch");
  }
  if (input.recordId !== evaluation.recordId) {
    return policyFailure("verification_record_id_mismatch");
  }
  if (input.revisionId !== evaluation.revisionId) {
    return policyFailure("verification_revision_id_mismatch");
  }
  if (input.attemptId !== evaluation.attemptId) {
    return policyFailure("attempt_id_mismatch");
  }
  if (input.snapshotId !== evaluation.snapshotId) {
    return policyFailure("snapshot_id_mismatch");
  }
  if (input.snapshotFingerprint !== evaluation.snapshotFingerprint) {
    return policyFailure("snapshot_fingerprint_mismatch");
  }
  if (
    typeof input.evaluatedAt !== "string" ||
    !Number.isFinite(Date.parse(input.evaluatedAt)) ||
    input.correlationId !== evaluation.correlationId
  ) {
    return policyFailure("finding_identity_mismatch");
  }

  const evidenceReferenceIds = input.evidenceReferenceIds ?? [];
  const allowedEvidence = new Set(evaluation.semanticEvidenceReferences);
  if (
    !Array.isArray(evidenceReferenceIds) ||
    evidenceReferenceIds.some(
      (reference) =>
        !allowedEvidence.has(reference) || !validIdentity(reference),
    ) ||
    new Set(evidenceReferenceIds).size !== evidenceReferenceIds.length
  ) {
    return policyFailure("finding_identity_mismatch");
  }

  const attributes = input.attributes ?? [];
  const attributeKeys = new Set<string>();
  const frozenAttributes: NormalizedFindingAttribute[] = [];
  for (const attribute of attributes) {
    if (
      typeof attribute !== "object" ||
      attribute === null ||
      !validIdentity(attribute.key) ||
      attributeKeys.has(attribute.key) ||
      !["string", "number", "boolean"].includes(typeof attribute.value) ||
      (typeof attribute.value === "number" &&
        !Number.isFinite(attribute.value)) ||
      (typeof attribute.value === "string" &&
        attribute.value.trim().length === 0)
    ) {
      return policyFailure("finding_identity_mismatch");
    }
    attributeKeys.add(attribute.key);
    frozenAttributes.push(Object.freeze({ ...attribute }));
  }

  return policySuccess(
    Object.freeze({
      findingId: input.findingId,
      policySetId: input.policySetId,
      policySetVersion: input.policySetVersion,
      ruleId: input.ruleId,
      ruleVersion: input.ruleVersion,
      organizationId: input.organizationId,
      recordId: input.recordId,
      revisionId: input.revisionId,
      attemptId: input.attemptId,
      snapshotId: input.snapshotId,
      snapshotFingerprint: input.snapshotFingerprint,
      reasonCode: input.reasonCode,
      severity: input.severity,
      disposition: input.disposition,
      normalizedCategory: input.normalizedCategory,
      evaluatedAt: input.evaluatedAt,
      provenanceReference: input.provenanceReference,
      evidenceReferenceIds: Object.freeze([...evidenceReferenceIds]),
      correlationId: input.correlationId,
      integrityReference: input.integrityReference,
      attributes: Object.freeze(frozenAttributes),
      [findingSeal]: true as const,
    }),
  );
}

export function readOrganizationVerificationFinding(
  input: OrganizationVerificationFinding,
): OrganizationVerificationFinding {
  if (
    input[findingSeal] !== true ||
    !Object.isFrozen(input) ||
    !Object.isFrozen(input.evidenceReferenceIds) ||
    !Object.isFrozen(input.attributes) ||
    input.attributes.some((attribute) => !Object.isFrozen(attribute))
  ) {
    throw new TypeError("SEALED_ORGANIZATION_VERIFICATION_FINDING_REQUIRED");
  }
  return input;
}
