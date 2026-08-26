import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { containsDemoIdentifier } from "./productionBoundaryGuard.js";

test("production boundary detects demo IDs among otherwise production-shaped values", () => {
  assert.equal(containsDemoIdentifier(["offer-1", "organization-1"]), false);
  assert.equal(containsDemoIdentifier(["offer-1", "demo:org:session-user"]), true);
  assert.equal(containsDemoIdentifier(["demo:order:one"]), true);
  assert.equal(containsDemoIdentifier(["demo:unknown:forged"]), true);
  assert.equal(containsDemoIdentifier(["demo:"]), true);
  assert.equal(containsDemoIdentifier([undefined, null, ""]), false);
});

test("production route guards execute before trading authority calls", () => {
  const source = readFileSync(new URL("../routes.ts", import.meta.url), "utf8");
  const orderRoute = source.indexOf("app.post('/api/orders'");
  const orderGuard = source.indexOf("containsDemoIdentifier", orderRoute);
  const orderAuthority = source.indexOf("productionTradingFlowService.createOrder", orderRoute);
  assert.ok(orderRoute >= 0 && orderGuard > orderRoute && orderGuard < orderAuthority);
  const contractRoute = source.indexOf("app.post('/api/contracts'");
  const contractGuard = source.indexOf("containsDemoIdentifier", contractRoute);
  const contractAuthority = source.indexOf("productionTradingFlowService.createContract", contractRoute);
  assert.ok(contractRoute >= 0 && contractGuard > contractRoute && contractGuard < contractAuthority);
});

test("organization and evidence guards execute before production application service", () => {
  const source = readFileSync(new URL("../trade-trust-application/routes.ts", import.meta.url), "utf8");
  for (const method of [
    "addMembership",
    "changeMembership",
    "submitOrganizationEvidence",
    "initiateOrganizationVerification",
    "submitOfferEvidence",
    "evaluateTradeParticipation",
  ]) {
    const authority = source.indexOf(`service.${method}`);
    const routeStart = source.lastIndexOf("app.", authority);
    const guard = source.indexOf("rejectDemoIdentifiers", routeStart);
    assert.ok(routeStart >= 0 && guard > routeStart && guard < authority, `${method} must be guarded`);
  }
});
