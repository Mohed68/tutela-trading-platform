// MVP market store for offers, reservations, and negotiations
export type Incoterm = "CIF"|"CFR"|"FOB"|"EXW"|"DAP"|"DDP";

export type Offer = {
  id: string;
  commodity: string;
  spec?: { grade?: string; sulfur?: string; gravity?: string };
  priceUsd: number;               // listed price per UOM
  uom: "MT"|"BBL";
  minQty: number;                 // per deal
  maxQty: number;
  lotSize: number;                // enforce multiples
  incoterm: Incoterm;
  delivery: {
    country?: string;
    port?: string;                // UN/LOCODE if available
    windowStart: string;          // ISO date
    windowEnd: string;
    laytimeLoadH?: number;
    laytimeDischargeH?: number;
    demurrageUsdPerDay?: number;
  };
  availableQty: number;           // system derived (total - reserved - committed)
  autoRules: {
    priceDeltaPct: number;        // e.g. 1.0 => ±1% from list price
    qtyRange: [number, number];   // allowed range for counter
    allowedIncoterms: Incoterm[];
    windowToleranceDays: number;  // e.g. ±7 days around original
  };
  sellerId: string;
};

export type Reservation = {
  id: string;
  offerId: string;
  buyerId: string;
  qty: number;
  createdAt: string;        // ISO
  expiresAt: string;        // ISO (TTL e.g., +30 min)
  status: "active"|"expired"|"converted"|"cancelled";
};

export type Negotiation = {
  id: string;
  offerId: string;
  buyerId: string;
  round: 1|2;
  status: "open"|"accepted"|"rejected"|"expired"|"cancelled";
  proposed: { priceUsd: number; qty: number; incoterm: Incoterm; windowStart: string; windowEnd: string };
  decision?: { autoAccepted?: boolean; reason?: string };
  expiresAt: string;        // per-round SLA (e.g., 5 min)
};

export const marketStore = {
  // localStorage helpers
  get<T>(k: string, fallback: T): T { 
    try { 
      return JSON.parse(localStorage.getItem(k) || "") as T; 
    } catch { 
      return fallback; 
    } 
  },
  set<T>(k: string, v: T) { 
    localStorage.setItem(k, JSON.stringify(v)); 
  },

  offers(): Offer[] { 
    return marketStore.get<Offer[]>("t_offers", []); 
  },
  saveOffers(list: Offer[]) { 
    marketStore.set("t_offers", list); 
  },

  reservations(): Reservation[] { 
    return marketStore.get<Reservation[]>("t_res", []); 
  },
  saveReservations(list: Reservation[]) { 
    marketStore.set("t_res", list); 
  },

  negotiations(): Negotiation[] { 
    return marketStore.get<Negotiation[]>("t_neg", []); 
  },
  saveNegotiations(list: Negotiation[]) { 
    marketStore.set("t_neg", list); 
  },

  now() { 
    return new Date().toISOString(); 
  },
};

// Helper logic for auto-accept validation
export function withinPct(target: number, ref: number, pct: number) {
  const delta = Math.abs((target - ref) / ref) * 100;
  return delta <= pct + 1e-9;
}

export function withinWindow(d: {start:string; end:string}, ref: {start:string; end:string}, tolDays: number) {
  const day = 24*3600*1000;
  const s = new Date(d.start).getTime(), e = new Date(d.end).getTime();
  const rs = new Date(ref.start).getTime(), re = new Date(ref.end).getTime();
  return s >= rs - tolDays*day && e <= re + tolDays*day && s <= e;
}

export function isMultipleOf(n: number, lot: number) {
  return Math.round(n/lot)*lot === n;
}

export function canAutoAccept(o: Offer, prop: Negotiation["proposed"]) {
  const priceOk = withinPct(prop.priceUsd, o.priceUsd, o.autoRules.priceDeltaPct);
  const qtyOk = prop.qty >= o.autoRules.qtyRange[0] && prop.qty <= o.autoRules.qtyRange[1] && isMultipleOf(prop.qty, o.lotSize);
  const incotermOk = o.autoRules.allowedIncoterms.includes(prop.incoterm);
  const windowOk = withinWindow(
    { start: prop.windowStart, end: prop.windowEnd },
    { start: o.delivery.windowStart, end: o.delivery.windowEnd },
    o.autoRules.windowToleranceDays
  );
  return priceOk && qtyOk && incotermOk && windowOk;
}