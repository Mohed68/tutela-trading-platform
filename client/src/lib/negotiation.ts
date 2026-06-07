export const INCOTERMS = ["EXW", "FCA", "FOB", "CFR", "CIF", "DAP", "DDP"] as const;

export const SHIPPING_MODES = ["bulk", "container", "tanker", "truck", "rail"] as const;

export const PAYMENT_METHODS = ["LC", "SBLC", "CAD", "Escrow", "TT"] as const;

export const INSPECTION_COMPANIES = ["SGS", "Bureau Veritas", "Intertek", "Other"] as const;

export const NEGOTIATION_STATUSES = [
  "draft",
  "submitted",
  "countered",
  "accepted",
  "rejected",
  "expired",
  "closed",
] as const;

export type Incoterm = (typeof INCOTERMS)[number];
export type ShippingMode = (typeof SHIPPING_MODES)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type InspectionCompany = (typeof INSPECTION_COMPANIES)[number];
export type NegotiationStatus = (typeof NEGOTIATION_STATUSES)[number];
export type DeltaClassification = "reasonable" | "moderate" | "high";

export type QuickNegotiationInput = {
  offerId: string;
  originalPricePerUnit: number;
  originalQuantity: number;
  currency: string;
  unit: string;
  counterPricePerUnit: number;
  counterQuantity: number;
  incoterm: Incoterm;
  destinationCountry: string;
  destinationPort: string;
  paymentMethod: PaymentMethod;
  validityHours: number;
  shortNote: string;
};

export type WrittenNegotiationInput = {
  offerId: string;
  message: string;
  requestedDocuments: string[];
  requestedInspectionCompany: InspectionCompany;
  insuranceRequired: boolean;
  shippingMode: ShippingMode;
  specialConditions: string;
};

export const NegotiationLimits = {
  maxBuyerQuickAttempts: 3,
  maxSellerResponses: 3,
  highDeviationThresholdPercent: 25,
  moderateDeviationThresholdPercent: 10,
} as const;

export function calculateDealValue(pricePerUnit: number, quantity: number): number {
  return pricePerUnit * quantity;
}

export function calculateDeltaPercent(originalValue: number, counterValue: number): number {
  if (originalValue === 0) {
    return 0;
  }

  return ((counterValue - originalValue) / originalValue) * 100;
}

export function classifyDelta(deltaPercent: number): DeltaClassification {
  const absoluteDelta = Math.abs(deltaPercent);

  if (absoluteDelta <= NegotiationLimits.moderateDeviationThresholdPercent) {
    return "reasonable";
  }

  if (absoluteDelta <= NegotiationLimits.highDeviationThresholdPercent) {
    return "moderate";
  }

  return "high";
}