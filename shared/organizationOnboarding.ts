export type OrganizationOnboardingVerificationPhase =
  | "not_started"
  | "in_progress"
  | "completed"
  | "unavailable";

export interface CurrentOrganizationContext {
  organizationId: string;
  profileRevisionId: string;
  displayName: string;
  lifecycle: string;
  membership: {
    membershipId: string;
    role: "owner" | "member";
    status: "active";
  };
  verification: {
    phase: OrganizationOnboardingVerificationPhase;
    canonicalTrustStatus: string | null;
  };
}

export type CurrentOrganizationContextDto =
  | Readonly<{ state: "setup_required"; organization: null }>
  | Readonly<{
      state: "available";
      organization: CurrentOrganizationContext;
    }>
  | Readonly<{ state: "unavailable"; organization: null }>;

export interface OrganizationRegistrationRequest {
  legalName: string;
  tradingNames: readonly string[];
  organizationType: string;
  jurisdiction: string;
  registrationIdentifiers: readonly {
    scheme: string;
    value: string;
  }[];
  declaredActivities: readonly {
    code: string;
    description?: string;
  }[];
}

export interface OrganizationRegistrationCreatedResponse {
  status: "created";
  organizationId: string;
  profileRevisionId: string;
  lifecycle: "active";
  membershipId: string;
  membershipRole: "owner";
  membershipStatus: "active";
}
