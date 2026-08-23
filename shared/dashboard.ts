import type { CurrentUserDto } from "./auth";

export type DashboardModuleState =
  | "available"
  | "empty"
  | "unavailable"
  | "error";

export interface DashboardModule<T> {
  state: DashboardModuleState;
  data: T | null;
}

export interface DashboardSessionSummary {
  authenticated: true;
}

export interface DashboardOwnedOffersSummary {
  count: number;
}

export interface DashboardMarketplaceSummary {
  publishedOffers: number;
  publicationPolicy:
    | "offer_publication_eligibility_v1"
    | "verified_offer_and_verified_seller_organization";
}

export interface DashboardOverviewDto {
  account: DashboardModule<CurrentUserDto>;
  session: DashboardModule<DashboardSessionSummary>;
  myOffers: DashboardModule<DashboardOwnedOffersSummary>;
  publicMarketplace: DashboardModule<DashboardMarketplaceSummary>;
  contracts: DashboardModule<never>;
  orders: DashboardModule<never>;
  activity: DashboardModule<never>;
  kyb: DashboardModule<never>;
  verification: DashboardModule<never>;
  subscription: DashboardModule<never>;
  performanceInsights: DashboardModule<never>;
  aiRecommendations: DashboardModule<never>;
}
