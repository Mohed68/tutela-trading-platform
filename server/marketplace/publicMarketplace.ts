import { pool } from "../db.js";
import { getCommodityUnits, qtyFactor, type CanonUnit } from "../conversion/index.js";
import type { MarketFilter } from "../filters/publicOffers.js";
import type {
  PublicMarketplaceOffer,
  PublicMarketplaceOptions,
  PublicMarketplaceSummary,
} from "../../shared/marketplace.js";

export interface PublishedOfferRow {
  id: string;
  offer_verified: boolean | null;
  seller_organization_verified: boolean | null;
  offer_type: "buy" | "sell";
  quantity: string;
  unit: string;
  price_per_unit: string;
  currency: string | null;
  location: string;
  status: "active";
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

export function hasCompletePublicationProof(input: {
  offerVerified: boolean | null | undefined;
  sellerOrganizationVerified: boolean | null | undefined;
  status: string | null | undefined;
}): boolean {
  return (
    input.offerVerified === true &&
    input.sellerOrganizationVerified === true &&
    input.status === "active"
  );
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
): PublishedMarketplaceOfferRecord {
  if (
    !hasCompletePublicationProof({
      offerVerified: row.offer_verified,
      sellerOrganizationVerified: row.seller_organization_verified,
      status: row.status,
    })
  ) {
    throw new Error("MARKETPLACE_PUBLICATION_PROOF_REQUIRED");
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
      status: "active",
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

export async function hasAuthoritativeMarketplaceVerification(): Promise<boolean> {
  const result = await pool.query<{ authoritative: boolean }>(`
    SELECT (
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'offers'
          AND column_name = 'verified'
          AND data_type = 'boolean'
      )
      AND EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'offers'
          AND column_name = 'seller_org_verified'
          AND data_type = 'boolean'
      )
    ) AS authoritative
  `);

  return result.rows[0]?.authoritative === true;
}

export async function getPublishedMarketplaceOfferRecords(): Promise<
  PublishedMarketplaceOfferRecord[]
> {
  if (!(await hasAuthoritativeMarketplaceVerification())) {
    return [];
  }

  const result = await pool.query<PublishedOfferRow>(`
    SELECT
      offer.id,
      offer.verified AS offer_verified,
      offer.seller_org_verified AS seller_organization_verified,
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
    WHERE offer.verified IS TRUE
      AND offer.seller_org_verified IS TRUE
      AND offer.status::text = 'active'
    ORDER BY offer.created_at DESC
  `);

  return result.rows.map(projectPublishedOffer);
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
