import {
  contractFailure,
  contractSuccess,
  type AttemptLifecycleContractResult,
} from "./attemptLifecycleErrors.js";

export interface AttemptLifecycleEvidenceArtifacts {
  readonly provenanceReferences: readonly string[];
  readonly integrityReferences: readonly string[];
}

function validReference(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    !["current", "latest", "head"].includes(value.trim().toLowerCase())
  );
}

function normalizeReferences(
  values: readonly string[],
): AttemptLifecycleContractResult<readonly string[]> {
  if (
    !Array.isArray(values) ||
    values.length === 0 ||
    values.some((value) => !validReference(value)) ||
    new Set(values).size !== values.length
  ) {
    return contractFailure("invalid_artifacts");
  }
  return contractSuccess(
    Object.freeze([...values].sort((left, right) => left.localeCompare(right))),
  );
}

export function normalizeAttemptLifecycleEvidenceArtifacts(
  artifacts: AttemptLifecycleEvidenceArtifacts,
): AttemptLifecycleContractResult<AttemptLifecycleEvidenceArtifacts> {
  if (typeof artifacts !== "object" || artifacts === null) {
    return contractFailure("invalid_artifacts");
  }
  const provenance = normalizeReferences(artifacts.provenanceReferences);
  if (!provenance.ok) return provenance;
  const integrity = normalizeReferences(artifacts.integrityReferences);
  if (!integrity.ok) return integrity;
  return contractSuccess(
    Object.freeze({
      provenanceReferences: provenance.value,
      integrityReferences: integrity.value,
    }),
  );
}

export function validAttemptLifecycleIdentity(value: unknown): value is string {
  return validReference(value);
}

export function validAttemptLifecycleVersion(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

export function validAttemptLifecycleTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}
