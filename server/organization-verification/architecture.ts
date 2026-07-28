/**
 * Architecture-only ownership marker for the Organization Verification
 * capability. This module is intentionally inert and must not be wired into
 * application startup, routes, workers, or frontend code.
 */
export const ORGANIZATION_VERIFICATION_ARCHITECTURE = {
  capabilityId: "organization_verification",
  capabilityRoot: "server/organization-verification",
  runtimeNamespacePrefix: "org_verification.",
  runtimeStatus: "inert_architecture_boundary",
  reservedAuthorities: {
    decisionAuthority: "organization_verification_decision_engine",
    workflowAuthority: "organization_verification_workflow_coordinator",
    trustStatusAuthority: "organization_verification_trust_status_deriver",
  },
  boundaries: {
    organizationRegistry: {
      capabilityRoot: "server/organization-registry",
      relationship: "external_upstream_authority",
    },
    offerVerification: {
      capabilityRoot: "server/verification",
      relationship: "independent_sibling_capability",
    },
    confidentialEvidenceStorage: {
      capabilityRoot: "external/confidential-evidence-storage",
      relationship: "external_raw_artifact_authority",
    },
    participationEligibility: {
      capabilityRoot: "future/participation-eligibility",
      relationship: "external_downstream_authority",
    },
  },
} as const;

export type OrganizationVerificationArchitectureMarker =
  typeof ORGANIZATION_VERIFICATION_ARCHITECTURE;
