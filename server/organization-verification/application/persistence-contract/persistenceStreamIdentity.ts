import {
  persistenceFailure,
  persistenceSuccess,
  type OrganizationVerificationPersistenceResult,
} from "./persistenceErrors.js";
import { fingerprintPersistenceContract } from "./persistenceFingerprint.js";

export interface OrganizationVerificationWorkflowStreamIdentity {
  readonly workflowExecutionId: string;
  readonly organizationId: string;
  readonly recordId: string;
  readonly revisionId: string;
  readonly attemptId: string;
  readonly streamIdentityFingerprint: string;
}

const streamIdentitySeal = Symbol(
  "organization-verification-workflow-stream-identity",
);

function exactId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    !["latest", "current", "head", "default"].includes(
      value.trim().toLowerCase(),
    )
  );
}

export function sameOrganizationVerificationWorkflowStreamIdentity(
  left: OrganizationVerificationWorkflowStreamIdentity,
  right: OrganizationVerificationWorkflowStreamIdentity,
): boolean {
  return left.streamIdentityFingerprint === right.streamIdentityFingerprint;
}

export function createOrganizationVerificationWorkflowStreamIdentity(
  input: Omit<
    OrganizationVerificationWorkflowStreamIdentity,
    "streamIdentityFingerprint"
  >,
): OrganizationVerificationPersistenceResult<OrganizationVerificationWorkflowStreamIdentity> {
  if (
    !exactId(input.workflowExecutionId) ||
    !exactId(input.organizationId) ||
    !exactId(input.recordId) ||
    !exactId(input.revisionId) ||
    !exactId(input.attemptId)
  ) {
    return persistenceFailure("stream_identity_mismatch");
  }
  const identity = {
    workflowExecutionId: input.workflowExecutionId,
    organizationId: input.organizationId,
    recordId: input.recordId,
    revisionId: input.revisionId,
    attemptId: input.attemptId,
  };
  const candidate = {
    ...identity,
    streamIdentityFingerprint: fingerprintPersistenceContract({
      scope: "organization_verification_workflow_stream_identity",
      ...identity,
    }),
  };
  Object.defineProperty(candidate, streamIdentitySeal, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  return persistenceSuccess(Object.freeze(candidate));
}

export function isOrganizationVerificationWorkflowStreamIdentity(
  value: unknown,
): value is OrganizationVerificationWorkflowStreamIdentity {
  return (
    typeof value === "object" &&
    value !== null &&
    Object.getOwnPropertyDescriptor(value, streamIdentitySeal)?.value === true &&
    Object.isFrozen(value)
  );
}
