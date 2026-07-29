import {
  isApplicationExecutionAuthenticInternal,
  sealApplicationExecutionInternal,
} from "./applicationServiceAuthenticity.js";
import { fingerprintApplicationServiceContract } from "./applicationServiceFingerprint.js";
import {
  isExactApplicationIdentity,
  isExplicitApplicationTimestamp,
} from "./applicationServiceMetadata.js";
import {
  isOrganizationVerificationApplicationUseCase,
  type OrganizationVerificationApplicationUseCase,
} from "./useCaseVocabulary.js";

export const ORGANIZATION_VERIFICATION_APPLICATION_OUTCOMES = Object.freeze([
  "start_completed",
  "start_idempotent",
  "start_rejected",
  "advance_completed",
  "advance_idempotent",
  "advance_rejected",
  "state_found",
  "state_not_found",
  "state_rejected",
  "history_replayed",
  "history_not_found",
  "history_rejected",
] as const);

export type OrganizationVerificationApplicationOutcome =
  (typeof ORGANIZATION_VERIFICATION_APPLICATION_OUTCOMES)[number];

export interface OrganizationVerificationApplicationExecution {
  readonly applicationExecutionId: string;
  readonly useCase: OrganizationVerificationApplicationUseCase;
  readonly requestIdentity: string;
  readonly requestFingerprint: string;
  readonly outcome: OrganizationVerificationApplicationOutcome;
  readonly streamIdentityFingerprint: string;
  readonly completedAt: string;
  readonly previousPersistenceStreamVersion?: number;
  readonly resultingPersistenceStreamVersion?: number;
  readonly previousWorkflowVersion?: number;
  readonly resultingWorkflowVersion?: number;
  readonly lowerLayerFingerprints: readonly string[];
  readonly applicationExecutionFingerprint: string;
}

export interface CreateOrganizationVerificationApplicationExecutionInput
  extends Omit<
    OrganizationVerificationApplicationExecution,
    "applicationExecutionFingerprint"
  > {}

function validVersion(value: number | undefined): boolean {
  return (
    value === undefined || (Number.isSafeInteger(value) && value >= 0)
  );
}

export function createOrganizationVerificationApplicationExecutionInternal(
  input: CreateOrganizationVerificationApplicationExecutionInput,
): OrganizationVerificationApplicationExecution | undefined {
  if (
    !isExactApplicationIdentity(input.applicationExecutionId) ||
    !isOrganizationVerificationApplicationUseCase(input.useCase) ||
    !isExactApplicationIdentity(input.requestIdentity) ||
    !ORGANIZATION_VERIFICATION_APPLICATION_OUTCOMES.some(
      (outcome) => outcome === input.outcome,
    ) ||
    !isExactApplicationIdentity(input.requestFingerprint) ||
    !isExactApplicationIdentity(input.streamIdentityFingerprint) ||
    !isExplicitApplicationTimestamp(input.completedAt) ||
    !validVersion(input.previousPersistenceStreamVersion) ||
    !validVersion(input.resultingPersistenceStreamVersion) ||
    !validVersion(input.previousWorkflowVersion) ||
    !validVersion(input.resultingWorkflowVersion) ||
    !Array.isArray(input.lowerLayerFingerprints) ||
    input.lowerLayerFingerprints.length === 0 ||
    input.lowerLayerFingerprints.some(
      (fingerprint) => !isExactApplicationIdentity(fingerprint),
    ) ||
    new Set(input.lowerLayerFingerprints).size !==
      input.lowerLayerFingerprints.length
  ) {
    return undefined;
  }
  const lowerLayerFingerprints = Object.freeze([
    ...input.lowerLayerFingerprints,
  ]);
  const semantic = {
    ...input,
    lowerLayerFingerprints,
  };
  return sealApplicationExecutionInternal({
    ...semantic,
    applicationExecutionFingerprint:
      fingerprintApplicationServiceContract(
        "application_execution",
        semantic,
      ),
  });
}

export function isOrganizationVerificationApplicationExecution(
  value: unknown,
): value is OrganizationVerificationApplicationExecution {
  return isApplicationExecutionAuthenticInternal(value);
}
