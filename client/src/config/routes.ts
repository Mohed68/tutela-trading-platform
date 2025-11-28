export const ROUTES = {
  landing: "/",
  dashboard: "/dashboard",
  marketplace: "/marketplace",
  offers: "/offers",
  commodities: "/commodities",
  contracts: "/contracts",
  partners: "/partners",
  verification: "/verification",
} as const;

export const ROUTE_ALIASES: Record<string, string> = {
  [ROUTES.offers]: ROUTES.marketplace,
  [ROUTES.commodities]: `${ROUTES.marketplace}?view=by-category`,
};
