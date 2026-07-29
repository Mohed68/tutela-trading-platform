import {
  isOrganizationVerificationAttemptLifecycleExecution,
  type OrganizationVerificationAttemptLifecycleExecution,
} from "../attempt-lifecycle-contract/index.js";
import {
  isOrganizationVerificationWorkflowExecution,
  isOrganizationVerificationWorkflowStepRecord,
  type OrganizationVerificationWorkflowExecution,
  type OrganizationVerificationWorkflowStepRecord,
} from "../workflow-contract/index.js";
import {
  isOrganizationVerificationDecisionTrustIntegrationExecution,
  type OrganizationVerificationDecisionTrustIntegrationExecution,
} from "../../domain/decision-trust-integration/index.js";
import {
  isOrganizationVerificationPolicyEvaluationInput,
  type OrganizationVerificationPolicyEvaluationInput,
} from "../../domain/evaluation-input/index.js";
import {
  isOrganizationVerificationEvaluationProjection,
  type OrganizationVerificationEvaluationProjection,
} from "../../domain/evaluation-projection/index.js";
import {
  isOrganizationVerificationEvidenceSnapshot,
  type OrganizationVerificationEvidenceSnapshot,
} from "../../domain/evidence-snapshot/index.js";
import {
  isOrganizationVerificationPolicyEvaluationExecution,
  type OrganizationVerificationPolicyEvaluationExecution,
} from "../../domain/policy-runtime/index.js";
import type {
  OrganizationVerificationDurableEvidence,
  OrganizationVerificationDurableEvidenceKind,
} from "./evidenceKinds.js";
import { isOrganizationVerificationDurableEvidenceKind } from "./evidenceKinds.js";
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
  isExactPersistenceIdentity,
  isExplicitPersistenceTimestamp,
  normalizePersistenceReferences,
} from "./persistenceValidation.js";

interface OrganizationVerificationStoredEvidenceCommon {
  readonly evidenceEntryId: string;
  readonly streamIdentity: OrganizationVerificationWorkflowStreamIdentity;
  readonly streamPosition: number;
  readonly predecessorEvidenceEntryId?: string;
  readonly semanticArtifactIdentity: string;
  readonly artifactVersionOrSequence: number | string;
  readonly artifactFingerprint: string;
  readonly artifactOccurredAt: string;
  readonly appendedAt: string;
  readonly provenanceReferences: readonly string[];
  readonly integrityReferences: readonly string[];
  readonly storedEvidenceFingerprint: string;
}

type StoredEvidenceOf<
  Kind extends OrganizationVerificationDurableEvidenceKind,
  Artifact,
> = Readonly<
  OrganizationVerificationStoredEvidenceCommon & {
    readonly evidenceKind: Kind;
    readonly artifact: Artifact;
  }
>;

export type OrganizationVerificationStoredEvidence =
  | StoredEvidenceOf<
      "workflow_genesis",
      OrganizationVerificationWorkflowExecution
    >
  | StoredEvidenceOf<
      "attempt_lifecycle_execution",
      OrganizationVerificationAttemptLifecycleExecution
    >
  | StoredEvidenceOf<
      "evidence_snapshot",
      OrganizationVerificationEvidenceSnapshot
    >
  | StoredEvidenceOf<
      "evaluation_projection",
      OrganizationVerificationEvaluationProjection
    >
  | StoredEvidenceOf<
      "policy_evaluation_input",
      OrganizationVerificationPolicyEvaluationInput
    >
  | StoredEvidenceOf<
      "policy_runtime_execution",
      OrganizationVerificationPolicyEvaluationExecution
    >
  | StoredEvidenceOf<
      "decision_trust_integration_execution",
      OrganizationVerificationDecisionTrustIntegrationExecution
    >
  | StoredEvidenceOf<
      "workflow_step_record",
      OrganizationVerificationWorkflowStepRecord
    >;

interface CreateOrganizationVerificationStoredEvidenceMetadata {
  readonly evidenceEntryId: string;
  readonly streamIdentity: OrganizationVerificationWorkflowStreamIdentity;
  readonly streamPosition: number;
  readonly predecessorEvidenceEntryId?: string;
  readonly appendedAt: string;
  readonly provenanceReferences: readonly string[];
  readonly integrityReferences: readonly string[];
}

export type CreateOrganizationVerificationStoredEvidenceInput =
  OrganizationVerificationDurableEvidence &
    CreateOrganizationVerificationStoredEvidenceMetadata;

interface ArtifactDescriptor {
  readonly identity: string;
  readonly version: number | string;
  readonly fingerprint: string;
  readonly occurredAt: string;
  readonly matchesStream: boolean;
}

const storedEvidenceSeal = Symbol(
  "organization-verification-stored-evidence",
);

function sameStreamFields(
  stream: OrganizationVerificationWorkflowStreamIdentity,
  fields: Readonly<{
    organizationId: unknown;
    recordId: unknown;
    revisionId: unknown;
    attemptId: unknown;
  }>,
): boolean {
  return (
    fields.organizationId === stream.organizationId &&
    fields.recordId === stream.recordId &&
    fields.revisionId === stream.revisionId &&
    fields.attemptId === stream.attemptId
  );
}

function describeWorkflowGenesis(
  artifact: OrganizationVerificationWorkflowExecution,
  stream: OrganizationVerificationWorkflowStreamIdentity,
): ArtifactDescriptor | undefined {
  if (
    !isOrganizationVerificationWorkflowExecution(artifact) ||
    artifact.workflowExecutionVersion !== 1 ||
    artifact.stepRecords.length !== 0
  ) {
    return undefined;
  }
  return {
    identity: artifact.workflowExecutionId,
    version: artifact.workflowExecutionVersion,
    fingerprint: artifact.workflowExecutionFingerprint,
    occurredAt: artifact.createdAt,
    matchesStream:
      artifact.workflowExecutionId === stream.workflowExecutionId &&
      sameStreamFields(stream, artifact),
  };
}

function describeLifecycle(
  artifact: OrganizationVerificationAttemptLifecycleExecution,
  stream: OrganizationVerificationWorkflowStreamIdentity,
): ArtifactDescriptor | undefined {
  if (!isOrganizationVerificationAttemptLifecycleExecution(artifact)) {
    return undefined;
  }
  return {
    identity: artifact.lifecycleExecutionId,
    version: artifact.lifecycleExecutionVersion,
    fingerprint: artifact.attemptLifecycleExecutionFingerprint,
    occurredAt: artifact.lastTransitionAt ?? artifact.createdAt,
    matchesStream: sameStreamFields(stream, artifact),
  };
}

function describeSnapshot(
  artifact: OrganizationVerificationEvidenceSnapshot,
  stream: OrganizationVerificationWorkflowStreamIdentity,
): ArtifactDescriptor | undefined {
  if (!isOrganizationVerificationEvidenceSnapshot(artifact)) {
    return undefined;
  }
  return {
    identity: artifact.evidenceSnapshotId,
    version: artifact.evidenceSnapshotVersion,
    fingerprint: artifact.snapshotFingerprint,
    occurredAt: artifact.createdAt,
    matchesStream:
      artifact.attemptBinding?.attemptId === stream.attemptId &&
      sameStreamFields(stream, {
        ...artifact,
        attemptId: artifact.attemptBinding?.attemptId,
      }),
  };
}

function describeProjection(
  artifact: OrganizationVerificationEvaluationProjection,
  stream: OrganizationVerificationWorkflowStreamIdentity,
): ArtifactDescriptor | undefined {
  if (!isOrganizationVerificationEvaluationProjection(artifact)) {
    return undefined;
  }
  return {
    identity: artifact.evaluationProjectionId,
    version: artifact.evaluationProjectionVersion,
    fingerprint: artifact.projectionFingerprint,
    occurredAt: artifact.projectedAt,
    matchesStream: sameStreamFields(stream, {
      ...artifact.identity,
      attemptId: artifact.identity.attemptId,
    }),
  };
}

function describeEvaluationInput(
  artifact: OrganizationVerificationPolicyEvaluationInput,
  stream: OrganizationVerificationWorkflowStreamIdentity,
): ArtifactDescriptor | undefined {
  if (!isOrganizationVerificationPolicyEvaluationInput(artifact)) {
    return undefined;
  }
  return {
    identity: artifact.policyEvaluationInputId,
    version: artifact.policyEvaluationInputVersion,
    fingerprint: artifact.inputFingerprint,
    occurredAt: artifact.createdAt,
    matchesStream: sameStreamFields(stream, artifact.projectionBinding),
  };
}

function describePolicyExecution(
  artifact: OrganizationVerificationPolicyEvaluationExecution,
  stream: OrganizationVerificationWorkflowStreamIdentity,
): ArtifactDescriptor | undefined {
  if (!isOrganizationVerificationPolicyEvaluationExecution(artifact)) {
    return undefined;
  }
  return {
    identity: artifact.executionId,
    version: artifact.executionContractVersion,
    fingerprint: artifact.executionFingerprint,
    occurredAt: artifact.completedAt,
    matchesStream: sameStreamFields(stream, artifact.completion),
  };
}

function describeIntegrationExecution(
  artifact: OrganizationVerificationDecisionTrustIntegrationExecution,
  stream: OrganizationVerificationWorkflowStreamIdentity,
): ArtifactDescriptor | undefined {
  if (
    !isOrganizationVerificationDecisionTrustIntegrationExecution(artifact)
  ) {
    return undefined;
  }
  return {
    identity: artifact.executionId,
    version: artifact.executionContractVersion,
    fingerprint: artifact.executionFingerprint,
    occurredAt: artifact.completedAt,
    matchesStream: sameStreamFields(stream, artifact.inputBinding),
  };
}

function describeStepRecord(
  artifact: OrganizationVerificationWorkflowStepRecord,
  stream: OrganizationVerificationWorkflowStreamIdentity,
): ArtifactDescriptor | undefined {
  if (!isOrganizationVerificationWorkflowStepRecord(artifact)) {
    return undefined;
  }
  return {
    identity: artifact.workflowStepId,
    version: artifact.nextWorkflowExecutionVersion,
    fingerprint: artifact.workflowStepBindingFingerprint,
    occurredAt: artifact.occurredAt,
    matchesStream:
      artifact.workflowExecutionId === stream.workflowExecutionId &&
      sameStreamFields(stream, artifact),
  };
}

function describeArtifact(
  evidence: OrganizationVerificationDurableEvidence,
  stream: OrganizationVerificationWorkflowStreamIdentity,
): ArtifactDescriptor | undefined {
  switch (evidence.evidenceKind) {
    case "workflow_genesis":
      return describeWorkflowGenesis(evidence.artifact, stream);
    case "attempt_lifecycle_execution":
      return describeLifecycle(evidence.artifact, stream);
    case "evidence_snapshot":
      return describeSnapshot(evidence.artifact, stream);
    case "evaluation_projection":
      return describeProjection(evidence.artifact, stream);
    case "policy_evaluation_input":
      return describeEvaluationInput(evidence.artifact, stream);
    case "policy_runtime_execution":
      return describePolicyExecution(evidence.artifact, stream);
    case "decision_trust_integration_execution":
      return describeIntegrationExecution(evidence.artifact, stream);
    case "workflow_step_record":
      return describeStepRecord(evidence.artifact, stream);
  }
}

function sealStoredEvidence(
  evidence: OrganizationVerificationStoredEvidence,
): OrganizationVerificationStoredEvidence {
  Object.defineProperty(evidence, storedEvidenceSeal, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  return Object.freeze(evidence);
}

export function expectedStoredEvidenceFingerprint(
  evidence: Omit<
    OrganizationVerificationStoredEvidence,
    "storedEvidenceFingerprint" | "artifact"
  >,
): string {
  return fingerprintPersistenceContract({
    scope: "organization_verification_stored_evidence",
    evidenceEntryId: evidence.evidenceEntryId,
    streamIdentityFingerprint:
      evidence.streamIdentity.streamIdentityFingerprint,
    streamPosition: evidence.streamPosition,
    predecessorEvidenceEntryId: evidence.predecessorEvidenceEntryId,
    evidenceKind: evidence.evidenceKind,
    semanticArtifactIdentity: evidence.semanticArtifactIdentity,
    artifactVersionOrSequence: evidence.artifactVersionOrSequence,
    artifactFingerprint: evidence.artifactFingerprint,
    artifactOccurredAt: evidence.artifactOccurredAt,
    appendedAt: evidence.appendedAt,
    provenanceReferences: evidence.provenanceReferences,
    integrityReferences: evidence.integrityReferences,
  });
}

export function createOrganizationVerificationStoredEvidence(
  input: CreateOrganizationVerificationStoredEvidenceInput,
): OrganizationVerificationPersistenceResult<OrganizationVerificationStoredEvidence> {
  if (
    !isOrganizationVerificationWorkflowStreamIdentity(input.streamIdentity) ||
    !isExactPersistenceIdentity(input.evidenceEntryId) ||
    !Number.isSafeInteger(input.streamPosition) ||
    input.streamPosition < 1 ||
    !isExplicitPersistenceTimestamp(input.appendedAt) ||
    (input.streamPosition === 1 &&
      input.predecessorEvidenceEntryId !== undefined) ||
    (input.streamPosition > 1 &&
      !isExactPersistenceIdentity(input.predecessorEvidenceEntryId))
  ) {
    return persistenceFailure("malformed_append_metadata");
  }
  if (!isOrganizationVerificationDurableEvidenceKind(input.evidenceKind)) {
    return persistenceFailure("unsupported_evidence_kind");
  }
  const provenanceReferences = normalizePersistenceReferences(
    input.provenanceReferences,
  );
  const integrityReferences = normalizePersistenceReferences(
    input.integrityReferences,
  );
  if (provenanceReferences === undefined || integrityReferences === undefined) {
    return persistenceFailure("malformed_append_metadata");
  }
  const descriptor = describeArtifact(input, input.streamIdentity);
  if (descriptor === undefined) {
    return persistenceFailure("unauthentic_evidence");
  }
  if (!descriptor.matchesStream) {
    return persistenceFailure("stream_identity_mismatch");
  }
  if (
    !isExactPersistenceIdentity(descriptor.identity) ||
    !isExactPersistenceIdentity(descriptor.fingerprint) ||
    !isExplicitPersistenceTimestamp(descriptor.occurredAt) ||
    Date.parse(input.appendedAt) < Date.parse(descriptor.occurredAt)
  ) {
    return persistenceFailure("stored_integrity_failure");
  }
  const storedEvidenceFingerprint = expectedStoredEvidenceFingerprint({
    evidenceEntryId: input.evidenceEntryId,
    streamIdentity: input.streamIdentity,
    streamPosition: input.streamPosition,
    predecessorEvidenceEntryId: input.predecessorEvidenceEntryId,
    evidenceKind: input.evidenceKind,
    semanticArtifactIdentity: descriptor.identity,
    artifactVersionOrSequence: descriptor.version,
    artifactFingerprint: descriptor.fingerprint,
    artifactOccurredAt: descriptor.occurredAt,
    appendedAt: input.appendedAt,
    provenanceReferences,
    integrityReferences,
  });
  const common = {
    evidenceEntryId: input.evidenceEntryId,
    streamIdentity: input.streamIdentity,
    streamPosition: input.streamPosition,
    ...(input.predecessorEvidenceEntryId === undefined
      ? {}
      : {
          predecessorEvidenceEntryId:
            input.predecessorEvidenceEntryId,
        }),
    semanticArtifactIdentity: descriptor.identity,
    artifactVersionOrSequence: descriptor.version,
    artifactFingerprint: descriptor.fingerprint,
    artifactOccurredAt: descriptor.occurredAt,
    appendedAt: input.appendedAt,
    provenanceReferences,
    integrityReferences,
    storedEvidenceFingerprint,
  };
  switch (input.evidenceKind) {
    case "workflow_genesis":
      return persistenceSuccess(
        sealStoredEvidence({
          ...common,
          evidenceKind: input.evidenceKind,
          artifact: input.artifact,
        }),
      );
    case "attempt_lifecycle_execution":
      return persistenceSuccess(
        sealStoredEvidence({
          ...common,
          evidenceKind: input.evidenceKind,
          artifact: input.artifact,
        }),
      );
    case "evidence_snapshot":
      return persistenceSuccess(
        sealStoredEvidence({
          ...common,
          evidenceKind: input.evidenceKind,
          artifact: input.artifact,
        }),
      );
    case "evaluation_projection":
      return persistenceSuccess(
        sealStoredEvidence({
          ...common,
          evidenceKind: input.evidenceKind,
          artifact: input.artifact,
        }),
      );
    case "policy_evaluation_input":
      return persistenceSuccess(
        sealStoredEvidence({
          ...common,
          evidenceKind: input.evidenceKind,
          artifact: input.artifact,
        }),
      );
    case "policy_runtime_execution":
      return persistenceSuccess(
        sealStoredEvidence({
          ...common,
          evidenceKind: input.evidenceKind,
          artifact: input.artifact,
        }),
      );
    case "decision_trust_integration_execution":
      return persistenceSuccess(
        sealStoredEvidence({
          ...common,
          evidenceKind: input.evidenceKind,
          artifact: input.artifact,
        }),
      );
    case "workflow_step_record":
      return persistenceSuccess(
        sealStoredEvidence({
          ...common,
          evidenceKind: input.evidenceKind,
          artifact: input.artifact,
        }),
      );
  }
}

export function isOrganizationVerificationStoredEvidence(
  value: unknown,
): value is OrganizationVerificationStoredEvidence {
  if (
    typeof value !== "object" ||
    value === null ||
    Object.getOwnPropertyDescriptor(value, storedEvidenceSeal)?.value !==
      true ||
    !Object.isFrozen(value)
  ) {
    return false;
  }
  const evidenceKind = Object.getOwnPropertyDescriptor(
    value,
    "evidenceKind",
  )?.value;
  const artifact = Object.getOwnPropertyDescriptor(value, "artifact")?.value;
  if (evidenceKind === "workflow_genesis") {
    return isOrganizationVerificationWorkflowExecution(artifact);
  }
  if (evidenceKind === "attempt_lifecycle_execution") {
    return isOrganizationVerificationAttemptLifecycleExecution(artifact);
  }
  if (evidenceKind === "evidence_snapshot") {
    return isOrganizationVerificationEvidenceSnapshot(artifact);
  }
  if (evidenceKind === "evaluation_projection") {
    return isOrganizationVerificationEvaluationProjection(artifact);
  }
  if (evidenceKind === "policy_evaluation_input") {
    return isOrganizationVerificationPolicyEvaluationInput(artifact);
  }
  if (evidenceKind === "policy_runtime_execution") {
    return isOrganizationVerificationPolicyEvaluationExecution(artifact);
  }
  if (evidenceKind === "decision_trust_integration_execution") {
    return isOrganizationVerificationDecisionTrustIntegrationExecution(
      artifact,
    );
  }
  return (
    evidenceKind === "workflow_step_record" &&
    isOrganizationVerificationWorkflowStepRecord(artifact)
  );
}

export function sameOrganizationVerificationStoredEvidence(
  left: OrganizationVerificationStoredEvidence,
  right: OrganizationVerificationStoredEvidence,
): boolean {
  return (
    sameOrganizationVerificationWorkflowStreamIdentity(
      left.streamIdentity,
      right.streamIdentity,
    ) &&
    left.storedEvidenceFingerprint === right.storedEvidenceFingerprint
  );
}
