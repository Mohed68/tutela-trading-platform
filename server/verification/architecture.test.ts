import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  VERIFICATION_REASON_CODES,
  VERIFICATION_RULE_IDS,
  VERIFICATION_SEVERITIES,
} from "../../shared/verification.js";
import { VERIFICATION_RULE_CATALOG } from "./catalog.js";
import { readVerificationEngineCompletion } from "./engine.js";

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

test("repository cannot manufacture decisions or accept an engine-shaped result", () => {
  const repository = fs.readFileSync(
    new URL("./repository.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(repository, /VerificationEngineResult/);
  assert.doesNotMatch(repository, /stateConflictResult/);
  assert.doesNotMatch(
    repository,
    /decision:\s*"(?:approved|revision_required|manual_review)"/,
  );
  assert.match(repository, /VerificationEngineCompletion/);
  assert.match(repository, /readVerificationEngineCompletion/);
});

test("fabricated completion objects fail the runtime engine seal", () => {
  assert.throws(
    () =>
      readVerificationEngineCompletion(
        {} as Parameters<typeof readVerificationEngineCompletion>[0],
      ),
    /VERIFICATION_ENGINE_COMPLETION_REQUIRED/,
  );
});

test("commercial validation does not read technical policy", () => {
  const rules = fs.readFileSync(
    new URL("./rules.ts", import.meta.url),
    "utf8",
  );
  const commercial = rules.slice(
    rules.indexOf("export function runCommercialValidation"),
  );
  assert.doesNotMatch(commercial, /policies?\.technical/);
  assert.doesNotMatch(commercial, /TechnicalVerificationPolicy/);
  assert.match(commercial, /CommercialVerificationPolicy/);
  assert.match(commercial, /VerificationReferenceData/);
});

test("excluded domains are absent from every verification runtime module", () => {
  const modules = [
    "catalog.ts",
    "coordinator.ts",
    "engine.ts",
    "orchestrator.ts",
    "policy.ts",
    "repository.ts",
    "rules.ts",
    "snapshot.ts",
    "worker.ts",
  ];
  const forbidden = [
    "kyb",
    "marketplace",
    "publication",
    "compliance",
    "sanction",
    "stripe",
    "payment",
    "contract",
    "blockchain",
    "openai",
    "notification",
    "email",
    "risk scoring",
  ];
  for (const module of modules) {
    const source = fs
      .readFileSync(new URL(`./${module}`, import.meta.url), "utf8")
      .toLowerCase();
    for (const term of forbidden) {
      assert.equal(source.includes(term), false, `${module}: ${term}`);
    }
  }
});
