/**
 * Robust numeric guards and insights computation with VWAP
 */

// Safe number conversion with NaN protection
export const toNum = (v: any): number => {
  if (typeof v === "number") return v;
  const cleaned = String(v).replace(/[^\d.-]/g, '');
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
};

export const isNum = (x: any): boolean => Number.isFinite(x);

interface Offer {
  id: string;
  pricePerUnit?: number | string;
  price?: number | string;
  quantity: number | string;
  sellerOrg?: { id: string };
  sellerOrgId?: string;
  userId?: string;
}

export function safeUnitPrice(offer: Offer): number {
  return toNum(offer.pricePerUnit || offer.price || 0);
}

export function safeQty(offer: Offer): number {
  return toNum(offer.quantity || 0);
}

export interface InsightMetrics {
  activeOffers: number;
  marketValueUsd: number;
  verifiedTraders: number;
  avgUnitPrice: number | null;
}

export function computeInsights(offers: Offer[]): InsightMetrics {
  // Filter to offers with valid numeric data
  const valid = offers.filter(offer => {
    const unitPrice = safeUnitPrice(offer);
    const qty = safeQty(offer);
    return isNum(unitPrice) && isNum(qty) && unitPrice > 0 && qty > 0;
  });

  const activeOffers = valid.length;

  // Calculate total market value
  const marketValueUsd = valid.reduce((sum, offer) => {
    return sum + (safeUnitPrice(offer) * safeQty(offer));
  }, 0);

  // Count distinct verified traders by organization ID
  const traderIds = new Set(
    valid
      .map(offer => offer.sellerOrg?.id || offer.sellerOrgId || offer.userId)
      .filter(Boolean)
  );
  const verifiedTraders = traderIds.size;

  // Calculate Volume-Weighted Average Price (VWAP)
  const totalQty = valid.reduce((sum, offer) => sum + safeQty(offer), 0);
  const vwap = totalQty > 0
    ? valid.reduce((sum, offer) => {
        return sum + (safeUnitPrice(offer) * safeQty(offer));
      }, 0) / totalQty
    : null;

  return {
    activeOffers,
    marketValueUsd: isNum(marketValueUsd) ? marketValueUsd : 0,
    verifiedTraders,
    avgUnitPrice: vwap && isNum(vwap) ? vwap : null
  };
}

/**
 * Format functions for UI display
 */
export function fmtCompactMoney(amount: number, currency: string = 'USD'): string {
  if (!isNum(amount)) return '—';
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(amount);
}

export function fmtFullMoney(amount: number, currency: string = 'USD'): string {
  if (!isNum(amount)) return '—';
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

export function fmtNumber(value: number): string {
  if (!isNum(value)) return '—';
  return new Intl.NumberFormat('en-US').format(value);
}