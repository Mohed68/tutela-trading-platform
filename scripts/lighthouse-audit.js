#!/usr/bin/env node

import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import { writeFileSync } from 'fs';

const AUDIT_URLS = [
  { url: 'http://localhost:5000/', name: 'homepage' },
  { url: 'http://localhost:5000/pricing', name: 'pricing' },
  { url: 'http://localhost:5000/how-it-works', name: 'how-it-works' },
];

async function runLighthouseAudit() {
  console.log('🔍 Starting Lighthouse audit...');
  
  const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless'] });
  
  const results = [];
  
  try {
    for (const { url, name } of AUDIT_URLS) {
      console.log(`📊 Auditing: ${url}`);
      
      const runnerResult = await lighthouse(url, {
        port: chrome.port,
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
        settings: {
          formFactor: 'desktop',
          throttling: {
            rttMs: 40,
            throughputKbps: 10240,
            cpuSlowdownMultiplier: 1,
            requestLatencyMs: 0,
            downloadThroughputKbps: 0,
            uploadThroughputKbps: 0,
          },
          screenEmulation: {
            mobile: false,
            width: 1200,
            height: 800,
            deviceScaleFactor: 1,
            disabled: false,
          },
        },
      });
      
      const scores = {
        performance: Math.round(runnerResult.lhr.categories.performance.score * 100),
        accessibility: Math.round(runnerResult.lhr.categories.accessibility.score * 100),
        bestPractices: Math.round(runnerResult.lhr.categories['best-practices'].score * 100),
        seo: Math.round(runnerResult.lhr.categories.seo.score * 100),
      };
      
      results.push({
        name,
        url,
        scores,
        opportunities: runnerResult.lhr.audits,
      });
      
      console.log(`  Performance: ${scores.performance}/100`);
      console.log(`  Accessibility: ${scores.accessibility}/100`);
      console.log(`  Best Practices: ${scores.bestPractices}/100`);
      console.log(`  SEO: ${scores.seo}/100`);
      console.log('');
      
      // Save detailed report
      const reportHtml = runnerResult.report;
      writeFileSync(`lighthouse-${name}-report.html`, reportHtml);
    }
    
    // Generate summary report
    const summaryReport = generateSummaryReport(results);
    writeFileSync('lighthouse-summary.json', JSON.stringify(summaryReport, null, 2));
    
    console.log('✅ Lighthouse audit complete!');
    console.log('📊 Reports saved as lighthouse-*-report.html');
    console.log('📋 Summary saved as lighthouse-summary.json');
    
  } finally {
    await chrome.kill();
  }
}

function generateSummaryReport(results) {
  const summary = {
    timestamp: new Date().toISOString(),
    overall: {
      performance: Math.round(results.reduce((sum, r) => sum + r.scores.performance, 0) / results.length),
      accessibility: Math.round(results.reduce((sum, r) => sum + r.scores.accessibility, 0) / results.length),
      bestPractices: Math.round(results.reduce((sum, r) => sum + r.scores.bestPractices, 0) / results.length),
      seo: Math.round(results.reduce((sum, r) => sum + r.scores.seo, 0) / results.length),
    },
    pages: results.map(r => ({
      name: r.name,
      url: r.url,
      scores: r.scores,
    })),
    recommendations: [
      'Enable static HTML prerendering for better SEO',
      'Optimize images and use modern formats (WebP)',
      'Implement proper caching headers',
      'Minify CSS and JavaScript',
      'Use a CDN for static assets',
    ]
  };
  
  return summary;
}

runLighthouseAudit().catch(console.error);