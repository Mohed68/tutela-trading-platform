import {
  isProviderEvidenceEnvelope,
  type ProviderEvidenceEnvelope,
} from "../evidence-provider/index.js";
import {
  createActivityEligibilityResultInternal,
  isActivityEligibilityRequest,
  type ActivityEligibilityReasonCode,
  type ActivityEligibilityRequest,
  type ActivityEligibilityResult,
} from "./contracts.js";

export const MINIMUM_TRADE_ACTIVITY_POLICY_VERSION =
  "minimum-trade-activity-policy/v1" as const;

export interface MinimumTradeActivityEligibilityService {
  evaluate(input: Readonly<{
    request: ActivityEligibilityRequest;
    evidence: readonly ProviderEvidenceEnvelope[];
  }>): ActivityEligibilityResult | undefined;
}

type Assessment = Readonly<{
  outcome: "eligible" | "ineligible" | "requires_review";
  reasons: readonly ActivityEligibilityReasonCode[];
}>;

function assessment(
  outcome: Assessment["outcome"],
  reasons: readonly ActivityEligibilityReasonCode[],
): Assessment {
  return Object.freeze({ outcome, reasons: Object.freeze([...reasons]) });
}

function assertionValues(
  evidence: readonly ProviderEvidenceEnvelope[],
  code: string,
): readonly string[] {
  return evidence.flatMap((item) =>
    item.assertions
      .filter((assertion) => assertion.assertionCode === code)
      .map((assertion) => assertion.value),
  );
}

function assess(
  request: ActivityEligibilityRequest,
  evidence: readonly ProviderEvidenceEnvelope[],
): Assessment {
  const activityCodes = assertionValues(evidence, "organization.activity_code");
  if (activityCodes.length === 0) {
    return assessment("requires_review", ["activity_evidence_unavailable"]);
  }
  if (!activityCodes.includes(request.context.activityCode)) {
    return assessment("ineligible", ["activity_context_not_matched"]);
  }

  const reasons: ActivityEligibilityReasonCode[] = [];
  const commodity = request.context.commodity;
  if (commodity) {
    const commodityIds = assertionValues(evidence, "activity.commodity_id");
    if (commodityIds.length === 0) {
      reasons.push("commodity_context_requires_review");
    } else if (!commodityIds.includes(commodity.commodityId)) {
      return assessment("ineligible", ["commodity_context_not_matched"]);
    }
    if (commodity.commodityClassification) {
      const classifications = assertionValues(
        evidence,
        "activity.commodity_classification",
      );
      if (classifications.length === 0) {
        reasons.push("commodity_context_requires_review");
      } else if (!classifications.includes(commodity.commodityClassification)) {
        return assessment("ineligible", ["commodity_context_not_matched"]);
      }
    }
    if (commodity.jurisdiction) {
      const jurisdictions = assertionValues(
        evidence,
        "activity.jurisdiction",
      );
      if (jurisdictions.length === 0) {
        reasons.push("jurisdiction_context_requires_review");
      } else if (!jurisdictions.includes(commodity.jurisdiction)) {
        return assessment("ineligible", ["jurisdiction_context_not_matched"]);
      }
    }
  }
  return reasons.length > 0
    ? assessment("requires_review", [...new Set(reasons)].sort())
    : assessment("eligible", ["activity_context_matched"]);
}

export function createMinimumTradeActivityEligibilityService(): MinimumTradeActivityEligibilityService {
  return Object.freeze({
    evaluate({ request, evidence }: Readonly<{
      request: ActivityEligibilityRequest;
      evidence: readonly ProviderEvidenceEnvelope[];
    }>) {
      if (!isActivityEligibilityRequest(request)) return undefined;
      if (
        evidence.some(
          (item) =>
            !isProviderEvidenceEnvelope(item) ||
            item.providerKind !== "platform_submitted" ||
            item.assuranceLevel !== "documentary" ||
            item.subject.subjectKind !== "organization" ||
            item.subject.subjectId !== request.organizationId ||
            item.subject.subjectVersion !== request.context.contextVersion,
        )
      ) {
        return createActivityEligibilityResultInternal({
          request,
          policyVersion: MINIMUM_TRADE_ACTIVITY_POLICY_VERSION,
          outcome: "requires_review",
          reasonCodes: ["activity_evidence_integrity_failure"],
          evidenceReferences: [],
        });
      }
      const assessment = assess(request, evidence);
      return createActivityEligibilityResultInternal({
        request,
        policyVersion: MINIMUM_TRADE_ACTIVITY_POLICY_VERSION,
        outcome: assessment.outcome,
        reasonCodes: assessment.reasons,
        evidenceReferences: evidence.map((item) => ({
          evidenceId: item.evidenceId,
          evidenceVersion: item.evidenceVersion,
          assuranceLevel: item.assuranceLevel,
          integrityReference: item.integrityReference,
        })),
      });
    },
  });
}
