import type {
  ActorAuthorityReference,
  OrganizationId,
  OrganizationProfileRevisionContract,
  OrganizationProfileRevisionId,
  RegistryContractFailureCode,
  RegistryContractVersion,
} from "./contracts.js";

export interface ExactProfileRevisionQuery {
  readonly organizationId: OrganizationId;
  readonly organizationProfileRevisionId: OrganizationProfileRevisionId;
  readonly expectedRegistryContractVersion: RegistryContractVersion;
}

export type ProfileRevisionResolution =
  | {
      readonly status: "resolved";
      readonly contract: OrganizationProfileRevisionContract;
    }
  | {
      readonly status: "not_found";
      readonly code: "profile_revision_not_found";
    }
  | {
      readonly status: "version_unavailable";
      readonly code: "unsupported_registry_contract_version";
    }
  | {
      readonly status: "integrity_failure";
      readonly code: "profile_revision_integrity_failure";
    };

export interface OrganizationRegistryProfileRevisionPort {
  resolveExactProfileRevision(
    query: ExactProfileRevisionQuery,
  ): Promise<ProfileRevisionResolution>;
}

export type AuthorityReferenceResolution =
  | {
      readonly status: "valid";
      readonly reference: ActorAuthorityReference;
    }
  | {
      readonly status: "invalid";
      readonly code:
        | "authority_reference_invalid"
        | "unsupported_registry_contract_version";
    };

export interface OrganizationRegistryAuthorityPort {
  validateAuthorityReference(
    reference: ActorAuthorityReference,
  ): Promise<AuthorityReferenceResolution>;
}

export type RegistryPortFailureCode = Extract<
  RegistryContractFailureCode,
  | "profile_revision_not_found"
  | "profile_revision_integrity_failure"
  | "unsupported_registry_contract_version"
  | "authority_reference_invalid"
>;
