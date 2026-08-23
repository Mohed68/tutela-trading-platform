import type {
  ActivityEligibilityEvidenceReference,
  ActivityEligibilityRequest,
  ActivityEligibilityResult,
} from "./contracts.js";

export type ActivityEligibilityEvidenceResolution =
  | Readonly<{
      status: "resolved";
      evidenceReferences: readonly ActivityEligibilityEvidenceReference[];
    }>
  | Readonly<{ status: "not_found" }>
  | Readonly<{ status: "unavailable" }>
  | Readonly<{ status: "integrity_failure" }>;

export interface ActivityEligibilityEvidenceReadPort {
  resolveActivityEvidence(
    request: ActivityEligibilityRequest,
  ): Promise<ActivityEligibilityEvidenceResolution>;
}

export interface ActivityEligibilityPolicyPort {
  evaluateActivityEligibility(input: Readonly<{
    request: ActivityEligibilityRequest;
    evidence: ActivityEligibilityEvidenceResolution;
  }>): Promise<ActivityEligibilityResult>;
}

export interface ActivityEligibilityServicePort {
  evaluateActivityEligibility(
    request: ActivityEligibilityRequest,
  ): Promise<ActivityEligibilityResult>;
}
