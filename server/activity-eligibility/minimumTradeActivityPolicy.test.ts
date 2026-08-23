import assert from "node:assert/strict";
import test from "node:test";

import {
  createEvidenceCollectionRequest,
  createLocalPlatformEvidenceProvider,
} from "../evidence-provider/index.js";
import {
  createActivityEligibilityRequest,
  createMinimumTradeActivityEligibilityService,
} from "./index.js";

async function setup(assertions: readonly { assertionCode: string; value: string }[]) {
  const request = createActivityEligibilityRequest({
    evaluationId: "activity-evaluation-1",
    organizationId: "organization-1",
    context: {
      activityCode: "wholesale_trade",
      contextVersion: "profile-version-1",
      commodity: {
        commodityId: "copper-cathodes",
        commodityClassification: "metals.copper",
        jurisdiction: "AE",
      },
    },
    evaluatedAt: "2026-08-23T10:00:00.000Z",
  });
  assert.equal(request.ok, true);
  if (!request.ok) throw new Error(request.code);
  const collection = createEvidenceCollectionRequest({
    requestId: "activity-evidence-request-1",
    providerKind: "platform_submitted",
    subject: {
      subjectKind: "organization",
      subjectId: "organization-1",
      subjectVersion: "profile-version-1",
    },
    requestedAt: "2026-08-23T09:00:00.000Z",
  });
  assert.ok(collection);
  const provider = createLocalPlatformEvidenceProvider({
    async resolveSubmittedEvidence() {
      return {
        evidenceId: "activity-evidence-1",
        evidenceVersion: "evidence-version-1",
        subjectId: "organization-1",
        subjectVersion: "profile-version-1",
        assertions,
        submittedAt: "2026-08-23T08:00:00.000Z",
        provenanceReference: "platform-activity-submission-1",
        integrityReference: "platform-activity-integrity-1",
      };
    },
  });
  const resolution = await provider.collectEvidence(collection);
  assert.equal(resolution.status, "evidence_available");
  if (resolution.status !== "evidence_available") throw new Error(resolution.status);
  return { request: request.value, evidence: resolution.evidence };
}

test("matching real activity evidence is eligible independently from Trust", async () => {
  const input = await setup([
    { assertionCode: "organization.activity_code", value: "wholesale_trade" },
    { assertionCode: "activity.commodity_id", value: "copper-cathodes" },
    { assertionCode: "activity.commodity_classification", value: "metals.copper" },
    { assertionCode: "activity.jurisdiction", value: "AE" },
  ]);
  const result = createMinimumTradeActivityEligibilityService().evaluate({
    request: input.request,
    evidence: [input.evidence],
  });
  assert.equal(result?.outcome, "eligible");
  assert.equal(result?.reasonCodes[0], "activity_context_matched");
  assert.equal("trustStatus" in (result ?? {}), false);
});

test("ambiguous activity context requires review and explicit mismatch is ineligible", async () => {
  const ambiguous = await setup([
    { assertionCode: "organization.activity_code", value: "wholesale_trade" },
  ]);
  assert.equal(
    createMinimumTradeActivityEligibilityService().evaluate({
      request: ambiguous.request,
      evidence: [ambiguous.evidence],
    })?.outcome,
    "requires_review",
  );
  const mismatch = await setup([
    { assertionCode: "organization.activity_code", value: "manufacturing" },
  ]);
  assert.equal(
    createMinimumTradeActivityEligibilityService().evaluate({
      request: mismatch.request,
      evidence: [mismatch.evidence],
    })?.outcome,
    "ineligible",
  );
});

test("structural evidence copy cannot authorize Activity Eligibility", async () => {
  const input = await setup([
    { assertionCode: "organization.activity_code", value: "wholesale_trade" },
  ]);
  const result = createMinimumTradeActivityEligibilityService().evaluate({
    request: input.request,
    evidence: [{ ...input.evidence }],
  });
  assert.equal(result?.outcome, "requires_review");
  assert.deepEqual(result?.reasonCodes, ["activity_evidence_integrity_failure"]);
});
