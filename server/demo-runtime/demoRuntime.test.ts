import assert from "node:assert/strict";
import test from "node:test";

import {
  DEMO_CONTRACT_LEGAL_MARKER,
  DEMO_HERO_MISSIONS,
  DEMO_MISSION_STEPS,
  DEMO_OFFER_CATALOG,
  DEMO_ORGANIZATIONS,
  advanceDemoHeroMission,
  createDemoContract,
  createDemoHeroMission,
  createDemoOrder,
  createDemoOrderAcceptance,
  createDemoSession,
  createDemoSessionReset,
  isDemoId,
  isDemoIdOfKind,
  isProductionIdCandidate,
} from "./index.js";

const PRODUCTION_E2E_OFFER_IDS = new Set([
  "1ac40e15-40ea-4519-98f8-da8c5248fd3f",
  "e4be04ac-a3b2-4c2c-a1b2-6e6ea0123a0a",
]);

test("canonical catalog contains exactly fifteen immutable active listings", () => {
  assert.equal(DEMO_OFFER_CATALOG.length, 15);
  assert.ok(Object.isFrozen(DEMO_OFFER_CATALOG));
  assert.ok(
    DEMO_OFFER_CATALOG.every(
      (offer) =>
        Object.isFrozen(offer) &&
        Object.isFrozen(offer.specifications) &&
        offer.status === "active" &&
        offer.simulation &&
        !offer.productionAuthority,
    ),
  );
  assert.equal(new Set(DEMO_OFFER_CATALOG.map((offer) => offer.offerId)).size, 15);
});

test("fixture IDs are demo namespaced and never reuse production E2E offers", () => {
  assert.ok(
    DEMO_OFFER_CATALOG.every(
      (offer) =>
        isDemoIdOfKind(offer.offerId, "offer") &&
        !PRODUCTION_E2E_OFFER_IDS.has(offer.offerId),
    ),
  );
  assert.ok(
    DEMO_ORGANIZATIONS.every((organization) =>
      isDemoIdOfKind(organization.organizationId, "org"),
    ),
  );
});

test("all six organizations are explicitly fictional presentation-only simulations", () => {
  assert.equal(DEMO_ORGANIZATIONS.length, 6);
  assert.ok(Object.isFrozen(DEMO_ORGANIZATIONS));
  for (const organization of DEMO_ORGANIZATIONS) {
    assert.equal(organization.fictional, true);
    assert.equal(organization.authorityPresentation.simulation, true);
    assert.equal(organization.authorityPresentation.canonicalAuthority, false);
    assert.equal(
      organization.authorityPresentation.organizationVerification,
      "Verified — Simulation",
    );
    assert.equal(organization.authorityPresentation.trust, "Established — Simulation");
    assert.equal(
      organization.authorityPresentation.tradingEligibility,
      "Eligible — Simulation",
    );
  }
});

test("three deterministic hero missions reference valid catalog offers", () => {
  const offers = new Set(DEMO_OFFER_CATALOG.map((offer) => offer.offerId));
  assert.equal(DEMO_HERO_MISSIONS.length, 3);
  for (const mission of DEMO_HERO_MISSIONS) {
    assert.ok(offers.has(mission.offerId));
    assert.deepEqual(mission.steps, DEMO_MISSION_STEPS);
    assert.ok(Object.isFrozen(mission));
    assert.ok(Object.isFrozen(mission.steps));
  }
});

test("mission progress is session-scoped and advances only in deterministic order", () => {
  const first = createDemoHeroMission(
    DEMO_HERO_MISSIONS[0],
    "demo:session:qualified-user-one",
  );
  const other = createDemoHeroMission(
    DEMO_HERO_MISSIONS[0],
    "demo:session:qualified-user-two",
  );
  assert.ok(first);
  assert.ok(other);
  assert.notEqual(first.demoSessionId, other.demoSessionId);
  assert.equal(first.currentStep, "review_organization");
  assert.equal(advanceDemoHeroMission(first, "review_offer"), undefined);
  const next = advanceDemoHeroMission(first, "review_organization");
  assert.equal(next?.currentStep, "review_offer");
  assert.deepEqual(next?.completedSteps, ["review_organization"]);
});

test("demo session TTL and owner-scoped reset contract fail closed", () => {
  const session = createDemoSession({
    demoSessionId: "demo:session:qualified-user-one",
    grantId: "demo:access-grant:qualified-user-one",
    ownerUserReference: "qualified-user-one",
    startedAt: "2026-08-26T10:00:00.000Z",
    expiresAt: "2026-08-26T11:30:00.000Z",
    ttlMinutes: 90,
  });
  assert.ok(session);
  assert.equal(
    createDemoSession({
      ...session,
      ttlMinutes: 30,
    }),
    undefined,
  );
  assert.equal(
    createDemoSessionReset(session, {
      ownerUserReference: "different-user",
      resetAt: "2026-08-26T10:30:00.000Z",
    }),
    undefined,
  );
  const reset = createDemoSessionReset(session, {
    ownerUserReference: "qualified-user-one",
    resetAt: "2026-08-26T10:30:00.000Z",
  });
  assert.equal(reset?.result, "baseline_restored");
  assert.equal(reset?.clearsSessionOrders, true);
  assert.equal(reset?.clearsSessionContracts, true);
  assert.equal(reset?.clearsMissionProgress, true);
});

test("demo order, acceptance, and contract are always simulation and non-binding", () => {
  const order = createDemoOrder({
    orderId: "demo:order:wti-one",
    demoSessionId: "demo:session:qualified-user-one",
    scenarioId: "demo:mission:wti-complete-trade",
    offerId: "demo:offer:wti-houston",
    buyerOrganizationId: "demo:org:northstar-meridian-procurement",
    sellerOrganizationId: "demo:org:aster-gulf-energy",
    quantity: "1000",
    unit: "barrel",
    pricePerUnit: "78.45",
    currency: "USD",
    submittedAt: "2026-08-26T10:20:00.000Z",
  });
  const acceptance = createDemoOrderAcceptance({
    acceptanceId: "demo:acceptance:wti-one",
    demoSessionId: "demo:session:qualified-user-one",
    scenarioId: "demo:mission:wti-complete-trade",
    orderId: "demo:order:wti-one",
    acceptedAt: "2026-08-26T10:20:01.000Z",
  });
  const contract = createDemoContract({
    contractId: "demo:contract:wti-one",
    demoSessionId: "demo:session:qualified-user-one",
    scenarioId: "demo:mission:wti-complete-trade",
    orderId: "demo:order:wti-one",
    acceptanceId: "demo:acceptance:wti-one",
    offerId: "demo:offer:wti-houston",
    buyerOrganizationId: "demo:org:northstar-meridian-procurement",
    sellerOrganizationId: "demo:org:aster-gulf-energy",
    quantity: "1000",
    unit: "barrel",
    pricePerUnit: "78.45",
    totalAmount: "78450",
    currency: "USD",
    createdAt: "2026-08-26T10:20:02.000Z",
  });
  assert.ok(order);
  assert.ok(acceptance);
  assert.ok(contract);
  assert.equal(order.simulation, true);
  assert.equal(order.nonBinding, true);
  assert.equal(acceptance.mode, "deterministic_simulation");
  assert.equal(acceptance.nonBinding, true);
  assert.equal(contract.simulation, true);
  assert.equal(contract.nonBinding, true);
  assert.equal(contract.legalMarker, DEMO_CONTRACT_LEGAL_MARKER);
});

test("demo identifiers are rejected by the production-candidate boundary", () => {
  assert.equal(isDemoId("demo:offer:wti-houston"), true);
  assert.equal(isProductionIdCandidate("demo:offer:wti-houston"), false);
  assert.equal(isProductionIdCandidate("production-offer-123"), true);
  assert.equal(isDemoId("production-offer-123"), false);
  assert.equal(isDemoId("demo:unknown:value"), false);
});
