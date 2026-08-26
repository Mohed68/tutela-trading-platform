import assert from "node:assert/strict";
import test from "node:test";

import { createDemoSimulationApplicationService } from "./applicationService.js";
import {
  InMemoryDemoAccessGrantStore,
  InMemoryDemoAnalyticsAdapter,
  InMemoryDemoSessionStore,
} from "./inMemoryStores.js";
import type { DemoId } from "./ids.js";

const BUSINESS_REQUEST = Object.freeze({
  firstName: "Nadia",
  lastName: "Hassan",
  businessEmail: "nadia@qualified-trader.example",
  company: "Qualified Trader Example",
  country: "Saudi Arabia",
  jobRole: "Commercial Director",
  tradeRole: "buyer" as const,
  primaryInterest: "Energy",
});

function harness() {
  let current = "2026-08-26T10:00:00.000Z";
  let sequence = 0;
  const delivered: { recipient: string; token: string }[] = [];
  const accessGrants = new InMemoryDemoAccessGrantStore();
  const sessions = new InMemoryDemoSessionStore();
  const analytics = new InMemoryDemoAnalyticsAdapter();
  const service = createDemoSimulationApplicationService({
    accessGrants,
    sessions,
    analytics,
    clock: { now: () => current },
    ids: {
      next(kind) {
        sequence += 1;
        return `demo:${kind}:generated-${sequence}` as DemoId<typeof kind>;
      },
    },
    tokens: {
      next: () => `secure-demo-token-${String(sequence + 1).padStart(48, "x")}`,
    },
    emailSender: {
      async send(message) {
        delivered.push(message);
      },
    },
  });
  return {
    service,
    accessGrants,
    sessions,
    analytics,
    delivered,
    setTime(value: string) { current = value; },
  };
}

async function qualifyAndStart(
  value: ReturnType<typeof harness>,
  suffix = "one",
) {
  const request = {
    ...BUSINESS_REQUEST,
    businessEmail: `nadia-${suffix}@qualified-trader.example`,
  };
  assert.equal((await value.service.requestAccess(request)).ok, true);
  const token = value.delivered.at(-1)?.token;
  assert.ok(token);
  const verified = await value.service.verifyAccess(token);
  assert.equal(verified.ok, true);
  if (!verified.ok) throw new Error("qualification failed");
  const session = await value.service.createSession(verified.value.grantId);
  assert.equal(session.ok, true);
  if (!session.ok) throw new Error("session failed");
  return {
    grantId: verified.value.grantId,
    demoSessionId: session.value.session.demoSessionId,
  };
}

test("public email is rejected while a business email is accepted generically", async () => {
  const value = harness();
  const rejected = await value.service.requestAccess({
    ...BUSINESS_REQUEST,
    businessEmail: "nadia@gmail.com",
  });
  assert.deepEqual(rejected, { ok:false, code:"business_email_required" });
  const accepted = await value.service.requestAccess(BUSINESS_REQUEST);
  assert.deepEqual(accepted, { ok:true, value:{ accepted:true } });
  assert.equal(value.delivered.length, 1);
});

test("verification token is hashed at rest, expires, and can be consumed once", async () => {
  const value = harness();
  await value.service.requestAccess(BUSINESS_REQUEST);
  const raw = value.delivered[0].token;
  const pending = await value.accessGrants.findByNormalizedEmail(BUSINESS_REQUEST.businessEmail);
  assert.equal(pending?.status, "pending");
  if (pending?.status !== "pending") throw new Error("pending grant missing");
  assert.notEqual(pending.tokenDigest, raw);
  assert.equal(pending.tokenDigest.length, 64);
  assert.equal((await value.service.verifyAccess(raw)).ok, true);
  assert.deepEqual(await value.service.verifyAccess(raw), { ok:false, code:"invalid_or_expired_token" });

  const expired = harness();
  await expired.service.requestAccess({ ...BUSINESS_REQUEST, businessEmail:"expired@business.example" });
  const expiredToken = expired.delivered[0].token;
  expired.setTime("2026-08-27T10:00:01.000Z");
  assert.deepEqual(await expired.service.verifyAccess(expiredToken), { ok:false, code:"invalid_or_expired_token" });
});

test("access request is anti-enumerating for an already verified address", async () => {
  const value = harness();
  await value.service.requestAccess(BUSINESS_REQUEST);
  await value.service.verifyAccess(value.delivered[0].token);
  const repeated = await value.service.requestAccess(BUSINESS_REQUEST);
  assert.deepEqual(repeated, { ok:true, value:{ accepted:true } });
  assert.equal(value.delivered.length, 1);
});

test("verified grant is required and creates one isolated 90-minute session", async () => {
  const value = harness();
  assert.deepEqual(await value.service.createSession("demo:access-grant:unknown"), { ok:false, code:"verified_grant_required" });
  const context = await qualifyAndStart(value);
  const loaded = await value.service.getSession(context);
  assert.equal(loaded.ok, true);
  if (!loaded.ok) throw new Error("session missing");
  assert.equal(loaded.value.session.ttlMinutes, 90);
  assert.deepEqual(loaded.value.visitor, {
    firstName: "Nadia",
    lastName: "Hassan",
    company: "Qualified Trader Example",
    tradeRole: "buyer",
  });
  assert.equal(loaded.value.missions.length, 0);
  assert.equal(loaded.value.orders.length, 0);
  assert.equal(loaded.value.contracts.length, 0);
  const same = await value.service.createSession(context.grantId);
  assert.equal(same.ok && same.value.session.demoSessionId, context.demoSessionId);
});

test("expired session fails closed without production fallback", async () => {
  const value = harness();
  const context = await qualifyAndStart(value);
  value.setTime("2026-08-26T11:30:00.000Z");
  assert.deepEqual(await value.service.getSession(context), { ok:false, code:"session_expired" });
  assert.ok(value.analytics.events.some((event) => event.event === "demo_expired"));
});

test("marketplace exposes exactly fifteen namespaced active offers and filters them", async () => {
  const value = harness();
  const context = await qualifyAndStart(value);
  const all = await value.service.listOffers(context);
  assert.equal(all.ok && all.value.length, 15);
  assert.ok(all.ok && all.value.every((offer) => offer.status === "active" && offer.offerId.startsWith("demo:offer:")));
  const energySells = await value.service.listOffers(context, { category:"energy", side:"sell" });
  assert.ok(energySells.ok && energySells.value.length > 0);
  assert.ok(energySells.ok && energySells.value.every((offer) => offer.category === "energy" && offer.side === "sell"));
  const copper = await value.service.listOffers(context, { query:"copper" });
  assert.equal(copper.ok && copper.value.length, 1);
});

test("server controls hero progress and the WTI mission reaches a non-binding contract", async () => {
  const value = harness();
  const context = await qualifyAndStart(value);
  const missionId = "demo:mission:wti-complete-trade";
  const started = await value.service.startMission(context, missionId);
  assert.equal(started.ok && started.value.currentStep, "review_organization");
  await value.service.getOffer(context, "demo:offer:wti-houston");
  let mission = await value.service.getMission(context, missionId);
  assert.equal(mission.ok && mission.value.progress?.currentStep, "review_organization");
  await value.service.getOrganization(context, "demo:org:aster-gulf-energy");
  await value.service.getOffer(context, "demo:offer:wti-houston");
  await value.service.getOfferEvidence(context, "demo:offer:wti-houston");
  const order = await value.service.createOrder(context, { offerId:"demo:offer:wti-houston", quantity:"1000" });
  assert.equal(order.ok, true);
  if (!order.ok) throw new Error("order missing");
  assert.equal(order.value.simulation, true);
  assert.equal(order.value.nonBinding, true);
  const accepted = await value.service.acceptOrder(context, order.value.orderId);
  assert.equal(accepted.ok, true);
  if (!accepted.ok) throw new Error("acceptance missing");
  const acceptedAgain = await value.service.acceptOrder(context, order.value.orderId);
  assert.equal(acceptedAgain.ok && acceptedAgain.value.acceptanceId, accepted.value.acceptanceId);
  const acceptedState = await value.service.getSession(context);
  assert.equal(
    acceptedState.ok && acceptedState.value.orders.find((candidate) => candidate.orderId === order.value.orderId)?.status,
    "accepted",
  );
  const contract = await value.service.createContract(context, order.value.orderId);
  assert.equal(contract.ok, true);
  if (!contract.ok) throw new Error("contract missing");
  assert.equal(contract.value.legalMarker, "SIMULATION — NON-BINDING");
  assert.equal(contract.value.simulation, true);
  assert.equal(contract.value.nonBinding, true);
  await value.service.getContract(context, contract.value.contractId);
  mission = await value.service.getMission(context, missionId);
  assert.equal(mission.ok && mission.value.progress?.completionState, "completed");
});

test("contract fails closed before deterministic seller acceptance", async () => {
  const value = harness();
  const context = await qualifyAndStart(value);
  const order = await value.service.createOrder(context, { offerId:"demo:offer:wti-houston", quantity:"1000" });
  if (!order.ok) throw new Error("order missing");
  assert.deepEqual(await value.service.createContract(context, order.value.orderId), { ok:false, code:"order_not_accepted" });
});

test("session ownership blocks cross-session order and contract access", async () => {
  const value = harness();
  const first = await qualifyAndStart(value, "first");
  const second = await qualifyAndStart(value, "second");
  const order = await value.service.createOrder(first, { offerId:"demo:offer:wti-houston", quantity:"1000" });
  if (!order.ok) throw new Error("order missing");
  assert.deepEqual(await value.service.acceptOrder(second, order.value.orderId), { ok:false, code:"not_found" });
});

test("owner reset is idempotent and clears only session-owned runtime state", async () => {
  const value = harness();
  const context = await qualifyAndStart(value);
  await value.service.startMission(context, "demo:mission:wti-complete-trade");
  await value.service.createOrder(context, { offerId:"demo:offer:wti-houston", quantity:"1000" });
  const first = await value.service.resetSession(context);
  const second = await value.service.resetSession(context);
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  if (!second.ok) throw new Error("reset failed");
  assert.equal(second.value.missions.length, 0);
  assert.equal(second.value.orders.length, 0);
  assert.equal(second.value.acceptances.length, 0);
  assert.equal(second.value.contracts.length, 0);
  assert.ok(await value.accessGrants.getById(context.grantId));
});
