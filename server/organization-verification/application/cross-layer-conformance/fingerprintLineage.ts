export const ORGANIZATION_VERIFICATION_FINGERPRINT_LINEAGE =
  Object.freeze([
    Object.freeze({
      fingerprint: "authority_artifact_fingerprint",
      owner: "frozen_authority",
      parentFingerprints: Object.freeze([]),
      evidenceBinding:
        "OrganizationVerificationStoredEvidence.artifactFingerprint",
      replacesParent: false,
    }),
    Object.freeze({
      fingerprint: "stored_evidence_fingerprint",
      owner: "persistence_contract",
      parentFingerprints: Object.freeze([
        "authority_artifact_fingerprint",
      ]),
      evidenceBinding:
        "OrganizationVerificationStoredEvidence.storedEvidenceFingerprint",
      replacesParent: false,
    }),
    Object.freeze({
      fingerprint: "persistence_stream_fingerprint",
      owner: "persistence_contract",
      parentFingerprints: Object.freeze(["stored_evidence_fingerprint"]),
      evidenceBinding:
        "OrganizationVerificationEvidenceStream.evidenceStreamFingerprint",
      replacesParent: false,
    }),
    Object.freeze({
      fingerprint: "workflow_execution_fingerprint",
      owner: "workflow_contract",
      parentFingerprints: Object.freeze([
        "authority_artifact_fingerprint",
        "stored_evidence_fingerprint",
      ]),
      evidenceBinding:
        "OrganizationVerificationWorkflowExecution.workflowExecutionFingerprint",
      replacesParent: false,
    }),
    Object.freeze({
      fingerprint: "replay_fingerprint",
      owner: "replay_runtime",
      parentFingerprints: Object.freeze([
        "persistence_stream_fingerprint",
        "workflow_execution_fingerprint",
        "authority_artifact_fingerprint",
      ]),
      evidenceBinding:
        "OrganizationVerificationReplayExecution.replayFingerprint",
      replacesParent: false,
    }),
    Object.freeze({
      fingerprint: "application_execution_fingerprint",
      owner: "application_service_contract",
      parentFingerprints: Object.freeze([
        "replay_fingerprint",
        "workflow_execution_fingerprint",
        "persistence_stream_fingerprint",
      ]),
      evidenceBinding:
        "OrganizationVerificationApplicationExecution.applicationExecutionFingerprint",
      replacesParent: false,
    }),
  ] as const);

export type OrganizationVerificationFingerprintLineageEntry =
  (typeof ORGANIZATION_VERIFICATION_FINGERPRINT_LINEAGE)[number];

export const ORGANIZATION_VERIFICATION_ADVANCE_RESULT_FINGERPRINT_BINDINGS =
  Object.freeze({
    advance_completed: Object.freeze({
      interpretation: "new_workflow_step_executed_and_committed",
      workflowRuntimeExecutionOccurred: true,
      authorityExecutionOccurred: true,
      duplicateProofOwner: "persistence_contract",
      requiredEvidence: Object.freeze([
        "workflow_step_execution_fingerprint",
        "workflow_step_record_fingerprint",
        "append_receipt_fingerprint",
        "resulting_workflow_execution_fingerprint",
        "resulting_lifecycle_execution_fingerprint",
      ]),
      forbiddenEvidence: Object.freeze([]),
    }),
    advance_idempotent: Object.freeze({
      interpretation: "original_durable_step_returned_idempotently",
      workflowRuntimeExecutionOccurred: false,
      authorityExecutionOccurred: false,
      duplicateProofOwner: "persistence_contract",
      requiredEvidence: Object.freeze([
        "persisted_authority_artifact_fingerprint",
        "workflow_step_record_fingerprint",
        "original_append_receipt_fingerprint",
        "replay_fingerprint",
        "persistence_stream_fingerprint",
        "current_workflow_execution_fingerprint",
        "current_lifecycle_execution_fingerprint",
      ]),
      forbiddenEvidence: Object.freeze([
        "workflow_step_execution_fingerprint",
        "fresh_authority_execution_fingerprint",
      ]),
    }),
  } as const);

export type OrganizationVerificationAdvanceResultFingerprintBinding =
  (typeof ORGANIZATION_VERIFICATION_ADVANCE_RESULT_FINGERPRINT_BINDINGS)[keyof typeof ORGANIZATION_VERIFICATION_ADVANCE_RESULT_FINGERPRINT_BINDINGS];
