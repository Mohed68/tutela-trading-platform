import assert from "node:assert/strict";
import test from "node:test";

import {
  EVIDENCE_ASSURANCE_LEVELS,
  createEvidenceCollectionRequest,
  createLocalPlatformEvidenceProvider,
  isProviderEvidenceEnvelope,
} from "./index.js";

function request(providerKind: "platform_submitted" | "kyb" = "platform_submitted") {
  const value = createEvidenceCollectionRequest({
    requestId: "evidence-request-1",
    providerKind,
    subject: {
      subjectKind: "offer",
      subjectId: "offer-1",
      subjectVersion: "offer-version-1",
    },
    requestedAt: "2026-09-06T00:00:00.000Z",
  });
  assert.ok(value);
  return value;
}

test("assurance vocabulary supports progressive evidence without guaranteeing goods", () => {
  assert.deepEqual(EVIDENCE_ASSURANCE_LEVELS, [
    "documentary",
    "source_confirmed",
    "independently_inspected",
  ]);
});

test("local platform evidence remains documentary and neutral", async () => {
  const provider = createLocalPlatformEvidenceProvider({
    async resolveSubmittedEvidence(input) {
      return {
        evidenceId: "local-evidence-1",
        evidenceVersion: "local-evidence-version-1",
        subjectId: input.subjectId,
        subjectVersion: input.subjectVersion,
        assertions: [{ assertionCode: "document.present", value: "true" }],
        submittedAt: "2026-09-06T00:00:00.000Z",
        provenanceReference: "platform-submission-1",
        integrityReference: `sha256:${"a".repeat(64)}`,
      };
    },
  });
  const resolution = await provider.collectEvidence(request());
  assert.equal(resolution.status, "evidence_available");
  if (resolution.status === "evidence_available") {
    assert.equal(resolution.evidence.assuranceLevel, "documentary");
    assert.equal(isProviderEvidenceEnvelope(resolution.evidence), true);
    assert.equal("decision" in resolution.evidence, false);
    assert.equal("trust" in resolution.evidence, false);
    assert.equal("eligibility" in resolution.evidence, false);
    assert.equal(
      isProviderEvidenceEnvelope(Object.freeze({ ...resolution.evidence })),
      false,
    );
  }
});

test("local provider rejects requests addressed to future external providers", async () => {
  const provider = createLocalPlatformEvidenceProvider({
    async resolveSubmittedEvidence() {
      throw new Error("must not be called");
    },
  });
  assert.deepEqual(await provider.collectEvidence(request("kyb")), {
    status: "integrity_failure",
  });
});

test("missing local evidence remains unavailable and never becomes a decision", async () => {
  const provider = createLocalPlatformEvidenceProvider({
    async resolveSubmittedEvidence() {
      return null;
    },
  });
  assert.deepEqual(await provider.collectEvidence(request()), {
    status: "not_available",
  });
});
