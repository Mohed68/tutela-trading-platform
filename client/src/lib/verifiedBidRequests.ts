import type { Incoterm, PaymentMethod, ShippingMode } from "@/lib/negotiation";

export const VERIFIED_BID_REQUEST_STATUSES = [
  "draft",
  "submitted",
  "published",
  "matched",
  "supplier_responded",
  "negotiating",
  "converted_to_deal",
  "expired",
  "cancelled",
  "rejected",
] as const;

export const BID_INTENT_LEVELS = [
  "price_discovery",
  "budgeting",
  "active_procurement",
  "immediate_requirement",
] as const;

export const COMMITMENT_LEVELS = ["low", "medium", "high"] as const;

export type VerifiedBidRequestStatus = (typeof VERIFIED_BID_REQUEST_STATUSES)[number];
export type BidIntentLevel = (typeof BID_INTENT_LEVELS)[number];
export type CommitmentLevel = (typeof COMMITMENT_LEVELS)[number];

export type VerifiedBidRequestInput = {
  commodity: string;
  specification: string;
  quantity: number;
  unit: string;
  targetPricePerUnit: number;
  currency: string;
  destinationCountry: string;
  destinationPort: string;
  incoterm: Incoterm;
  paymentMethod: PaymentMethod;
  shippingMode: ShippingMode;
  deliveryWindow: string;
  validityHours: number;
  intentLevel: BidIntentLevel;
  buyerNote: string;
};

export type VerifiedBidRequestScore = {
  buyerTrustScore: number;
  marketMatchScore: number;
  commitmentScore: number;
  historicalConversionScore: number;
  overallScore: number;
};

export type VerifiedBidRequestSummary = {
  requestId: string;
  status: VerifiedBidRequestStatus;
  commodity: string;
  quantity: number;
  unit: string;
  targetPricePerUnit: number;
  currency: string;
  destinationCountry: string;
  destinationPort: string;
  incoterm: Incoterm;
  paymentMethod: PaymentMethod;
  intentLevel: BidIntentLevel;
  commitmentLevel: CommitmentLevel;
  overallScore: number;
  createdAt: string;
  expiresAt: string;
};

export const VBRLimits = {
  defaultValidityHours: 72,
  maxOpenRequestsPerBuyer: 5,
  minimumMarketMatchScoreToPublish: 60,
} as const;

export function createVerifiedBidRequestReference(): string {
  const year = new Date().getFullYear();
  const suffix = Math.floor(Math.random() * 100000)
    .toString()
    .padStart(5, "0");

  return `VBR-${year}-${suffix}`;
}

export function calculateCommitmentLevel(score: number): CommitmentLevel {
  if (score >= 80) {
    return "high";
  }

  if (score >= 50) {
    return "medium";
  }

  return "low";
}

export function calculateOverallVBRScore(
  scores: Pick<
    VerifiedBidRequestScore,
    "buyerTrustScore" | "marketMatchScore" | "commitmentScore" | "historicalConversionScore"
  >,
): number {
  const weightedScore =
    scores.buyerTrustScore * 0.3 +
    scores.marketMatchScore * 0.3 +
    scores.commitmentScore * 0.25 +
    scores.historicalConversionScore * 0.15;

  return Math.round(Math.min(Math.max(weightedScore, 0), 100));
}

export function canPublishVBR(marketMatchScore: number, buyerTrustScore: number): boolean {
  return (
    marketMatchScore >= VBRLimits.minimumMarketMatchScoreToPublish &&
    buyerTrustScore >= 50
  );
}
