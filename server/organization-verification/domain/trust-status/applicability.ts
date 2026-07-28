import type { OrganizationVerificationDecisionId } from "../decision/index.js";
import type { CorrelationId } from "../ids.js";
import {
  trustStatusFailure,
  trustStatusSuccess,
  type TrustStatusDomainResult,
} from "./errors.js";
import {
  DECISION_APPLICABILITY_VERSION,
  type DecisionApplicabilityId,
  type DecisionApplicabilityVersion,
  type TrustStatusIntegrityReference,
  type TrustStatusProvenanceReference,
} from "./ids.js";

export const DECISION_APPLICABILITY_STATES = [
  "applicable",
  "superseded",
  "expired",
  "invalidated",
] as const;

declare const decisionApplicabilityStateBrand: unique symbol;
type DecisionApplicabilityStateLiteral =
  (typeof DECISION_APPLICABILITY_STATES)[number];
export type DecisionApplicabilityState =
  DecisionApplicabilityStateLiteral & {
    readonly [decisionApplicabilityStateBrand]: "DecisionApplicabilityState";
  };

export interface RawDecisionApplicabilityInput {
  readonly applicabilityId: DecisionApplicabilityId;
  readonly version: DecisionApplicabilityVersion;
  readonly decisionId: OrganizationVerificationDecisionId;
  readonly effectiveAt: string;
  readonly provenanceReference: TrustStatusProvenanceReference;
  readonly correlationId: CorrelationId;
  readonly integrityReference: TrustStatusIntegrityReference;
  readonly applicable: boolean;
  readonly superseded: boolean;
  readonly expired: boolean;
  readonly invalidated: boolean;
  readonly supersedingDecisionId?: OrganizationVerificationDecisionId;
}

const applicabilitySeal: unique symbol = Symbol(
  "organization_verification_decision_applicability",
);

export interface OrganizationVerificationDecisionApplicability {
  readonly applicabilityId: DecisionApplicabilityId;
  readonly version: DecisionApplicabilityVersion;
  readonly decisionId: OrganizationVerificationDecisionId;
  readonly state: DecisionApplicabilityState;
  readonly effectiveAt: string;
  readonly provenanceReference: TrustStatusProvenanceReference;
  readonly correlationId: CorrelationId;
  readonly integrityReference: TrustStatusIntegrityReference;
  readonly supersedingDecisionId?: OrganizationVerificationDecisionId;
  readonly [applicabilitySeal]: true;
}

function isNonEmpty(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    !["latest", "current", "head"].includes(value.trim().toLowerCase())
  );
}

export function createDecisionApplicability(
  input: RawDecisionApplicabilityInput,
): TrustStatusDomainResult<OrganizationVerificationDecisionApplicability> {
  if (typeof input !== "object" || input === null) {
    return trustStatusFailure("invalid_decision_applicability");
  }
  if ("state" in input) {
    return trustStatusFailure("invalid_decision_applicability");
  }
  const signals = [
    input.applicable,
    input.superseded,
    input.expired,
    input.invalidated,
  ];
  if (signals.some((signal) => typeof signal !== "boolean")) {
    return trustStatusFailure("invalid_decision_applicability");
  }
  const selected: Array<DecisionApplicabilityStateLiteral | undefined> = [
    input.applicable ? "applicable" : undefined,
    input.superseded ? "superseded" : undefined,
    input.expired ? "expired" : undefined,
    input.invalidated ? "invalidated" : undefined,
  ];
  const selectedStates = selected.filter(
    (value): value is DecisionApplicabilityStateLiteral => value !== undefined,
  );
  if (selectedStates.length !== 1) {
    return trustStatusFailure(
      selectedStates.length === 0
        ? "invalid_decision_applicability"
        : "contradictory_decision_applicability",
    );
  }
  if (
    input.version !== DECISION_APPLICABILITY_VERSION ||
    !isNonEmpty(input.applicabilityId) ||
    !isNonEmpty(input.decisionId) ||
    !isNonEmpty(input.provenanceReference) ||
    !isNonEmpty(input.correlationId) ||
    !isNonEmpty(input.integrityReference) ||
    !Number.isFinite(Date.parse(input.effectiveAt))
  ) {
    return trustStatusFailure("invalid_decision_applicability");
  }
  const state = selectedStates[0] as DecisionApplicabilityState;
  if (
    state === "superseded" &&
    (!isNonEmpty(input.supersedingDecisionId) ||
      input.supersedingDecisionId === input.decisionId)
  ) {
    return trustStatusFailure("superseding_decision_mismatch");
  }
  if (
    state !== "superseded" &&
    input.supersedingDecisionId !== undefined
  ) {
    return trustStatusFailure("contradictory_decision_applicability");
  }
  return trustStatusSuccess(
    Object.freeze({
      applicabilityId: input.applicabilityId,
      version: input.version,
      decisionId: input.decisionId,
      state,
      effectiveAt: input.effectiveAt,
      provenanceReference: input.provenanceReference,
      correlationId: input.correlationId,
      integrityReference: input.integrityReference,
      ...(input.supersedingDecisionId
        ? { supersedingDecisionId: input.supersedingDecisionId }
        : {}),
      [applicabilitySeal]: true as const,
    }),
  );
}

export function readDecisionApplicability(
  input: OrganizationVerificationDecisionApplicability,
): OrganizationVerificationDecisionApplicability {
  if (
    typeof input !== "object" ||
    input === null ||
    input[applicabilitySeal] !== true ||
    !Object.isFrozen(input)
  ) {
    throw new TypeError("SEALED_DECISION_APPLICABILITY_REQUIRED");
  }
  return input;
}
