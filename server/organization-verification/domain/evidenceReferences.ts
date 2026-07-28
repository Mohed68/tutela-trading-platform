import {
  domainFailure,
  domainSuccess,
  type CoreDomainResult,
} from "./errors.js";

declare const evidenceBrand: unique symbol;
type EvidenceOpaque<T extends string> = string & {
  readonly [evidenceBrand]: T;
};

export type OrganizationEvidenceReferenceId =
  EvidenceOpaque<"OrganizationEvidenceReferenceId">;
export type EvidenceSnapshotReferenceId =
  EvidenceOpaque<"EvidenceSnapshotReferenceId">;
export type OpaqueArtifactReferenceId =
  EvidenceOpaque<"OpaqueArtifactReferenceId">;
export type EvidenceAssociationId =
  EvidenceOpaque<"EvidenceAssociationId">;

function evidenceId<T extends string>(
  value: unknown,
): CoreDomainResult<EvidenceOpaque<T>> {
  return typeof value === "string" && value.trim().length > 0
    ? domainSuccess(value as EvidenceOpaque<T>)
    : domainFailure("invalid_opaque_identifier");
}

export const createOrganizationEvidenceReferenceId = (value: unknown) =>
  evidenceId<"OrganizationEvidenceReferenceId">(value);
export const createEvidenceSnapshotReferenceId = (value: unknown) =>
  evidenceId<"EvidenceSnapshotReferenceId">(value);
export const createOpaqueArtifactReferenceId = (value: unknown) =>
  evidenceId<"OpaqueArtifactReferenceId">(value);
export const createEvidenceAssociationId = (value: unknown) =>
  evidenceId<"EvidenceAssociationId">(value);

export function freezeEvidenceReferenceSet(
  references: readonly OrganizationEvidenceReferenceId[],
): CoreDomainResult<readonly OrganizationEvidenceReferenceId[]> {
  if (new Set(references).size !== references.length) {
    return domainFailure("duplicate_evidence_reference");
  }
  return domainSuccess(Object.freeze([...references]));
}
