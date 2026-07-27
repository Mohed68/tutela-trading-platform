#!/usr/bin/env tsx

/**
 * Admin script to audit and fix offers missing minOrderQty
 * Usage: npm run script:audit-min-order
 */

import { db } from "../server/db";
import { offers } from "../shared/schema";
import { eq, isNull, or, lte, gte } from "drizzle-orm";

interface OfferAuditResult {
  id: string;
  commodityName?: string;
  quantity: number;
  minOrderQty?: number;
  sellerOrgName?: string;
  delegateFullName?: string;
  status: string;
  issue: string;
}

async function auditMinOrderQuantity() {
  console.log("🔍 Auditing offers for Min Order Quantity issues...\n");

  try {
    // Find all offers
    const allOffers = await db.select().from(offers);
    
    const issues: OfferAuditResult[] = [];
    
    for (const offer of allOffers) {
      const auditResult: OfferAuditResult = {
        id: offer.id,
        quantity: parseFloat(offer.quantity?.toString() || '0'),
        minOrderQty: offer.minOrderQty ? parseFloat(offer.minOrderQty.toString()) : undefined,
        sellerOrgName: offer.sellerOrgName || undefined,
        delegateFullName: offer.delegateFullName || undefined,
        status: offer.status || 'unknown',
        issue: ''
      };

      // Check for various issues
      const issuesList: string[] = [];

      if (!offer.minOrderQty || parseFloat(offer.minOrderQty.toString()) <= 0) {
        issuesList.push('Missing or invalid minOrderQty');
      }

      if (offer.minOrderQty && offer.quantity && parseFloat(offer.minOrderQty.toString()) > parseFloat(offer.quantity.toString())) {
        issuesList.push('MinOrderQty > Available Quantity');
      }

      if (!offer.sellerOrgName) {
        issuesList.push('Missing seller organization name');
      }

      if (!offer.delegateFullName) {
        issuesList.push('Missing delegate full name');
      }

      if (offer.delegateIsAuthorized === false) {
        issuesList.push('Delegate not authorized');
      }

      if (issuesList.length > 0) {
        auditResult.issue = issuesList.join(', ');
        issues.push(auditResult);
      }
    }

    console.log(`📊 Audit Results:`);
    console.log(`Total offers: ${allOffers.length}`);
    console.log(`Offers with issues: ${issues.length}`);
    console.log(`Offers without issues: ${allOffers.length - issues.length}`);
    
    if (issues.length > 0) {
      console.log(`\n❌ Offers requiring attention:`);
      console.log('ID\t\tQuantity\tMinOrder\tCompany\t\tDelegate\t\tIssues');
      console.log('─'.repeat(120));
      
      issues.forEach(issue => {
        const id = issue.id.substring(0, 8);
        const qty = issue.quantity.toString();
        const minQty = issue.minOrderQty?.toString() || 'NULL';
        const company = (issue.sellerOrgName || 'NULL').substring(0, 15);
        const delegate = (issue.delegateFullName || 'NULL').substring(0, 15);
        const issueText = issue.issue.substring(0, 40);
        
        console.log(`${id}\t\t${qty}\t\t${minQty}\t\t${company}\t\t${delegate}\t\t${issueText}`);
      });

      // Export CSV for ops review
      const csvHeaders = 'ID,Quantity,MinOrderQty,SellerOrgName,DelegateFullName,Status,Issues\n';
      const csvRows = issues.map(issue => 
        `${issue.id},${issue.quantity},${issue.minOrderQty || ''},${issue.sellerOrgName || ''},${issue.delegateFullName || ''},${issue.status},"${issue.issue}"`
      ).join('\n');
      
      const csvContent = csvHeaders + csvRows;
      
      // Write to file
      const fs = await import('fs/promises');
      const fileName = `offer-audit-${new Date().toISOString().split('T')[0]}.csv`;
      await fs.writeFile(fileName, csvContent);
      
      console.log(`\n📄 Detailed report exported to: ${fileName}`);
      console.log(`\n⚠️  These offers should be hidden from public listing until corrected.`);
      console.log(`\n💡 Next steps:`);
      console.log(`1. Review the CSV file`);
      console.log(`2. Use the admin panel to fix missing data`);
      console.log(`3. Run this script again to verify fixes`);
    } else {
      console.log(`\n✅ All offers have valid Min Order Quantity and required fields!`);
    }

  } catch (error) {
    console.error('❌ Error during audit:', error);
    process.exit(1);
  }
}

// Run the audit
auditMinOrderQuantity()
  .then(() => {
    console.log('\n🎉 Audit completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Audit failed:', error);
    process.exit(1);
  });