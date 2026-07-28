import type {
  ActorAuthorityReference,
  OrganizationId,
  OrganizationProfileFingerprint,
  OrganizationProfileRevisionId,
  OrganizationProfileRevisionSequence,
} from "../../organization-registry/index.js";
import {
  domainFailure,
  domainSuccess,
  type CoreDomainResult,
} from "./errors.js";
import {
  freezeEvidenceReferenceSet,
  type OrganizationEvidenceReferenceId,
} from "./evidenceReferences.js";
import type {
  DraftVersion,
  OrganizationVerificationDraftId,
  OrganizationVerificationRecordId,
} from "./ids.js";

export interface DeclaredVerificationValue {
  readonly key: string;
  readonly value: string;
}

export interface DeclaredVerificationSection {
  readonly key: string;
  readonly values: readonly DeclaredVerificationValue[];
}

export interface DeclaredVerificationInputs {
  readonly sections: readonly DeclaredVerificationSection[];
}

export interface OrganizationVerificationDraft {
  readonly draftId: OrganizationVerificationDraftId;
  readonly recordId: OrganizationVerificationRecordId;
  readonly organizationId: OrganizationId;
  readonly profileRevisionId: OrganizationProfileRevisionId;
  readonly profileRevisionSequence: OrganizationProfileRevisionSequence;
  readonly profileFingerprint: OrganizationProfileFingerprint;
  readonly declaredInputs: DeclaredVerificationInputs;
  readonly evidenceReferenceIds: readonly OrganizationEvidenceReferenceId[];
  readonly draftVersion: DraftVersion;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly actorAuthorityReference: ActorAuthorityReference;
}

export interface DraftRecordContext {
  readonly recordId: OrganizationVerificationRecordId;
  readonly organizationId: OrganizationId;
}

export interface CreateDraftInput {
  readonly draftId: OrganizationVerificationDraftId;
  readonly organizationId: OrganizationId;
  readonly profileRevisionId: OrganizationProfileRevisionId;
  readonly profileRevisionSequence: OrganizationProfileRevisionSequence;
  readonly profileFingerprint: OrganizationProfileFingerprint;
  readonly declaredInputs: DeclaredVerificationInputs;
  readonly evidenceReferenceIds: readonly OrganizationEvidenceReferenceId[];
  readonly draftVersion: DraftVersion;
  readonly at: string;
  readonly actorAuthorityReference: ActorAuthorityReference;
}

function timestamp(value: string): boolean {
  return value.length > 0 && Number.isFinite(Date.parse(value));
}

function copyAuthority(
  input: ActorAuthorityReference,
): ActorAuthorityReference {
  return Object.freeze({
    actorId: input.actorId,
    authorityReferenceId: input.authorityReferenceId,
    authorityVersion: input.authorityVersion,
    organizationScope: input.organizationScope,
    issuedAt: input.issuedAt,
    delegatedScopes: Object.freeze([...input.delegatedScopes]),
  });
}

export function copyDeclaredInputs(
  input: DeclaredVerificationInputs,
): CoreDomainResult<DeclaredVerificationInputs> {
  if (!Array.isArray(input.sections)) {
    return domainFailure("mutable_input_rejected");
  }
  const sections: DeclaredVerificationSection[] = [];
  for (const section of input.sections) {
    if (
      !section ||
      typeof section.key !== "string" ||
      section.key.trim().length === 0 ||
      !Array.isArray(section.values)
    ) {
      return domainFailure("mutable_input_rejected");
    }
    const values: DeclaredVerificationValue[] = [];
    for (const value of section.values) {
      if (
        !value ||
        typeof value.key !== "string" ||
        value.key.trim().length === 0 ||
        typeof value.value !== "string"
      ) {
        return domainFailure("mutable_input_rejected");
      }
      values.push(Object.freeze({ key: value.key, value: value.value }));
    }
    sections.push(
      Object.freeze({
        key: section.key,
        values: Object.freeze(values),
      }),
    );
  }
  return domainSuccess(Object.freeze({ sections: Object.freeze(sections) }));
}

export function createDraftForRecord(
  record: DraftRecordContext,
  input: CreateDraftInput,
): CoreDomainResult<OrganizationVerificationDraft> {
  if (record.organizationId !== input.organizationId) {
    return domainFailure("organization_id_mismatch");
  }
  if (input.actorAuthorityReference.organizationScope !== input.organizationId) {
    return domainFailure("organization_id_mismatch");
  }
  if (!timestamp(input.at)) return domainFailure("mutable_input_rejected");
  const declaredInputs = copyDeclaredInputs(input.declaredInputs);
  if (!declaredInputs.ok) return declaredInputs;
  const evidenceReferences = freezeEvidenceReferenceSet(
    input.evidenceReferenceIds,
  );
  if (!evidenceReferences.ok) return evidenceReferences;
  return domainSuccess(
    Object.freeze({
      draftId: input.draftId,
      recordId: record.recordId,
      organizationId: input.organizationId,
      profileRevisionId: input.profileRevisionId,
      profileRevisionSequence: input.profileRevisionSequence,
      profileFingerprint: input.profileFingerprint,
      declaredInputs: declaredInputs.value,
      evidenceReferenceIds: evidenceReferences.value,
      draftVersion: input.draftVersion,
      createdAt: input.at,
      updatedAt: input.at,
      actorAuthorityReference: copyAuthority(input.actorAuthorityReference),
    }),
  );
}

export interface UpdateDraftInput {
  readonly expectedDraftVersion: DraftVersion;
  readonly nextDraftVersion: DraftVersion;
  readonly declaredInputs: DeclaredVerificationInputs;
  readonly evidenceReferenceIds: readonly OrganizationEvidenceReferenceId[];
  readonly updatedAt: string;
  readonly actorAuthorityReference: ActorAuthorityReference;
}

export function updateDraft(
  current: OrganizationVerificationDraft,
  input: UpdateDraftInput,
): CoreDomainResult<OrganizationVerificationDraft> {
  if (
    current.draftVersion !== input.expectedDraftVersion ||
    Number(input.nextDraftVersion) !== Number(current.draftVersion) + 1
  ) {
    return domainFailure("draft_version_mismatch");
  }
  if (
    input.actorAuthorityReference.organizationScope !== current.organizationId ||
    !timestamp(input.updatedAt)
  ) {
    return domainFailure("organization_id_mismatch");
  }
  const declaredInputs = copyDeclaredInputs(input.declaredInputs);
  if (!declaredInputs.ok) return declaredInputs;
  const evidenceReferences = freezeEvidenceReferenceSet(
    input.evidenceReferenceIds,
  );
  if (!evidenceReferences.ok) return evidenceReferences;
  return domainSuccess(
    Object.freeze({
      ...current,
      declaredInputs: declaredInputs.value,
      evidenceReferenceIds: evidenceReferences.value,
      draftVersion: input.nextDraftVersion,
      updatedAt: input.updatedAt,
      actorAuthorityReference: copyAuthority(input.actorAuthorityReference),
    }),
  );
}
