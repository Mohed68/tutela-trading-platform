// Shared number utilities for offers
export const toNumber = (v: any) =>
  typeof v === "number" ? v : Number(String(v).replace(/[^\d.-]/g, ""));

export const isNum = (x: any) => Number.isFinite(x);

export const UNIT = {
  barrel: 'bbl',
  bbl: 'bbl',
  metric_ton: 'MT',
  MT: 'MT',
  kg: 'kg',
  gram: 'gram',
  troy_ounce: 'troy oz'
} as const;

export const fmtMoney = (x: number, c = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: c, minimumFractionDigits: 2 }).format(x);

export const fmtMoneyCompact = (x: number, c = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: c, notation: 'compact', maximumFractionDigits: 1 }).format(x);

// MOQ fallback logic
export const suggestMinOrder = ({ commodityName, unit, availableQty }: {
  commodityName?: string;
  unit: string;
  availableQty: number;
}) => {
  let value: number;
  
  if (unit === 'barrel' || unit === 'bbl') {
    value = 1000; // 1,000 barrels
  } else if (unit === 'metric_ton' || unit === 'MT') {
    value = 500; // 500 MT
  } else if (unit === 'troy_ounce') {
    value = 10; // 10 troy oz
  } else {
    value = Math.max(1, Math.floor(availableQty * 0.1)); // 10% of available
  }
  
  return { value };
};

// Safe offer number extraction
export const extractOfferNumbers = (offer: any) => {
  const p = toNumber(offer.unitPrice || offer.pricePerUnit || offer.price || 0);
  const q = toNumber(offer.quantity || 0);
  const ccy = offer.currency ?? 'USD';
  const u = UNIT[offer.unit as keyof typeof UNIT] ?? offer.unit;
  
  // Guard against invalid numbers
  if (!isNum(p) || !isNum(q) || p <= 0 || q <= 0) {
    console.warn('Invalid offer numbers:', { 
      offerId: offer.id, 
      p: offer.unitPrice || offer.pricePerUnit || offer.price, 
      q: offer.quantity 
    });
    // Could add Sentry logging here if needed
  }
  
  // MOQ from policy when needed
  let moq = toNumber(offer.minOrderQty || offer.minOrderQuantity || offer.minQuantity || 0);
  if (!isNum(moq) || moq <= 0) {
    const suggested = suggestMinOrder({ 
      commodityName: offer.commodity?.name || offer.title, 
      unit: offer.unit, 
      availableQty: q 
    });
    moq = suggested.value;
  }
  
  return {
    price: p,
    quantity: q,
    currency: ccy,
    unit: u,
    minOrderQty: moq,
    totalValue: p * q,
    isValid: isNum(p) && isNum(q) && p > 0 && q > 0
  };
};