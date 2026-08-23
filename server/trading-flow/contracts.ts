import { createHash } from "node:crypto";

export const TRADING_FLOW_CONTRACT_VERSION = "trading-flow/v1" as const;
export type FirstCycleOrderStatus = "created" | "accepted" | "cancelled";

export interface TradingOfferSnapshot {
  readonly offerId: string;
  readonly sellerUserId: string;
  readonly sellerOrganizationId: string;
  readonly lifecycleStatus: string;
  readonly commodity: string;
  readonly availableQuantity: string;
  readonly minimumQuantity: string | null;
  readonly unit: string;
  readonly pricePerUnit: string;
  readonly currency: string;
  readonly deliveryTerms: string | null;
  readonly paymentTerms: string | null;
  readonly specifications: string | null;
  readonly validUntil: string | null;
  readonly offerVersion: string;
  readonly offerFingerprint: string;
}

export interface AcceptedCommercialTerms {
  readonly termsVersion: number;
  readonly quantity: string;
  readonly unit: string;
  readonly pricePerUnit: string;
  readonly totalAmount: string;
  readonly currency: string;
  readonly deliveryTerms: string | null;
  readonly paymentTerms: string | null;
  readonly specifications: string | null;
  readonly termsFingerprint: string;
}

export interface AuthoritativeOrderRecord {
  readonly orderId: string;
  readonly offerId: string;
  readonly buyerUserId: string;
  readonly buyerOrganizationId: string;
  readonly sellerUserId: string;
  readonly sellerOrganizationId: string;
  readonly status: FirstCycleOrderStatus;
  readonly orderVersion: number;
  readonly offerVersion: string;
  readonly offerFingerprint: string;
  readonly publicationEligibilityFingerprint: string;
  readonly buyerParticipationEligibilityFingerprint: string;
  readonly terms: AcceptedCommercialTerms;
  readonly createdAt: string;
  readonly acceptedAt: string | null;
  readonly orderFingerprint: string;
}

export interface AuthoritativeContractRecord {
  readonly contractId: string;
  readonly orderId: string;
  readonly offerId: string;
  readonly buyerUserId: string;
  readonly buyerOrganizationId: string;
  readonly sellerUserId: string;
  readonly sellerOrganizationId: string;
  readonly status: "draft";
  readonly contractVersion: number;
  readonly acceptedOrderVersion: number;
  readonly acceptedOrderFingerprint: string;
  readonly terms: AcceptedCommercialTerms;
  readonly createdAt: string;
  readonly contractFingerprint: string;
}

function fingerprint(value: unknown): string {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

export function fingerprintTradingOffer(
  offer: Omit<TradingOfferSnapshot, "offerFingerprint">,
): string {
  return fingerprint({ scope: `${TRADING_FLOW_CONTRACT_VERSION}/offer`, ...offer });
}

export function createAcceptedCommercialTerms(input: Omit<AcceptedCommercialTerms, "termsFingerprint">): AcceptedCommercialTerms {
  const termsFingerprint = fingerprint({
    scope: `${TRADING_FLOW_CONTRACT_VERSION}/accepted-terms`,
    ...input,
  });
  return Object.freeze({ ...input, termsFingerprint });
}

export function fingerprintOrder(
  order: Omit<AuthoritativeOrderRecord, "orderFingerprint">,
): string {
  return fingerprint({
    scope: `${TRADING_FLOW_CONTRACT_VERSION}/order`,
    ...order,
    terms: order.terms.termsFingerprint,
  });
}

export function fingerprintContract(
  contract: Omit<AuthoritativeContractRecord, "contractFingerprint">,
): string {
  return fingerprint({
    scope: `${TRADING_FLOW_CONTRACT_VERSION}/contract`,
    ...contract,
    terms: contract.terms.termsFingerprint,
  });
}

export function isAuthoritativeOrderRecord(value: unknown): value is AuthoritativeOrderRecord {
  if (typeof value !== "object" || value === null) return false;
  const order = value as AuthoritativeOrderRecord;
  if (!Object.isFrozen(order) || !Object.isFrozen(order.terms)) return false;
  const { orderFingerprint, ...unsigned } = order;
  return orderFingerprint === fingerprintOrder(unsigned);
}

export function isAuthoritativeContractRecord(value: unknown): value is AuthoritativeContractRecord {
  if (typeof value !== "object" || value === null) return false;
  const contract = value as AuthoritativeContractRecord;
  if (!Object.isFrozen(contract) || !Object.isFrozen(contract.terms)) return false;
  const { contractFingerprint, ...unsigned } = contract;
  return contractFingerprint === fingerprintContract(unsigned);
}
