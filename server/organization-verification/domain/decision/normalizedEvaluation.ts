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
  EvaluationCompletionId,
  PolicySetReference,
  PolicySetVersion,
} from "./ids.js";

export const NORMALIZED_EVALUATION_CLASSIFICATIONS = [
  "approval_ready",
  "revision_required",
  "manual_review_required",
  "rejection_required",
] as const;

export type NormalizedEvaluationClassification =
  (typeof NORMALIZED_EVALUATION_CLASSIFICATIONS)[number];

export interface RawNormalizedOrganizationVerificationEvaluation {
  readonly recordId: OrganizationVerificationRecordId;
  readonly revisionId: OrganizationVerificationRevisionId;
  readonly attemptId: OrganizationVerificationAttemptId;
  readonly organizationId: OrganizationId;
  readonly snapshotId: SnapshotId;
  readonly snapshotFingerprint: SnapshotFingerprint;
  readonly evaluationCompletionId: EvaluationCompletionId;
  readonly policySetReference: PolicySetReference;
  readonly policySetVersion: PolicySetVersion;
  readonly completedAt: string;
  readonly evaluationComplete: boolean;
  readonly evaluationIntegrityValid: boolean;
  readonly approvalReady: boolean;
  readonly revisionRequired: boolean;
  readonly manualReviewRequired: boolean;
  readonly rejectionRequired: boolean;
  readonly categorySummaries?: readonly string[];
  readonly correlationId: CorrelationId;
}
