import assert from "node:assert/strict";
import test from "node:test";
import * as inMemoryPersistence from "./index.js";
import { createInMemoryOrganizationVerificationEvidenceRepository } from "./index.js";
import { runOrganizationVerificationPersistenceAdapterConformance } from "./persistenceAdapterConformance.test.js";

runOrganizationVerificationPersistenceAdapterConformance(
  "in-memory Organization Verification persistence adapter",
  createInMemoryOrganizationVerificationEvidenceRepository,
);

test("factory exposes exactly the two frozen persistence ports", () => {
  const repository =
    createInMemoryOrganizationVerificationEvidenceRepository();
  assert.equal(Object.isFrozen(repository), true);
  assert.deepEqual(Object.keys(repository).sort(), [
    "appendOrganizationVerificationEvidence",
    "loadOrganizationVerificationEvidenceStream",
  ]);
  assert.deepEqual(Object.keys(inMemoryPersistence), [
    "createInMemoryOrganizationVerificationEvidenceRepository",
  ]);
});

test("factory creates no singleton or shared repository state", () => {
  const first =
    createInMemoryOrganizationVerificationEvidenceRepository();
  const second =
    createInMemoryOrganizationVerificationEvidenceRepository();
  assert.notEqual(first, second);
  assert.notEqual(
    first.appendOrganizationVerificationEvidence,
    second.appendOrganizationVerificationEvidence,
  );
  assert.notEqual(
    first.loadOrganizationVerificationEvidenceStream,
    second.loadOrganizationVerificationEvidenceStream,
  );
});
