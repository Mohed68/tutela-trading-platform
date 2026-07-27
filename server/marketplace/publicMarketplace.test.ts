import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMarketplaceOptions,
  buildMarketplaceSummary,
  filterPublishedMarketplaceOffers,
  hasCompletePublicationProof,
  projectPublishedOffer,
  type PublishedOfferRow,
} from "./publicMarketplace.js";

const verifiedRow: PublishedOfferRow = {
  id: "public-offer",
  offer_verified: true,
  seller_organization_verified: true,
  offer_type: "sell",
  quantity: "10.00",
  unit: "MT",
  price_per_unit: "100.00",
  currency: "USD",
  location: "Public location",
  status: "active",
  valid_until: null,
  minimum_quantity: null,
  delivery_terms: null,
  payment_terms: null,
  created_at: null,
  updated_at: null,
  commodity_id: "commodity",
  commodity_name: "Public commodity",
  commodity_category: "agricultural",
};

test("publication proof requires two explicit true values and active status", () => {
  assert.equal(
    hasCompletePublicationProof({
      offerVerified: true,
      sellerOrganizationVerified: true,
      status: "active",
    }),
    true,
  );

  for (const input of [
    {
      offerVerified: undefined,
      sellerOrganizationVerified: true,
      status: "active",
    },
    {
      offerVerified: null,
      sellerOrganizationVerified: true,
      status: "active",
    },
    {
      offerVerified: false,
      sellerOrganizationVerified: true,
      status: "active",
    },
    {
      offerVerified: true,
      sellerOrganizationVerified: undefined,
      status: "active",
    },
    {
      offerVerified: true,
      sellerOrganizationVerified: null,
      status: "active",
    },
    {
      offerVerified: true,
      sellerOrganizationVerified: false,
      status: "active",
    },
    {
      offerVerified: true,
      sellerOrganizationVerified: true,
      status: "pending",
    },
  ]) {
    assert.equal(hasCompletePublicationProof(input), false);
  }
});

test("projection rejects rows without complete authoritative proof", () => {
  assert.throws(
    () =>
      projectPublishedOffer({
        ...verifiedRow,
        offer_verified: null,
      }),
    /MARKETPLACE_PUBLICATION_PROOF_REQUIRED/,
  );
  assert.throws(
    () =>
      projectPublishedOffer({
        ...verifiedRow,
        seller_organization_verified: false,
      }),
    /MARKETPLACE_PUBLICATION_PROOF_REQUIRED/,
  );
});

test("public projection excludes seller keys and sensitive user data", () => {
  const record = projectPublishedOffer(verifiedRow);
  assert.equal(record.offer.trust.offerVerification.state, "verified");
  assert.equal(
    record.offer.trust.sellerOrganizationVerification.state,
    "verified",
  );
  assert.equal(record.offer.visibility.state, "published");
  assert.equal(record.offer.seller.displayName, null);

  const serialized = JSON.stringify(record.offer);
  for (const forbidden of [
    "userId",
    "user_id",
    "email",
    "password",
    "firstName",
    "lastName",
    "kyb",
    "moderation",
    "document",
  ]) {
    assert.ok(!serialized.toLowerCase().includes(forbidden.toLowerCase()));
  }
});

test("empty published population produces aligned list helpers", () => {
  assert.deepEqual(
    filterPublishedMarketplaceOffers([], {
      category: "agricultural",
      commodityKey: "public_commodity",
      q: "commodity",
    }),
    [],
  );
  assert.deepEqual(buildMarketplaceOptions([]), { commodities: [] });
  assert.deepEqual(buildMarketplaceSummary([]), {
    activeOffers: 0,
    publishedOffers: 0,
    marketValueUsd: 0,
    avgPrice: null,
    avgPriceUnit: undefined,
    avgPriceCount: 0,
    avgPriceCoverage: { used: 0, skipped: 0 },
    median: null,
    p25: null,
    p75: null,
  });
});
