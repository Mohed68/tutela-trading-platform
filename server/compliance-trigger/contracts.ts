import { createHash } from "node:crypto";

export const COMPLIANCE_TRIGGER_POLICY_VERSION =
  "trigger-based-compliance/v1" as const;

export type ComplianceTriggerOutcome =
  | "not_required"
  | "required"
  | "requires_review";

export type ComplianceTriggerReasonCode =
  | "explicit_requirement"
  | "explicit_risk_flag"
  | "explicitly_not_required"
  | "requirement_context_incomplete";

export interface ComplianceTriggerContext {
  readonly evaluationId: string;
  readonly organizationId: string;
  readonly organizationType: string | null;
  readonly jurisdiction: string | null;
  readonly commodityClassification: string | null;
  readonly transactionValueContext: string | null;
  readonly legalOrCommercialRequirement:
    | "required"
    | "not_required"
    | "unknown";
  readonly explicitRiskFlags: readonly Readonly<{
    code: string;
    requiresCompliance: boolean;
  }>[];
  readonly evaluatedAt: string;
}

export interface ComplianceTriggerResult {
  readonly policyVersion: typeof COMPLIANCE_TRIGGER_POLICY_VERSION;
  readonly evaluationId: string;
  readonly organizationId: string;
  readonly outcome: ComplianceTriggerOutcome;
  readonly reasonCodes: readonly ComplianceTriggerReasonCode[];
  readonly manualReviewRequired: boolean;
  readonly externalProviderRequired: false;
  readonly triggerFingerprint: string;
}

const authenticResults = new WeakSet<object>();

function identity(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function evaluateComplianceTrigger(
  context: ComplianceTriggerContext,
): ComplianceTriggerResult | undefined {
  if (
    !identity(context.evaluationId) ||
    !identity(context.organizationId) ||
    !Number.isFinite(Date.parse(context.evaluatedAt)) ||
    context.explicitRiskFlags.some((flag) => !identity(flag.code))
  ) {
    return undefined;
  }
  const riskRequired = context.explicitRiskFlags.some(
    (flag) => flag.requiresCompliance,
  );
  let outcome: ComplianceTriggerOutcome;
  let reasons: readonly ComplianceTriggerReasonCode[];
  if (
    context.legalOrCommercialRequirement === "required" ||
    riskRequired
  ) {
    outcome = "required";
    reasons = Object.freeze([
      ...(context.legalOrCommercialRequirement === "required"
        ? (["explicit_requirement"] as const)
        : []),
      ...(riskRequired ? (["explicit_risk_flag"] as const) : []),
    ]);
  } else if (context.legalOrCommercialRequirement === "not_required") {
    outcome = "not_required";
    reasons = Object.freeze(["explicitly_not_required"]);
  } else {
    outcome = "requires_review";
    reasons = Object.freeze(["requirement_context_incomplete"]);
  }
  const unsigned = {
    policyVersion: COMPLIANCE_TRIGGER_POLICY_VERSION,
    evaluationId: context.evaluationId,
    organizationId: context.organizationId,
    outcome,
    reasonCodes: reasons,
    manualReviewRequired: outcome !== "not_required",
    externalProviderRequired: false as const,
  };
  const result = Object.freeze({
    ...unsigned,
    triggerFingerprint: `sha256:${createHash("sha256")
      .update(
        JSON.stringify({
          context: {
            ...context,
            explicitRiskFlags: [...context.explicitRiskFlags].sort((left, right) =>
              left.code.localeCompare(right.code),
            ),
          },
          result: unsigned,
        }),
      )
      .digest("hex")}`,
  });
  authenticResults.add(result);
  return result;
}

export function isComplianceTriggerResult(
  value: unknown,
): value is ComplianceTriggerResult {
  return (
    typeof value === "object" &&
    value !== null &&
    authenticResults.has(value) &&
    Object.isFrozen(value)
  );
}
