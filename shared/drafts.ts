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
  offerType: "sell";
  commodityId: string;
  quantity: string;
  unit: DraftOfferUnit;
  amountPerUnit: string;
  currency: "USD";
  location: string;
  validUntil?: string;
}

export interface UpdateDraftOfferRequest {
  offerType?: "sell";
  commodityId?: string;
  quantity?: string;
  unit?: DraftOfferUnit;
  amountPerUnit?: string;
  currency?: "USD";
  location?: string;
  validUntil?: string | null;
}

interface OwnerPrivateOfferDto {
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
  status: "draft" | "submitted";
  visibility: {
    state: "private" | "owner_view";
  };
  validUntil: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface DraftOfferSummaryDto
  extends Omit<OwnerPrivateOfferDto, "status"> {
  status: "draft";
}

export type DraftOfferDetailDto = DraftOfferSummaryDto;

export interface SubmittedOfferSummaryDto
  extends Omit<OwnerPrivateOfferDto, "status"> {
  status: "submitted";
}

export type SubmittedOfferDetailDto = SubmittedOfferSummaryDto;

export interface ProcessedOfferSummaryDto extends Omit<OwnerPrivateOfferDto, "status"> {
  status: "verified" | "closed" | "hidden" | "archived" | "cancelled";
}

export type OwnerPrivateOfferSummaryDto =
  | DraftOfferSummaryDto
  | SubmittedOfferSummaryDto
  | ProcessedOfferSummaryDto;

export type OwnerPrivateOfferDetailDto =
  | DraftOfferDetailDto
  | SubmittedOfferDetailDto
  | ProcessedOfferSummaryDto;

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
