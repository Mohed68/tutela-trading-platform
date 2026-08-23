import type { OrganizationRegistryProfileRevisionPort } from "../organization-registry/index.js";
import type { OrganizationMembershipReadPort } from "../organization-membership/index.js";
import type {
  OrganizationVerificationReplayExecution,
} from "../organization-verification/application/replay-runtime/index.js";
import type {
  OrganizationVerificationWorkflowStreamIdentity,
} from "../organization-verification/application/persistence-contract/index.js";
import type {
  OrganizationParticipationEligibilityEvaluation,
  OrganizationParticipationEligibilityRequest,
} from "./eligibilityContracts.js";

export type OrganizationVerificationParticipationStateResolution =
  | Readonly<{
      status: "resolved";
      replayExecution: OrganizationVerificationReplayExecution;
    }>
  | Readonly<{ status: "not_found" }>
  | Readonly<{ status: "unavailable" }>;

export interface OrganizationVerificationParticipationStatePort {
  resolveAuthoritativeReplay(input: Readonly<{
    streamIdentity: OrganizationVerificationWorkflowStreamIdentity;
  }>): Promise<OrganizationVerificationParticipationStateResolution>;
}

export interface OrganizationParticipationEligibilityDependencies {
  readonly organizationRegistry: OrganizationRegistryProfileRevisionPort;
  readonly organizationMembership: OrganizationMembershipReadPort;
  readonly organizationVerificationState: OrganizationVerificationParticipationStatePort;
}

export interface OrganizationParticipationEligibilityServicePort {
  evaluateParticipationEligibility(
    request: OrganizationParticipationEligibilityRequest,
  ): Promise<OrganizationParticipationEligibilityEvaluation>;
}
