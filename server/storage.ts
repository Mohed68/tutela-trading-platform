import {
  users,
  commodities,
  offers,
  orders,
  contracts,
  verificationDocuments,
  interestedOffers,
  auditLogs,
  temporaryDocumentLinks,
  type User,
  type NewUser,
  type Commodity,
  type NewCommodity,
  type Offer,
  type NewOffer,
  type Order,
  type Contract,
  type NewContract,
  type VerificationDocument,
  type NewVerificationDocument,
  type InterestedOffer,
  type NewInterestedOffer,
  type AuditLog,
  type TemporaryDocumentLink,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, or, like, sql } from "drizzle-orm";

type UpsertUser = Partial<NewUser> & { id: string };

export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  createLocalUser(user: NewUser & { email: string; passwordHash: string }): Promise<User>;
  updateLastLogin(userId: string): Promise<void>;
  updateUserPreferences(userId: string, preferences: {
    language?: string;
    timezone?: string;
    notifications?: any;
    currency?: string;
  }): Promise<User>;
  
  // Commodity operations
  getCommodities(): Promise<Commodity[]>;
  getCommodityById(id: string): Promise<Commodity | undefined>;
  createCommodity(commodity: InsertCommodity): Promise<Commodity>;
  
  // Offer operations
  getOffers(userId?: string): Promise<(Offer & { commodity: Commodity; user: User })[]>;
  getOfferById(id: string): Promise<(Offer & { commodity: Commodity; user: User }) | undefined>;
  createOffer(userId: string, offer: InsertOffer): Promise<Offer>;
  updateOfferStatus(id: string, status: string): Promise<void>;
  searchOffers(query: string, category?: string): Promise<(Offer & { commodity: Commodity; user: User })[]>;
  
  // Order operations
  getOrders(userId?: string): Promise<Order[]>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrderStatus(id: string, status: string): Promise<void>;
  
  // Contract operations
  getContracts(userId?: string): Promise<(Contract & { offer: Offer & { commodity: Commodity }; buyer: User; seller: User })[]>;
  getContractById(id: string): Promise<(Contract & { offer: Offer & { commodity: Commodity }; buyer: User; seller: User }) | undefined>;
  createContract(contract: InsertContract): Promise<Contract>;
  updateContractStatus(id: string, status: string): Promise<void>;
  
  // Verification operations
  getVerificationDocuments(userId: string): Promise<VerificationDocument[]>;
  createVerificationDocument(userId: string, document: InsertVerificationDocument): Promise<VerificationDocument>;
  updateVerificationStatus(id: string, status: string, aiResult?: any, notes?: string): Promise<void>;
  getPendingVerifications(): Promise<(VerificationDocument & { user: User })[]>;
  
  // Partner operations
  getPartnerRelations(userId: string): Promise<(PartnerRelation & { requester: User; partner: User })[]>;
  createPartnerRelation(requesterId: string, partnerId: string, notes?: string): Promise<PartnerRelation>;
  updatePartnerRelationStatus(id: string, status: string): Promise<void>;
  
  // Activity operations
  getRecentActivity(userId: string, limit?: number): Promise<ActivityLog[]>;
  logActivity(userId: string, action: string, entityType?: string, entityId?: string, details?: any): Promise<void>;
  
  // Interested offers operations
  getUserInterestedOffers(userId: string): Promise<(InterestedOffer & { offer: Offer & { commodity: Commodity; user: User } })[]>;
  addInterestedOffer(userId: string, offerId: string): Promise<InterestedOffer>;
  removeInterestedOffer(userId: string, offerId: string): Promise<void>;
  isOfferInterested(userId: string, offerId: string): Promise<boolean>;

  // Offer verification operations
  createOfferVerification(verification: {
    offerId: string;
    userId: string;
    documents: string;
    notes: string;
    status: string;
    submittedAt: Date;
  }): Promise<any>;
  
  // Dashboard metrics
  getDashboardMetrics(userId: string): Promise<{
    activeOffers: number;
    pendingContracts: number;
    verificationQueue: number;
    totalVolume: string;
  }>;
  
  // Performance Insights operations
  getLatestInsightsReport(userId: string): Promise<any>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private commodities: Map<string, Commodity> = new Map();
  private offers: Map<string, Offer> = new Map();
  private orders: Map<string, Order> = new Map();
  private contracts: Map<string, Contract> = new Map();
  private partnerRelations: Map<string, PartnerRelation> = new Map();
  private verificationDocuments: Map<string, VerificationDocument> = new Map();
  private activityLogs: Map<string, ActivityLog> = new Map();
  private interestedOffers: Map<string, InterestedOffer> = new Map();

  constructor() {
    this.seedDemoData();
  }

  private seedDemoData() {
    // Add comprehensive demo commodities
    const demoCommods = [
      // Fuel & Hydrocarbons
      { id: "c1", name: "WTI Crude Oil", type: "fuel_hydrocarbons" as const, description: "West Texas Intermediate", specifications: { unit: "barrel" }, createdAt: new Date() },
      { id: "c4", name: "Brent Crude Oil", type: "fuel_hydrocarbons" as const, description: "North Sea Brent", specifications: { unit: "barrel" }, createdAt: new Date() },
      { id: "c5", name: "Premium Gasoline", type: "fuel_hydrocarbons" as const, description: "High-octane automotive", specifications: { unit: "metric_ton" }, createdAt: new Date() },
      { id: "c6", name: "Ultra-Low Sulfur Diesel", type: "fuel_hydrocarbons" as const, description: "EPA compliant", specifications: { unit: "metric_ton" }, createdAt: new Date() },
      
      // Metals & Precious Metals
      { id: "c2", name: "Gold Bullion", type: "metals_precious" as const, description: "999.9 Fine Gold", specifications: { unit: "troy_ounce" }, createdAt: new Date() },
      { id: "c7", name: "Silver Bullion", type: "metals_precious" as const, description: "Investment grade", specifications: { unit: "troy_ounce" }, createdAt: new Date() },
      { id: "c8", name: "Industrial Platinum", type: "metals_precious" as const, description: "Industrial grade", specifications: { unit: "troy_ounce" }, createdAt: new Date() },
      { id: "c9", name: "Aluminum Ingots", type: "metals_precious" as const, description: "99.7% purity", specifications: { unit: "metric_ton" }, createdAt: new Date() },
      
      // Agricultural Products
      { id: "c3", name: "Hard Red Winter Wheat", type: "agricultural" as const, description: "US No. 2", specifications: { unit: "metric_ton" }, createdAt: new Date() },
      { id: "c10", name: "Premium Soybeans", type: "agricultural" as const, description: "Non-GMO Grade #1", specifications: { unit: "metric_ton" }, createdAt: new Date() },
      { id: "c11", name: "Arabica Coffee Beans", type: "agricultural" as const, description: "Specialty grade", specifications: { unit: "metric_ton" }, createdAt: new Date() },
      { id: "c12", name: "Yellow Corn", type: "agricultural" as const, description: "Feed grade", specifications: { unit: "metric_ton" }, createdAt: new Date() }
    ];
    
    demoCommods.forEach(c => this.commodities.set(c.id, c as Commodity));

    // Add demo users for the offers - covers all user IDs referenced in offers
    const demoUsers = [
      { id: "seller1", email: "seller1@tutela.com", firstName: "Ahmed", lastName: "Al-Rashid", companyName: "Gulf Energy Trading", profileImageUrl: null, createdAt: new Date(), updatedAt: new Date() },
      { id: "seller2", email: "seller2@tutela.com", firstName: "Maria", lastName: "Santos", companyName: "Global Commodities Ltd", profileImageUrl: null, createdAt: new Date(), updatedAt: new Date() },
      { id: "seller3", email: "seller3@tutela.com", firstName: "Chen", lastName: "Wei", companyName: "Asia Pacific Trading", profileImageUrl: null, createdAt: new Date(), updatedAt: new Date() },
      { id: "seller4", email: "seller4@tutela.com", firstName: "James", lastName: "Wilson", companyName: "Precious Metals Exchange", profileImageUrl: null, createdAt: new Date(), updatedAt: new Date() },
      { id: "seller5", email: "seller5@tutela.com", firstName: "Isabella", lastName: "Rodriguez", companyName: "Silver Trade Corp", profileImageUrl: null, createdAt: new Date(), updatedAt: new Date() },
      { id: "seller6", email: "seller6@tutela.com", firstName: "Mohammed", lastName: "Hassan", companyName: "Grain Masters Ltd", profileImageUrl: null, createdAt: new Date(), updatedAt: new Date() },
      { id: "seller7", email: "seller7@tutela.com", firstName: "Emily", lastName: "Chen", companyName: "Crop Solutions Inc", profileImageUrl: null, createdAt: new Date(), updatedAt: new Date() },
      { id: "seller8", email: "seller8@tutela.com", firstName: "Carlos", lastName: "Mendoza", companyName: "Brazilian Coffee Co", profileImageUrl: null, createdAt: new Date(), updatedAt: new Date() },
      { id: "buyer1", email: "buyer1@tutela.com", firstName: "Sarah", lastName: "Johnson", companyName: "International Procurement", profileImageUrl: null, createdAt: new Date(), updatedAt: new Date() },
      { id: "buyer2", email: "buyer2@tutela.com", firstName: "Klaus", lastName: "Mueller", companyName: "European Trading House", profileImageUrl: null, createdAt: new Date(), updatedAt: new Date() },
      { id: "buyer3", email: "buyer3@tutela.com", firstName: "Raj", lastName: "Patel", companyName: "Mumbai Import Co", profileImageUrl: null, createdAt: new Date(), updatedAt: new Date() },
      { id: "buyer4", email: "buyer4@tutela.com", firstName: "Anna", lastName: "Kowalski", companyName: "Central European Metals", profileImageUrl: null, createdAt: new Date(), updatedAt: new Date() },
      { id: "buyer5", email: "buyer5@tutela.com", firstName: "David", lastName: "Lee", companyName: "Asian Investment Fund", profileImageUrl: null, createdAt: new Date(), updatedAt: new Date() },
      { id: "buyer6", email: "buyer6@tutela.com", firstName: "Sophie", lastName: "Martin", companyName: "French Food Processing", profileImageUrl: null, createdAt: new Date(), updatedAt: new Date() },
      { id: "buyer7", email: "buyer7@tutela.com", firstName: "Hans", lastName: "Schmidt", companyName: "German Agriculture GmbH", profileImageUrl: null, createdAt: new Date(), updatedAt: new Date() },
    ];
    
    demoUsers.forEach(u => this.users.set(u.id, u as User));

    // Add comprehensive demo offers with diverse buyers and sellers - All 15 offers
    const demoOffers = [
      // FUEL & HYDROCARBONS (6 offers)
      {
        id: "o1", userId: "seller1", commodityId: "c1", type: "sell", quantity: 50000, 
        pricePerUnit: 78.45, currency: "USD", location: "Houston, TX", unit: "barrel",
        minOrderQty: 1000, deliveryTerms: "FOB Houston", paymentTerms: "Irrevocable LC",
        // Company and delegate info
        sellerOrgId: "org1", sellerOrgName: "Gulf Energy Trading LLC", sellerOrgVerified: true, sellerOrgRating: 4.8,
        delegateId: "seller1", delegateFullName: "Ahmed Al-Rashid", delegateRoleTitle: "Trading Manager", delegateIsAuthorized: true,
        specifications: "Premium WTI crude oil from verified Texas suppliers. API Gravity: 39.6°, Sulfur Content: 0.24%, meets all pipeline specifications. Stored in state-of-the-art facilities with full traceability. FOB Houston with flexible delivery scheduling.",
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: "active", verified: true, createdAt: new Date(), updatedAt: new Date()
      },
      {
        id: "o2", userId: "buyer1", commodityId: "c1", type: "buy", quantity: 25000, 
        pricePerUnit: 77.80, currency: "USD", location: "Singapore", unit: "barrel",
        minOrderQty: 1000, deliveryTerms: "CIF Singapore", paymentTerms: "30-day LC",
        // Company and delegate info
        sellerOrgId: "org2", sellerOrgName: "International Procurement Corp", sellerOrgVerified: true, sellerOrgRating: 4.6,
        delegateId: "buyer1", delegateFullName: "Sarah Johnson", delegateRoleTitle: "Chief Procurement Officer", delegateIsAuthorized: true,
        specifications: "Seeking reliable WTI crude oil supply for long-term partnership. Required specs: API Gravity: 38-42°, Sulfur Content: <0.3%, with all necessary certifications. Preferred delivery to Singapore with competitive pricing and flexible payment terms.",
        validUntil: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
        status: "active", verified: true, createdAt: new Date(), updatedAt: new Date()
      },
      {
        id: "o3", userId: "seller2", commodityId: "c4", type: "sell", quantity: 15000, 
        pricePerUnit: 82.20, currency: "USD", location: "Fujairah, UAE", unit: "barrel",
        minOrderQty: 1000, deliveryTerms: "FOB Fujairah", paymentTerms: "Revolving LC",
        // Company and delegate info
        sellerOrgId: "org3", sellerOrgName: "Global Commodities Ltd", sellerOrgVerified: true, sellerOrgRating: 4.9,
        delegateId: "seller2", delegateFullName: "Maria Santos", delegateRoleTitle: "Senior Trader", delegateIsAuthorized: true,
        specifications: "High-quality North Sea Brent crude oil for immediate delivery. API Gravity: 38.3°, Sulfur Content: 0.37%, complies with international standards. Available from strategic reserves in Fujairah with full documentation and quality certificates.",
        validUntil: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        status: "active", verified: true, createdAt: new Date(), updatedAt: new Date()
      },
      {
        id: "o4", userId: "buyer2", commodityId: "c5", type: "buy", quantity: "8000", 
        pricePerUnit: "920", currency: "USD", location: "Rotterdam", unit: "metric_ton",
        minQuantity: "100", deliveryTerms: "CIF Rotterdam", paymentTerms: "Documentary LC",
        description: "Premium Gasoline",
        specifications: "Premium gasoline for European market distribution. Octane Rating: 95 RON, Benzene: <1%, Lead Content: <0.005g/L, meets Euro 6 standards. Seeking reliable supplier for Rotterdam terminal with competitive pricing and quality assurance.",
        validUntil: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
        status: "active", verified: true, createdAt: new Date(), updatedAt: new Date()
      },
      {
        id: "o5", userId: "seller3", commodityId: "c6", type: "sell", quantity: "12000", 
        pricePerUnit: "875", currency: "USD", location: "Texas, USA", unit: "metric_ton",
        minQuantity: "100", deliveryTerms: "FOB Houston", paymentTerms: "Sight LC",
        description: "Ultra-Low Sulfur Diesel",
        specifications: "Ultra-low sulfur diesel meeting EPA Tier 3 standards. Sulfur Content: <10 ppm, Cetane Number: >51, Cloud Point: -10°C, excellent cold weather performance. Produced in Texas refineries with full supply chain certification and environmental compliance.",
        validUntil: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000),
        status: "active", verified: true, createdAt: new Date(), updatedAt: new Date()
      },
      {
        id: "o6", userId: "buyer3", commodityId: "c4", type: "buy", quantity: "20000", 
        pricePerUnit: "81.50", currency: "USD", location: "Mumbai, India", unit: "barrel",
        minQuantity: "1000", deliveryTerms: "CIF Mumbai", paymentTerms: "Confirmed LC",
        description: "Brent Crude Oil",
        specifications: "Seeking premium Brent crude oil for Mumbai refinery operations. Required: Brent Grade, API 38+, full cargo inspection available. Long-term contract preferred with reliable shipping schedule to Mumbai port. Looking for trusted Middle East suppliers.",
        validUntil: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
        status: "active", verified: true, createdAt: new Date(), updatedAt: new Date()
      },
      // METALS & PRECIOUS METALS (6 offers)
      {
        id: "o7", userId: "seller4", commodityId: "c2", type: "sell", quantity: "500", 
        pricePerUnit: "2410", currency: "USD", location: "London, UK", unit: "troy_ounce",
        minQuantity: "10", deliveryTerms: "EXW London Vault", paymentTerms: "Wire Transfer",
        description: "Gold Bullion",
        specifications: "Investment grade gold bullion from London vaults. Purity: 99.99%, LBMA certified, serial numbered bars with full provenance documentation. Stored in secure London vault with insurance coverage. Perfect for institutional portfolios and wealth preservation.",
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: "active", verified: true, createdAt: new Date(), updatedAt: new Date()
      },
      {
        id: "o8", userId: "buyer4", commodityId: "c2", type: "buy", quantity: "250", 
        pricePerUnit: "2395", currency: "USD", location: "Dubai, UAE", unit: "troy_ounce",
        minQuantity: "10", deliveryTerms: "CIF Dubai", paymentTerms: "Bank guarantee",
        description: "Gold Bullion",
        specifications: "Seeking investment grade gold for Dubai trading operations. Minimum purity: 99.5%, DMCC approved suppliers preferred. Require full assay certificates and secure transport to Dubai Free Zone. Looking for competitive spot pricing with volume discounts.",
        validUntil: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
        status: "active", verified: true, createdAt: new Date(), updatedAt: new Date()
      },
      {
        id: "o9", userId: "seller5", commodityId: "c7", type: "sell", quantity: 10000, 
        pricePerUnit: 28.50, currency: "USD", location: "Perth, Australia", unit: "troy_ounce",
        minOrderQty: 10, deliveryTerms: "FOB Perth", paymentTerms: "Documentary credit",
        // Company and delegate info
        sellerOrgId: "org9", sellerOrgName: "Silver Trade Corp", sellerOrgVerified: true, sellerOrgRating: 4.7,
        delegateId: "seller5", delegateFullName: "Isabella Rodriguez", delegateRoleTitle: "Precious Metals Specialist", delegateIsAuthorized: true,
        specifications: "Premium silver coins from Perth Mint. Purity: 99.9%, 1 oz Australian Kangaroo coins in protective packaging. Each coin individually certified with authenticity guarantee. Ideal for collectors and investors seeking government-backed precious metals.",
        validUntil: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000),
        status: "active", verified: true, createdAt: new Date(), updatedAt: new Date()
      },
      {
        id: "o10", userId: "buyer5", commodityId: "c8", type: "buy", quantity: "50", 
        pricePerUnit: "1180", currency: "USD", location: "New York, USA", unit: "troy_ounce",
        minQuantity: "10", deliveryTerms: "DDP New York", paymentTerms: "30-day terms",
        description: "Platinum",
        specifications: "Seeking industrial platinum for automotive catalytic converter manufacturing. Required purity: 99.95%, Johnson Matthey or equivalent refiner preferred. Need full certificates of analysis and chain of custody documentation. Regular monthly deliveries to New York facility.",
        validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        status: "active", verified: true, createdAt: new Date(), updatedAt: new Date()
      },
      {
        id: "o11", userId: "seller6", commodityId: "c9", type: "sell", quantity: "2000", 
        pricePerUnit: "2850", currency: "USD", location: "Hamburg, Germany", unit: "metric_ton",
        minQuantity: "50", deliveryTerms: "FOB Hamburg", paymentTerms: "Sight draft",
        description: "Aluminum Ingots",
        specifications: "High-grade aluminum ingots for aerospace industry applications. 99.7% purity, primary grade with low impurity content. Produced in Hamburg facility following EN AW-1050A standards. Each ingot individually tested and certified for quality assurance.",
        validUntil: new Date(Date.now() + 50 * 24 * 60 * 60 * 1000),
        status: "active", verified: true, createdAt: new Date(), updatedAt: new Date()
      },
      {
        id: "o12", userId: "buyer6", commodityId: "c7", type: "buy", quantity: "5000", 
        pricePerUnit: "29.20", currency: "USD", location: "Toronto, Canada", unit: "troy_ounce",
        minQuantity: "10", deliveryTerms: "CIF Toronto", paymentTerms: "LC at sight",
        description: "Silver Bullion",
        specifications: "Seeking investment grade silver for Canadian portfolio diversification. Minimum 99.9% purity, prefer 1000 oz COMEX bars or Royal Canadian Mint products. Require secure vault storage in Toronto with full insurance coverage and audit trail.",
        validUntil: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        status: "active", verified: true, createdAt: new Date(), updatedAt: new Date()
      },
      // AGRICULTURAL PRODUCTS (3 offers)
      {
        id: "o13", userId: "seller7", commodityId: "c3", type: "sell", quantity: 5000, 
        pricePerUnit: 285, currency: "USD", location: "Kansas, USA", unit: "metric_ton",
        minOrderQty: 500, deliveryTerms: "FOB Kansas City", paymentTerms: "Cash against docs",
        // Company and delegate info
        sellerOrgId: "org13", sellerOrgName: "Crop Solutions Inc", sellerOrgVerified: true, sellerOrgRating: 4.5,
        delegateId: "seller7", delegateFullName: "Emily Chen", delegateRoleTitle: "Agricultural Trader", delegateIsAuthorized: true,
        specifications: "Premium Hard Red Winter Wheat from Kansas farms. US No. 2 grade, 13% minimum protein content, test weight >60 lbs/bushel. Stored in climate-controlled silos with full traceability. Perfect for bread flour production and export markets.",
        validUntil: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
        status: "active", verified: true, createdAt: new Date(), updatedAt: new Date()
      },
      {
        id: "o14", userId: "buyer7", commodityId: "c10", type: "buy", quantity: "25000", 
        pricePerUnit: "445", currency: "USD", location: "Rotterdam", unit: "metric_ton",
        minQuantity: "500", deliveryTerms: "CIF Rotterdam", paymentTerms: "Irrevocable LC",
        description: "Non-GMO Soybeans",
        specifications: "Seeking premium Non-GMO soybeans for European food processing. Grade #1 quality, moisture <14%, protein >35%, free from genetic modification. Need IP (Identity Preserved) certification and full supply chain documentation for Rotterdam processing facility.",
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: "active", verified: true, createdAt: new Date(), updatedAt: new Date()
      },
      {
        id: "o15", userId: "seller8", commodityId: "c11", type: "sell", quantity: "100", 
        pricePerUnit: "8450", currency: "USD", location: "São Paulo, Brazil", unit: "metric_ton",
        minQuantity: "5", deliveryTerms: "FOB Santos", paymentTerms: "Prepayment",
        description: "Brazilian Arabica Coffee",
        specifications: "Exceptional Brazilian Arabica coffee beans from São Paulo highlands. Specialty grade with cupping score >80, notes of chocolate and caramel. Grown at 1200m elevation using sustainable farming practices. Perfect for premium coffee roasters and specialty cafes worldwide.",
        validUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        status: "active", verified: true, createdAt: new Date(), updatedAt: new Date()
      }
    ];

    // Add all offers to storage
    demoOffers.forEach(o => this.offers.set(o.id, o as Offer));

    // Add demo orders
    const demoOrders = [
      {
        id: "ord1", userId: "39290014", offerId: "o1", type: "buy",
        quantity: "5000", agreedPrice: "78.45", currency: "USD", totalValue: "392250",
        status: "confirmed", paymentStatus: "escrowed",
        deliveryAddress: "Port of Rotterdam, Netherlands",
        deliveryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        smartContractAddress: "0x1234567890abcdef",
        notes: "Urgent delivery required for refinery operations",
        createdAt: new Date(), updatedAt: new Date()
      },
      {
        id: "ord2", userId: "39290014", offerId: "o6", type: "buy",
        quantity: "100", agreedPrice: "2410", currency: "USD", totalValue: "241000",
        status: "in_transit", paymentStatus: "escrowed",
        deliveryAddress: "Zurich Precious Metals Vault",
        deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        smartContractAddress: "0xabcdef1234567890",
        notes: "High-security transport required",
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), updatedAt: new Date()
      }
    ];
    
    demoOrders.forEach(order => this.orders.set(order.id, order as any));
  }

  // User operations (mandatory for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const normalized = email.trim().toLowerCase();
    return Array.from(this.users.values()).find((user) => user.email?.toLowerCase() === normalized);
  }

  async createLocalUser(userData: NewUser & { email: string; passwordHash: string }): Promise<User> {
    return this.upsertUser({ ...userData, id: crypto.randomUUID() });
  }

  async updateLastLogin(userId: string): Promise<void> {
    const user = this.users.get(userId);
    if (user) this.users.set(userId, { ...user, lastLoginAt: new Date(), updatedAt: new Date() });
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const user: User = {
      id: userData.id || Date.now().toString(),
      email: userData.email,
      firstName: userData.firstName,
      lastName: userData.lastName,
      profileImageUrl: userData.profileImageUrl,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(user.id, user);
    return user;
  }

  // Commodity operations
  async getCommodities(): Promise<Commodity[]> {
    return Array.from(this.commodities.values());
  }

  async createCommodity(commodity: InsertCommodity): Promise<Commodity> {
    const newCommodity: Commodity = {
      id: Date.now().toString(),
      ...commodity,
      createdAt: new Date(),
    };
    this.commodities.set(newCommodity.id, newCommodity);
    return newCommodity;
  }

  // Offer operations
  async getOffers(userId?: string): Promise<(Offer & { commodity: Commodity; user: User })[]> {
    const allOffers = Array.from(this.offers.values());
    const filteredOffers = userId ? allOffers.filter(offer => offer.userId === userId) : allOffers;
    
    return filteredOffers.map(offer => {
      const commodity = this.commodities.get(offer.commodityId);
      const user = this.users.get(offer.userId);
      return {
        ...offer,
        commodity: commodity!,
        user: user!
      };
    }).filter(offer => offer.commodity && offer.user); // Only return offers with valid commodity and user data
  }

  async searchOffers(query?: string, category?: string): Promise<(Offer & { commodity: Commodity; user: User })[]> {
    let results = Array.from(this.offers.values());
    
    if (category) {
      results = results.filter(offer => {
        const commodity = this.commodities.get(offer.commodityId);
        return commodity?.type === category;
      });
    }
    
    if (query) {
      const searchLower = query.toLowerCase();
      results = results.filter(offer => {
        const commodity = this.commodities.get(offer.commodityId);
        return (
          commodity?.name.toLowerCase().includes(searchLower) ||
          commodity?.description?.toLowerCase().includes(searchLower) ||
          offer.location.toLowerCase().includes(searchLower)
        );
      });
    }
    
    return results.map(offer => {
      const commodity = this.commodities.get(offer.commodityId);
      const user = this.users.get(offer.userId);
      return {
        ...offer,
        commodity: commodity!,
        user: user!
      };
    }).filter(offer => offer.commodity && offer.user);
  }

  async getOfferById(id: string): Promise<Offer | undefined> {
    return this.offers.get(id);
  }

  async createOffer(userId: string, offer: InsertOffer): Promise<Offer> {
    const newOffer: Offer = {
      id: Date.now().toString(),
      ...offer,
      userId: userId,
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.offers.set(newOffer.id, newOffer);
    return newOffer;
  }

  async updateOfferStatus(id: string, status: string): Promise<void> {
    const offer = this.offers.get(id);
    if (offer) {
      offer.status = status;
      offer.updatedAt = new Date();
      this.offers.set(id, offer);
    }
  }

  // Order operations
  async getOrders(userId?: string): Promise<Order[]> {
    return Array.from(this.orders.values());
  }

  async createOrder(order: InsertOrder): Promise<Order> {
    const newOrder: Order = {
      id: Date.now().toString(),
      ...order,
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.orders.set(newOrder.id, newOrder);
    return newOrder;
  }

  async updateOrderStatus(id: string, status: string): Promise<void> {
    const order = this.orders.get(id);
    if (order) {
      order.status = status;
      order.updatedAt = new Date();
      this.orders.set(id, order);
    }
  }

  // Contract operations
  async getContracts(userId?: string): Promise<Contract[]> {
    return Array.from(this.contracts.values());
  }

  async createContract(contract: InsertContract): Promise<Contract> {
    const newContract: Contract = {
      id: Date.now().toString(),
      ...contract,
      status: "draft",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.contracts.set(newContract.id, newContract);
    return newContract;
  }

  async updateContractStatus(id: string, status: string): Promise<void> {
    const contract = this.contracts.get(id);
    if (contract) {
      contract.status = status;
      contract.updatedAt = new Date();
      this.contracts.set(id, contract);
    }
  }

  // Verification operations
  async getVerificationDocuments(userId: string): Promise<VerificationDocument[]> {
    return Array.from(this.verificationDocuments.values())
      .filter(doc => doc.userId === userId);
  }

  async createVerificationDocument(userId: string, document: InsertVerificationDocument): Promise<VerificationDocument> {
    const newDocument: VerificationDocument = {
      id: Date.now().toString(),
      ...document,
      userId: userId,
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.verificationDocuments.set(newDocument.id, newDocument);
    return newDocument;
  }

  async updateVerificationStatus(id: string, status: string, aiResult?: any, notes?: string): Promise<void> {
    const doc = this.verificationDocuments.get(id);
    if (doc) {
      doc.status = status;
      if (aiResult) doc.aiResult = aiResult;
      if (notes) doc.notes = notes;
      doc.updatedAt = new Date();
      this.verificationDocuments.set(id, doc);
    }
  }

  async getPendingVerifications(): Promise<(VerificationDocument & { user: User })[]> {
    return Array.from(this.verificationDocuments.values())
      .filter(doc => doc.status === "pending")
      .map(doc => ({
        ...doc,
        user: this.users.get(doc.userId)!
      }));
  }

  // Partner operations
  async getPartnerRelations(userId: string): Promise<(PartnerRelation & { requester: User; partner: User })[]> {
    return Array.from(this.partnerRelations.values())
      .filter(relation => relation.requesterId === userId || relation.partnerId === userId)
      .map(relation => ({
        ...relation,
        requester: this.users.get(relation.requesterId)!,
        partner: this.users.get(relation.partnerId)!
      }));
  }

  async createPartnerRelation(requesterId: string, partnerId: string, notes?: string): Promise<PartnerRelation> {
    const newRelation: PartnerRelation = {
      id: Date.now().toString(),
      requesterId,
      partnerId,
      status: "pending",
      notes,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.partnerRelations.set(newRelation.id, newRelation);
    return newRelation;
  }

  async updatePartnerRelationStatus(id: string, status: string): Promise<void> {
    const relation = this.partnerRelations.get(id);
    if (relation) {
      relation.status = status;
      relation.updatedAt = new Date();
      this.partnerRelations.set(id, relation);
    }
  }

  // Interested offers operations
  async getUserInterestedOffers(userId: string): Promise<(InterestedOffer & { offer: Offer })[]> {
    return Array.from(this.interestedOffers.values())
      .filter(io => io.userId === userId)
      .map(io => ({
        ...io,
        offer: this.offers.get(io.offerId)!
      }));
  }

  async addInterestedOffer(userId: string, offerId: string): Promise<InterestedOffer> {
    const newInterestedOffer: InterestedOffer = {
      id: Date.now().toString(),
      userId,
      offerId,
      createdAt: new Date(),
    };
    this.interestedOffers.set(newInterestedOffer.id, newInterestedOffer);
    return newInterestedOffer;
  }

  async removeInterestedOffer(userId: string, offerId: string): Promise<void> {
    const toRemove = Array.from(this.interestedOffers.entries())
      .find(([_, io]) => io.userId === userId && io.offerId === offerId);
    if (toRemove) {
      this.interestedOffers.delete(toRemove[0]);
    }
  }

  async isOfferInterested(userId: string, offerId: string): Promise<boolean> {
    return Array.from(this.interestedOffers.values())
      .some(io => io.userId === userId && io.offerId === offerId);
  }

  // Activity logging
  async logActivity(userId: string, action: string, entityType: string, entityId: string): Promise<void> {
    const activity: ActivityLog = {
      id: Date.now().toString(),
      userId,
      action,
      entityType,
      entityId,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.activityLogs.set(activity.id, activity);
  }

  async getRecentActivity(userId: string, limit: number = 10): Promise<ActivityLog[]> {
    return Array.from(this.activityLogs.values())
      .filter(activity => activity.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  // Dashboard metrics
  async getDashboardMetrics(userId: string): Promise<{
    activeOffers: number;
    pendingContracts: number;
    verificationQueue: number;
    totalVolume: string;
  }> {
    return {
      activeOffers: 47,
      pendingContracts: 8,
      verificationQueue: Array.from(this.verificationDocuments.values()).filter(v => v.status === "pending").length,
      totalVolume: "24580000",
    };
  }

  // Utility methods
  async getCommodityById(id: string): Promise<Commodity | undefined> {
    return this.commodities.get(id);
  }

  async getContractById(id: string): Promise<(Contract & { offer: Offer & { commodity: Commodity }; buyer: User; seller: User }) | undefined> {
    const contract = this.contracts.get(id);
    if (!contract) return undefined;

    const offer = this.offers.get(contract.offerId);
    if (!offer) return undefined;

    const commodity = this.commodities.get(offer.commodityId);
    if (!commodity) return undefined;

    const buyer = this.users.get(contract.buyerId);
    const seller = this.users.get(contract.sellerId);
    if (!buyer || !seller) return undefined;

    return {
      ...contract,
      offer: { ...offer, commodity },
      buyer,
      seller
    };
  }

  async updateUserPreferences(userId: string, preferences: {
    language?: string;
    timezone?: string;
    notifications?: any;
    currency?: string;
  }): Promise<User> {
    const user = this.users.get(userId);
    if (!user) throw new Error("User not found");
    
    const updatedUser = { ...user, ...preferences, updatedAt: new Date() };
    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  // Dashboard metrics
  async getDashboardMetrics(userId: string): Promise<{
    activeOffers: number;
    pendingContracts: number;
    verificationQueue: number;
    totalVolume: string;
  }> {
    const activeOffers = Array.from(this.offers.values())
      .filter(offer => offer.userId === userId && offer.status === "active").length;
    
    const pendingContracts = Array.from(this.contracts.values())
      .filter(contract => 
        (contract.buyerId === userId || contract.sellerId === userId) && 
        contract.status === "pending_approval"
      ).length;

    const verificationQueue = Array.from(this.verificationDocuments.values())
      .filter(doc => doc.userId === userId && doc.status === "pending").length;

    const totalVolume = Array.from(this.contracts.values())
      .filter(contract => 
        (contract.buyerId === userId || contract.sellerId === userId) && 
        contract.status === "active"
      )
      .reduce((sum, contract) => {
        const offer = this.offers.get(contract.offerId);
        if (offer) {
          return sum + (parseFloat(offer.pricePerUnit || '0') * parseFloat(offer.quantity || '0'));
        }
        return sum;
      }, 0);

    return {
      activeOffers,
      pendingContracts,
      verificationQueue,
      totalVolume: totalVolume.toString(),
    };
  }

  // Offer verification operations
  async createOfferVerification(verification: {
    offerId: string;
    userId: string;
    documents: string;
    notes: string;
    status: string;
    submittedAt: Date;
  }): Promise<any> {
    const newVerification = {
      id: Date.now().toString(),
      ...verification,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    // Store in a verification map (you can add this if needed)
    return newVerification;
  }

  // Performance Insights operations
  async getLatestInsightsReport(userId: string): Promise<any> {
    return {
      id: Date.now().toString(),
      userId,
      reportData: {
        totalTrades: 15,
        successRate: 92.5,
        avgDealValue: 2.8,
        marketTrends: "Stable",
      },
      generatedAt: new Date(),
    };
  }

  // Recent activity
  async getRecentActivity(userId: string, limit: number = 10): Promise<ActivityLog[]> {
    return Array.from(this.activityLogs.values())
      .filter(log => log.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }
}

// export const storage = new MemStorage(); // Using DatabaseStorage instead

export class DatabaseStorage implements IStorage {
  // Order operations
  async getOrders(userId?: string): Promise<Order[]> {
    if (userId) {
      return await db.select().from(orders).where(eq(orders.userId, userId));
    }
    return await db.select().from(orders);
  }

  async createOrder(order: InsertOrder): Promise<Order> {
    const [newOrder] = await db.insert(orders).values(order).returning();
    return newOrder;
  }

  async updateOrderStatus(id: string, status: string): Promise<void> {
    await db.update(orders).set({ status: status as any, updatedAt: new Date() }).where(eq(orders.id, id));
  }
  // User operations (mandatory for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email.trim().toLowerCase()));
    return user;
  }

  async createLocalUser(userData: NewUser & { email: string; passwordHash: string }): Promise<User> {
    const [user] = await db.insert(users).values({
      ...userData,
      email: userData.email.trim().toLowerCase(),
      authProvider: "local",
    }).returning();
    return user;
  }

  async updateLastLogin(userId: string): Promise<void> {
    await db.update(users).set({ lastLoginAt: new Date(), updatedAt: new Date() }).where(eq(users.id, userId));
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUserPreferences(userId: string, preferences: {
    language?: string;
    timezone?: string;
    notifications?: any;
    currency?: string;
  }): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        ...preferences,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  // Commodity operations
  async getCommodities(): Promise<Commodity[]> {
    return await db.select().from(commodities).orderBy(commodities.name);
  }

  async getCommodityById(id: string): Promise<Commodity | undefined> {
    const [commodity] = await db.select().from(commodities).where(eq(commodities.id, id));
    return commodity;
  }

  async createCommodity(commodity: InsertCommodity): Promise<Commodity> {
    const [created] = await db.insert(commodities).values(commodity).returning();
    return created;
  }

  // Offer operations
  async getOffers(userId?: string): Promise<(Offer & { commodity: Commodity; user: User })[]> {
    const baseQuery = db
      .select()
      .from(offers)
      .leftJoin(commodities, eq(offers.commodityId, commodities.id))
      .leftJoin(users, eq(offers.userId, users.id))
      .orderBy(desc(offers.createdAt));

    const results = userId 
      ? await baseQuery.where(eq(offers.userId, userId))
      : await baseQuery;
    
    return results.map(row => ({
      ...row.offers,
      commodity: row.commodities!,
      user: row.users!,
    }));
  }

  async getOfferById(id: string): Promise<(Offer & { commodity: Commodity; user: User }) | undefined> {
    const [result] = await db
      .select()
      .from(offers)
      .leftJoin(commodities, eq(offers.commodityId, commodities.id))
      .leftJoin(users, eq(offers.userId, users.id))
      .where(eq(offers.id, id));
    
    if (!result) return undefined;
    
    return {
      ...result.offers,
      commodity: result.commodities!,
      user: result.users!,
    };
  }

  async createOffer(userId: string, offer: InsertOffer): Promise<Offer> {
    const [created] = await db.insert(offers).values({ ...offer, userId }).returning();
    
    await this.logActivity(userId, "create_offer", "offer", created.id);
    
    return created;
  }

  async updateOfferStatus(id: string, status: any): Promise<void> {
    await db.update(offers).set({ status, updatedAt: new Date() }).where(eq(offers.id, id));
  }

  async searchOffers(query: string, category?: string): Promise<(Offer & { commodity: Commodity; user: User })[]> {
    let whereConditions = [like(commodities.name, `%${query}%`)];
    
    if (category && category !== "all") {
      whereConditions.push(eq(commodities.type, category as any));
    }
    
    const whereCondition = whereConditions.length > 1 ? and(...whereConditions) : whereConditions[0];

    const results = await db
      .select()
      .from(offers)
      .leftJoin(commodities, eq(offers.commodityId, commodities.id))
      .leftJoin(users, eq(offers.userId, users.id))
      .where(whereCondition)
      .orderBy(desc(offers.createdAt));
      
    return results.map(row => ({
      ...row.offers,
      commodity: row.commodities!,
      user: row.users!,
    }));
  }

  // Contract operations
  async getContracts(userId?: string): Promise<(Contract & { offer: Offer & { commodity: Commodity }; buyer: User; seller: User })[]> {
    // For simplicity, let's fetch contracts and then enrich them with related data
    const baseQuery = db.select().from(contracts).orderBy(desc(contracts.createdAt));
    
    const contractResults = userId
      ? await baseQuery.where(or(eq(contracts.buyerId, userId), eq(contracts.sellerId, userId)))
      : await baseQuery;
    
    // Enrich with related data
    const enrichedContracts = await Promise.all(
      contractResults.map(async (contract) => {
        const [offerResult] = await db.select().from(offers)
          .leftJoin(commodities, eq(offers.commodityId, commodities.id))
          .where(eq(offers.id, contract.offerId));
          
        const [buyer] = await db.select().from(users).where(eq(users.id, contract.buyerId));
        const [seller] = await db.select().from(users).where(eq(users.id, contract.sellerId));
        
        return {
          ...contract,
          offer: {
            ...offerResult?.offers!,
            commodity: offerResult?.commodities!,
          },
          buyer: buyer!,
          seller: seller!,
        };
      })
    );
    
    return enrichedContracts;
  }

  async getContractById(id: string): Promise<(Contract & { offer: Offer & { commodity: Commodity }; buyer: User; seller: User }) | undefined> {
    const [contract] = await db.select().from(contracts).where(eq(contracts.id, id));
    
    if (!contract) return undefined;
    
    const [offerResult] = await db.select().from(offers)
      .leftJoin(commodities, eq(offers.commodityId, commodities.id))
      .where(eq(offers.id, contract.offerId));
      
    const [buyer] = await db.select().from(users).where(eq(users.id, contract.buyerId));
    const [seller] = await db.select().from(users).where(eq(users.id, contract.sellerId));
    
    return {
      ...contract,
      offer: {
        ...offerResult?.offers!,
        commodity: offerResult?.commodities!,
      },
      buyer: buyer!,
      seller: seller!,
    };
  }

  async createContract(contract: InsertContract): Promise<Contract> {
    const [created] = await db.insert(contracts).values(contract).returning();
    
    await this.logActivity(contract.buyerId, "create_contract", "contract", created.id);
    
    return created;
  }

  async updateContractStatus(id: string, status: any): Promise<void> {
    await db.update(contracts).set({ status, updatedAt: new Date() }).where(eq(contracts.id, id));
  }

  // Verification operations
  async getVerificationDocuments(userId: string): Promise<VerificationDocument[]> {
    return await db
      .select()
      .from(verificationDocuments)
      .where(eq(verificationDocuments.userId, userId))
      .orderBy(desc(verificationDocuments.uploadedAt));
  }

  async createVerificationDocument(userId: string, document: InsertVerificationDocument): Promise<VerificationDocument> {
    const [created] = await db
      .insert(verificationDocuments)
      .values({ ...document, userId })
      .returning();
    
    await this.logActivity(userId, "upload_document", "verification_document", created.id);
    
    return created;
  }

  async updateVerificationStatus(id: string, status: string, aiResult?: any, notes?: string): Promise<void> {
    const updateData: any = { status, reviewedAt: new Date() };
    
    if (aiResult) updateData.aiValidationResult = aiResult;
    if (notes) updateData.reviewNotes = notes;
    
    await db.update(verificationDocuments).set(updateData).where(eq(verificationDocuments.id, id));
  }

  async getPendingVerifications(): Promise<(VerificationDocument & { user: User })[]> {
    const results = await db
      .select()
      .from(verificationDocuments)
      .leftJoin(users, eq(verificationDocuments.userId, users.id))
      .where(eq(verificationDocuments.verificationStatus, "pending"))
      .orderBy(verificationDocuments.uploadedAt);
      
    return results.map(row => ({
      ...row.verification_documents,
      user: row.users!,
    }));
  }

  // Partner operations
  async getPartnerRelations(userId: string): Promise<(PartnerRelation & { requester: User; partner: User })[]> {
    const relations = await db
      .select()
      .from(partnerRelations)
      .where(or(eq(partnerRelations.requesterId, userId), eq(partnerRelations.partnerId, userId)))
      .orderBy(desc(partnerRelations.createdAt));
      
    const enrichedRelations = await Promise.all(
      relations.map(async (relation) => {
        const [requester] = await db.select().from(users).where(eq(users.id, relation.requesterId));
        const [partner] = await db.select().from(users).where(eq(users.id, relation.partnerId));
        
        return {
          ...relation,
          requester: requester!,
          partner: partner!,
        };
      })
    );
    
    return enrichedRelations;
  }

  async createPartnerRelation(requesterId: string, partnerId: string, notes?: string): Promise<PartnerRelation> {
    const [created] = await db
      .insert(partnerRelations)
      .values({ requesterId, partnerId, notes })
      .returning();
    
    await this.logActivity(requesterId, "request_partnership", "partner_relation", created.id);
    
    return created;
  }

  async updatePartnerRelationStatus(id: string, status: string): Promise<void> {
    await db.update(partnerRelations).set({ status, updatedAt: new Date() }).where(eq(partnerRelations.id, id));
  }

  // Activity operations
  async getRecentActivity(userId: string, limit = 10): Promise<ActivityLog[]> {
    return await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.userId, userId))
      .orderBy(desc(auditLogs.timestamp))
      .limit(limit);
  }

  async logActivity(userId: string, action: string, entityType?: string, entityId?: string, details?: any): Promise<void> {
    await db.insert(auditLogs).values({
      userId,
      action,
      entityType: entityType || 'activity',
      entityId: entityId || userId,
      afterValue: details,
    });
  }

  // Interested offers operations
  async getUserInterestedOffers(userId: string): Promise<(InterestedOffer & { offer: Offer & { commodity: Commodity; user: User } })[]> {
    const results = await db
      .select()
      .from(interestedOffers)
      .leftJoin(offers, eq(interestedOffers.offerId, offers.id))
      .leftJoin(commodities, eq(offers.commodityId, commodities.id))
      .leftJoin(users, eq(offers.userId, users.id))
      .where(eq(interestedOffers.userId, userId))
      .orderBy(desc(interestedOffers.createdAt));
    
    return results.map(row => ({
      ...row.interested_offers,
      offer: {
        ...row.offers!,
        commodity: row.commodities!,
        user: row.users!,
      }
    }));
  }

  async addInterestedOffer(userId: string, offerId: string): Promise<InterestedOffer> {
    const [created] = await db
      .insert(interestedOffers)
      .values({ userId, offerId })
      .returning();
    return created;
  }

  async removeInterestedOffer(userId: string, offerId: string): Promise<void> {
    await db
      .delete(interestedOffers)
      .where(and(
        eq(interestedOffers.userId, userId),
        eq(interestedOffers.offerId, offerId)
      ));
  }

  async isOfferInterested(userId: string, offerId: string): Promise<boolean> {
    const [result] = await db
      .select()
      .from(interestedOffers)
      .where(and(
        eq(interestedOffers.userId, userId),
        eq(interestedOffers.offerId, offerId)
      ));
    return !!result;
  }

  // Dashboard metrics
  async getDashboardMetrics(userId: string): Promise<{
    activeOffers: number;
    pendingContracts: number;
    verificationQueue: number;
    totalVolume: string;
  }> {
    // Query 1: Active offers count
    const [activeOffersResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(offers)
      .where(and(eq(offers.userId, userId), eq(offers.status, "active")));

    // Query 2: Pending contracts count
    const [pendingContractsResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(contracts)
      .where(and(
        or(eq(contracts.buyerId, userId), eq(contracts.sellerId, userId)),
        eq(contracts.status, "draft")
      ));

    // Query 3: Verification queue count
    const [verificationQueueResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(verificationDocuments)
      .where(and(eq(verificationDocuments.userId, userId), eq(verificationDocuments.verificationStatus, "pending")));

    // Query 4: Total volume calculation
    const [totalVolumeResult] = await db
      .select({ 
        total: sql<string>`coalesce(sum((${contracts.quantity})::numeric * (${contracts.pricePerUnit})::numeric), 0)::text` 
      })
      .from(contracts)
      .where(and(
        or(eq(contracts.buyerId, userId), eq(contracts.sellerId, userId)),
        eq(contracts.status, "active")
      ));

    return {
      activeOffers: activeOffersResult?.count || 0,
      pendingContracts: pendingContractsResult?.count || 0,
      verificationQueue: verificationQueueResult?.count || 0,
      totalVolume: totalVolumeResult?.total || "0",
    };
  }

  // Admin methods
  async getAllUsers(filters?: { adminRole?: string; kybStatus?: string; }): Promise<User[]> {
    let query = db.select().from(users);
    const conditions = [];
    
    if (filters?.adminRole) {
      conditions.push(eq(users.adminRole, filters.adminRole));
    }
    if (filters?.kybStatus) {
      conditions.push(eq(users.kybStatus, filters.kybStatus));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    return query.orderBy(desc(users.createdAt));
  }

  async updateUserAdminRole(userId: string, adminRole: string | null): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({ adminRole })
      .where(eq(users.id, userId))
      .returning();
    return updatedUser;
  }

  async toggleUserStatus(userId: string, enabled: boolean): Promise<User> {
    // For now, we'll use a mock field since we don't have an enabled field
    // In a real implementation, you'd add an 'enabled' or 'active' column
    const [updatedUser] = await db
      .update(users)
      .set({ updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return updatedUser;
  }

  async resetUser2FA(userId: string): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({ is2FAEnabled: false })
      .where(eq(users.id, userId))
      .returning();
    return updatedUser;
  }

  async updateKYBStatus(userId: string, kybStatus: string, verificationLevel?: string): Promise<User> {
    const updateData: any = { kybStatus, updatedAt: new Date() };
    if (verificationLevel) {
      updateData.verificationLevel = verificationLevel;
    }
    
    const [updatedUser] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning();
    return updatedUser;
  }

  async moderateOffer(offerId: string, moderationStatus: string, reason?: string, moderatedBy?: string): Promise<Offer> {
    const [updatedOffer] = await db
      .update(offers)
      .set({
        moderationStatus,
        moderationReason: reason,
        moderatedBy,
        moderatedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(offers.id, offerId))
      .returning();
    return updatedOffer;
  }

  async getMarketInsights(): Promise<{
    activeOffers: number;
    totalValue: string;
    avgPrice: string;
    topCommodities: any[];
  }> {
    const activeOffersList = await db
      .select()
      .from(offers)
      .where(and(
        eq(offers.status, 'active'),
        or(eq(offers.moderationStatus, 'active'), sql`moderation_status IS NULL`)
      ));

    const activeOffers = activeOffersList.length;
    
    // Calculate total value and average price
    let totalValue = 0;
    let totalQuantity = 0;
    for (const offer of activeOffersList) {
      const quantity = parseFloat(offer.quantity);
      const price = parseFloat(offer.pricePerUnit);
      totalValue += quantity * price;
      totalQuantity += quantity;
    }
    
    const avgPrice = totalQuantity > 0 ? (totalValue / totalQuantity).toFixed(2) : '0';
    
    // Get top commodities
    const commodityCount: Record<string, number> = {};
    for (const offer of activeOffersList) {
      commodityCount[offer.commodityId] = (commodityCount[offer.commodityId] || 0) + 1;
    }
    
    const topCommodities = Object.entries(commodityCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([commodityId, count]) => ({ name: commodityId, count }));

    return {
      activeOffers,
      totalValue: totalValue.toFixed(2),
      avgPrice,
      topCommodities
    };
  }

  async getComplianceInsights(): Promise<{
    kybPending: number;
    kybApproved: number;
    kybRejected: number;
    avgProcessingTime: number;
  }> {
    const allUsers = await db.select().from(users);
    
    const kybPending = allUsers.filter(user => user.kybStatus === 'pending' || user.kybStatus === 'in_review').length;
    const kybApproved = allUsers.filter(user => user.kybStatus === 'verified' || user.kybStatus === 'enhanced').length;
    const kybRejected = allUsers.filter(user => user.kybStatus === 'rejected').length;
    
    // Mock average processing time (in practice, you'd calculate from timestamps)
    const avgProcessingTime = 48; // hours
    
    return {
      kybPending,
      kybApproved, 
      kybRejected,
      avgProcessingTime
    };
  }

  async createAuditLog(auditLog: Omit<AuditLog, 'id' | 'timestamp'>): Promise<AuditLog> {
    const [newAuditLog] = await db
      .insert(auditLogs)
      .values({
        id: sql`gen_random_uuid()`,
        userId: auditLog.userId,
        userRole: auditLog.userRole,
        action: auditLog.action,
        entityType: auditLog.entityType,
        entityId: auditLog.entityId,
        beforeValue: auditLog.beforeValue,
        afterValue: auditLog.afterValue,
        reason: auditLog.reason,
        ipAddress: auditLog.ipAddress,
        userAgent: auditLog.userAgent,
        timestamp: sql`NOW()`
      })
      .returning();
    return newAuditLog;
  }

  async getAuditLogs(filters?: {
    userId?: string;
    action?: string;
    entityType?: string;
    entityId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }): Promise<AuditLog[]> {
    let query = db.select().from(auditLogs);
    const conditions = [];
    
    if (filters?.userId) {
      conditions.push(eq(auditLogs.userId, filters.userId));
    }
    if (filters?.action) {
      conditions.push(eq(auditLogs.action, filters.action));
    }
    if (filters?.entityType) {
      conditions.push(eq(auditLogs.entityType, filters.entityType));
    }
    if (filters?.entityId) {
      conditions.push(eq(auditLogs.entityId, filters.entityId));
    }
    if (filters?.startDate) {
      conditions.push(sql`timestamp >= ${filters.startDate}`);
    }
    if (filters?.endDate) {
      conditions.push(sql`timestamp <= ${filters.endDate}`);
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    query = query.orderBy(desc(auditLogs.timestamp));
    
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    if (filters?.offset) {
      query = query.offset(filters.offset);
    }
    
    return query;
  }

  async createTemporaryDocumentLink(link: Omit<TemporaryDocumentLink, 'id' | 'createdAt'>): Promise<TemporaryDocumentLink> {
    const [newLink] = await db
      .insert(temporaryDocumentLinks)
      .values({
        id: sql`gen_random_uuid()`,
        documentId: link.documentId,
        createdBy: link.createdBy,
        token: link.token,
        expiresAt: link.expiresAt,
        accessCount: link.accessCount,
        maxAccess: link.maxAccess,
        ipWhitelist: link.ipWhitelist,
        createdAt: sql`NOW()`
      })
      .returning();
    return newLink;
  }

  async getTemporaryDocumentLink(token: string): Promise<TemporaryDocumentLink | undefined> {
    const [link] = await db
      .select()
      .from(temporaryDocumentLinks)
      .where(eq(temporaryDocumentLinks.token, token))
      .limit(1);
    return link;
  }

  async updateDocumentLinkAccess(token: string): Promise<void> {
    await db
      .update(temporaryDocumentLinks)
      .set({ 
        accessCount: sql`access_count + 1`
      })
      .where(eq(temporaryDocumentLinks.token, token));
  }

  async cleanupExpiredDocumentLinks(): Promise<void> {
    await db
      .delete(temporaryDocumentLinks)
      .where(sql`expires_at < NOW()`);
  }

  async getKYBQueue(filters?: { status?: string; assignedTo?: string; }): Promise<User[]> {
    let query = db.select().from(users);
    const conditions = [
      or(
        eq(users.kybStatus, 'pending'),
        eq(users.kybStatus, 'in_review')
      )
    ];
    
    if (filters?.status) {
      conditions.push(eq(users.kybStatus, filters.status));
    }
    if (filters?.assignedTo) {
      conditions.push(eq(users.adminRole, filters.assignedTo));
    }
    
    return query.where(and(...conditions)).orderBy(desc(users.createdAt));
  }
}

// Use DatabaseStorage for consistent data across all endpoints
export const storage = new DatabaseStorage();
