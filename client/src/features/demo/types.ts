export type DemoTradeRole = "buyer" | "seller" | "both";
export type DemoCategory = "energy" | "chemicals" | "metals" | "agriculture";
export type DemoSide = "buy" | "sell";
export type DemoAssuranceLevel = "documentary" | "source_confirmed" | "independently_inspected";
export type DemoMissionStep =
  | "review_organization"
  | "review_offer"
  | "review_evidence"
  | "place_order"
  | "seller_acceptance"
  | "view_contract";

export interface DemoSessionView {
  demoSessionId: string;
  startedAt: string;
  expiresAt: string;
  ttlMinutes: number;
  state: "active" | "expired" | "reset";
  stateVersion: number;
  simulation: true;
  visitor: { firstName: string; lastName: string; company: string; tradeRole: DemoTradeRole };
  missionCount: number;
  orderCount: number;
  contractCount: number;
}

export interface DemoOffer {
  offerId: string;
  commodity: string;
  category: DemoCategory;
  side: DemoSide;
  organizationId: string;
  quantity: string;
  unit: string;
  pricePerUnit: string;
  currency: string;
  location: string;
  origin: string | null;
  destination: string | null;
  incoterm: string;
  paymentTerms: string;
  minimumQuantity: string;
  specifications: Record<string, string>;
  assuranceLevel: DemoAssuranceLevel;
  assuranceLabel: string;
  status: "active";
}

export interface DemoOrganization {
  organizationId: string;
  legalName: string;
  role: "buyer" | "seller" | "buyer_seller";
  sector: string;
  jurisdiction: string;
  headquarters: string;
}

export interface DemoEvidence {
  offerId: string;
  assuranceLevel: DemoAssuranceLevel;
  assuranceLabel: string;
  specifications: Record<string, string>;
}

export interface DemoMissionDefinition {
  missionId: string;
  title: string;
  purpose: string;
  commodity: string;
  offerId: string;
  estimatedMinutes: number;
  steps: DemoMissionStep[];
}

export interface DemoMissionProgress {
  missionId: string;
  currentStep: DemoMissionStep | null;
  completedSteps: DemoMissionStep[];
  completionState: "not_started" | "in_progress" | "completed";
}

export interface DemoMissionView {
  definition: DemoMissionDefinition;
  progress: DemoMissionProgress | null;
}

export interface DemoOrder {
  orderId: string;
  scenarioId: string;
  offerId: string;
  buyerOrganizationId: string;
  sellerOrganizationId: string;
  quantity: string;
  unit: string;
  pricePerUnit: string;
  currency: string;
  status: "submitted" | "accepted";
  submittedAt: string;
}

export interface DemoAcceptance {
  acceptanceId: string;
  orderId: string;
  acceptedAt: string;
  mode: "deterministic_simulation";
}

export interface DemoContract {
  contractId: string;
  scenarioId: string;
  orderId: string;
  offerId: string;
  buyerOrganizationId: string;
  sellerOrganizationId: string;
  quantity: string;
  unit: string;
  pricePerUnit: string;
  totalAmount: string;
  currency: string;
  createdAt: string;
  legalMarker: "SIMULATION — NON-BINDING";
}

export interface DemoQualification {
  firstName: string;
  lastName: string;
  businessEmail: string;
  company: string;
  country: string;
  jobRole: string;
  tradeRole: DemoTradeRole;
  primaryInterest: string;
}
