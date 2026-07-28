import {
  domainFailure,
  domainSuccess,
  type CoreDomainResult,
} from "./errors.js";

declare const domainBrand: unique symbol;
type OpaqueString<T extends string> = string & {
  readonly [domainBrand]: T;
};
type OpaqueNumber<T extends string> = number & {
  readonly [domainBrand]: T;
};

export type OrganizationVerificationRecordId =
  OpaqueString<"OrganizationVerificationRecordId">;
export type OrganizationVerificationDraftId =
  OpaqueString<"OrganizationVerificationDraftId">;
export type OrganizationVerificationRevisionId =
  OpaqueString<"OrganizationVerificationRevisionId">;
export type OrganizationVerificationAttemptId =
  OpaqueString<"OrganizationVerificationAttemptId">;
export type SubmissionIdempotencyKey =
  OpaqueString<"SubmissionIdempotencyKey">;
export type CorrelationId = OpaqueString<"CorrelationId">;
export type SnapshotId = OpaqueString<"SnapshotId">;
export type SnapshotFingerprint = OpaqueString<"SnapshotFingerprint">;
export type CompletionReference = OpaqueString<"CompletionReference">;
export type VerificationRevisionSequence =
  OpaqueNumber<"VerificationRevisionSequence">;
export type VerificationAttemptSequence =
  OpaqueNumber<"VerificationAttemptSequence">;
export type DraftVersion = OpaqueNumber<"DraftVersion">;

const MUTABLE_POINTERS = new Set(["current", "latest", "head"]);

function opaqueString<T extends string>(
  value: unknown,
): CoreDomainResult<OpaqueString<T>> {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    MUTABLE_POINTERS.has(value.trim().toLowerCase())
  ) {
    return domainFailure("invalid_opaque_identifier");
  }
  return domainSuccess(value as OpaqueString<T>);
}

function positiveInteger<T extends string>(
  value: unknown,
  failure: "invalid_revision_sequence" | "invalid_attempt_sequence",
): CoreDomainResult<OpaqueNumber<T>> {
  return Number.isSafeInteger(value) && Number(value) > 0
    ? domainSuccess(Number(value) as OpaqueNumber<T>)
    : domainFailure(failure);
}

export const createOrganizationVerificationRecordId = (value: unknown) =>
  opaqueString<"OrganizationVerificationRecordId">(value);
export const createOrganizationVerificationDraftId = (value: unknown) =>
  opaqueString<"OrganizationVerificationDraftId">(value);
export const createOrganizationVerificationRevisionId = (value: unknown) =>
  opaqueString<"OrganizationVerificationRevisionId">(value);
export const createOrganizationVerificationAttemptId = (value: unknown) =>
  opaqueString<"OrganizationVerificationAttemptId">(value);
export const createSubmissionIdempotencyKey = (value: unknown) =>
  opaqueString<"SubmissionIdempotencyKey">(value);
export const createCorrelationId = (value: unknown) =>
  opaqueString<"CorrelationId">(value);
export const createSnapshotId = (value: unknown) =>
  opaqueString<"SnapshotId">(value);
export const createSnapshotFingerprint = (value: unknown) =>
  opaqueString<"SnapshotFingerprint">(value);
export const createCompletionReference = (value: unknown) =>
  opaqueString<"CompletionReference">(value);
export const createVerificationRevisionSequence = (value: unknown) =>
  positiveInteger<"VerificationRevisionSequence">(
    value,
    "invalid_revision_sequence",
  );
export const createVerificationAttemptSequence = (value: unknown) =>
  positiveInteger<"VerificationAttemptSequence">(
    value,
    "invalid_attempt_sequence",
  );
export const createDraftVersion = (value: unknown) =>
  positiveInteger<"DraftVersion">(value, "invalid_revision_sequence") as
    CoreDomainResult<DraftVersion>;
