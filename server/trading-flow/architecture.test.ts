import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

test("controllers delegate Order and Contract authority to the trading-flow service", () => {
  const routes = fs.readFileSync(path.join(root, "server/routes.ts"), "utf8");
  assert.match(routes, /productionTradingFlowService\.createOrder/);
  assert.match(routes, /productionTradingFlowService\.acceptOrder/);
  assert.match(routes, /productionTradingFlowService\.createContract/);
  assert.doesNotMatch(routes, /storage\.createOrder\(/);
  assert.doesNotMatch(routes, /storage\.createContract\(/);
  assert.doesNotMatch(routes, /storage\.updateOrderStatus\(/);
  assert.doesNotMatch(routes, /storage\.updateContractStatus\(/);
});

test("contract creation has no payment or blockchain dependency", () => {
  const service = fs.readFileSync(path.join(root, "server/trading-flow/service.ts"), "utf8");
  const repository = fs.readFileSync(path.join(root, "server/trading-flow/postgresRepository.ts"), "utf8");
  for (const source of [service, repository]) {
    assert.doesNotMatch(source, /Stripe|paymentIntent|escrow|createSmartContract|getContractStatus|blockchain/i);
  }
});

test("legacy flags cannot enter the trading authority boundary", () => {
  for (const file of ["contracts.ts", "service.ts", "postgresRepository.ts"]) {
    const source = fs.readFileSync(path.join(root, "server/trading-flow", file), "utf8");
    assert.doesNotMatch(source, /sellerOrgVerified|users\.verified|offer\.verified/);
  }
});

test("migration preserves legacy rows but gives them no authority", () => {
  const migration = fs.readFileSync(path.join(root, "migrations/0014_order_contract_authority.sql"), "utf8");
  assert.match(migration, /ALTER COLUMN contract_id DROP NOT NULL/);
  assert.match(migration, /orders_authority_completeness_check/);
  assert.match(migration, /contracts_order_authority_check/);
  assert.doesNotMatch(migration, /DELETE|TRUNCATE|DROP TABLE|UPDATE public\.(?:orders|contracts)/i);
});
