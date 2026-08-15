import { rehydrateOrganizationVerificationAttemptLifecycleExecution } from "../attempt-lifecycle-contract/attemptLifecycleExecution.js";
import { rehydrateOrganizationVerificationWorkflowGenesis } from "../workflow-contract/workflowExecution.js";
import { rehydrateOrganizationVerificationWorkflowStepRecord } from "../workflow-contract/workflowStepRecord.js";
import { rehydrateOrganizationVerificationDecisionTrustIntegrationExecution } from "../../domain/decision-trust-integration/decisionTrustIntegrationExecution.js";
import { rehydrateOrganizationVerificationDecision } from "../../domain/decision/decisionEngine.js";
import { rehydrateOrganizationVerificationTrustStatus } from "../../domain/trust-status/trustStatusDeriver.js";
import { rehydrateOrganizationVerificationPolicyEvaluationInput } from "../../domain/evaluation-input/policyEvaluationInput.js";
import { rehydrateOrganizationVerificationEvaluationProjection } from "../../domain/evaluation-projection/evaluationProjection.js";
import { rehydrateOrganizationVerificationEvidenceSnapshot } from "../../domain/evidence-snapshot/evidenceSnapshot.js";
import { rehydrateOrganizationVerificationPolicyEvaluationExecution, type OrganizationVerificationPolicyEvaluationExecution } from "../../domain/policy-runtime/policyEvaluationExecution.js";
import {
  deepFreezeDurableValue,
  hasExactDurableKeys,
  isDurableIdentity,
  isDurableJsonValue,
  isDurablePlainObject,
  isDurablePositiveVersion,
  isDurableStringArray,
  isDurableTimestamp,
  type DurablePlainObject,
} from "../../domain/durableRehydrationValidation.js";
import { isOrganizationVerificationDurableEvidenceKind, type OrganizationVerificationDurableEvidence, type OrganizationVerificationDurableEvidenceKind } from "../persistence-contract/evidenceKinds.js";
import { persistenceFailure, persistenceSuccess, type OrganizationVerificationPersistenceResult } from "../persistence-contract/persistenceErrors.js";
import { fingerprintPersistenceContract } from "../persistence-contract/persistenceFingerprint.js";
import { createOrganizationVerificationWorkflowStreamIdentity } from "../persistence-contract/persistenceStreamIdentity.js";
import { createOrganizationVerificationStoredEvidence, isOrganizationVerificationStoredEvidence, type OrganizationVerificationStoredEvidence } from "../persistence-contract/storedEvidence.js";

export const ORGANIZATION_VERIFICATION_DURABLE_EVIDENCE_CONTRACT_VERSION = "organization-verification-durable-evidence/v1" as const;

type DurableJsonValue = null | string | number | boolean | DurableJsonValue[] | { readonly [key: string]: DurableJsonValue };

export interface OrganizationVerificationDurableEvidenceEnvelope {
  readonly contractVersion: typeof ORGANIZATION_VERIFICATION_DURABLE_EVIDENCE_CONTRACT_VERSION;
  readonly evidenceKind: OrganizationVerificationDurableEvidenceKind;
  readonly payload: DurablePlainObject;
  readonly payloadFingerprint: string;
}

function toDurableJson(value: unknown): DurableJsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("NON_FINITE_DURABLE_EVIDENCE_VALUE");
    return value;
  }
  if (Array.isArray(value)) return value.map(toDurableJson);
  if (typeof value !== "object" || value === null) throw new TypeError("UNSUPPORTED_DURABLE_EVIDENCE_VALUE");
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new TypeError("NON_PLAIN_DURABLE_EVIDENCE_VALUE");
  const result: { [key: string]: DurableJsonValue } = {};
  for (const key of Object.keys(value).sort()) {
    const nested = Object.getOwnPropertyDescriptor(value, key)?.value;
    if (nested !== undefined) result[key] = toDurableJson(nested);
  }
  return result;
}

function canonical(value: DurableJsonValue): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key]!)}`).join(",")}}`;
}

function envelopeFingerprint(kind: OrganizationVerificationDurableEvidenceKind, payload: DurablePlainObject): string {
  return fingerprintPersistenceContract({
    scope: "organization_verification_durable_evidence_payload",
    contractVersion: ORGANIZATION_VERIFICATION_DURABLE_EVIDENCE_CONTRACT_VERSION,
    evidenceKind: kind,
    payload,
  });
}

function isEnvelope(value: unknown): value is OrganizationVerificationDurableEvidenceEnvelope {
  return isDurablePlainObject(value) && hasExactDurableKeys(value, ["contractVersion", "evidenceKind", "payload", "payloadFingerprint"]) &&
    value.contractVersion === ORGANIZATION_VERIFICATION_DURABLE_EVIDENCE_CONTRACT_VERSION &&
    isOrganizationVerificationDurableEvidenceKind(value.evidenceKind) && isDurablePlainObject(value.payload) &&
    isDurableJsonValue(value.payload) && isDurableIdentity(value.payloadFingerprint);
}

export function createOrganizationVerificationDurableEvidenceEnvelope(
  evidence: OrganizationVerificationStoredEvidence,
): OrganizationVerificationPersistenceResult<OrganizationVerificationDurableEvidenceEnvelope> {
  if (!isOrganizationVerificationStoredEvidence(evidence)) return persistenceFailure("unauthentic_evidence");
  try {
    const plain = toDurableJson(evidence);
    if (!isDurablePlainObject(plain)) return persistenceFailure("stored_integrity_failure");
    const payload = deepFreezeDurableValue(plain);
    return persistenceSuccess(Object.freeze({
      contractVersion: ORGANIZATION_VERIFICATION_DURABLE_EVIDENCE_CONTRACT_VERSION,
      evidenceKind: evidence.evidenceKind,
      payload,
      payloadFingerprint: envelopeFingerprint(evidence.evidenceKind, payload),
    }));
  } catch {
    return persistenceFailure("stored_integrity_failure");
  }
}

export function serializeOrganizationVerificationDurableEvidence(
  envelope: OrganizationVerificationDurableEvidenceEnvelope,
): OrganizationVerificationPersistenceResult<string> {
  if (!isEnvelope(envelope) || envelopeFingerprint(envelope.evidenceKind, envelope.payload) !== envelope.payloadFingerprint) {
    return persistenceFailure("stored_integrity_failure");
  }
  return persistenceSuccess(canonical(toDurableJson(envelope)));
}

export function parseOrganizationVerificationDurableEvidence(
  serialized: string,
): OrganizationVerificationPersistenceResult<OrganizationVerificationDurableEvidenceEnvelope> {
  if (typeof serialized !== "string" || serialized.length === 0) return persistenceFailure("stored_integrity_failure");
  try {
    const parsed: unknown = JSON.parse(serialized);
    if (!isEnvelope(parsed)) return persistenceFailure("stored_integrity_failure");
    const frozen = deepFreezeDurableValue(parsed);
    if (canonical(toDurableJson(frozen)) !== serialized || envelopeFingerprint(frozen.evidenceKind, frozen.payload) !== frozen.payloadFingerprint) {
      return persistenceFailure("stored_integrity_failure");
    }
    return persistenceSuccess(frozen);
  } catch {
    return persistenceFailure("stored_integrity_failure");
  }
}

function rehydrateArtifact(
  kind: OrganizationVerificationDurableEvidenceKind,
  payload: DurablePlainObject,
  policyExecutions: Map<string, OrganizationVerificationPolicyEvaluationExecution>,
): OrganizationVerificationPersistenceResult<OrganizationVerificationDurableEvidence> {
  const artifact = payload.artifact;
  switch (kind) {
    case "workflow_genesis": {
      const lifecycleData = isDurablePlainObject(artifact) ? artifact.lifecycleExecution : undefined;
      const lifecycle = rehydrateOrganizationVerificationAttemptLifecycleExecution(lifecycleData);
      if (!lifecycle.ok) return persistenceFailure("unauthentic_evidence");
      const result = rehydrateOrganizationVerificationWorkflowGenesis(artifact, lifecycle.value);
      return result.ok ? persistenceSuccess({ evidenceKind: kind, artifact: result.value }) : persistenceFailure("unauthentic_evidence");
    }
    case "attempt_lifecycle_execution": {
      const result = rehydrateOrganizationVerificationAttemptLifecycleExecution(artifact);
      return result.ok ? persistenceSuccess({ evidenceKind: kind, artifact: result.value }) : persistenceFailure("unauthentic_evidence");
    }
    case "evidence_snapshot": {
      const result = rehydrateOrganizationVerificationEvidenceSnapshot(artifact);
      return result.ok ? persistenceSuccess({ evidenceKind: kind, artifact: result.value }) : persistenceFailure("unauthentic_evidence");
    }
    case "evaluation_projection": {
      const result = rehydrateOrganizationVerificationEvaluationProjection(artifact);
      return result.ok ? persistenceSuccess({ evidenceKind: kind, artifact: result.value }) : persistenceFailure("unauthentic_evidence");
    }
    case "policy_evaluation_input": {
      const result = rehydrateOrganizationVerificationPolicyEvaluationInput(artifact);
      return result.ok ? persistenceSuccess({ evidenceKind: kind, artifact: result.value }) : persistenceFailure("unauthentic_evidence");
    }
    case "policy_runtime_execution": {
      const result = rehydrateOrganizationVerificationPolicyEvaluationExecution(artifact);
      if (!result.ok) return persistenceFailure("unauthentic_evidence");
      policyExecutions.set(result.value.executionFingerprint, result.value);
      return persistenceSuccess({ evidenceKind: kind, artifact: result.value });
    }
    case "decision_trust_integration_execution": {
      if (!isDurablePlainObject(artifact) || !isDurablePlainObject(artifact.inputBinding)) return persistenceFailure("unauthentic_evidence");
      const nestedFingerprint = artifact.inputBinding.runtimeExecutionFingerprint;
      const nestedRuntime = artifact.inputBinding.runtimeExecution;
      const cachedPolicy = typeof nestedFingerprint === "string" ? policyExecutions.get(nestedFingerprint) : undefined;
      const policy = cachedPolicy === undefined ? rehydrateOrganizationVerificationPolicyEvaluationExecution(nestedRuntime) : persistenceSuccess(cachedPolicy);
      const decision = rehydrateOrganizationVerificationDecision(artifact.decision);
      const trust = rehydrateOrganizationVerificationTrustStatus(artifact.trustStatus);
      if (!policy.ok || !decision.ok || !trust.ok) return persistenceFailure("unauthentic_evidence");
      const result = rehydrateOrganizationVerificationDecisionTrustIntegrationExecution(
        artifact,
        { policyExecution: policy.value, decision: decision.value, trustStatus: trust.value },
      );
      return result.ok ? persistenceSuccess({ evidenceKind: kind, artifact: result.value }) : persistenceFailure("unauthentic_evidence");
    }
    case "workflow_step_record": {
      const result = rehydrateOrganizationVerificationWorkflowStepRecord(artifact);
      return result.ok ? persistenceSuccess({ evidenceKind: kind, artifact: result.value }) : persistenceFailure("unauthentic_evidence");
    }
  }
}

function validStoredPayload(payload: DurablePlainObject): boolean {
  const required = ["evidenceEntryId", "streamIdentity", "streamPosition", "evidenceKind", "artifact", "semanticArtifactIdentity", "artifactVersionOrSequence", "artifactFingerprint", "artifactOccurredAt", "appendedAt", "provenanceReferences", "integrityReferences", "storedEvidenceFingerprint"];
  return hasExactDurableKeys(payload, required, ["predecessorEvidenceEntryId"]) &&
    ["evidenceEntryId", "semanticArtifactIdentity", "artifactFingerprint", "storedEvidenceFingerprint"].every((key) => isDurableIdentity(payload[key])) &&
    isDurablePositiveVersion(payload.streamPosition) && isDurableTimestamp(payload.artifactOccurredAt) && isDurableTimestamp(payload.appendedAt) &&
    (payload.predecessorEvidenceEntryId === undefined || isDurableIdentity(payload.predecessorEvidenceEntryId)) &&
    isDurableStringArray(payload.provenanceReferences) && isDurableStringArray(payload.integrityReferences) &&
    (typeof payload.artifactVersionOrSequence === "string" || isDurablePositiveVersion(payload.artifactVersionOrSequence));
}

function rehydrateWithPolicyBindings(
  envelope: OrganizationVerificationDurableEvidenceEnvelope,
  policyExecutions: Map<string, OrganizationVerificationPolicyEvaluationExecution>,
): OrganizationVerificationPersistenceResult<OrganizationVerificationStoredEvidence> {
  if (!isEnvelope(envelope) || envelopeFingerprint(envelope.evidenceKind, envelope.payload) !== envelope.payloadFingerprint || !validStoredPayload(envelope.payload) || envelope.payload.evidenceKind !== envelope.evidenceKind) {
    return persistenceFailure("stored_integrity_failure");
  }
  const streamData = envelope.payload.streamIdentity;
  if (!isDurablePlainObject(streamData) || !hasExactDurableKeys(streamData, ["workflowExecutionId", "organizationId", "recordId", "revisionId", "attemptId", "streamIdentityFingerprint"])) return persistenceFailure("stream_identity_mismatch");
  const stream = createOrganizationVerificationWorkflowStreamIdentity({
    workflowExecutionId: String(streamData.workflowExecutionId),
    organizationId: String(streamData.organizationId),
    recordId: String(streamData.recordId),
    revisionId: String(streamData.revisionId),
    attemptId: String(streamData.attemptId),
  });
  if (!stream.ok || stream.value.streamIdentityFingerprint !== streamData.streamIdentityFingerprint) return persistenceFailure("stream_identity_mismatch");
  const durableEvidence = rehydrateArtifact(envelope.evidenceKind, envelope.payload, policyExecutions);
  if (!durableEvidence.ok) return durableEvidence;
  const provenanceReferences = envelope.payload.provenanceReferences;
  const integrityReferences = envelope.payload.integrityReferences;
  if (!isDurableStringArray(provenanceReferences) || !isDurableStringArray(integrityReferences)) return persistenceFailure("stored_integrity_failure");
  const result = createOrganizationVerificationStoredEvidence({
    ...durableEvidence.value,
    evidenceEntryId: String(envelope.payload.evidenceEntryId),
    streamIdentity: stream.value,
    streamPosition: Number(envelope.payload.streamPosition),
    ...(envelope.payload.predecessorEvidenceEntryId === undefined ? {} : { predecessorEvidenceEntryId: String(envelope.payload.predecessorEvidenceEntryId) }),
    appendedAt: String(envelope.payload.appendedAt),
    provenanceReferences,
    integrityReferences,
  });
  if (!result.ok) return result;
  return result.value.storedEvidenceFingerprint === envelope.payload.storedEvidenceFingerprint &&
    result.value.artifactFingerprint === envelope.payload.artifactFingerprint &&
    result.value.semanticArtifactIdentity === envelope.payload.semanticArtifactIdentity
    ? result
    : persistenceFailure("stored_integrity_failure");
}

export interface OrganizationVerificationDurableEvidenceRehydrationSession {
  rehydrate(
    envelope: OrganizationVerificationDurableEvidenceEnvelope,
  ): OrganizationVerificationPersistenceResult<OrganizationVerificationStoredEvidence>;
}

export function createOrganizationVerificationDurableEvidenceRehydrationSession(): OrganizationVerificationDurableEvidenceRehydrationSession {
  const policyExecutions = new Map<string, OrganizationVerificationPolicyEvaluationExecution>();
  return Object.freeze({
    rehydrate(envelope: OrganizationVerificationDurableEvidenceEnvelope) {
      return rehydrateWithPolicyBindings(envelope, policyExecutions);
    },
  });
}

export function rehydrateOrganizationVerificationDurableEvidence(
  envelope: OrganizationVerificationDurableEvidenceEnvelope,
): OrganizationVerificationPersistenceResult<OrganizationVerificationStoredEvidence> {
  return rehydrateWithPolicyBindings(envelope, new Map());
}
