import type {
  EvidenceAssuranceLevel,
  ProviderEvidenceEnvelope,
} from "../evidence-provider/index.js";

export const OFFER_EVIDENCE_VERIFICATION_SEMANTICS_VERSION =
  "offer-evidence-verification-semantics/v1" as const;

export const OFFER_EVIDENCE_VERIFICATION_EVALUATES = [
  "evidence_credibility",
  "evidence_consistency",
  "evidence_subject_binding",
] as const;

export const OFFER_EVIDENCE_VERIFICATION_DOES_NOT_GUARANTEE = [
  "physical_goods_existence",
  "goods_ownership",
  "continued_availability",
  "successful_delivery",
] as const;

export interface OfferEvidenceAssuranceProfile {
  readonly offerId: string;
  readonly offerVersion: string;
  readonly evidence: readonly ProviderEvidenceEnvelope[];
  readonly attainedLevels: readonly EvidenceAssuranceLevel[];
  readonly profileVersion: typeof OFFER_EVIDENCE_VERIFICATION_SEMANTICS_VERSION;
}

export interface FutureRiskBasedEvidenceRequirement {
  readonly policyVersion: string;
  readonly activityContext: string;
  readonly minimumAssuranceLevel: EvidenceAssuranceLevel;
}
