import type { OrganizationVerificationDecisionOutcome } from "../decision/index.js";
import {
  trustStatusFailure,
  trustStatusSuccess,
  type TrustStatusDomainResult,
} from "./errors.js";
import {
  TRUST_STATUS_DERIVER_VERSION,
  type TrustStatusDeriverVersion,
  type TrustStatusIntegrityReference,
  type TrustStatusProjectionId,
} from "./ids.js";
import {
  readOrganizationVerificationTrustStatusSourceFacts,
  type OrganizationVerificationTrustStatusSourceFacts,
} from "./sourceFacts.js";
import {
  type OrganizationVerificationTrustStatusData,
  type OrganizationVerificationTrustStatusValue,
  type OrganizationVerificationTrustStatusValueLiteral,
} from "./trustStatus.js";
import {
  hasExactDurableKeys,
  isDurableIdentity,
  isDurablePlainObject,
  isDurableTimestamp,
} from "../durableRehydrationValidation.js";

const trustStatusSeal: unique symbol = Symbol(
  "organization_verification_trust_status",
);

export interface OrganizationVerificationTrustStatus
  extends OrganizationVerificationTrustStatusData {
  readonly [trustStatusSeal]: true;
}

export interface TrustStatusDerivationContext {
  readonly projectionId: TrustStatusProjectionId;
  readonly deriverVersion: TrustStatusDeriverVersion;
  readonly derivedAt: string;
  readonly integrityReference: TrustStatusIntegrityReference;
  readonly existingProjection?: OrganizationVerificationTrustStatus;
}

function trustStatusValue(
  value: OrganizationVerificationTrustStatusValueLiteral,
): OrganizationVerificationTrustStatusValue {
  return value as OrganizationVerificationTrustStatusValue;
}

const STATUS_BY_DECISION = Object.freeze({
  approved: trustStatusValue("trusted"),
  revision_required: trustStatusValue("not_trusted"),
  manual_review: trustStatusValue("unestablished"),
  rejected: trustStatusValue("not_trusted"),
} satisfies Record<
  OrganizationVerificationDecisionOutcome,
  OrganizationVerificationTrustStatusValue
>);

function createTrustStatusInternal(
  input: OrganizationVerificationTrustStatusData,
): OrganizationVerificationTrustStatus {
  const trustStatus = { ...input };
  Object.defineProperty(trustStatus, trustStatusSeal, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  return Object.freeze(trustStatus) as OrganizationVerificationTrustStatus;
}

function isDurableTrustStatusData(
  value: unknown,
): value is OrganizationVerificationTrustStatusData {
  if (!isDurablePlainObject(value)) return false;
  const required = [
    "projectionId", "organizationId", "recordId", "status", "sourceFactsVersion",
    "deriverVersion", "derivationAsOf", "derivedAt", "effectiveFrom",
    "provenanceReference", "correlationId", "integrityReference",
  ];
  const optional = [
    "sourceDecisionId", "sourceRevisionId", "sourceAttemptId", "sourceSnapshotId",
    "sourceSnapshotFingerprint", "sourceDecisionOutcome", "sourceDecisionApplicability",
    "effectiveUntil", "invalidationFactId", "supersededDecisionId",
  ];
  if (!hasExactDurableKeys(value, required, optional)) return false;
  if (
    !["unestablished", "trusted", "not_trusted", "expired", "invalidated"].includes(String(value.status)) ||
    !["derivationAsOf", "derivedAt", "effectiveFrom"].every((key) => isDurableTimestamp(value[key])) ||
    (value.effectiveUntil !== undefined && !isDurableTimestamp(value.effectiveUntil))
  ) return false;
  return [...required.filter((key) => !["status", "derivationAsOf", "derivedAt", "effectiveFrom"].includes(key)),
    ...optional.filter((key) => !["sourceDecisionOutcome", "sourceDecisionApplicability", "effectiveUntil"].includes(key))]
    .every((key) => value[key] === undefined || isDurableIdentity(value[key]));
}

export function rehydrateOrganizationVerificationTrustStatus(
  durableData: unknown,
): TrustStatusDomainResult<OrganizationVerificationTrustStatus> {
  if (!isDurableTrustStatusData(durableData)) {
    return trustStatusFailure("trust_source_facts_integrity_invalid");
  }
  return trustStatusSuccess(createTrustStatusInternal(durableData));
}

export function isOrganizationVerificationTrustStatus(
  input: unknown,
): input is OrganizationVerificationTrustStatus {
  if (typeof input !== "object" || input === null) return false;
  return (
    Object.getOwnPropertyDescriptor(input, trustStatusSeal)?.value === true &&
    Object.isFrozen(input)
  );
}

function sameProjectionSemantics(
  left: OrganizationVerificationTrustStatusData,
  right: OrganizationVerificationTrustStatusData,
): boolean {
  const fields: ReadonlyArray<
    keyof OrganizationVerificationTrustStatusData
  > = [
    "organizationId",
    "recordId",
    "sourceDecisionId",
    "sourceRevisionId",
    "sourceAttemptId",
    "sourceSnapshotId",
    "sourceSnapshotFingerprint",
    "sourceDecisionOutcome",
    "sourceDecisionApplicability",
    "status",
    "sourceFactsVersion",
    "deriverVersion",
    "derivationAsOf",
    "derivedAt",
    "effectiveFrom",
    "effectiveUntil",
    "invalidationFactId",
    "supersededDecisionId",
    "provenanceReference",
    "correlationId",
    "integrityReference",
  ];
  return fields.every((field) => left[field] === right[field]);
}

export function deriveOrganizationVerificationTrustStatus(
  sealedSourceFacts: OrganizationVerificationTrustStatusSourceFacts,
  context: TrustStatusDerivationContext,
): TrustStatusDomainResult<OrganizationVerificationTrustStatus> {
  let sourceFacts: OrganizationVerificationTrustStatusSourceFacts;
  try {
    sourceFacts =
      readOrganizationVerificationTrustStatusSourceFacts(sealedSourceFacts);
  } catch {
    return trustStatusFailure("trust_source_facts_integrity_invalid");
  }
  if (context.deriverVersion !== TRUST_STATUS_DERIVER_VERSION) {
    return trustStatusFailure("unsupported_trust_deriver_version");
  }
  if (
    typeof context.projectionId !== "string" ||
    context.projectionId.trim().length === 0 ||
    ["latest", "current", "head"].includes(
      context.projectionId.trim().toLowerCase(),
    ) ||
    typeof context.integrityReference !== "string" ||
    context.integrityReference.trim().length === 0 ||
    ["latest", "current", "head"].includes(
      context.integrityReference.trim().toLowerCase(),
    )
  ) {
    return trustStatusFailure("invalid_opaque_identifier");
  }
  if (
    !Number.isFinite(Date.parse(context.derivedAt)) ||
    Date.parse(context.derivedAt) < Date.parse(sourceFacts.derivationAsOf)
  ) {
    return trustStatusFailure("invalid_derivation_timestamp");
  }

  const decision = sourceFacts.authoritativeDecision;
  const applicability = sourceFacts.authoritativeDecisionApplicability;
  let status: OrganizationVerificationTrustStatusValue;
  let effectiveFrom = sourceFacts.derivationAsOf;

  if (!decision) {
    if (applicability) {
      return trustStatusFailure("trust_source_facts_incomplete");
    }
    status = trustStatusValue("unestablished");
  } else {
    if (!applicability) {
      return trustStatusFailure("invalid_decision_applicability");
    }
    if (sourceFacts.invalidationFact) {
      status = trustStatusValue("invalidated");
      effectiveFrom = sourceFacts.invalidationFact.invalidatedAt;
    } else if (
      sourceFacts.expiryFact &&
      Date.parse(sourceFacts.derivationAsOf) >=
        Date.parse(sourceFacts.expiryFact.validUntil)
    ) {
      status = trustStatusValue("expired");
      effectiveFrom = sourceFacts.expiryFact.validUntil;
    } else if (applicability.state === "superseded") {
      return trustStatusFailure("superseding_decision_missing");
    } else if (applicability.state === "invalidated") {
      return trustStatusFailure("invalid_invalidation_fact");
    } else if (applicability.state === "expired") {
      return trustStatusFailure("missing_expiry_boundary");
    } else {
      const mapped = STATUS_BY_DECISION[decision.outcome];
      if (!mapped) {
        return trustStatusFailure("unsupported_decision_outcome");
      }
      status = mapped;
      effectiveFrom = applicability.effectiveAt;
    }
  }

  const historicalDecision =
    sourceFacts.historicalDecisionApplicability?.state === "superseded"
      ? sourceFacts.historicalDecision
      : undefined;
  const candidate = createTrustStatusInternal({
    projectionId: context.projectionId,
    organizationId: sourceFacts.organizationId,
    recordId: sourceFacts.recordId,
    ...(decision
      ? {
          sourceDecisionId: decision.decisionId,
          sourceRevisionId: decision.revisionId,
          sourceAttemptId: decision.attemptId,
          sourceSnapshotId: decision.snapshotId,
          sourceSnapshotFingerprint: decision.snapshotFingerprint,
          sourceDecisionOutcome: decision.outcome,
          sourceDecisionApplicability: applicability?.state,
        }
      : {}),
    status,
    sourceFactsVersion: sourceFacts.sourceFactsVersion,
    deriverVersion: context.deriverVersion,
    derivationAsOf: sourceFacts.derivationAsOf,
    derivedAt: context.derivedAt,
    effectiveFrom,
    ...(sourceFacts.expiryFact
      ? { effectiveUntil: sourceFacts.expiryFact.validUntil }
      : {}),
    ...(sourceFacts.invalidationFact
      ? {
          invalidationFactId:
            sourceFacts.invalidationFact.invalidationFactId,
        }
      : {}),
    ...(historicalDecision
      ? { supersededDecisionId: historicalDecision.decisionId }
      : {}),
    provenanceReference: sourceFacts.provenanceReference,
    correlationId: sourceFacts.correlationId,
    integrityReference: context.integrityReference,
  });

  if (context.existingProjection) {
    if (!isOrganizationVerificationTrustStatus(context.existingProjection)) {
      return trustStatusFailure("conflicting_trust_status_projection");
    }
    const sameSemantics = sameProjectionSemantics(
      context.existingProjection,
      candidate,
    );
    if (context.existingProjection.projectionId === context.projectionId) {
      return sameSemantics
        ? trustStatusSuccess(context.existingProjection)
        : trustStatusFailure("conflicting_trust_status_projection");
    }
    if (sameSemantics) {
      return trustStatusFailure("duplicate_trust_status_projection");
    }
  }

  return trustStatusSuccess(candidate);
}
