export const DRAFT_OFFER_UNITS = [
  "bbl",
  "MT",
  "kg",
  "gram",
  "troy_ounce",
  "bar",
  "bag",
  "MMBtu",
] as const;

export type DraftOfferUnit = (typeof DRAFT_OFFER_UNITS)[number];

export interface CreateDraftOfferRequest {
  offerType: "buy" | "sell";
  commodityId: string;
  quantity: string;
  unit: DraftOfferUnit;
  amountPerUnit: string;
  currency: "USD";
  location: string;
  validUntil?: string;
}

export interface UpdateDraftOfferRequest {
  offerType?: "buy" | "sell";
  commodityId?: string;
  quantity?: string;
  unit?: DraftOfferUnit;
  amountPerUnit?: string;
  currency?: "USD";
  location?: string;
  validUntil?: string | null;
}

export interface DraftOfferSummaryDto {
  id: string;
  offerType: "buy" | "sell";
  commodity: {
    id: string;
    name: string;
    category: string;
  };
  quantity: {
    value: string;
    unit: DraftOfferUnit;
  };
  pricing: {
    amountPerUnit: string;
    currency: "USD";
  };
  location: string;
  status: "draft";
  visibility: {
    state: "private";
  };
  validUntil: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export type DraftOfferDetailDto = DraftOfferSummaryDto;

export interface DeleteDraftOfferResponse {
  id: string;
  deleted: true;
}

export interface DraftOfferOptionsDto {
  currency: "USD";
  commodities: Array<{
    id: string;
    name: string;
    category: string;
    units: DraftOfferUnit[];
  }>;
}
