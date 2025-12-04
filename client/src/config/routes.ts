export const ROUTES = {
  landing: "/",
  dashboard: "/dashboard",
  commodities: "/commodities",
  contracts: "/contracts",
  partners: "/partners",
  verification: "/verification",
  notFound: "/not-found",
  marketplace: "/marketplace",
  offers: "/offers",
} as const;

export const ROUTE_ALIASES: Record<string, string> = {
  [ROUTES.offers]: ROUTES.commodities,
  [ROUTES.marketplace]: ROUTES.commodities,
};
