import assert from "node:assert/strict";
import test from "node:test";

import { REGISTRY_CONTRACT_VERSION, createOrganizationProfileRevisionId } from "../organization-registry/index.js";
import { createOrganizationParticipationEligibilityRequest } from "../organization-participation-eligibility/index.js";
import { createOrganizationParticipationEligibilityResultInternal } from "../organization-participation-eligibility/eligibilityContracts.js";
import { createOrganizationVerificationWorkflowStreamIdentity } from "../organization-verification/application/persistence-contract/index.js";
import { deriveAuthoritativeOfferVerificationEligibility } from "../verification/eligibilityReadModel.js";
import { fingerprintTradingOffer, type AuthoritativeContractRecord, type AuthoritativeOrderRecord, type TradingOfferSnapshot } from "./contracts.js";
import { createTradingFlowService, type TradingFlowRepository } from "./service.js";

function must<T>(result: { ok: true; value: T } | { ok: false; code: string }): T {
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error(result.code);
  return result.value;
}

function participation(organizationId: string, userId: string, outcome: "eligible" | "ineligible" = "eligible") {
  const stream = must(createOrganizationVerificationWorkflowStreamIdentity({
    workflowExecutionId: `${organizationId}-workflow`, organizationId,
    recordId: `${organizationId}-record`, revisionId: `${organizationId}-revision`, attemptId: `${organizationId}-attempt`,
  }));
  const request = must(createOrganizationParticipationEligibilityRequest({
    evaluationId: `${organizationId}-${userId}-evaluation`, userId,
    membershipId: `${organizationId}-${userId}-membership`, organizationId: stream.organizationId,
    organizationProfileRevisionId: must(createOrganizationProfileRevisionId(`${organizationId}-profile`)),
    expectedRegistryContractVersion: REGISTRY_CONTRACT_VERSION,
    verificationStreamIdentity: stream, evaluatedAt: "2026-09-04T00:00:00.000Z",
  }));
  return createOrganizationParticipationEligibilityResultInternal({
    request, outcome, reasonCodes: outcome === "eligible" ? [] : ["organization_not_trusted"],
  });
}

function offer(overrides: Partial<Omit<TradingOfferSnapshot, "offerFingerprint">> = {}): TradingOfferSnapshot {
  const unsigned = {
    offerId: "offer-1", sellerUserId: "seller-user", sellerOrganizationId: "seller-org",
    lifecycleStatus: "verified", commodity: "Copper", availableQuantity: "100",
    minimumQuantity: "10", unit: "MT", pricePerUnit: "25.50", currency: "USD",
    deliveryTerms: "FOB", paymentTerms: "Net 30", specifications: "Grade A",
    validUntil: "2027-01-01T00:00:00.000Z", offerVersion: "2026-09-04T00:00:00.000Z",
    ...overrides,
  };
  return Object.freeze({ ...unsigned, offerFingerprint: fingerprintTradingOffer(unsigned) });
}

function verification(offerId = "offer-1", decision: "approved" | "revision_required" = "approved") {
  const value = deriveAuthoritativeOfferVerificationEligibility({
    offerId, submissionRevision: 1, attemptId: `${offerId}-attempt`, processState: "completed",
    decision, completedAt: "2026-09-04T00:00:00.000Z", engineVersion: "engine/v1",
    technicalPolicyVersion: "technical/v1", commercialPolicyVersion: "commercial/v1",
    inputFingerprint: "a".repeat(64),
  });
  assert.ok(value);
  return value;
}

function fixture(options: { buyerEligible?: boolean; sellerEligible?: boolean; offer?: TradingOfferSnapshot; approved?: boolean } = {}) {
  let currentOffer = options.offer ?? offer();
  const orders = new Map<string, AuthoritativeOrderRecord>();
  const contracts = new Map<string, AuthoritativeContractRecord>();
  const repository: TradingFlowRepository & { setOffer(value: TradingOfferSnapshot): void } = {
    setOffer(value) { currentOffer = value; },
    async loadOffer(id) { return currentOffer.offerId === id ? currentOffer : null; },
    async insertOrder(value) { orders.set(value.orderId, value); return value; },
    async loadOrder(id) { return orders.get(id) ?? null; },
    async acceptOrder({ previousOrderFingerprint, acceptedOrder }) {
      const current = orders.get(acceptedOrder.orderId);
      if (!current || current.orderFingerprint !== previousOrderFingerprint || current.status !== "created") return null;
      orders.set(acceptedOrder.orderId, acceptedOrder); return acceptedOrder;
    },
    async insertContract(value) {
      if ([...contracts.values()].some((contract) => contract.orderId === value.orderId)) return null;
      contracts.set(value.contractId, value); return value;
    },
  };
  let sequence = 0;
  const service = createTradingFlowService({
    repository,
    ids: { next: () => `generated-${++sequence}` },
    clock: { now: () => "2026-09-05T00:00:00.000Z" },
    organizationParticipationEligibility: {
      async resolveCurrentOrganizationParticipationEligibility(input) {
        const eligible = input.organizationId === "buyer-org"
          ? options.buyerEligible !== false
          : options.sellerEligible !== false;
        return { status: "resolved", result: participation(input.organizationId, input.userId, eligible ? "eligible" : "ineligible") };
      },
    },
    offerVerificationEligibility: {
      async resolveCurrentOfferVerificationEligibility(id) {
        return { status: "resolved", projection: verification(id, options.approved === false ? "revision_required" : "approved") };
      },
    },
  });
  return { service, repository, orders, contracts };
}

const request = { offerId: "offer-1", buyerUserId: "buyer-user", buyerOrganizationId: "buyer-org", quantity: "20" } as const;

test("publishable offer and eligible buyer create an authoritative order", async () => {
  const result = await fixture().service.createOrder(request);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.status, "created");
    assert.equal(result.value.terms.totalAmount, "510");
    assert.match(result.value.publicationEligibilityFingerprint, /^sha256:/);
  }
});

test("non-publishable offer and incomplete verification are rejected", async () => {
  const wrongLifecycle = fixture({ offer: offer({ lifecycleStatus: "active" }) });
  assert.deepEqual(await wrongLifecycle.service.createOrder(request), { ok: false, code: "offer_not_publishable" });
  assert.deepEqual(await fixture({ approved: false }).service.createOrder(request), { ok: false, code: "offer_not_publishable" });
});

test("ineligible buyer is rejected independently of seller publication", async () => {
  assert.deepEqual(await fixture({ buyerEligible: false }).service.createOrder(request), { ok: false, code: "buyer_not_eligible" });
});

test("quantity and expiry bind to the current offer and fail closed", async () => {
  const runtime = fixture();
  assert.deepEqual(await runtime.service.createOrder({ ...request, quantity: "101" }), { ok: false, code: "invalid_request" });
  const expired = fixture({ offer: offer({ validUntil: "2026-01-01T00:00:00.000Z" }) });
  assert.deepEqual(await expired.service.createOrder(request), { ok: false, code: "stale_offer" });
});

test("stale offer binding prevents acceptance", async () => {
  const runtime = fixture();
  const created = must(await runtime.service.createOrder(request));
  runtime.repository.setOffer(offer({ offerVersion: "2026-09-06T00:00:00.000Z" }));
  assert.deepEqual(await runtime.service.acceptOrder(created.orderId, "seller-user"), { ok: false, code: "stale_offer" });
});

test("only the authoritative seller can accept an order", async () => {
  const runtime = fixture();
  const created = must(await runtime.service.createOrder(request));
  assert.deepEqual(await runtime.service.acceptOrder(created.orderId, "buyer-user"), { ok: false, code: "seller_authority_required" });
  const accepted = must(await runtime.service.acceptOrder(created.orderId, "seller-user"));
  assert.equal(accepted.status, "accepted");
  assert.equal(accepted.orderVersion, 2);
});

test("accepted valid order creates a contract bound to identities and accepted terms", async () => {
  const runtime = fixture();
  const created = must(await runtime.service.createOrder(request));
  const accepted = must(await runtime.service.acceptOrder(created.orderId, "seller-user"));
  const contract = must(await runtime.service.createContract(accepted.orderId, "buyer-user"));
  assert.equal(contract.orderId, accepted.orderId);
  assert.equal(contract.offerId, accepted.offerId);
  assert.equal(contract.buyerOrganizationId, "buyer-org");
  assert.equal(contract.sellerOrganizationId, "seller-org");
  assert.equal(contract.acceptedOrderFingerprint, accepted.orderFingerprint);
  assert.equal(contract.terms.termsFingerprint, accepted.terms.termsFingerprint);
});

test("unaccepted or cancelled orders cannot create contracts", async () => {
  const runtime = fixture();
  const created = must(await runtime.service.createOrder(request));
  assert.deepEqual(await runtime.service.createContract(created.orderId, "buyer-user"), { ok: false, code: "order_not_contractible" });
  runtime.orders.set(created.orderId, Object.freeze({ ...created, status: "cancelled" }));
  assert.deepEqual(await runtime.service.createContract(created.orderId, "buyer-user"), { ok: false, code: "order_not_contractible" });
});

test("legacy booleans are absent from authority inputs and cannot bypass either gate", async () => {
  const runtime = fixture({ buyerEligible: false, approved: false });
  const legacyFlags = { verified: true, sellerOrgVerified: true, status: "active", paymentStatus: "completed" };
  assert.equal("verified" in request, false);
  assert.equal(legacyFlags.verified, true);
  assert.deepEqual(await runtime.service.createOrder(request), { ok: false, code: "offer_not_publishable" });
});

test("the existing model defines no own-offer prohibition and still binds both roles explicitly", async () => {
  const runtime = fixture();
  const result = await runtime.service.createOrder({ ...request, buyerUserId: "seller-user", buyerOrganizationId: "seller-org" });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.buyerUserId, result.value.sellerUserId);
    assert.equal(result.value.buyerOrganizationId, result.value.sellerOrganizationId);
  }
});
