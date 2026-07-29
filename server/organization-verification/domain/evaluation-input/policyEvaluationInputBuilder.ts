import {
  isOrganizationVerificationEvaluationProjection,
  type OrganizationVerificationEvaluationProjection,
} from "../evaluation-projection/index.js";
import {
  createOrganizationVerificationEvaluationContext,
  type OrganizationVerificationEvaluationContext,
} from "./evaluationContext.js";
import {
  canonicalizePolicyEvaluationInputInternal,
  computePolicyEvaluationInputFingerprintInternal,
} from "./evaluationInputCanonicalization.js";
import {
  createOrganizationVerificationEvaluationScope,
  type OrganizationVerificationEvaluationScope,
} from "./evaluationScope.js";
import {
  inputFailure,
  inputSuccess,
  type PolicyEvaluationInputDomainResult,
} from "./errors.js";
import {
  POLICY_EVALUATION_INPUT_BUILDER_VERSION,
  POLICY_EVALUATION_INPUT_CONTRACT_VERSION,
  isCanonicalEvaluationInputTimestampInternal,
  isEvaluationInputDigestInternal,
  isExactEvaluationInputIdentityInternal,
  type OrganizationVerificationPolicyEvaluationInputFingerprint,
  type OrganizationVerificationPolicyEvaluationInputId,
  type OrganizationVerificationPolicyEvaluationInputVersion,
} from "./ids.js";
import {
  createOrganizationVerificationPolicyEvaluationInputInternal,
  readOrganizationVerificationPolicyEvaluationInputInternal,
  type OrganizationVerificationPolicyEvaluationFactSurface,
  type OrganizationVerificationPolicyEvaluationInput,
  type OrganizationVerificationPolicyEvaluationInputData,
} from "./policyEvaluationInput.js";
import {
  createOrganizationVerificationPolicySetBinding,
  type OrganizationVerificationPolicySetBinding,
} from "./policySetBinding.js";

export interface BuildOrganizationVerificationPolicyEvaluationInput {
  readonly policyEvaluationInputId: OrganizationVerificationPolicyEvaluationInputId;
  readonly policyEvaluationInputVersion: OrganizationVerificationPolicyEvaluationInputVersion;
  readonly inputContractVersion: unknown;
  readonly inputBuilderVersion: unknown;
  readonly createdAt: unknown;
  readonly evaluationProjection: OrganizationVerificationEvaluationProjection;
  readonly policySetBinding: OrganizationVerificationPolicySetBinding;
  readonly evaluationContext: OrganizationVerificationEvaluationContext;
  readonly evaluationScope: OrganizationVerificationEvaluationScope;
  readonly expectedInputFingerprint?: OrganizationVerificationPolicyEvaluationInputFingerprint;
  readonly existingInput?: unknown;
}

function copyRegistry(
  source: OrganizationVerificationEvaluationProjection["registryFacts"],
) {
  const address = source.legalIdentity.registeredAddress
    ? Object.freeze({
        ...source.legalIdentity.registeredAddress,
        ...(source.legalIdentity.registeredAddress.addressLines
          ? {
              addressLines: Object.freeze([
                ...source.legalIdentity.registeredAddress.addressLines,
              ]),
            }
          : {}),
      })
    : undefined;
  return Object.freeze({
    profileRevisionSequence: source.profileRevisionSequence,
    profileFingerprint: source.profileFingerprint,
    legalIdentity: Object.freeze({
      ...source.legalIdentity,
      tradingNames: Object.freeze([...source.legalIdentity.tradingNames]),
      registrationIdentifiers: Object.freeze(
        source.legalIdentity.registrationIdentifiers.map((item) =>
          Object.freeze({ ...item }),
        ),
      ),
      ...(address ? { registeredAddress: address } : {}),
    }),
    organizationType: source.organizationType,
    jurisdiction: source.jurisdiction,
    declaredActivities: Object.freeze(
      source.declaredActivities.map((item) => Object.freeze({ ...item })),
    ),
  });
}

function copySubmission(
  source: OrganizationVerificationEvaluationProjection["submissionFacts"],
  authorized: ReadonlySet<string>,
) {
  return Object.freeze({
    revisionSequence: source.revisionSequence,
    submittedAt: source.submittedAt,
    declaredSections: Object.freeze(
      source.declaredSections
        .filter((section) => authorized.has(section.key))
        .map((section) =>
          Object.freeze({
            key: section.key,
            values: Object.freeze(
              section.values.map((item) => Object.freeze({ ...item })),
            ),
          }),
        ),
    ),
  });
}

function copyEvidence(
  source: OrganizationVerificationEvaluationProjection["evidenceFacts"],
  authorized: ReadonlySet<string>,
) {
  return Object.freeze(
    source
      .filter((item) => authorized.has(String(item.category)))
      .map((item) =>
        Object.freeze({
          ...item,
          attributes: Object.freeze(
            item.attributes.map((attribute) =>
              Object.freeze({ ...attribute }),
            ),
          ),
        }),
      ),
  );
}

function validateConsistency(
  projection: OrganizationVerificationEvaluationProjection,
  context: OrganizationVerificationEvaluationContext,
): PolicyEvaluationInputDomainResult<true> {
  if (context.organizationId !== projection.identity.organizationId) {
    return inputFailure("organization_id_mismatch");
  }
  if (context.recordId !== projection.identity.recordId) {
    return inputFailure("verification_record_id_mismatch");
  }
  if (context.revisionId !== projection.identity.revisionId) {
    return inputFailure("verification_revision_id_mismatch");
  }
  if (context.profileRevisionId !== projection.identity.profileRevisionId) {
    return inputFailure("profile_revision_id_mismatch");
  }
  if (context.evaluationProjectionId !== projection.evaluationProjectionId) {
    return inputFailure("evaluation_projection_mismatch");
  }
  if (
    context.evaluationProjectionFingerprint !==
    projection.projectionFingerprint
  ) {
    return inputFailure("evaluation_projection_fingerprint_mismatch");
  }
  if (
    context.sourceSnapshotId !== projection.source.evidenceSnapshotId ||
    context.sourceSnapshotFingerprint !== projection.source.snapshotFingerprint
  ) {
    return inputFailure("snapshot_reference_mismatch");
  }
  if (
    projection.identity.attemptId !== undefined &&
    projection.identity.attemptId !== context.attemptId
  ) {
    return inputFailure("attempt_id_mismatch");
  }
  return inputSuccess(true);
}

export function buildOrganizationVerificationPolicyEvaluationInput(
  input: BuildOrganizationVerificationPolicyEvaluationInput,
): PolicyEvaluationInputDomainResult<OrganizationVerificationPolicyEvaluationInput> {
  if (!isExactEvaluationInputIdentityInternal(input.policyEvaluationInputId)) {
    return inputFailure("invalid_policy_evaluation_input_id");
  }
  if (
    !isExactEvaluationInputIdentityInternal(input.policyEvaluationInputVersion)
  ) {
    return inputFailure("invalid_policy_evaluation_input_version");
  }
  if (input.inputContractVersion !== POLICY_EVALUATION_INPUT_CONTRACT_VERSION) {
    return inputFailure(
      "unsupported_policy_evaluation_input_contract_version",
    );
  }
  if (input.inputBuilderVersion !== POLICY_EVALUATION_INPUT_BUILDER_VERSION) {
    return inputFailure(
      "unsupported_policy_evaluation_input_builder_version",
    );
  }
  if (
    !isCanonicalEvaluationInputTimestampInternal(input.createdAt) ||
    (input.expectedInputFingerprint !== undefined &&
      !isEvaluationInputDigestInternal(input.expectedInputFingerprint))
  ) {
    return inputFailure("invalid_evaluation_input_fingerprint");
  }
  if (!isOrganizationVerificationEvaluationProjection(input.evaluationProjection)) {
    return inputFailure("unauthentic_evaluation_projection");
  }
  if (
    !Object.isFrozen(input.policySetBinding) ||
    !Object.isFrozen(input.evaluationContext) ||
    !Object.isFrozen(input.evaluationScope)
  ) {
    return inputFailure("policy_evaluation_input_construction_failure");
  }
  const validatedPolicySet = createOrganizationVerificationPolicySetBinding(
    input.policySetBinding,
  );
  if (!validatedPolicySet.ok) return validatedPolicySet;
  const validatedContext = createOrganizationVerificationEvaluationContext(
    input.evaluationContext,
  );
  if (!validatedContext.ok) return validatedContext;
  const validatedScope = createOrganizationVerificationEvaluationScope(
    input.evaluationScope,
  );
  if (!validatedScope.ok) return validatedScope;
  const policySetBinding = validatedPolicySet.value;
  const evaluationContext = validatedContext.value;
  const evaluationScope = validatedScope.value;
  const consistency = validateConsistency(
    input.evaluationProjection,
    evaluationContext,
  );
  if (!consistency.ok) return consistency;

  const projection = input.evaluationProjection;
  if (
    Date.parse(evaluationContext.requestedAt) <
      Date.parse(projection.projectedAt) ||
    Date.parse(evaluationContext.effectiveAt) <
      Date.parse(projection.source.snapshotCreatedAt) ||
    Date.parse(input.createdAt as string) <
      Date.parse(projection.projectedAt) ||
    Date.parse(input.createdAt as string) <
      Date.parse(evaluationContext.requestedAt) ||
    (evaluationContext.sourceCutoffAt !== undefined &&
      Date.parse(evaluationContext.sourceCutoffAt) <
        Date.parse(projection.source.snapshotCreatedAt))
  ) {
    return inputFailure("invalid_evaluation_input_chronology");
  }

  const projectionSections = new Set(
    evaluationScope.authorizedProjectionSections,
  );
  const availableCategories = new Set(
    projection.evidenceFacts.map((item) => String(item.category)),
  );
  const availableDeclaredSections = new Set(
    projection.submissionFacts.declaredSections.map((item) => item.key),
  );
  if (
    evaluationScope.authorizedEvidenceCategories.some(
      (category) => !availableCategories.has(String(category)),
    ) ||
    evaluationScope.authorizedDeclaredFactSections.some(
      (section) => !availableDeclaredSections.has(section),
    )
  ) {
    return inputFailure("evaluation_scope_exceeds_projection");
  }

  const factSurface: OrganizationVerificationPolicyEvaluationFactSurface =
    Object.freeze({
      ...(projectionSections.has("registry_facts")
        ? { registryFacts: copyRegistry(projection.registryFacts) }
        : {}),
      ...(projectionSections.has("submission_facts")
        ? {
            submissionFacts: copySubmission(
              projection.submissionFacts,
              new Set(
                evaluationScope.authorizedDeclaredFactSections,
              ),
            ),
          }
        : {}),
      ...(projectionSections.has("evidence_facts")
        ? {
            evidenceFacts: copyEvidence(
              projection.evidenceFacts,
              new Set(
                evaluationScope.authorizedEvidenceCategories.map(String),
              ),
            ),
          }
        : {}),
    });

  const withoutFingerprint: Omit<
    OrganizationVerificationPolicyEvaluationInputData,
    "inputFingerprint"
  > = {
    policyEvaluationInputId: input.policyEvaluationInputId,
    policyEvaluationInputVersion: input.policyEvaluationInputVersion,
    inputContractVersion: POLICY_EVALUATION_INPUT_CONTRACT_VERSION,
    inputBuilderVersion: POLICY_EVALUATION_INPUT_BUILDER_VERSION,
    projectionBinding: Object.freeze({
      evaluationProjectionId: projection.evaluationProjectionId,
      evaluationProjectionVersion: projection.evaluationProjectionVersion,
      projectionContractVersion: projection.projectionContractVersion,
      projectionSchemaVersion: projection.projectionSchemaVersion,
      projectionFingerprint: projection.projectionFingerprint,
      sourceSnapshotId: projection.source.evidenceSnapshotId,
      sourceSnapshotFingerprint: projection.source.snapshotFingerprint,
      organizationId: projection.identity.organizationId,
      recordId: projection.identity.recordId,
      revisionId: projection.identity.revisionId,
      profileRevisionId: projection.identity.profileRevisionId,
      attemptId: evaluationContext.attemptId,
    }),
    policySetBinding: Object.freeze({ ...policySetBinding }),
    evaluationContext: Object.freeze({ ...evaluationContext }),
    evaluationScope: Object.freeze({
      ...evaluationScope,
      authorizedProjectionSections: Object.freeze([
        ...evaluationScope.authorizedProjectionSections,
      ]),
      authorizedEvidenceCategories: Object.freeze([
        ...evaluationScope.authorizedEvidenceCategories,
      ]),
      authorizedDeclaredFactSections: Object.freeze([
        ...evaluationScope.authorizedDeclaredFactSections,
      ]),
    }),
    factSurface,
    createdAt: input.createdAt as string,
  };
  const inputFingerprint =
    computePolicyEvaluationInputFingerprintInternal(withoutFingerprint);
  if (
    input.expectedInputFingerprint !== undefined &&
    input.expectedInputFingerprint !== inputFingerprint
  ) {
    return inputFailure("invalid_evaluation_input_fingerprint");
  }
  const candidate = createOrganizationVerificationPolicyEvaluationInputInternal(
    { ...withoutFingerprint, inputFingerprint },
  );

  if (input.existingInput !== undefined) {
    const existing = readOrganizationVerificationPolicyEvaluationInputInternal(
      input.existingInput,
    );
    if (!existing) {
      return inputFailure("conflicting_policy_evaluation_input");
    }
    if (
      existing.policyEvaluationInputId === candidate.policyEvaluationInputId &&
      existing.inputFingerprint === candidate.inputFingerprint
    ) {
      return inputSuccess(existing);
    }
    const omitIdentity = (
      value: OrganizationVerificationPolicyEvaluationInput,
    ) => {
      const {
        policyEvaluationInputId: _id,
        inputFingerprint: _fingerprint,
        ...semantic
      } = value;
      return canonicalizePolicyEvaluationInputInternal(semantic);
    };
    if (
      existing.policyEvaluationInputId !== candidate.policyEvaluationInputId &&
      omitIdentity(existing) === omitIdentity(candidate)
    ) {
      return inputFailure("duplicate_policy_evaluation_input");
    }
    return inputFailure("conflicting_policy_evaluation_input");
  }
  return inputSuccess(candidate);
}
