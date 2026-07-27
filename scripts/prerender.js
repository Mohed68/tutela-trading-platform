#!/usr/bin/env node

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import puppeteer from 'puppeteer';

const PRERENDER_ROUTES = [
  { path: '/', title: 'TUTELA - Secure Commodity Trading Platform', description: 'Professional commodity trading platform with AI-powered verification and secure blockchain contracts.' },
  { path: '/pricing', title: 'Pricing Plans - TUTELA', description: 'Choose the perfect plan for your commodity trading needs. Freemium, Professional, and Enterprise options available.' },
  { path: '/how-it-works', title: 'How TUTELA Works - Platform Guide', description: 'Learn how our secure commodity trading platform streamlines verification, contracts, and payments.' },
  { path: '/faq', title: 'Frequently Asked Questions - TUTELA', description: 'Find answers to common questions about commodity trading, verification, and platform features.' },
  { path: '/demo', title: 'Live Demo - TUTELA Marketplace', description: 'Explore our interactive demo marketplace with real commodity offers and trading simulations.' }
];

const OUTPUT_DIR = 'dist/public';
const TIMEOUT = 30000;
const DEV_SERVER_URL = 'http://localhost:5000';

async function prerender() {
  console.log('🚀 Starting prerender process...');
  
  let browser;
  
  try {
    // Launch browser with Replit-compatible settings
    browser = await puppeteer.launch({
      headless: 'new',
      executablePath: '/nix/store/kn9az7kj8ka81rrirdfp8zzj9mzphrzl-chromium-139.0.7258.66/bin/chromium',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--run-all-compositor-stages-before-draw',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        '--disable-ipc-flooding-protection'
      ]
    });
    
    console.log('📄 Prerendering routes...');
    
    for (const route of PRERENDER_ROUTES) {
      try {
        console.log(`  Rendering: ${route.path}`);
        
        const page = await browser.newPage();
        
        // Set viewport for consistent rendering
        await page.setViewport({ width: 1200, height: 800 });
        
        // Navigate to route
        const url = `${DEV_SERVER_URL}${route.path}`;
        await page.goto(url, { 
          waitUntil: 'networkidle0',
          timeout: TIMEOUT 
        });
        
        // Wait for React hydration and content loading
        await page.waitForTimeout(3000);
        
        // Wait for specific content markers
        try {
          await page.waitForSelector('main, [role="main"], .app-content', { timeout: 5000 });
        } catch (e) {
          console.log(`    No main content selector found for ${route.path}, continuing...`);
        }
        
        // Get fully rendered HTML
        let html = await page.content();
        
        // Enhance SEO meta tags
        html = enhanceSEOMetaTags(html, route);
        
        // Determine output path
        const outputPath = route.path === '/' 
          ? resolve(OUTPUT_DIR, 'index.html')
          : resolve(OUTPUT_DIR, route.path.slice(1), 'index.html');
        
        // Ensure directory exists
        const dir = dirname(outputPath);
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }
        
        // Write HTML file
        writeFileSync(outputPath, html);
        console.log(`  ✅ Generated: ${outputPath}`);
        
        await page.close();
        
      } catch (error) {
        console.error(`  ❌ Failed to render ${route.path}:`, error.message);
      }
    }
    
    console.log('✅ Prerender complete!');
    console.log(`📁 Static files generated in ${OUTPUT_DIR}/`);
    
  } catch (error) {
    console.error('❌ Prerender failed:', error);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
  }
}

function enhanceSEOMetaTags(html, route) {
  // Base meta tags
  const metaTags = `
    <meta name="description" content="${route.description}">
    <meta name="keywords" content="commodity trading, blockchain, verification, KYB, TUTELA">
    <meta name="author" content="TUTELA">
    <meta name="robots" content="index, follow">
    
    <!-- Open Graph -->
    <meta property="og:title" content="${route.title}">
    <meta property="og:description" content="${route.description}">
    <meta property="og:type" content="website">
    <meta property="og:url" content="https://tutela.com${route.path}">
    <meta property="og:site_name" content="TUTELA">
    
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${route.title}">
    <meta name="twitter:description" content="${route.description}">
    
    <!-- Schema.org -->
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": "${route.title}",
      "description": "${route.description}",
      "url": "https://tutela.com${route.path}"
    }
    </script>
  `;
  
  // Update title
  html = html.replace(/<title>.*?<\/title>/i, `<title>${route.title}</title>`);
  
  // Inject meta tags after title
  html = html.replace('</title>', `</title>${metaTags}`);
  
  // Add preload hints for critical resources
  const preloadHints = `
    <link rel="preload" href="/assets/index.css" as="style">
    <link rel="preload" href="/assets/index.js" as="script">
    <link rel="dns-prefetch" href="//fonts.googleapis.com">
  `;
  
  html = html.replace('</head>', `${preloadHints}</head>`);
  
  return html;
}

prerender().catch(console.error);