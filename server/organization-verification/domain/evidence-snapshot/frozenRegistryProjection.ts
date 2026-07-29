import {
  REGISTRY_CONTRACT_VERSION,
  ORGANIZATION_LIFECYCLES,
  type ApprovedDisclosureProjection,
  type DeclaredActivityProjection,
  type LegalIdentityProjection,
  type OrganizationId,
  type OrganizationLifecycleProjection,
  type OrganizationProfileFingerprint,
  type OrganizationProfileRevisionContract,
  type OrganizationProfileRevisionId,
  type OrganizationProfileRevisionSequence,
  type RegistryContractVersion,
} from "../../../organization-registry/index.js";
import {
  evidenceSnapshotFailure,
  evidenceSnapshotSuccess,
  type EvidenceSnapshotDomainResult,
} from "./errors.js";
import {
  FROZEN_REGISTRY_PROJECTION_VERSION,
  isCanonicalTimestamp,
  type EvidenceSnapshotIntegrityReference,
  type EvidenceSnapshotProvenanceReference,
  type FrozenRegistryProjectionVersion,
} from "./ids.js";

export interface OrganizationVerificationFrozenRegistryProjection {
  readonly projectionVersion: FrozenRegistryProjectionVersion;
  readonly organizationId: OrganizationId;
  readonly profileRevisionId: OrganizationProfileRevisionId;
  readonly profileRevisionSequence: OrganizationProfileRevisionSequence;
  readonly profileFingerprint: OrganizationProfileFingerprint;
  readonly legalIdentity: LegalIdentityProjection;
  readonly organizationType: string;
  readonly jurisdiction: string;
  readonly declaredActivities: DeclaredActivityProjection;
  readonly approvedDisclosure?: ApprovedDisclosureProjection;
  readonly sourceLifecycle: OrganizationLifecycleProjection;
  readonly registryContractVersion: RegistryContractVersion;
  readonly sourcePublishedAt: string;
  readonly provenanceReference: EvidenceSnapshotProvenanceReference;
  readonly integrityReference: EvidenceSnapshotIntegrityReference;
}

export interface OrganizationVerificationRegistrySnapshotSource {
  readonly profileRevision: OrganizationProfileRevisionContract;
  readonly provenanceReference: EvidenceSnapshotProvenanceReference;
  readonly integrityReference: EvidenceSnapshotIntegrityReference;
}

function exactText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function sortedStrings(values: readonly string[]): readonly string[] {
  return Object.freeze([...values].sort((left, right) => left.localeCompare(right)));
}

function copyLegalIdentity(
  source: LegalIdentityProjection,
): LegalIdentityProjection {
  const registrationIdentifiers = Object.freeze(
    source.registrationIdentifiers
      .map((identifier) =>
        Object.freeze({ scheme: identifier.scheme, value: identifier.value }),
      )
      .sort((left, right) =>
        `${left.scheme}\u0000${left.value}`.localeCompare(
          `${right.scheme}\u0000${right.value}`,
        ),
      ),
  );
  const registeredAddress = source.registeredAddress
    ? Object.freeze({
        ...(source.registeredAddress.countryCode
          ? { countryCode: source.registeredAddress.countryCode }
          : {}),
        ...(source.registeredAddress.administrativeArea
          ? { administrativeArea: source.registeredAddress.administrativeArea }
          : {}),
        ...(source.registeredAddress.locality
          ? { locality: source.registeredAddress.locality }
          : {}),
        ...(source.registeredAddress.postalCode
          ? { postalCode: source.registeredAddress.postalCode }
          : {}),
        ...(source.registeredAddress.addressLines
          ? {
              addressLines: Object.freeze([
                ...source.registeredAddress.addressLines,
              ]),
            }
          : {}),
      })
    : undefined;
  return Object.freeze({
    legalName: source.legalName,
    tradingNames: sortedStrings(source.tradingNames),
    registrationJurisdiction: source.registrationJurisdiction,
    registrationIdentifiers,
    ...(source.legalForm ? { legalForm: source.legalForm } : {}),
    ...(source.incorporationDate
      ? { incorporationDate: source.incorporationDate }
      : {}),
    ...(registeredAddress ? { registeredAddress } : {}),
  });
}

function copyActivities(
  source: DeclaredActivityProjection,
): DeclaredActivityProjection {
  return Object.freeze({
    activities: Object.freeze(
      source.activities
        .map((activity) =>
          Object.freeze({
            ...(activity.code ? { code: activity.code } : {}),
            ...(activity.description
              ? { description: activity.description }
              : {}),
          }),
        )
        .sort((left, right) =>
          `${left.code ?? ""}\u0000${left.description ?? ""}`.localeCompare(
            `${right.code ?? ""}\u0000${right.description ?? ""}`,
          ),
        ),
    ),
  });
}

function copyDisclosure(
  source: ApprovedDisclosureProjection | undefined,
): ApprovedDisclosureProjection | undefined {
  return source
    ? Object.freeze({
        ...(source.legalName ? { legalName: source.legalName } : {}),
        ...(source.tradingNames
          ? { tradingNames: sortedStrings(source.tradingNames) }
          : {}),
        ...(source.organizationType
          ? { organizationType: source.organizationType }
          : {}),
        ...(source.jurisdiction
          ? { jurisdiction: source.jurisdiction }
          : {}),
      })
    : undefined;
}

export function freezeOrganizationVerificationRegistryProjection(
  source: OrganizationVerificationRegistrySnapshotSource,
  snapshotCreatedAt: string,
): EvidenceSnapshotDomainResult<OrganizationVerificationFrozenRegistryProjection> {
  const profile = source.profileRevision;
  if (
    typeof profile !== "object" ||
    profile === null ||
    !exactText(profile.organizationId) ||
    !exactText(profile.organizationProfileRevisionId) ||
    !Number.isSafeInteger(profile.organizationProfileRevisionSequence) ||
    Number(profile.organizationProfileRevisionSequence) <= 0 ||
    !exactText(profile.organizationProfileFingerprint) ||
    !exactText(profile.organizationType) ||
    !exactText(profile.jurisdiction) ||
    profile.registryContractVersion !== REGISTRY_CONTRACT_VERSION ||
    !ORGANIZATION_LIFECYCLES.includes(profile.organizationLifecycle) ||
    !isCanonicalTimestamp(profile.publishedAt) ||
    Date.parse(profile.publishedAt) > Date.parse(snapshotCreatedAt) ||
    !exactText(source.provenanceReference) ||
    !exactText(source.integrityReference)
  ) {
    return evidenceSnapshotFailure("registry_projection_mismatch");
  }
  if (
    !profile.legalIdentityProjection ||
    !exactText(profile.legalIdentityProjection.legalName) ||
    !Array.isArray(profile.legalIdentityProjection.tradingNames) ||
    !exactText(profile.legalIdentityProjection.registrationJurisdiction) ||
    !Array.isArray(
      profile.legalIdentityProjection.registrationIdentifiers,
    ) ||
    profile.legalIdentityProjection.registrationIdentifiers.some(
      (identifier) =>
        !exactText(identifier.scheme) || !exactText(identifier.value),
    ) ||
    !profile.declaredActivityProjection ||
    !Array.isArray(profile.declaredActivityProjection.activities)
  ) {
    return evidenceSnapshotFailure("registry_projection_mismatch");
  }

  const approvedDisclosure = copyDisclosure(
    profile.approvedDisclosureProjection,
  );
  return evidenceSnapshotSuccess(
    Object.freeze({
      projectionVersion: FROZEN_REGISTRY_PROJECTION_VERSION,
      organizationId: profile.organizationId,
      profileRevisionId: profile.organizationProfileRevisionId,
      profileRevisionSequence: profile.organizationProfileRevisionSequence,
      profileFingerprint: profile.organizationProfileFingerprint,
      legalIdentity: copyLegalIdentity(profile.legalIdentityProjection),
      organizationType: profile.organizationType,
      jurisdiction: profile.jurisdiction,
      declaredActivities: copyActivities(
        profile.declaredActivityProjection,
      ),
      ...(approvedDisclosure ? { approvedDisclosure } : {}),
      sourceLifecycle: profile.organizationLifecycle,
      registryContractVersion: REGISTRY_CONTRACT_VERSION,
      sourcePublishedAt: profile.publishedAt,
      provenanceReference: source.provenanceReference,
      integrityReference: source.integrityReference,
    }),
  );
}
