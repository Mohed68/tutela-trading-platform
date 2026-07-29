import type { OrganizationEvidenceReferenceId } from "../index.js";
import {
  evidenceSnapshotFailure,
  evidenceSnapshotSuccess,
  type EvidenceSnapshotDomainResult,
} from "./errors.js";
import {
  FROZEN_EVIDENCE_PROJECTION_VERSION,
  isEvidenceSnapshotDigestInternal,
  isEvidenceSnapshotOpaqueIdentityInternal,
  isEvidenceSnapshotTokenInternal,
  isCanonicalTimestamp,
  type EvidenceCategory,
  type EvidenceContentDigest,
  type EvidenceKind,
  type EvidenceReferenceId,
  type EvidenceReferenceVersion,
  type EvidenceSnapshotCorrelationReference,
  type EvidenceSnapshotIntegrityReference,
  type EvidenceSnapshotProvenanceReference,
  type EvidenceSourceAuthority,
  type FrozenEvidenceProjectionVersion,
} from "./ids.js";

export type EvidenceSnapshotAttributeValue = string | number | boolean;

export interface OrganizationVerificationEvidenceSnapshotAttribute {
  readonly key: string;
  readonly value: EvidenceSnapshotAttributeValue;
}

export interface OrganizationVerificationSemanticEvidenceReference {
  readonly evidenceReferenceId: EvidenceReferenceId;
  readonly evidenceReferenceVersion: EvidenceReferenceVersion;
  readonly revisionEvidenceReferenceId: OrganizationEvidenceReferenceId;
  readonly evidenceKind: EvidenceKind;
  readonly category: EvidenceCategory;
  readonly sourceAuthority: EvidenceSourceAuthority;
  readonly contentDigest: EvidenceContentDigest;
}

export interface OrganizationVerificationFrozenEvidenceProjection
  extends OrganizationVerificationSemanticEvidenceReference {
  readonly projectionVersion: FrozenEvidenceProjectionVersion;
  readonly issuedAt?: string;
  readonly capturedAt?: string;
  readonly validFrom?: string;
  readonly validUntil?: string;
  readonly attributes: readonly OrganizationVerificationEvidenceSnapshotAttribute[];
  readonly provenanceReference: EvidenceSnapshotProvenanceReference;
  readonly correlationReference: EvidenceSnapshotCorrelationReference;
  readonly integrityReference: EvidenceSnapshotIntegrityReference;
}

export interface OrganizationVerificationSemanticEvidenceReferenceInput {
  readonly evidenceReferenceId: EvidenceReferenceId;
  readonly evidenceReferenceVersion: EvidenceReferenceVersion;
  readonly revisionEvidenceReferenceId: OrganizationEvidenceReferenceId;
  readonly evidenceKind: EvidenceKind;
  readonly category: EvidenceCategory;
  readonly sourceAuthority: EvidenceSourceAuthority;
  readonly contentDigest: EvidenceContentDigest;
  readonly issuedAt?: unknown;
  readonly capturedAt?: unknown;
  readonly validFrom?: unknown;
  readonly validUntil?: unknown;
  readonly attributes?: readonly OrganizationVerificationEvidenceSnapshotAttribute[];
  readonly provenanceReference: EvidenceSnapshotProvenanceReference;
  readonly correlationReference: EvidenceSnapshotCorrelationReference;
  readonly integrityReference: EvidenceSnapshotIntegrityReference;
}

export interface FrozenEvidenceSet {
  readonly semanticReferences: readonly OrganizationVerificationSemanticEvidenceReference[];
  readonly evidenceProjections: readonly OrganizationVerificationFrozenEvidenceProjection[];
}

function optionalTimestamp(value: unknown): value is string | undefined {
  return value === undefined || isCanonicalTimestamp(value);
}

function canonicalKey(
  input: OrganizationVerificationSemanticEvidenceReferenceInput,
): string {
  return `${String(input.evidenceReferenceId)}\u0000${String(
    input.evidenceReferenceVersion,
  )}`;
}

function semantics(
  input: OrganizationVerificationSemanticEvidenceReferenceInput,
): string {
  return JSON.stringify({
    evidenceReferenceId: input.evidenceReferenceId,
    evidenceReferenceVersion: input.evidenceReferenceVersion,
    revisionEvidenceReferenceId: input.revisionEvidenceReferenceId,
    evidenceKind: input.evidenceKind,
    category: input.category,
    sourceAuthority: input.sourceAuthority,
    contentDigest: input.contentDigest,
    issuedAt: input.issuedAt ?? null,
    capturedAt: input.capturedAt ?? null,
    validFrom: input.validFrom ?? null,
    validUntil: input.validUntil ?? null,
    attributes: [...(input.attributes ?? [])]
      .map((attribute) => ({ ...attribute }))
      .sort((left, right) => left.key.localeCompare(right.key)),
    provenanceReference: input.provenanceReference,
    correlationReference: input.correlationReference,
    integrityReference: input.integrityReference,
  });
}

export function freezeOrganizationVerificationEvidenceSet(
  inputs: readonly OrganizationVerificationSemanticEvidenceReferenceInput[],
  snapshotCreatedAt: string,
  expectedCorrelation: EvidenceSnapshotCorrelationReference,
): EvidenceSnapshotDomainResult<FrozenEvidenceSet> {
  if (!Array.isArray(inputs)) {
    return evidenceSnapshotFailure("evidence_reference_mismatch");
  }
  const ordered = [...inputs].sort((left, right) =>
    canonicalKey(left).localeCompare(canonicalKey(right)),
  );
  const ids = new Map<string, OrganizationVerificationSemanticEvidenceReferenceInput>();
  const semanticReferences: OrganizationVerificationSemanticEvidenceReference[] =
    [];
  const evidenceProjections: OrganizationVerificationFrozenEvidenceProjection[] =
    [];

  for (const [index, input] of ordered.entries()) {
    if (
      !isEvidenceSnapshotOpaqueIdentityInternal(input.evidenceReferenceId) ||
      !isEvidenceSnapshotOpaqueIdentityInternal(input.evidenceReferenceVersion) ||
      !isEvidenceSnapshotOpaqueIdentityInternal(input.revisionEvidenceReferenceId) ||
      !isEvidenceSnapshotTokenInternal(input.evidenceKind) ||
      !isEvidenceSnapshotTokenInternal(input.category) ||
      !isEvidenceSnapshotTokenInternal(input.sourceAuthority) ||
      !isEvidenceSnapshotDigestInternal(input.contentDigest) ||
      !isEvidenceSnapshotOpaqueIdentityInternal(input.provenanceReference) ||
      !isEvidenceSnapshotOpaqueIdentityInternal(input.integrityReference) ||
      input.correlationReference !== expectedCorrelation
    ) {
      return evidenceSnapshotFailure(
        "evidence_reference_mismatch",
        `evidence.${index}`,
      );
    }
    if (
      !optionalTimestamp(input.issuedAt) ||
      !optionalTimestamp(input.capturedAt) ||
      !optionalTimestamp(input.validFrom) ||
      !optionalTimestamp(input.validUntil)
    ) {
      return evidenceSnapshotFailure(
        "invalid_snapshot_chronology",
        `evidence.${index}`,
      );
    }
    if (
      (input.capturedAt !== undefined &&
        Date.parse(input.capturedAt) > Date.parse(snapshotCreatedAt)) ||
      (input.issuedAt !== undefined &&
        input.capturedAt !== undefined &&
        Date.parse(input.issuedAt) > Date.parse(input.capturedAt)) ||
      (input.validFrom !== undefined &&
        input.validUntil !== undefined &&
        Date.parse(input.validUntil) < Date.parse(input.validFrom))
    ) {
      return evidenceSnapshotFailure(
        "invalid_snapshot_chronology",
        `evidence.${index}`,
      );
    }

    const prior = ids.get(String(input.evidenceReferenceId));
    if (prior) {
      if (
        prior.evidenceReferenceVersion !== input.evidenceReferenceVersion
      ) {
        return evidenceSnapshotFailure(
          "evidence_version_mismatch",
          `evidence.${index}`,
        );
      }
      if (prior.contentDigest !== input.contentDigest) {
        return evidenceSnapshotFailure(
          "evidence_digest_mismatch",
          `evidence.${index}`,
        );
      }
      return evidenceSnapshotFailure(
        semantics(prior) === semantics(input)
          ? "duplicate_evidence_reference"
          : "conflicting_evidence_reference",
        `evidence.${index}`,
      );
    }
    ids.set(String(input.evidenceReferenceId), input);

    const attributeKeys = new Set<string>();
    const attributes: OrganizationVerificationEvidenceSnapshotAttribute[] = [];
    for (const attribute of [...(input.attributes ?? [])].sort((left, right) =>
      left.key.localeCompare(right.key),
    )) {
      if (
        !isEvidenceSnapshotOpaqueIdentityInternal(attribute.key) ||
        attributeKeys.has(attribute.key) ||
        !["string", "number", "boolean"].includes(typeof attribute.value) ||
        (typeof attribute.value === "string" &&
          attribute.value.trim().length === 0) ||
        (typeof attribute.value === "number" &&
          !Number.isFinite(attribute.value))
      ) {
        return evidenceSnapshotFailure(
          "evidence_reference_mismatch",
          `evidence.${index}.attributes`,
        );
      }
      attributeKeys.add(attribute.key);
      attributes.push(Object.freeze({ ...attribute }));
    }

    const semanticReference =
      Object.freeze<OrganizationVerificationSemanticEvidenceReference>({
        evidenceReferenceId: input.evidenceReferenceId,
        evidenceReferenceVersion: input.evidenceReferenceVersion,
        revisionEvidenceReferenceId: input.revisionEvidenceReferenceId,
        evidenceKind: input.evidenceKind,
        category: input.category,
        sourceAuthority: input.sourceAuthority,
        contentDigest: input.contentDigest,
      });
    semanticReferences.push(semanticReference);
    evidenceProjections.push(
      Object.freeze({
        ...semanticReference,
        projectionVersion: FROZEN_EVIDENCE_PROJECTION_VERSION,
        ...(input.issuedAt ? { issuedAt: input.issuedAt } : {}),
        ...(input.capturedAt ? { capturedAt: input.capturedAt } : {}),
        ...(input.validFrom ? { validFrom: input.validFrom } : {}),
        ...(input.validUntil ? { validUntil: input.validUntil } : {}),
        attributes: Object.freeze(attributes),
        provenanceReference: input.provenanceReference,
        correlationReference: input.correlationReference,
        integrityReference: input.integrityReference,
      }),
    );
  }

  return evidenceSnapshotSuccess(
    Object.freeze({
      semanticReferences: Object.freeze(semanticReferences),
      evidenceProjections: Object.freeze(evidenceProjections),
    }),
  );
}
