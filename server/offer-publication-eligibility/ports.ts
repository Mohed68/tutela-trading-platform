import type { OrganizationParticipationEligibilityResult } from "../organization-participation-eligibility/index.js";
import type { OfferVerificationEligibilityReadPort } from "../verification/eligibilityReadModel.js";

export type MarketplaceOrganizationParticipationResolution =
  | Readonly<{
      status: "resolved";
      result: OrganizationParticipationEligibilityResult;
    }>
  | Readonly<{ status: "not_found" }>
  | Readonly<{ status: "unavailable" }>
  | Readonly<{ status: "integrity_failure" }>;

export interface MarketplaceOrganizationParticipationEligibilityReadPort {
  resolveCurrentOrganizationParticipationEligibility(input: Readonly<{
    organizationId: string;
    userId: string;
    activityContext?: Readonly<{
      activityCode: string;
      commodityId: string;
      commodityClassification: string | null;
      jurisdiction: string | null;
    }>;
  }>): Promise<MarketplaceOrganizationParticipationResolution>;
}

export interface OfferPublicationEligibilityDependencies {
  readonly organizationParticipationEligibility: MarketplaceOrganizationParticipationEligibilityReadPort;
  readonly offerVerificationEligibility: OfferVerificationEligibilityReadPort;
}
