import type { OrganizationId } from "../../../organization-registry/index.js";
import type { OrganizationVerificationDecisionId } from "../decision/index.js";
import type {
  CorrelationId,
  OrganizationVerificationRecordId,
} from "../ids.js";
import {
  trustStatusFailure,
  trustStatusSuccess,
  type TrustStatusDomainResult,
} from "./errors.js";
import type {
  InvalidationFactId,
  TrustStatusIntegrityReference,
  TrustStatusProvenanceReference,
  TrustStatusSourceAuthorityReference,
} from "./ids.js";

export interface OrganizationVerificationInvalidationFactInput {
  readonly invalidationFactId: InvalidationFactId;
  readonly organizationId: OrganizationId;
  readonly decisionId: OrganizationVerificationDecisionId;
  readonly recordId: OrganizationVerificationRecordId;
  readonly invalidatedAt: string;
  readonly provenanceReference: TrustStatusProvenanceReference;
  readonly sourceAuthorityReference: TrustStatusSourceAuthorityReference;
  readonly correlationId: CorrelationId;
  readonly integrityReference: TrustStatusIntegrityReference;
}

const invalidationSeal: unique symbol = Symbol(
  "organization_verification_invalidation_fact",
);

export interface OrganizationVerificationInvalidationFact
  extends OrganizationVerificationInvalidationFactInput {
  readonly [invalidationSeal]: true;
}

function validValue(value: unknown): boolean {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    !["latest", "current", "head"].includes(value.trim().toLowerCase())
  );
}

export function createOrganizationVerificationInvalidationFact(
  input: OrganizationVerificationInvalidationFactInput,
): TrustStatusDomainResult<OrganizationVerificationInvalidationFact> {
  if (
    typeof input !== "object" ||
    input === null ||
    [
      input.invalidationFactId,
      input.organizationId,
      input.decisionId,
      input.recordId,
      input.provenanceReference,
      input.sourceAuthorityReference,
      input.correlationId,
      input.integrityReference,
    ].some((value) => !validValue(value)) ||
    !Number.isFinite(Date.parse(input.invalidatedAt))
  ) {
    return trustStatusFailure("invalid_invalidation_fact");
  }
  return trustStatusSuccess(
    Object.freeze({
      ...input,
      [invalidationSeal]: true as const,
    }),
  );
}

export function readOrganizationVerificationInvalidationFact(
  input: OrganizationVerificationInvalidationFact,
): OrganizationVerificationInvalidationFact {
  if (
    typeof input !== "object" ||
    input === null ||
    input[invalidationSeal] !== true ||
    !Object.isFrozen(input)
  ) {
    throw new TypeError("SEALED_INVALIDATION_FACT_REQUIRED");
  }
  return input;
}
