import { pool } from "../db.js";
import { getCommodityUnits, qtyFactor, type CanonUnit } from "../conversion/index.js";
import type { MarketFilter } from "../filters/publicOffers.js";
import { productionActivityAwareParticipationAdapter } from "../trade-trust-application/applicationService.js";
import {
  evaluateOfferPublicationEligibility,
  isOfferPublicationEligibilityResult,
  type OfferPublicationEligibilityDependencies,
  type OfferPublicationEligibilityResult,
} from "../offer-publication-eligibility/index.js";
import { offerVerificationEligibilityReadRepository } from "../verification/eligibilityReadRepository.js";
import type {
  PublicMarketplaceOffer,
  PublicMarketplaceOptions,
  PublicMarketplaceSummary,
} from "../../shared/marketplace.js";

export interface PublishedOfferRow {
  id: string;
  user_id: string;
  seller_organization_id: string | null;
  offer_type: "buy" | "sell";
  quantity: string;
  unit: string;
  price_per_unit: string;
  currency: string | null;
  location: string;
  status: string;
  valid_until: Date | string | null;
  minimum_quantity: string | null;
  delivery_terms: string | null;
  payment_terms: string | null;
  created_at: Date | string | null;
  updated_at: Date | string | null;
  commodity_id: string;
  commodity_name: string;
  commodity_category: string;
}

export interface PublishedMarketplaceOfferRecord {
  offer: PublicMarketplaceOffer;
}

function isoDate(value: Date | string | null): string | null {
  if (value === null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function numberOrNull(value: string | number | null): number | null {
  if (value === null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function projectPublishedOffer(
  row: PublishedOfferRow,
  publicationEligibility: OfferPublicationEligibilityResult,
): PublishedMarketplaceOfferRecord {
  if (
    !isOfferPublicationEligibilityResult(publicationEligibility) ||
    publicationEligibility.outcome !== "publishable" ||
    publicationEligibility.offerId !== row.id ||
    publicationEligibility.lifecycleStatus !== row.status ||
    publicationEligibility.sellerOrganizationId !==
      row.seller_organization_id ||
    publicationEligibility.sellerUserId !== row.user_id
  ) {
    throw new Error("MARKETPLACE_PUBLICATION_ELIGIBILITY_REQUIRED");
  }

  const quantity = numberOrNull(row.quantity);
  const amountPerUnit = numberOrNull(row.price_per_unit);

  return {
    offer: {
      id: row.id,
      offerType: row.offer_type,
      commodity: {
        id: row.commodity_id,
        name: row.commodity_name,
        category: row.commodity_category,
      },
      quantity: {
        value: row.quantity,
        unit: row.unit,
      },
      pricing: {
        amountPerUnit: row.price_per_unit,
        currency: row.currency ?? "USD",
      },
      location: row.location,
      terms: {
        minimumQuantity: row.minimum_quantity,
        delivery: row.delivery_terms,
        payment: row.payment_terms,
        validUntil: isoDate(row.valid_until),
      },
      status: "verified",
      trust: {
        offerVerification: {
          state: "verified",
        },
        sellerOrganizationVerification: {
          state: "verified",
        },
      },
      visibility: {
        state: "published",
      },
      seller: {
        displayName: null,
      },
      normalization: {
        targetUnit: null,
        quantity,
        amountPerUnit,
        converted: false,
        convertible: true,
      },
      createdAt: isoDate(row.created_at),
      updatedAt: isoDate(row.updated_at),
    },
  };
}

const productionPublicationDependencies: OfferPublicationEligibilityDependencies =
  Object.freeze({
    organizationParticipationEligibility:
      productionActivityAwareParticipationAdapter,
    offerVerificationEligibility: offerVerificationEligibilityReadRepository,
  });

export async function getPublishedMarketplaceOfferRecords(): Promise<
  PublishedMarketplaceOfferRecord[]
>;
export async function getPublishedMarketplaceOfferRecords(
  dependencies: OfferPublicationEligibilityDependencies,
): Promise<PublishedMarketplaceOfferRecord[]>;
export async function getPublishedMarketplaceOfferRecords(
  dependencies: OfferPublicationEligibilityDependencies =
    productionPublicationDependencies,
): Promise<PublishedMarketplaceOfferRecord[]> {

  const result = await pool.query<PublishedOfferRow>(`
    SELECT
      offer.id,
      offer.user_id,
      offer.seller_org_id AS seller_organization_id,
      offer.type::text AS offer_type,
      offer.quantity::text AS quantity,
      offer.unit,
      offer.price_per_unit::text AS price_per_unit,
      offer.currency,
      offer.location,
      offer.status::text AS status,
      offer.valid_until,
      offer.min_quantity::text AS minimum_quantity,
      offer.delivery_terms,
      offer.payment_terms,
      offer.created_at,
      offer.updated_at,
      commodity.id AS commodity_id,
      commodity.name AS commodity_name,
      commodity.type::text AS commodity_category
    FROM public.offers AS offer
    INNER JOIN public.commodities AS commodity
      ON commodity.id = offer.commodity_id
    ORDER BY offer.created_at DESC
  `);

  return buildPublishedMarketplaceOfferRecords(result.rows, dependencies);
}

export async function buildPublishedMarketplaceOfferRecords(
  rows: readonly PublishedOfferRow[],
  dependencies: OfferPublicationEligibilityDependencies,
): Promise<PublishedMarketplaceOfferRecord[]> {
  const records: PublishedMarketplaceOfferRecord[] = [];
  for (const row of rows) {
    const organizationParticipation = row.seller_organization_id
      ? await dependencies.organizationParticipationEligibility.resolveCurrentOrganizationParticipationEligibility(
          {
            organizationId: row.seller_organization_id,
            userId: row.user_id,
            activityContext: {
              activityCode: row.commodity_category,
              commodityId: row.commodity_id,
              commodityClassification: row.commodity_category,
              jurisdiction: null,
            },
          },
        )
      : Object.freeze({ status: "not_found" as const });
    const offerVerification =
      await dependencies.offerVerificationEligibility.resolveCurrentOfferVerificationEligibility(
        row.id,
      );
    const publicationEligibility = evaluateOfferPublicationEligibility({
      offerId: row.id,
      lifecycleStatus: row.status,
      sellerOrganizationId: row.seller_organization_id ?? "",
      sellerUserId: row.user_id,
      organizationParticipation,
      offerVerification,
    });
    if (publicationEligibility.outcome === "publishable") {
      records.push(projectPublishedOffer(row, publicationEligibility));
    }
  }
  return records;
}

function commodityKey(offer: PublicMarketplaceOffer): string {
  return (
    offer.commodity.name.toLowerCase().replace(/\s+/g, "_") ||
    offer.commodity.id.toLowerCase()
  );
}

export function filterPublishedMarketplaceOffers(
  records: PublishedMarketplaceOfferRecord[],
  filter: MarketFilter,
): PublishedMarketplaceOfferRecord[] {
  const category = filter.category;
  const requestedCommodity = filter.commodityKey?.toLowerCase();
  const search = filter.q?.trim().toLowerCase();

  return records.filter(({ offer }) => {
    if (
      category &&
      category !== "all" &&
      offer.commodity.category !== category
    ) {
      return false;
    }
    if (
      requestedCommodity &&
      commodityKey(offer) !== requestedCommodity &&
      offer.commodity.id.toLowerCase() !== requestedCommodity
    ) {
      return false;
    }
    if (
      search &&
      !offer.commodity.name.toLowerCase().includes(search) &&
      !offer.location.toLowerCase().includes(search)
    ) {
      return false;
    }
    return true;
  });
}

export function normalizePublishedOffer(
  offer: PublicMarketplaceOffer,
  requestedCommodity: string | null | undefined,
  targetUnit: string | null | undefined,
): PublicMarketplaceOffer {
  const quantity = numberOrNull(offer.quantity.value);
  const amountPerUnit = numberOrNull(offer.pricing.amountPerUnit);

  if (
    !requestedCommodity ||
    !targetUnit ||
    quantity === null ||
    amountPerUnit === null ||
    offer.quantity.unit === targetUnit
  ) {
    return {
      ...offer,
      normalization: {
        targetUnit: targetUnit ?? null,
        quantity,
        amountPerUnit,
        converted: false,
        convertible: true,
      },
    };
  }

  const factor = qtyFactor(
    requestedCommodity,
    offer.quantity.unit as CanonUnit,
    targetUnit as CanonUnit,
    {},
  );

  if (!factor) {
    return {
      ...offer,
      normalization: {
        targetUnit,
        quantity,
        amountPerUnit,
        converted: false,
        convertible: false,
      },
    };
  }

  return {
    ...offer,
    normalization: {
      targetUnit,
      quantity: quantity * factor,
      amountPerUnit: Math.round((amountPerUnit / factor) * 100) / 100,
      converted: true,
      convertible: true,
    },
  };
}

export function buildMarketplaceOptions(
  records: PublishedMarketplaceOfferRecord[],
): PublicMarketplaceOptions {
  const grouped = new Map<
    string,
    { key: string; label: string; units: Set<string> }
  >();

  for (const { offer } of records) {
    const key = commodityKey(offer);
    const current = grouped.get(key) ?? {
      key,
      label: offer.commodity.name,
      units: new Set<string>(),
    };
    current.units.add(offer.quantity.unit);
    for (const unit of getCommodityUnits(key)) current.units.add(unit);
    grouped.set(key, current);
  }

  return {
    commodities: Array.from(grouped.values())
      .map(({ key, label, units }) => ({
        key,
        label,
        units: Array.from(units).sort(),
      }))
      .sort((left, right) => left.label.localeCompare(right.label)),
  };
}

function percentile(values: number[], fraction: number): number | null {
  if (values.length < 2) return null;
  return values[Math.floor(values.length * fraction)] ?? null;
}

export function buildMarketplaceSummary(
  records: PublishedMarketplaceOfferRecord[],
  requestedCommodity?: string | null,
  targetUnit?: string,
): PublicMarketplaceSummary {
  const offers = records.map(({ offer }) => offer);
  const marketValueUsd = offers.reduce((sum, offer) => {
    const price = numberOrNull(offer.pricing.amountPerUnit);
    const quantity = numberOrNull(offer.quantity.value);
    return price === null || quantity === null ? sum : sum + price * quantity;
  }, 0);

  let avgPrice: number | null = null;
  let avgPriceUnit: string | undefined;
  let avgPriceCount = 0;
  let avgPriceCoverage = { used: 0, skipped: 0 };
  let median: number | null = null;
  let p25: number | null = null;
  let p75: number | null = null;

  if (requestedCommodity && targetUnit) {
    let totalValue = 0;
    let totalQuantity = 0;
    const prices: number[] = [];

    for (const offer of offers) {
      const price = numberOrNull(offer.pricing.amountPerUnit);
      const quantity = numberOrNull(offer.quantity.value);
      if (
        price === null ||
        quantity === null ||
        price <= 0 ||
        quantity <= 0 ||
        offer.pricing.currency !== "USD"
      ) {
        avgPriceCoverage.skipped++;
        continue;
      }
      const factor = qtyFactor(
        requestedCommodity,
        offer.quantity.unit as CanonUnit,
        targetUnit as CanonUnit,
        {},
      );
      if (!factor) {
        avgPriceCoverage.skipped++;
        continue;
      }
      totalValue += price * quantity;
      totalQuantity += quantity * factor;
      prices.push(price / factor);
      avgPriceCoverage.used++;
    }

    avgPriceCount = avgPriceCoverage.used;
    avgPriceUnit = targetUnit;
    if (totalQuantity > 0) avgPrice = totalValue / totalQuantity;
    prices.sort((left, right) => left - right);
    if (prices.length >= 2) {
      const middle = Math.floor(prices.length / 2);
      median =
        prices.length % 2 === 0
          ? (prices[middle - 1] + prices[middle]) / 2
          : prices[middle];
      p25 = percentile(prices, 0.25);
      p75 = percentile(prices, 0.75);
    }
  } else {
    const units = new Set(offers.map((offer) => offer.quantity.unit));
    if (offers.length > 0 && units.size === 1) {
      const totalQuantity = offers.reduce(
        (sum, offer) => sum + (numberOrNull(offer.quantity.value) ?? 0),
        0,
      );
      if (totalQuantity > 0) {
        avgPrice = marketValueUsd / totalQuantity;
        avgPriceUnit = Array.from(units)[0];
        avgPriceCount = offers.length;
        avgPriceCoverage = { used: offers.length, skipped: 0 };
      }
    }
  }

  const rounded = (value: number | null): number | null =>
    value === null ? null : Math.round(value * 100) / 100;

  return {
    activeOffers: offers.length,
    publishedOffers: offers.length,
    marketValueUsd: Math.round(marketValueUsd),
    avgPrice: rounded(avgPrice),
    avgPriceUnit,
    avgPriceCount,
    avgPriceCoverage,
    median: rounded(median),
    p25: rounded(p25),
    p75: rounded(p75),
  };
}
