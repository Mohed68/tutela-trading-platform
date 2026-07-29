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
