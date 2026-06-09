export const VISIBILITY_MODES = ["public", "semi_anonymous", "full_anonymous"] as const;

export const IDENTITY_REVEAL_STAGES = [
  "marketplace",
  "negotiation",
  "commercial_alignment",
  "contracting",
] as const;

export const DISCLOSURE_STAGES = [
  "marketplace",
  "negotiation",
  "commercial_alignment",
  "contracting",
  "execution",
] as const;

export const IDENTITY_REVEAL_STATUSES = [
  "not_requested",
  "requested",
  "approved",
  "rejected",
  "revealed",
] as const;

export type VisibilityMode = (typeof VISIBILITY_MODES)[number];
export type IdentityRevealStage = (typeof IDENTITY_REVEAL_STAGES)[number];
export type DisclosureStage = (typeof DISCLOSURE_STAGES)[number];
export type IdentityRevealStatus = (typeof IDENTITY_REVEAL_STATUSES)[number];
export type CommercialRole = "buyer" | "seller";

export type PrivacyProfile = {
  visibilityMode: VisibilityMode;
  identityRevealStage: IdentityRevealStage;
  revealStatus: IdentityRevealStatus;
  maskedDisplayName: string;
  canRequestReveal: boolean;
};

export function getMaskedDisplayName(
  visibilityMode: VisibilityMode,
  role: CommercialRole,
): string {
  if (visibilityMode === "public") {
    return role === "seller" ? "Verified Seller" : "Verified Buyer";
  }

  if (visibilityMode === "semi_anonymous") {
    return role === "seller" ? "Verified Supplier" : "Verified Buyer";
  }

  return role === "seller" ? "Anonymous Supplier" : "Anonymous Buyer";
}

export function shouldRevealIdentity(
  currentStage: DisclosureStage,
  revealStage: IdentityRevealStage,
): boolean {
  return DISCLOSURE_STAGES.indexOf(currentStage) >= DISCLOSURE_STAGES.indexOf(revealStage);
}

export function canRequestIdentityReveal(currentStage: DisclosureStage): boolean {
  return ["commercial_alignment", "contracting", "execution"].includes(currentStage);
}

export function isIdentityVisible(
  visibilityMode: VisibilityMode,
  currentStage: DisclosureStage,
  revealStage: IdentityRevealStage,
  revealStatus: IdentityRevealStatus,
): boolean {
  if (visibilityMode === "public") {
    return true;
  }

  if (revealStatus === "revealed") {
    return true;
  }

  if (revealStatus === "approved" && shouldRevealIdentity(currentStage, revealStage)) {
    return true;
  }

  return false;
}
