import type {
  OrganizationVerificationEvidenceRepositoryPort,
} from "../persistence-contract/index.js";
import type {
  OrganizationVerificationReplayRequest,
  OrganizationVerificationReplayResult,
} from "../replay-runtime/index.js";
import type {
  ExecuteOrganizationVerificationWorkflowStepInput,
  OrganizationVerificationWorkflowRuntimeResult,
  OrganizationVerificationWorkflowStepExecution,
} from "../workflow-runtime/index.js";
import type {
  AdvanceOrganizationVerificationWorkflowRequest,
  LoadOrganizationVerificationStateRequest,
  ReplayOrganizationVerificationHistoryRequest,
  StartOrganizationVerificationRequest,
} from "./applicationServiceRequests.js";
import type {
  AdvanceOrganizationVerificationWorkflowResult,
  LoadOrganizationVerificationStateResult,
  ReplayOrganizationVerificationHistoryResult,
  StartOrganizationVerificationResult,
} from "./applicationServiceResults.js";

export interface OrganizationVerificationApplicationServicePort {
  startOrganizationVerification(
    request: StartOrganizationVerificationRequest,
  ): Promise<StartOrganizationVerificationResult>;

  advanceOrganizationVerificationWorkflow(
    request: AdvanceOrganizationVerificationWorkflowRequest,
  ): Promise<AdvanceOrganizationVerificationWorkflowResult>;

  loadOrganizationVerificationState(
    request: LoadOrganizationVerificationStateRequest,
  ): Promise<LoadOrganizationVerificationStateResult>;

  replayOrganizationVerificationHistory(
    request: ReplayOrganizationVerificationHistoryRequest,
  ): Promise<ReplayOrganizationVerificationHistoryResult>;
}

export interface OrganizationVerificationReplayOperationPort {
  replayHistory(
    request: OrganizationVerificationReplayRequest,
  ): OrganizationVerificationReplayResult;
}

export interface OrganizationVerificationWorkflowStepOperationPort {
  executeOneWorkflowStep(
    request: ExecuteOrganizationVerificationWorkflowStepInput,
  ): OrganizationVerificationWorkflowRuntimeResult<OrganizationVerificationWorkflowStepExecution>;
}

export interface OrganizationVerificationApplicationServiceDependencies {
  readonly evidenceRepository: OrganizationVerificationEvidenceRepositoryPort;
  readonly replayRuntime: OrganizationVerificationReplayOperationPort;
  readonly workflowRuntime: OrganizationVerificationWorkflowStepOperationPort;
}
