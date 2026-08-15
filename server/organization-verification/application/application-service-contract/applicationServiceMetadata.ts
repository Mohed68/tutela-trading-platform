import { immutableApplicationCopyInternal } from "./applicationServiceAuthenticity.js";

export interface OrganizationVerificationApplicationCommandMetadata {
  readonly applicationExecutionId: string;
  readonly commandId: string;
  readonly requestedAt: string;
  readonly applicationCompletedAt: string;
  readonly provenanceReferences: readonly string[];
  readonly integrityReferences: readonly string[];
  readonly correlationId: string;
  readonly causationId: string;
}

export interface OrganizationVerificationApplicationQueryMetadata {
  readonly applicationExecutionId: string;
  readonly queryId: string;
  readonly requestedAt: string;
  readonly applicationCompletedAt: string;
  readonly provenanceReferences: readonly string[];
  readonly integrityReferences: readonly string[];
  readonly correlationId: string;
}

export interface OrganizationVerificationApplicationReplayMetadata {
  readonly replayRequestId: string;
  readonly replayExecutionId: string;
  readonly replayedAt: string;
  readonly provenanceReferences: readonly string[];
  readonly integrityReferences: readonly string[];
}

export interface OrganizationVerificationApplicationAppendMetadata {
  readonly appendId: string;
  readonly authorityEvidenceEntryId?: string;
  readonly workflowStepRecordEvidenceEntryId?: string;
  readonly genesisEvidenceEntryId?: string;
  readonly appendedAt: string;
  readonly provenanceReferences: readonly string[];
  readonly integrityReferences: readonly string[];
}

export function isExactApplicationIdentity(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    !["latest", "current", "head", "default"].includes(
      value.trim().toLowerCase(),
    )
  );
}

export function isExplicitApplicationTimestamp(
  value: unknown,
): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function normalizeReferences(
  value: unknown,
): readonly string[] | undefined {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((entry) => !isExactApplicationIdentity(entry)) ||
    new Set(value).size !== value.length
  ) {
    return undefined;
  }
  return Object.freeze(
    [...value].sort((left, right) => left.localeCompare(right)),
  );
}

export function normalizeCommandMetadataInternal(
  value: OrganizationVerificationApplicationCommandMetadata,
): OrganizationVerificationApplicationCommandMetadata | undefined {
  const provenanceReferences = normalizeReferences(value.provenanceReferences);
  const integrityReferences = normalizeReferences(value.integrityReferences);
  if (
    !isExactApplicationIdentity(value.applicationExecutionId) ||
    !isExactApplicationIdentity(value.commandId) ||
    !isExactApplicationIdentity(value.correlationId) ||
    !isExactApplicationIdentity(value.causationId) ||
    !isExplicitApplicationTimestamp(value.requestedAt) ||
    !isExplicitApplicationTimestamp(value.applicationCompletedAt) ||
    Date.parse(value.applicationCompletedAt) < Date.parse(value.requestedAt) ||
    provenanceReferences === undefined ||
    integrityReferences === undefined
  ) {
    return undefined;
  }
  return Object.freeze({
    applicationExecutionId: value.applicationExecutionId,
    commandId: value.commandId,
    requestedAt: value.requestedAt,
    applicationCompletedAt: value.applicationCompletedAt,
    provenanceReferences,
    integrityReferences,
    correlationId: value.correlationId,
    causationId: value.causationId,
  });
}

export function normalizeQueryMetadataInternal(
  value: OrganizationVerificationApplicationQueryMetadata,
): OrganizationVerificationApplicationQueryMetadata | undefined {
  const provenanceReferences = normalizeReferences(value.provenanceReferences);
  const integrityReferences = normalizeReferences(value.integrityReferences);
  if (
    !isExactApplicationIdentity(value.applicationExecutionId) ||
    !isExactApplicationIdentity(value.queryId) ||
    !isExactApplicationIdentity(value.correlationId) ||
    !isExplicitApplicationTimestamp(value.requestedAt) ||
    !isExplicitApplicationTimestamp(value.applicationCompletedAt) ||
    Date.parse(value.applicationCompletedAt) < Date.parse(value.requestedAt) ||
    provenanceReferences === undefined ||
    integrityReferences === undefined
  ) {
    return undefined;
  }
  return Object.freeze({
    applicationExecutionId: value.applicationExecutionId,
    queryId: value.queryId,
    requestedAt: value.requestedAt,
    applicationCompletedAt: value.applicationCompletedAt,
    provenanceReferences,
    integrityReferences,
    correlationId: value.correlationId,
  });
}

export function normalizeReplayMetadataInternal(
  value: OrganizationVerificationApplicationReplayMetadata,
): OrganizationVerificationApplicationReplayMetadata | undefined {
  const provenanceReferences = normalizeReferences(value.provenanceReferences);
  const integrityReferences = normalizeReferences(value.integrityReferences);
  if (
    !isExactApplicationIdentity(value.replayRequestId) ||
    !isExactApplicationIdentity(value.replayExecutionId) ||
    value.replayRequestId === value.replayExecutionId ||
    !isExplicitApplicationTimestamp(value.replayedAt) ||
    provenanceReferences === undefined ||
    integrityReferences === undefined
  ) {
    return undefined;
  }
  return Object.freeze({
    replayRequestId: value.replayRequestId,
    replayExecutionId: value.replayExecutionId,
    replayedAt: value.replayedAt,
    provenanceReferences,
    integrityReferences,
  });
}

export function normalizeAppendMetadataInternal(
  value: OrganizationVerificationApplicationAppendMetadata,
  mode: "genesis" | "step",
): OrganizationVerificationApplicationAppendMetadata | undefined {
  const provenanceReferences = normalizeReferences(value.provenanceReferences);
  const integrityReferences = normalizeReferences(value.integrityReferences);
  const genesisValid =
    mode === "genesis" &&
    isExactApplicationIdentity(value.genesisEvidenceEntryId) &&
    value.authorityEvidenceEntryId === undefined &&
    value.workflowStepRecordEvidenceEntryId === undefined;
  const stepValid =
    mode === "step" &&
    value.genesisEvidenceEntryId === undefined &&
    isExactApplicationIdentity(value.authorityEvidenceEntryId) &&
    isExactApplicationIdentity(value.workflowStepRecordEvidenceEntryId);
  if (
    !isExactApplicationIdentity(value.appendId) ||
    !isExplicitApplicationTimestamp(value.appendedAt) ||
    provenanceReferences === undefined ||
    integrityReferences === undefined ||
    (!genesisValid && !stepValid)
  ) {
    return undefined;
  }
  return immutableApplicationCopyInternal({
    appendId: value.appendId,
    ...(value.authorityEvidenceEntryId !== undefined
      ? { authorityEvidenceEntryId: value.authorityEvidenceEntryId }
      : {}),
    ...(value.workflowStepRecordEvidenceEntryId !== undefined
      ? {
          workflowStepRecordEvidenceEntryId:
            value.workflowStepRecordEvidenceEntryId,
        }
      : {}),
    ...(value.genesisEvidenceEntryId !== undefined
      ? { genesisEvidenceEntryId: value.genesisEvidenceEntryId }
      : {}),
    appendedAt: value.appendedAt,
    provenanceReferences,
    integrityReferences,
  });
}
