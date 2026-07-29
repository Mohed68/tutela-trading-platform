import {
  evaluationProjectionFailure,
  evaluationProjectionSuccess,
  type EvaluationProjectionDomainResult,
} from "./errors.js";
import {
  EVALUATION_PROJECTION_BUILDER_VERSION,
  EVALUATION_PROJECTION_CONTRACT_VERSION,
  EVALUATION_PROJECTION_SCHEMA_VERSION,
  isCanonicalEvaluationProjectionTimestampInternal,
  isEvaluationProjectionDigestInternal,
  parseEvaluationProjectionBuilderVersion,
  parseEvaluationProjectionContractVersion,
  parseEvaluationProjectionSchemaVersion,
  type EvaluationProjectionBuilderVersion,
  type EvaluationProjectionContractVersion,
  type EvaluationProjectionFingerprint,
  type EvaluationProjectionId,
  type EvaluationProjectionIntegrityReference,
  type EvaluationProjectionProvenanceReference,
  type EvaluationProjectionSchemaVersion,
  type EvaluationProjectionVersion,
} from "./ids.js";

export interface OrganizationVerificationEvaluationProjectionConstructionContext {
  readonly evaluationProjectionId: EvaluationProjectionId;
  readonly evaluationProjectionVersion: EvaluationProjectionVersion;
  readonly projectionContractVersion: EvaluationProjectionContractVersion;
  readonly projectionBuilderVersion: EvaluationProjectionBuilderVersion;
  readonly projectionSchemaVersion: EvaluationProjectionSchemaVersion;
  readonly projectedAt: string;
  readonly provenanceReference: EvaluationProjectionProvenanceReference;
  readonly integrityReference: EvaluationProjectionIntegrityReference;
  readonly expectedProjectionFingerprint?: EvaluationProjectionFingerprint;
}

export interface CreateOrganizationVerificationEvaluationProjectionConstructionContextInput {
  readonly evaluationProjectionId: EvaluationProjectionId;
  readonly evaluationProjectionVersion: EvaluationProjectionVersion;
  readonly projectionContractVersion: unknown;
  readonly projectionBuilderVersion: unknown;
  readonly projectionSchemaVersion: unknown;
  readonly projectedAt: unknown;
  readonly provenanceReference: EvaluationProjectionProvenanceReference;
  readonly integrityReference: EvaluationProjectionIntegrityReference;
  readonly expectedProjectionFingerprint?: EvaluationProjectionFingerprint;
}

function exact(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    !["latest", "current", "head", "default"].includes(
      value.trim().toLowerCase(),
    )
  );
}

export function createOrganizationVerificationEvaluationProjectionConstructionContext(
  input: CreateOrganizationVerificationEvaluationProjectionConstructionContextInput,
): EvaluationProjectionDomainResult<OrganizationVerificationEvaluationProjectionConstructionContext> {
  if (!exact(input.evaluationProjectionId)) {
    return evaluationProjectionFailure("invalid_evaluation_projection_id");
  }
  if (!exact(input.evaluationProjectionVersion)) {
    return evaluationProjectionFailure(
      "invalid_evaluation_projection_version",
    );
  }
  const contract = parseEvaluationProjectionContractVersion(
    input.projectionContractVersion,
  );
  if (!contract.ok) return contract;
  const builder = parseEvaluationProjectionBuilderVersion(
    input.projectionBuilderVersion,
  );
  if (!builder.ok) return builder;
  const schema = parseEvaluationProjectionSchemaVersion(
    input.projectionSchemaVersion,
  );
  if (!schema.ok) return schema;
  if (!isCanonicalEvaluationProjectionTimestampInternal(input.projectedAt)) {
    return evaluationProjectionFailure("invalid_evaluation_projection_timestamp");
  }
  if (!exact(input.provenanceReference)) {
    return evaluationProjectionFailure(
      "invalid_evaluation_projection_provenance_reference",
    );
  }
  if (!exact(input.integrityReference)) {
    return evaluationProjectionFailure(
      "invalid_evaluation_projection_integrity_reference",
    );
  }
  if (
    input.expectedProjectionFingerprint !== undefined &&
    !isEvaluationProjectionDigestInternal(
      input.expectedProjectionFingerprint,
    )
  ) {
    return evaluationProjectionFailure(
      "evaluation_projection_fingerprint_mismatch",
    );
  }
  return evaluationProjectionSuccess(
    Object.freeze({
      evaluationProjectionId: input.evaluationProjectionId,
      evaluationProjectionVersion: input.evaluationProjectionVersion,
      projectionContractVersion: EVALUATION_PROJECTION_CONTRACT_VERSION,
      projectionBuilderVersion: EVALUATION_PROJECTION_BUILDER_VERSION,
      projectionSchemaVersion: EVALUATION_PROJECTION_SCHEMA_VERSION,
      projectedAt: input.projectedAt,
      provenanceReference: input.provenanceReference,
      integrityReference: input.integrityReference,
      ...(input.expectedProjectionFingerprint
        ? {
            expectedProjectionFingerprint:
              input.expectedProjectionFingerprint,
          }
        : {}),
    }),
  );
}
