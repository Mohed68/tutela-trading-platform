export const REGISTRY_CONTRACT_VERSION =
  "organization_registry_profile_revision.v1" as const;

export const ORGANIZATION_LIFECYCLES = [
  "registered",
  "active",
  "suspended",
  "closed",
] as const;

declare const opaqueBrand: unique symbol;
type Opaque<T extends string> = string & { readonly [opaqueBrand]: T };
type OpaqueNumber<T extends string> = number & {
  readonly [opaqueBrand]: T;
};

export type OrganizationId = Opaque<"OrganizationId">;
export type OrganizationProfileRevisionId =
  Opaque<"OrganizationProfileRevisionId">;
export type OrganizationProfileRevisionSequence =
  OpaqueNumber<"OrganizationProfileRevisionSequence">;
export type OrganizationProfileFingerprint =
  Opaque<"OrganizationProfileFingerprint">;
export type RegistryContractVersion = typeof REGISTRY_CONTRACT_VERSION;
export type OrganizationLifecycleProjection =
  (typeof ORGANIZATION_LIFECYCLES)[number];

export type RegistryContractFailureCode =
  | "unsupported_registry_contract_version"
  | "organization_id_mismatch"
  | "profile_revision_id_mismatch"
  | "invalid_revision_sequence"
  | "missing_profile_fingerprint"
  | "malformed_legal_identity_projection"
  | "malformed_lifecycle_projection"
  | "unknown_contract_field"
  | "authority_reference_invalid"
  | "profile_revision_not_found"
  | "profile_revision_integrity_failure";

export type ContractResult<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false;
      readonly code: RegistryContractFailureCode;
      readonly path?: string;
    };

export interface RegistrationIdentifierProjection {
  readonly scheme: string;
  readonly value: string;
}

export interface RegisteredAddressProjection {
  readonly countryCode?: string;
  readonly administrativeArea?: string;
  readonly locality?: string;
  readonly postalCode?: string;
  readonly addressLines?: readonly string[];
}

export interface LegalIdentityProjection {
  readonly legalName: string;
  readonly tradingNames: readonly string[];
  readonly registrationJurisdiction: string;
  readonly registrationIdentifiers: readonly RegistrationIdentifierProjection[];
  readonly legalForm?: string;
  readonly incorporationDate?: string;
  readonly registeredAddress?: RegisteredAddressProjection;
}

export interface DeclaredActivityItemProjection {
  readonly code?: string;
  readonly description?: string;
}

export interface DeclaredActivityProjection {
  readonly activities: readonly DeclaredActivityItemProjection[];
}

export interface ApprovedDisclosureProjection {
  readonly legalName?: string;
  readonly tradingNames?: readonly string[];
  readonly organizationType?: string;
  readonly jurisdiction?: string;
}

export interface OrganizationProfileRevisionContract {
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
  readonly publishedAt: string;
}

export interface ActorAuthorityReference {
  readonly actorId: string;
  readonly authorityReferenceId: string;
  readonly authorityVersion: string;
  readonly organizationScope: OrganizationId;
  readonly issuedAt: string;
  readonly delegatedScopes: readonly string[];
}

const CONTRACT_FIELDS = new Set([
  "organization_id",
  "organization_profile_revision_id",
  "organization_profile_revision_sequence",
  "organization_profile_fingerprint",
  "legal_identity_projection",
  "organization_type",
  "jurisdiction",
  "declared_activity_projection",
  "approved_disclosure_projection",
  "organization_lifecycle",
  "registry_contract_version",
  "published_at",
]);

const LEGAL_IDENTITY_FIELDS = new Set([
  "legal_name",
  "trading_names",
  "registration_jurisdiction",
  "registration_identifiers",
  "legal_form",
  "incorporation_date",
  "registered_address",
]);

const REGISTRATION_IDENTIFIER_FIELDS = new Set(["scheme", "value"]);
const ADDRESS_FIELDS = new Set([
  "country_code",
  "administrative_area",
  "locality",
  "postal_code",
  "address_lines",
]);
const ACTIVITY_PROJECTION_FIELDS = new Set(["activities"]);
const ACTIVITY_FIELDS = new Set(["code", "description"]);
const DISCLOSURE_FIELDS = new Set([
  "legal_name",
  "trading_names",
  "organization_type",
  "jurisdiction",
]);
const AUTHORITY_FIELDS = new Set([
  "actor_id",
  "authority_reference_id",
  "authority_version",
  "organization_scope",
  "issued_at",
  "delegated_scopes",
]);

function failure<T>(
  code: RegistryContractFailureCode,
  path?: string,
): ContractResult<T> {
  return Object.freeze(path ? { ok: false, code, path } : { ok: false, code });
}

function success<T>(value: T): ContractResult<T> {
  return Object.freeze({ ok: true, value });
}

function record(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function unexpectedField(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
): string | undefined {
  return Object.keys(value).find((key) => !allowed.has(key));
}

function nonBlank(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value
    : undefined;
}

function isoTimestamp(value: unknown): string | undefined {
  const text = nonBlank(value);
  return text && Number.isFinite(Date.parse(text)) ? text : undefined;
}

function optionalNonBlank(value: unknown): string | undefined | null {
  if (value === undefined) return undefined;
  return nonBlank(value) ?? null;
}

function stringArray(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.map(nonBlank);
  return items.every((item): item is string => item !== undefined)
    ? Object.freeze([...items])
    : undefined;
}

function parseOpaque<T extends string>(
  value: unknown,
): Opaque<T> | undefined {
  return nonBlank(value) as Opaque<T> | undefined;
}

export function createOrganizationId(
  value: unknown,
): ContractResult<OrganizationId> {
  const id = parseOpaque<"OrganizationId">(value);
  return id ? success(id) : failure("organization_id_mismatch");
}

export function createOrganizationProfileRevisionId(
  value: unknown,
): ContractResult<OrganizationProfileRevisionId> {
  const id = parseOpaque<"OrganizationProfileRevisionId">(value);
  return id && !["current", "latest", "head"].includes(id.toLowerCase())
    ? success(id)
    : failure("profile_revision_id_mismatch");
}

export function createOrganizationProfileRevisionSequence(
  value: unknown,
): ContractResult<OrganizationProfileRevisionSequence> {
  return Number.isSafeInteger(value) && Number(value) > 0
    ? success(Number(value) as OrganizationProfileRevisionSequence)
    : failure("invalid_revision_sequence");
}

export function createOrganizationProfileFingerprint(
  value: unknown,
): ContractResult<OrganizationProfileFingerprint> {
  const fingerprint = parseOpaque<"OrganizationProfileFingerprint">(value);
  return fingerprint
    ? success(fingerprint)
    : failure("missing_profile_fingerprint");
}

export function parseRegistryContractVersion(
  value: unknown,
): ContractResult<RegistryContractVersion> {
  return value === REGISTRY_CONTRACT_VERSION
    ? success(REGISTRY_CONTRACT_VERSION)
    : failure("unsupported_registry_contract_version");
}

function parseLegalIdentity(
  value: unknown,
): ContractResult<LegalIdentityProjection> {
  const input = record(value);
  if (!input) return failure("malformed_legal_identity_projection");
  const extra = unexpectedField(input, LEGAL_IDENTITY_FIELDS);
  if (extra) return failure("unknown_contract_field", `legal_identity.${extra}`);

  const legalName = nonBlank(input.legal_name);
  const tradingNames = stringArray(input.trading_names);
  const registrationJurisdiction = nonBlank(input.registration_jurisdiction);
  if (!legalName || !tradingNames || !registrationJurisdiction) {
    return failure("malformed_legal_identity_projection");
  }

  if (!Array.isArray(input.registration_identifiers)) {
    return failure("malformed_legal_identity_projection");
  }
  const registrationIdentifiers: RegistrationIdentifierProjection[] = [];
  for (const [index, candidate] of input.registration_identifiers.entries()) {
    const item = record(candidate);
    if (!item) return failure("malformed_legal_identity_projection");
    const itemExtra = unexpectedField(item, REGISTRATION_IDENTIFIER_FIELDS);
    if (itemExtra) {
      return failure(
        "unknown_contract_field",
        `legal_identity.registration_identifiers.${index}.${itemExtra}`,
      );
    }
    const scheme = nonBlank(item.scheme);
    const identifierValue = nonBlank(item.value);
    if (!scheme || !identifierValue) {
      return failure("malformed_legal_identity_projection");
    }
    registrationIdentifiers.push(Object.freeze({ scheme, value: identifierValue }));
  }

  const legalForm = optionalNonBlank(input.legal_form);
  const incorporationDate = optionalNonBlank(input.incorporation_date);
  if (legalForm === null || incorporationDate === null) {
    return failure("malformed_legal_identity_projection");
  }

  let registeredAddress: RegisteredAddressProjection | undefined;
  if (input.registered_address !== undefined) {
    const address = record(input.registered_address);
    if (!address) return failure("malformed_legal_identity_projection");
    const addressExtra = unexpectedField(address, ADDRESS_FIELDS);
    if (addressExtra) {
      return failure(
        "unknown_contract_field",
        `legal_identity.registered_address.${addressExtra}`,
      );
    }
    const addressLines =
      address.address_lines === undefined
        ? undefined
        : stringArray(address.address_lines);
    if (address.address_lines !== undefined && !addressLines) {
      return failure("malformed_legal_identity_projection");
    }
    const safeAddress: RegisteredAddressProjection = {};
    for (const [source, target] of [
      ["country_code", "countryCode"],
      ["administrative_area", "administrativeArea"],
      ["locality", "locality"],
      ["postal_code", "postalCode"],
    ] as const) {
      const parsed = optionalNonBlank(address[source]);
      if (parsed === null) return failure("malformed_legal_identity_projection");
      if (parsed !== undefined) {
        Object.assign(safeAddress, { [target]: parsed });
      }
    }
    if (addressLines) Object.assign(safeAddress, { addressLines });
    registeredAddress = Object.freeze(safeAddress);
  }

  return success(
    Object.freeze({
      legalName,
      tradingNames,
      registrationJurisdiction,
      registrationIdentifiers: Object.freeze(registrationIdentifiers),
      ...(legalForm ? { legalForm } : {}),
      ...(incorporationDate ? { incorporationDate } : {}),
      ...(registeredAddress ? { registeredAddress } : {}),
    }),
  );
}

function parseActivities(
  value: unknown,
): ContractResult<DeclaredActivityProjection> {
  const input = record(value);
  if (!input) return failure("malformed_legal_identity_projection");
  const extra = unexpectedField(input, ACTIVITY_PROJECTION_FIELDS);
  if (extra) return failure("unknown_contract_field", `activities.${extra}`);
  if (!Array.isArray(input.activities)) {
    return failure("malformed_legal_identity_projection");
  }
  const activities: DeclaredActivityItemProjection[] = [];
  for (const [index, candidate] of input.activities.entries()) {
    const item = record(candidate);
    if (!item) return failure("malformed_legal_identity_projection");
    const itemExtra = unexpectedField(item, ACTIVITY_FIELDS);
    if (itemExtra) {
      return failure(
        "unknown_contract_field",
        `activities.${index}.${itemExtra}`,
      );
    }
    const code = optionalNonBlank(item.code);
    const description = optionalNonBlank(item.description);
    if (code === null || description === null || (!code && !description)) {
      return failure("malformed_legal_identity_projection");
    }
    activities.push(
      Object.freeze({
        ...(code ? { code } : {}),
        ...(description ? { description } : {}),
      }),
    );
  }
  return success(Object.freeze({ activities: Object.freeze(activities) }));
}

function parseDisclosure(
  value: unknown,
): ContractResult<ApprovedDisclosureProjection | undefined> {
  if (value === undefined) return success(undefined);
  const input = record(value);
  if (!input) return failure("malformed_legal_identity_projection");
  const extra = unexpectedField(input, DISCLOSURE_FIELDS);
  if (extra) return failure("unknown_contract_field", `disclosure.${extra}`);
  const legalName = optionalNonBlank(input.legal_name);
  const organizationType = optionalNonBlank(input.organization_type);
  const jurisdiction = optionalNonBlank(input.jurisdiction);
  const tradingNames =
    input.trading_names === undefined
      ? undefined
      : stringArray(input.trading_names);
  if (
    legalName === null ||
    organizationType === null ||
    jurisdiction === null ||
    (input.trading_names !== undefined && !tradingNames)
  ) {
    return failure("malformed_legal_identity_projection");
  }
  return success(
    Object.freeze({
      ...(legalName ? { legalName } : {}),
      ...(tradingNames ? { tradingNames } : {}),
      ...(organizationType ? { organizationType } : {}),
      ...(jurisdiction ? { jurisdiction } : {}),
    }),
  );
}

export function parseOrganizationProfileRevisionContract(
  value: unknown,
): ContractResult<OrganizationProfileRevisionContract> {
  const input = record(value);
  if (!input) return failure("malformed_legal_identity_projection");
  const extra = unexpectedField(input, CONTRACT_FIELDS);
  if (extra) return failure("unknown_contract_field", extra);

  const organizationId = createOrganizationId(input.organization_id);
  if (!organizationId.ok) return organizationId;
  const revisionId = createOrganizationProfileRevisionId(
    input.organization_profile_revision_id,
  );
  if (!revisionId.ok) return revisionId;
  const fingerprint = createOrganizationProfileFingerprint(
    input.organization_profile_fingerprint,
  );
  if (!fingerprint.ok) return fingerprint;
  const version = parseRegistryContractVersion(input.registry_contract_version);
  if (!version.ok) return version;

  const sequence = createOrganizationProfileRevisionSequence(
    input.organization_profile_revision_sequence,
  );
  if (!sequence.ok) return sequence;
  if (!ORGANIZATION_LIFECYCLES.includes(input.organization_lifecycle as never)) {
    return failure("malformed_lifecycle_projection");
  }
  const legalIdentity = parseLegalIdentity(input.legal_identity_projection);
  if (!legalIdentity.ok) return legalIdentity;
  const activities = parseActivities(input.declared_activity_projection);
  if (!activities.ok) return activities;
  const disclosure = parseDisclosure(input.approved_disclosure_projection);
  if (!disclosure.ok) return disclosure;
  const organizationType = nonBlank(input.organization_type);
  const jurisdiction = nonBlank(input.jurisdiction);
  const publishedAt = isoTimestamp(input.published_at);
  if (!organizationType || !jurisdiction || !publishedAt) {
    return failure("malformed_legal_identity_projection");
  }

  return success(
    Object.freeze({
      organizationId: organizationId.value,
      organizationProfileRevisionId: revisionId.value,
      organizationProfileRevisionSequence: sequence.value,
      organizationProfileFingerprint: fingerprint.value,
      legalIdentityProjection: legalIdentity.value,
      organizationType,
      jurisdiction,
      declaredActivityProjection: activities.value,
      ...(disclosure.value
        ? { approvedDisclosureProjection: disclosure.value }
        : {}),
      organizationLifecycle:
        input.organization_lifecycle as OrganizationLifecycleProjection,
      registryContractVersion: version.value,
      publishedAt,
    }),
  );
}

export function parseActorAuthorityReference(
  value: unknown,
): ContractResult<ActorAuthorityReference> {
  const input = record(value);
  if (!input) return failure("authority_reference_invalid");
  const extra = unexpectedField(input, AUTHORITY_FIELDS);
  if (extra) return failure("unknown_contract_field", `authority.${extra}`);
  const actorId = nonBlank(input.actor_id);
  const authorityReferenceId = nonBlank(input.authority_reference_id);
  const authorityVersion = nonBlank(input.authority_version);
  const organizationScope = createOrganizationId(input.organization_scope);
  const issuedAt = isoTimestamp(input.issued_at);
  const delegatedScopes = stringArray(input.delegated_scopes);
  if (
    !actorId ||
    !authorityReferenceId ||
    !authorityVersion ||
    !organizationScope.ok ||
    !issuedAt ||
    !delegatedScopes
  ) {
    return failure("authority_reference_invalid");
  }
  return success(
    Object.freeze({
      actorId,
      authorityReferenceId,
      authorityVersion,
      organizationScope: organizationScope.value,
      issuedAt,
      delegatedScopes,
    }),
  );
}
