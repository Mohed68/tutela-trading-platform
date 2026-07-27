import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function source(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("marketplace empty state explains the strict verification policy", () => {
  const offerList = source(
    "client/src/features/offers/views/OfferList.tsx",
  );
  assert.match(
    offerList,
    /No verified offers are currently available/,
  );
  assert.match(
    offerList,
    /both offer and seller-organization verification are confirmed/,
  );
});

test("active marketplace views contain no unsupported KYB or trader claims", () => {
  const activeSources = [
    source(
      "client/src/features/offers/components/OfferCardDetailed.tsx",
    ),
    source("client/src/components/offers/OfferDetailModal.tsx"),
    source("client/src/components/MarketplaceInsights.tsx"),
    source("client/src/pages/marketplace.tsx"),
  ].join("\n");

  for (const unsupportedClaim of [
    "Pending KYB",
    "Verified Trader",
    "KYB verification completed",
    "5.0 Rating",
  ]) {
    assert.ok(!activeSources.includes(unsupportedClaim));
  }
});

test("active public detail view does not consume joined-user identity", () => {
  const detail = source(
    "client/src/components/offers/OfferDetailModal.tsx",
  );
  for (const forbiddenAccess of [
    "offer.user",
    "offer.contactName",
    "offer.contactLastName",
  ]) {
    assert.ok(!detail.includes(forbiddenAccess));
  }
});
