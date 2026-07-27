export type CanonUnit = 'bbl'|'bar'|'MT'|'kg'|'gram'|'troy_ounce'|'bag'|'MMBtu';

export const UNIT_CANON: Record<string, CanonUnit> = {
  bbl:'bbl', barrel:'bbl', barrels:'bbl',
  mt:'MT', 'metric_ton':'MT', 'metric ton':'MT', 'metric tons':'MT',
  mmbtu:'MMBtu',
  bar:'bar', bars:'bar',
  'troy oz':'troy_ounce', 'troy_ounce':'troy_ounce',
  kg:'kg', gram:'gram', bag:'bag', bags:'bag'
};

export const UNIT_LABEL: Record<CanonUnit, string> = {
  bbl:'bbl', 
  bar:'bar', 
  MT:'MT', 
  kg:'kg', 
  gram:'gram', 
  troy_ounce:'troy oz', 
  bag:'bag', 
  MMBtu:'MMBtu'
};

/**
 * Normalize unit string to canonical form
 */
export function canonicalizeUnit(unit: string): CanonUnit | null {
  const normalized = unit.toLowerCase().trim();
  for (const [key, canonical] of Object.entries(UNIT_CANON)) {
    if (key.toLowerCase() === normalized) {
      return canonical;
    }
  }
  return null;
}

/**
 * Get display label for canonical unit
 */
export function getUnitLabel(canonUnit: CanonUnit): string {
  return UNIT_LABEL[canonUnit] || canonUnit;
}

// Commodity types for density calculations
export type Commodity = "CRUDE" | "DIESEL" | "JET" | "GASOLINE" | "GOLD" | "SILVER" | "COPPER" | "WHEAT" | "SOYBEANS" | "COFFEE" | "NATURAL_GAS" | "BRENT_CRUDE";

// Default densities for commodity conversion (kg/L)
const defaultDensityKgPerL: Record<string, number> = {
  CRUDE: 0.85,
  BRENT_CRUDE: 0.85,
  DIESEL: 0.832,
  JET: 0.80,
  GASOLINE: 0.745,
  GOLD: 19.32,
  SILVER: 10.49,
  COPPER: 8.96,
  WHEAT: 0.77,
  SOYBEANS: 0.75,
  COFFEE: 0.60,
  NATURAL_GAS: 0.0007
};

/**
 * Convert quantity to Metric Tons
 * 1 bbl = 158.987 L
 */
export function toMT(qty: number, unit: CanonUnit, commodity: string, densityKgPerL?: number): number {
  const d = densityKgPerL ?? defaultDensityKgPerL[commodity.toUpperCase()] ?? 1;
  
  if (unit === "MT") return qty;
  if (unit === "bbl") {
    // MT = BBL * 158.987 * density / 1000
    return qty * 158.987 * d / 1000;
  }
  
  // For other units, return as-is (no conversion available)
  return qty;
}

/**
 * Convert quantity to Barrels
 */
export function toBBL(qty: number, unit: CanonUnit, commodity: string, densityKgPerL?: number): number {
  const d = densityKgPerL ?? defaultDensityKgPerL[commodity.toUpperCase()] ?? 1;
  
  if (unit === "bbl") return qty;
  if (unit === "MT") {
    // BBL = MT * 1000 / (158.987 * density)
    return qty * 1000 / (158.987 * d);
  }
  
  // For other units, return as-is (no conversion available)
  return qty;
}

/**
 * Normalize quantity between units
 */
export function normalizeQty(qty: number, fromUnit: CanonUnit, toUnit: CanonUnit, commodity: string, density?: number): number {
  if (fromUnit === toUnit) return qty;
  
  return toUnit === "MT" 
    ? toMT(qty, fromUnit, commodity, density) 
    : toBBL(qty, fromUnit, commodity, density);
}