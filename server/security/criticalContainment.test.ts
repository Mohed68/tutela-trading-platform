import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import express from "express";

import {
  canCloseOwnedOffer,
  canResolvePartnerRequest,
  registerRetiredLegacyAuthorityRoutes,
  toSafeUserSummary,
} from "./criticalContainment.js";

test("retired legacy authority routes are unavailable to every caller", async () => {
  const app = express();
  registerRetiredLegacyAuthorityRoutes(app);
  const server = app.listen(0);
  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const base = `http://127.0.0.1:${address.port}`;
    for (const [method, path] of [
      ["GET", "/api/verification/pending"],
      ["PATCH", "/api/verification/arbitrary/status"],
      ["POST", "/api/commodities"],
      ["GET", "/api/offers/arbitrary"],
      ["POST", "/api/offers/arbitrary/verify"],
    ] as const) {
      const response = await fetch(`${base}${path}`, { method });
      assert.equal(response.status, 404, `${method} ${path}`);
      const body = await response.text();
      assert.doesNotMatch(body, /passwordHash|adminRole/);
    }
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

test("only the target may resolve a pending partner request", () => {
  const pending = { partnerId: "target", status: "pending" } as const;
  assert.equal(canResolvePartnerRequest(pending, "target", "approved"), true);
  assert.equal(canResolvePartnerRequest(pending, "target", "rejected"), true);
  assert.equal(canResolvePartnerRequest(pending, "requester", "approved"), false);
  assert.equal(canResolvePartnerRequest(pending, "target", "pending"), false);
  assert.equal(canResolvePartnerRequest({ partnerId: "target", status: "approved" }, "target", "rejected"), false);
});

test("offer status containment requires ownership and terminal owner action", () => {
  const offer = { userId: "owner" };
  assert.equal(canCloseOwnedOffer(offer, "owner", "closed"), true);
  assert.equal(canCloseOwnedOffer(offer, "owner", "cancelled"), true);
  assert.equal(canCloseOwnedOffer(offer, "other", "closed"), false);
  assert.equal(canCloseOwnedOffer(offer, "owner", "verified"), false);
  assert.equal(canCloseOwnedOffer(offer, "owner", "active"), false);
});

test("ordinary API user projection excludes authentication and platform fields", () => {
  const projected = toSafeUserSummary({
    id: "user-1",
    firstName: "Safe",
    lastName: "User",
    companyName: "Example",
    profileImageUrl: null,
    financialRating: "0",
    creditRating: "unrated",
    verified: false,
    passwordHash: "secret-hash",
    adminRole: "admin",
  } as never);
  assert.equal("passwordHash" in projected, false);
  assert.equal("adminRole" in projected, false);
  assert.equal("authProvider" in projected, false);
  assert.equal("is2FAEnabled" in projected, false);
});

test("production routes install containment and do not retain unsafe handlers", () => {
  const routes = readFileSync(new URL("../routes.ts", import.meta.url), "utf8");
  assert.match(routes, /registerRetiredLegacyAuthorityRoutes\(app\)/);
  assert.doesNotMatch(routes, /storage\.getPendingVerifications\(\)/);
  assert.doesNotMatch(routes, /storage\.updateVerificationStatus\(req\.params\.id/);
  assert.doesNotMatch(routes, /storage\.createCommodity\(/);
  assert.doesNotMatch(routes, /res\.json\(partners\)/);
  assert.doesNotMatch(routes, /res\.json\(contracts\)/);
  assert.doesNotMatch(routes, /localStorage/);
});
