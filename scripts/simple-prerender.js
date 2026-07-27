#!/usr/bin/env node

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';

const PRERENDER_ROUTES = [
  { 
    path: '/', 
    title: 'TUTELA - Secure Commodity Trading Platform', 
    description: 'Professional commodity trading platform with AI-powered verification and secure blockchain contracts.',
    keywords: 'commodity trading, blockchain, verification, KYB, TUTELA, fuel, metals, agriculture'
  },
  { 
    path: '/pricing', 
    title: 'Pricing Plans - TUTELA', 
    description: 'Choose the perfect plan for your commodity trading needs. Freemium, Professional, and Enterprise options available.',
    keywords: 'pricing, plans, freemium, professional, enterprise, commodity trading'
  },
  { 
    path: '/how-it-works', 
    title: 'How TUTELA Works - Platform Guide', 
    description: 'Learn how our secure commodity trading platform streamlines verification, contracts, and payments.',
    keywords: 'how it works, platform guide, verification, contracts, payments, KYB'
  },
  { 
    path: '/faq', 
    title: 'Frequently Asked Questions - TUTELA', 
    description: 'Find answers to common questions about commodity trading, verification, and platform features.',
    keywords: 'FAQ, questions, answers, help, support, commodity trading'
  },
  { 
    path: '/demo', 
    title: 'Live Demo - TUTELA Marketplace', 
    description: 'Explore our interactive demo marketplace with real commodity offers and trading simulations.',
    keywords: 'demo, marketplace, commodity offers, trading simulation, interactive'
  }
];

const OUTPUT_DIR = 'dist/public';

function generateStaticHTML(route) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${route.title}</title>
  
  <!-- SEO Meta Tags -->
  <meta name="description" content="${route.description}">
  <meta name="keywords" content="${route.keywords}">
  <meta name="author" content="TUTELA">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="https://tutela.com${route.path}">
  
  <!-- Open Graph -->
  <meta property="og:title" content="${route.title}">
  <meta property="og:description" content="${route.description}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://tutela.com${route.path}">
  <meta property="og:site_name" content="TUTELA">
  <meta property="og:image" content="https://tutela.com/tutela-logo.png">
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${route.title}">
  <meta name="twitter:description" content="${route.description}">
  <meta name="twitter:image" content="https://tutela.com/tutela-logo.png">
  
  <!-- Schema.org Structured Data -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "${route.title}",
    "description": "${route.description}",
    "url": "https://tutela.com${route.path}",
    "publisher": {
      "@type": "Organization",
      "name": "TUTELA",
      "logo": {
        "@type": "ImageObject",
        "url": "https://tutela.com/tutela-logo.png"
      }
    }
  }
  </script>
  
  <!-- Preload Critical Resources -->
  <link rel="preload" href="/assets/index.css" as="style">
  <link rel="preload" href="/assets/index.js" as="script">
  <link rel="dns-prefetch" href="//fonts.googleapis.com">
  
  <!-- Critical CSS -->
  <link rel="stylesheet" href="/assets/index.css">
  
  <!-- Favicon -->
  <link rel="icon" type="image/png" href="/tutela-logo.png">
</head>
<body>
  <!-- App Root -->
  <div id="root">
    <!-- SEO Fallback Content -->
    <header>
      <h1>TUTELA - Secure Commodity Trading Platform</h1>
      <nav>
        <a href="/">Home</a>
        <a href="/pricing">Pricing</a>
        <a href="/how-it-works">How It Works</a>
        <a href="/demo">Demo</a>
        <a href="/faq">FAQ</a>
      </nav>
    </header>
    
    <main>
      <h2>${route.title.split(' - ')[0]}</h2>
      <p>${route.description}</p>
      
      <!-- Loading State -->
      <div class="loading-container">
        <div class="loading-spinner"></div>
        <p>Loading TUTELA Platform...</p>
      </div>
    </main>
    
    <footer>
      <p>&copy; 2025 TUTELA. All rights reserved.</p>
    </footer>
  </div>
  
  <!-- Critical JavaScript -->
  <script type="module" src="/assets/index.js"></script>
  
  <!-- Analytics & Performance -->
  <script>
    // Performance monitoring
    window.addEventListener('load', function() {
      if ('performance' in window) {
        setTimeout(function() {
          const perfData = performance.getEntriesByType('navigation')[0];
          if (perfData) {
            console.log('Page Load Time:', perfData.loadEventEnd - perfData.fetchStart, 'ms');
          }
        }, 0);
      }
    });
  </script>
</body>
</html>`;
}

async function simplePrerender() {
  console.log('🚀 Generating static HTML files for SEO...');
  
  try {
    // Ensure output directory exists
    if (!existsSync(OUTPUT_DIR)) {
      mkdirSync(OUTPUT_DIR, { recursive: true });
    }
    
    for (const route of PRERENDER_ROUTES) {
      console.log(`  Generating: ${route.path}`);
      
      const html = generateStaticHTML(route);
      
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
    }
    
    console.log('✅ Static HTML generation complete!');
    console.log('📁 SEO-optimized files generated in dist/public/');
    console.log('🔍 Features: Meta tags, Open Graph, Twitter Cards, Schema.org');
    
  } catch (error) {
    console.error('❌ Static HTML generation failed:', error);
    process.exit(1);
  }
}

simplePrerender().catch(console.error);