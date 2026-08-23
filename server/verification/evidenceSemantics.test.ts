import assert from "node:assert/strict";
import test from "node:test";

import {
  OFFER_EVIDENCE_VERIFICATION_DOES_NOT_GUARANTEE,
  OFFER_EVIDENCE_VERIFICATION_EVALUATES,
} from "./evidenceSemantics.js";

test("Offer Evidence Verification evaluates credibility and consistency only", () => {
  assert.deepEqual(OFFER_EVIDENCE_VERIFICATION_EVALUATES, [
    "evidence_credibility",
    "evidence_consistency",
    "evidence_subject_binding",
  ]);
});

test("Offer Evidence Verification explicitly disclaims physical-goods guarantees", () => {
  assert.deepEqual(OFFER_EVIDENCE_VERIFICATION_DOES_NOT_GUARANTEE, [
    "physical_goods_existence",
    "goods_ownership",
    "continued_availability",
    "successful_delivery",
  ]);
});
