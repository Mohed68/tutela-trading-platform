import type { OrganizationId } from "../organization-registry/index.js";
import type { OrganizationMembership } from "./membership.js";

export interface ExactOrganizationMembershipQuery {
  readonly membershipId: string;
  readonly userId: string;
  readonly organizationId: OrganizationId;
}

export type OrganizationMembershipResolution =
  | Readonly<{ status: "resolved"; membership: OrganizationMembership }>
  | Readonly<{ status: "not_found" }>
  | Readonly<{ status: "integrity_failure" }>;

export interface OrganizationMembershipReadPort {
  resolveExactMembership(
    query: ExactOrganizationMembershipQuery,
  ): Promise<OrganizationMembershipResolution>;
}
