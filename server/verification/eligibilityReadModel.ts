import { createHash } from "node:crypto";

import type {
  VerificationDecision,
  VerificationEligibilityProjection,
  VerificationProcessState,
} from "../../shared/verification.js";

export const OFFER_VERIFICATION_ELIGIBILITY_READ_MODEL_VERSION =
  "offer-verification-eligibility/v1" as const;

export interface AuthoritativeOfferVerificationEligibility
  extends Readonly<VerificationEligibilityProjection> {
  readonly readModelVersion: typeof OFFER_VERIFICATION_ELIGIBILITY_READ_MODEL_VERSION;
  readonly projectionFingerprint: string;
}

export interface OfferVerificationEligibilitySource {
  readonly offerId: string;
  readonly submissionRevision: number;
  readonly attemptId: string;
  readonly processState: VerificationProcessState;
  readonly decision: VerificationDecision | null;
  readonly completedAt: string | null;
  readonly engineVersion: string;
  readonly technicalPolicyVersion: string;
  readonly commercialPolicyVersion: string;
  readonly inputFingerprint: string;
}

export type OfferVerificationEligibilityResolution =
  | Readonly<{
      status: "resolved";
      projection: AuthoritativeOfferVerificationEligibility;
    }>
  | Readonly<{ status: "not_found" }>
  | Readonly<{ status: "unavailable" }>
  | Readonly<{ status: "integrity_failure" }>;

export interface OfferVerificationEligibilityReadPort {
  resolveCurrentOfferVerificationEligibility(
    offerId: string,
  ): Promise<OfferVerificationEligibilityResolution>;
}

const authenticProjections = new WeakSet<object>();

function identity(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function timestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function eligibilityFor(
  processState: VerificationProcessState,
  decision: VerificationDecision | null,
): VerificationEligibilityProjection["eligibility"] {
  if (processState !== "completed") return "pending";
  return decision === "approved" ? "eligible" : "not_eligible";
}

export function deriveAuthoritativeOfferVerificationEligibility(
  source: OfferVerificationEligibilitySource,
): AuthoritativeOfferVerificationEligibility | undefined {
  if (
    !identity(source.offerId) ||
    !Number.isSafeInteger(source.submissionRevision) ||
    source.submissionRevision < 1 ||
    !identity(source.attemptId) ||
    !["not_started", "queued", "running", "completed"].includes(
      source.processState,
    ) ||
    (source.decision !== null &&
      !["approved", "revision_required", "manual_review"].includes(
        source.decision,
      )) ||
    !identity(source.engineVersion) ||
    !identity(source.technicalPolicyVersion) ||
    !identity(source.commercialPolicyVersion) ||
    !/^[a-f0-9]{64}$/.test(source.inputFingerprint)
  ) {
    return undefined;
  }
  if (
    source.processState === "completed"
      ? source.decision === null ||
        source.completedAt === null ||
        !timestamp(source.completedAt)
      : source.decision !== null || source.completedAt !== null
  ) {
    return undefined;
  }

  const eligibility = eligibilityFor(source.processState, source.decision);
  const projectionFingerprint = `sha256:${createHash("sha256")
    .update(
      JSON.stringify({
        scope: OFFER_VERIFICATION_ELIGIBILITY_READ_MODEL_VERSION,
        offerId: source.offerId,
        submissionRevision: source.submissionRevision,
        attemptId: source.attemptId,
        processState: source.processState,
        decision: source.decision,
        eligibility,
        completedAt: source.completedAt,
        engineVersion: source.engineVersion,
        technicalPolicyVersion: source.technicalPolicyVersion,
        commercialPolicyVersion: source.commercialPolicyVersion,
        inputFingerprint: source.inputFingerprint,
      }),
    )
    .digest("hex")}`;
  const projection: AuthoritativeOfferVerificationEligibility = Object.freeze({
    offerId: source.offerId,
    submissionRevision: source.submissionRevision,
    attemptId: source.attemptId,
    processState: source.processState,
    decision: source.decision,
    eligibility,
    completedAt: source.completedAt,
    engineVersion: source.engineVersion,
    technicalPolicyVersion: source.technicalPolicyVersion,
    commercialPolicyVersion: source.commercialPolicyVersion,
    inputFingerprint: source.inputFingerprint,
    readModelVersion: OFFER_VERIFICATION_ELIGIBILITY_READ_MODEL_VERSION,
    projectionFingerprint,
  });
  authenticProjections.add(projection);
  return projection;
}

export function isAuthoritativeOfferVerificationEligibility(
  value: unknown,
): value is AuthoritativeOfferVerificationEligibility {
  return (
    typeof value === "object" &&
    value !== null &&
    authenticProjections.has(value) &&
    Object.isFrozen(value)
  );
}
