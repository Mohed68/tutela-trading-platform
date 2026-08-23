import { createHash } from "node:crypto";

import {
  REGISTRY_CONTRACT_VERSION,
  type OrganizationId,
  type OrganizationLifecycleProjection,
  type OrganizationProfileFingerprint,
  type OrganizationProfileRevisionId,
  type OrganizationProfileRevisionSequence,
  type RegistryContractVersion,
} from "../organization-registry/index.js";
import type {
  OrganizationMembershipRole,
  OrganizationMembershipStatus,
} from "../organization-membership/index.js";
import {
  isOrganizationVerificationWorkflowStreamIdentity,
  type OrganizationVerificationWorkflowStreamIdentity,
} from "../organization-verification/application/persistence-contract/index.js";

export const ORGANIZATION_PARTICIPATION_ELIGIBILITY_CONTRACT_VERSION =
  "organization-participation-eligibility/v1" as const;

export const ORGANIZATION_PARTICIPATION_ELIGIBILITY_REASON_CODES = [
  "organization_not_found",
  "organization_registry_integrity_failure",
  "organization_suspended",
  "organization_inactive",
  "membership_required",
  "membership_inactive",
  "membership_scope_mismatch",
  "membership_integrity_failure",
  "organization_verification_incomplete",
  "organization_verification_unavailable",
  "organization_not_trusted",
] as const;

export type OrganizationParticipationEligibilityReasonCode =
  (typeof ORGANIZATION_PARTICIPATION_ELIGIBILITY_REASON_CODES)[number];
export type OrganizationParticipationEligibilityOutcome =
  | "eligible"
  | "ineligible";

export interface CreateOrganizationParticipationEligibilityRequestInput {
  readonly evaluationId: string;
  readonly userId: string;
  readonly membershipId: string;
  readonly organizationId: OrganizationId;
  readonly organizationProfileRevisionId: OrganizationProfileRevisionId;
  readonly expectedRegistryContractVersion: RegistryContractVersion;
  readonly verificationStreamIdentity: OrganizationVerificationWorkflowStreamIdentity;
  readonly evaluatedAt: string;
}

export interface OrganizationParticipationEligibilityRequest
  extends Readonly<CreateOrganizationParticipationEligibilityRequestInput> {
  readonly requestFingerprint: string;
}

export type OrganizationParticipationEligibilityRequestCreationResult =
  | Readonly<{
      ok: true;
      value: OrganizationParticipationEligibilityRequest;
    }>
  | Readonly<{
      ok: false;
      code:
        | "invalid_eligibility_request"
        | "organization_scope_mismatch"
        | "unsupported_registry_contract_version";
    }>;

export interface OrganizationEligibilityReference {
  readonly organizationProfileRevisionId: OrganizationProfileRevisionId;
  readonly organizationProfileRevisionSequence: OrganizationProfileRevisionSequence;
  readonly organizationProfileFingerprint: OrganizationProfileFingerprint;
  readonly organizationLifecycle: OrganizationLifecycleProjection;
  readonly registryContractVersion: RegistryContractVersion;
}

export interface MembershipEligibilityReference {
  readonly membershipId: string;
  readonly membershipVersion: number;
  readonly membershipRole: OrganizationMembershipRole;
  readonly membershipStatus: OrganizationMembershipStatus;
  readonly membershipFingerprint: string;
}

export interface VerificationEligibilityReference {
  readonly source: "organization_verification_replay";
  readonly workflowExecutionId: string;
  readonly workflowExecutionVersion: number;
  readonly persistenceStreamVersion: number;
  readonly evidenceStreamFingerprint: string;
  readonly replayFingerprint: string;
  readonly workflowExecutionFingerprint: string;
  readonly trustStatus: string;
  readonly trustStatusProjectionId: string;
  readonly trustSourceFactsVersion: string;
  readonly trustDeriverVersion: string;
  readonly trustIntegrityReference: string;
}

export interface OrganizationParticipationEligibilityResult {
  readonly contractVersion: typeof ORGANIZATION_PARTICIPATION_ELIGIBILITY_CONTRACT_VERSION;
  readonly evaluationId: string;
  readonly requestFingerprint: string;
  readonly organizationId: OrganizationId;
  readonly userId: string;
  readonly evaluatedAt: string;
  readonly outcome: OrganizationParticipationEligibilityOutcome;
  readonly reasonCodes: readonly OrganizationParticipationEligibilityReasonCode[];
  readonly organizationReference?: OrganizationEligibilityReference;
  readonly membershipReference?: MembershipEligibilityReference;
  readonly verificationReference?: VerificationEligibilityReference;
  readonly eligibilityFingerprint: string;
}

export type OrganizationParticipationEligibilityEvaluation =
  | Readonly<{
      status: "evaluated";
      result: OrganizationParticipationEligibilityResult;
    }>
  | Readonly<{
      status: "rejected";
      code: "invalid_eligibility_request";
    }>;

const authenticRequests = new WeakSet<object>();
const authenticResults = new WeakSet<object>();
const REQUEST_FIELDS = new Set([
  "evaluationId",
  "userId",
  "membershipId",
  "organizationId",
  "organizationProfileRevisionId",
  "expectedRegistryContractVersion",
  "verificationStreamIdentity",
  "evaluatedAt",
]);

function identity(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    !["latest", "current", "head", "default"].includes(
      value.trim().toLowerCase(),
    )
  );
}

function hash(value: unknown): string {
  return `sha256:${createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex")}`;
}

export function createOrganizationParticipationEligibilityRequest(
  input: CreateOrganizationParticipationEligibilityRequestInput,
): OrganizationParticipationEligibilityRequestCreationResult {
  if (
    typeof input !== "object" ||
    input === null ||
    Object.keys(input).some((key) => !REQUEST_FIELDS.has(key)) ||
    !identity(input.evaluationId) ||
    !identity(input.userId) ||
    !identity(input.membershipId) ||
    !identity(input.organizationId) ||
    !identity(input.organizationProfileRevisionId) ||
    !Number.isFinite(Date.parse(input.evaluatedAt)) ||
    !isOrganizationVerificationWorkflowStreamIdentity(
      input.verificationStreamIdentity,
    )
  ) {
    return Object.freeze({ ok: false, code: "invalid_eligibility_request" });
  }
  if (input.expectedRegistryContractVersion !== REGISTRY_CONTRACT_VERSION) {
    return Object.freeze({
      ok: false,
      code: "unsupported_registry_contract_version",
    });
  }
  if (
    input.verificationStreamIdentity.organizationId !== input.organizationId
  ) {
    return Object.freeze({ ok: false, code: "organization_scope_mismatch" });
  }
  const request: OrganizationParticipationEligibilityRequest = Object.freeze({
    evaluationId: input.evaluationId,
    userId: input.userId,
    membershipId: input.membershipId,
    organizationId: input.organizationId,
    organizationProfileRevisionId: input.organizationProfileRevisionId,
    expectedRegistryContractVersion: input.expectedRegistryContractVersion,
    verificationStreamIdentity: input.verificationStreamIdentity,
    evaluatedAt: input.evaluatedAt,
    requestFingerprint: hash({
      scope: ORGANIZATION_PARTICIPATION_ELIGIBILITY_CONTRACT_VERSION,
      evaluationId: input.evaluationId,
      userId: input.userId,
      membershipId: input.membershipId,
      organizationId: input.organizationId,
      organizationProfileRevisionId: input.organizationProfileRevisionId,
      expectedRegistryContractVersion: input.expectedRegistryContractVersion,
      verificationStreamFingerprint:
        input.verificationStreamIdentity.streamIdentityFingerprint,
      evaluatedAt: input.evaluatedAt,
    }),
  });
  authenticRequests.add(request);
  return Object.freeze({ ok: true, value: request });
}

export function isOrganizationParticipationEligibilityRequest(
  value: unknown,
): value is OrganizationParticipationEligibilityRequest {
  return (
    typeof value === "object" &&
    value !== null &&
    authenticRequests.has(value) &&
    Object.isFrozen(value)
  );
}

export function createOrganizationParticipationEligibilityResultInternal(input: {
  readonly request: OrganizationParticipationEligibilityRequest;
  readonly outcome: OrganizationParticipationEligibilityOutcome;
  readonly reasonCodes: readonly OrganizationParticipationEligibilityReasonCode[];
  readonly organizationReference?: OrganizationEligibilityReference;
  readonly membershipReference?: MembershipEligibilityReference;
  readonly verificationReference?: VerificationEligibilityReference;
}): OrganizationParticipationEligibilityResult {
  const reasonCodes = Object.freeze([...input.reasonCodes]);
  const organizationReference = input.organizationReference
    ? Object.freeze({ ...input.organizationReference })
    : undefined;
  const membershipReference = input.membershipReference
    ? Object.freeze({ ...input.membershipReference })
    : undefined;
  const verificationReference = input.verificationReference
    ? Object.freeze({ ...input.verificationReference })
    : undefined;
  const result: OrganizationParticipationEligibilityResult = Object.freeze({
    contractVersion: ORGANIZATION_PARTICIPATION_ELIGIBILITY_CONTRACT_VERSION,
    evaluationId: input.request.evaluationId,
    requestFingerprint: input.request.requestFingerprint,
    organizationId: input.request.organizationId,
    userId: input.request.userId,
    evaluatedAt: input.request.evaluatedAt,
    outcome: input.outcome,
    reasonCodes,
    ...(organizationReference ? { organizationReference } : {}),
    ...(membershipReference ? { membershipReference } : {}),
    ...(verificationReference ? { verificationReference } : {}),
    eligibilityFingerprint: hash({
      scope: ORGANIZATION_PARTICIPATION_ELIGIBILITY_CONTRACT_VERSION,
      requestFingerprint: input.request.requestFingerprint,
      outcome: input.outcome,
      reasonCodes,
      organizationReference,
      membershipReference,
      verificationReference,
    }),
  });
  authenticResults.add(result);
  return result;
}

export function isOrganizationParticipationEligibilityResult(
  value: unknown,
): value is OrganizationParticipationEligibilityResult {
  return (
    typeof value === "object" &&
    value !== null &&
    authenticResults.has(value) &&
    Object.isFrozen(value)
  );
}
