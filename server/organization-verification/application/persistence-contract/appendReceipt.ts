import {
  isOrganizationVerificationEvidenceAppendBatch,
  type OrganizationVerificationEvidenceAppendBatch,
} from "./appendBatch.js";
import {
  persistenceFailure,
  persistenceSuccess,
  type OrganizationVerificationPersistenceResult,
} from "./persistenceErrors.js";
import { fingerprintPersistenceContract } from "./persistenceFingerprint.js";
import type { OrganizationVerificationWorkflowStreamIdentity } from "./persistenceStreamIdentity.js";

export type OrganizationVerificationEvidenceAppendOutcome =
  | "appended"
  | "duplicate_append_idempotent";

export interface OrganizationVerificationAppendedEvidenceReference {
  readonly evidenceEntryId: string;
  readonly streamPosition: number;
  readonly storedEvidenceFingerprint: string;
}

export interface OrganizationVerificationEvidenceAppendReceipt {
  readonly appendId: string;
  readonly appendBatchFingerprint: string;
  readonly streamIdentity: OrganizationVerificationWorkflowStreamIdentity;
  readonly expectedStreamVersion: number;
  readonly previousStreamVersion: number;
  readonly resultingStreamVersion: number;
  readonly firstAppendedPosition: number;
  readonly lastAppendedPosition: number;
  readonly appendedEvidenceReferences: readonly OrganizationVerificationAppendedEvidenceReference[];
  readonly outcome: OrganizationVerificationEvidenceAppendOutcome;
  readonly idempotentReplay: boolean;
  readonly appendedAt: string;
  readonly provenanceReferences: readonly string[];
  readonly integrityReferences: readonly string[];
  readonly appendReceiptFingerprint: string;
}

const appendReceiptSeal = Symbol(
  "organization-verification-evidence-append-receipt",
);

export function createOrganizationVerificationEvidenceAppendReceipt(
  input: Readonly<{
    batch: OrganizationVerificationEvidenceAppendBatch;
    outcome: OrganizationVerificationEvidenceAppendOutcome;
  }>,
): OrganizationVerificationPersistenceResult<OrganizationVerificationEvidenceAppendReceipt> {
  if (
    !isOrganizationVerificationEvidenceAppendBatch(input.batch) ||
    !["appended", "duplicate_append_idempotent"].includes(input.outcome)
  ) {
    return persistenceFailure("malformed_append_metadata");
  }
  const previousStreamVersion = input.batch.expectedStreamVersion;
  const resultingStreamVersion =
    previousStreamVersion + input.batch.entries.length;
  const appendedEvidenceReferences = Object.freeze(
    input.batch.entries.map((entry) =>
      Object.freeze({
        evidenceEntryId: entry.evidenceEntryId,
        streamPosition: entry.streamPosition,
        storedEvidenceFingerprint: entry.storedEvidenceFingerprint,
      }),
    ),
  );
  const first = appendedEvidenceReferences[0];
  const last = appendedEvidenceReferences.at(-1);
  if (first === undefined || last === undefined) {
    return persistenceFailure("malformed_append_metadata");
  }
  const idempotentReplay =
    input.outcome === "duplicate_append_idempotent";
  const appendReceiptFingerprint = fingerprintPersistenceContract({
    scope: "organization_verification_evidence_append_receipt",
    appendId: input.batch.appendId,
    appendBatchFingerprint: input.batch.appendBatchFingerprint,
    streamIdentityFingerprint:
      input.batch.streamIdentity.streamIdentityFingerprint,
    expectedStreamVersion: input.batch.expectedStreamVersion,
    previousStreamVersion,
    resultingStreamVersion,
    firstAppendedPosition: first.streamPosition,
    lastAppendedPosition: last.streamPosition,
    appendedEvidenceReferences,
    outcome: input.outcome,
    idempotentReplay,
    appendedAt: input.batch.appendedAt,
    provenanceReferences: input.batch.provenanceReferences,
    integrityReferences: input.batch.integrityReferences,
  });
  const receipt: OrganizationVerificationEvidenceAppendReceipt = {
    appendId: input.batch.appendId,
    appendBatchFingerprint: input.batch.appendBatchFingerprint,
    streamIdentity: input.batch.streamIdentity,
    expectedStreamVersion: input.batch.expectedStreamVersion,
    previousStreamVersion,
    resultingStreamVersion,
    firstAppendedPosition: first.streamPosition,
    lastAppendedPosition: last.streamPosition,
    appendedEvidenceReferences,
    outcome: input.outcome,
    idempotentReplay,
    appendedAt: input.batch.appendedAt,
    provenanceReferences: input.batch.provenanceReferences,
    integrityReferences: input.batch.integrityReferences,
    appendReceiptFingerprint,
  };
  Object.defineProperty(receipt, appendReceiptSeal, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  return persistenceSuccess(Object.freeze(receipt));
}

export function isOrganizationVerificationEvidenceAppendReceipt(
  value: unknown,
): value is OrganizationVerificationEvidenceAppendReceipt {
  return (
    typeof value === "object" &&
    value !== null &&
    Object.getOwnPropertyDescriptor(value, appendReceiptSeal)?.value ===
      true &&
    Object.isFrozen(value)
  );
}
