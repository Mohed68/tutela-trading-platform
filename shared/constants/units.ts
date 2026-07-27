// Canonical unit mapping to unify unit slugs across client and server
export const UNIT_CANON: Record<string, string> = {
  'bbl': 'bbl', 
  'barrels': 'bbl',
  'mt': 'MT', 
  'metric_ton': 'MT', 
  'metric ton': 'MT',
  'mmbtu': 'MMBtu',
  'bar': 'bar',
  'troy oz': 'troy_ounce', 
  'troy_oz': 'troy_ounce', 
  'troy ounce': 'troy_ounce',
  'bag': 'bag', 
  'kg': 'kg', 
  'gram': 'gram'
};

/**
 * Canonicalize unit strings to prevent mismatches
 * Used by both client and server to ensure consistent unit handling
 */
export const canon = (u?: string): string | undefined => {
  if (!u) return u;
  return UNIT_CANON[u.toLowerCase()] ?? u;
};