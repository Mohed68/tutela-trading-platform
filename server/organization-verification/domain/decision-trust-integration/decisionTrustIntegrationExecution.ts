import {
  isOrganizationVerificationDecision,
  type OrganizationVerificationDecision,
} from "../decision/index.js";
import {
  isOrganizationVerificationDecisionTrustIntegrationBinding,
  type OrganizationVerificationDecisionTrustIntegrationBinding,
  type OrganizationVerificationDecisionTrustIntegrationInputBinding,
} from "../decision-trust-integration-contract/index.js";
import {
  isOrganizationVerificationTrustStatus,
  type OrganizationVerificationTrustStatus,
} from "../trust-status/index.js";
import type {
  OrganizationVerificationDecisionTrustIntegrationExecutionContractVersion,
  OrganizationVerificationDecisionTrustIntegrationExecutionFingerprint,
  OrganizationVerificationDecisionTrustIntegrationExecutionId,
  OrganizationVerificationDecisionTrustIntegrationExecutionIntegrityReference,
  OrganizationVerificationDecisionTrustIntegrationExecutionProvenanceReference,
} from "./decisionTrustIntegrationIds.js";

const integrationExecutionSeal = Symbol(
  "organization-verification-decision-trust-integration-execution",
);

export interface OrganizationVerificationDecisionTrustIntegrationExecution {
  readonly executionId: OrganizationVerificationDecisionTrustIntegrationExecutionId;
  readonly executionContractVersion: OrganizationVerificationDecisionTrustIntegrationExecutionContractVersion;
  readonly inputBinding: OrganizationVerificationDecisionTrustIntegrationInputBinding;
  readonly decision: OrganizationVerificationDecision;
  readonly trustStatus: OrganizationVerificationTrustStatus;
  readonly binding: OrganizationVerificationDecisionTrustIntegrationBinding;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly provenanceReference: OrganizationVerificationDecisionTrustIntegrationExecutionProvenanceReference;
  readonly integrityReference: OrganizationVerificationDecisionTrustIntegrationExecutionIntegrityReference;
  readonly executionFingerprint: OrganizationVerificationDecisionTrustIntegrationExecutionFingerprint;
  readonly [integrationExecutionSeal]: true;
}

export type OrganizationVerificationDecisionTrustIntegrationExecutionData =
  Omit<
    OrganizationVerificationDecisionTrustIntegrationExecution,
    typeof integrationExecutionSeal
  >;

export function createOrganizationVerificationDecisionTrustIntegrationExecutionInternal(
  data: OrganizationVerificationDecisionTrustIntegrationExecutionData,
): OrganizationVerificationDecisionTrustIntegrationExecution {
  const execution = { ...data };
  Object.defineProperty(execution, integrationExecutionSeal, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  return Object.freeze(
    execution,
  ) as OrganizationVerificationDecisionTrustIntegrationExecution;
}

export function isOrganizationVerificationDecisionTrustIntegrationExecution(
  value: unknown,
): value is OrganizationVerificationDecisionTrustIntegrationExecution {
  if (typeof value !== "object" || value === null) return false;
  return (
    Object.getOwnPropertyDescriptor(value, integrationExecutionSeal)?.value ===
      true &&
    Object.isFrozen(value) &&
    isOrganizationVerificationDecisionTrustIntegrationBinding(
      Object.getOwnPropertyDescriptor(value, "binding")?.value,
    ) &&
    isOrganizationVerificationDecision(
      Object.getOwnPropertyDescriptor(value, "decision")?.value,
    ) &&
    isOrganizationVerificationTrustStatus(
      Object.getOwnPropertyDescriptor(value, "trustStatus")?.value,
    )
  );
}
