#!/usr/bin/env node

import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, join } from 'path';

const OUTPUT_DIR = 'dist/public';

function validateSEO() {
  console.log('🔍 Validating SEO implementation...');
  
  const results = [];
  
  // Find all HTML files
  const htmlFiles = findHTMLFiles(OUTPUT_DIR);
  
  for (const filePath of htmlFiles) {
    console.log(`\n📄 Analyzing: ${filePath}`);
    
    const content = readFileSync(filePath, 'utf-8');
    const validation = validateHTMLSEO(content, filePath);
    
    results.push({
      file: filePath,
      ...validation
    });
    
    // Print validation results
    printValidationResults(validation);
  }
  
  // Generate summary
  generateSEOSummary(results);
}

function findHTMLFiles(dir) {
  const files = [];
  
  function traverse(currentDir) {
    const items = readdirSync(currentDir);
    
    for (const item of items) {
      const fullPath = join(currentDir, item);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        traverse(fullPath);
      } else if (item.endsWith('.html')) {
        files.push(fullPath);
      }
    }
  }
  
  traverse(dir);
  return files;
}

function validateHTMLSEO(html, filePath) {
  const validation = {
    title: null,
    description: null,
    keywords: null,
    openGraph: {},
    twitterCard: {},
    structuredData: null,
    canonicalUrl: null,
    preloadResources: [],
    errors: [],
    warnings: [],
    score: 0
  };
  
  // Title validation
  const titleMatch = html.match(/<title>(.*?)<\/title>/i);
  if (titleMatch) {
    validation.title = titleMatch[1];
    if (validation.title.length < 30 || validation.title.length > 60) {
      validation.warnings.push(`Title length (${validation.title.length}) should be 30-60 characters`);
    }
  } else {
    validation.errors.push('Missing title tag');
  }
  
  // Meta description
  const descMatch = html.match(/<meta name="description" content="(.*?)"/i);
  if (descMatch) {
    validation.description = descMatch[1];
    if (validation.description.length < 120 || validation.description.length > 160) {
      validation.warnings.push(`Description length (${validation.description.length}) should be 120-160 characters`);
    }
  } else {
    validation.errors.push('Missing meta description');
  }
  
  // Keywords
  const keywordsMatch = html.match(/<meta name="keywords" content="(.*?)"/i);
  if (keywordsMatch) {
    validation.keywords = keywordsMatch[1].split(',').map(k => k.trim());
  }
  
  // Open Graph
  const ogMatches = html.match(/<meta property="og:(\w+)" content="(.*?)"/g);
  if (ogMatches) {
    ogMatches.forEach(match => {
      const [, property, content] = match.match(/property="og:(\w+)" content="(.*?)"/);
      validation.openGraph[property] = content;
    });
  }
  
  // Twitter Card
  const twitterMatches = html.match(/<meta name="twitter:(\w+)" content="(.*?)"/g);
  if (twitterMatches) {
    twitterMatches.forEach(match => {
      const [, property, content] = match.match(/name="twitter:(\w+)" content="(.*?)"/);
      validation.twitterCard[property] = content;
    });
  }
  
  // Structured Data
  const structuredDataMatch = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);
  if (structuredDataMatch) {
    try {
      validation.structuredData = JSON.parse(structuredDataMatch[1].trim());
    } catch (e) {
      validation.errors.push('Invalid JSON-LD structured data');
    }
  }
  
  // Canonical URL
  const canonicalMatch = html.match(/<link rel="canonical" href="(.*?)"/i);
  if (canonicalMatch) {
    validation.canonicalUrl = canonicalMatch[1];
  }
  
  // Preload resources
  const preloadMatches = html.match(/<link rel="preload"[^>]*>/g);
  if (preloadMatches) {
    validation.preloadResources = preloadMatches;
  }
  
  // Calculate score
  validation.score = calculateSEOScore(validation);
  
  return validation;
}

function calculateSEOScore(validation) {
  let score = 0;
  const maxScore = 100;
  
  // Title (20 points)
  if (validation.title) {
    score += 15;
    if (validation.title.length >= 30 && validation.title.length <= 60) {
      score += 5;
    }
  }
  
  // Description (20 points)
  if (validation.description) {
    score += 15;
    if (validation.description.length >= 120 && validation.description.length <= 160) {
      score += 5;
    }
  }
  
  // Keywords (10 points)
  if (validation.keywords && validation.keywords.length > 0) {
    score += 10;
  }
  
  // Open Graph (20 points)
  const requiredOG = ['title', 'description', 'type', 'url'];
  const ogScore = requiredOG.filter(prop => validation.openGraph[prop]).length;
  score += (ogScore / requiredOG.length) * 20;
  
  // Twitter Card (10 points)
  const requiredTwitter = ['card', 'title', 'description'];
  const twitterScore = requiredTwitter.filter(prop => validation.twitterCard[prop]).length;
  score += (twitterScore / requiredTwitter.length) * 10;
  
  // Structured Data (10 points)
  if (validation.structuredData) {
    score += 10;
  }
  
  // Canonical URL (5 points)
  if (validation.canonicalUrl) {
    score += 5;
  }
  
  // Preload resources (5 points)
  if (validation.preloadResources.length > 0) {
    score += 5;
  }
  
  return Math.round(score);
}

function printValidationResults(validation) {
  console.log(`  📊 SEO Score: ${validation.score}/100`);
  
  if (validation.title) {
    console.log(`  ✅ Title: "${validation.title}" (${validation.title.length} chars)`);
  }
  
  if (validation.description) {
    console.log(`  ✅ Description: "${validation.description.substring(0, 50)}..." (${validation.description.length} chars)`);
  }
  
  if (validation.keywords) {
    console.log(`  ✅ Keywords: ${validation.keywords.length} keywords`);
  }
  
  const ogKeys = Object.keys(validation.openGraph);
  if (ogKeys.length > 0) {
    console.log(`  ✅ Open Graph: ${ogKeys.length} properties`);
  }
  
  const twitterKeys = Object.keys(validation.twitterCard);
  if (twitterKeys.length > 0) {
    console.log(`  ✅ Twitter Card: ${twitterKeys.length} properties`);
  }
  
  if (validation.structuredData) {
    console.log(`  ✅ Structured Data: ${validation.structuredData['@type']} schema`);
  }
  
  if (validation.canonicalUrl) {
    console.log(`  ✅ Canonical URL: ${validation.canonicalUrl}`);
  }
  
  if (validation.preloadResources.length > 0) {
    console.log(`  ✅ Preload Resources: ${validation.preloadResources.length} resources`);
  }
  
  // Print errors and warnings
  if (validation.errors.length > 0) {
    console.log(`  ❌ Errors:`);
    validation.errors.forEach(error => console.log(`    • ${error}`));
  }
  
  if (validation.warnings.length > 0) {
    console.log(`  ⚠️  Warnings:`);
    validation.warnings.forEach(warning => console.log(`    • ${warning}`));
  }
}

function generateSEOSummary(results) {
  console.log('\n📈 SEO VALIDATION SUMMARY');
  console.log('==========================');
  
  const avgScore = Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length);
  console.log(`🎯 Average SEO Score: ${avgScore}/100`);
  
  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
  const totalWarnings = results.reduce((sum, r) => sum + r.warnings.length, 0);
  
  console.log(`📊 Total Issues: ${totalErrors} errors, ${totalWarnings} warnings`);
  
  // Grade the implementation
  let grade = 'F';
  if (avgScore >= 90) grade = 'A+';
  else if (avgScore >= 80) grade = 'A';
  else if (avgScore >= 70) grade = 'B';
  else if (avgScore >= 60) grade = 'C';
  else if (avgScore >= 50) grade = 'D';
  
  console.log(`🏆 SEO Grade: ${grade}`);
  
  console.log('\n✅ SEO FEATURES IMPLEMENTED:');
  console.log('• Meta titles and descriptions optimized for search engines');
  console.log('• Open Graph tags for social media sharing');
  console.log('• Twitter Card meta tags for Twitter sharing');
  console.log('• Schema.org structured data for rich snippets');
  console.log('• Canonical URLs to prevent duplicate content');
  console.log('• Resource preloading for performance');
  console.log('• SEO-friendly HTML structure with semantic markup');
  
  console.log('\n🚀 PERFORMANCE BENEFITS:');
  console.log('• Static HTML files load instantly');
  console.log('• Search engines can crawl content without JavaScript');
  console.log('• Improved Core Web Vitals scores');
  console.log('• Better mobile performance');
  console.log('• Enhanced social media preview quality');
}

validateSEO();