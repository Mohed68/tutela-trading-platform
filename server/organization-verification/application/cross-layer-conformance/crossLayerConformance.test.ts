import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  ORGANIZATION_VERIFICATION_APPLICATION_FAILURE_CODES,
  ORGANIZATION_VERIFICATION_PERSISTENCE_FAILURE_MAPPING,
  ORGANIZATION_VERIFICATION_REPLAY_FAILURE_MAPPING,
  ORGANIZATION_VERIFICATION_WORKFLOW_FAILURE_STAGE_MAPPING,
} from "../application-service-contract/index.js";
import * as conformance from "./index.js";

const REPOSITORY_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../..",
);

function assertAcyclic(
  nodes: readonly string[],
  parentsFor: (node: string) => readonly string[],
): void {
  const known = new Set(nodes);
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (node: string): void => {
    assert.equal(visiting.has(node), false, `cycle at ${node}`);
    if (visited.has(node)) return;
    visiting.add(node);
    for (const parent of parentsFor(node)) {
      if (known.has(parent)) visit(parent);
    }
    visiting.delete(node);
    visited.add(node);
  };
  for (const node of nodes) visit(node);
}

function productionFiles(directory: string): readonly string[] {
  const files: string[] = [];
  const visit = (current: string): void => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        visit(absolute);
      } else if (
        entry.isFile() &&
        entry.name.endsWith(".ts") &&
        !entry.name.endsWith(".test.ts")
      ) {
        files.push(absolute);
      }
    }
  };
  visit(directory);
  return files;
}

function importSpecifiers(source: string): readonly string[] {
  return [
    ...source.matchAll(/\bfrom\s*["']([^"']+)["']/g),
    ...source.matchAll(/^\s*import\s*["']([^"']+)["']/gm),
  ]
    .map((match) => match[1])
    .filter((value): value is string => value !== undefined);
}

test("identity lineage is complete, contiguous, required, and owner-explicit", () => {
  const lineage = conformance.ORGANIZATION_VERIFICATION_IDENTITY_LINEAGE;
  assert.deepEqual(
    lineage.map((entry) => entry.identity),
    [
      "organization_id",
      "record_id",
      "revision_id",
      "attempt_id",
      "workflow_execution_id",
      "persistence_stream_identity",
      "replay_execution_id",
      "application_execution_id",
    ],
  );
  assert.deepEqual(
    lineage.map((entry) => entry.order),
    [1, 2, 3, 4, 5, 6, 7, 8],
  );
  for (let index = 0; index < lineage.length; index += 1) {
    const entry = lineage[index]!;
    assert.equal(entry.required, true);
    assert.notEqual(entry.owner, "");
    assert.notEqual(entry.boundBy, "");
    assert.equal(
      entry.parentIdentity,
      index === 0 ? undefined : lineage[index - 1]!.identity,
    );
    assert.equal(entry.forbiddenCompetingOwners.includes(entry.owner), false);
  }
});

test("identity lineage has no recreated, optional, hidden, or competing identity", () => {
  const lineage = conformance.ORGANIZATION_VERIFICATION_IDENTITY_LINEAGE;
  assert.equal(new Set(lineage.map((entry) => entry.identity)).size, lineage.length);
  const serialized = JSON.stringify(lineage).toLowerCase();
  for (const forbidden of [
    "generated_identity",
    "optional_identity",
    "latest",
    "current_pointer",
    "default_identity",
  ]) {
    assert.equal(serialized.includes(forbidden), false);
  }
});

test("fingerprint lineage is a single deterministic acyclic trust graph", () => {
  const lineage = conformance.ORGANIZATION_VERIFICATION_FINGERPRINT_LINEAGE;
  const fingerprints = lineage.map((entry) => entry.fingerprint);
  assert.equal(new Set(fingerprints).size, fingerprints.length);
  assertAcyclic(fingerprints, (fingerprint) => {
    const entry = lineage.find(
      (candidate) => candidate.fingerprint === fingerprint,
    );
    return entry?.parentFingerprints ?? [];
  });
  for (const entry of lineage) {
    assert.equal(entry.replacesParent, false);
    assert.notEqual(entry.owner, "");
    assert.notEqual(entry.evidenceBinding, "");
    if (entry.fingerprint !== "authority_artifact_fingerprint") {
      assert.ok(entry.parentFingerprints.length > 0);
    }
  }
});

test("application fingerprint traces through Replay, Workflow, Persistence, and authority evidence", () => {
  const lineage = conformance.ORGANIZATION_VERIFICATION_FINGERPRINT_LINEAGE;
  const reachable = new Set<string>();
  const visit = (fingerprint: string): void => {
    if (reachable.has(fingerprint)) return;
    reachable.add(fingerprint);
    const entry = lineage.find(
      (candidate) => candidate.fingerprint === fingerprint,
    );
    for (const parent of entry?.parentFingerprints ?? []) visit(parent);
  };
  visit("application_execution_fingerprint");
  for (const expected of [
    "replay_fingerprint",
    "workflow_execution_fingerprint",
    "persistence_stream_fingerprint",
    "stored_evidence_fingerprint",
    "authority_artifact_fingerprint",
  ]) {
    assert.equal(reachable.has(expected), true);
  }
});

test("conformance defines fingerprint relationships without a fingerprint calculator", async () => {
  const publicKeys = Object.keys(await import("./index.js"));
  assert.equal(
    publicKeys.some((key) => /compute|calculate|fingerprintValue|hash/i.test(key)),
    false,
  );
});

test("failure lineage maps every lower-layer origin exactly once", () => {
  const lineage = conformance.ORGANIZATION_VERIFICATION_FAILURE_LINEAGE;
  const expectedCount =
    Object.keys(ORGANIZATION_VERIFICATION_PERSISTENCE_FAILURE_MAPPING).length +
    Object.keys(ORGANIZATION_VERIFICATION_REPLAY_FAILURE_MAPPING).length +
    Object.keys(
      ORGANIZATION_VERIFICATION_WORKFLOW_FAILURE_STAGE_MAPPING,
    ).length;
  assert.equal(lineage.length, expectedCount);
  assert.equal(
    new Set(lineage.map((entry) => entry.qualifiedOrigin)).size,
    expectedCount,
  );
  for (const entry of lineage) {
    assert.equal(
      ORGANIZATION_VERIFICATION_APPLICATION_FAILURE_CODES.includes(
        entry.applicationFailure,
      ),
      true,
    );
  }
});

test("application failure vocabulary is fully explained by lower layers or application ownership", () => {
  const lowerMapped = new Set(
    conformance.ORGANIZATION_VERIFICATION_FAILURE_LINEAGE.map(
      (entry) => entry.applicationFailure,
    ),
  );
  const applicationOwned = new Set(
    conformance.ORGANIZATION_VERIFICATION_APPLICATION_OWNED_FAILURES,
  );
  for (const failure of ORGANIZATION_VERIFICATION_APPLICATION_FAILURE_CODES) {
    assert.equal(
      lowerMapped.has(failure) || applicationOwned.has(failure),
      true,
      `unexplained application failure: ${failure}`,
    );
  }
  for (const failure of applicationOwned) {
    assert.equal(lowerMapped.has(failure), false);
  }
});

test("failure lineage leaks no infrastructure vocabulary", () => {
  const serialized = JSON.stringify(
    conformance.ORGANIZATION_VERIFICATION_FAILURE_LINEAGE,
  ).toLowerCase();
  for (const forbidden of [
    "sql_error",
    "http_status",
    "orm_error",
    "database_code",
    "map_error",
    "stack_trace",
  ]) {
    assert.equal(serialized.includes(forbidden), false);
  }
});

test("every source-of-truth concept has exactly one owner", () => {
  const matrix = conformance.ORGANIZATION_VERIFICATION_SOURCE_OF_TRUTH_MATRIX;
  assert.deepEqual(
    matrix.map((entry) => entry.concept),
    [
      "current_workflow_state",
      "current_lifecycle_state",
      "workflow_history",
      "persistence_history",
      "authority_result",
      "workflow_step",
      "replay_state",
      "application_execution",
    ],
  );
  assert.equal(new Set(matrix.map((entry) => entry.concept)).size, matrix.length);
  for (const entry of matrix) {
    assert.notEqual(entry.owner, "");
    assert.notEqual(entry.authoritativeArtifact, "");
    assert.equal(entry.forbiddenCompetingOwners.includes(entry.owner), false);
  }
});

test("current Workflow and Lifecycle state have one reconstruction owner", () => {
  const current = conformance.ORGANIZATION_VERIFICATION_SOURCE_OF_TRUTH_MATRIX.filter(
    (entry) =>
      entry.concept === "current_workflow_state" ||
      entry.concept === "current_lifecycle_state",
  );
  assert.equal(current.length, 2);
  assert.deepEqual(
    [...new Set(current.map((entry) => entry.owner))],
    ["replay_runtime"],
  );
});

test("layer ownership is non-duplicated and excludes another layer's authority", () => {
  const matrix = conformance.ORGANIZATION_VERIFICATION_LAYER_OWNERSHIP_MATRIX;
  const owned = matrix.flatMap((entry) =>
    entry.owns.map((capability) => `${entry.layer}:${capability}`),
  );
  assert.equal(new Set(owned).size, owned.length);
  for (const entry of matrix) {
    for (const capability of entry.owns) {
      assert.equal(entry.forbiddenOwnership.includes(capability), false);
    }
  }
  assert.equal(
    matrix.find((entry) => entry.layer === "application_service_runtime")
      ?.owns.includes("application_orchestration"),
    true,
  );
  assert.equal(
    matrix.find((entry) => entry.layer === "future_delivery_layer")
      ?.owns.includes("transport"),
    true,
  );
});

test("declared cross-layer dependency graph is acyclic and respects forbidden edges", () => {
  const graph = conformance.ORGANIZATION_VERIFICATION_LAYER_DEPENDENCIES;
  const layers = graph.map((entry) => entry.layer);
  assertAcyclic(layers, (layer) => {
    const entry = graph.find((candidate) => candidate.layer === layer);
    return entry?.dependsOn ?? [];
  });
  for (const rule of conformance.ORGANIZATION_VERIFICATION_FORBIDDEN_CROSS_LAYER_DEPENDENCIES) {
    const actual =
      graph.find((entry) => entry.layer === rule.layer)?.dependsOn ?? [];
    assert.deepEqual(
      actual.filter((dependency) => rule.forbidden.includes(dependency)),
      [],
    );
  }
});

test("production layer imports contain no forbidden reverse or infrastructure edge", () => {
  const root = path.join(REPOSITORY_ROOT, "server/organization-verification");
  const files = productionFiles(root);
  for (const file of files) {
    const relative = file.replaceAll("\\", "/").toLowerCase();
    const specifiers = importSpecifiers(fs.readFileSync(file, "utf8"));
    if (relative.includes("/domain/")) {
      assert.equal(
        specifiers.some((specifier) =>
          /application\/(?:workflow-runtime|persistence-contract|replay-runtime|application-service-contract|cross-layer-conformance)|infrastructure/i.test(
            specifier,
          ),
        ),
        false,
      );
    }
    if (relative.includes("/application/replay-runtime/")) {
      assert.equal(
        specifiers.some((specifier) =>
          /application-service-contract|infrastructure/i.test(specifier),
        ),
        false,
      );
    }
    if (relative.includes("/application/persistence-contract/")) {
      assert.equal(
        specifiers.some((specifier) =>
          /replay-runtime|application-service-contract|infrastructure/i.test(
            specifier,
          ),
        ),
        false,
      );
    }
    if (relative.includes("/application/application-service-contract/")) {
      assert.equal(
        specifiers.some((specifier) => /infrastructure/i.test(specifier)),
        false,
      );
    }
  }
});

test("public conformance surface is inert data only", async () => {
  const publicSurface = await import("./index.js");
  const keys = Object.keys(publicSurface);
  assert.deepEqual(keys.sort(), [
    "ORGANIZATION_VERIFICATION_APPLICATION_OWNED_FAILURES",
    "ORGANIZATION_VERIFICATION_FAILURE_LINEAGE",
    "ORGANIZATION_VERIFICATION_FINGERPRINT_LINEAGE",
    "ORGANIZATION_VERIFICATION_FORBIDDEN_CROSS_LAYER_DEPENDENCIES",
    "ORGANIZATION_VERIFICATION_IDENTITY_LINEAGE",
    "ORGANIZATION_VERIFICATION_LAYER_DEPENDENCIES",
    "ORGANIZATION_VERIFICATION_LAYER_OWNERSHIP_MATRIX",
    "ORGANIZATION_VERIFICATION_SOURCE_OF_TRUTH_MATRIX",
  ]);
  for (const value of Object.values(publicSurface)) {
    assert.notEqual(typeof value, "function");
    assert.equal(Object.isFrozen(value), true);
  }
});
