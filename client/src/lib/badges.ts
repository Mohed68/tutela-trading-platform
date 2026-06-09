export const VERIFICATION_BADGE_TYPES = [
  "verified_company",
  "verified_inventory",
  "verified_offer",
  "verified_documents",
  "verified_counterparty",
  "verified_bid_request",
  "trusted_buyer",
  "trusted_supplier",
] as const;

export const VERIFICATION_BADGE_STATUSES = ["active", "pending", "expired", "revoked"] as const;

export type VerificationBadgeType = (typeof VERIFICATION_BADGE_TYPES)[number];
export type VerificationBadgeStatus = (typeof VERIFICATION_BADGE_STATUSES)[number];

export type VerificationBadge = {
  badgeId: string;
  type: VerificationBadgeType;
  status: VerificationBadgeStatus;
  label: string;
  issuedAt: string;
  expiresAt?: string;
  score?: number;
};

export function getBadgeLabel(type: VerificationBadgeType): string {
  switch (type) {
    case "verified_company":
      return "Verified Company";
    case "verified_inventory":
      return "Verified Inventory";
    case "verified_offer":
      return "Verified Offer";
    case "verified_documents":
      return "Verified Documents";
    case "verified_counterparty":
      return "Verified Counterparty";
    case "verified_bid_request":
      return "Verified Bid Request";
    case "trusted_buyer":
      return "Trusted Buyer";
    case "trusted_supplier":
      return "Trusted Supplier";
  }
}

export function isBadgeActive(badge: VerificationBadge): boolean {
  if (badge.status !== "active") {
    return false;
  }

  if (badge.expiresAt) {
    return Date.now() < new Date(badge.expiresAt).getTime();
  }

  return true;
}

export function getBadgePriority(type: VerificationBadgeType): number {
  switch (type) {
    case "trusted_supplier":
      return 100;
    case "trusted_buyer":
      return 95;
    case "verified_company":
      return 90;
    case "verified_counterparty":
      return 85;
    case "verified_inventory":
      return 80;
    case "verified_bid_request":
      return 75;
    case "verified_offer":
      return 70;
    case "verified_documents":
      return 60;
  }
}

export function sortBadgesByPriority(badges: VerificationBadge[]): VerificationBadge[] {
  return [...badges].sort((firstBadge, secondBadge) => {
    return getBadgePriority(secondBadge.type) - getBadgePriority(firstBadge.type);
  });
}
