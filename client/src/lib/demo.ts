// Demo mode functionality
import type {
  PublicMarketplaceOffer,
  PublicMarketplaceSummary,
} from "@shared/marketplace";
import type { Reservation } from "./marketStore";

export type DemoMode = "verified" | "pending";

export interface DemoStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface DemoContractPreview {
  id: string;
  reservationId: string;
  offerId: string;
  status: "draft_preview";
  simulation: true;
  buyerDisplayName: "Demo Trader";
  sellerDisplayName: string;
  commodityName: string;
  quantity: number;
  unit: string;
  amountPerUnit: number;
  currency: string;
  totalAmount: number;
  deliveryTerms: string;
  paymentTerms: "Demo terms";
  reservationExpiresAt: string;
}

const DEMO_OFFERS = [
  // FUEL & HYDROCARBONS - Higher values
  {
    id: "demo-o1",
    userId: "demo-seller1",
    commodityId: "c1",
    type: "sell",
    quantity: 50000,
    price: 78.45,
    currency: "USD",
    unit: "barrel",
    location: "Houston, TX",
    deliveryTerms: "FOB",
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    specifications: {
      grade: "WTI Crude Oil",
      sulfur: "0.24%",
      gravity: "39.6° API"
    },
    seller: "Gulf Energy Trading LLC",
    minOrderQty: 1000,
    contactName: "Ahmed",
    contactLastName: "Al-Rashid"
  },
  {
    id: "demo-o2",
    userId: "demo-buyer1", 
    commodityId: "c1",
    type: "buy",
    quantity: 25000,
    price: 77.80,
    currency: "USD",
    unit: "barrel", 
    location: "Singapore",
    deliveryTerms: "CIF",
    validUntil: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
    specifications: {
      grade: "Light Sweet Crude",
      sulfur: "<0.3%",
      gravity: "38-42° API"
    },
    seller: "Asia Pacific Refining Co.",
    minOrderQty: 1000,
    contactName: "Li",
    contactLastName: "Chen"
  },
  {
    id: "demo-o3",
    userId: "demo-seller2",
    commodityId: "c4", 
    type: "sell",
    quantity: 15000,
    price: 82.20,
    currency: "USD",
    unit: "barrel",
    location: "Fujairah, UAE",
    deliveryTerms: "FOB",
    validUntil: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
    specifications: {
      grade: "Brent Crude Oil",
      sulfur: "0.37%", 
      gravity: "38.3° API"
    },
    seller: "Emirates Oil Trading Co.",
    minOrderQty: 1000,
    contactName: "Mohammed",
    contactLastName: "Bin Rashid",
    needsVerification: true
  },
  {
    id: "demo-o4",
    userId: "demo-seller3",
    commodityId: "c5",
    type: "sell", 
    quantity: 8000,
    price: 920.00,
    currency: "USD",
    unit: "metric_ton",
    location: "Rotterdam",
    deliveryTerms: "FOB",
    validUntil: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
    specifications: {
      grade: "Premium Gasoline",
      octane: "95 RON",
      density: "0.72-0.78 g/cm³"
    },
    seller: "European Petroleum Supply",
    minOrderQty: 500,
    contactName: "Klaus",
    contactLastName: "Mueller"
  },
  {
    id: "demo-o5",
    userId: "demo-buyer2",
    commodityId: "c6",
    type: "buy",
    quantity: 12000,
    price: 875.50,
    currency: "USD",
    unit: "metric_ton", 
    location: "New York Port",
    deliveryTerms: "CIF",
    validUntil: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString(),
    specifications: {
      grade: "Ultra-Low Sulfur Diesel",
      sulfur: "<10 ppm",
      cetane: ">51"
    },
    seller: "Northeast Fuel Distributors",
    minOrderQty: 500,
    contactName: "John",
    contactLastName: "Harrison"
  },

  // METALS & PRECIOUS METALS - Higher values  
  {
    id: "demo-o6",
    userId: "demo-seller4",
    commodityId: "c2",
    type: "sell",
    quantity: 5000,
    price: 2095.75,
    currency: "USD",
    unit: "troy_ounce",
    location: "Zurich",
    deliveryTerms: "EXW",
    validUntil: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(),
    specifications: {
      purity: "999.9 Fine Gold",
      form: "1oz bars",
      certification: "LBMA Good Delivery"
    },
    seller: "Swiss Precious Metals AG",
    minOrderQty: 10,
    contactName: "Hans",
    contactLastName: "Zimmermann"
  },
  {
    id: "demo-o7", 
    userId: "demo-seller5",
    commodityId: "c7",
    type: "sell",
    quantity: 15000,
    price: 24.85,
    currency: "USD",
    unit: "troy_ounce",
    location: "London",
    deliveryTerms: "EXW",
    validUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
    specifications: {
      purity: "99.9% Fine Silver",
      form: "1000oz bars",
      certification: "LBMA Good Delivery"
    },
    seller: "London Bullion Markets Ltd",
    minOrderQty: 100,
    contactName: "James",
    contactLastName: "Wellington"
  },
  {
    id: "demo-o8",
    userId: "demo-buyer3",
    commodityId: "c8",
    type: "buy",
    quantity: 800,
    price: 985.20,
    currency: "USD",
    unit: "troy_ounce",
    location: "Tokyo",
    deliveryTerms: "CIF",
    validUntil: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000).toISOString(),
    specifications: {
      purity: "Industrial Grade Platinum", 
      form: "Sponge/powder",
      certification: "LPPM certified"
    },
    seller: "Japan Industrial Metals Corp",
    minOrderQty: 50,
    contactName: "Hiroshi",
    contactLastName: "Tanaka"
  },
  {
    id: "demo-o9",
    userId: "demo-seller6",
    commodityId: "c9",
    type: "sell",
    quantity: 2500,
    price: 2180.00,
    currency: "USD",
    unit: "metric_ton",
    location: "Vancouver",
    deliveryTerms: "FOB",
    validUntil: new Date(Date.now() + 50 * 24 * 60 * 60 * 1000).toISOString(),
    specifications: {
      purity: "99.7% Aluminum",
      form: "T-bar ingots",
      standard: "LME Grade A"
    },
    seller: "Canadian Metal Works Inc",
    minOrderQty: 100,
    contactName: "Robert",
    contactLastName: "MacLeod"
  },

  // AGRICULTURAL PRODUCTS - Higher values
  {
    id: "demo-o10",
    userId: "demo-seller7", 
    commodityId: "c3",
    type: "sell",
    quantity: 25000,
    price: 285.50,
    currency: "USD",
    unit: "metric_ton",
    location: "Kansas City",
    deliveryTerms: "FOB",
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    specifications: {
      grade: "Hard Red Winter Wheat",
      protein: "12.5%",
      moisture: "<14%"
    },
    seller: "Great Plains Grain Co",
    minOrderQty: 500,
    contactName: "William",
    contactLastName: "Johnson"
  },
  {
    id: "demo-o11",
    userId: "demo-buyer4",
    commodityId: "c10",
    type: "buy",
    quantity: 18000,
    price: 445.75,
    currency: "USD", 
    unit: "metric_ton",
    location: "Chicago",
    deliveryTerms: "CIF",
    validUntil: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString(),
    specifications: {
      grade: "Non-GMO Grade #1",
      protein: ">35%",
      moisture: "<14%"
    },
    seller: "Midwest Agricultural Trading",
    minOrderQty: 500,
    contactName: "Sarah",
    contactLastName: "Anderson"
  },
  {
    id: "demo-o12",
    userId: "demo-seller8",
    commodityId: "c11",
    type: "sell",
    quantity: 1200,
    price: 3250.00,
    currency: "USD",
    unit: "metric_ton",
    location: "Santos, Brazil", 
    deliveryTerms: "FOB",
    validUntil: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(),
    specifications: {
      grade: "Specialty Arabica",
      cupping: "82+ points",
      moisture: "<12%"
    },
    seller: "Brazilian Coffee Exporters SA",
    minOrderQty: 100,
    contactName: "Carlos",
    contactLastName: "Silva"
  },
  {
    id: "demo-o13",
    userId: "demo-seller9",
    commodityId: "c12",
    type: "sell",
    quantity: 35000,
    price: 195.25,
    currency: "USD",
    unit: "metric_ton",
    location: "New Orleans",
    deliveryTerms: "FOB",
    validUntil: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000).toISOString(),
    specifications: {
      grade: "Yellow Corn #2",
      moisture: "<15%",
      protein: "8.5%+"
    },
    seller: "Gulf Coast Grain Terminal",
    minOrderQty: 500,
    contactName: "Michael",
    contactLastName: "Rodriguez"
  },
  {
    id: "demo-o14",
    userId: "demo-buyer5",
    commodityId: "c1", 
    type: "buy",
    quantity: 40000,
    price: 79.15,
    currency: "USD",
    unit: "barrel",
    location: "Los Angeles",
    deliveryTerms: "CIF",
    validUntil: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString(),
    specifications: {
      grade: "West Coast Crude Blend",
      sulfur: "<0.5%",
      gravity: "35-40° API"
    },
    seller: "Pacific Energy Solutions",
    minOrderQty: 1000,
    contactName: "Jennifer",
    contactLastName: "Kim"
  },
  {
    id: "demo-o15",
    userId: "demo-seller10",
    commodityId: "c2",
    type: "sell", 
    quantity: 3500,
    price: 2108.90,
    currency: "USD",
    unit: "troy_ounce",
    location: "Dubai", 
    deliveryTerms: "FOB",
    validUntil: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
    specifications: {
      purity: "999.9 Investment Gold",
      form: "10oz bars",
      certification: "Dubai Multi Commodities Centre"
    },
    seller: "Middle East Precious Metals LLC",
    minOrderQty: 25,
    contactName: "Omar",
    contactLastName: "Al-Mansouri"
  }
];

const DEMO_DEALS = [
  {
    id: "demo-d1",
    buyerId: "demo-user",
    sellerId: "demo-seller1", 
    commodityId: "c1",
    quantity: 15000,
    price: 78.25,
    currency: "USD",
    status: "pending_payment",
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    smartContract: {
      address: "0xdemo123...",
      status: "deployed",
      escrowAmount: 1173750
    }
  },
  {
    id: "demo-d2", 
    buyerId: "demo-user",
    sellerId: "demo-seller4",
    commodityId: "c2",
    quantity: 2500,
    price: 2095.75,
    currency: "USD",
    status: "completed",
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    smartContract: {
      address: "0xdemo456...",
      status: "completed",
      escrowAmount: 5239375
    }
  },
  {
    id: "demo-d3",
    buyerId: "demo-buyer4",
    sellerId: "demo-user", 
    commodityId: "c10",
    quantity: 8500,
    price: 445.75,
    currency: "USD",
    status: "in_transit",
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    smartContract: {
      address: "0xdemo789...",
      status: "active",
      escrowAmount: 3788875
    }
  }
];

const DEMO_METRICS = {
  activeOffers: 15,
  pendingContracts: 8,
  totalVolume: 24580000,
  verifiedPartners: 47
};

export function initializeDemoSession(
  storage: DemoStorage,
  mode: DemoMode = "verified",
): void {
  storage.removeItem("tutela_demo_disabled");
  storage.setItem("tutela_demo", "1");
  storage.setItem("tutela_demo_mode", mode);
  storage.setItem(
    "tutela_kyb_state",
    mode === "verified" ? "verified" : "pending",
  );
  storage.setItem("tutela_user_role", "buyer");
  storage.setItem("tutela_demo_offers", JSON.stringify(DEMO_OFFERS));
  storage.setItem("tutela_demo_deals", JSON.stringify(DEMO_DEALS));
  storage.setItem("tutela_demo_metrics", JSON.stringify(DEMO_METRICS));

  // Every explicit demo start is a fresh, isolated browser simulation.
  storage.removeItem("t_res");
  storage.removeItem("t_neg");
}

export function enableDemo(mode: DemoMode = "verified"): void {
  initializeDemoSession(localStorage, mode);
  
  // Set verification state
  if (mode === "verified") {
    document.body.classList.remove("state-unverified", "state-pending");
    document.body.classList.add("state-verified");
  } else {
    document.body.classList.remove("state-unverified", "state-verified");
    document.body.classList.add("state-pending");
  }
  
  // Navigate to dashboard
  window.location.href = "/dashboard";
}

export function disableDemo(): void {
  // Set explicit demo disabled flag
  localStorage.setItem("tutela_demo_disabled", "1");
  
  // Clear demo flags and data
  localStorage.removeItem("tutela_demo");
  localStorage.removeItem("tutela_demo_mode");
  localStorage.removeItem("tutela_demo_offers");
  localStorage.removeItem("tutela_demo_deals");
  localStorage.removeItem("tutela_demo_metrics");
  localStorage.removeItem("tutela_user_role");
  localStorage.removeItem("t_res");
  localStorage.removeItem("t_neg");
  
  // Reset verification state
  localStorage.removeItem("tutela_kyb_state");
  document.body.classList.remove("state-verified", "state-pending");
  document.body.classList.add("state-unverified");
  
  // Trigger storage event to update auth state
  window.dispatchEvent(new Event('storage'));
  
  // Also call logout endpoint to clear server-side session
  fetch('/api/logout', { method: 'GET', credentials: 'same-origin' })
    .then(() => {
      window.location.href = "/";
    })
    .catch(() => {
      // Fallback if logout fails
      window.location.href = "/";
    });
}

export function isDemo(): boolean {
  // Check if user explicitly disabled demo mode
  if (localStorage.getItem("tutela_demo_disabled") === "1") {
    return false;
  }
  
  const isDevelopment = import.meta.env?.DEV || import.meta.env?.NODE_ENV === 'development';
  return localStorage.getItem("tutela_demo") === "1" || isDevelopment;
}

export function getDemoMode(): DemoMode | null {
  if (!isDemo()) return null;
  return (localStorage.getItem("tutela_demo_mode") as DemoMode) || "verified";
}

export function getDemoData(key: string): any {
  if (!isDemo()) return null;
  const data = localStorage.getItem(`tutela_demo_${key}`);
  return data ? JSON.parse(data) : null;
}

// Helper to get demo offers directly
export function getDemoOffers() {
  return DEMO_OFFERS;
}

const DEMO_COMMODITIES: Record<
  string,
  { name: string; category: string }
> = {
  c1: { name: "Crude Oil", category: "fuel_hydrocarbons" },
  c2: { name: "Gold", category: "metals_precious" },
  c3: { name: "Wheat", category: "agricultural" },
  c4: { name: "Brent Crude Oil", category: "fuel_hydrocarbons" },
  c5: { name: "Gasoline", category: "fuel_hydrocarbons" },
  c6: { name: "Diesel", category: "fuel_hydrocarbons" },
  c7: { name: "Silver", category: "metals_precious" },
  c8: { name: "Copper", category: "metals_precious" },
  c9: { name: "Aluminum", category: "metals_precious" },
  c10: { name: "Corn", category: "agricultural" },
  c11: { name: "Soybeans", category: "agricultural" },
  c12: { name: "Sugar", category: "agricultural" },
};

export function getDemoMarketplaceOffers(): PublicMarketplaceOffer[] {
  return DEMO_OFFERS.map((offer) => {
    const commodity = DEMO_COMMODITIES[offer.commodityId] ?? {
      name: "Demo Commodity",
      category: "agricultural",
    };

    return {
      id: offer.id,
      offerType: offer.type as "buy" | "sell",
      commodity: {
        id: offer.commodityId,
        name: commodity.name,
        category: commodity.category,
      },
      quantity: {
        value: String(offer.quantity),
        unit: offer.unit,
      },
      pricing: {
        amountPerUnit: String(offer.price),
        currency: offer.currency,
      },
      location: offer.location,
      terms: {
        minimumQuantity: String(offer.minOrderQty),
        delivery: offer.deliveryTerms,
        payment: "Demo terms",
        validUntil: offer.validUntil,
      },
      status: "active",
      trust: {
        offerVerification: { state: "verified" },
        sellerOrganizationVerification: { state: "verified" },
      },
      visibility: { state: "published" },
      seller: { displayName: offer.seller },
      normalization: {
        targetUnit: null,
        quantity: null,
        amountPerUnit: null,
        converted: false,
        convertible: false,
      },
      createdAt: null,
      updatedAt: null,
    };
  });
}

export function buildDemoContractPreview(
  reservation: Reservation,
  evaluatedAt: Date,
): DemoContractPreview | undefined {
  const offer = DEMO_OFFERS.find((candidate) => candidate.id === reservation.offerId);
  if (
    !offer ||
    reservation.status !== "active" ||
    new Date(reservation.expiresAt).getTime() <= evaluatedAt.getTime()
  ) {
    return undefined;
  }

  const commodity = DEMO_COMMODITIES[offer.commodityId] ?? {
    name: "Demo Commodity",
  };

  return {
    id: `demo-contract-${reservation.id}`,
    reservationId: reservation.id,
    offerId: reservation.offerId,
    status: "draft_preview",
    simulation: true,
    buyerDisplayName: "Demo Trader",
    sellerDisplayName: offer.seller,
    commodityName: commodity.name,
    quantity: reservation.qty,
    unit: offer.unit,
    amountPerUnit: offer.price,
    currency: offer.currency,
    totalAmount: reservation.qty * offer.price,
    deliveryTerms: offer.deliveryTerms,
    paymentTerms: "Demo terms",
    reservationExpiresAt: reservation.expiresAt,
  };
}

export function getDemoMarketplaceSummary(): PublicMarketplaceSummary {
  const offers = getDemoMarketplaceOffers();
  const prices = offers.map((offer) => Number(offer.pricing.amountPerUnit));
  const marketValueUsd = offers.reduce(
    (total, offer) =>
      total +
      Number(offer.quantity.value) * Number(offer.pricing.amountPerUnit),
    0,
  );
  const sorted = [...prices].sort((left, right) => left - right);
  const percentile = (ratio: number) =>
    sorted[Math.floor((sorted.length - 1) * ratio)] ?? null;

  return {
    activeOffers: offers.length,
    publishedOffers: offers.length,
    marketValueUsd,
    avgPrice:
      prices.length > 0
        ? prices.reduce((total, price) => total + price, 0) / prices.length
        : null,
    avgPriceCount: prices.length,
    avgPriceCoverage: { used: prices.length, skipped: 0 },
    median: percentile(0.5),
    p25: percentile(0.25),
    p75: percentile(0.75),
  };
}
