import { DRAFT_OFFER_UNITS } from "../../shared/drafts.js";
import {
  PHASE_5B_DRAFT_CURRENCY,
  phase5bDraftUnitsForCommodity,
} from "../drafts/policy.js";

export const VERIFICATION_ENGINE_VERSION = "offer-verification-engine-v1";
export const VERIFICATION_SNAPSHOT_SCHEMA_VERSION =
  "submitted-offer-snapshot-v1";
export const VERIFICATION_CONFIDENCE_MODEL_VERSION = "deterministic-v1";

export interface TechnicalVerificationPolicy {
  version: string;
  snapshotSchemaVersion: string;
  allowedOfferTypes: readonly string[];
  recognizedUnits: readonly string[];
  currencyIdentifierPattern: RegExp;
  decimalPattern: RegExp;
  maximumLocationLength: number;
}

export interface CommercialVerificationPolicy {
  version: string;
  allowedOfferTypes: readonly string[];
  allowedCurrencies: readonly string[];
  unitsForCommodity(commodityName: string): readonly string[];
}

export interface VerificationPolicies {
  technical: TechnicalVerificationPolicy;
  commercial: CommercialVerificationPolicy;
}

export const PHASE_6_TECHNICAL_POLICY: TechnicalVerificationPolicy = {
  version: "technical-recovery-v1",
  snapshotSchemaVersion: VERIFICATION_SNAPSHOT_SCHEMA_VERSION,
  allowedOfferTypes: ["buy", "sell"],
  recognizedUnits: DRAFT_OFFER_UNITS,
  currencyIdentifierPattern: /^[A-Z]{3}$/,
  decimalPattern: /^(?:0|[1-9]\d{0,12})(?:\.\d{1,2})?$/,
  maximumLocationLength: 255,
};

export const PHASE_6_COMMERCIAL_POLICY: CommercialVerificationPolicy = {
  version: "commercial-phase5b-recovery-v1",
  allowedOfferTypes: ["buy", "sell"],
  allowedCurrencies: [PHASE_5B_DRAFT_CURRENCY],
  unitsForCommodity: phase5bDraftUnitsForCommodity,
};

export function currentVerificationPolicies(): VerificationPolicies {
  return {
    technical: PHASE_6_TECHNICAL_POLICY,
    commercial: PHASE_6_COMMERCIAL_POLICY,
  };
}
