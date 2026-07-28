import type {
  ActorAuthorityReference,
  OrganizationId,
  OrganizationProfileFingerprint,
  OrganizationProfileRevisionId,
  OrganizationProfileRevisionSequence,
} from "../../organization-registry/index.js";
import type { DeclaredVerificationInputs } from "./draft.js";
import type { OrganizationEvidenceReferenceId } from "./evidenceReferences.js";
import type {
  CorrelationId,
  OrganizationVerificationRecordId,
  OrganizationVerificationRevisionId,
  SubmissionIdempotencyKey,
  VerificationRevisionSequence,
} from "./ids.js";

export interface OrganizationVerificationRevision {
  readonly revisionId: OrganizationVerificationRevisionId;
  readonly recordId: OrganizationVerificationRecordId;
  readonly organizationId: OrganizationId;
  readonly profileRevisionId: OrganizationProfileRevisionId;
  readonly profileRevisionSequence: OrganizationProfileRevisionSequence;
  readonly profileFingerprint: OrganizationProfileFingerprint;
  readonly sequence: VerificationRevisionSequence;
  readonly declaredInputs: DeclaredVerificationInputs;
  readonly evidenceReferenceIds: readonly OrganizationEvidenceReferenceId[];
  readonly submissionActorAuthorityReference: ActorAuthorityReference;
  readonly submittedAt: string;
  readonly submissionIdempotencyKey: SubmissionIdempotencyKey;
  readonly correlationId: CorrelationId;
  readonly supersedesRevisionId?: OrganizationVerificationRevisionId;
}
