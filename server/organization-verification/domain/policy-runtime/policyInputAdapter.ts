import {
  createCorrelationId,
  createSnapshotFingerprint,
  createSnapshotId,
} from "../index.js";
import type { OrganizationVerificationPolicyEvaluationInput as AuthenticatedEvaluationInput } from "../evaluation-input/index.js";
import {
  POLICY_EVALUATION_CONTEXT_VERSION,
  createOrganizationVerificationPolicyEvaluationInput,
  createOrganizationVerificationPolicyEvaluationIntegrityReference,
  createOrganizationVerificationPolicyProvenanceReference,
  type OrganizationVerificationPolicyEvaluationInput,
  type OrganizationVerificationPolicyRegistryProjection,
} from "../policy/index.js";
import {
  policyRuntimeFailure,
  policyRuntimeSuccess,
  type OrganizationVerificationPolicyRuntimeResult,
} from "./errors.js";

const FROZEN_REGISTRY_CONTRACT_VERSION =
  "organization_registry_profile_revision.v1" satisfies OrganizationVerificationPolicyRegistryProjection["registryContractVersion"];

export function adaptAuthenticatedEvaluationInputToFrozenPolicyInput(
  input: AuthenticatedEvaluationInput,
): OrganizationVerificationPolicyRuntimeResult<OrganizationVerificationPolicyEvaluationInput> {
  const registryFacts = input.factSurface.registryFacts;
  if (!registryFacts) {
    return policyRuntimeFailure("policy_input_adaptation_failure", {
      path: "factSurface.registryFacts",
      cause: "registry_facts_required_by_frozen_policy_input",
    });
  }

  const snapshotId = createSnapshotId(
    input.projectionBinding.sourceSnapshotId,
  );
  const snapshotFingerprint = createSnapshotFingerprint(
    input.projectionBinding.sourceSnapshotFingerprint,
  );
  const correlationId = createCorrelationId(
    input.evaluationContext.correlationReference,
  );
  const provenanceReference =
    createOrganizationVerificationPolicyProvenanceReference(
      input.evaluationContext.provenanceReference,
    );
  const integrityReference =
    createOrganizationVerificationPolicyEvaluationIntegrityReference(
      input.evaluationContext.integrityReference,
    );
  if (
    !snapshotId.ok ||
    !snapshotFingerprint.ok ||
    !correlationId.ok ||
    !provenanceReference.ok ||
    !integrityReference.ok
  ) {
    return policyRuntimeFailure("policy_input_adaptation_failure", {
      cause: "policy_input_identity_conversion_failed",
    });
  }

  const declaredActivityCodes = registryFacts.declaredActivities
    .flatMap((activity) => (activity.code ? [activity.code] : []))
    .sort((left, right) => left.localeCompare(right));
  const semanticEvidenceReferences = (
    input.factSurface.evidenceFacts ?? []
  )
    .map((evidence) => evidence.revisionEvidenceReferenceId)
    .sort((left, right) => left.localeCompare(right));

  const policyInput = createOrganizationVerificationPolicyEvaluationInput({
    organizationId: input.projectionBinding.organizationId,
    recordId: input.projectionBinding.recordId,
    revisionId: input.projectionBinding.revisionId,
    attemptId: input.projectionBinding.attemptId,
    snapshotId: snapshotId.value,
    snapshotFingerprint: snapshotFingerprint.value,
    policySetId: input.policySetBinding.policySetId,
    policySetVersion: input.policySetBinding.policySetVersion,
    evaluationContextVersion: POLICY_EVALUATION_CONTEXT_VERSION,
    semanticEvidenceReferences,
    registryProjection: {
      profileRevisionId: input.projectionBinding.profileRevisionId,
      profileFingerprint: registryFacts.profileFingerprint,
      registryContractVersion: FROZEN_REGISTRY_CONTRACT_VERSION,
      organizationType: registryFacts.organizationType,
      jurisdiction: registryFacts.jurisdiction,
      declaredActivityCodes,
    },
    evaluationRequestedAt: input.evaluationContext.requestedAt,
    provenanceReference: provenanceReference.value,
    correlationId: correlationId.value,
    integrityReference: integrityReference.value,
    inputComplete: true,
    inputIntegrityValid: true,
  });
  return policyInput.ok
    ? policyRuntimeSuccess(policyInput.value)
    : policyRuntimeFailure("policy_input_adaptation_failure", {
        path: policyInput.path,
        cause: policyInput.code,
      });
}
