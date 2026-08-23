import assert from "node:assert/strict";
import test from "node:test";

import { evaluateComplianceTrigger } from "./index.js";

const base = Object.freeze({
  evaluationId: "compliance-evaluation-1",
  organizationId: "organization-1",
  organizationType: "company",
  jurisdiction: "AE",
  commodityClassification: "metals.copper",
  transactionValueContext: null,
  legalOrCommercialRequirement: "not_required" as const,
  explicitRiskFlags: Object.freeze([]),
  evaluatedAt: "2026-08-23T10:00:00.000Z",
});

test("compliance is not always mandatory", () => {
  const result = evaluateComplianceTrigger(base);
  assert.equal(result?.outcome, "not_required");
  assert.equal(result?.externalProviderRequired, false);
  assert.equal(result?.manualReviewRequired, false);
});

test("triggered compliance cannot silently pass without evidence or review", () => {
  const result = evaluateComplianceTrigger({
    ...base,
    legalOrCommercialRequirement: "required",
  });
  assert.equal(result?.outcome, "required");
  assert.equal(result?.manualReviewRequired, true);
  assert.equal(result?.externalProviderRequired, false);
});

test("unknown compliance context is reviewable and explicit risk flags trigger", () => {
  assert.equal(
    evaluateComplianceTrigger({
      ...base,
      legalOrCommercialRequirement: "unknown",
    })?.outcome,
    "requires_review",
  );
  assert.equal(
    evaluateComplianceTrigger({
      ...base,
      explicitRiskFlags: [{ code: "explicit-commercial-review", requiresCompliance: true }],
    })?.outcome,
    "required",
  );
});

test("compliance fingerprint is independent of explicit risk-flag ordering", () => {
  const first = evaluateComplianceTrigger({
    ...base,
    explicitRiskFlags: [
      { code: "review-b", requiresCompliance: false },
      { code: "review-a", requiresCompliance: true },
    ],
  });
  const second = evaluateComplianceTrigger({
    ...base,
    explicitRiskFlags: [
      { code: "review-a", requiresCompliance: true },
      { code: "review-b", requiresCompliance: false },
    ],
  });
  assert.equal(first?.triggerFingerprint, second?.triggerFingerprint);
});
