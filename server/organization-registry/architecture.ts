/**
 * Architecture-only ownership marker for the future Organization Registry
 * capability. Contracts, domain types, persistence, and runtime behavior are
 * intentionally absent from this Phase 7B-1 boundary.
 */
export const ORGANIZATION_REGISTRY_ARCHITECTURE = {
  capabilityId: "organization_registry",
  capabilityRoot: "server/organization-registry",
  runtimeStatus: "inert_architecture_boundary",
  reservedAuthorities: {
    identityAuthority: "organization_registry",
    profileRevisionAuthority: "organization_registry",
    lifecycleAuthority: "organization_registry",
  },
} as const;

export type OrganizationRegistryArchitectureMarker =
  typeof ORGANIZATION_REGISTRY_ARCHITECTURE;
