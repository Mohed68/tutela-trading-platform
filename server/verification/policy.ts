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
  readonly version: string;
  readonly snapshotSchemaVersion: string;
  readonly allowedOfferTypes: readonly string[];
  readonly decimalPattern: RegExp;
  readonly maximumLocationLength: number;
}

export interface CommercialVerificationPolicy {
  readonly version: string;
  readonly allowedOfferTypes: readonly string[];
  readonly allowedCurrencies: readonly string[];
  unitsForCommodity(commodityName: string): readonly string[];
}

export interface VerificationPolicies {
  readonly technical: TechnicalVerificationPolicy;
  readonly commercial: CommercialVerificationPolicy;
}

export interface VerificationReferenceData {
  readonly recognizedUnits: readonly string[];
  readonly currencyIdentifierPattern: RegExp;
}

export interface TechnicalPolicyProvider {
  resolve(version: string): TechnicalVerificationPolicy | undefined;
}

export interface CommercialPolicyProvider {
  resolve(version: string): CommercialVerificationPolicy | undefined;
}

export const PHASE_6_TECHNICAL_POLICY: TechnicalVerificationPolicy = {
  version: "technical-recovery-v1",
  snapshotSchemaVersion: VERIFICATION_SNAPSHOT_SCHEMA_VERSION,
  allowedOfferTypes: ["buy", "sell"],
  decimalPattern: /^(?:0|[1-9]\d{0,12})(?:\.\d{1,2})?$/,
  maximumLocationLength: 255,
};

export const PHASE_6_COMMERCIAL_POLICY: CommercialVerificationPolicy = {
  version: "commercial-phase5b-recovery-v1",
  allowedOfferTypes: ["buy", "sell"],
  allowedCurrencies: [PHASE_5B_DRAFT_CURRENCY],
  unitsForCommodity: phase5bDraftUnitsForCommodity,
};

export const PHASE_6_REFERENCE_DATA: VerificationReferenceData =
  Object.freeze({
    recognizedUnits: Object.freeze([...DRAFT_OFFER_UNITS]),
    currencyIdentifierPattern: /^[A-Z]{3}$/,
  });

const TECHNICAL_POLICIES: ReadonlyMap<string, TechnicalVerificationPolicy> =
  new Map([[PHASE_6_TECHNICAL_POLICY.version, PHASE_6_TECHNICAL_POLICY]]);

const COMMERCIAL_POLICIES: ReadonlyMap<string, CommercialVerificationPolicy> =
  new Map([[PHASE_6_COMMERCIAL_POLICY.version, PHASE_6_COMMERCIAL_POLICY]]);

export const technicalPolicyProvider: TechnicalPolicyProvider = Object.freeze({
  resolve(version: string): TechnicalVerificationPolicy | undefined {
    return TECHNICAL_POLICIES.get(version);
  },
});

export const commercialPolicyProvider: CommercialPolicyProvider =
  Object.freeze({
    resolve(version: string): CommercialVerificationPolicy | undefined {
      return COMMERCIAL_POLICIES.get(version);
    },
  });

export function resolveVerificationPolicies(versions: {
  readonly technicalPolicyVersion: string;
  readonly commercialPolicyVersion: string;
}): VerificationPolicies | undefined {
  const technical = technicalPolicyProvider.resolve(
    versions.technicalPolicyVersion,
  );
  const commercial = commercialPolicyProvider.resolve(
    versions.commercialPolicyVersion,
  );
  return technical && commercial ? { technical, commercial } : undefined;
}

export function currentVerificationPolicies(): VerificationPolicies {
  return {
    technical: PHASE_6_TECHNICAL_POLICY,
    commercial: PHASE_6_COMMERCIAL_POLICY,
  };
}
