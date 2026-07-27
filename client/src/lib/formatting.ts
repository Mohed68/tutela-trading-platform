// Formatting utilities for TUTELA marketplace

// Guard helpers for number validation
export const toNumber = (v: any): number => {
  if (typeof v === "number") return v;
  const cleaned = String(v).replace(/[^\d.-]/g, "");
  return Number(cleaned);
};

export const isNum = (x: any): boolean => Number.isFinite(x);

// Category labels - Clean display names without "Category" prefix
export const CATEGORY_LABEL = {
  hydro: 'Fuel Hydrocarbons',
  metals: 'Metals',
  agri: 'Agricultural',
  fuel_hydrocarbons: 'Fuel Hydrocarbons',
  metals_precious: 'Precious Metals',
  agricultural: 'Agricultural'
} as const;

export type CategoryKey = keyof typeof CATEGORY_LABEL;

// Bar specification types
export interface BarSpec {
  metal: 'gold' | 'silver';
  label: string; // e.g., "1000 oz bar" | "Good Delivery bar"
  weight: { unit: 'troy_ounce' | 'kg'; value: number }; // e.g., {unit:'troy_ounce', value:1000}
}

// Convert bar weight to troy ounces
export function toOz(spec?: { unit: 'troy_ounce' | 'kg'; value: number }): number | null {
  if (!spec) return null;
  return spec.unit === 'troy_ounce' ? spec.value : spec.value * 32.1507466;
}

// Extract bar spec from legacy text like "(1000oz)" or "1000 oz bar"
export function extractBarSpec(text: string, metal: 'gold' | 'silver'): BarSpec | null {
  const ozMatch = text.match(/\(?(\d+)\s*oz\)?/i);
  if (ozMatch) {
    const ozValue = parseInt(ozMatch[1], 10);
    return {
      metal,
      label: `${ozValue} oz bar`,
      weight: { unit: 'troy_ounce', value: ozValue }
    };
  }
  return null;
}

// Unit labels - moved from units.ts to avoid circular imports
export type Unit = 'bbl' | 'metric_ton' | 'kg' | 'gram' | 'troy_ounce' | 'bar' | 'bag';

export const UNIT_LABEL: Record<Unit, string> = {
  bbl: 'bbl',
  metric_ton: 'MT',
  kg: 'kg', 
  gram: 'gram',
  troy_ounce: 'troy oz',
  bar: 'bar',
  bag: 'bag'
};

/**
 * Format money with currency symbol - Guards against NaN
 */
export function fmtMoney(amount: number, currency: string = 'USD'): string {
  if (!isNum(amount)) {
    console.error('Invalid amount passed to fmtMoney:', amount);
    return '—';
  }
  
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  
  return formatter.format(amount);
}

/**
 * Format money in compact form (e.g., $1.2M, $850K) - Guards against NaN
 */
export function fmtCompactMoney(amount: number, currency: string = 'USD'): string {
  if (!isNum(amount)) {
    console.error('Invalid amount passed to fmtCompactMoney:', amount);
    return '—';
  }
  
  if (amount >= 1000000000) {
    return `${fmtMoney(amount / 1000000000, currency).replace(/\.\d+/, '')}B`;
  } else if (amount >= 1000000) {
    return `${fmtMoney(amount / 1000000, currency).replace(/\.\d+/, '')}M`;
  } else if (amount >= 1000) {
    return `${fmtMoney(amount / 1000, currency).replace(/\.\d+/, '')}K`;
  } else {
    return fmtMoney(amount, currency);
  }
}

/**
 * Format number with appropriate commas - Guards against NaN
 */
export function fmtNumber(value: number): string {
  if (!isNum(value)) {
    console.error('Invalid value passed to fmtNumber:', value);
    return '—';
  }
  return new Intl.NumberFormat('en-US').format(value);
}

/**
 * Format money in compact notation (e.g. $1.2M) - Currency only, no additional symbols or units
 */
export function fmtMoneyCompact(amount: number, currency: string = 'USD'): string {
  if (!isNum(amount)) {
    return `${currency} 0`;
  }
  return new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency, 
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(amount);
}

/**
 * Format full money value with tooltip (for total values)
 */
export function fmtFullMoney(amount: number, currency: string = 'USD'): string {
  if (!isNum(amount)) {
    return 'Invalid data';
  }
  
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  
  return `Total Value: ${formatter.format(amount)}`;
}