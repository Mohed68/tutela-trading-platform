import type {
  VerificationDisposition,
  VerificationPolicyFamily,
  VerificationReasonCode,
  VerificationRuleId,
  VerificationSeverity,
} from "../../shared/verification.js";

export interface VerificationRuleDefinition {
  id: VerificationRuleId;
  reasonCode: VerificationReasonCode;
  severity: VerificationSeverity;
  disposition: VerificationDisposition;
  policyFamily: VerificationPolicyFamily;
}

export const VERIFICATION_RULE_CATALOG: Readonly<
  Record<VerificationRuleId, VerificationRuleDefinition>
> = {
  "TECHNICAL-001": {
    id: "TECHNICAL-001",
    reasonCode: "MISSING_REQUIRED_FIELD",
    severity: "ERROR",
    disposition: "owner_correctable",
    policyFamily: "technical",
  },
  "TECHNICAL-002": {
    id: "TECHNICAL-002",
    reasonCode: "INVALID_OFFER_TYPE",
    severity: "ERROR",
    disposition: "owner_correctable",
    policyFamily: "technical",
  },
  "TECHNICAL-003": {
    id: "TECHNICAL-003",
    reasonCode: "INVALID_COMMODITY",
    severity: "ERROR",
    disposition: "owner_correctable",
    policyFamily: "technical",
  },
  "TECHNICAL-004": {
    id: "TECHNICAL-004",
    reasonCode: "INVALID_QUANTITY",
    severity: "ERROR",
    disposition: "owner_correctable",
    policyFamily: "technical",
  },
  "TECHNICAL-005": {
    id: "TECHNICAL-005",
    reasonCode: "INVALID_UNIT",
    severity: "ERROR",
    disposition: "owner_correctable",
    policyFamily: "technical",
  },
  "TECHNICAL-006": {
    id: "TECHNICAL-006",
    reasonCode: "INVALID_PRICE",
    severity: "ERROR",
    disposition: "owner_correctable",
    policyFamily: "technical",
  },
  "TECHNICAL-007": {
    id: "TECHNICAL-007",
    reasonCode: "INVALID_CURRENCY",
    severity: "ERROR",
    disposition: "owner_correctable",
    policyFamily: "technical",
  },
  "TECHNICAL-008": {
    id: "TECHNICAL-008",
    reasonCode: "INVALID_LOCATION",
    severity: "ERROR",
    disposition: "owner_correctable",
    policyFamily: "technical",
  },
  "TECHNICAL-009": {
    id: "TECHNICAL-009",
    reasonCode: "INVALID_VALIDITY",
    severity: "ERROR",
    disposition: "owner_correctable",
    policyFamily: "technical",
  },
  "TECHNICAL-010": {
    id: "TECHNICAL-010",
    reasonCode: "EXPIRED_VALIDITY",
    severity: "ERROR",
    disposition: "owner_correctable",
    policyFamily: "technical",
  },
  "TECHNICAL-011": {
    id: "TECHNICAL-011",
    reasonCode: "SCHEMA_INCONSISTENCY",
    severity: "CRITICAL",
    disposition: "requires_platform_review",
    policyFamily: "technical",
  },
  "COMMERCIAL-001": {
    id: "COMMERCIAL-001",
    reasonCode: "UNSUPPORTED_COMMODITY",
    severity: "ERROR",
    disposition: "owner_correctable",
    policyFamily: "commercial",
  },
  "COMMERCIAL-002": {
    id: "COMMERCIAL-002",
    reasonCode: "UNSUPPORTED_COMMERCIAL_MODEL",
    severity: "ERROR",
    disposition: "owner_correctable",
    policyFamily: "commercial",
  },
  "COMMERCIAL-014": {
    id: "COMMERCIAL-014",
    reasonCode: "UNIT_NOT_ALLOWED_FOR_COMMODITY",
    severity: "ERROR",
    disposition: "owner_correctable",
    policyFamily: "commercial",
  },
  "COMMERCIAL-015": {
    id: "COMMERCIAL-015",
    reasonCode: "CURRENCY_NOT_ALLOWED_BY_CURRENT_POLICY",
    severity: "ERROR",
    disposition: "owner_correctable",
    policyFamily: "commercial",
  },
  "SYSTEM-001": {
    id: "SYSTEM-001",
    reasonCode: "POLICY_CONFIGURATION_UNAVAILABLE",
    severity: "CRITICAL",
    disposition: "requires_platform_review",
    policyFamily: "system",
  },
  "SYSTEM-002": {
    id: "SYSTEM-002",
    reasonCode: "VALIDATION_DATA_UNAVAILABLE",
    severity: "WARNING",
    disposition: "requires_platform_review",
    policyFamily: "system",
  },
  "SYSTEM-003": {
    id: "SYSTEM-003",
    reasonCode: "OFFER_STATE_CONFLICT",
    severity: "CRITICAL",
    disposition: "requires_platform_review",
    policyFamily: "system",
  },
  "SYSTEM-999": {
    id: "SYSTEM-999",
    reasonCode: "UNKNOWN_VALIDATION_ERROR",
    severity: "CRITICAL",
    disposition: "requires_platform_review",
    policyFamily: "system",
  },
};
