export const OFFER_PRICING_MODES = ["fixed", "negotiable", "indicative"] as const;

export const OFFER_VISIBILITY_MODES = ["public", "semi_anonymous", "full_anonymous"] as const;

export const OFFER_SOURCES = ["verified_inventory", "manual_offer"] as const;

export const BUYER_ACTIONS = [
  "buy_now",
  "quick_negotiate",
  "written_negotiate",
  "request_quote",
] as const;

export const BUYER_EDITABLE_VARIABLES = [
  "quantity",
  "destination",
  "payment_method",
  "shipping_method",
  "incoterm",
  "delivery_schedule",
] as const;

export const IDENTITY_REVEAL_STAGES = [
  "marketplace",
  "negotiation",
  "commercial_alignment",
  "contracting",
] as const;

export type OfferPricingMode = (typeof OFFER_PRICING_MODES)[number];
export type OfferVisibilityMode = (typeof OFFER_VISIBILITY_MODES)[number];
export type OfferSource = (typeof OFFER_SOURCES)[number];
export type BuyerAction = (typeof BUYER_ACTIONS)[number];
export type BuyerEditableVariable = (typeof BUYER_EDITABLE_VARIABLES)[number];
export type IdentityRevealStage = (typeof IDENTITY_REVEAL_STAGES)[number];

export type SellerCommercialOffer = {
  offerId: string;
  inventoryId?: string;
  pricingMode: OfferPricingMode;
  visibilityMode: OfferVisibilityMode;
  source: OfferSource;
  allowedActions: BuyerAction[];
  editableVariables: BuyerEditableVariable[];
  identityRevealStage: IdentityRevealStage;
};

export function getAllowedActionsForPricingMode(
  pricingMode: OfferPricingMode,
): BuyerAction[] {
  switch (pricingMode) {
    case "fixed":
      return ["buy_now"];
    case "negotiable":
      return ["quick_negotiate", "written_negotiate"];
    case "indicative":
      return ["request_quote", "written_negotiate"];
  }
}

export function shouldRevealIdentity(
  currentStage: IdentityRevealStage,
  revealStage: IdentityRevealStage,
): boolean {
  return (
    IDENTITY_REVEAL_STAGES.indexOf(currentStage) >=
    IDENTITY_REVEAL_STAGES.indexOf(revealStage)
  );
}
