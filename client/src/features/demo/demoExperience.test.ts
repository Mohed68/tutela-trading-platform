import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { DEMO_OFFER_CATALOG } from "../../../../server/demo-runtime/fixtureCatalog.js";
import { ASSURANCE_COPY, filterDemoOffers, HERO_OFFER_IDS } from "./presentation.js";
import { demoRoutes } from "./routes.js";
import { demoApi } from "./api.js";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");
const demoClientFiles = [
  "client/src/features/demo/api.ts",
  "client/src/features/demo/DemoContext.tsx",
  "client/src/features/demo/DemoShell.tsx",
  "client/src/pages/demo-request.tsx",
  "client/src/pages/demo-check-email.tsx",
  "client/src/pages/demo-verify.tsx",
  "client/src/pages/demo-landing.tsx",
  "client/src/pages/demo-marketplace.tsx",
  "client/src/pages/demo-missions.tsx",
  "client/src/pages/demo-organization.tsx",
  "client/src/pages/demo-offer.tsx",
  "client/src/pages/demo-order.tsx",
  "client/src/pages/demo-contract.tsx",
];

test("qualified demo catalog presents exactly fifteen API-backed opportunities", () => {
  assert.equal(DEMO_OFFER_CATALOG.length, 15);
  assert.equal(new Set(DEMO_OFFER_CATALOG.map((offer) => offer.offerId)).size, 15);
  assert.equal(HERO_OFFER_IDS.size, 3);
  assert.ok([...HERO_OFFER_IDS].every((id) => DEMO_OFFER_CATALOG.some((offer) => offer.offerId === id)));
});

test("marketplace presentation filters search, category, side, and location", () => {
  const copper = filterDemoOffers(DEMO_OFFER_CATALOG, { search:"copper", category:"metals", side:"sell", location:"Shanghai" });
  assert.deepEqual(copper.map((offer) => offer.offerId), ["demo:offer:copper-cathode-shanghai"]);
  const impossible = filterDemoOffers(DEMO_OFFER_CATALOG, { search:"wti", category:"agriculture", side:"", location:"" });
  assert.equal(impossible.length, 0);
});

test("all three progressive assurance levels have customer-safe explanations", () => {
  assert.deepEqual(Object.keys(ASSURANCE_COPY).sort(), ["documentary","independently_inspected","source_confirmed"]);
  assert.ok(Object.values(ASSURANCE_COPY).every((copy) => copy.length > 30));
});

test("production-facing demo client is isolated from legacy browser authority and production mutations", () => {
  const source = demoClientFiles.map(read).join("\n");
  assert.doesNotMatch(source, /localStorage|marketStore|@\/lib\/demo|DEMO_CURRENT_USER/);
  assert.doesNotMatch(source, /demo@tutela\.com|Demo User/);
  assert.doesNotMatch(source, /["'`]\/api\/(?!demo\/)/);
  assert.match(read("client/src/features/demo/api.ts"), /\/api\/demo\/orders/);
  assert.match(read("client/src/features/demo/api.ts"), /\/api\/demo\/sessions/);
});

test("explicit demo routes replace the legacy localStorage route authority", () => {
  const app = read("client/src/App.tsx");
  for (const route of ["/demo/request","/demo/verify","/demo/marketplace","/demo/offers/:offerId","/demo/organizations/:organizationId","/demo/orders/:orderId","/demo/contracts/:contractId"]) {
    assert.match(app, new RegExp(route.replace(/[/:]/g, "\\$&")));
  }
  assert.doesNotMatch(app, /pages\/demo"|demo-contract-preview/);
  assert.doesNotMatch(read("client/src/components/navigation/PublicHeader.tsx"), /enableDemo|\/offers/);
});

test("verification links enter frontend UX and the session DTO exposes only qualified presentation identity", () => {
  assert.match(read("server/demo-runtime/email.ts"), /"\/demo\/verify"/);
  const routes = read("server/demo-runtime/routes.ts");
  assert.match(routes, /visitor: state\.visitor/);
  assert.doesNotMatch(routes, /verifiedBusinessEmail/);
});

test("demo navigation keeps entity and Hero mission IDs raw", () => {
  const paths = [
    demoRoutes.offer("demo:offer:wti-houston"),
    demoRoutes.organization("demo:org:aster-gulf-energy"),
    demoRoutes.order("demo:order:generated-1"),
    demoRoutes.contract("demo:contract:generated-1"),
    demoRoutes.organization(
      "demo:org:aster-gulf-energy",
      "demo:mission:wti-complete-trade",
    ),
  ];

  assert.deepEqual(paths, [
    "/demo/offers/demo:offer:wti-houston",
    "/demo/organizations/demo:org:aster-gulf-energy",
    "/demo/orders/demo:order:generated-1",
    "/demo/contracts/demo:contract:generated-1",
    "/demo/organizations/demo:org:aster-gulf-energy?mission=demo:mission:wti-complete-trade",
  ]);
  assert.ok(paths.every((path) => !path.includes("%3A") && !path.includes("%253A")));
});

test("Demo API encodes raw route IDs exactly once, including unsafe URL characters", async () => {
  const originalFetch = globalThis.fetch;
  const requested: string[] = [];
  globalThis.fetch = async (input) => {
    requested.push(String(input));
    return new Response("{}", {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    await demoApi.getOffer("demo:offer:wti houston/unsafe?");
    await demoApi.getOrganization("demo:org:aster-gulf-energy");
    await demoApi.getMission("demo:mission:wti-complete-trade");
    await demoApi.getOrder("demo:order:generated-1");
    await demoApi.getContract("demo:contract:generated-1");
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.deepEqual(requested, [
    "/api/demo/offers/demo%3Aoffer%3Awti%20houston%2Funsafe%3F",
    "/api/demo/organizations/demo%3Aorg%3Aaster-gulf-energy",
    "/api/demo/missions/demo%3Amission%3Awti-complete-trade",
    "/api/demo/orders/demo%3Aorder%3Agenerated-1",
    "/api/demo/contracts/demo%3Acontract%3Agenerated-1",
  ]);
  assert.ok(requested.every((path) => !path.includes("%253A")));
});

test("all production-facing Demo navigation consumes the raw route builder", () => {
  const source = [
    "client/src/pages/demo-landing.tsx",
    "client/src/pages/demo-marketplace.tsx",
    "client/src/pages/demo-missions.tsx",
    "client/src/pages/demo-organization.tsx",
    "client/src/pages/demo-offer.tsx",
    "client/src/pages/demo-order.tsx",
  ].map(read).join("\n");

  assert.doesNotMatch(source, /encodeURIComponent\(/);
  assert.doesNotMatch(source, /%253A|demo%3A/);
  assert.match(source, /demoRoutes\.offer/);
  assert.match(source, /demoRoutes\.organization/);
  assert.match(source, /demoRoutes\.order/);
  assert.match(source, /demoRoutes\.contract/);
});
