#!/usr/bin/env node

import { suggestMinOrder, validateMinOrder, resolveCommodityKey } from '../src/lib/moq';
import { seedMissingIdentities } from '../src/seeds/identity';
import fs from 'fs';
import path from 'path';

interface OfferData {
  id: string;
  commodityName?: string;
  unit?: string;
  quantity?: number;
  minOrderQty?: number;
  sellerOrgName?: string;
  delegateFullName?: string;
  [key: string]: any;
}

// Mock offers data for demonstration
const mockOffers: OfferData[] = [
  {
    id: 'o1',
    commodityName: 'WTI Crude Oil',
    unit: 'barrel',
    quantity: 50000,
    minOrderQty: 0, // Invalid - needs fix
    sellerOrgName: '', // Missing - needs fix
    delegateFullName: '' // Missing - needs fix
  },
  {
    id: 'o2', 
    commodityName: 'Gold Bullion',
    unit: 'troy_ounce',
    quantity: 500,
    minOrderQty: 5, // Too low - needs fix
    sellerOrgName: 'Existing Company',
    delegateFullName: '' // Missing - needs fix
  },
  {
    id: 'o3',
    commodityName: 'Silver Bullion', 
    unit: 'troy_ounce',
    quantity: 10000,
    minOrderQty: 1000, // Valid
    sellerOrgName: 'Complete Company',
    delegateFullName: 'John Doe' // Complete
  }
];

interface BackfillResult {
  offerId: string;
  changes: {
    field: string;
    oldValue: any;
    newValue: any;
    reason: string;
  }[];
  valid: boolean;
}

function backfillOffer(offer: OfferData): BackfillResult {
  const changes: BackfillResult['changes'] = [];
  let isValid = true;
  
  // 1. Fix MOQ issues
  if (offer.commodityName && offer.unit && offer.quantity) {
    const commodityKey = resolveCommodityKey(offer.commodityName);
    const suggestion = suggestMinOrder({
      commodityName: offer.commodityName,
      unit: offer.unit,
      availableQty: offer.quantity
    });
    
    const currentMinOrder = offer.minOrderQty || 0;
    
    // Check if MOQ needs fixing
    if (currentMinOrder <= 0 || currentMinOrder < suggestion.value) {
      changes.push({
        field: 'minOrderQty',
        oldValue: currentMinOrder,
        newValue: suggestion.value,
        reason: currentMinOrder <= 0 ? 'MOQ was zero or negative' : 'MOQ below policy minimum'
      });
      offer.minOrderQty = suggestion.value;
    }
    
    // Validate final MOQ
    const validation = validateMinOrder({
      commodityName: offer.commodityName,
      unit: offer.unit,
      proposedMin: offer.minOrderQty,
      availableQty: offer.quantity
    });
    
    if (!validation.valid) {
      isValid = false;
      changes.push({
        field: 'status',
        oldValue: 'active',
        newValue: 'invalid_moq',
        reason: validation.error || 'MOQ validation failed'
      });
    }
  }
  
  // 2. Fill missing identity data
  const needsIdentity = !offer.sellerOrgName || !offer.delegateFullName;
  if (needsIdentity) {
    const [updatedOffer] = seedMissingIdentities([offer]);
    
    if (!offer.sellerOrgName && updatedOffer.sellerOrgName) {
      changes.push({
        field: 'sellerOrgName',
        oldValue: offer.sellerOrgName || '',
        newValue: updatedOffer.sellerOrgName,
        reason: 'Generated synthetic company identity'
      });
    }
    
    if (!offer.delegateFullName && updatedOffer.delegateFullName) {
      changes.push({
        field: 'delegateFullName', 
        oldValue: offer.delegateFullName || '',
        newValue: updatedOffer.delegateFullName,
        reason: 'Generated synthetic delegate identity'
      });
    }
    
    // Copy all updated fields
    Object.assign(offer, updatedOffer);
  }
  
  return {
    offerId: offer.id,
    changes,
    valid: isValid
  };
}

function generateCSV(results: BackfillResult[]): string {
  const headers = ['Offer ID', 'Field', 'Old Value', 'New Value', 'Reason', 'Valid'];
  const rows = [headers.join(',')];
  
  for (const result of results) {
    if (result.changes.length === 0) {
      rows.push(`${result.offerId},NO_CHANGES,,,No changes needed,${result.valid}`);
    } else {
      for (const change of result.changes) {
        rows.push([
          result.offerId,
          change.field,
          `"${change.oldValue}"`,
          `"${change.newValue}"`,
          `"${change.reason}"`,
          result.valid
        ].join(','));
      }
    }
  }
  
  return rows.join('\n');
}

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const shouldApply = args.includes('--apply');
  
  if (!isDryRun && !shouldApply) {
    console.error('Usage: tsx scripts/backfill-moq-and-identities.ts [--dry-run | --apply]');
    console.error('  --dry-run: Show changes without applying them');
    console.error('  --apply: Apply changes to data');
    process.exit(1);
  }
  
  console.log(`🔍 Backfill MOQ and Identities ${isDryRun ? '(DRY RUN)' : '(APPLY)'}`);
  console.log(`Processing ${mockOffers.length} offers...`);
  
  const results: BackfillResult[] = [];
  const offersCopy = JSON.parse(JSON.stringify(mockOffers)); // Deep copy for dry run
  
  for (const offer of offersCopy) {
    const result = backfillOffer(offer);
    results.push(result);
  }
  
  // Generate summary
  const totalChanges = results.reduce((sum, r) => sum + r.changes.length, 0);
  const invalidOffers = results.filter(r => !r.valid).length;
  const validOffers = results.length - invalidOffers;
  
  console.log(`\n📊 Summary:`);
  console.log(`  Total offers processed: ${results.length}`);
  console.log(`  Total changes: ${totalChanges}`);
  console.log(`  Valid offers: ${validOffers}`);
  console.log(`  Invalid offers (will be hidden): ${invalidOffers}`);
  
  // Generate CSV report
  const csv = generateCSV(results);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const csvFilename = `backfill-report-${timestamp}.csv`;
  
  if (isDryRun) {
    // Save CSV report
    const outputPath = path.join(process.cwd(), 'scripts', csvFilename);
    fs.writeFileSync(outputPath, csv);
    console.log(`\n📄 Dry run report saved to: ${outputPath}`);
    
    // Show sample changes
    const changedResults = results.filter(r => r.changes.length > 0);
    if (changedResults.length > 0) {
      console.log(`\n🔧 Sample changes:`);
      changedResults.slice(0, 3).forEach(result => {
        console.log(`  ${result.offerId}:`);
        result.changes.forEach(change => {
          console.log(`    ${change.field}: ${change.oldValue} → ${change.newValue} (${change.reason})`);
        });
      });
    }
    
  } else {
    // Apply mode - would write to actual database
    console.log(`\n✅ Changes applied successfully`);
    
    // Save applied changes report
    const outputPath = path.join(process.cwd(), 'scripts', `applied-${csvFilename}`);
    fs.writeFileSync(outputPath, csv);
    console.log(`📄 Applied changes report saved to: ${outputPath}`);
    
    // TODO: In real implementation, update database here
    console.log(`\n⚠️  Note: This is a demo script. In production, this would:`);
    console.log(`    - Update offer records in the database`);
    console.log(`    - Mark invalid offers as hidden from public listings`);
    console.log(`    - Send notifications to offer owners about changes`);
  }
  
  console.log(`\n✨ Backfill completed`);
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}