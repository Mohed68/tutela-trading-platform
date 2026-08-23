import { createHash } from "node:crypto";

import {
  isOrganizationParticipationEligibilityResult,
  type OrganizationParticipationEligibilityResult,
} from "../organization-participation-eligibility/index.js";
import {
  isAuthoritativeOfferVerificationEligibility,
  type OfferVerificationEligibilityResolution,
} from "../verification/eligibilityReadModel.js";

export const OFFER_PUBLICATION_ELIGIBILITY_CONTRACT_VERSION =
  "offer-publication-eligibility/v1" as const;

export const OFFER_PUBLICATION_ELIGIBILITY_REASON_CODES = [
  "organization_participation_unavailable",
  "organization_participation_ineligible",
  "offer_lifecycle_not_verified",
  "offer_verification_unavailable",
  "offer_verification_incomplete",
  "offer_verification_not_eligible",
  "authority_scope_mismatch",
] as const;

export type OfferPublicationEligibilityReasonCode =
  (typeof OFFER_PUBLICATION_ELIGIBILITY_REASON_CODES)[number];
export type OfferPublicationEligibilityOutcome =
  | "publishable"
  | "not_publishable";

export type OrganizationParticipationPublicationResolution =
  | Readonly<{
      status: "resolved";
      result: OrganizationParticipationEligibilityResult;
    }>
  | Readonly<{ status: "not_found" }>
  | Readonly<{ status: "unavailable" }>
  | Readonly<{ status: "integrity_failure" }>;

export interface OfferPublicationEligibilityInput {
  readonly offerId: string;
  readonly lifecycleStatus: string;
  readonly sellerOrganizationId: string;
  readonly sellerUserId: string;
  readonly organizationParticipation: OrganizationParticipationPublicationResolution;
  readonly offerVerification: OfferVerificationEligibilityResolution;
}

export interface OfferPublicationEligibilityResult {
  readonly contractVersion: typeof OFFER_PUBLICATION_ELIGIBILITY_CONTRACT_VERSION;
  readonly offerId: string;
  readonly sellerOrganizationId: string;
  readonly sellerUserId: string;
  readonly lifecycleStatus: string;
  readonly outcome: OfferPublicationEligibilityOutcome;
  readonly reasonCodes: readonly OfferPublicationEligibilityReasonCode[];
  readonly organizationParticipationFingerprint: string | null;
  readonly offerVerificationFingerprint: string | null;
  readonly publicationEligibilityFingerprint: string;
}

const authenticResults = new WeakSet<object>();

function identity(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function addReason(
  reasons: OfferPublicationEligibilityReasonCode[],
  reason: OfferPublicationEligibilityReasonCode,
): void {
  if (!reasons.includes(reason)) reasons.push(reason);
}

export function evaluateOfferPublicationEligibility(
  input: OfferPublicationEligibilityInput,
): OfferPublicationEligibilityResult {
  const reasons: OfferPublicationEligibilityReasonCode[] = [];
  let participationFingerprint: string | null = null;
  let verificationFingerprint: string | null = null;

  if (
    !identity(input.offerId) ||
    !identity(input.sellerOrganizationId) ||
    !identity(input.sellerUserId)
  ) {
    addReason(reasons, "authority_scope_mismatch");
  }

  if (input.organizationParticipation.status !== "resolved") {
    addReason(reasons, "organization_participation_unavailable");
  } else if (
    !isOrganizationParticipationEligibilityResult(
      input.organizationParticipation.result,
    )
  ) {
    addReason(reasons, "organization_participation_unavailable");
  } else {
    const participation = input.organizationParticipation.result;
    participationFingerprint = participation.eligibilityFingerprint;
    if (
      participation.organizationId !== input.sellerOrganizationId ||
      participation.userId !== input.sellerUserId
    ) {
      addReason(reasons, "authority_scope_mismatch");
    }
    if (participation.outcome !== "eligible") {
      addReason(reasons, "organization_participation_ineligible");
    }
  }

  if (input.lifecycleStatus !== "verified") {
    addReason(reasons, "offer_lifecycle_not_verified");
  }

  if (input.offerVerification.status !== "resolved") {
    addReason(
      reasons,
      input.offerVerification.status === "not_found"
        ? "offer_verification_incomplete"
        : "offer_verification_unavailable",
    );
  } else if (
    !isAuthoritativeOfferVerificationEligibility(
      input.offerVerification.projection,
    )
  ) {
    addReason(reasons, "offer_verification_unavailable");
  } else {
    const verification = input.offerVerification.projection;
    verificationFingerprint = verification.projectionFingerprint;
    if (verification.offerId !== input.offerId) {
      addReason(reasons, "authority_scope_mismatch");
    }
    if (
      verification.processState !== "completed" ||
      verification.decision === null
    ) {
      addReason(reasons, "offer_verification_incomplete");
    } else if (
      verification.decision !== "approved" ||
      verification.eligibility !== "eligible"
    ) {
      addReason(reasons, "offer_verification_not_eligible");
    }
  }

  const reasonCodes = Object.freeze([...reasons].sort());
  const outcome: OfferPublicationEligibilityOutcome =
    reasonCodes.length === 0 ? "publishable" : "not_publishable";
  const publicationEligibilityFingerprint = `sha256:${createHash("sha256")
    .update(
      JSON.stringify({
        scope: OFFER_PUBLICATION_ELIGIBILITY_CONTRACT_VERSION,
        offerId: input.offerId,
        sellerOrganizationId: input.sellerOrganizationId,
        sellerUserId: input.sellerUserId,
        lifecycleStatus: input.lifecycleStatus,
        organizationParticipationFingerprint: participationFingerprint,
        offerVerificationFingerprint: verificationFingerprint,
        outcome,
        reasonCodes,
      }),
    )
    .digest("hex")}`;
  const result: OfferPublicationEligibilityResult = Object.freeze({
    contractVersion: OFFER_PUBLICATION_ELIGIBILITY_CONTRACT_VERSION,
    offerId: input.offerId,
    sellerOrganizationId: input.sellerOrganizationId,
    sellerUserId: input.sellerUserId,
    lifecycleStatus: input.lifecycleStatus,
    outcome,
    reasonCodes,
    organizationParticipationFingerprint: participationFingerprint,
    offerVerificationFingerprint: verificationFingerprint,
    publicationEligibilityFingerprint,
  });
  authenticResults.add(result);
  return result;
}

export function isOfferPublicationEligibilityResult(
  value: unknown,
): value is OfferPublicationEligibilityResult {
  return (
    typeof value === "object" &&
    value !== null &&
    authenticResults.has(value) &&
    Object.isFrozen(value)
  );
}
