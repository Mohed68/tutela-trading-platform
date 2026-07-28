import type { OrganizationId } from "../../../organization-registry/index.js";
import type {
  CorrelationId,
  OrganizationVerificationAttemptId,
  OrganizationVerificationRecordId,
  OrganizationVerificationRevisionId,
  SnapshotFingerprint,
  SnapshotId,
} from "../ids.js";
import type {
  DecisionEngineVersion,
  DecisionIntegrityReference,
  EvaluationCompletionId,
  OrganizationVerificationDecisionId,
  PolicySetReference,
  PolicySetVersion,
} from "./ids.js";

export const ORGANIZATION_VERIFICATION_DECISION_OUTCOMES = [
  "approved",
  "revision_required",
  "manual_review",
  "rejected",
] as const;

export type OrganizationVerificationDecisionOutcome =
  (typeof ORGANIZATION_VERIFICATION_DECISION_OUTCOMES)[number];

export interface DecisionPolicyProvenance {
  readonly policySetReference: PolicySetReference;
  readonly policySetVersion: PolicySetVersion;
}

export interface OrganizationVerificationDecisionData {
  readonly decisionId: OrganizationVerificationDecisionId;
  readonly recordId: OrganizationVerificationRecordId;
  readonly revisionId: OrganizationVerificationRevisionId;
  readonly attemptId: OrganizationVerificationAttemptId;
  readonly organizationId: OrganizationId;
  readonly snapshotId: SnapshotId;
  readonly snapshotFingerprint: SnapshotFingerprint;
  readonly evaluationCompletionId: EvaluationCompletionId;
  readonly outcome: OrganizationVerificationDecisionOutcome;
  readonly decisionEngineVersion: DecisionEngineVersion;
  readonly policyProvenance: DecisionPolicyProvenance;
  readonly decidedAt: string;
  readonly correlationId: CorrelationId;
  readonly integrityReference: DecisionIntegrityReference;
  readonly supersedesDecisionId?: OrganizationVerificationDecisionId;
}
