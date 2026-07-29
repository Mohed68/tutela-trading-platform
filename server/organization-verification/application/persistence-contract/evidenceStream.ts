import {
  persistenceFailure,
  persistenceSuccess,
  type OrganizationVerificationPersistenceResult,
} from "./persistenceErrors.js";
import { fingerprintPersistenceContract } from "./persistenceFingerprint.js";
import {
  isOrganizationVerificationWorkflowStreamIdentity,
  type OrganizationVerificationWorkflowStreamIdentity,
} from "./persistenceStreamIdentity.js";
import {
  validateOrganizationVerificationEvidenceStreamIntegrity,
  type OrganizationVerificationEvidenceStreamIntegritySummary,
} from "./evidenceStreamIntegrity.js";
import type { OrganizationVerificationStoredEvidence } from "./storedEvidence.js";

export interface OrganizationVerificationEvidenceHeadReference {
  readonly evidenceEntryId: string;
  readonly streamPosition: number;
  readonly storedEvidenceFingerprint: string;
}

export interface OrganizationVerificationEvidenceStream {
  readonly streamIdentity: OrganizationVerificationWorkflowStreamIdentity;
  readonly streamVersion: number;
  readonly entries: readonly OrganizationVerificationStoredEvidence[];
  readonly headEvidenceReference: OrganizationVerificationEvidenceHeadReference;
  readonly integrity: OrganizationVerificationEvidenceStreamIntegritySummary;
  readonly evidenceStreamFingerprint: string;
}

export type OrganizationVerificationEvidenceStreamLoadResult =
  | Readonly<{
      status: "not_found";
      streamIdentity: OrganizationVerificationWorkflowStreamIdentity;
    }>
  | Readonly<{
      status: "found";
      stream: OrganizationVerificationEvidenceStream;
    }>;

const evidenceStreamSeal = Symbol(
  "organization-verification-evidence-stream",
);

function sealEvidenceStream(
  stream: OrganizationVerificationEvidenceStream,
): OrganizationVerificationEvidenceStream {
  Object.defineProperty(stream, evidenceStreamSeal, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  return Object.freeze(stream);
}

export function createOrganizationVerificationEvidenceStream(
  input: Readonly<{
    streamIdentity: OrganizationVerificationWorkflowStreamIdentity;
    entries: readonly OrganizationVerificationStoredEvidence[];
  }>,
): OrganizationVerificationPersistenceResult<OrganizationVerificationEvidenceStream> {
  if (!isOrganizationVerificationWorkflowStreamIdentity(input.streamIdentity)) {
    return persistenceFailure("stream_identity_mismatch");
  }
  const integrity =
    validateOrganizationVerificationEvidenceStreamIntegrity(
      input.streamIdentity,
      input.entries,
    );
  if (!integrity.ok) return integrity;
  const entries = Object.freeze([...input.entries]);
  const head = entries.at(-1);
  if (head === undefined) {
    return persistenceFailure("stored_integrity_failure");
  }
  const headEvidenceReference = Object.freeze({
    evidenceEntryId: head.evidenceEntryId,
    streamPosition: head.streamPosition,
    storedEvidenceFingerprint: head.storedEvidenceFingerprint,
  });
  const evidenceStreamFingerprint = fingerprintPersistenceContract({
    scope: "organization_verification_evidence_stream",
    streamIdentityFingerprint:
      input.streamIdentity.streamIdentityFingerprint,
    streamVersion: entries.length,
    orderedEvidenceFingerprints: entries.map(
      (entry) => entry.storedEvidenceFingerprint,
    ),
    headEvidenceReference,
    integrity: integrity.value,
  });
  return persistenceSuccess(
    sealEvidenceStream({
      streamIdentity: input.streamIdentity,
      streamVersion: entries.length,
      entries,
      headEvidenceReference,
      integrity: integrity.value,
      evidenceStreamFingerprint,
    }),
  );
}

export function isOrganizationVerificationEvidenceStream(
  value: unknown,
): value is OrganizationVerificationEvidenceStream {
  return (
    typeof value === "object" &&
    value !== null &&
    Object.getOwnPropertyDescriptor(value, evidenceStreamSeal)?.value ===
      true &&
    Object.isFrozen(value)
  );
}

export function organizationVerificationEvidenceStreamNotFound(
  streamIdentity: OrganizationVerificationWorkflowStreamIdentity,
): OrganizationVerificationPersistenceResult<OrganizationVerificationEvidenceStreamLoadResult> {
  if (!isOrganizationVerificationWorkflowStreamIdentity(streamIdentity)) {
    return persistenceFailure("stream_identity_mismatch");
  }
  return persistenceSuccess(
    Object.freeze({ status: "not_found", streamIdentity }),
  );
}

export function organizationVerificationEvidenceStreamFound(
  stream: OrganizationVerificationEvidenceStream,
): OrganizationVerificationPersistenceResult<OrganizationVerificationEvidenceStreamLoadResult> {
  if (!isOrganizationVerificationEvidenceStream(stream)) {
    return persistenceFailure("stored_integrity_failure");
  }
  return persistenceSuccess(Object.freeze({ status: "found", stream }));
}
