import type { CurrentUserDto } from "@shared/auth";
import type {
  DashboardMarketplaceSummary,
  DashboardModule,
  DashboardOverviewDto,
  DashboardOwnedOffersSummary,
} from "@shared/dashboard";

const PUBLICATION_POLICY =
  "verified_offer_and_verified_seller_organization" as const;

function unavailable(): DashboardModule<never> {
  return { state: "unavailable", data: null };
}

function settledModule<T>(
  result: PromiseSettledResult<T>,
  isEmpty: (value: T) => boolean,
): DashboardModule<T> {
  if (result.status === "rejected") {
    return { state: "error", data: null };
  }
  return {
    state: isEmpty(result.value) ? "empty" : "available",
    data: result.value,
  };
}

export function buildDashboardOverview(
  account: CurrentUserDto,
  ownedOfferCount: PromiseSettledResult<number>,
  publishedOfferCount: PromiseSettledResult<number>,
): DashboardOverviewDto {
  const myOffers = settledModule<DashboardOwnedOffersSummary>(
    ownedOfferCount.status === "fulfilled"
      ? {
          status: "fulfilled",
          value: { count: ownedOfferCount.value },
        }
      : ownedOfferCount,
    ({ count }) => count === 0,
  );
  const publicMarketplace = settledModule<DashboardMarketplaceSummary>(
    publishedOfferCount.status === "fulfilled"
      ? {
          status: "fulfilled",
          value: {
            publishedOffers: publishedOfferCount.value,
            publicationPolicy: PUBLICATION_POLICY,
          },
        }
      : publishedOfferCount,
    ({ publishedOffers }) => publishedOffers === 0,
  );

  return {
    account: { state: "available", data: account },
    session: {
      state: "available",
      data: { authenticated: true },
    },
    myOffers,
    publicMarketplace,
    contracts: unavailable(),
    orders: unavailable(),
    activity: unavailable(),
    kyb: unavailable(),
    verification: unavailable(),
    subscription: unavailable(),
    performanceInsights: unavailable(),
    aiRecommendations: unavailable(),
  };
}
