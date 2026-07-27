// vwap.ts
import { normalizeQty, type CanonUnit } from "./units";

export interface OfferForVWAP {
  price: number;
  qty: number;
  unit: CanonUnit;
  commodity: string;
  density?: number;
}

/**
 * Compute Volume Weighted Average Price unified across units
 */
export function computeVWAP(offers: OfferForVWAP[], targetUnit: CanonUnit): number {
  let numerator = 0;
  let denominator = 0;
  
  for (const offer of offers) {
    const normalizedQty = normalizeQty(offer.qty, offer.unit, targetUnit, offer.commodity, offer.density);
    numerator += offer.price * normalizedQty;
    denominator += normalizedQty;
  }
  
  return denominator ? numerator / denominator : 0;
}