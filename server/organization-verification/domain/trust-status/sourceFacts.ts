import type { OrganizationId } from "../../../organization-registry/index.js";
import {
  ORGANIZATION_VERIFICATION_DECISION_OUTCOMES,
  isOrganizationVerificationDecision,
  type DecisionEngineVersion,
  type OrganizationVerificationDecision,
  type OrganizationVerificationDecisionId,
  type OrganizationVerificationDecisionOutcome,
} from "../decision/index.js";
import type {
  CorrelationId,
  OrganizationVerificationAttemptId,
  OrganizationVerificationRecordId,
  OrganizationVerificationRevisionId,
  SnapshotFingerprint,
  SnapshotId,
} from "../ids.js";
import {
  readDecisionApplicability,
  type OrganizationVerificationDecisionApplicability,
} from "./applicability.js";
import {
  trustStatusFailure,
  trustStatusSuccess,
  type TrustStatusDomainResult,
  type TrustStatusDomainFailureCode,
} from "./errors.js";
import {
  readOrganizationVerificationExpiryFact,
  type OrganizationVerificationExpiryFact,
} from "./expiryFact.js";
import type {
  TrustStatusIntegrityReference,
  TrustStatusProvenanceReference,
  TrustStatusSourceFactsVersion,
} from "./ids.js";
import { TRUST_STATUS_SOURCE_FACTS_VERSION } from "./ids.js";
import {
  readOrganizationVerificationInvalidationFact,
  type OrganizationVerificationInvalidationFact,
} from "./invalidationFact.js";

export interface OrganizationVerificationDecisionSourceFact {
  readonly decisionId: OrganizationVerificationDecisionId;
  readonly recordId: OrganizationVerificationRecordId;
  readonly revisionId: OrganizationVerificationRevisionId;
  readonly attemptId: OrganizationVerificationAttemptId;
  readonly organizationId: OrganizationId;
  readonly snapshotId: SnapshotId;
  readonly snapshotFingerprint: SnapshotFingerprint;
  readonly outcome: OrganizationVerificationDecisionOutcome;
  readonly decisionEngineVersion: DecisionEngineVersion;
  readonly decidedAt: string;
  readonly supersedesDecisionId?: OrganizationVerificationDecisionId;
}

export interface OrganizationVerificationTrustStatusSourceFactsInput {
  readonly sourceFactsVersion: TrustStatusSourceFactsVersion;
  readonly sourceFactsComplete: boolean;
  readonly sourceFactsIntegrityValid: boolean;
  readonly organizationId: OrganizationId;
  readonly recordId: OrganizationVerificationRecordId;
  readonly currentVerificationRevisionId?: OrganizationVerificationRevisionId;
  readonly authoritativeDecisionId?: OrganizationVerificationDecisionId;
  readonly authoritativeAttemptId?: OrganizationVerificationAttemptId;
  readonly authoritativeSnapshotId?: SnapshotId;
  readonly authoritativeSnapshotFingerprint?: SnapshotFingerprint;
  readonly decision?: OrganizationVerificationDecision;
  readonly decisionApplicability?: OrganizationVerificationDecisionApplicability;
  readonly supersedingDecision?: OrganizationVerificationDecision;
  readonly supersedingDecisionApplicability?: OrganizationVerificationDecisionApplicability;
  readonly expiryFact?: OrganizationVerificationExpiryFact;
  readonly invalidationFact?: OrganizationVerificationInvalidationFact;
  readonly derivationAsOf: string;
  readonly provenanceReference: TrustStatusProvenanceReference;
  readonly correlationId: CorrelationId;
  readonly integrityReference: TrustStatusIntegrityReference;
}

const sourceFactsSeal: unique symbol = Symbol(
  "organization_verification_trust_status_source_facts",
);

export interface OrganizationVerificationTrustStatusSourceFacts {
  readonly sourceFactsVersion: TrustStatusSourceFactsVersion;
  readonly organizationId: OrganizationId;
  readonly recordId: OrganizationVerificationRecordId;
  readonly currentVerificationRevisionId?: OrganizationVerificationRevisionId;
  readonly historicalDecision?: OrganizationVerificationDecisionSourceFact;
  readonly historicalDecisionApplicability?: OrganizationVerificationDecisionApplicability;
  readonly authoritativeDecision?: OrganizationVerificationDecisionSourceFact;
  readonly authoritativeDecisionApplicability?: OrganizationVerificationDecisionApplicability;
  readonly expiryFact?: OrganizationVerificationExpiryFact;
  readonly invalidationFact?: OrganizationVerificationInvalidationFact;
  readonly derivationAsOf: string;
  readonly provenanceReference: TrustStatusProvenanceReference;
  readonly correlationId: CorrelationId;
  readonly integrityReference: TrustStatusIntegrityReference;
  readonly [sourceFactsSeal]: true;
}

function validOpaque(value: unknown): boolean {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    !["latest", "current", "head"].includes(value.trim().toLowerCase())
  );
}

function copyDecision(
  decision: OrganizationVerificationDecision,
): OrganizationVerificationDecisionSourceFact {
  return Object.freeze({
    decisionId: decision.decisionId,
    recordId: decision.recordId,
    revisionId: decision.revisionId,
    attemptId: decision.attemptId,
    organizationId: decision.organizationId,
    snapshotId: decision.snapshotId,
    snapshotFingerprint: decision.snapshotFingerprint,
    outcome: decision.outcome,
    decisionEngineVersion: decision.decisionEngineVersion,
    decidedAt: decision.decidedAt,
    ...(decision.supersedesDecisionId
      ? { supersedesDecisionId: decision.supersedesDecisionId }
      : {}),
  });
}

function validateDecisionIdentity(
  decision: OrganizationVerificationDecision,
  organizationId: OrganizationId,
  recordId: OrganizationVerificationRecordId,
): TrustStatusDomainFailureCode | undefined {
  if (decision.organizationId !== organizationId) {
    return "organization_id_mismatch";
  }
  if (decision.recordId !== recordId) {
    return "verification_record_id_mismatch";
  }
  if (
    !ORGANIZATION_VERIFICATION_DECISION_OUTCOMES.includes(decision.outcome)
  ) {
    return "unsupported_decision_outcome";
  }
  return undefined;
}

export function createOrganizationVerificationTrustStatusSourceFacts(
  input: OrganizationVerificationTrustStatusSourceFactsInput,
): TrustStatusDomainResult<OrganizationVerificationTrustStatusSourceFacts> {
  if (typeof input !== "object" || input === null) {
    return trustStatusFailure("trust_source_facts_incomplete");
  }
  if (
    typeof input.sourceFactsComplete !== "boolean" ||
    input.sourceFactsComplete !== true
  ) {
    return trustStatusFailure("trust_source_facts_incomplete");
  }
  if (
    typeof input.sourceFactsIntegrityValid !== "boolean" ||
    input.sourceFactsIntegrityValid !== true
  ) {
    return trustStatusFailure("trust_source_facts_integrity_invalid");
  }
  if (input.sourceFactsVersion !== TRUST_STATUS_SOURCE_FACTS_VERSION) {
    return trustStatusFailure("unsupported_trust_source_facts_version");
  }
  if (
    !validOpaque(input.organizationId) ||
    !validOpaque(input.recordId) ||
    !validOpaque(input.provenanceReference) ||
    !validOpaque(input.correlationId) ||
    !validOpaque(input.integrityReference) ||
    (input.currentVerificationRevisionId !== undefined &&
      !validOpaque(input.currentVerificationRevisionId)) ||
    !Number.isFinite(Date.parse(input.derivationAsOf))
  ) {
    return trustStatusFailure("trust_source_facts_incomplete");
  }

  if (!input.decision) {
    if (
      input.decisionApplicability ||
      input.authoritativeDecisionId ||
      input.authoritativeAttemptId ||
      input.authoritativeSnapshotId ||
      input.authoritativeSnapshotFingerprint ||
      input.supersedingDecision ||
      input.supersedingDecisionApplicability ||
      input.expiryFact ||
      input.invalidationFact
    ) {
      return trustStatusFailure("trust_source_facts_incomplete");
    }
    return trustStatusSuccess(
      Object.freeze({
        sourceFactsVersion: input.sourceFactsVersion,
        organizationId: input.organizationId,
        recordId: input.recordId,
        ...(input.currentVerificationRevisionId
          ? {
              currentVerificationRevisionId:
                input.currentVerificationRevisionId,
            }
          : {}),
        derivationAsOf: input.derivationAsOf,
        provenanceReference: input.provenanceReference,
        correlationId: input.correlationId,
        integrityReference: input.integrityReference,
        [sourceFactsSeal]: true as const,
      }),
    );
  }

  if (!isOrganizationVerificationDecision(input.decision)) {
    return trustStatusFailure("trust_source_facts_integrity_invalid");
  }
  const primaryIdentityFailure = validateDecisionIdentity(
    input.decision,
    input.organizationId,
    input.recordId,
  );
  if (primaryIdentityFailure) {
    return trustStatusFailure(primaryIdentityFailure);
  }
  let primaryApplicability: OrganizationVerificationDecisionApplicability;
  try {
    primaryApplicability = readDecisionApplicability(
      input.decisionApplicability as OrganizationVerificationDecisionApplicability,
    );
  } catch {
    return trustStatusFailure("invalid_decision_applicability");
  }
  if (primaryApplicability.decisionId !== input.decision.decisionId) {
    return trustStatusFailure("decision_id_mismatch");
  }
  if (
    Date.parse(primaryApplicability.effectiveAt) <
      Date.parse(input.decision.decidedAt) ||
    Date.parse(primaryApplicability.effectiveAt) >
      Date.parse(input.derivationAsOf)
  ) {
    return trustStatusFailure("invalid_derivation_timestamp");
  }

  let authoritativeDecision = input.decision;
  let authoritativeApplicability = primaryApplicability;
  if (primaryApplicability.state === "superseded") {
    if (!input.supersedingDecision || !input.supersedingDecisionApplicability) {
      return trustStatusFailure("superseding_decision_missing");
    }
    if (
      !isOrganizationVerificationDecision(input.supersedingDecision) ||
      primaryApplicability.supersedingDecisionId !==
        input.supersedingDecision.decisionId
    ) {
      return trustStatusFailure("superseding_decision_mismatch");
    }
    const supersedingIdentityFailure = validateDecisionIdentity(
      input.supersedingDecision,
      input.organizationId,
      input.recordId,
    );
    if (supersedingIdentityFailure) {
      return trustStatusFailure(supersedingIdentityFailure);
    }
    if (
      input.supersedingDecision.supersedesDecisionId !== undefined &&
      input.supersedingDecision.supersedesDecisionId !==
        input.decision.decisionId
    ) {
      return trustStatusFailure("superseding_decision_mismatch");
    }
    try {
      authoritativeApplicability = readDecisionApplicability(
        input.supersedingDecisionApplicability,
      );
    } catch {
      return trustStatusFailure("invalid_decision_applicability");
    }
    if (
      authoritativeApplicability.decisionId !==
        input.supersedingDecision.decisionId ||
      authoritativeApplicability.state === "superseded"
    ) {
      return trustStatusFailure("superseding_decision_mismatch");
    }
    authoritativeDecision = input.supersedingDecision;
  } else if (
    input.supersedingDecision ||
    input.supersedingDecisionApplicability
  ) {
    return trustStatusFailure("contradictory_decision_applicability");
  }

  if (!input.currentVerificationRevisionId) {
    return trustStatusFailure("trust_source_facts_incomplete");
  }
  if (
    input.currentVerificationRevisionId !== authoritativeDecision.revisionId
  ) {
    return trustStatusFailure("verification_revision_id_mismatch");
  }
  if (input.authoritativeDecisionId !== authoritativeDecision.decisionId) {
    return trustStatusFailure("decision_id_mismatch");
  }
  if (input.authoritativeAttemptId !== authoritativeDecision.attemptId) {
    return trustStatusFailure("attempt_id_mismatch");
  }
  if (input.authoritativeSnapshotId !== authoritativeDecision.snapshotId) {
    return trustStatusFailure("snapshot_id_mismatch");
  }
  if (
    input.authoritativeSnapshotFingerprint !==
    authoritativeDecision.snapshotFingerprint
  ) {
    return trustStatusFailure("snapshot_fingerprint_mismatch");
  }
  if (
    Date.parse(authoritativeDecision.decidedAt) >
      Date.parse(input.derivationAsOf) ||
    Date.parse(authoritativeApplicability.effectiveAt) >
      Date.parse(input.derivationAsOf) ||
    Date.parse(authoritativeApplicability.effectiveAt) <
      Date.parse(authoritativeDecision.decidedAt)
  ) {
    return trustStatusFailure("invalid_derivation_timestamp");
  }

  let expiryFact: OrganizationVerificationExpiryFact | undefined;
  if (input.expiryFact) {
    try {
      expiryFact = readOrganizationVerificationExpiryFact(input.expiryFact);
    } catch {
      return trustStatusFailure("invalid_expiry_fact");
    }
    if (expiryFact.decisionId !== authoritativeDecision.decisionId) {
      return trustStatusFailure("decision_id_mismatch");
    }
    if (
      Date.parse(expiryFact.validUntil) <=
        Date.parse(authoritativeDecision.decidedAt) ||
      Date.parse(expiryFact.recordedAt) <
        Date.parse(authoritativeDecision.decidedAt) ||
      Date.parse(expiryFact.recordedAt) > Date.parse(input.derivationAsOf)
    ) {
      return trustStatusFailure("invalid_expiry_fact");
    }
  }
  if (
    authoritativeApplicability.state === "expired" &&
    expiryFact === undefined
  ) {
    return trustStatusFailure("missing_expiry_boundary");
  }
  if (
    authoritativeApplicability.state === "expired" &&
    expiryFact &&
    Date.parse(input.derivationAsOf) < Date.parse(expiryFact.validUntil)
  ) {
    return trustStatusFailure("invalid_expiry_fact");
  }

  let invalidationFact:
    | OrganizationVerificationInvalidationFact
    | undefined;
  if (input.invalidationFact) {
    try {
      invalidationFact =
        readOrganizationVerificationInvalidationFact(input.invalidationFact);
    } catch {
      return trustStatusFailure("invalid_invalidation_fact");
    }
    if (
      invalidationFact.decisionId !== authoritativeDecision.decisionId ||
      invalidationFact.organizationId !== input.organizationId ||
      invalidationFact.recordId !== input.recordId
    ) {
      return trustStatusFailure("invalidation_reference_mismatch");
    }
    if (
      Date.parse(invalidationFact.invalidatedAt) <
        Date.parse(authoritativeDecision.decidedAt) ||
      Date.parse(invalidationFact.invalidatedAt) >
        Date.parse(input.derivationAsOf)
    ) {
      return trustStatusFailure("invalid_invalidation_fact");
    }
  }
  if (
    authoritativeApplicability.state === "invalidated" &&
    invalidationFact === undefined
  ) {
    return trustStatusFailure("invalid_invalidation_fact");
  }

  return trustStatusSuccess(
    Object.freeze({
      sourceFactsVersion: input.sourceFactsVersion,
      organizationId: input.organizationId,
      recordId: input.recordId,
      currentVerificationRevisionId: input.currentVerificationRevisionId,
      historicalDecision: copyDecision(input.decision),
      historicalDecisionApplicability: primaryApplicability,
      authoritativeDecision: copyDecision(authoritativeDecision),
      authoritativeDecisionApplicability: authoritativeApplicability,
      ...(expiryFact ? { expiryFact } : {}),
      ...(invalidationFact ? { invalidationFact } : {}),
      derivationAsOf: input.derivationAsOf,
      provenanceReference: input.provenanceReference,
      correlationId: input.correlationId,
      integrityReference: input.integrityReference,
      [sourceFactsSeal]: true as const,
    }),
  );
}

export function readOrganizationVerificationTrustStatusSourceFacts(
  input: OrganizationVerificationTrustStatusSourceFacts,
): OrganizationVerificationTrustStatusSourceFacts {
  if (
    typeof input !== "object" ||
    input === null ||
    input[sourceFactsSeal] !== true ||
    !Object.isFrozen(input) ||
    (input.historicalDecision !== undefined &&
      !Object.isFrozen(input.historicalDecision)) ||
    (input.authoritativeDecision !== undefined &&
      !Object.isFrozen(input.authoritativeDecision))
  ) {
    throw new TypeError("SEALED_TRUST_STATUS_SOURCE_FACTS_REQUIRED");
  }
  return input;
}
