import { createHash } from "node:crypto";

export const ACTIVITY_ELIGIBILITY_CONTRACT_VERSION =
  "activity-eligibility/v1" as const;

export const ACTIVITY_ELIGIBILITY_OUTCOMES = [
  "eligible",
  "ineligible",
  "requires_review",
] as const;

export const ACTIVITY_ELIGIBILITY_REASON_CODES = [
  "activity_context_matched",
  "activity_context_not_matched",
  "activity_context_requires_review",
  "activity_evidence_unavailable",
  "activity_evidence_integrity_failure",
  "commodity_context_not_matched",
  "commodity_context_requires_review",
  "jurisdiction_context_not_matched",
  "jurisdiction_context_requires_review",
  "activity_policy_unavailable",
  "activity_scope_mismatch",
] as const;

export type ActivityEligibilityOutcome =
  (typeof ACTIVITY_ELIGIBILITY_OUTCOMES)[number];
export type ActivityEligibilityReasonCode =
  (typeof ACTIVITY_ELIGIBILITY_REASON_CODES)[number];

export interface ActivityCommodityContext {
  readonly commodityId: string;
  readonly commodityClassification: string | null;
  readonly jurisdiction: string | null;
}

export interface ActivityEligibilityContext {
  readonly activityCode: string;
  readonly contextVersion: string;
  readonly commodity: ActivityCommodityContext | null;
}

export interface CreateActivityEligibilityRequestInput {
  readonly evaluationId: string;
  readonly organizationId: string;
  readonly context: ActivityEligibilityContext;
  readonly evaluatedAt: string;
}

export interface ActivityEligibilityRequest
  extends Readonly<CreateActivityEligibilityRequestInput> {
  readonly requestFingerprint: string;
}

export type ActivityEligibilityRequestCreationResult =
  | Readonly<{ ok: true; value: ActivityEligibilityRequest }>
  | Readonly<{
      ok: false;
      code: "invalid_activity_eligibility_request";
    }>;

export interface ActivityEligibilityEvidenceReference {
  readonly evidenceId: string;
  readonly evidenceVersion: string;
  readonly assuranceLevel:
    | "documentary"
    | "source_confirmed"
    | "independently_inspected";
  readonly integrityReference: string;
}

export interface ActivityEligibilityResult {
  readonly contractVersion: typeof ACTIVITY_ELIGIBILITY_CONTRACT_VERSION;
  readonly evaluationId: string;
  readonly requestFingerprint: string;
  readonly organizationId: string;
  readonly context: ActivityEligibilityContext;
  readonly policyVersion: string;
  readonly outcome: ActivityEligibilityOutcome;
  readonly reasonCodes: readonly ActivityEligibilityReasonCode[];
  readonly evidenceReferences: readonly ActivityEligibilityEvidenceReference[];
  readonly evaluatedAt: string;
  readonly eligibilityFingerprint: string;
}

const authenticRequests = new WeakSet<object>();
const authenticResults = new WeakSet<object>();

function identity(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    !["latest", "current", "head", "default"].includes(
      value.trim().toLowerCase(),
    )
  );
}

function fingerprint(value: unknown): string {
  return `sha256:${createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex")}`;
}

function validContext(value: unknown): value is ActivityEligibilityContext {
  if (typeof value !== "object" || value === null) return false;
  const context = value as Partial<ActivityEligibilityContext>;
  if (!identity(context.activityCode) || !identity(context.contextVersion)) {
    return false;
  }
  if (context.commodity === null) return true;
  if (typeof context.commodity !== "object" || context.commodity === null) {
    return false;
  }
  return (
    identity(context.commodity.commodityId) &&
    (context.commodity.commodityClassification === null ||
      identity(context.commodity.commodityClassification)) &&
    (context.commodity.jurisdiction === null ||
      identity(context.commodity.jurisdiction))
  );
}

function frozenContext(
  context: ActivityEligibilityContext,
): ActivityEligibilityContext {
  return Object.freeze({
    activityCode: context.activityCode,
    contextVersion: context.contextVersion,
    commodity: context.commodity
      ? Object.freeze({ ...context.commodity })
      : null,
  });
}

export function createActivityEligibilityRequest(
  input: CreateActivityEligibilityRequestInput,
): ActivityEligibilityRequestCreationResult {
  if (
    !identity(input.evaluationId) ||
    !identity(input.organizationId) ||
    !validContext(input.context) ||
    !Number.isFinite(Date.parse(input.evaluatedAt))
  ) {
    return Object.freeze({
      ok: false,
      code: "invalid_activity_eligibility_request",
    });
  }
  const context = frozenContext(input.context);
  const request: ActivityEligibilityRequest = Object.freeze({
    evaluationId: input.evaluationId,
    organizationId: input.organizationId,
    context,
    evaluatedAt: input.evaluatedAt,
    requestFingerprint: fingerprint({
      scope: ACTIVITY_ELIGIBILITY_CONTRACT_VERSION,
      evaluationId: input.evaluationId,
      organizationId: input.organizationId,
      context,
      evaluatedAt: input.evaluatedAt,
    }),
  });
  authenticRequests.add(request);
  return Object.freeze({ ok: true, value: request });
}

export function isActivityEligibilityRequest(
  value: unknown,
): value is ActivityEligibilityRequest {
  return (
    typeof value === "object" &&
    value !== null &&
    authenticRequests.has(value) &&
    Object.isFrozen(value)
  );
}

export function createActivityEligibilityResultInternal(input: Readonly<{
  request: ActivityEligibilityRequest;
  policyVersion: string;
  outcome: ActivityEligibilityOutcome;
  reasonCodes: readonly ActivityEligibilityReasonCode[];
  evidenceReferences: readonly ActivityEligibilityEvidenceReference[];
}>): ActivityEligibilityResult | undefined {
  if (
    !isActivityEligibilityRequest(input.request) ||
    !identity(input.policyVersion) ||
    !ACTIVITY_ELIGIBILITY_OUTCOMES.includes(input.outcome) ||
    input.reasonCodes.some(
      (reason) => !ACTIVITY_ELIGIBILITY_REASON_CODES.includes(reason),
    ) ||
    input.evidenceReferences.some(
      (reference) =>
        !identity(reference.evidenceId) ||
        !identity(reference.evidenceVersion) ||
        !identity(reference.integrityReference),
    )
  ) {
    return undefined;
  }
  const context = frozenContext(input.request.context);
  const reasonCodes = Object.freeze([...new Set(input.reasonCodes)].sort());
  const evidenceReferences = Object.freeze(
    input.evidenceReferences
      .map((reference) => Object.freeze({ ...reference }))
      .sort((left, right) => left.evidenceId.localeCompare(right.evidenceId)),
  );
  const unsigned = {
    contractVersion: ACTIVITY_ELIGIBILITY_CONTRACT_VERSION,
    evaluationId: input.request.evaluationId,
    requestFingerprint: input.request.requestFingerprint,
    organizationId: input.request.organizationId,
    context,
    policyVersion: input.policyVersion,
    outcome: input.outcome,
    reasonCodes,
    evidenceReferences,
    evaluatedAt: input.request.evaluatedAt,
  } as const;
  const result: ActivityEligibilityResult = Object.freeze({
    ...unsigned,
    eligibilityFingerprint: fingerprint(unsigned),
  });
  authenticResults.add(result);
  return result;
}

export function isActivityEligibilityResult(
  value: unknown,
): value is ActivityEligibilityResult {
  return (
    typeof value === "object" &&
    value !== null &&
    authenticResults.has(value) &&
    Object.isFrozen(value)
  );
}
