export type MarketFilter = {
  tenantId?: string;
  category?: string | null;
  commodityKey?: string | null;
  // REMOVED: unit - units are for normalization only, never filtering
  // unit?: string | null;
  q?: string | null;
};

/**
 * Creates the base filter criteria for public marketplace offers
 * This MUST be used by both list and summary endpoints to ensure 1:1 matching
 */
export function wherePublicOffers(f: MarketFilter = {}) {
  // Log the where object to detect unit leaks
  const whereClause = {
    // Core marketplace criteria - NEVER change these without updating both endpoints
    verified: true,
    sellerOrgVerified: true,  // This is critical for verified trader count
    status: 'active',
    // Future multi-tenancy support
    ...(f.tenantId ? { tenant_id: f.tenantId } : {}),
    // Commodity filtering
    ...(f.commodityKey ? { commodity_key: f.commodityKey } : {}),
    // REMOVED: Unit filtering - units are for normalization only, never filtering
    // ...(f.unit ? { unit: f.unit } : {}),
  };
  
  // Dev assertion to catch unit leaks
  if (process.env.NODE_ENV === 'development' && 'unit' in whereClause) {
    console.error('[UNIT LEAK] Unit found in WHERE clause:', whereClause);
  }
  
  return whereClause;
}

/**
 * Apply category filter to offers array - same logic for list and summary
 */
export function applyCategoryFilter(offers: any[], category?: string | null) {
  if (!category || category === 'all') {
    return offers;
  }
  
  return offers.filter(offer => 
    offer.commodity?.type === category
  );
}

/**
 * Apply search query filter to offers array - same logic for list and summary  
 */
export function applySearchFilter(offers: any[], query?: string | null) {
  if (!query?.trim()) {
    return offers;
  }
  
  const searchTerm = query.toLowerCase().trim();
  return offers.filter(offer =>
    offer.commodity?.name?.toLowerCase().includes(searchTerm) ||
    offer.commodityName?.toLowerCase().includes(searchTerm) ||
    offer.title?.toLowerCase().includes(searchTerm) ||
    offer.sellerOrgName?.toLowerCase().includes(searchTerm) ||
    offer.location?.toLowerCase().includes(searchTerm)
  );
}

/**
 * Unified filter resolution for both list and summary endpoints
 * Returns the exact same filtering parameters to ensure count consistency
 */
export function resolveFilters(req: any): MarketFilter {
  const filters = {
    tenantId: req.headers['x-tenant-id'] || process.env.DEFAULT_TENANT_ID,
    category: req.query.category as string,
    commodityKey: req.query.commodityKey as string,
    // REMOVED: unit filter - units are for normalization only
    // unit: req.query.unit as string,
    q: req.query.q as string,
  };
  
  // Dev assertion to catch unit leaks
  if (process.env.NODE_ENV === 'development' && req.query.unit) {
    console.log('[UNIT LEAK WARNING] Unit param detected but ignored:', req.query.unit);
  }
  
  return filters;
}

/**
 * Apply commodity key filter to offers array
 */
export function applyCommodityKeyFilter(offers: any[], commodityKey?: string | null) {
  if (!commodityKey) {
    return offers;
  }
  
  return offers.filter(offer => {
    const offerKey = offer.commodity?.name?.toLowerCase().replace(/\s+/g, '_') || 
                     offer.commodity?.id?.toLowerCase();
    return offerKey === commodityKey;
  });
}

/**
 * Apply unit filter to offers array
 */
export function applyUnitFilter(offers: any[], unit?: string | null) {
  if (!unit) {
    return offers;
  }
  
  return offers.filter(offer => offer.unit === unit);
}

/**
 * Apply all filters to offers array - IDENTICAL logic for list and summary
 */
export function applyAllFilters(offers: any[], filter: MarketFilter): any[] {
  let filtered = offers;
  
  // Apply category filter
  filtered = applyCategoryFilter(filtered, filter.category);
  
  // Apply commodity key filter
  filtered = applyCommodityKeyFilter(filtered, filter.commodityKey);
  
  // REMOVED: Unit filter - units are for normalization only, never filtering
  // filtered = applyUnitFilter(filtered, filter.unit);
  
  // Apply search filter  
  filtered = applySearchFilter(filtered, filter.q);
  
  return filtered;
}