export type CanonUnit = 'bbl'|'MT'|'kg'|'gram'|'troy_ounce'|'bar'|'bag'|'MMBtu';
export type CommodityKey = 
  'brent_crude_oil'|'west_texas_intermediate_(wti)_crude_oil'|'diesel'|'gasoline'|'lng'|'lpg'|'natural_gas_(henry_hub)'|
  'soybeans'|'wheat'|'arabica_coffee_beans'|
  'gold_bullion'|'silver'|'copper_cathode';

export type OfferHints = {
  apiGravity?: number;      // crude, at 60°F
  densityKgPerL?: number;   // refined / explicit
  bagWeightKg?: number;     // agriculture (e.g., 60)
  barWeightOz?: number;     // precious metals (e.g., 400, 1000)
};

export type ConvProfile = {
  base: CanonUnit;              // canonical base unit (for documentation only)
  defaultDensityKgPerL?: number;// fallback when hints missing
  // declare which unit pairs are convertible for this commodity
  convertible: Array<{from: CanonUnit, to: CanonUnit, fn:(h:OfferHints)=>number|null}>;
};

// helpers
const LITERS_PER_BBL = 158.987;

function densityFromApi(api: number): number {
  // SG = 141.5/(API+131.5); density ≈ SG * 0.999016 kg/L at 60°F
  const sg = 141.5 / (api + 131.5);
  return sg * 0.999016;
}

function bblPerMT(densityKgPerL: number): number {
  // 1 MT = (1000 kg) / (density kg/L) liters; divide by L/bbl
  return (1000 / densityKgPerL) / LITERS_PER_BBL;
}

export const PROFILES: Record<string, ConvProfile> = {
  'brent_crude_oil': {
    base:'bbl',
    defaultDensityKgPerL: 0.835,          // ~API 38–39
    convertible: [
      { from:'bbl', to:'MT', fn:(h)=> {
          const d = h.densityKgPerL ?? (h.apiGravity ? densityFromApi(h.apiGravity) : 0.835);
          return d ? 1 / bblPerMT(d) : null;      // factor to multiply bbl → MT
        }},
      { from:'MT', to:'bbl', fn:(h)=> {
          const d = h.densityKgPerL ?? (h.apiGravity ? densityFromApi(h.apiGravity) : 0.835);
          return d ? bblPerMT(d) : null;          // factor to multiply MT → bbl
        }},
    ]
  },
  'west_texas_intermediate_(wti)_crude_oil': {
    base:'bbl', 
    defaultDensityKgPerL: 0.827, // API~39.6
    convertible: [
      { from:'bbl', to:'MT', fn:(h)=> {
          const d = h.densityKgPerL ?? (h.apiGravity ? densityFromApi(h.apiGravity) : 0.827);
          return d ? 1 / bblPerMT(d) : null;
        }},
      { from:'MT', to:'bbl', fn:(h)=> {
          const d = h.densityKgPerL ?? (h.apiGravity ? densityFromApi(h.apiGravity) : 0.827);
          return d ? bblPerMT(d) : null;
        }},
    ]
  },
  'diesel': {
    base:'MT', 
    defaultDensityKgPerL: 0.832,
    convertible: [
      { from:'MT', to:'bbl', fn:(h)=> { 
          const d = h.densityKgPerL ?? 0.832; 
          return (1000/d)/LITERS_PER_BBL; 
        }},
      { from:'bbl', to:'MT', fn:(h)=> { 
          const d = h.densityKgPerL ?? 0.832; 
          return d ? 1/((1000/d)/LITERS_PER_BBL) : null; 
        }},
    ]
  },
  'gasoline': { 
    base:'MT', 
    defaultDensityKgPerL: 0.745, 
    convertible: [
      { from:'MT', to:'bbl', fn:(h)=> { 
          const d = h.densityKgPerL ?? 0.745; 
          return (1000/d)/LITERS_PER_BBL; 
        }},
      { from:'bbl', to:'MT', fn:(h)=> { 
          const d = h.densityKgPerL ?? 0.745; 
          return d ? 1/((1000/d)/LITERS_PER_BBL) : null; 
        }},
    ]
  },

  // Agriculture (bags ↔ kg / MT)
  'soybeans': {
    base:'MT', 
    convertible: [
      { from:'bag', to:'kg', fn:(h)=> h.bagWeightKg ?? 60 },
      { from:'kg',  to:'bag', fn:(h)=> { const w=h.bagWeightKg ?? 60; return w ? 1/w : null; }},
      { from:'kg',  to:'MT', fn:()=> 0.001 },
      { from:'MT',  to:'kg', fn:()=> 1000 },
      { from:'bag', to:'MT', fn:(h)=> (h.bagWeightKg ?? 60) / 1000 },
      { from:'MT',  to:'bag', fn:(h)=> { const w=h.bagWeightKg ?? 60; return w ? 1000/w : null; }},
    ]
  },
  'wheat': {
    base:'MT', 
    convertible: [
      { from:'bag', to:'kg', fn:(h)=> h.bagWeightKg ?? 60 },
      { from:'kg',  to:'bag', fn:(h)=> { const w=h.bagWeightKg ?? 60; return w ? 1/w : null; }},
      { from:'kg',  to:'MT', fn:()=> 0.001 },
      { from:'MT',  to:'kg', fn:()=> 1000 },
      { from:'bag', to:'MT', fn:(h)=> (h.bagWeightKg ?? 60) / 1000 },
      { from:'MT',  to:'bag', fn:(h)=> { const w=h.bagWeightKg ?? 60; return w ? 1000/w : null; }},
    ]
  },

  // Precious metals (bars ↔ troy oz)
  'gold_bullion': {
    base:'troy_ounce', 
    convertible: [
      { from:'bar',        to:'troy_ounce', fn:(h)=> h.barWeightOz ?? 400 },
      { from:'troy_ounce', to:'bar',        fn:(h)=> { const w=h.barWeightOz ?? 400; return w ? 1/w : null; }},
    ]
  },
  'silver': {
    base:'troy_ounce', 
    convertible: [
      { from:'bar',        to:'troy_ounce', fn:(h)=> h.barWeightOz ?? 1000 },
      { from:'troy_ounce', to:'bar',        fn:(h)=> { const w=h.barWeightOz ?? 1000; return w ? 1/w : null; }},
    ]
  },

  // Single-unit commodities
  'copper_cathode': { base:'MT', convertible: [] },
  'natural_gas_(henry_hub)': { base:'MMBtu', convertible: [] },
  'lng': { base:'MT', convertible: [] },
  'lpg': { base:'MT', convertible: [] },
  'arabica_coffee_beans': {
    base: 'bag',
    convertible: [
      { from:'bag', to:'kg', fn:(h)=> h.bagWeightKg ?? 60 },
      { from:'kg',  to:'bag', fn:(h)=> { const w=h.bagWeightKg ?? 60; return w ? 1/w : null; }},
      { from:'kg',  to:'MT', fn:()=> 0.001 },
      { from:'MT',  to:'kg', fn:()=> 1000 },
      { from:'bag', to:'MT', fn:(h)=> (h.bagWeightKg ?? 60) / 1000 },
      { from:'MT',  to:'bag', fn:(h)=> { const w=h.bagWeightKg ?? 60; return w ? 1000/w : null; }},
    ]
  },
};

export function qtyFactor(
  commodity: string,
  from: CanonUnit,
  to: CanonUnit,
  h: OfferHints
): number | null {
  if (from === to) return 1;

  // Hydrocarbons
  const oil = (def: number) => {
    const d = h.densityKgPerL ?? (h.apiGravity ? densityFromApi(h.apiGravity) : def);
    if (!d) return null;
    return from === 'bbl' && to === 'MT' ? 1 / bblPerMT(d)
         : from === 'MT'  && to === 'bbl' ? bblPerMT(d)
         : null;
  };
  
  if (commodity === 'west_texas_intermediate_(wti)_crude_oil') return oil(0.827);   // ~API 39.6
  if (commodity === 'brent_crude_oil') return oil(0.835);   // ~API 38–39
  if (commodity === 'diesel') return oil(0.832);
  if (commodity === 'gasoline') return oil(0.745);

  // Agriculture: bags ↔ kg ↔ MT
  const bagW = h.bagWeightKg ?? 60;
  if (commodity === 'soybeans' || commodity === 'wheat' || commodity === 'arabica_coffee_beans') {
    if (from === 'bag' && to === 'kg') return bagW;
    if (from === 'kg' && to === 'bag') return 1 / bagW;
    if (from === 'kg' && to === 'MT') return 0.001;
    if (from === 'MT' && to === 'kg') return 1000;
    if (from === 'bag' && to === 'MT') return bagW / 1000;
    if (from === 'MT' && to === 'bag') return 1000 / bagW;
    return null;
  }

  // Precious metals: bar ↔ troy oz
  if (commodity === 'gold_bullion') { 
    const w = h.barWeightOz ?? 400; 
    return from === 'bar' && to === 'troy_ounce' ? w 
         : from === 'troy_ounce' && to === 'bar' ? 1 / w 
         : null; 
  }
  if (commodity === 'silver') { 
    const w = h.barWeightOz ?? 1000; 
    return from === 'bar' && to === 'troy_ounce' ? w 
         : from === 'troy_ounce' && to === 'bar' ? 1 / w 
         : null; 
  }

  // Copper / Natural gas: single-unit (no cross-unit convert)
  return null;
}

// Get all possible units for a commodity (base + convertible units)
export function getCommodityUnits(commodityKey: string): CanonUnit[] {
  const profile = PROFILES[commodityKey];
  if (!profile) return [];
  
  const units = new Set<CanonUnit>([profile.base]);
  
  // Add all convertible units
  profile.convertible.forEach(conv => {
    units.add(conv.from);
    units.add(conv.to);
  });
  
  return Array.from(units);
}