import {
  persistenceFailure,
  persistenceSuccess,
  type OrganizationVerificationPersistenceResult,
} from "./persistenceErrors.js";
import {
  isOrganizationVerificationWorkflowStreamIdentity,
  sameOrganizationVerificationWorkflowStreamIdentity,
  type OrganizationVerificationWorkflowStreamIdentity,
} from "./persistenceStreamIdentity.js";
import {
  expectedStoredEvidenceFingerprint,
  isOrganizationVerificationStoredEvidence,
  type OrganizationVerificationStoredEvidence,
} from "./storedEvidence.js";

export interface OrganizationVerificationEvidenceStreamIntegritySummary {
  readonly verificationStatus: "verified";
  readonly verifiedEntryCount: number;
  readonly verifiedHeadPosition: number;
}

const authorityKindForStep = Object.freeze({
  attempt_transition: "attempt_lifecycle_execution",
  bind_snapshot: "evidence_snapshot",
  bind_projection: "evaluation_projection",
  bind_evaluation_input: "policy_evaluation_input",
  complete_policy: "policy_runtime_execution",
  complete_decision_trust_integration:
    "decision_trust_integration_execution",
} as const);

function outputFingerprintMatches(
  step: Extract<
    OrganizationVerificationStoredEvidence,
    { evidenceKind: "workflow_step_record" }
  >,
  authority: OrganizationVerificationStoredEvidence,
): boolean {
  return step.artifact.outputArtifactFingerprints.some(
    (output) =>
      output.artifactType === authority.evidenceKind &&
      output.fingerprint === authority.artifactFingerprint,
  );
}

export function organizationVerificationEvidencePairMatchesWorkflowStep(
  authority: OrganizationVerificationStoredEvidence,
  step: OrganizationVerificationStoredEvidence,
): boolean {
  return (
    authority.evidenceKind !== "workflow_genesis" &&
    authority.evidenceKind !== "workflow_step_record" &&
    step.evidenceKind === "workflow_step_record" &&
    authorityKindForStep[step.artifact.requestedStep] ===
      authority.evidenceKind &&
    outputFingerprintMatches(step, authority)
  );
}

export function validateOrganizationVerificationEvidenceStreamIntegrity(
  streamIdentity: OrganizationVerificationWorkflowStreamIdentity,
  entries: readonly OrganizationVerificationStoredEvidence[],
): OrganizationVerificationPersistenceResult<OrganizationVerificationEvidenceStreamIntegritySummary> {
  if (
    !isOrganizationVerificationWorkflowStreamIdentity(streamIdentity) ||
    !Array.isArray(entries) ||
    entries.length === 0
  ) {
    return persistenceFailure("stored_integrity_failure");
  }

  const evidenceIds = new Set<string>();
  const semanticKeys = new Set<string>();
  let prior: OrganizationVerificationStoredEvidence | undefined;
  let expectedWorkflowVersion = 1;
  let latestLifecycleVersion: number | undefined;
  let lifecycleIdentity: string | undefined;

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    if (
      entry === undefined ||
      !isOrganizationVerificationStoredEvidence(entry) ||
      !sameOrganizationVerificationWorkflowStreamIdentity(
        streamIdentity,
        entry.streamIdentity,
      ) ||
      entry.streamPosition !== index + 1 ||
      entry.storedEvidenceFingerprint !==
        expectedStoredEvidenceFingerprint(entry)
    ) {
      return persistenceFailure("stored_integrity_failure");
    }
    if (
      evidenceIds.has(entry.evidenceEntryId) ||
      semanticKeys.has(
        `${entry.evidenceKind}:${entry.semanticArtifactIdentity}:${String(
          entry.artifactVersionOrSequence,
        )}`,
      )
    ) {
      return persistenceFailure("evidence_identity_conflict");
    }
    evidenceIds.add(entry.evidenceEntryId);
    semanticKeys.add(
      `${entry.evidenceKind}:${entry.semanticArtifactIdentity}:${String(
        entry.artifactVersionOrSequence,
      )}`,
    );
    if (
      (prior === undefined &&
        entry.predecessorEvidenceEntryId !== undefined) ||
      (prior !== undefined &&
        entry.predecessorEvidenceEntryId !== prior.evidenceEntryId) ||
      (prior !== undefined &&
        Date.parse(entry.appendedAt) < Date.parse(prior.appendedAt)) ||
      (prior !== undefined &&
        Date.parse(entry.artifactOccurredAt) <
          Date.parse(prior.artifactOccurredAt))
    ) {
      return persistenceFailure("invalid_evidence_order");
    }

    if (index === 0) {
      if (
        entry.evidenceKind !== "workflow_genesis" ||
        entry.artifact.workflowExecutionVersion !== 1
      ) {
        return persistenceFailure("invalid_evidence_order");
      }
      latestLifecycleVersion =
        entry.artifact.lifecycleExecution.lifecycleExecutionVersion;
      lifecycleIdentity =
        entry.artifact.lifecycleExecution.lifecycleExecutionId;
    } else if (index % 2 === 1) {
      if (
        entry.evidenceKind === "workflow_genesis" ||
        entry.evidenceKind === "workflow_step_record"
      ) {
        return persistenceFailure("invalid_evidence_order");
      }
      if (entry.evidenceKind === "attempt_lifecycle_execution") {
        if (
          typeof latestLifecycleVersion !== "number" ||
          entry.artifact.lifecycleExecutionId !== lifecycleIdentity ||
          entry.artifact.lifecycleExecutionVersion !==
            latestLifecycleVersion + 1
        ) {
          return persistenceFailure("invalid_evidence_order");
        }
        latestLifecycleVersion = entry.artifact.lifecycleExecutionVersion;
      }
    } else {
      const authority = entries[index - 1];
      if (
        entry.evidenceKind !== "workflow_step_record" ||
        authority === undefined ||
        authority.evidenceKind === "workflow_genesis" ||
        authority.evidenceKind === "workflow_step_record" ||
        entry.artifact.predecessorWorkflowExecutionVersion !==
          expectedWorkflowVersion ||
        entry.artifact.nextWorkflowExecutionVersion !==
          expectedWorkflowVersion + 1 ||
        !organizationVerificationEvidencePairMatchesWorkflowStep(
          authority,
          entry,
        )
      ) {
        return persistenceFailure("invalid_evidence_order");
      }
      expectedWorkflowVersion = entry.artifact.nextWorkflowExecutionVersion;
    }
    prior = entry;
  }

  if (entries.length % 2 === 0) {
    return persistenceFailure("invalid_evidence_order");
  }
  return persistenceSuccess(
    Object.freeze({
      verificationStatus: "verified",
      verifiedEntryCount: entries.length,
      verifiedHeadPosition: entries.length,
    }),
  );
}
