import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  VERIFICATION_REASON_CODES,
  VERIFICATION_RULE_IDS,
  VERIFICATION_SEVERITIES,
} from "../../shared/verification.js";
import { VERIFICATION_RULE_CATALOG } from "./catalog.js";

test("every stable rule identity has complete catalog metadata", () => {
  assert.equal(
    Object.keys(VERIFICATION_RULE_CATALOG).length,
    VERIFICATION_RULE_IDS.length,
  );
  for (const ruleId of VERIFICATION_RULE_IDS) {
    const definition = VERIFICATION_RULE_CATALOG[ruleId];
    assert.equal(definition.id, ruleId);
    assert.ok(VERIFICATION_REASON_CODES.includes(definition.reasonCode));
    assert.ok(VERIFICATION_SEVERITIES.includes(definition.severity));
    assert.ok(
      definition.disposition === "owner_correctable" ||
        definition.disposition === "requires_platform_review",
    );
  }
});

test("verification engine has no persistence, lifecycle, or excluded-domain dependency", () => {
  const engine = fs.readFileSync(
    new URL("./engine.ts", import.meta.url),
    "utf8",
  );
  for (const forbidden of [
    "../db",
    "UPDATE public.offers",
    "marketplace",
    "kyb",
    "stripe",
    "payment",
    "contract",
    "blockchain",
    "openai",
    "notification",
    "email",
  ]) {
    assert.doesNotMatch(engine.toLowerCase(), new RegExp(forbidden.toLowerCase()));
  }
});

test("workflow coordinator consumes persisted decisions without importing rule engine", () => {
  const coordinator = fs.readFileSync(
    new URL("./coordinator.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(coordinator, /from "\.\/engine/);
  assert.doesNotMatch(coordinator, /runTechnical|runCommercial|reasonCode/);
  assert.match(coordinator, /offer_workflow_transitions/);
  assert.match(coordinator, /UPDATE public\.offers/);
});

test("severity remains metadata and decision reduction reads disposition only", () => {
  const engine = fs.readFileSync(
    new URL("./engine.ts", import.meta.url),
    "utf8",
  );
  const reducer = engine.slice(
    engine.indexOf("export function decideVerification"),
    engine.indexOf("export function confidenceForDecision"),
  );
  assert.match(reducer, /disposition/);
  assert.doesNotMatch(reducer, /severity/);
});
