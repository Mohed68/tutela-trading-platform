/**
 * restore_or_seed_offers.ts
 * 1) try restore old offers
 * 2) if < 15 verified-active offers, seed (15 - current) new ones
 */
import { nanoid } from 'nanoid';
import { db } from '../server/db';
import { offers, commodities, users } from '../shared/schema';
import { eq, and, isNull, count } from 'drizzle-orm';

const CATEGORIES: Array<{
  key: 'hydro'|'agri'|'metals',
  commodity: string,
  unit: 'bbl'|'MT'|'kg'|'troy_ounce',
  priceRange: [number, number],
  qtyRange: [number, number],
  location: string,
  incoterm: string,
  payment: string
}> = [
  // --- Hydrocarbons (6) ---
  { key:'hydro', commodity:'WTI Crude Oil',     unit:'bbl', priceRange:[75,85],   qtyRange:[15000,50000], location:'Houston, TX',    incoterm:'FOB Houston',  payment:'Irrevocable LC' },
  { key:'hydro', commodity:'Brent Crude Oil',   unit:'bbl', priceRange:[80,90],   qtyRange:[10000,25000], location:'Fujairah, UAE',  incoterm:'FOB Fujairah', payment:'Revolving LC'   },
  { key:'hydro', commodity:'Diesel EN590',      unit:'MT',  priceRange:[700,950], qtyRange:[500,2000],    location:'Rotterdam, NL', incoterm:'CIF Rotterdam', payment:'CAD'           },
  { key:'hydro', commodity:'Gasoline RON95',    unit:'MT',  priceRange:[650,950], qtyRange:[300,1500],    location:'Singapore',     incoterm:'CIF Singapore', payment:'30-day LC'     },
  { key:'hydro', commodity:'LPG (Propane)',     unit:'MT',  priceRange:[400,650], qtyRange:[500,3000],    location:'Jebel Ali, UAE',incoterm:'FOB Jebel Ali', payment:'TT'           },
  { key:'hydro', commodity:'LNG Cargo',         unit:'MT',  priceRange:[350,550], qtyRange:[1000,5000],   location:'Ras Laffan, QA',incoterm:'FOB Ras Laffan', payment:'LC at Sight'   },

  // --- Agriculture (5) ---
  { key:'agri',  commodity:'Hard Red Winter Wheat', unit:'MT', priceRange:[260,400],  qtyRange:[500,25000],  location:'Kansas, USA',   incoterm:'FOB Kansas',   payment:'CAD'          },
  { key:'agri',  commodity:'Premium Soybeans',      unit:'MT', priceRange:[500,850],  qtyRange:[100,12000],  location:'Rotterdam, NL', incoterm:'CIF Rotterdam',payment:'Irrevocable LC'},
  { key:'agri',  commodity:'Arabica Coffee Beans',  unit:'MT', priceRange:[7000,9000],qtyRange:[50,5000],    location:'Santos, Brazil',incoterm:'FOB Santos',   payment:'Prepayment'   },
  { key:'agri',  commodity:'Robusta Coffee Beans',  unit:'MT', priceRange:[3000,4500],qtyRange:[50,3000],    location:'Ho Chi Minh, VN',incoterm:'FOB HCMC',    payment:'TT'           },
  { key:'agri',  commodity:'White Sugar ICUMSA 45', unit:'MT', priceRange:[450,650],  qtyRange:[100,20000],  location:'Jebel Ali, UAE',incoterm:'CIF Jebel Ali', payment:'LC at Sight'  },

  // --- Metals (4) ---
  { key:'metals',commodity:'Gold Bullion',      unit:'kg',         priceRange:[60000,70000], qtyRange:[1,50],     location:'Dubai, UAE',   incoterm:'EXW Dubai',   payment:'Escrow'        },
  { key:'metals',commodity:'Gold Bullion',      unit:'troy_ounce', priceRange:[1900,2400],   qtyRange:[32,2000],  location:'Zurich, CH',   incoterm:'CIF Zurich',  payment:'Escrow'        },
  { key:'metals',commodity:'Silver Bullion',    unit:'troy_ounce', priceRange:[22,35],       qtyRange:[1000,20000],location:'Perth, AU',   incoterm:'EXW Perth',   payment:'TT'            },
  { key:'metals',commodity:'Silver Bullion',    unit:'kg',         priceRange:[700,1200],    qtyRange:[31,5000],  location:'Dubai, UAE',   incoterm:'CIF Dubai',   payment:'LC at Sight'   }
];

function rnd([min,max]:[number,number]) {
  return Math.round((min + Math.random()*(max-min)) * 100) / 100;
}

function suggestMinOrder(commodity: string, unit: string, availableQty: number): number {
  // MOQ defaults based on commodity type
  if (unit === 'bbl') {
    return 1000; // 1,000 barrels
  } else if (unit === 'MT') {
    return 500; // 500 MT
  } else if (unit === 'troy_ounce') {
    return 10; // 10 troy oz
  } else if (unit === 'kg') {
    return 1; // 1 kg
  } else {
    return Math.max(1, Math.floor(availableQty * 0.1)); // 10% of available
  }
}

function genCompany(isGCC: boolean) {
  const gccCompanies = [
    { name: 'Al-Rashid Trading Corp', country: 'UAE', city: 'Dubai' },
    { name: 'Gulf Commodities LLC', country: 'UAE', city: 'Abu Dhabi' },
    { name: 'Saudi Arabian Oil Trading', country: 'Saudi Arabia', city: 'Riyadh' },
    { name: 'Qatar Energy Solutions', country: 'Qatar', city: 'Doha' },
    { name: 'Kuwait International Trading', country: 'Kuwait', city: 'Kuwait City' },
    { name: 'Bahrain Commercial Exchange', country: 'Bahrain', city: 'Manama' }
  ];
  
  const globalCompanies = [
    { name: 'Global Trading Partners Inc', country: 'USA', city: 'Houston' },
    { name: 'European Commodities Ltd', country: 'Netherlands', city: 'Rotterdam' },
    { name: 'Asia Pacific Resources', country: 'Singapore', city: 'Singapore' },
    { name: 'Brazilian Export Group', country: 'Brazil', city: 'Santos' },
    { name: 'Australian Mining Corp', country: 'Australia', city: 'Perth' },
    { name: 'Swiss Gold Traders SA', country: 'Switzerland', city: 'Zurich' }
  ];
  
  const companies = isGCC ? gccCompanies : globalCompanies;
  return companies[Math.floor(Math.random() * companies.length)];
}

function genDelegate(isAuthorized: boolean) {
  const delegates = [
    { fullName: 'Ahmed Al-Mahmoud', roleTitle: 'Senior Commodities Trader' },
    { fullName: 'Sarah Chen', roleTitle: 'Regional Trading Manager' },
    { fullName: 'Mohammed Al-Rashid', roleTitle: 'Export Director' },
    { fullName: 'Elena Rodriguez', roleTitle: 'Chief Trading Officer' },
    { fullName: 'David Thompson', roleTitle: 'Senior Broker' },
    { fullName: 'Fatima Al-Zahra', roleTitle: 'Head of Sales' },
    { fullName: 'James Mitchell', roleTitle: 'Trading Director' },
    { fullName: 'Aisha Patel', roleTitle: 'Commodities Specialist' }
  ];
  
  return delegates[Math.floor(Math.random() * delegates.length)];
}

async function getCurrentVerifiedOffers() {
  const result = await db.select({ count: count() })
    .from(offers)
    .where(and(eq(offers.verified, true), eq(offers.status, 'active')));
  
  return result[0]?.count || 0;
}

async function getCommodityByName(name: string) {
  const result = await db.select()
    .from(commodities)
    .where(eq(commodities.name, name))
    .limit(1);
  
  return result[0] || null;
}

async function ensureCommodityExists(name: string, type: 'fuel_hydrocarbons' | 'metals_precious' | 'agricultural') {
  let commodity = await getCommodityByName(name);
  
  if (!commodity) {
    const [newCommodity] = await db.insert(commodities)
      .values({
        id: nanoid(),
        name,
        type,
        description: `High-quality ${name} for international trading`
      })
      .returning();
    commodity = newCommodity;
  }
  
  return commodity;
}

async function createDemoUser(company: any, delegate: any) {
  const userId = nanoid();
  await db.insert(users)
    .values({
      id: userId,
      email: `${delegate.fullName.toLowerCase().replace(/\s+/g, '.')}@${company.name.toLowerCase().replace(/\s+/g, '')}.com`,
      firstName: delegate.fullName.split(' ')[0],
      lastName: delegate.fullName.split(' ').slice(1).join(' '),
      companyName: company.name,
      role: delegate.roleTitle,
      verified: true,
      kybStatus: 'verified',
      verificationLevel: 'full'
    })
    .onConflictDoNothing();
  
  return userId;
}

async function seedOffers(countNeeded: number, dryRun: boolean = false) {
  console.log(`🌱 Seeding ${countNeeded} offers...`);
  
  if (dryRun) {
    console.log('DRY RUN - would create these offers:');
  }
  
  const newOffers = [];
  
  // rotate through catalog to ensure category spread
  for (let i = 0; i < countNeeded; i++) {
    const spec = CATEGORIES[i % CATEGORIES.length];
    const qty = Math.round(rnd(spec.qtyRange));
    const price = rnd(spec.priceRange);
    const company = genCompany(Math.random() < 0.40); // ≥40% GCC
    const delegate = genDelegate(true);
    const minOrderQty = suggestMinOrder(spec.commodity, spec.unit, qty);
    
    // Map category to commodity type
    const commodityType: 'fuel_hydrocarbons' | 'metals_precious' | 'agricultural' = 
      spec.key === 'hydro' ? 'fuel_hydrocarbons' : 
      spec.key === 'metals' ? 'metals_precious' : 'agricultural';
    
    if (dryRun) {
      console.log(`  ${i+1}. ${spec.commodity} - ${qty} ${spec.unit} @ $${price}/${spec.unit} (MOQ: ${minOrderQty}) - ${company.name}, ${company.country}`);
      continue;
    }
    
    // Ensure commodity exists
    const commodity = await ensureCommodityExists(spec.commodity, commodityType);
    
    // Create demo user
    const userId = await createDemoUser(company, delegate);
    
    const offer = {
      id: nanoid(),
      userId,
      commodityId: commodity.id,
      type: 'sell' as const,
      quantity: qty.toString(),
      unit: spec.unit,
      pricePerUnit: price.toString(),
      currency: 'USD',
      location: spec.location,
      status: 'active' as const,
      verified: true,
      validUntil: new Date(Date.now() + 30*24*3600*1000), // +30 days
      // Note: We need to use the actual database schema
      deliveryTerms: spec.incoterm,
      paymentTerms: spec.payment,
      specifications: `Premium grade ${spec.commodity} meeting international standards`,
      deliveryOptions: `Available for immediate delivery from ${spec.location}`,
      // Seller Organization Info
      sellerOrgId: nanoid(),
      sellerOrgName: company.name,
      sellerOrgVerified: true,
      sellerOrgRating: (4 + Math.random()).toFixed(2),
      // Delegate Info
      delegateId: userId,
      delegateFullName: delegate.fullName,
      delegateRoleTitle: delegate.roleTitle,
      delegateIsAuthorized: true
    };
    
    newOffers.push(offer);
  }
  
  if (!dryRun && newOffers.length > 0) {
    await db.insert(offers).values(newOffers);
    console.log(`✅ Created ${newOffers.length} verified offers`);
  }
  
  return newOffers.length;
}

async function restoreOffers(dryRun: boolean = false) {
  console.log('🔍 Checking for offers to restore...');
  
  // Check for unverified offers that could be restored
  const unverifiedOffers = await db.select()
    .from(offers)
    .where(eq(offers.verified, false))
    .limit(10);
  
  if (unverifiedOffers.length === 0) {
    console.log('No offers found to restore');
    return 0;
  }
  
  console.log(`Found ${unverifiedOffers.length} unverified offers`);
  
  if (dryRun) {
    console.log('DRY RUN - would update these offers to verified:');
    unverifiedOffers.forEach((offer, i) => {
      console.log(`  ${i+1}. ${offer.id} - qty: ${offer.quantity}, price: ${offer.pricePerUnit}`);
    });
    return unverifiedOffers.length;
  }
  
  // Update to verified with proper seller org info
  let restoredCount = 0;
  for (const offer of unverifiedOffers) {
    const company = genCompany(Math.random() < 0.40);
    const delegate = genDelegate(true);
    
    await db.update(offers)
      .set({
        verified: true,
        sellerOrgVerified: true,
        sellerOrgName: company.name,
        sellerOrgRating: (4 + Math.random()).toFixed(2),
        delegateFullName: delegate.fullName,
        delegateRoleTitle: delegate.roleTitle,
        delegateIsAuthorized: true,
        // Note: Database uses min_quantity column, not min_order_qty
      })
      .where(eq(offers.id, offer.id));
    
    restoredCount++;
  }
  
  console.log(`✅ Restored ${restoredCount} offers to verified status`);
  return restoredCount;
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  const isApply = process.argv.includes('--apply');
  
  if (!isDryRun && !isApply) {
    console.log('Usage: ts-node restore_or_seed_offers.ts [--dry-run | --apply]');
    process.exit(1);
  }
  
  console.log('🚀 TUTELA Offer Restoration & Seeding');
  console.log('=====================================');
  
  // Step 1: Try to restore existing offers
  const restoredCount = await restoreOffers(isDryRun);
  
  // Step 2: Check current verified count
  const currentVerified = await getCurrentVerifiedOffers();
  console.log(`📊 Current verified offers: ${currentVerified}`);
  
  // Step 3: Seed additional offers if needed
  const target = 15;
  const needed = Math.max(0, target - currentVerified);
  
  if (needed > 0) {
    console.log(`🎯 Need ${needed} more offers to reach target of ${target}`);
    await seedOffers(needed, isDryRun);
  } else {
    console.log(`✅ Already have ${currentVerified} verified offers (target: ${target})`);
  }
  
  // Step 4: Final summary
  const finalCount = await getCurrentVerifiedOffers();
  console.log('\n📈 Summary:');
  console.log(`  Restored: ${restoredCount} offers`);
  console.log(`  Total verified offers: ${finalCount}`);
  console.log(`  Target achieved: ${finalCount >= target ? '✅' : '❌'}`);
  
  if (isDryRun) {
    console.log('\n💡 Run with --apply to execute changes');
  }
}

// Check if this is the main module (ES module compatible)
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { restoreOffers, seedOffers, getCurrentVerifiedOffers };