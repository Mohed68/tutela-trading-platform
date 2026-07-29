import {
  evaluationProjectionFailure,
  evaluationProjectionSuccess,
  type EvaluationProjectionDomainResult,
} from "./errors.js";

export const EVALUATION_PROJECTION_CONTRACT_VERSION =
  "organization_verification.evaluation_projection.v1" as const;
export const EVALUATION_PROJECTION_BUILDER_VERSION =
  "organization_verification.evaluation_projection_builder.v1" as const;
export const EVALUATION_PROJECTION_SCHEMA_VERSION =
  "organization_verification.evaluation_projection_schema.v1" as const;

declare const evaluationProjectionBrand: unique symbol;
type ProjectionOpaque<T extends string> = string & {
  readonly [evaluationProjectionBrand]: T;
};

export type EvaluationProjectionId =
  ProjectionOpaque<"EvaluationProjectionId">;
export type EvaluationProjectionVersion =
  ProjectionOpaque<"EvaluationProjectionVersion">;
export type EvaluationProjectionFingerprint =
  ProjectionOpaque<"EvaluationProjectionFingerprint">;
export type EvaluationProjectionProvenanceReference =
  ProjectionOpaque<"EvaluationProjectionProvenanceReference">;
export type EvaluationProjectionIntegrityReference =
  ProjectionOpaque<"EvaluationProjectionIntegrityReference">;
export type EvaluationProjectionContractVersion =
  typeof EVALUATION_PROJECTION_CONTRACT_VERSION;
export type EvaluationProjectionBuilderVersion =
  typeof EVALUATION_PROJECTION_BUILDER_VERSION;
export type EvaluationProjectionSchemaVersion =
  typeof EVALUATION_PROJECTION_SCHEMA_VERSION;

const MUTABLE_POINTERS = new Set(["latest", "current", "head", "default"]);
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

function exact(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    !MUTABLE_POINTERS.has(value.trim().toLowerCase())
  );
}

export function isEvaluationProjectionDigestInternal(
  value: unknown,
): value is string {
  return typeof value === "string" && SHA256_PATTERN.test(value);
}

function opaque<T extends string>(
  value: unknown,
  code:
    | "invalid_evaluation_projection_id"
    | "invalid_evaluation_projection_version"
    | "invalid_evaluation_projection_provenance_reference"
    | "invalid_evaluation_projection_integrity_reference",
): EvaluationProjectionDomainResult<ProjectionOpaque<T>> {
  return exact(value)
    ? evaluationProjectionSuccess(value as ProjectionOpaque<T>)
    : evaluationProjectionFailure(code);
}

export const createEvaluationProjectionId = (value: unknown) =>
  opaque<"EvaluationProjectionId">(
    value,
    "invalid_evaluation_projection_id",
  );
export const createEvaluationProjectionVersion = (value: unknown) =>
  opaque<"EvaluationProjectionVersion">(
    value,
    "invalid_evaluation_projection_version",
  );
export const createEvaluationProjectionProvenanceReference = (value: unknown) =>
  opaque<"EvaluationProjectionProvenanceReference">(
    value,
    "invalid_evaluation_projection_provenance_reference",
  );
export const createEvaluationProjectionIntegrityReference = (value: unknown) =>
  opaque<"EvaluationProjectionIntegrityReference">(
    value,
    "invalid_evaluation_projection_integrity_reference",
  );

export function parseEvaluationProjectionContractVersion(
  value: unknown,
): EvaluationProjectionDomainResult<EvaluationProjectionContractVersion> {
  return value === EVALUATION_PROJECTION_CONTRACT_VERSION
    ? evaluationProjectionSuccess(EVALUATION_PROJECTION_CONTRACT_VERSION)
    : evaluationProjectionFailure(
        "unsupported_evaluation_projection_contract_version",
      );
}

export function parseEvaluationProjectionBuilderVersion(
  value: unknown,
): EvaluationProjectionDomainResult<EvaluationProjectionBuilderVersion> {
  return value === EVALUATION_PROJECTION_BUILDER_VERSION
    ? evaluationProjectionSuccess(EVALUATION_PROJECTION_BUILDER_VERSION)
    : evaluationProjectionFailure(
        "unsupported_evaluation_projection_builder_version",
      );
}

export function parseEvaluationProjectionSchemaVersion(
  value: unknown,
): EvaluationProjectionDomainResult<EvaluationProjectionSchemaVersion> {
  return value === EVALUATION_PROJECTION_SCHEMA_VERSION
    ? evaluationProjectionSuccess(EVALUATION_PROJECTION_SCHEMA_VERSION)
    : evaluationProjectionFailure(
        "unsupported_evaluation_projection_schema_version",
      );
}

export function createEvaluationProjectionFingerprintInternal(
  value: string,
): EvaluationProjectionFingerprint {
  return value as EvaluationProjectionFingerprint;
}

export function isCanonicalEvaluationProjectionTimestampInternal(
  value: unknown,
): value is string {
  return (
    typeof value === "string" &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}
