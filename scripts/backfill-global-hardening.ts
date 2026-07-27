#!/usr/bin/env tsx
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { suggestMinOrder, resolveCommodityKey } from '../src/lib/moq.js';
import { generateSyntheticIdentity } from '../src/seeds/identity.js';

interface OfferData {
  id: string;
  commodityName?: string;
  commodity?: { name?: string };
  title?: string;
  quantity: number;
  unit: string;
  pricePerUnit: number;
  minOrderQty?: number;
  verified?: boolean;
  sellerOrgName?: string;
  sellerOrgVerified?: boolean;
  delegateFullName?: string;
  delegateRoleTitle?: string;
  delegateIsAuthorized?: boolean;
}

// Sample offers data (in production this would come from database)
const sampleOffers: OfferData[] = [
  {
    id: 'o1',
    commodity: { name: 'WTI Crude Oil' },
    quantity: 50000,
    unit: 'bbl',
    pricePerUnit: 78.45,
    minOrderQty: 0, // Invalid - will be fixed
    verified: false,
    sellerOrgName: '',
    delegateFullName: ''
  },
  {
    id: 'o2', 
    commodity: { name: 'Gold Bullion' },
    quantity: 5000,
    unit: 'troy_ounce',
    pricePerUnit: 2095.75,
    minOrderQty: 5, // Below minimum - will be fixed
    verified: false,
    sellerOrgName: '',
    delegateFullName: ''
  },
  {
    id: 'o3',
    commodity: { name: 'Premium Soybeans' },
    quantity: 25000,
    unit: 'MT',
    pricePerUnit: 485.50,
    minOrderQty: 150,
    verified: false,
    sellerOrgName: '',
    delegateFullName: ''
  }
];

function toNumber(v: any): number {
  if (typeof v === "number") return v;
  const cleaned = String(v).replace(/[^\d.-]/g, "");
  return Number(cleaned);
}

function isNum(x: any): boolean {
  return Number.isFinite(x);
}

interface BackfillChange {
  offerId: string;
  field: string;
  oldValue: any;
  newValue: any;
  reason: string;
}

async function main() {
  const mode = process.argv[2];
  
  if (!mode || !['--dry-run', '--apply'].includes(mode)) {
    console.log('Usage: tsx scripts/backfill-global-hardening.ts [--dry-run | --apply]');
    console.log('  --dry-run: Show changes without applying them');
    console.log('  --apply: Apply changes to data');
    process.exit(1);
  }
  
  const isDryRun = mode === '--dry-run';
  
  console.log(`🔍 Global Offer Hardening Backfill (${isDryRun ? 'DRY RUN' : 'APPLY'})`);
  console.log(`Processing ${sampleOffers.length} offers...`);
  
  const changes: BackfillChange[] = [];
  let validOffers = 0;
  let invalidOffers = 0;
  
  for (const offer of sampleOffers) {
    const offerId = offer.id;
    
    // 1. Validate and normalize numbers
    const unitPrice = toNumber(offer.pricePerUnit);
    const quantity = toNumber(offer.quantity);
    const totalValue = unitPrice * quantity;
    
    if (!isNum(unitPrice) || !isNum(quantity) || !isNum(totalValue)) {
      changes.push({
        offerId,
        field: 'status',
        oldValue: 'active',
        newValue: 'invalid_number',
        reason: 'Invalid numeric data detected'
      });
      invalidOffers++;
      continue;
    }
    
    validOffers++;
    
    // 2. Fix MOQ based on commodity policy
    const commodityName = offer.commodity?.name || offer.commodityName || offer.title || '';
    const currentMOQ = toNumber(offer.minOrderQty || 0);
    const suggestedMOQ = suggestMinOrder({
      commodityName,
      unit: offer.unit,
      availableQty: quantity
    });
    
    if (currentMOQ <= 0 || currentMOQ < suggestedMOQ) {
      changes.push({
        offerId,
        field: 'minOrderQty',
        oldValue: currentMOQ,
        newValue: suggestedMOQ,
        reason: currentMOQ <= 0 ? 'MOQ was zero or negative' : 'MOQ below policy minimum'
      });
    }
    
    // 3. Generate synthetic identities if missing (≥40% GCC)
    if (!offer.sellerOrgName) {
      const identity = generateSyntheticIdentity();
      changes.push({
        offerId,
        field: 'sellerOrgName',
        oldValue: '',
        newValue: identity.company.name,
        reason: 'Generated synthetic company identity'
      });
    }
    
    if (!offer.delegateFullName) {
      const identity = generateSyntheticIdentity();
      changes.push({
        offerId,
        field: 'delegateFullName',
        oldValue: '',
        newValue: identity.delegate.fullName,
        reason: 'Generated synthetic delegate identity'
      });
    }
    
    // 4. Auto-verify for demo (in production, this would be manual)
    if (process.env.AUTO_VERIFY_DEMO === 'true' && !offer.verified) {
      changes.push({
        offerId,
        field: 'verified',
        oldValue: false,
        newValue: true,
        reason: 'Auto-verified for demo purposes'
      });
      
      changes.push({
        offerId,
        field: 'sellerOrgVerified',
        oldValue: false,
        newValue: true,
        reason: 'Auto-verified seller org for demo'
      });
    }
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`  Total offers processed: ${sampleOffers.length}`);
  console.log(`  Total changes: ${changes.length}`);
  console.log(`  Valid offers: ${validOffers}`);
  console.log(`  Invalid offers (will be hidden): ${invalidOffers}`);
  
  // Generate CSV report
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = resolve(process.cwd(), 'scripts', `${isDryRun ? 'backfill' : 'applied-backfill'}-global-hardening-report-${timestamp}.csv`);
  
  const csvHeader = 'OfferId,Field,OldValue,NewValue,Reason\n';
  const csvContent = changes.map(c => 
    `${c.offerId},"${c.field}","${c.oldValue}","${c.newValue}","${c.reason}"`
  ).join('\n');
  
  writeFileSync(reportPath, csvHeader + csvContent);
  console.log(`\n📄 ${isDryRun ? 'Dry run' : 'Applied changes'} report saved to: ${reportPath}`);
  
  if (!isDryRun) {
    console.log('\n✅ Changes applied successfully');
    console.log('⚠️  Note: This is a demo script. In production, this would:');
    console.log('    - Update offer records in the database');
    console.log('    - Mark invalid offers as hidden from public listings');
    console.log('    - Send notifications to offer owners about changes');
    console.log('    - Log all changes to audit trail');
  } else {
    // Show sample changes
    console.log(`\n🔧 Sample changes:`);
    const sampleChanges = changes.slice(0, 6);
    const groupedChanges = sampleChanges.reduce((acc, change) => {
      if (!acc[change.offerId]) acc[change.offerId] = [];
      acc[change.offerId].push(change);
      return acc;
    }, {} as Record<string, BackfillChange[]>);
    
    Object.entries(groupedChanges).forEach(([offerId, offerChanges]) => {
      console.log(`  ${offerId}:`);
      offerChanges.forEach(change => {
        console.log(`    ${change.field}: ${change.oldValue} → ${change.newValue} (${change.reason})`);
      });
    });
  }
  
  console.log(`\n✨ Backfill completed`);
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}