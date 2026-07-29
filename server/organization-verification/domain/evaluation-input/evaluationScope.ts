import type { OrganizationVerificationEvaluationProjection } from "../evaluation-projection/index.js";
import {
  inputFailure,
  inputSuccess,
  type PolicyEvaluationInputDomainResult,
} from "./errors.js";
import {
  EVALUATION_SCOPE_CONTRACT_VERSION,
  ORGANIZATION_VERIFICATION_EVALUATION_CAPABILITY,
  isExactEvaluationInputIdentityInternal,
  type EvaluationScopeContractVersion,
  type OrganizationVerificationEvaluationCapability,
  type OrganizationVerificationEvaluationIntegrityReference,
  type OrganizationVerificationEvaluationProvenanceReference,
} from "./ids.js";

export const ORGANIZATION_VERIFICATION_PROJECTION_SECTIONS = [
  "registry_facts",
  "submission_facts",
  "evidence_facts",
] as const;
export type OrganizationVerificationProjectionSection =
  (typeof ORGANIZATION_VERIFICATION_PROJECTION_SECTIONS)[number];
type Projection = OrganizationVerificationEvaluationProjection;

export interface OrganizationVerificationEvaluationScope {
  readonly scopeContractVersion: EvaluationScopeContractVersion;
  readonly capability: OrganizationVerificationEvaluationCapability;
  readonly authorizedProjectionSections: readonly OrganizationVerificationProjectionSection[];
  readonly authorizedEvidenceCategories: readonly Projection["evidenceFacts"][number]["category"][];
  readonly authorizedDeclaredFactSections: readonly string[];
  readonly provenanceReference: OrganizationVerificationEvaluationProvenanceReference;
  readonly integrityReference: OrganizationVerificationEvaluationIntegrityReference;
}

export interface CreateOrganizationVerificationEvaluationScopeInput
  extends Omit<
    OrganizationVerificationEvaluationScope,
    | "scopeContractVersion"
    | "capability"
    | "authorizedProjectionSections"
    | "authorizedEvidenceCategories"
    | "authorizedDeclaredFactSections"
  > {
  readonly scopeContractVersion: unknown;
  readonly capability: unknown;
  readonly authorizedProjectionSections: readonly unknown[];
  readonly authorizedEvidenceCategories: readonly unknown[];
  readonly authorizedDeclaredFactSections: readonly unknown[];
}

function uniqueExact(values: readonly unknown[]): values is readonly string[] {
  return (
    Array.isArray(values) &&
    values.every(isExactEvaluationInputIdentityInternal) &&
    new Set(values).size === values.length
  );
}

export function createOrganizationVerificationEvaluationScope(
  input: CreateOrganizationVerificationEvaluationScopeInput,
): PolicyEvaluationInputDomainResult<OrganizationVerificationEvaluationScope> {
  if (input.scopeContractVersion !== EVALUATION_SCOPE_CONTRACT_VERSION) {
    return inputFailure("unsupported_evaluation_scope_version");
  }
  if (input.capability !== ORGANIZATION_VERIFICATION_EVALUATION_CAPABILITY) {
    return inputFailure("invalid_evaluation_scope");
  }
  if (
    !uniqueExact(input.authorizedProjectionSections) ||
    input.authorizedProjectionSections.some(
      (section) =>
        !ORGANIZATION_VERIFICATION_PROJECTION_SECTIONS.includes(
          section as never,
        ),
    ) ||
    !uniqueExact(input.authorizedEvidenceCategories) ||
    !uniqueExact(input.authorizedDeclaredFactSections) ||
    !isExactEvaluationInputIdentityInternal(input.provenanceReference) ||
    !isExactEvaluationInputIdentityInternal(input.integrityReference)
  ) {
    return inputFailure("invalid_evaluation_scope");
  }
  if (
    input.authorizedEvidenceCategories.length > 0 &&
    !input.authorizedProjectionSections.includes("evidence_facts")
  ) {
    return inputFailure("evaluation_scope_exceeds_projection");
  }
  if (
    input.authorizedDeclaredFactSections.length > 0 &&
    !input.authorizedProjectionSections.includes("submission_facts")
  ) {
    return inputFailure("evaluation_scope_exceeds_projection");
  }
  return inputSuccess(
    Object.freeze({
      scopeContractVersion: EVALUATION_SCOPE_CONTRACT_VERSION,
      capability: ORGANIZATION_VERIFICATION_EVALUATION_CAPABILITY,
      authorizedProjectionSections: Object.freeze(
        [...input.authorizedProjectionSections].sort(),
      ) as readonly OrganizationVerificationProjectionSection[],
      authorizedEvidenceCategories: Object.freeze(
        [...input.authorizedEvidenceCategories].sort(),
      ) as OrganizationVerificationEvaluationScope["authorizedEvidenceCategories"],
      authorizedDeclaredFactSections: Object.freeze(
        [...input.authorizedDeclaredFactSections].sort(),
      ),
      provenanceReference: input.provenanceReference,
      integrityReference: input.integrityReference,
    }),
  );
}
