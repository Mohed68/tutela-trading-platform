export const VERIFICATION_PROCESS_STATES = [
  "not_started",
  "queued",
  "running",
  "completed",
] as const;

export type VerificationProcessState =
  (typeof VERIFICATION_PROCESS_STATES)[number];

export const VERIFICATION_DECISIONS = [
  "approved",
  "revision_required",
  "manual_review",
] as const;

export type VerificationDecision = (typeof VERIFICATION_DECISIONS)[number];

export const VERIFICATION_SEVERITIES = [
  "INFO",
  "WARNING",
  "ERROR",
  "CRITICAL",
] as const;

export type VerificationSeverity = (typeof VERIFICATION_SEVERITIES)[number];

export const VERIFICATION_DISPOSITIONS = [
  "owner_correctable",
  "requires_platform_review",
] as const;

export type VerificationDisposition =
  (typeof VERIFICATION_DISPOSITIONS)[number];

export const VERIFICATION_POLICY_FAMILIES = [
  "technical",
  "commercial",
  "system",
] as const;

export type VerificationPolicyFamily =
  (typeof VERIFICATION_POLICY_FAMILIES)[number];

export const VERIFICATION_CONFIDENCE_VALUES = [
  "HIGH",
  "MEDIUM",
  "LOW",
] as const;

export type VerificationConfidence =
  (typeof VERIFICATION_CONFIDENCE_VALUES)[number];

export const VERIFICATION_REASON_CODES = [
  "MISSING_REQUIRED_FIELD",
  "INVALID_OFFER_TYPE",
  "INVALID_COMMODITY",
  "INVALID_QUANTITY",
  "INVALID_UNIT",
  "INVALID_PRICE",
  "INVALID_CURRENCY",
  "INVALID_LOCATION",
  "INVALID_VALIDITY",
  "EXPIRED_VALIDITY",
  "SCHEMA_INCONSISTENCY",
  "UNSUPPORTED_COMMODITY",
  "UNSUPPORTED_COMMERCIAL_MODEL",
  "UNIT_NOT_ALLOWED_FOR_COMMODITY",
  "CURRENCY_NOT_ALLOWED_BY_CURRENT_POLICY",
  "COMMERCIAL_POLICY_FAILED",
  "POLICY_CONFIGURATION_UNAVAILABLE",
  "VALIDATION_DATA_UNAVAILABLE",
  "OFFER_STATE_CONFLICT",
  "UNKNOWN_VALIDATION_ERROR",
] as const;

export type VerificationReasonCode =
  (typeof VERIFICATION_REASON_CODES)[number];

export const VERIFICATION_RULE_IDS = [
  "TECHNICAL-001",
  "TECHNICAL-002",
  "TECHNICAL-003",
  "TECHNICAL-004",
  "TECHNICAL-005",
  "TECHNICAL-006",
  "TECHNICAL-007",
  "TECHNICAL-008",
  "TECHNICAL-009",
  "TECHNICAL-010",
  "TECHNICAL-011",
  "COMMERCIAL-001",
  "COMMERCIAL-002",
  "COMMERCIAL-014",
  "COMMERCIAL-015",
  "SYSTEM-001",
  "SYSTEM-002",
  "SYSTEM-003",
  "SYSTEM-999",
] as const;

export type VerificationRuleId = (typeof VERIFICATION_RULE_IDS)[number];

export interface VerificationRuleFinding {
  ruleId: VerificationRuleId;
  reasonCode: VerificationReasonCode;
  severity: VerificationSeverity;
  disposition: VerificationDisposition;
  policyFamily: VerificationPolicyFamily;
  policyVersion: string;
  evaluationOrder: number;
}

export interface SubmittedOfferVerificationSnapshot {
  snapshotSchemaVersion: string;
  offerId: string;
  submissionRevision: number;
  submittedRecordVersion: string;
  offerType: string;
  commodity: {
    id: string;
    name: string;
    category: string;
  };
  quantity: string;
  unit: string;
  amountPerUnit: string;
  currency: string | null;
  location: string;
  validUntil: string | null;
  lifecycleStatus: string;
}

export interface VerificationPolicyVersions {
  technicalPolicyVersion: string;
  commercialPolicyVersion: string;
}

export interface VerificationEngineResult
  extends VerificationPolicyVersions {
  decision: VerificationDecision;
  confidence: VerificationConfidence;
  confidenceModelVersion: string;
  engineVersion: string;
  snapshotSchemaVersion: string;
  findings: VerificationRuleFinding[];
}

export interface VerificationEligibilityProjection {
  offerId: string;
  submissionRevision: number;
  attemptId: string;
  processState: VerificationProcessState;
  decision: VerificationDecision | null;
  eligibility: "eligible" | "not_eligible" | "pending";
  completedAt: string | null;
  engineVersion: string;
  technicalPolicyVersion: string;
  commercialPolicyVersion: string;
  inputFingerprint: string;
}
