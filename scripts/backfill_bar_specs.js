/**
 * Backfill Bar Specifications for Metals Offers
 * 
 * This script identifies gold/silver offers with legacy unit formatting like "(1000oz)" or "1000 oz bar"
 * and updates them with proper barSpec metadata while cleaning up the text.
 */
import { db } from '../server/db.js';
import { offers } from '../shared/schema.js';
import { eq, and, or, like } from 'drizzle-orm';

// Extract bar spec from legacy text like "(1000oz)" or "1000 oz bar"
function extractBarSpec(text, metal) {
  if (!text) return null;
  
  const ozMatch = text.match(/\(?(\d+)\s*oz\)?/i);
  if (ozMatch) {
    const ozValue = parseInt(ozMatch[1], 10);
    return {
      metal,
      label: `${ozValue} oz bar`,
      weight: { unit: 'troy_ounce', value: ozValue }
    };
  }
  return null;
}

// Clean text by removing bar weight references
function cleanText(text) {
  if (!text) return text;
  return text.replace(/\s*\(\d+\s*oz\)\s*/gi, '').replace(/\s+/g, ' ').trim();
}

async function backfillBarSpecs() {
  console.log('🔍 Starting bar specification backfill...');
  
  try {
    // Find offers that might need bar spec backfill
    const candidateOffers = await db
      .select()
      .from(offers)
      .where(
        and(
          eq(offers.unit, 'bar'),
          or(
            like(offers.specifications, '%oz%'),
            like(offers.deliveryTerms, '%oz%'),
            like(offers.paymentTerms, '%oz%')
          )
        )
      );

    console.log(`📊 Found ${candidateOffers.length} candidate offers for backfill`);

    let updatedCount = 0;

    for (const offer of candidateOffers) {
      // Determine metal type from commodity name/specifications
      const isGold = /gold/i.test(offer.specifications || '');
      const isSilver = /silver/i.test(offer.specifications || '');
      
      if (!isGold && !isSilver) {
        console.log(`⚠️  Skipping offer ${offer.id} - cannot determine metal type`);
        continue;
      }

      const metal = isGold ? 'gold' : 'silver';
      
      // Check specifications field for bar weight
      const barSpec = extractBarSpec(offer.specifications, metal);
      
      if (barSpec) {
        // Update offer with bar specification and clean the text
        await db
          .update(offers)
          .set({
            barSpec: barSpec,
            specifications: cleanText(offer.specifications)
          })
          .where(eq(offers.id, offer.id));
        
        updatedCount++;
        console.log(`✅ Updated offer ${offer.id}: ${metal} ${barSpec.label}`);
      }
    }

    console.log(`🎉 Backfill completed! Updated ${updatedCount} offers with bar specifications`);
    
  } catch (error) {
    console.error('❌ Error during backfill:', error);
    throw error;
  }
}

// Run the backfill if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  backfillBarSpecs()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { backfillBarSpecs };