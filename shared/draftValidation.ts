import { z } from "zod";
import { DRAFT_OFFER_UNITS } from "./drafts.js";

export const draftOfferUnitSchema = z.enum(DRAFT_OFFER_UNITS);

const storedDecimalSchema = z
  .string()
  .regex(
    /^(?:0|[1-9]\d{0,12})(?:\.\d{1,2})?$/,
    "Use a positive decimal with at most 13 integer digits and 2 decimal places.",
  )
  .refine((value) => Number(value) > 0, "Value must be greater than zero.");

const futureTimestampSchema = z
  .string()
  .datetime({ offset: true })
  .refine(
    (value) => new Date(value).getTime() > Date.now(),
    "Valid-until must be in the future.",
  );

const mutableDraftFields = {
  offerType: z.enum(["buy", "sell"]),
  commodityId: z.string().uuid(),
  quantity: storedDecimalSchema,
  unit: draftOfferUnitSchema,
  amountPerUnit: storedDecimalSchema,
  currency: z.literal("USD"),
  location: z.string().trim().min(1).max(255),
};

export const createDraftOfferRequestSchema = z
  .object({
    ...mutableDraftFields,
    validUntil: futureTimestampSchema.optional(),
  })
  .strict();

export const updateDraftOfferRequestSchema = z
  .object({
    offerType: mutableDraftFields.offerType.optional(),
    commodityId: mutableDraftFields.commodityId.optional(),
    quantity: mutableDraftFields.quantity.optional(),
    unit: mutableDraftFields.unit.optional(),
    amountPerUnit: mutableDraftFields.amountPerUnit.optional(),
    currency: mutableDraftFields.currency.optional(),
    location: mutableDraftFields.location.optional(),
    validUntil: futureTimestampSchema.nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one editable field is required.",
  });
