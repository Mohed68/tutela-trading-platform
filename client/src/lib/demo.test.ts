import assert from "node:assert/strict";
import test from "node:test";
import {
  getDemoMarketplaceOffers,
  getDemoMarketplaceSummary,
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
