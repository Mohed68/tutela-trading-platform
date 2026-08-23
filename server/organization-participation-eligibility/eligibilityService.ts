import {
  isOrganizationMembership,
  type OrganizationMembership,
} from "../organization-membership/index.js";
import {
  isOrganizationVerificationReplayExecution,
} from "../organization-verification/application/replay-runtime/index.js";
import {
  isOrganizationVerificationDecisionTrustIntegrationExecution,
} from "../organization-verification/domain/decision-trust-integration/index.js";
import {
  createOrganizationParticipationEligibilityResultInternal,
  isOrganizationParticipationEligibilityRequest,
  type MembershipEligibilityReference,
  type OrganizationEligibilityReference,
  type OrganizationParticipationEligibilityEvaluation,
  type OrganizationParticipationEligibilityReasonCode,
  type OrganizationParticipationEligibilityRequest,
  type VerificationEligibilityReference,
} from "./eligibilityContracts.js";
import type {
  OrganizationParticipationEligibilityDependencies,
  OrganizationParticipationEligibilityServicePort,
} from "./eligibilityPorts.js";

function membershipReference(
  membership: OrganizationMembership,
): MembershipEligibilityReference {
  return Object.freeze({
    membershipId: membership.membershipId,
    membershipVersion: membership.membershipVersion,
    membershipRole: membership.role,
    membershipStatus: membership.status,
    membershipFingerprint: membership.membershipFingerprint,
  });
}

export function participationReasonForTrustStatusInternal(
  status: string,
): OrganizationParticipationEligibilityReasonCode | undefined {
  if (status === "trusted") return undefined;
  return status === "unestablished"
    ? "organization_verification_incomplete"
    : "organization_not_trusted";
}

function evaluated(
  request: OrganizationParticipationEligibilityRequest,
  input: Readonly<{
    reasonCode?: OrganizationParticipationEligibilityReasonCode;
    organizationReference?: OrganizationEligibilityReference;
    membershipReference?: MembershipEligibilityReference;
    verificationReference?: VerificationEligibilityReference;
  }>,
): OrganizationParticipationEligibilityEvaluation {
  const result = createOrganizationParticipationEligibilityResultInternal({
    request,
    outcome: input.reasonCode ? "ineligible" : "eligible",
    reasonCodes: input.reasonCode ? [input.reasonCode] : [],
    ...(input.organizationReference
      ? { organizationReference: input.organizationReference }
      : {}),
    ...(input.membershipReference
      ? { membershipReference: input.membershipReference }
      : {}),
    ...(input.verificationReference
      ? { verificationReference: input.verificationReference }
      : {}),
  });
  return Object.freeze({ status: "evaluated", result });
}

export function createOrganizationParticipationEligibilityService(
  dependencies: OrganizationParticipationEligibilityDependencies,
): OrganizationParticipationEligibilityServicePort {
  async function evaluateParticipationEligibility(
    request: OrganizationParticipationEligibilityRequest,
  ): Promise<OrganizationParticipationEligibilityEvaluation> {
    if (!isOrganizationParticipationEligibilityRequest(request)) {
      return Object.freeze({
        status: "rejected",
        code: "invalid_eligibility_request",
      });
    }

    const organization = await dependencies.organizationRegistry.resolveExactProfileRevision({
      organizationId: request.organizationId,
      organizationProfileRevisionId: request.organizationProfileRevisionId,
      expectedRegistryContractVersion: request.expectedRegistryContractVersion,
    });
    if (organization.status === "not_found") {
      return evaluated(request, { reasonCode: "organization_not_found" });
    }
    if (organization.status !== "resolved") {
      return evaluated(request, {
        reasonCode: "organization_registry_integrity_failure",
      });
    }
    const contract = organization.contract;
    if (
      contract.organizationId !== request.organizationId ||
      contract.organizationProfileRevisionId !==
        request.organizationProfileRevisionId ||
      contract.registryContractVersion !== request.expectedRegistryContractVersion
    ) {
      return evaluated(request, {
        reasonCode: "organization_registry_integrity_failure",
      });
    }
    const organizationReference: OrganizationEligibilityReference =
      Object.freeze({
        organizationProfileRevisionId:
          contract.organizationProfileRevisionId,
        organizationProfileRevisionSequence:
          contract.organizationProfileRevisionSequence,
        organizationProfileFingerprint:
          contract.organizationProfileFingerprint,
        organizationLifecycle: contract.organizationLifecycle,
        registryContractVersion: contract.registryContractVersion,
      });

    const membership = await dependencies.organizationMembership.resolveExactMembership({
      membershipId: request.membershipId,
      userId: request.userId,
      organizationId: request.organizationId,
    });
    if (membership.status === "not_found") {
      return evaluated(request, {
        reasonCode: "membership_required",
        organizationReference,
      });
    }
    if (
      membership.status !== "resolved" ||
      !isOrganizationMembership(membership.membership)
    ) {
      return evaluated(request, {
        reasonCode: "membership_integrity_failure",
        organizationReference,
      });
    }
    const member = membership.membership;
    const memberReference = membershipReference(member);
    if (
      member.membershipId !== request.membershipId ||
      member.userId !== request.userId ||
      member.organizationId !== request.organizationId
    ) {
      return evaluated(request, {
        reasonCode: "membership_scope_mismatch",
        organizationReference,
        membershipReference: memberReference,
      });
    }
    if (
      member.status !== "active" ||
      Date.parse(member.effectiveFrom) > Date.parse(request.evaluatedAt)
    ) {
      return evaluated(request, {
        reasonCode: "membership_inactive",
        organizationReference,
        membershipReference: memberReference,
      });
    }

    if (contract.organizationLifecycle === "suspended") {
      return evaluated(request, {
        reasonCode: "organization_suspended",
        organizationReference,
        membershipReference: memberReference,
      });
    }
    if (contract.organizationLifecycle !== "active") {
      return evaluated(request, {
        reasonCode: "organization_inactive",
        organizationReference,
        membershipReference: memberReference,
      });
    }

    const verification =
      await dependencies.organizationVerificationState.resolveAuthoritativeReplay({
        streamIdentity: request.verificationStreamIdentity,
      });
    if (verification.status === "not_found") {
      return evaluated(request, {
        reasonCode: "organization_verification_incomplete",
        organizationReference,
        membershipReference: memberReference,
      });
    }
    if (
      verification.status !== "resolved" ||
      !isOrganizationVerificationReplayExecution(
        verification.replayExecution,
      )
    ) {
      return evaluated(request, {
        reasonCode: "organization_verification_unavailable",
        organizationReference,
        membershipReference: memberReference,
      });
    }
    const replay = verification.replayExecution;
    if (
      replay.streamIdentity.streamIdentityFingerprint !==
        request.verificationStreamIdentity.streamIdentityFingerprint ||
      replay.streamIdentity.organizationId !== request.organizationId ||
      replay.reconstructedWorkflowExecution.organizationId !==
        request.organizationId ||
      replay.completionStatus !== "stream_consumed"
    ) {
      return evaluated(request, {
        reasonCode: "organization_verification_unavailable",
        organizationReference,
        membershipReference: memberReference,
      });
    }
    const integration =
      replay.reconstructedWorkflowExecution
        .decisionTrustIntegrationExecution;
    if (
      integration === undefined ||
      !isOrganizationVerificationDecisionTrustIntegrationExecution(
        integration,
      )
    ) {
      return evaluated(request, {
        reasonCode: "organization_verification_incomplete",
        organizationReference,
        membershipReference: memberReference,
      });
    }
    const trust = integration.trustStatus;
    if (trust.organizationId !== request.organizationId) {
      return evaluated(request, {
        reasonCode: "organization_verification_unavailable",
        organizationReference,
        membershipReference: memberReference,
      });
    }
    const verificationReference: VerificationEligibilityReference =
      Object.freeze({
        source: "organization_verification_replay",
        workflowExecutionId: replay.reconstructedWorkflowExecution.workflowExecutionId,
        workflowExecutionVersion:
          replay.reconstructedWorkflowExecution.workflowExecutionVersion,
        persistenceStreamVersion: replay.persistenceStreamVersion,
        evidenceStreamFingerprint: replay.sourceEvidenceStreamFingerprint,
        replayFingerprint: replay.replayFingerprint,
        workflowExecutionFingerprint:
          replay.reconstructedWorkflowExecution.workflowExecutionFingerprint,
        trustStatus: trust.status,
        trustStatusProjectionId: trust.projectionId,
        trustSourceFactsVersion: trust.sourceFactsVersion,
        trustDeriverVersion: trust.deriverVersion,
        trustIntegrityReference: trust.integrityReference,
      });

    const trustReason = participationReasonForTrustStatusInternal(
      trust.status,
    );
    if (trustReason !== undefined) {
      return evaluated(request, {
        reasonCode: trustReason,
        organizationReference,
        membershipReference: memberReference,
        verificationReference,
      });
    }
    return evaluated(request, {
      organizationReference,
      membershipReference: memberReference,
      verificationReference,
    });
  }

  return Object.freeze({ evaluateParticipationEligibility });
}
