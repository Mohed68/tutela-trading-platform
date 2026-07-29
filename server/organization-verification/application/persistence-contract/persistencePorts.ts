import {
  isOrganizationVerificationEvidenceAppendBatch,
  OrganizationVerificationEvidenceAppendBatch,
} from "./appendBatch.js";
import type {
  OrganizationVerificationEvidenceAppendReceipt,
} from "./appendReceipt.js";
import type {
  OrganizationVerificationEvidenceStreamLoadResult,
} from "./evidenceStream.js";
import type {
  OrganizationVerificationPersistenceFailureCode,
  OrganizationVerificationPersistenceResult,
} from "./persistenceErrors.js";
import {
  persistenceFailure,
  persistenceSuccess,
} from "./persistenceErrors.js";
import {
  isOrganizationVerificationWorkflowStreamIdentity,
  sameOrganizationVerificationWorkflowStreamIdentity,
} from "./persistenceStreamIdentity.js";
import type {
  OrganizationVerificationWorkflowStreamIdentity,
} from "./persistenceStreamIdentity.js";

export interface AppendOrganizationVerificationEvidenceRequest {
  readonly streamIdentity: OrganizationVerificationWorkflowStreamIdentity;
  readonly expectedStreamVersion: number;
  readonly batch: OrganizationVerificationEvidenceAppendBatch;
}

export type AppendOrganizationVerificationEvidenceResult =
  | Readonly<{
      ok: true;
      outcome: "appended" | "duplicate_append_idempotent";
      receipt: OrganizationVerificationEvidenceAppendReceipt;
    }>
  | Readonly<{
      ok: false;
      code: OrganizationVerificationPersistenceFailureCode;
      detail?: string;
    }>;

export interface LoadOrganizationVerificationEvidenceStreamRequest {
  readonly streamIdentity: OrganizationVerificationWorkflowStreamIdentity;
}

export interface OrganizationVerificationEvidenceAppendPort {
  appendOrganizationVerificationEvidence(
    request: AppendOrganizationVerificationEvidenceRequest,
  ): Promise<AppendOrganizationVerificationEvidenceResult>;
}

export interface OrganizationVerificationEvidenceStreamLoadPort {
  loadOrganizationVerificationEvidenceStream(
    request: LoadOrganizationVerificationEvidenceStreamRequest,
  ): Promise<OrganizationVerificationEvidenceStreamLoadResult>;
}

export type OrganizationVerificationEvidenceRepositoryPort =
  OrganizationVerificationEvidenceAppendPort &
    OrganizationVerificationEvidenceStreamLoadPort;

export function validateAppendOrganizationVerificationEvidenceRequest(
  request: AppendOrganizationVerificationEvidenceRequest,
): OrganizationVerificationPersistenceResult<true> {
  if (
    !isOrganizationVerificationWorkflowStreamIdentity(
      request.streamIdentity,
    ) ||
    !isOrganizationVerificationEvidenceAppendBatch(request.batch)
  ) {
    return persistenceFailure("malformed_append_metadata");
  }
  if (
    !sameOrganizationVerificationWorkflowStreamIdentity(
      request.streamIdentity,
      request.batch.streamIdentity,
    )
  ) {
    return persistenceFailure("stream_identity_mismatch");
  }
  if (request.expectedStreamVersion !== request.batch.expectedStreamVersion) {
    return persistenceFailure("expected_stream_version_conflict");
  }
  return persistenceSuccess(true);
}
