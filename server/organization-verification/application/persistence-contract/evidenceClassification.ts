export type OrganizationVerificationPersistenceClassification =
  | "durable_authoritative_evidence"
  | "durable_binding_index_evidence"
  | "derived_runtime_envelope"
  | "non_persisted_input_reference";

export interface OrganizationVerificationArtifactPersistenceClassification {
  readonly artifact: string;
  readonly classification: OrganizationVerificationPersistenceClassification;
  readonly persistenceMode: "nested" | "genesis_only" | "standalone" | "never";
  readonly sourceOfTruth: string;
  readonly replayNecessity: string;
}

function classification(
  value: OrganizationVerificationArtifactPersistenceClassification,
): OrganizationVerificationArtifactPersistenceClassification {
  return Object.freeze(value);
}

export const ORGANIZATION_VERIFICATION_ARTIFACT_PERSISTENCE_CLASSIFICATION =
  Object.freeze([
    classification({
      artifact: "OrganizationVerificationRecord",
      classification: "durable_authoritative_evidence",
      persistenceMode: "nested",
      sourceOfTruth: "Attempt Lifecycle Execution",
      replayNecessity: "Required through the authenticated lifecycle baseline",
    }),
    classification({
      artifact: "OrganizationVerificationRevision",
      classification: "durable_authoritative_evidence",
      persistenceMode: "nested",
      sourceOfTruth: "Attempt Lifecycle Execution",
      replayNecessity: "Required through the authenticated lifecycle baseline",
    }),
    classification({
      artifact: "OrganizationVerificationAttempt",
      classification: "durable_authoritative_evidence",
      persistenceMode: "nested",
      sourceOfTruth: "Attempt Lifecycle Execution",
      replayNecessity: "Required through each authenticated lifecycle version",
    }),
    classification({
      artifact: "OrganizationVerificationAttemptLifecycleExecution",
      classification: "durable_authoritative_evidence",
      persistenceMode: "standalone",
      sourceOfTruth: "Lifecycle execution contract",
      replayNecessity: "Required after each Attempt transition",
    }),
    classification({
      artifact: "OrganizationVerificationAttemptLifecycleTransitionRecord",
      classification: "durable_authoritative_evidence",
      persistenceMode: "nested",
      sourceOfTruth: "Attempt Lifecycle Execution transition history",
      replayNecessity: "Required through the authenticated lifecycle execution",
    }),
    classification({
      artifact: "OrganizationVerificationAttemptLifecycleTransitionExecution",
      classification: "derived_runtime_envelope",
      persistenceMode: "never",
      sourceOfTruth: "Constituent lifecycle executions and transition record",
      replayNecessity: "Reconstructable application execution evidence",
    }),
    classification({
      artifact: "OrganizationVerificationEvidenceSnapshot",
      classification: "durable_authoritative_evidence",
      persistenceMode: "standalone",
      sourceOfTruth: "Evidence Snapshot authority",
      replayNecessity: "Required for audit and projection continuity",
    }),
    classification({
      artifact: "OrganizationVerificationEvaluationProjection",
      classification: "durable_authoritative_evidence",
      persistenceMode: "standalone",
      sourceOfTruth: "Evaluation Projection authority",
      replayNecessity: "Required to audit the exact projected fact surface",
    }),
    classification({
      artifact: "OrganizationVerificationPolicyEvaluationInput",
      classification: "durable_authoritative_evidence",
      persistenceMode: "standalone",
      sourceOfTruth: "Evaluation Input authority",
      replayNecessity: "Required to bind exact Policy input",
    }),
    classification({
      artifact: "OrganizationVerificationPolicyEvaluationExecution",
      classification: "durable_authoritative_evidence",
      persistenceMode: "standalone",
      sourceOfTruth: "Policy Runtime authority",
      replayNecessity: "Required for Policy findings and completion audit",
    }),
    classification({
      artifact:
        "OrganizationVerificationDecisionTrustIntegrationExecution",
      classification: "durable_authoritative_evidence",
      persistenceMode: "standalone",
      sourceOfTruth: "Decision–Trust Integration authority",
      replayNecessity: "Required for Decision, Trust, and binding audit",
    }),
    classification({
      artifact: "OrganizationVerificationWorkflowExecution",
      classification: "durable_binding_index_evidence",
      persistenceMode: "genesis_only",
      sourceOfTruth: "Initial Workflow identity and metadata only",
      replayNecessity:
        "Version 1 establishes the stream; later versions are reconstructed",
    }),
    classification({
      artifact: "OrganizationVerificationWorkflowStepRecord",
      classification: "durable_authoritative_evidence",
      persistenceMode: "standalone",
      sourceOfTruth: "Workflow step contract",
      replayNecessity: "Required for ordered coordination history",
    }),
    classification({
      artifact: "OrganizationVerificationWorkflowStepExecution",
      classification: "derived_runtime_envelope",
      persistenceMode: "never",
      sourceOfTruth: "Authority result, step record, and Workflow evidence",
      replayNecessity: "Reconstructable application execution evidence",
    }),
    classification({
      artifact: "Authority input and external provider reference surfaces",
      classification: "non_persisted_input_reference",
      persistenceMode: "never",
      sourceOfTruth: "External provider or already authenticated artifact",
      replayNecessity: "Represented by resulting authentic durable evidence",
    }),
  ] satisfies readonly OrganizationVerificationArtifactPersistenceClassification[]);
