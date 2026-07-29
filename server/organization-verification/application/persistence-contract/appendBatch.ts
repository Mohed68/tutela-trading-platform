import {
  persistenceFailure,
  persistenceSuccess,
  type OrganizationVerificationPersistenceResult,
} from "./persistenceErrors.js";
import { fingerprintPersistenceContract } from "./persistenceFingerprint.js";
import {
  isOrganizationVerificationWorkflowStreamIdentity,
  sameOrganizationVerificationWorkflowStreamIdentity,
  type OrganizationVerificationWorkflowStreamIdentity,
} from "./persistenceStreamIdentity.js";
import {
  isOrganizationVerificationStoredEvidence,
  type OrganizationVerificationStoredEvidence,
} from "./storedEvidence.js";
import { organizationVerificationEvidencePairMatchesWorkflowStep } from "./evidenceStreamIntegrity.js";
import {
  isExactPersistenceIdentity,
  isExplicitPersistenceTimestamp,
  normalizePersistenceReferences,
} from "./persistenceValidation.js";

export interface CreateOrganizationVerificationEvidenceAppendBatchInput {
  readonly appendId: string;
  readonly streamIdentity: OrganizationVerificationWorkflowStreamIdentity;
  readonly expectedStreamVersion: number;
  readonly expectedHeadEvidenceEntryId?: string;
  readonly entries: readonly OrganizationVerificationStoredEvidence[];
  readonly appendedAt: string;
  readonly provenanceReferences: readonly string[];
  readonly integrityReferences: readonly string[];
}

export interface OrganizationVerificationEvidenceAppendBatch
  extends Readonly<CreateOrganizationVerificationEvidenceAppendBatchInput> {
  readonly entries: readonly OrganizationVerificationStoredEvidence[];
  readonly provenanceReferences: readonly string[];
  readonly integrityReferences: readonly string[];
  readonly appendBatchFingerprint: string;
}

const appendBatchSeal = Symbol(
  "organization-verification-evidence-append-batch",
);

function validateBatchShape(
  input: CreateOrganizationVerificationEvidenceAppendBatchInput,
): OrganizationVerificationPersistenceResult<true> {
  if (
    !isOrganizationVerificationWorkflowStreamIdentity(input.streamIdentity) ||
    !isExactPersistenceIdentity(input.appendId) ||
    !Number.isSafeInteger(input.expectedStreamVersion) ||
    input.expectedStreamVersion < 0 ||
    !isExplicitPersistenceTimestamp(input.appendedAt) ||
    !Array.isArray(input.entries) ||
    input.entries.length === 0
  ) {
    return persistenceFailure("malformed_append_metadata");
  }
  if (
    (input.expectedStreamVersion === 0 &&
      input.expectedHeadEvidenceEntryId !== undefined) ||
    (input.expectedStreamVersion > 0 &&
      !isExactPersistenceIdentity(input.expectedHeadEvidenceEntryId))
  ) {
    return persistenceFailure("malformed_append_metadata");
  }
  if (input.expectedStreamVersion === 0) {
    if (
      input.entries.length !== 1 ||
      input.entries[0]?.evidenceKind !== "workflow_genesis"
    ) {
      return persistenceFailure("invalid_evidence_order");
    }
  } else {
    if (
      input.expectedStreamVersion % 2 === 0 ||
      input.entries.length % 2 !== 0
    ) {
      return persistenceFailure("invalid_evidence_order");
    }
    for (let index = 0; index < input.entries.length; index += 2) {
      if (
        input.entries[index]?.evidenceKind === "workflow_genesis" ||
        input.entries[index]?.evidenceKind === "workflow_step_record" ||
        input.entries[index + 1]?.evidenceKind !== "workflow_step_record"
      ) {
        return persistenceFailure("invalid_evidence_order");
      }
    }
  }
  return persistenceSuccess(true);
}

export function createOrganizationVerificationEvidenceAppendBatch(
  input: CreateOrganizationVerificationEvidenceAppendBatchInput,
): OrganizationVerificationPersistenceResult<OrganizationVerificationEvidenceAppendBatch> {
  const shape = validateBatchShape(input);
  if (!shape.ok) return shape;
  const provenanceReferences = normalizePersistenceReferences(
    input.provenanceReferences,
  );
  const integrityReferences = normalizePersistenceReferences(
    input.integrityReferences,
  );
  if (provenanceReferences === undefined || integrityReferences === undefined) {
    return persistenceFailure("malformed_append_metadata");
  }

  const evidenceIds = new Set<string>();
  const semanticEvidence: Array<
    Readonly<{ key: string; artifactFingerprint: string }>
  > = [];
  let predecessor = input.expectedHeadEvidenceEntryId;
  let priorEntry: OrganizationVerificationStoredEvidence | undefined;
  for (let index = 0; index < input.entries.length; index += 1) {
    const entry = input.entries[index];
    if (
      entry === undefined ||
      !isOrganizationVerificationStoredEvidence(entry)
    ) {
      return persistenceFailure("unauthentic_evidence");
    }
    if (
      !sameOrganizationVerificationWorkflowStreamIdentity(
        input.streamIdentity,
        entry.streamIdentity,
      )
    ) {
      return persistenceFailure("stream_identity_mismatch");
    }
    if (
      entry.streamPosition !== input.expectedStreamVersion + index + 1 ||
      entry.predecessorEvidenceEntryId !== predecessor ||
      Date.parse(input.appendedAt) < Date.parse(entry.appendedAt) ||
      (priorEntry !== undefined &&
        Date.parse(entry.appendedAt) < Date.parse(priorEntry.appendedAt)) ||
      (priorEntry !== undefined &&
        Date.parse(entry.artifactOccurredAt) <
          Date.parse(priorEntry.artifactOccurredAt))
    ) {
      return persistenceFailure("invalid_evidence_order");
    }
    const semanticKey = `${entry.evidenceKind}:${entry.semanticArtifactIdentity}:${String(
      entry.artifactVersionOrSequence,
    )}`;
    if (evidenceIds.has(entry.evidenceEntryId)) {
      return persistenceFailure("evidence_identity_conflict");
    }
    const existingSemantic = semanticEvidence.find(
      (candidate) => candidate.key === semanticKey,
    );
    if (existingSemantic !== undefined) {
      return persistenceFailure(
        existingSemantic.artifactFingerprint === entry.artifactFingerprint
          ? "evidence_identity_conflict"
          : "evidence_fingerprint_conflict",
      );
    }
    evidenceIds.add(entry.evidenceEntryId);
    semanticEvidence.push(
      Object.freeze({
        key: semanticKey,
        artifactFingerprint: entry.artifactFingerprint,
      }),
    );
    predecessor = entry.evidenceEntryId;
    priorEntry = entry;
  }

  if (input.expectedStreamVersion > 0) {
    let expectedWorkflowVersion =
      (input.expectedStreamVersion + 1) / 2;
    for (let index = 0; index < input.entries.length; index += 2) {
      const authority = input.entries[index];
      const step = input.entries[index + 1];
      if (
        authority === undefined ||
        step === undefined ||
        step.evidenceKind !== "workflow_step_record" ||
        !organizationVerificationEvidencePairMatchesWorkflowStep(
          authority,
          step,
        ) ||
        step.artifact.predecessorWorkflowExecutionVersion !==
          expectedWorkflowVersion ||
        step.artifact.nextWorkflowExecutionVersion !==
          expectedWorkflowVersion + 1
      ) {
        return persistenceFailure("invalid_evidence_order");
      }
      expectedWorkflowVersion += 1;
    }
  }

  const entries = Object.freeze([...input.entries]);
  const appendBatchFingerprint = fingerprintPersistenceContract({
    scope: "organization_verification_evidence_append_batch",
    appendId: input.appendId,
    streamIdentityFingerprint:
      input.streamIdentity.streamIdentityFingerprint,
    expectedStreamVersion: input.expectedStreamVersion,
    expectedHeadEvidenceEntryId: input.expectedHeadEvidenceEntryId,
    orderedEvidenceFingerprints: entries.map(
      (entry) => entry.storedEvidenceFingerprint,
    ),
    appendedAt: input.appendedAt,
    provenanceReferences,
    integrityReferences,
  });
  const batch: OrganizationVerificationEvidenceAppendBatch = {
    appendId: input.appendId,
    streamIdentity: input.streamIdentity,
    expectedStreamVersion: input.expectedStreamVersion,
    ...(input.expectedHeadEvidenceEntryId === undefined
      ? {}
      : {
          expectedHeadEvidenceEntryId:
            input.expectedHeadEvidenceEntryId,
        }),
    entries,
    appendedAt: input.appendedAt,
    provenanceReferences,
    integrityReferences,
    appendBatchFingerprint,
  };
  Object.defineProperty(batch, appendBatchSeal, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  return persistenceSuccess(Object.freeze(batch));
}

export function isOrganizationVerificationEvidenceAppendBatch(
  value: unknown,
): value is OrganizationVerificationEvidenceAppendBatch {
  return (
    typeof value === "object" &&
    value !== null &&
    Object.getOwnPropertyDescriptor(value, appendBatchSeal)?.value === true &&
    Object.isFrozen(value)
  );
}
