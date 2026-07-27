import { useEffect } from 'react';

interface MetaTagsProps {
  title?: string;
  description?: string;
  keywords?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogUrl?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
  canonical?: string;
}

export function MetaTags({
  title = "TUTELA - Secure Physical Commodity Trading Platform",
  description = "Revolutionary commodity trading platform for Fuel & Hydrocarbons, Metals & Precious Metals, and Agricultural products. AI-powered verification, blockchain security, and seamless global trading.",
  keywords = "commodity trading, crude oil, gold trading, agricultural commodities, blockchain trading, KYB verification, physical commodities, futures contracts, TUTELA",
  ogTitle,
  ogDescription,
  ogImage = "/tutela-logo.png",
  ogUrl,
  twitterTitle,
  twitterDescription,
  twitterImage,
  canonical
}: MetaTagsProps) {
  
  useEffect(() => {
    // Update document title
    document.title = title;
    
    // Helper function to update or create meta tag
    const updateMetaTag = (selector: string, content: string) => {
      let element = document.querySelector(selector) as HTMLMetaElement;
      if (element) {
        element.content = content;
      } else {
        element = document.createElement('meta');
        if (selector.includes('property=')) {
          element.setAttribute('property', selector.match(/property="([^"]*)"/)![1]);
        } else {
          element.setAttribute('name', selector.match(/name="([^"]*)"/)![1]);
        }
        element.content = content;
        document.head.appendChild(element);
      }
    };

    // Update basic meta tags
    updateMetaTag('meta[name="title"]', title);
    updateMetaTag('meta[name="description"]', description);
    updateMetaTag('meta[name="keywords"]', keywords);
    
    // Update Open Graph tags
    updateMetaTag('meta[property="og:title"]', ogTitle || title);
    updateMetaTag('meta[property="og:description"]', ogDescription || description);
    updateMetaTag('meta[property="og:image"]', ogImage);
    if (ogUrl) {
      updateMetaTag('meta[property="og:url"]', ogUrl);
    }
    
    // Update Twitter tags
    updateMetaTag('meta[name="twitter:title"]', twitterTitle || ogTitle || title);
    updateMetaTag('meta[name="twitter:description"]', twitterDescription || ogDescription || description);
    updateMetaTag('meta[name="twitter:image"]', twitterImage || ogImage);
    
    // Update canonical URL if provided
    if (canonical) {
      let canonicalElement = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
      if (canonicalElement) {
        canonicalElement.href = canonical;
      } else {
        canonicalElement = document.createElement('link');
        canonicalElement.rel = 'canonical';
        canonicalElement.href = canonical;
        document.head.appendChild(canonicalElement);
      }
    }
  }, [title, description, keywords, ogTitle, ogDescription, ogImage, ogUrl, twitterTitle, twitterDescription, twitterImage, canonical]);
  
  return null; // This component doesn't render anything
}

// Predefined meta configurations for common pages
export const pageMetaConfigs = {
  home: {
    title: "TUTELA - Secure Physical Commodity Trading Platform",
    description: "Revolutionary commodity trading platform for Fuel & Hydrocarbons, Metals & Precious Metals, and Agricultural products. AI-powered verification, blockchain security, and seamless global trading.",
    keywords: "commodity trading, physical commodities, crude oil trading, gold trading, agricultural commodities, blockchain security, KYB verification",
    ogTitle: "TUTELA - Secure Physical Commodity Trading Platform",
    ogDescription: "Join the future of commodity trading with TUTELA's secure, AI-powered platform. Trade fuel, metals, and agricultural products with confidence."
  },
  
  pricing: {
    title: "Pricing Plans - TUTELA Commodity Trading Platform",
    description: "Choose the perfect TUTELA plan for your commodity trading needs. Freemium access, Professional features at $20/month, and Enterprise solutions. Start trading fuel, metals, and agricultural products today.",
    keywords: "TUTELA pricing, commodity trading pricing, trading platform cost, freemium trading, professional trading plan, enterprise commodities",
    ogTitle: "TUTELA Pricing - Affordable Commodity Trading Plans",
    ogDescription: "Transparent pricing for professional commodity trading. Start free or upgrade to Professional for $20/month. Enterprise solutions available."
  },
  
  howItWorks: {
    title: "How It Works - TUTELA Commodity Trading Platform",
    description: "Learn how TUTELA simplifies commodity trading with AI-powered verification, smart contracts, and secure partner networks. Discover our step-by-step trading process.",
    keywords: "how TUTELA works, commodity trading process, AI verification, smart contracts, blockchain trading, KYB process",
    ogTitle: "How TUTELA Works - Smart Commodity Trading Process",
    ogDescription: "Discover how our AI-powered platform revolutionizes commodity trading with secure verification, smart contracts, and trusted partner networks."
  },
  
  demo: {
    title: "Live Demo - TUTELA Commodity Trading Platform",
    description: "Experience TUTELA's commodity trading platform with our interactive demo. Explore real trading scenarios, AI verification, and smart contract features risk-free.",
    keywords: "TUTELA demo, commodity trading demo, platform demo, trading simulation, free trial",
    ogTitle: "Try TUTELA Demo - Interactive Commodity Trading Experience",
    ogDescription: "Test drive our commodity trading platform with realistic data. Experience AI verification, smart contracts, and secure trading workflows."
  },
  
  faq: {
    title: "FAQ - TUTELA Commodity Trading Platform",
    description: "Get answers to frequently asked questions about TUTELA's commodity trading platform, pricing, security, verification process, and supported commodities.",
    keywords: "TUTELA FAQ, commodity trading questions, platform help, trading support, KYB verification help",
    ogTitle: "TUTELA FAQ - Commodity Trading Platform Help",
    ogDescription: "Find answers to common questions about commodity trading, platform features, pricing, and getting started with TUTELA."
  }
};