import { db } from "./db";
import { commodities, offers, users } from "@shared/schema";
import { sql } from "drizzle-orm";

// Demo commodities for each category
const demoCommodities = [
  // Fuel & Hydrocarbons
  {
    name: "West Texas Intermediate (WTI) Crude Oil",
    type: "fuel_hydrocarbons" as const,
    description: "Light, sweet crude oil with low sulfur content, benchmark for US oil pricing",
    specifications: {
      apiGravity: "39.6°",
      sulfurContent: "0.24%",
      quality: "Light Sweet",
      origin: "USA - Texas",
      deliveryMethods: ["Pipeline", "Tanker"]
    }
  },
  {
    name: "Natural Gas (Henry Hub)",
    type: "fuel_hydrocarbons" as const,
    description: "Dry natural gas delivered at Henry Hub, Louisiana pricing point",
    specifications: {
      heatContent: "1,037 BTU/cu ft",
      methaneContent: "95%+",
      deliveryPoint: "Henry Hub, Louisiana",
      pipelineGrade: "Interstate quality",
      contractUnit: "10,000 MMBtu"
    }
  },
  {
    name: "Brent Crude Oil",
    type: "fuel_hydrocarbons" as const,
    description: "North Sea crude oil blend, international benchmark for global oil pricing",
    specifications: {
      apiGravity: "38.06°",
      sulfurContent: "0.37%",
      quality: "Light Sweet",
      origin: "North Sea - UK/Norway",
      deliveryTerminal: "Sullom Voe, Scotland"
    }
  },
  
  // Metals & Precious Metals
  {
    name: "Gold Bullion",
    type: "metals_precious" as const,
    description: "Investment-grade gold bars, LBMA Good Delivery standard",
    specifications: {
      purity: "99.5%+ fine gold",
      weight: "400 oz bars",
      certification: "LBMA Good Delivery",
      assayMarks: "Refiner hallmark required",
      storage: "Approved vault facilities"
    }
  },
  {
    name: "Silver Bullion",
    type: "metals_precious" as const,
    description: "Investment-grade silver bars, LBMA approved refiners",
    specifications: {
      purity: "99.9%+ fine silver",
      weight: "1000 oz bars",
      certification: "LBMA Good Delivery",
      minWeight: "750 oz",
      maxWeight: "1100 oz"
    }
  },
  {
    name: "Copper Cathode",
    type: "metals_precious" as const,
    description: "Grade A copper cathodes, LME registered brands",
    specifications: {
      purity: "99.99% Cu min",
      weight: "125kg plates",
      dimensions: "914mm x 914mm x 12mm",
      standard: "LME Grade A",
      brands: "LME registered brands only"
    }
  },
  
  // Agricultural Products
  {
    name: "Hard Red Winter Wheat",
    type: "agricultural" as const,
    description: "US No. 2 Hard Red Winter Wheat, CBOT delivery grade",
    specifications: {
      grade: "US No. 2",
      protein: "11.5% min",
      testWeight: "58 lbs/bushel min", 
      moisture: "14% max",
      deliveryPoints: "Kansas City, Chicago"
    }
  },
  {
    name: "Soybeans",
    type: "agricultural" as const,
    description: "US No. 2 Yellow Soybeans, CBOT delivery specification",
    specifications: {
      grade: "US No. 2 Yellow",
      moisture: "14% max",
      foreignMaterial: "2% max",
      testWeight: "54 lbs/bushel min",
      splits: "20% max"
    }
  },
  {
    name: "Arabica Coffee Beans",
    type: "agricultural" as const,
    description: "Specialty grade Arabica coffee beans, direct trade certified",
    specifications: {
      grade: "Specialty Grade (80+ points)",
      origin: "Colombia - Huila Region",
      altitude: "1400-1800m",
      processing: "Fully washed",
      certification: "Fair Trade, Organic"
    }
  }
];

// Demo users for offers - 9 verified traders
const demoUsers = [
  {
    id: "demo-user-1",
    email: "trader1@petromax.com",
    firstName: "Sarah",
    lastName: "Chen",
    companyName: "PetroMax Energy Trading",
    role: "senior_trader",
    financialRating: "8.5",
    creditRating: "AA-",
    verified: true
  },
  {
    id: "demo-user-2", 
    email: "manager@globalmetals.com",
    firstName: "Marcus",
    lastName: "Rodriguez",
    companyName: "Global Metals Corp",
    role: "commodity_manager",
    financialRating: "9.2",
    creditRating: "AAA",
    verified: true
  },
  {
    id: "demo-user-3",
    email: "director@agrilink.com",
    firstName: "Emma",
    lastName: "Thompson",
    companyName: "AgriLink International",
    role: "trading_director", 
    financialRating: "7.8",
    creditRating: "A+",
    verified: true
  },
  {
    id: "seller_gcc_1",
    email: "procurement@gcc-energy.com",
    firstName: "Ahmed",
    lastName: "Al-Rashid",
    companyName: "GCC Energy Consortium",
    role: "procurement_manager",
    financialRating: "9.1",
    creditRating: "AA+",
    verified: true
  },
  {
    id: "seller_gcc_2",
    email: "trading@gcc-energy.com",
    firstName: "Fatima",
    lastName: "Al-Zahra",
    companyName: "GCC Energy Consortium",
    role: "commodity_trader",
    financialRating: "8.9",
    creditRating: "AA",
    verified: true
  },
  {
    id: "seller_global_1",
    email: "metals@global-commodities.com",
    firstName: "James",
    lastName: "Wellington",
    companyName: "Global Commodities Ltd",
    role: "metals_specialist",
    financialRating: "8.7",
    creditRating: "A+",
    verified: true
  },
  {
    id: "seller_global_2",
    email: "precious@global-commodities.com",
    firstName: "Victoria",
    lastName: "Sterling",
    companyName: "Global Commodities Ltd",
    role: "precious_metals_trader",
    financialRating: "9.0",
    creditRating: "AA-",
    verified: true
  },
  {
    id: "seller_global_3",
    email: "agri@global-commodities.com",
    firstName: "Robert",
    lastName: "Greenfield",
    companyName: "Global Commodities Ltd",
    role: "agricultural_trader",
    financialRating: "8.3",
    creditRating: "A",
    verified: true
  },
  {
    id: "seller_global_4",
    email: "bulk@global-commodities.com",
    firstName: "Maria",
    lastName: "Santos",
    companyName: "Global Commodities Ltd",
    role: "bulk_commodities_manager",
    financialRating: "8.6",
    creditRating: "A+",
    verified: true
  }
];

export async function seedDemoData() {
  try {
    console.log("🌱 Starting demo data seeding...");

    // Insert demo users
    console.log("👥 Creating demo users...");
    for (const user of demoUsers) {
      await db.insert(users).values(user).onConflictDoNothing();
    }

    // Insert demo commodities and get their IDs
    console.log("📦 Creating demo commodities...");
    const commodityIds: string[] = [];
    for (const commodity of demoCommodities) {
      const [created] = await db.insert(commodities).values(commodity).returning({ id: commodities.id });
      commodityIds.push(created.id);
    }

    // Create demo offers - 3 for each category (9 total)
    console.log("💼 Creating demo offers...");
    const demoOffers = [
      // Fuel & Hydrocarbons Offers
      {
        userId: demoUsers[0].id,
        commodityId: commodityIds[0], // WTI Crude
        type: "sell" as const,
        quantity: "10000",
        unit: "barrels",
        pricePerUnit: "78.45",
        currency: "USD",
        location: "Houston, TX",
        minQuantity: "1000",
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        deliveryTerms: "FOB Houston Ship Channel, 15-day delivery window",
        paymentTerms: "Letter of Credit, 30 days from B/L date",
        verified: true,
        sellerOrgVerified: true,
        status: "active"
      },
      {
        userId: demoUsers[1].id,
        commodityId: commodityIds[1], // Natural Gas
        type: "buy" as const,
        quantity: "50000",
        unit: "MMBtu",
        pricePerUnit: "2.85",
        currency: "USD", 
        location: "Henry Hub, LA",
        minQuantity: "10000",
        validUntil: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000), // 45 days
        deliveryTerms: "Pipeline delivery, firm transportation",
        paymentTerms: "Monthly invoice, net 15 days",
        verified: true,
        sellerOrgVerified: true,
        status: "active"
      },
      {
        userId: demoUsers[2].id,
        commodityId: commodityIds[2], // Brent Crude
        type: "sell" as const,
        quantity: "25000",
        unit: "barrels",
        pricePerUnit: "82.20",
        currency: "USD",
        location: "Rotterdam, Netherlands",
        minQuantity: "5000",
        validUntil: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000), // 21 days
        deliveryTerms: "CIF Rotterdam, Aframax tanker lots",
        paymentTerms: "Documentary Credit, sight payment",
        verified: true,
        sellerOrgVerified: true,
        status: "active"
      },

      // Metals & Precious Metals Offers
      {
        userId: demoUsers[3].id,
        commodityId: commodityIds[3], // Gold
        type: "buy" as const,
        quantity: "100",
        unit: "bars (400oz)",
        pricePerUnit: "775000",
        currency: "USD",
        location: "London, UK",
        minQuantity: "10",
        validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
        deliveryTerms: "LBMA approved vault, allocated storage",
        paymentTerms: "Wire transfer, T+2 settlement",
        verified: true,
        sellerOrgVerified: true,
        status: "active"
      },
      {
        userId: demoUsers[4].id,
        commodityId: commodityIds[4], // Silver
        type: "sell" as const,
        quantity: "500",
        unit: "bars (1000oz)",
        pricePerUnit: "23500",
        currency: "USD",
        location: "New York, NY",
        minQuantity: "50",
        validUntil: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000), // 28 days
        deliveryTerms: "COMEX approved warehouse, warrant delivery",
        paymentTerms: "Certified funds, delivery vs payment",
        verified: true,
        sellerOrgVerified: true,
        status: "active"
      },
      {
        userId: demoUsers[5].id,
        commodityId: commodityIds[5], // Copper
        type: "buy" as const,
        quantity: "250",
        unit: "metric tons",
        pricePerUnit: "8450",
        currency: "USD",
        location: "Shanghai, China",
        minQuantity: "25",
        validUntil: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000), // 35 days
        deliveryTerms: "CIF Shanghai, LME warehouse delivery",
        paymentTerms: "T/T 30% advance, 70% against documents",
        verified: true,
        sellerOrgVerified: true,
        status: "active"
      },

      // Agricultural Products Offers
      {
        userId: demoUsers[6].id,
        commodityId: commodityIds[6], // Wheat
        type: "sell" as const,
        quantity: "5000",
        unit: "metric tons",
        pricePerUnit: "285",
        currency: "USD",
        location: "Kansas City, MO",
        minQuantity: "500",
        validUntil: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
        deliveryTerms: "FOB Kansas City, rail or truck loading",
        paymentTerms: "Cash against documents, 7 days",
        verified: true,
        sellerOrgVerified: true,
        status: "active"
      },
      {
        userId: demoUsers[7].id,
        commodityId: commodityIds[7], // Soybeans
        type: "buy" as const,
        quantity: "10000",
        unit: "metric tons",
        pricePerUnit: "445",
        currency: "USD",
        location: "Chicago, IL",
        minQuantity: "1000",
        validUntil: new Date(Date.now() + 42 * 24 * 60 * 60 * 1000), // 42 days
        deliveryTerms: "CIF destination, containerized shipment",
        paymentTerms: "Irrevocable L/C at sight",
        verified: true,
        sellerOrgVerified: true,
        status: "active"
      },
      {
        userId: demoUsers[8].id,
        commodityId: commodityIds[8], // Coffee
        type: "sell" as const,
        quantity: "100",
        unit: "bags (60kg)",
        pricePerUnit: "195",
        currency: "USD",
        location: "Bogotá, Colombia",
        minQuantity: "20",
        validUntil: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000), // 25 days
        deliveryTerms: "FOB Buenaventura Port, GrainPro bags",
        paymentTerms: "50% advance, 50% against shipping docs",
        verified: true,
        sellerOrgVerified: true,
        status: "active"
      }
    ];

    // Insert all demo offers
    for (const offer of demoOffers) {
      await db.insert(offers).values(offer);
    }

    // Create additional offers for fuller marketplace (6 more offers)
    console.log("💼 Creating additional marketplace offers...");
    const additionalOffers = [
      // Additional Fuel & Hydrocarbons Offers
      {
        userId: demoUsers[0].id,
        commodityId: commodityIds[0], // WTI Crude - another offer
        type: "buy" as const,
        quantity: "15000",
        unit: "barrels",
        pricePerUnit: "77.80",
        currency: "USD",
        location: "Cushing, OK",
        minQuantity: "2000",
        validUntil: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000), // 45 days
        deliveryTerms: "FOB Cushing terminal, pipeline delivery",
        paymentTerms: "Documentary Credit, 15 days",
        verified: true,
        sellerOrgVerified: true,
        status: "active"
      },
      {
        userId: demoUsers[1].id,
        commodityId: commodityIds[2], // Brent Crude - another offer
        type: "buy" as const,
        quantity: "20000",
        unit: "barrels",
        pricePerUnit: "81.50",
        currency: "USD",
        location: "Sullom Voe, Scotland",
        minQuantity: "3000",
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        deliveryTerms: "FOB Sullom Voe terminal",
        paymentTerms: "Letter of Credit at sight",
        verified: true,
        sellerOrgVerified: true,
        status: "active"
      },

      // Additional Metals Offers
      {
        userId: demoUsers[2].id,
        commodityId: commodityIds[3], // Gold - another offer
        type: "sell" as const,
        quantity: "50",
        unit: "bars (400oz)",
        pricePerUnit: "772500",
        currency: "USD",
        location: "Zurich, Switzerland",
        minQuantity: "5",
        validUntil: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000), // 21 days
        deliveryTerms: "Swiss bank vault delivery",
        paymentTerms: "Swift wire transfer, T+1",
        verified: true,
        sellerOrgVerified: true,
        status: "active"
      },
      {
        userId: demoUsers[3].id,
        commodityId: commodityIds[5], // Copper - another offer
        type: "sell" as const,
        quantity: "500",
        unit: "metric tons",
        pricePerUnit: "8350",
        currency: "USD",
        location: "Hamburg, Germany",
        minQuantity: "50",
        validUntil: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000), // 40 days
        deliveryTerms: "CIF Hamburg, LME warehouse",
        paymentTerms: "Bank guarantee, 21 days",
        verified: true,
        sellerOrgVerified: true,
        status: "active"
      },

      // Additional Agricultural Offers
      {
        userId: demoUsers[4].id,
        commodityId: commodityIds[6], // Wheat - another offer
        type: "buy" as const,
        quantity: "8000",
        unit: "metric tons",
        pricePerUnit: "290",
        currency: "USD",
        location: "Minneapolis, MN",
        minQuantity: "1000",
        validUntil: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000), // 35 days
        deliveryTerms: "FOB Minneapolis, rail delivery",
        paymentTerms: "Cash on delivery",
        verified: true,
        sellerOrgVerified: true,
        status: "active"
      },
      {
        userId: demoUsers[5].id,
        commodityId: commodityIds[8], // Coffee - another offer
        type: "buy" as const,
        quantity: "200",
        unit: "bags (60kg)",
        pricePerUnit: "185",
        currency: "USD",
        location: "New York, NY",
        minQuantity: "50",
        validUntil: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000), // 20 days
        deliveryTerms: "CIF New York Port",
        paymentTerms: "Documentary Credit, 30 days",
        verified: true,
        sellerOrgVerified: true,
        status: "active"
      }
    ];

    // Insert additional offers
    for (const offer of additionalOffers) {
      await db.insert(offers).values(offer);
    }

    console.log("✅ Demo data seeding completed successfully!");
    console.log(`   - Created ${demoUsers.length} demo users`);
    console.log(`   - Created ${demoCommodities.length} demo commodities`);
    console.log(`   - Created ${demoOffers.length} demo offers`);
    
  } catch (error) {
    console.error("❌ Error seeding demo data:", error);
    throw error;
  }
}

// Function to clear demo data (useful for development)
export async function clearDemoData() {
  try {
    console.log("🧹 Clearing demo data...");
    
    // Delete in reverse order due to foreign key constraints
    await db.delete(offers).where(sql`user_id LIKE 'demo-user-%' OR user_id LIKE 'seller_%'`);
    await db.delete(commodities).where(sql`name LIKE '%' OR type IN ('fuel_hydrocarbons', 'metals_precious', 'agricultural')`);
    await db.delete(users).where(sql`id LIKE 'demo-user-%' OR id LIKE 'seller_%'`);
    
    console.log("✅ Demo data cleared successfully!");
  } catch (error) {
    console.error("❌ Error clearing demo data:", error);
    throw error;
  }
}