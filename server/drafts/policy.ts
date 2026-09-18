import { getCommodityUnits } from "../conversion/index.js";
import type { DraftOfferUnit } from "../../shared/drafts.js";

// Temporary Phase 5B recovery boundary. This chooses the existing conversion
// profile for each recovered commodity without converting submitted values.
const PHASE_5B_PROFILE_BY_COMMODITY_NAME: Readonly<
  Record<string, string>
> = {
  "west texas intermediate (wti) crude oil":
    "west_texas_intermediate_(wti)_crude_oil",
  "brent crude oil": "brent_crude_oil",
  "natural gas (henry hub)": "natural_gas_(henry_hub)",
  "gold bullion": "gold_bullion",
  "silver bullion": "silver",
  "copper cathode": "copper_cathode",
  "hard red winter wheat": "wheat",
  soybeans: "soybeans",
  "arabica coffee beans": "arabica_coffee_beans",
};

// MVP Transaction Closure adds a bounded physical Urea 46 profile. These are
// declaration units only; no mass or packaging conversion is inferred here.
const MVP_UREA_UNITS_BY_COMMODITY_NAME: Readonly<Record<string, readonly DraftOfferUnit[]>> = {
  "urea 46%": Object.freeze(["MT", "kg", "bag"]),
  "urea 46% granular": Object.freeze(["MT", "kg", "bag"]),
};

export const PHASE_5B_DRAFT_CURRENCY = "USD" as const;

export function phase5bDraftUnitsForCommodity(
  commodityName: string,
): DraftOfferUnit[] {
  const normalizedName = commodityName.trim().toLowerCase();
  const ureaUnits = MVP_UREA_UNITS_BY_COMMODITY_NAME[normalizedName];
  if (ureaUnits) return [...ureaUnits];
  const profileKey = PHASE_5B_PROFILE_BY_COMMODITY_NAME[normalizedName];
  if (!profileKey) return [];
  return getCommodityUnits(profileKey);
}

export function isAllowedPhase5bDraftUnit(
  commodityName: string,
  unit: DraftOfferUnit,
): boolean {
  return phase5bDraftUnitsForCommodity(commodityName).includes(unit);
}
