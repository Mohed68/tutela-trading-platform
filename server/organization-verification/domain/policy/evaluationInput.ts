import type {
  OrganizationId,
  OrganizationProfileFingerprint,
  OrganizationProfileRevisionId,
  RegistryContractVersion,
} from "../../../organization-registry/index.js";
import type {
  CorrelationId,
  OrganizationEvidenceReferenceId,
  OrganizationVerificationAttemptId,
  OrganizationVerificationRecordId,
  OrganizationVerificationRevisionId,
  SnapshotFingerprint,
  SnapshotId,
} from "../index.js";
import {
  policyFailure,
  policySuccess,
  type PolicyDomainResult,
} from "./errors.js";
import {
  POLICY_EVALUATION_CONTEXT_VERSION,
  parsePolicyEvaluationContextVersion,
  type OrganizationVerificationPolicyEvaluationIntegrityReference,
  type OrganizationVerificationPolicyProvenanceReference,
  type OrganizationVerificationPolicySetId,
  type OrganizationVerificationPolicySetVersion,
  type PolicyEvaluationContextVersion,
} from "./ids.js";

export interface OrganizationVerificationPolicyRegistryProjection {
  readonly profileRevisionId: OrganizationProfileRevisionId;
  readonly profileFingerprint: OrganizationProfileFingerprint;
  readonly registryContractVersion: RegistryContractVersion;
  readonly organizationType: string;
  readonly jurisdiction: string;
  readonly declaredActivityCodes: readonly string[];
}

export interface OrganizationVerificationPolicyEvaluationInput {
  readonly organizationId: OrganizationId;
  readonly recordId: OrganizationVerificationRecordId;
  readonly revisionId: OrganizationVerificationRevisionId;
  readonly attemptId: OrganizationVerificationAttemptId;
  readonly snapshotId: SnapshotId;
  readonly snapshotFingerprint: SnapshotFingerprint;
  readonly policySetId: OrganizationVerificationPolicySetId;
  readonly policySetVersion: OrganizationVerificationPolicySetVersion;
  readonly evaluationContextVersion: PolicyEvaluationContextVersion;
  readonly semanticEvidenceReferences: readonly OrganizationEvidenceReferenceId[];
  readonly registryProjection: OrganizationVerificationPolicyRegistryProjection;
  readonly evaluationRequestedAt: string;
  readonly provenanceReference: OrganizationVerificationPolicyProvenanceReference;
  readonly correlationId: CorrelationId;
  readonly integrityReference: OrganizationVerificationPolicyEvaluationIntegrityReference;
  readonly inputComplete: true;
  readonly inputIntegrityValid: true;
}

export interface CreateOrganizationVerificationPolicyEvaluationInput {
  readonly organizationId: OrganizationId;
  readonly recordId: OrganizationVerificationRecordId;
  readonly revisionId: OrganizationVerificationRevisionId;
  readonly attemptId: OrganizationVerificationAttemptId;
  readonly snapshotId: SnapshotId;
  readonly snapshotFingerprint: SnapshotFingerprint;
  readonly policySetId: OrganizationVerificationPolicySetId;
  readonly policySetVersion: OrganizationVerificationPolicySetVersion;
  readonly evaluationContextVersion: unknown;
  readonly semanticEvidenceReferences: readonly OrganizationEvidenceReferenceId[];
  readonly registryProjection: OrganizationVerificationPolicyRegistryProjection;
  readonly evaluationRequestedAt: unknown;
  readonly provenanceReference: OrganizationVerificationPolicyProvenanceReference;
  readonly correlationId: CorrelationId;
  readonly integrityReference: OrganizationVerificationPolicyEvaluationIntegrityReference;
  readonly inputComplete: unknown;
  readonly inputIntegrityValid: unknown;
}

function validIdentity(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function exactIdentity(value: unknown): value is string {
  return (
    validIdentity(value) &&
    !["latest", "current", "head", "default"].includes(
      value.trim().toLowerCase(),
    )
  );
}

export function createOrganizationVerificationPolicyEvaluationInput(
  input: CreateOrganizationVerificationPolicyEvaluationInput,
): PolicyDomainResult<OrganizationVerificationPolicyEvaluationInput> {
  if (
    !validIdentity(input.organizationId) ||
    !exactIdentity(input.recordId) ||
    !exactIdentity(input.revisionId) ||
    !exactIdentity(input.attemptId) ||
    !exactIdentity(input.snapshotId) ||
    !validIdentity(input.snapshotFingerprint) ||
    !exactIdentity(input.policySetId) ||
    !exactIdentity(input.policySetVersion) ||
    !exactIdentity(input.provenanceReference) ||
    !exactIdentity(input.correlationId) ||
    !exactIdentity(input.integrityReference)
  ) {
    return policyFailure("invalid_policy_evaluation_identity");
  }
  const contextVersion = parsePolicyEvaluationContextVersion(
    input.evaluationContextVersion,
  );
  if (!contextVersion.ok) return contextVersion;
  if (input.inputComplete !== true) {
    return policyFailure("policy_evaluation_incomplete");
  }
  if (input.inputIntegrityValid !== true) {
    return policyFailure("policy_evaluation_integrity_invalid");
  }
  if (
    typeof input.evaluationRequestedAt !== "string" ||
    !Number.isFinite(Date.parse(input.evaluationRequestedAt))
  ) {
    return policyFailure("invalid_policy_evaluation_timestamp");
  }
  if (
    !Array.isArray(input.semanticEvidenceReferences) ||
    input.semanticEvidenceReferences.some(
      (reference) => !exactIdentity(reference),
    ) ||
    new Set(input.semanticEvidenceReferences).size !==
      input.semanticEvidenceReferences.length
  ) {
    return policyFailure("finding_identity_mismatch");
  }

  const projection = input.registryProjection;
  if (
    typeof projection !== "object" ||
    projection === null ||
    !exactIdentity(projection.profileRevisionId) ||
    !validIdentity(projection.profileFingerprint) ||
    !validIdentity(projection.registryContractVersion) ||
    !validIdentity(projection.organizationType) ||
    !validIdentity(projection.jurisdiction) ||
    !Array.isArray(projection.declaredActivityCodes) ||
    projection.declaredActivityCodes.some((code) => !validIdentity(code)) ||
    new Set(projection.declaredActivityCodes).size !==
      projection.declaredActivityCodes.length
  ) {
    return policyFailure("invalid_policy_evaluation_identity");
  }

  return policySuccess(
    Object.freeze({
      organizationId: input.organizationId,
      recordId: input.recordId,
      revisionId: input.revisionId,
      attemptId: input.attemptId,
      snapshotId: input.snapshotId,
      snapshotFingerprint: input.snapshotFingerprint,
      policySetId: input.policySetId,
      policySetVersion: input.policySetVersion,
      evaluationContextVersion: POLICY_EVALUATION_CONTEXT_VERSION,
      semanticEvidenceReferences: Object.freeze([
        ...input.semanticEvidenceReferences,
      ]),
      registryProjection: Object.freeze({
        profileRevisionId: projection.profileRevisionId,
        profileFingerprint: projection.profileFingerprint,
        registryContractVersion: projection.registryContractVersion,
        organizationType: projection.organizationType,
        jurisdiction: projection.jurisdiction,
        declaredActivityCodes: Object.freeze([
          ...projection.declaredActivityCodes,
        ]),
      }),
      evaluationRequestedAt: input.evaluationRequestedAt,
      provenanceReference: input.provenanceReference,
      correlationId: input.correlationId,
      integrityReference: input.integrityReference,
      inputComplete: true as const,
      inputIntegrityValid: true as const,
    }),
  );
}
