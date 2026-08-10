import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDemoContractPreview,
  getDemoMarketplaceOffers,
  getDemoMarketplaceSummary,
  initializeDemoSession,
} from "./demo.js";

test("demo marketplace exposes isolated publishable presentation records", () => {
  const offers = getDemoMarketplaceOffers();

  assert.equal(offers.length, 15);
  assert.ok(
    offers.every(
      (offer) =>
        offer.trust.offerVerification.state === "verified" &&
        offer.trust.sellerOrganizationVerification.state === "verified" &&
        offer.visibility.state === "published",
    ),
  );
  assert.ok(offers.every((offer) => !Object.hasOwn(offer, "user")));
});

test("demo marketplace summary is derived without server state", () => {
  const summary = getDemoMarketplaceSummary();

  assert.equal(summary.activeOffers, 15);
  assert.equal(summary.publishedOffers, 15);
  assert.equal(summary.avgPriceCount, 15);
  assert.ok(summary.marketValueUsd > 0);
});

test("starting demo again clears the disabled flag and stale simulations", () => {
  const values = new Map<string, string>([
    ["tutela_demo_disabled", "1"],
    ["t_res", "stale-reservation"],
    ["t_neg", "stale-negotiation"],
  ]);
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };

  initializeDemoSession(storage, "verified");

  assert.equal(values.has("tutela_demo_disabled"), false);
  assert.equal(values.get("tutela_demo"), "1");
  assert.equal(values.get("tutela_demo_mode"), "verified");
  assert.equal(values.has("t_res"), false);
  assert.equal(values.has("t_neg"), false);
});

test("demo reservation produces a deterministic simulation-only contract preview", () => {
  const reservation = {
    id: "reservation-1",
    offerId: "demo-o1",
    buyerId: "demo-user",
    qty: 1000,
    createdAt: "2026-08-10T10:00:00.000Z",
    expiresAt: "2026-08-10T10:30:00.000Z",
    status: "active" as const,
  };

  const preview = buildDemoContractPreview(
    reservation,
    new Date("2026-08-10T10:15:00.000Z"),
  );

  assert.equal(preview?.id, "demo-contract-reservation-1");
  assert.equal(preview?.simulation, true);
  assert.equal(preview?.status, "draft_preview");
  assert.equal(preview?.commodityName, "Crude Oil");
  assert.equal(preview?.quantity, 1000);
  assert.equal(preview?.totalAmount, 78_450);
  assert.equal(preview?.reservationExpiresAt, reservation.expiresAt);
});

test("demo contract preview fails closed for unknown or inactive reservations", () => {
  const base = {
    id: "reservation-2",
    buyerId: "demo-user",
    qty: 1000,
    createdAt: "2026-08-10T10:00:00.000Z",
    expiresAt: "2026-08-10T10:30:00.000Z",
  };

  assert.equal(
    buildDemoContractPreview(
      { ...base, offerId: "unknown", status: "active" },
      new Date("2026-08-10T10:15:00.000Z"),
    ),
    undefined,
  );
  assert.equal(
    buildDemoContractPreview(
      { ...base, offerId: "demo-o1", status: "expired" },
      new Date("2026-08-10T10:15:00.000Z"),
    ),
    undefined,
  );
  assert.equal(
    buildDemoContractPreview(
      { ...base, offerId: "demo-o1", status: "active" },
      new Date("2026-08-10T10:30:00.000Z"),
    ),
    undefined,
  );
});
