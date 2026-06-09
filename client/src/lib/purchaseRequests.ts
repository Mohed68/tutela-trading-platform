import type { Incoterm, PaymentMethod, ShippingMode } from "@/lib/negotiation";

export const PURCHASE_REQUEST_STATUSES = [
  "draft",
  "submitted",
  "seller_review",
  "accepted",
  "rejected",
  "expired",
  "converted_to_deal",
  "cancelled",
] as const;

export type PurchaseRequestStatus = (typeof PURCHASE_REQUEST_STATUSES)[number];

export type PurchaseRequestInput = {
  offerId: string;
  buyerId?: string;
  requestedQuantity: number;
  destinationCountry: string;
  destinationPort: string;
  shippingMode: ShippingMode;
  paymentMethod: PaymentMethod;
  incoterm: Incoterm;
  requestedDeliveryWindow: string;
  buyerNote: string;
};

export type PurchaseRequestSummary = {
  requestId: string;
  offerId: string;
  status: PurchaseRequestStatus;
  requestedQuantity: number;
  destinationCountry: string;
  destinationPort: string;
  paymentMethod: PaymentMethod;
  incoterm: Incoterm;
  createdAt: string;
  expiresAt: string;
};

export const PurchaseRequestLimits = {
  defaultValidityHours: 48,
  maxOpenRequestsPerBuyer: 5,
} as const;

export function createPurchaseRequestReference(): string {
  const year = new Date().getFullYear();
  const suffix = Math.floor(Math.random() * 100000)
    .toString()
    .padStart(5, "0");

  return `PR-${year}-${suffix}`;
}

export function isPurchaseRequestExpired(expiresAt: string | Date): boolean {
  return new Date(expiresAt).getTime() <= Date.now();
}

export function canSellerRespondToPurchaseRequest(
  status: PurchaseRequestStatus,
): boolean {
  return status === "submitted" || status === "seller_review";
}
