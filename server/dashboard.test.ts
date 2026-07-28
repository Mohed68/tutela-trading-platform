import assert from "node:assert/strict";
import test from "node:test";
import type { CurrentUserDto } from "@shared/auth";
import { buildDashboardOverview } from "./dashboard.js";

const account: CurrentUserDto = {
  id: "recovery-user",
  displayName: "Recovery trader",
  role: "trader",
  authenticated: true,
  accountState: "active",
  organizationDisplayName: null,
  emailVerified: "unknown",
  userVerified: "unknown",
  kybState: "unknown",
  organizationVerification: "unknown",
};

test("dashboard DTO exposes only the approved account projection", () => {
  const overview = buildDashboardOverview(
    account,
    { status: "fulfilled", value: 0 },
    { status: "fulfilled", value: 0 },
  );

  assert.deepEqual(overview.account, {
    state: "available",
    data: account,
  });
  assert.deepEqual(Object.keys(overview.account.data ?? {}).sort(), [
    "accountState",
    "authenticated",
    "displayName",
    "emailVerified",
    "id",
    "kybState",
    "organizationDisplayName",
    "organizationVerification",
    "role",
    "userVerified",
  ]);
  assert.equal("email" in (overview.account.data ?? {}), false);
  assert.equal("passwordHash" in (overview.account.data ?? {}), false);
});

test("authoritative zero offer results are represented as empty", () => {
  const overview = buildDashboardOverview(
    account,
    { status: "fulfilled", value: 0 },
    { status: "fulfilled", value: 0 },
  );

  assert.deepEqual(overview.myOffers, {
    state: "empty",
    data: { count: 0 },
  });
  assert.deepEqual(overview.publicMarketplace, {
    state: "empty",
    data: {
      publishedOffers: 0,
      publicationPolicy:
        "verified_offer_and_verified_seller_organization",
    },
  });
});

test("unresolved business modules are unavailable rather than numeric zero", () => {
  const overview = buildDashboardOverview(
    account,
    { status: "fulfilled", value: 0 },
    { status: "fulfilled", value: 0 },
  );

  for (const module of [
    overview.contracts,
    overview.orders,
    overview.activity,
    overview.verification,
    overview.subscription,
    overview.performanceInsights,
    overview.aiRecommendations,
  ]) {
    assert.deepEqual(module, { state: "unavailable", data: null });
  }
});

test("unavailable KYB is neither approved nor failed", () => {
  const overview = buildDashboardOverview(
    account,
    { status: "fulfilled", value: 0 },
    { status: "fulfilled", value: 0 },
  );

  assert.deepEqual(overview.kyb, {
    state: "unavailable",
    data: null,
  });
  const serialized = JSON.stringify(overview.kyb);
  assert.doesNotMatch(serialized, /approved|verified|failed|rejected/i);
});

test("an optional owned-offer failure does not crash other modules", () => {
  const overview = buildDashboardOverview(
    account,
    { status: "rejected", reason: new Error("not exposed") },
    { status: "fulfilled", value: 0 },
  );

  assert.deepEqual(overview.myOffers, { state: "error", data: null });
  assert.equal(overview.account.state, "available");
  assert.equal(overview.session.state, "available");
  assert.equal(overview.publicMarketplace.state, "empty");
  assert.doesNotMatch(JSON.stringify(overview), /not exposed/);
});

test("an optional marketplace failure does not crash other modules", () => {
  const overview = buildDashboardOverview(
    account,
    { status: "fulfilled", value: 0 },
    { status: "rejected", reason: new Error("database detail") },
  );

  assert.deepEqual(overview.publicMarketplace, {
    state: "error",
    data: null,
  });
  assert.equal(overview.account.state, "available");
  assert.equal(overview.session.state, "available");
  assert.equal(overview.myOffers.state, "empty");
  assert.doesNotMatch(JSON.stringify(overview), /database detail/);
});
