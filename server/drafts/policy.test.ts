import assert from "node:assert/strict";
import test from "node:test";
import {
  isAllowedPhase5bDraftUnit,
  PHASE_5B_DRAFT_CURRENCY,
  phase5bDraftUnitsForCommodity,
} from "./policy.js";

test("Phase 5B currency policy is isolated to the approved recovery value", () => {
  assert.equal(PHASE_5B_DRAFT_CURRENCY, "USD");
});

test("Phase 5B unit policy delegates to existing commodity conversion profiles", () => {
  assert.deepEqual(
    phase5bDraftUnitsForCommodity(
      "West Texas Intermediate (WTI) Crude Oil",
    ),
    ["bbl", "MT"],
  );
  assert.deepEqual(phase5bDraftUnitsForCommodity("Natural Gas (Henry Hub)"), [
    "MMBtu",
  ]);
  assert.deepEqual(phase5bDraftUnitsForCommodity("Gold Bullion"), [
    "troy_ounce",
    "bar",
  ]);
  assert.deepEqual(phase5bDraftUnitsForCommodity("Hard Red Winter Wheat"), [
    "MT",
    "bag",
    "kg",
  ]);
  assert.equal(isAllowedPhase5bDraftUnit("Gold Bullion", "bar"), true);
  assert.equal(isAllowedPhase5bDraftUnit("Gold Bullion", "kg"), false);
  assert.deepEqual(phase5bDraftUnitsForCommodity("Unknown commodity"), []);
});
