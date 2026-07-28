import assert from "node:assert/strict";
import test from "node:test";
import {
  createDraftOfferRequestSchema,
  submitDraftRequestSchema,
  updateDraftOfferRequestSchema,
} from "./draftValidation.js";

const validRequest = {
  offerType: "sell",
  commodityId: "11111111-1111-4111-8111-111111111111",
  quantity: "10.25",
  unit: "bbl",
  amountPerUnit: "80.50",
  currency: "USD",
  location: "Recovery test location",
  validUntil: "2099-01-01T00:00:00.000Z",
} as const;

test("draft create accepts only the explicit commercial contract", () => {
  assert.equal(createDraftOfferRequestSchema.safeParse(validRequest).success, true);
});

test("draft create rejects authority, lifecycle, trust, and unknown fields", () => {
  for (const prohibited of [
    { userId: "other" },
    { ownerId: "other" },
    { status: "draft" },
    { verified: true },
    { sellerOrgVerified: true },
    { moderationStatus: "active" },
    { createdAt: "2099-01-01T00:00:00.000Z" },
    { organizationId: "other" },
  ]) {
    assert.equal(
      createDraftOfferRequestSchema.safeParse({
        ...validRequest,
        ...prohibited,
      }).success,
      false,
    );
  }
});

test("draft commercial decimals are positive, finite, and fit numeric(15,2)", () => {
  for (const quantity of [
    "0",
    "-1",
    "NaN",
    "Infinity",
    "1.001",
    "10000000000000",
    "01",
    "",
  ]) {
    assert.equal(
      createDraftOfferRequestSchema.safeParse({
        ...validRequest,
        quantity,
      }).success,
      false,
    );
  }

  for (const amountPerUnit of ["0", "-1", "NaN", "1.234"]) {
    assert.equal(
      createDraftOfferRequestSchema.safeParse({
        ...validRequest,
        amountPerUnit,
      }).success,
      false,
    );
  }
});

test("draft create rejects unsupported currency, unit, type, and dates", () => {
  for (const invalid of [
    { currency: "EUR" },
    { unit: "GAL" },
    { offerType: "trade" },
    { validUntil: "not-a-date" },
    { validUntil: "2020-01-01T00:00:00.000Z" },
  ]) {
    assert.equal(
      createDraftOfferRequestSchema.safeParse({
        ...validRequest,
        ...invalid,
      }).success,
      false,
    );
  }
});

test("draft update is strict, allow-listed, and non-empty", () => {
  assert.equal(updateDraftOfferRequestSchema.safeParse({}).success, false);
  assert.equal(
    updateDraftOfferRequestSchema.safeParse({ location: "Updated" }).success,
    true,
  );
  assert.equal(
    updateDraftOfferRequestSchema.safeParse({ validUntil: null }).success,
    true,
  );
  assert.equal(
    updateDraftOfferRequestSchema.safeParse({ status: "active" }).success,
    false,
  );
});

test("draft submission accepts no client-supplied lifecycle or trust state", () => {
  assert.equal(submitDraftRequestSchema.safeParse({}).success, true);
  for (const body of [
    { status: "submitted" },
    { status: "active" },
    { verified: true },
    { published: true },
    { moderationStatus: "approved" },
  ]) {
    assert.equal(submitDraftRequestSchema.safeParse(body).success, false);
  }
});
