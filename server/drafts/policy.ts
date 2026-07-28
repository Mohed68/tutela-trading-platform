import { getCommodityUnits } from "../conversion/index.js";
import type { DraftOfferUnit } from "../../shared/drafts.js";

// Temporary Phase 5B recovery boundary. This chooses the existing conversion
// profile for each recovered commodity without converting submitted values.
const PHASE_5B_PROFILE_BY_COMMODITY_NAME: Readonly<
  Record<string, string>
> = {
  "wti crude oil": "west_texas_intermediate_(wti)_crude_oil",
  "brent crude oil": "brent_crude_oil",
  "natural gas (henry hub)": "natural_gas_(henry_hub)",
  "gold bullion": "gold_bullion",
  "silver bullion": "silver",
  "copper cathode": "copper_cathode",
  "hard red winter wheat": "wheat",
  soybeans: "soybeans",
  "arabica coffee beans": "arabica_coffee_beans",
};

export const PHASE_5B_DRAFT_CURRENCY = "USD" as const;

export function phase5bDraftUnitsForCommodity(
  commodityName: string,
): DraftOfferUnit[] {
  const profileKey =
    PHASE_5B_PROFILE_BY_COMMODITY_NAME[commodityName.trim().toLowerCase()];
  if (!profileKey) return [];
  return getCommodityUnits(profileKey);
}

export function isAllowedPhase5bDraftUnit(
  commodityName: string,
  unit: DraftOfferUnit,
): boolean {
  return phase5bDraftUnitsForCommodity(commodityName).includes(unit);
}
