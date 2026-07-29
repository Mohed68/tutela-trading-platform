export const ORGANIZATION_VERIFICATION_LAYER_OWNERSHIP_MATRIX =
  Object.freeze([
    Object.freeze({
      layer: "organization_verification_domain",
      owns: Object.freeze([
        "record_revision_attempt_semantics",
        "domain_identity_continuity",
      ]),
      consumes: Object.freeze(["organization_registry_identity"]),
      forbiddenOwnership: Object.freeze([
        "workflow_progression",
        "durable_evidence",
        "reconstruction",
        "application_orchestration",
        "transport",
      ]),
    }),
    Object.freeze({
      layer: "workflow_contract",
      owns: Object.freeze([
        "workflow_stage_vocabulary",
        "workflow_step_record_semantics",
        "workflow_execution_semantics",
      ]),
      consumes: Object.freeze([
        "domain_identity_continuity",
        "authentic_authority_artifacts",
      ]),
      forbiddenOwnership: Object.freeze([
        "authority_execution",
        "durable_evidence",
        "reconstruction",
        "application_orchestration",
        "transport",
      ]),
    }),
    Object.freeze({
      layer: "workflow_runtime",
      owns: Object.freeze(["one_step_workflow_progression"]),
      consumes: Object.freeze([
        "workflow_execution_semantics",
        "frozen_authorities",
      ]),
      forbiddenOwnership: Object.freeze([
        "durable_evidence",
        "reconstruction",
        "application_orchestration",
        "transport",
      ]),
    }),
    Object.freeze({
      layer: "persistence_contract",
      owns: Object.freeze([
        "durable_evidence_semantics",
        "persistence_stream_identity",
        "append_idempotency_semantics",
      ]),
      consumes: Object.freeze([
        "authentic_authority_artifacts",
        "workflow_step_record_semantics",
      ]),
      forbiddenOwnership: Object.freeze([
        "workflow_progression",
        "reconstruction",
        "application_orchestration",
        "transport",
      ]),
    }),
    Object.freeze({
      layer: "persistence_adapter",
      owns: Object.freeze(["durable_storage_mechanism"]),
      consumes: Object.freeze(["durable_evidence_semantics"]),
      forbiddenOwnership: Object.freeze([
        "domain_semantics",
        "workflow_progression",
        "reconstruction",
        "application_orchestration",
        "transport",
      ]),
    }),
    Object.freeze({
      layer: "replay_runtime",
      owns: Object.freeze(["deterministic_reconstruction"]),
      consumes: Object.freeze([
        "durable_evidence_semantics",
        "workflow_execution_semantics",
      ]),
      forbiddenOwnership: Object.freeze([
        "authority_execution",
        "workflow_progression",
        "durable_storage_mechanism",
        "application_orchestration",
        "transport",
      ]),
    }),
    Object.freeze({
      layer: "application_service_contract",
      owns: Object.freeze([
        "application_use_case_boundary",
        "application_execution_evidence",
        "application_failure_vocabulary",
      ]),
      consumes: Object.freeze([
        "persistence_ports",
        "deterministic_reconstruction",
        "one_step_workflow_progression",
      ]),
      forbiddenOwnership: Object.freeze([
        "domain_semantics",
        "workflow_progression",
        "durable_storage_mechanism",
        "reconstruction",
        "transport",
      ]),
    }),
    Object.freeze({
      layer: "application_service_runtime",
      owns: Object.freeze(["application_orchestration"]),
      consumes: Object.freeze([
        "application_use_case_boundary",
        "persistence_ports",
        "deterministic_reconstruction",
        "one_step_workflow_progression",
      ]),
      forbiddenOwnership: Object.freeze([
        "domain_semantics",
        "workflow_progression",
        "durable_storage_mechanism",
        "reconstruction",
        "transport",
      ]),
    }),
    Object.freeze({
      layer: "future_delivery_layer",
      owns: Object.freeze(["transport"]),
      consumes: Object.freeze(["application_use_case_boundary"]),
      forbiddenOwnership: Object.freeze([
        "domain_semantics",
        "workflow_progression",
        "durable_evidence",
        "reconstruction",
        "application_orchestration",
      ]),
    }),
  ] as const);

export const ORGANIZATION_VERIFICATION_SOURCE_OF_TRUTH_MATRIX =
  Object.freeze([
    Object.freeze({
      concept: "current_workflow_state",
      owner: "replay_runtime",
      authoritativeArtifact:
        "OrganizationVerificationReplayExecution.reconstructedWorkflowExecution",
      consumers: Object.freeze(["application_service_runtime"]),
      forbiddenCompetingOwners: Object.freeze([
        "workflow_runtime",
        "persistence_adapter",
        "future_delivery_layer",
      ]),
    }),
    Object.freeze({
      concept: "current_lifecycle_state",
      owner: "replay_runtime",
      authoritativeArtifact:
        "OrganizationVerificationReplayExecution.reconstructedAttemptLifecycleExecution",
      consumers: Object.freeze(["application_service_runtime"]),
      forbiddenCompetingOwners: Object.freeze([
        "workflow_runtime",
        "persistence_adapter",
        "future_delivery_layer",
      ]),
    }),
    Object.freeze({
      concept: "workflow_history",
      owner: "workflow_contract",
      authoritativeArtifact:
        "OrganizationVerificationWorkflowStepRecord",
      consumers: Object.freeze(["persistence_contract", "replay_runtime"]),
      forbiddenCompetingOwners: Object.freeze([
        "application_service_runtime",
        "future_delivery_layer",
      ]),
    }),
    Object.freeze({
      concept: "persistence_history",
      owner: "persistence_contract",
      authoritativeArtifact: "OrganizationVerificationEvidenceStream",
      consumers: Object.freeze(["replay_runtime", "application_service_runtime"]),
      forbiddenCompetingOwners: Object.freeze([
        "workflow_runtime",
        "future_delivery_layer",
      ]),
    }),
    Object.freeze({
      concept: "authority_result",
      owner: "frozen_authority",
      authoritativeArtifact: "OrganizationVerificationDurableEvidence",
      consumers: Object.freeze([
        "workflow_contract",
        "persistence_contract",
        "replay_runtime",
      ]),
      forbiddenCompetingOwners: Object.freeze([
        "workflow_runtime",
        "application_service_runtime",
        "future_delivery_layer",
      ]),
    }),
    Object.freeze({
      concept: "workflow_step",
      owner: "workflow_runtime",
      authoritativeArtifact:
        "OrganizationVerificationWorkflowStepExecution",
      consumers: Object.freeze([
        "persistence_contract",
        "application_service_runtime",
      ]),
      forbiddenCompetingOwners: Object.freeze([
        "persistence_adapter",
        "replay_runtime",
        "future_delivery_layer",
      ]),
    }),
    Object.freeze({
      concept: "replay_state",
      owner: "replay_runtime",
      authoritativeArtifact: "OrganizationVerificationReplayExecution",
      consumers: Object.freeze(["application_service_runtime"]),
      forbiddenCompetingOwners: Object.freeze([
        "persistence_adapter",
        "workflow_runtime",
        "future_delivery_layer",
      ]),
    }),
    Object.freeze({
      concept: "application_execution",
      owner: "application_service_contract",
      authoritativeArtifact: "OrganizationVerificationApplicationExecution",
      consumers: Object.freeze([
        "application_service_runtime",
        "future_delivery_layer",
      ]),
      forbiddenCompetingOwners: Object.freeze([
        "persistence_adapter",
        "replay_runtime",
        "workflow_runtime",
        "future_delivery_layer",
      ]),
    }),
  ] as const);
