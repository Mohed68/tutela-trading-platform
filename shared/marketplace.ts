export type OfferVerificationState =
  | "verified"
  | "unverified"
  | "pending"
  | "unknown"
  | "not_applicable";

export type SellerOrganizationVerificationState =
  | "verified"
  | "unverified"
  | "pending"
  | "unknown"
  | "unavailable";

export type MarketplaceVisibilityState =
  | "published"
  | "hidden"
  | "archived"
  | "unknown";

export interface PublicMarketplaceOffer {
  id: string;
  offerType: "buy" | "sell";
  commodity: {
    id: string;
    name: string;
    category: string;
  };
  quantity: {
    value: string;
    unit: string;
  };
  pricing: {
    amountPerUnit: string;
    currency: string;
  };
  location: string;
  terms: {
    minimumQuantity: string | null;
    delivery: string | null;
    payment: string | null;
    validUntil: string | null;
  };
  status: "active";
  trust: {
    offerVerification: {
      state: "verified";
    };
    sellerOrganizationVerification: {
      state: "verified";
    };
  };
  visibility: {
    state: "published";
  };
  seller: {
    displayName: string | null;
  };
  normalization: {
    targetUnit: string | null;
    quantity: number | null;
    amountPerUnit: number | null;
    converted: boolean;
    convertible: boolean;
  };
  createdAt: string | null;
  updatedAt: string | null;
}

export interface PublicMarketplaceOffersResponse {
  offers: PublicMarketplaceOffer[];
  totalCount: number;
  publicationPolicy:
    "verified_offer_and_verified_seller_organization";
}

export interface PublicMarketplaceSummary {
  activeOffers: number;
  publishedOffers: number;
  marketValueUsd: number;
  avgPrice: number | null;
  avgPriceUnit?: string;
  avgPriceCount: number;
  avgPriceCoverage: {
    used: number;
    skipped: number;
  };
  median: number | null;
  p25: number | null;
  p75: number | null;
}

export interface PublicMarketplaceOptions {
  commodities: Array<{
    key: string;
    label: string;
    units: string[];
  }>;
}
