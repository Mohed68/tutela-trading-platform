import type { OrganizationVerificationDecisionId } from "../decision/index.js";
import type { CorrelationId } from "../ids.js";
import {
  trustStatusFailure,
  trustStatusSuccess,
  type TrustStatusDomainResult,
} from "./errors.js";
import type {
  ExpiryFactId,
  TrustStatusIntegrityReference,
  TrustStatusProvenanceReference,
} from "./ids.js";

export interface OrganizationVerificationExpiryFactInput {
  readonly expiryFactId: ExpiryFactId;
  readonly decisionId: OrganizationVerificationDecisionId;
  readonly validUntil: string;
  readonly recordedAt: string;
  readonly provenanceReference: TrustStatusProvenanceReference;
  readonly correlationId: CorrelationId;
  readonly integrityReference: TrustStatusIntegrityReference;
}

const expirySeal: unique symbol = Symbol(
  "organization_verification_expiry_fact",
);

export interface OrganizationVerificationExpiryFact
  extends OrganizationVerificationExpiryFactInput {
  readonly [expirySeal]: true;
}

export function createOrganizationVerificationExpiryFact(
  input: OrganizationVerificationExpiryFactInput,
): TrustStatusDomainResult<OrganizationVerificationExpiryFact> {
  if (
    typeof input !== "object" ||
    input === null ||
    [
      input.expiryFactId,
      input.decisionId,
      input.provenanceReference,
      input.correlationId,
      input.integrityReference,
    ].some(
      (value) =>
        typeof value !== "string" ||
        value.trim().length === 0 ||
        ["latest", "current", "head"].includes(
          value.trim().toLowerCase(),
        ),
    ) ||
    !Number.isFinite(Date.parse(input.validUntil)) ||
    !Number.isFinite(Date.parse(input.recordedAt))
  ) {
    return trustStatusFailure("invalid_expiry_fact");
  }
  return trustStatusSuccess(
    Object.freeze({
      ...input,
      [expirySeal]: true as const,
    }),
  );
}

export function readOrganizationVerificationExpiryFact(
  input: OrganizationVerificationExpiryFact,
): OrganizationVerificationExpiryFact {
  if (
    typeof input !== "object" ||
    input === null ||
    input[expirySeal] !== true ||
    !Object.isFrozen(input)
  ) {
    throw new TypeError("SEALED_EXPIRY_FACT_REQUIRED");
  }
  return input;
}
