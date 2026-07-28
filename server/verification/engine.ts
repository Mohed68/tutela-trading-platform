import type {
  SubmittedOfferVerificationSnapshot,
  VerificationConfidence,
  VerificationDecision,
  VerificationEngineResult,
  VerificationRuleFinding,
} from "../../shared/verification.js";
import { VERIFICATION_RULE_CATALOG } from "./catalog.js";
import {
  currentVerificationPolicies,
  VERIFICATION_CONFIDENCE_MODEL_VERSION,
  VERIFICATION_ENGINE_VERSION,
  type VerificationPolicies,
} from "./policy.js";
import {
  runCommercialValidation,
  runTechnicalValidation,
} from "./rules.js";

export function decideVerification(
  findings: readonly VerificationRuleFinding[],
): VerificationDecision {
  if (
    findings.some(
      (finding) => finding.disposition === "requires_platform_review",
    )
  ) {
    return "manual_review";
  }
  return findings.length > 0 ? "revision_required" : "approved";
}

export function confidenceForDecision(
  decision: VerificationDecision,
): VerificationConfidence {
  return decision === "manual_review" ? "LOW" : "HIGH";
}

function systemFailureFinding(): VerificationRuleFinding {
  const definition = VERIFICATION_RULE_CATALOG["SYSTEM-999"];
  return {
    ruleId: definition.id,
    reasonCode: definition.reasonCode,
    severity: definition.severity,
    disposition: definition.disposition,
    policyFamily: definition.policyFamily,
    policyVersion: VERIFICATION_ENGINE_VERSION,
    evaluationOrder: 1,
  };
}

export function policyUnavailableVerificationResult(
  snapshot: SubmittedOfferVerificationSnapshot,
  versions: {
    engineVersion: string;
    technicalPolicyVersion: string;
    commercialPolicyVersion: string;
  },
): VerificationEngineResult {
  const definition = VERIFICATION_RULE_CATALOG["SYSTEM-001"];
  return {
    decision: "manual_review",
    confidence: "LOW",
    confidenceModelVersion: VERIFICATION_CONFIDENCE_MODEL_VERSION,
    engineVersion: versions.engineVersion,
    snapshotSchemaVersion: snapshot.snapshotSchemaVersion,
    technicalPolicyVersion: versions.technicalPolicyVersion,
    commercialPolicyVersion: versions.commercialPolicyVersion,
    findings: [
      {
        ruleId: definition.id,
        reasonCode: definition.reasonCode,
        severity: definition.severity,
        disposition: definition.disposition,
        policyFamily: definition.policyFamily,
        policyVersion: versions.engineVersion,
        evaluationOrder: 1,
      },
    ],
  };
}

export function evaluateVerification(
  snapshot: SubmittedOfferVerificationSnapshot,
  options?: {
    policies?: VerificationPolicies;
    evaluatedAt?: Date;
  },
): VerificationEngineResult {
  const policies = options?.policies ?? currentVerificationPolicies();
  const evaluatedAt = options?.evaluatedAt ?? new Date();

  try {
    const technical = runTechnicalValidation(
      snapshot,
      policies,
      evaluatedAt,
    );
    const commercial = runCommercialValidation(
      snapshot,
      policies,
      technical.length,
    );
    const findings = [...technical, ...commercial];
    const decision = decideVerification(findings);

    return {
      decision,
      confidence: confidenceForDecision(decision),
      confidenceModelVersion: VERIFICATION_CONFIDENCE_MODEL_VERSION,
      engineVersion: VERIFICATION_ENGINE_VERSION,
      snapshotSchemaVersion: snapshot.snapshotSchemaVersion,
      technicalPolicyVersion: policies.technical.version,
      commercialPolicyVersion: policies.commercial.version,
      findings,
    };
  } catch {
    const findings = [systemFailureFinding()];
    return {
      decision: "manual_review",
      confidence: "LOW",
      confidenceModelVersion: VERIFICATION_CONFIDENCE_MODEL_VERSION,
      engineVersion: VERIFICATION_ENGINE_VERSION,
      snapshotSchemaVersion: snapshot.snapshotSchemaVersion,
      technicalPolicyVersion: policies.technical.version,
      commercialPolicyVersion: policies.commercial.version,
      findings,
    };
  }
}
