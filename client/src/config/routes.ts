/**
 * Centralized route configuration for TUTELA platform
 * Single source of truth for all navigation paths
 */

export const ROUTES = {
  // Public routes
  home: "/home",
  landing: "/",
  pricing: "/pricing",
  howItWorks: "/how-it-works",
  faq: "/faq",
  demo: "/demo",
  
  // App routes
  dashboard: "/dashboard",
  verification: "/verification",
  
  // Trading routes (canonical)
  marketplace: "/marketplace",    // CANONICAL - browse all offers
  myDrafts: "/my-offers",
  
  // Trading routes (redirects to marketplace)
  offers: "/offers",             // Personal offers management → redirect to marketplace
  commodities: "/commodities",   // Category browsing → redirect to marketplace?view=by-category
  
  // Verified user routes
  contracts: "/contracts",
  orders: "/orders",
  partners: "/partners",
  insights: "/insights",
  negotiations: "/negotiations",
  payments: "/payments",
  
  // Checkout flow
  checkout: "/checkout",
  checkoutSuccess: "/checkout-success",
  
  // Support
  support: "/support",
  settings: "/settings",
  monitoring: "/monitoring",
} as const;

export const ROUTE_ALIASES: Record<string, string> = {
  [ROUTES.offers]: ROUTES.marketplace,
  [ROUTES.commodities]: `${ROUTES.marketplace}?view=by-category`,
};

// Helper to get canonical URL for a given path
export function getCanonicalRoute(path: string): string {
  return ROUTE_ALIASES[path] || path;
}

// Helper to check if a route should redirect
export function shouldRedirect(path: string): boolean {
  return path in ROUTE_ALIASES;
}

export type RouteKey = keyof typeof ROUTES;
export type RoutePath = typeof ROUTES[RouteKey];
