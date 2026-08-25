import {
  evaluateOfferPublicationEligibility,
  isOfferPublicationEligibilityResult,
  type OfferPublicationEligibilityDependencies,
} from "../offer-publication-eligibility/index.js";
import {
  isOrganizationParticipationEligibilityResult,
  type OrganizationParticipationEligibilityResult,
} from "../organization-participation-eligibility/index.js";
import {
  createAcceptedCommercialTerms,
  fingerprintContract,
  fingerprintOrder,
  type AcceptedCommercialTerms,
  type AuthoritativeContractRecord,
  type AuthoritativeOrderRecord,
  type TradingOfferSnapshot,
} from "./contracts.js";

export type TradingFlowFailureCode =
  | "invalid_request"
  | "offer_not_found"
  | "offer_not_publishable"
  | "buyer_not_eligible"
  | "stale_offer"
  | "order_not_found"
  | "order_not_acceptable"
  | "seller_authority_required"
  | "order_not_contractible"
  | "participant_authority_required"
  | "persistence_conflict";

export type TradingFlowResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; code: TradingFlowFailureCode }>;

export interface TradingFlowRepository {
  loadOffer(offerId: string): Promise<TradingOfferSnapshot | null>;
  insertOrder(input: AuthoritativeOrderRecord): Promise<AuthoritativeOrderRecord | null>;
  loadOrder(orderId: string): Promise<AuthoritativeOrderRecord | null>;
  acceptOrder(input: Readonly<{
    previousOrderFingerprint: string;
    acceptedOrder: AuthoritativeOrderRecord;
  }>): Promise<AuthoritativeOrderRecord | null>;
  insertContract(input: AuthoritativeContractRecord): Promise<AuthoritativeContractRecord | null>;
}

export interface TradingFlowDependencies extends OfferPublicationEligibilityDependencies {
  readonly repository: TradingFlowRepository;
  readonly ids: Readonly<{ next(): string }>;
  readonly clock: Readonly<{ now(): string }>;
}

export interface CreateOrderRequest {
  readonly offerId: string;
  readonly buyerUserId: string;
  readonly buyerOrganizationId: string;
  readonly quantity: string;
}

function validIdentity(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parseDecimal(value: string): { coefficient: bigint; scale: number } | null {
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  const coefficient = BigInt(`${whole}${fraction}`);
  return coefficient > 0n ? { coefficient, scale: fraction.length } : null;
}

function compareDecimal(left: string, right: string): number | null {
  const a = parseDecimal(left);
  const b = parseDecimal(right);
  if (!a || !b) return null;
  const scale = Math.max(a.scale, b.scale);
  const av = a.coefficient * 10n ** BigInt(scale - a.scale);
  const bv = b.coefficient * 10n ** BigInt(scale - b.scale);
  return av < bv ? -1 : av > bv ? 1 : 0;
}

function multiplyDecimal(left: string, right: string): string | null {
  const a = parseDecimal(left);
  const b = parseDecimal(right);
  if (!a || !b) return null;
  const scale = a.scale + b.scale;
  const digits = (a.coefficient * b.coefficient).toString().padStart(scale + 1, "0");
  if (scale === 0) return digits;
  const result = `${digits.slice(0, -scale)}.${digits.slice(-scale)}`
    .replace(/\.0+$/, "")
    .replace(/(\.\d*?)0+$/, "$1");
  return result;
}

function freezeOrder(input: Omit<AuthoritativeOrderRecord, "orderFingerprint">): AuthoritativeOrderRecord {
  return Object.freeze({ ...input, terms: Object.freeze(input.terms), orderFingerprint: fingerprintOrder(input) });
}

function freezeContract(input: Omit<AuthoritativeContractRecord, "contractFingerprint">): AuthoritativeContractRecord {
  return Object.freeze({ ...input, terms: Object.freeze(input.terms), contractFingerprint: fingerprintContract(input) });
}

async function resolveCurrentAuthority(
  dependencies: TradingFlowDependencies,
  offer: TradingOfferSnapshot,
  buyerUserId: string,
  buyerOrganizationId: string,
): Promise<TradingFlowResult<Readonly<{
  publicationFingerprint: string;
  buyerEligibility: OrganizationParticipationEligibilityResult;
}>>> {
  const [sellerParticipation, offerVerification, buyerParticipation] = await Promise.all([
    dependencies.organizationParticipationEligibility.resolveCurrentOrganizationParticipationEligibility({
      organizationId: offer.sellerOrganizationId,
      userId: offer.sellerUserId,
    }),
    dependencies.offerVerificationEligibility.resolveCurrentOfferVerificationEligibility(offer.offerId),
    dependencies.organizationParticipationEligibility.resolveCurrentOrganizationParticipationEligibility({
      organizationId: buyerOrganizationId,
      userId: buyerUserId,
    }),
  ]);
  const publication = evaluateOfferPublicationEligibility({
    offerId: offer.offerId,
    lifecycleStatus: offer.lifecycleStatus,
    sellerOrganizationId: offer.sellerOrganizationId,
    sellerUserId: offer.sellerUserId,
    organizationParticipation: sellerParticipation,
    offerVerification,
  });
  if (!isOfferPublicationEligibilityResult(publication) || publication.outcome !== "publishable") {
    return Object.freeze({ ok: false, code: "offer_not_publishable" });
  }
  if (
    buyerParticipation.status !== "resolved" ||
    !isOrganizationParticipationEligibilityResult(buyerParticipation.result) ||
    buyerParticipation.result.outcome !== "eligible" ||
    buyerParticipation.result.userId !== buyerUserId ||
    buyerParticipation.result.organizationId !== buyerOrganizationId
  ) {
    return Object.freeze({ ok: false, code: "buyer_not_eligible" });
  }
  return Object.freeze({
    ok: true,
    value: Object.freeze({
      publicationFingerprint: publication.publicationEligibilityFingerprint,
      buyerEligibility: buyerParticipation.result,
    }),
  });
}

export function createTradingFlowService(dependencies: TradingFlowDependencies) {
  return Object.freeze({
    async createOrder(request: CreateOrderRequest): Promise<TradingFlowResult<AuthoritativeOrderRecord>> {
      if (![request.offerId, request.buyerUserId, request.buyerOrganizationId].every(validIdentity)) {
        return Object.freeze({ ok: false, code: "invalid_request" });
      }
      const offer = await dependencies.repository.loadOffer(request.offerId);
      if (!offer) return Object.freeze({ ok: false, code: "offer_not_found" });
      const quantityVsAvailable = compareDecimal(request.quantity, offer.availableQuantity);
      const quantityVsMinimum = offer.minimumQuantity
        ? compareDecimal(request.quantity, offer.minimumQuantity)
        : 1;
      const totalAmount = multiplyDecimal(request.quantity, offer.pricePerUnit);
      if (quantityVsAvailable === null || quantityVsAvailable > 0 || quantityVsMinimum === null || quantityVsMinimum < 0 || !totalAmount) {
        return Object.freeze({ ok: false, code: "invalid_request" });
      }
      const now = dependencies.clock.now();
      if (!Number.isFinite(Date.parse(now)) || (offer.validUntil && Date.parse(offer.validUntil) <= Date.parse(now))) {
        return Object.freeze({ ok: false, code: "stale_offer" });
      }
      const authority = await resolveCurrentAuthority(
        dependencies,
        offer,
        request.buyerUserId,
        request.buyerOrganizationId,
      );
      if (!authority.ok) return authority;
      const terms: AcceptedCommercialTerms = createAcceptedCommercialTerms({
        termsVersion: 1,
        quantity: request.quantity,
        unit: offer.unit,
        pricePerUnit: offer.pricePerUnit,
        totalAmount,
        currency: offer.currency,
        deliveryTerms: offer.deliveryTerms,
        paymentTerms: offer.paymentTerms,
        specifications: offer.specifications,
      });
      const order = freezeOrder({
        orderId: dependencies.ids.next(),
        offerId: offer.offerId,
        buyerUserId: request.buyerUserId,
        buyerOrganizationId: request.buyerOrganizationId,
        sellerUserId: offer.sellerUserId,
        sellerOrganizationId: offer.sellerOrganizationId,
        status: "created",
        orderVersion: 1,
        offerVersion: offer.offerVersion,
        offerFingerprint: offer.offerFingerprint,
        publicationEligibilityFingerprint: authority.value.publicationFingerprint,
        buyerParticipationEligibilityFingerprint: authority.value.buyerEligibility.eligibilityFingerprint,
        terms,
        createdAt: now,
        acceptedAt: null,
      });
      const persisted = await dependencies.repository.insertOrder(order);
      return persisted
        ? Object.freeze({ ok: true, value: persisted })
        : Object.freeze({ ok: false, code: "persistence_conflict" });
    },

    async acceptOrder(orderId: string, sellerUserId: string): Promise<TradingFlowResult<AuthoritativeOrderRecord>> {
      if (!validIdentity(orderId) || !validIdentity(sellerUserId)) {
        return Object.freeze({ ok: false, code: "invalid_request" });
      }
      const order = await dependencies.repository.loadOrder(orderId);
      if (!order) return Object.freeze({ ok: false, code: "order_not_found" });
      if (order.status !== "created") return Object.freeze({ ok: false, code: "order_not_acceptable" });
      if (order.sellerUserId !== sellerUserId) return Object.freeze({ ok: false, code: "seller_authority_required" });
      const offer = await dependencies.repository.loadOffer(order.offerId);
      if (!offer || offer.offerVersion !== order.offerVersion || offer.offerFingerprint !== order.offerFingerprint) {
        return Object.freeze({ ok: false, code: "stale_offer" });
      }
      const authority = await resolveCurrentAuthority(
        dependencies,
        offer,
        order.buyerUserId,
        order.buyerOrganizationId,
      );
      if (!authority.ok) return authority;
      const acceptedOrder = freezeOrder({
        orderId: order.orderId,
        offerId: order.offerId,
        buyerUserId: order.buyerUserId,
        buyerOrganizationId: order.buyerOrganizationId,
        sellerUserId: order.sellerUserId,
        sellerOrganizationId: order.sellerOrganizationId,
        status: "accepted",
        orderVersion: order.orderVersion + 1,
        offerVersion: order.offerVersion,
        offerFingerprint: order.offerFingerprint,
        publicationEligibilityFingerprint: order.publicationEligibilityFingerprint,
        buyerParticipationEligibilityFingerprint: order.buyerParticipationEligibilityFingerprint,
        terms: order.terms,
        createdAt: order.createdAt,
        acceptedAt: dependencies.clock.now(),
      });
      const persisted = await dependencies.repository.acceptOrder({
        previousOrderFingerprint: order.orderFingerprint,
        acceptedOrder,
      });
      return persisted
        ? Object.freeze({ ok: true, value: persisted })
        : Object.freeze({ ok: false, code: "persistence_conflict" });
    },

    async createContract(orderId: string, actorUserId: string): Promise<TradingFlowResult<AuthoritativeContractRecord>> {
      if (!validIdentity(orderId) || !validIdentity(actorUserId)) {
        return Object.freeze({ ok: false, code: "invalid_request" });
      }
      const order = await dependencies.repository.loadOrder(orderId);
      if (!order) return Object.freeze({ ok: false, code: "order_not_found" });
      if (order.status !== "accepted" || !order.acceptedAt) {
        return Object.freeze({ ok: false, code: "order_not_contractible" });
      }
      if (actorUserId !== order.buyerUserId && actorUserId !== order.sellerUserId) {
        return Object.freeze({ ok: false, code: "participant_authority_required" });
      }
      const offer = await dependencies.repository.loadOffer(order.offerId);
      if (!offer || offer.offerVersion !== order.offerVersion || offer.offerFingerprint !== order.offerFingerprint) {
        return Object.freeze({ ok: false, code: "stale_offer" });
      }
      const authority = await resolveCurrentAuthority(dependencies, offer, order.buyerUserId, order.buyerOrganizationId);
      if (!authority.ok) return authority;
      const contract = freezeContract({
        contractId: dependencies.ids.next(),
        orderId: order.orderId,
        offerId: order.offerId,
        buyerUserId: order.buyerUserId,
        buyerOrganizationId: order.buyerOrganizationId,
        sellerUserId: order.sellerUserId,
        sellerOrganizationId: order.sellerOrganizationId,
        status: "draft",
        contractVersion: 1,
        acceptedOrderVersion: order.orderVersion,
        acceptedOrderFingerprint: order.orderFingerprint,
        terms: order.terms,
        createdAt: dependencies.clock.now(),
      });
      const persisted = await dependencies.repository.insertContract(contract);
      return persisted
        ? Object.freeze({ ok: true, value: persisted })
        : Object.freeze({ ok: false, code: "persistence_conflict" });
    },
  });
}
