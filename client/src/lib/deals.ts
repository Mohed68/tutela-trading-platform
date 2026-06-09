import type { Incoterm } from "@/lib/negotiation";

export const DEAL_ORIGINS = [
  "purchase_request",
  "seller_offer_negotiation",
  "verified_bid_request",
] as const;

export const DEAL_STAGES = [
  "negotiation",
  "commercial_alignment",
  "contracting",
  "execution_readiness",
  "shipment",
  "settlement",
  "completed",
  "cancelled",
] as const;

export const DEAL_STATUSES = [
  "open",
  "pending_response",
  "countered",
  "commercially_agreed",
  "contract_draft",
  "under_review",
  "approved",
  "execution_ready",
  "preparing_shipment",
  "in_transit",
  "delivered",
  "pending_payment",
  "paid",
  "completed",
  "rejected",
  "expired",
  "cancelled",
] as const;

export const DEAL_PARTICIPANT_ROLES = ["buyer", "seller", "platform"] as const;

export const DEAL_TIMELINE_EVENT_TYPES = [
  "created",
  "counter_submitted",
  "accepted",
  "rejected",
  "identity_reveal_requested",
  "identity_revealed",
  "contract_generated",
  "contract_approved",
  "execution_ready",
  "shipment_updated",
  "payment_updated",
  "completed",
  "cancelled",
] as const;

export type DealOrigin = (typeof DEAL_ORIGINS)[number];
export type DealStage = (typeof DEAL_STAGES)[number];
export type DealStatus = (typeof DEAL_STATUSES)[number];
export type DealParticipantRole = (typeof DEAL_PARTICIPANT_ROLES)[number];
export type DealTimelineEventType = (typeof DEAL_TIMELINE_EVENT_TYPES)[number];

export type DealParticipant = {
  participantId: string;
  role: DealParticipantRole;
  displayName: string;
  isIdentityRevealed: boolean;
  trustScore?: number;
};

export type DealTimelineEvent = {
  eventId: string;
  dealId: string;
  type: DealTimelineEventType;
  title: string;
  description?: string;
  createdAt: string;
  actorRole?: DealParticipantRole;
};

export type DealSummary = {
  dealId: string;
  origin: DealOrigin;
  stage: DealStage;
  status: DealStatus;
  commodity: string;
  quantity: number;
  unit: string;
  agreedPricePerUnit?: number;
  currency: string;
  incoterm?: Incoterm;
  destinationCountry?: string;
  destinationPort?: string;
  buyer: DealParticipant;
  seller: DealParticipant;
  createdAt: string;
  updatedAt: string;
};

export function createDealReference(): string {
  const year = new Date().getFullYear();
  const suffix = Math.floor(Math.random() * 100000)
    .toString()
    .padStart(5, "0");

  return `DL-${year}-${suffix}`;
}

export function getDealProgressPercent(stage: DealStage): number {
  switch (stage) {
    case "negotiation":
      return 10;
    case "commercial_alignment":
      return 25;
    case "contracting":
      return 40;
    case "execution_readiness":
      return 55;
    case "shipment":
      return 75;
    case "settlement":
      return 90;
    case "completed":
      return 100;
    case "cancelled":
      return 0;
  }
}

export function canRequestIdentityReveal(stage: DealStage): boolean {
  return [
    "commercial_alignment",
    "contracting",
    "execution_readiness",
    "shipment",
    "settlement",
  ].includes(stage);
}

export function isDealTerminal(status: DealStatus): boolean {
  return ["completed", "rejected", "expired", "cancelled"].includes(status);
}
