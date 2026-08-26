import type { DemoAssuranceLevel, DemoMissionStep, DemoOffer } from "./types";

export const HERO_OFFER_IDS = Object.freeze(new Set([
  "demo:offer:wti-houston",
  "demo:offer:urea-mombasa",
  "demo:offer:copper-cathode-shanghai",
]));

export const MISSION_STEP_LABELS: Readonly<Record<DemoMissionStep, string>> = Object.freeze({
  review_organization: "Review organization",
  review_offer: "Review offer",
  review_evidence: "Review evidence",
  place_order: "Place order",
  seller_acceptance: "Seller acceptance",
  view_contract: "View contract",
});

export const ASSURANCE_COPY: Readonly<Record<DemoAssuranceLevel, string>> = Object.freeze({
  documentary: "Evidence has been submitted and structured for review.",
  source_confirmed: "Key information has been confirmed against its stated source within this scenario.",
  independently_inspected: "Relevant evidence includes independent inspection or confirmation within this scenario.",
});

export function filterDemoOffers(
  offers: readonly DemoOffer[],
  filters: { search: string; category: string; side: string; location: string },
): DemoOffer[] {
  const search = filters.search.trim().toLowerCase();
  const location = filters.location.trim().toLowerCase();
  return offers.filter((offer) =>
    (!search || `${offer.commodity} ${offer.location}`.toLowerCase().includes(search)) &&
    (!filters.category || offer.category === filters.category) &&
    (!filters.side || offer.side === filters.side) &&
    (!location || offer.location.toLowerCase().includes(location)),
  );
}

export function formatUnit(unit: string): string {
  return unit.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
