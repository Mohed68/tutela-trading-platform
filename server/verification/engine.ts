import type {
  SubmittedOfferVerificationSnapshot,
  VerificationConfidence,
  VerificationDecision,
  VerificationEngineResult,
  VerificationRuleFinding,
  VerificationSystemCondition,
} from "../../shared/verification.js";
import { VERIFICATION_RULE_CATALOG } from "./catalog.js";
import {
  currentVerificationPolicies,
  PHASE_6_REFERENCE_DATA,
  VERIFICATION_CONFIDENCE_MODEL_VERSION,
  VERIFICATION_ENGINE_VERSION,
  type VerificationPolicies,
  type VerificationReferenceData,
} from "./policy.js";
import {
  runCommercialValidation,
  runTechnicalValidation,
} from "./rules.js";
import { fingerprintVerificationSnapshot } from "./snapshot.js";

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

function catalogFinding(
  ruleId: "TECHNICAL-011" | "SYSTEM-001" | "SYSTEM-003" | "SYSTEM-999",
  policyVersion: string,
  evaluationOrder: number,
): VerificationRuleFinding {
  const definition = VERIFICATION_RULE_CATALOG[ruleId];
  return {
    ruleId: definition.id,
    reasonCode: definition.reasonCode,
    severity: definition.severity,
    disposition: definition.disposition,
    policyFamily: definition.policyFamily,
    policyVersion,
    evaluationOrder,
  };
}

export function policyUnavailableVerificationResult(
  snapshot: SubmittedOfferVerificationSnapshot,
  versions: {
    engineVersion: string;
    technicalPolicyVersion: string;
    commercialPolicyVersion: string;
  },
  additionalConditions: readonly VerificationSystemCondition[] = [],
): VerificationEngineResult {
  const findings = systemConditionFindings(
    ["policy_configuration_unavailable", ...additionalConditions],
    versions,
  );
  return {
    decision: decideVerification(findings),
    confidence: confidenceForDecision(decideVerification(findings)),
    confidenceModelVersion: VERIFICATION_CONFIDENCE_MODEL_VERSION,
    engineVersion: versions.engineVersion,
    snapshotSchemaVersion: snapshot.snapshotSchemaVersion,
    technicalPolicyVersion: versions.technicalPolicyVersion,
    commercialPolicyVersion: versions.commercialPolicyVersion,
    findings,
  };
}

function systemConditionFindings(
  conditions: readonly VerificationSystemCondition[],
  versions: {
    readonly engineVersion: string;
    readonly technicalPolicyVersion: string;
  },
  startingOrder = 0,
): VerificationRuleFinding[] {
  const uniqueConditions = [...new Set(conditions)].sort();
  return uniqueConditions.map((condition, index) => {
    if (condition === "snapshot_integrity_mismatch") {
      return catalogFinding(
        "TECHNICAL-011",
        versions.technicalPolicyVersion,
        startingOrder + index + 1,
      );
    }
    if (condition === "offer_state_conflict") {
      return catalogFinding(
        "SYSTEM-003",
        versions.engineVersion,
        startingOrder + index + 1,
      );
    }
    return catalogFinding(
      "SYSTEM-001",
      versions.engineVersion,
      startingOrder + index + 1,
    );
  });
}

export function evaluateVerification(
  snapshot: SubmittedOfferVerificationSnapshot,
  options?: {
    readonly policies?: VerificationPolicies;
    readonly references?: VerificationReferenceData;
    readonly evaluatedAt?: Date;
    readonly systemConditions?: readonly VerificationSystemCondition[];
  },
): VerificationEngineResult {
  const policies = options?.policies ?? currentVerificationPolicies();
  const references = options?.references ?? PHASE_6_REFERENCE_DATA;
  const evaluatedAt = options?.evaluatedAt ?? new Date();
  const systemConditions = options?.systemConditions ?? [];

  try {
    if (systemConditions.includes("snapshot_integrity_mismatch")) {
      const findings = systemConditionFindings(systemConditions, {
        engineVersion: VERIFICATION_ENGINE_VERSION,
        technicalPolicyVersion: policies.technical.version,
      });
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
    }
    const technical = runTechnicalValidation(
      snapshot,
      policies.technical,
      references,
      evaluatedAt,
    );
    const commercial = runCommercialValidation(
      snapshot,
      policies.commercial,
      references,
      technical.length,
    );
    const findings = [
      ...technical,
      ...commercial,
      ...systemConditionFindings(
        systemConditions,
        {
          engineVersion: VERIFICATION_ENGINE_VERSION,
          technicalPolicyVersion: policies.technical.version,
        },
        technical.length + commercial.length,
      ),
    ];
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
    const findings = [
      catalogFinding("SYSTEM-999", VERIFICATION_ENGINE_VERSION, 1),
    ];
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

interface VerificationEngineCompletionPayload {
  readonly attemptId: string;
  readonly inputFingerprint: string;
  readonly systemConditions: readonly VerificationSystemCondition[];
  readonly result: VerificationEngineResult;
}

declare const verificationEngineCompletionBrand: unique symbol;

export interface VerificationEngineCompletion {
  readonly [verificationEngineCompletionBrand]: true;
}

const engineCompletionPayloads =
  new WeakMap<object, VerificationEngineCompletionPayload>();

function immutableEngineResult(
  result: VerificationEngineResult,
): VerificationEngineResult {
  return Object.freeze({
    ...result,
    findings: Object.freeze(
      result.findings.map((finding) => Object.freeze({ ...finding })),
    ),
  });
}

export function evaluateClaimedVerification(request: {
  readonly attemptId: string;
  readonly snapshot: SubmittedOfferVerificationSnapshot;
  readonly recordedVersions: {
    readonly engineVersion: string;
    readonly technicalPolicyVersion: string;
    readonly commercialPolicyVersion: string;
  };
  readonly policies: VerificationPolicies | undefined;
  readonly systemConditions?: readonly VerificationSystemCondition[];
  readonly evaluatedAt?: Date;
}): VerificationEngineCompletion {
  const conditions = Object.freeze(
    [...new Set(request.systemConditions ?? [])].sort(),
  );
  const result = request.policies
    ? evaluateVerification(request.snapshot, {
        policies: request.policies,
        evaluatedAt: request.evaluatedAt,
        systemConditions: conditions,
      })
    : policyUnavailableVerificationResult(
        request.snapshot,
        request.recordedVersions,
        conditions,
      );
  const completion = Object.freeze({});
  engineCompletionPayloads.set(completion, {
    attemptId: request.attemptId,
    inputFingerprint: fingerprintVerificationSnapshot(request.snapshot),
    systemConditions: conditions,
    result: immutableEngineResult(result),
  });
  return completion as VerificationEngineCompletion;
}

export function readVerificationEngineCompletion(
  completion: VerificationEngineCompletion,
): VerificationEngineCompletionPayload {
  const payload = engineCompletionPayloads.get(completion as object);
  if (!payload) {
    throw new Error("VERIFICATION_ENGINE_COMPLETION_REQUIRED");
  }
  return payload;
}
