import assert from "node:assert/strict";
import test from "node:test";

import {
  ACTIVITY_ELIGIBILITY_OUTCOMES,
  createActivityEligibilityRequest,
  isActivityEligibilityRequest,
  isActivityEligibilityResult,
} from "./index.js";
import { createActivityEligibilityResultInternal } from "./contracts.js";

function request() {
  const result = createActivityEligibilityRequest({
    evaluationId: "activity-evaluation-1",
    organizationId: "organization-1",
    context: {
      activityCode: "trade.offer.publish",
      contextVersion: "activity-context/v1",
      commodity: {
        commodityId: "commodity-copper",
        commodityClassification: "metal.base",
        jurisdiction: null,
      },
    },
    evaluatedAt: "2026-09-06T00:00:00.000Z",
  });
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error(result.code);
  return result.value;
}

test("Activity Eligibility owns an independent three-outcome vocabulary", () => {
  assert.deepEqual(ACTIVITY_ELIGIBILITY_OUTCOMES, [
    "eligible",
    "ineligible",
    "requires_review",
  ]);
});

test("creates an immutable activity and commodity-scoped request", () => {
  const value = request();
  assert.equal(isActivityEligibilityRequest(value), true);
  assert.equal(value.context.commodity?.commodityId, "commodity-copper");
  assert.equal(Object.isFrozen(value.context), true);
  assert.equal(Object.isFrozen(value.context.commodity), true);
  assert.match(value.requestFingerprint, /^sha256:[0-9a-f]{64}$/);
});

test("creates policy-owned results without becoming Trust or Participation Eligibility", () => {
  for (const outcome of ACTIVITY_ELIGIBILITY_OUTCOMES) {
    const result = createActivityEligibilityResultInternal({
      request: request(),
      policyVersion: "activity-policy/v1",
      outcome,
      reasonCodes: [
        outcome === "eligible"
          ? "activity_context_matched"
          : outcome === "ineligible"
            ? "activity_context_not_matched"
            : "activity_context_requires_review",
      ],
      evidenceReferences: [],
    });
    assert.ok(result);
    assert.equal(isActivityEligibilityResult(result), true);
    assert.equal("trustStatus" in result, false);
    assert.equal("participationEligibility" in result, false);
  }
});

test("structural copies cannot impersonate Activity Eligibility authority", () => {
  const result = createActivityEligibilityResultInternal({
    request: request(),
    policyVersion: "activity-policy/v1",
    outcome: "requires_review",
    reasonCodes: ["activity_context_requires_review"],
    evidenceReferences: [],
  });
  assert.ok(result);
  assert.equal(isActivityEligibilityResult(Object.freeze({ ...result })), false);
});

test("missing commodity context remains representable without inventing a match", () => {
  const result = createActivityEligibilityRequest({
    evaluationId: "activity-evaluation-2",
    organizationId: "organization-1",
    context: {
      activityCode: "trade.general.participation",
      contextVersion: "activity-context/v1",
      commodity: null,
    },
    evaluatedAt: "2026-09-06T00:00:00.000Z",
  });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value.context.commodity, null);
});
