import {
  parseOrganizationProfileRevisionContract,
  type ApprovedDisclosureProjection,
  type ContractResult,
  type DeclaredActivityProjection,
  type LegalIdentityProjection,
  type OrganizationId,
  type OrganizationLifecycleProjection,
  type OrganizationProfileFingerprint,
  type OrganizationProfileRevisionId,
  type OrganizationProfileRevisionSequence,
  type RegistryContractVersion,
} from "../../organization-registry/index.js";

export interface ExpectedRegistryRevision {
  readonly organizationId: OrganizationId;
  readonly organizationProfileRevisionId: OrganizationProfileRevisionId;
  readonly expectedRegistryContractVersion: RegistryContractVersion;
}

export interface VerificationRegistryInput {
  readonly sourceKind: "verification_input_derived_from_registry_contract";
  readonly organizationId: OrganizationId;
  readonly organizationProfileRevisionId: OrganizationProfileRevisionId;
  readonly organizationProfileRevisionSequence: OrganizationProfileRevisionSequence;
  readonly organizationProfileFingerprint: OrganizationProfileFingerprint;
  readonly legalIdentityProjection: LegalIdentityProjection;
  readonly organizationType: string;
  readonly jurisdiction: string;
  readonly declaredActivityProjection: DeclaredActivityProjection;
  readonly approvedDisclosureProjection?: ApprovedDisclosureProjection;
  readonly organizationLifecycle: OrganizationLifecycleProjection;
  readonly registryContractVersion: RegistryContractVersion;
  readonly registryPublishedAt: string;
}

function copyLegalIdentity(
  input: LegalIdentityProjection,
): LegalIdentityProjection {
  return Object.freeze({
    legalName: input.legalName,
    tradingNames: Object.freeze([...input.tradingNames]),
    registrationJurisdiction: input.registrationJurisdiction,
    registrationIdentifiers: Object.freeze(
      input.registrationIdentifiers.map((identifier) =>
        Object.freeze({ scheme: identifier.scheme, value: identifier.value }),
      ),
    ),
    ...(input.legalForm ? { legalForm: input.legalForm } : {}),
    ...(input.incorporationDate
      ? { incorporationDate: input.incorporationDate }
      : {}),
    ...(input.registeredAddress
      ? {
          registeredAddress: Object.freeze({
            ...(input.registeredAddress.countryCode
              ? { countryCode: input.registeredAddress.countryCode }
              : {}),
            ...(input.registeredAddress.administrativeArea
              ? {
                  administrativeArea:
                    input.registeredAddress.administrativeArea,
                }
              : {}),
            ...(input.registeredAddress.locality
              ? { locality: input.registeredAddress.locality }
              : {}),
            ...(input.registeredAddress.postalCode
              ? { postalCode: input.registeredAddress.postalCode }
              : {}),
            ...(input.registeredAddress.addressLines
              ? {
                  addressLines: Object.freeze([
                    ...input.registeredAddress.addressLines,
                  ]),
                }
              : {}),
          }),
        }
      : {}),
  });
}

function copyActivities(
  input: DeclaredActivityProjection,
): DeclaredActivityProjection {
  return Object.freeze({
    activities: Object.freeze(
      input.activities.map((activity) =>
        Object.freeze({
          ...(activity.code ? { code: activity.code } : {}),
          ...(activity.description
            ? { description: activity.description }
            : {}),
        }),
      ),
    ),
  });
}

function copyDisclosure(
  input: ApprovedDisclosureProjection | undefined,
): ApprovedDisclosureProjection | undefined {
  if (!input) return undefined;
  return Object.freeze({
    ...(input.legalName ? { legalName: input.legalName } : {}),
    ...(input.tradingNames
      ? { tradingNames: Object.freeze([...input.tradingNames]) }
      : {}),
    ...(input.organizationType
      ? { organizationType: input.organizationType }
      : {}),
    ...(input.jurisdiction ? { jurisdiction: input.jurisdiction } : {}),
  });
}

export function mapRegistryRevisionToVerificationInput(
  rawContract: unknown,
  expected: ExpectedRegistryRevision,
): ContractResult<VerificationRegistryInput> {
  const parsed = parseOrganizationProfileRevisionContract(rawContract);
  if (!parsed.ok) return parsed;

  if (parsed.value.registryContractVersion !== expected.expectedRegistryContractVersion) {
    return Object.freeze({
      ok: false,
      code: "unsupported_registry_contract_version",
    });
  }
  if (parsed.value.organizationId !== expected.organizationId) {
    return Object.freeze({ ok: false, code: "organization_id_mismatch" });
  }
  if (
    parsed.value.organizationProfileRevisionId !==
    expected.organizationProfileRevisionId
  ) {
    return Object.freeze({
      ok: false,
      code: "profile_revision_id_mismatch",
    });
  }

  const disclosure = copyDisclosure(
    parsed.value.approvedDisclosureProjection,
  );
  return Object.freeze({
    ok: true,
    value: Object.freeze({
      sourceKind: "verification_input_derived_from_registry_contract",
      organizationId: parsed.value.organizationId,
      organizationProfileRevisionId:
        parsed.value.organizationProfileRevisionId,
      organizationProfileRevisionSequence:
        parsed.value.organizationProfileRevisionSequence,
      organizationProfileFingerprint:
        parsed.value.organizationProfileFingerprint,
      legalIdentityProjection: copyLegalIdentity(
        parsed.value.legalIdentityProjection,
      ),
      organizationType: parsed.value.organizationType,
      jurisdiction: parsed.value.jurisdiction,
      declaredActivityProjection: copyActivities(
        parsed.value.declaredActivityProjection,
      ),
      ...(disclosure ? { approvedDisclosureProjection: disclosure } : {}),
      organizationLifecycle: parsed.value.organizationLifecycle,
      registryContractVersion: parsed.value.registryContractVersion,
      registryPublishedAt: parsed.value.publishedAt,
    }),
  });
}
