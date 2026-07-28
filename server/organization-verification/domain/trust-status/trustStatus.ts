import type { OrganizationId } from "../../../organization-registry/index.js";
import type {
  OrganizationVerificationDecisionId,
  OrganizationVerificationDecisionOutcome,
} from "../decision/index.js";
import type {
  CorrelationId,
  OrganizationVerificationAttemptId,
  OrganizationVerificationRecordId,
  OrganizationVerificationRevisionId,
  SnapshotFingerprint,
  SnapshotId,
} from "../ids.js";
import type { DecisionApplicabilityState } from "./applicability.js";
import type {
  InvalidationFactId,
  TrustStatusDeriverVersion,
  TrustStatusIntegrityReference,
  TrustStatusProjectionId,
  TrustStatusProvenanceReference,
  TrustStatusSourceFactsVersion,
} from "./ids.js";

export const ORGANIZATION_VERIFICATION_TRUST_STATUS_VALUES = [
  "unestablished",
  "trusted",
  "not_trusted",
  "expired",
  "invalidated",
] as const;

export type OrganizationVerificationTrustStatusValue =
  (typeof ORGANIZATION_VERIFICATION_TRUST_STATUS_VALUES)[number];

export interface OrganizationVerificationTrustStatusData {
  readonly projectionId: TrustStatusProjectionId;
  readonly organizationId: OrganizationId;
  readonly recordId: OrganizationVerificationRecordId;
  readonly sourceDecisionId?: OrganizationVerificationDecisionId;
  readonly sourceRevisionId?: OrganizationVerificationRevisionId;
  readonly sourceAttemptId?: OrganizationVerificationAttemptId;
  readonly sourceSnapshotId?: SnapshotId;
  readonly sourceSnapshotFingerprint?: SnapshotFingerprint;
  readonly sourceDecisionOutcome?: OrganizationVerificationDecisionOutcome;
  readonly sourceDecisionApplicability?: DecisionApplicabilityState;
  readonly status: OrganizationVerificationTrustStatusValue;
  readonly sourceFactsVersion: TrustStatusSourceFactsVersion;
  readonly deriverVersion: TrustStatusDeriverVersion;
  readonly derivationAsOf: string;
  readonly derivedAt: string;
  readonly effectiveFrom: string;
  readonly effectiveUntil?: string;
  readonly invalidationFactId?: InvalidationFactId;
  readonly supersededDecisionId?: OrganizationVerificationDecisionId;
  readonly provenanceReference: TrustStatusProvenanceReference;
  readonly correlationId: CorrelationId;
  readonly integrityReference: TrustStatusIntegrityReference;
}
