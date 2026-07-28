import type {
  SubmittedOfferVerificationSnapshot,
  VerificationPolicyFamily,
  VerificationRuleFinding,
  VerificationRuleId,
} from "../../shared/verification.js";
import { VERIFICATION_RULE_CATALOG } from "./catalog.js";
import {
  VERIFICATION_ENGINE_VERSION,
  type CommercialVerificationPolicy,
  type TechnicalVerificationPolicy,
  type VerificationReferenceData,
} from "./policy.js";

function finding(
  ruleId: VerificationRuleId,
  policyFamily: VerificationPolicyFamily,
  policyVersion: string,
  evaluationOrder: number,
): VerificationRuleFinding {
  const definition = VERIFICATION_RULE_CATALOG[ruleId];
  if (definition.policyFamily !== policyFamily) {
    throw new Error("VERIFICATION_RULE_POLICY_FAMILY_MISMATCH");
  }
  return {
    ruleId,
    reasonCode: definition.reasonCode,
    severity: definition.severity,
    disposition: definition.disposition,
    policyFamily,
    policyVersion,
    evaluationOrder,
  };
}

function isBlank(value: string | null | undefined): boolean {
  return value === null || value === undefined || value.trim().length === 0;
}

function validPositiveDecimal(value: string, pattern: RegExp): boolean {
  return pattern.test(value) && Number(value) > 0;
}

export function runTechnicalValidation(
  snapshot: SubmittedOfferVerificationSnapshot,
  policy: TechnicalVerificationPolicy,
  references: VerificationReferenceData,
  evaluatedAt: Date,
): VerificationRuleFinding[] {
  const findings: VerificationRuleFinding[] = [];
  const version = policy.version;
  let order = 0;
  const emit = (ruleId: VerificationRuleId) => {
    findings.push(finding(ruleId, "technical", version, ++order));
  };

  if (
    isBlank(snapshot.offerId) ||
    !Number.isInteger(snapshot.submissionRevision) ||
    snapshot.submissionRevision <= 0 ||
    isBlank(snapshot.submittedRecordVersion) ||
    isBlank(snapshot.offerType) ||
    isBlank(snapshot.commodity.id) ||
    isBlank(snapshot.commodity.name) ||
    isBlank(snapshot.commodity.category) ||
    isBlank(snapshot.quantity) ||
    isBlank(snapshot.unit) ||
    isBlank(snapshot.amountPerUnit) ||
    isBlank(snapshot.currency) ||
    isBlank(snapshot.location)
  ) {
    emit("TECHNICAL-001");
  }

  if (!policy.allowedOfferTypes.includes(snapshot.offerType)) {
    emit("TECHNICAL-002");
  }

  if (
    isBlank(snapshot.commodity.id) ||
    isBlank(snapshot.commodity.name) ||
    isBlank(snapshot.commodity.category)
  ) {
    emit("TECHNICAL-003");
  }

  if (
    !validPositiveDecimal(
      snapshot.quantity,
      policy.decimalPattern,
    )
  ) {
    emit("TECHNICAL-004");
  }

  if (!references.recognizedUnits.includes(snapshot.unit)) {
    emit("TECHNICAL-005");
  }

  if (
    !validPositiveDecimal(
      snapshot.amountPerUnit,
      policy.decimalPattern,
    )
  ) {
    emit("TECHNICAL-006");
  }

  if (
    snapshot.currency === null ||
    !references.currencyIdentifierPattern.test(snapshot.currency)
  ) {
    emit("TECHNICAL-007");
  }

  if (
    isBlank(snapshot.location) ||
    snapshot.location.trim().length >
      policy.maximumLocationLength
  ) {
    emit("TECHNICAL-008");
  }

  if (snapshot.validUntil !== null) {
    const validUntil = new Date(snapshot.validUntil);
    if (Number.isNaN(validUntil.getTime())) {
      emit("TECHNICAL-009");
    } else if (validUntil.getTime() <= evaluatedAt.getTime()) {
      emit("TECHNICAL-010");
    }
  }

  if (
    snapshot.snapshotSchemaVersion !==
    policy.snapshotSchemaVersion
  ) {
    emit("TECHNICAL-011");
  }

  if (snapshot.lifecycleStatus !== "submitted") {
    const definition = VERIFICATION_RULE_CATALOG["SYSTEM-003"];
    findings.push({
      ruleId: definition.id,
      reasonCode: definition.reasonCode,
      severity: definition.severity,
      disposition: definition.disposition,
      policyFamily: "system",
      policyVersion: VERIFICATION_ENGINE_VERSION,
      evaluationOrder: ++order,
    });
  }

  return findings;
}

export function runCommercialValidation(
  snapshot: SubmittedOfferVerificationSnapshot,
  policy: CommercialVerificationPolicy,
  references: VerificationReferenceData,
  startingOrder: number,
): VerificationRuleFinding[] {
  const findings: VerificationRuleFinding[] = [];
  const version = policy.version;
  let order = startingOrder;
  const emit = (ruleId: VerificationRuleId) => {
    findings.push(finding(ruleId, "commercial", version, ++order));
  };

  const acceptedUnits = policy.unitsForCommodity(snapshot.commodity.name);
  if (acceptedUnits.length === 0) {
    emit("COMMERCIAL-001");
  }

  if (!policy.allowedOfferTypes.includes(snapshot.offerType)) {
    emit("COMMERCIAL-002");
  }

  if (
    references.recognizedUnits.includes(snapshot.unit) &&
    acceptedUnits.length > 0 &&
    !acceptedUnits.includes(snapshot.unit)
  ) {
    emit("COMMERCIAL-014");
  }

  if (
    snapshot.currency !== null &&
    references.currencyIdentifierPattern.test(snapshot.currency) &&
    !policy.allowedCurrencies.includes(snapshot.currency)
  ) {
    emit("COMMERCIAL-015");
  }

  return findings;
}
