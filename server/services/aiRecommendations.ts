// AI Recommendations Service
import { storage } from "../storage";
import { getOpenAIClient } from "./openaiClient";

export interface PersonalizedRecommendation {
  id: string;
  type: "offer_match" | "market_opportunity" | "price_alert" | "strategy" | "partner";
  title: string;
  description: string;
  confidence: number; // 0-1
  actionable: boolean;
  cta?: string; // Call to action text
  ctaUrl?: string; // Call to action URL
  metadata?: Record<string, any>;
  priority: "high" | "medium" | "low";
  category: string;
}

export interface UserProfile {
  userId: string;
  tradingHistory: Array<{
    commodityType: string;
    preferredUnit: string;
    avgVolume: number;
    priceRange: { min: number; max: number };
  }>;
  preferences: {
    commodities: string[];
    regions: string[];
    riskTolerance: "low" | "medium" | "high";
  };
  currentOffers: Array<{
    type: "buy" | "sell";
    commodity: string;
    quantity: number;
    pricePerUnit: number;
  }>;
}

/**
 * Generate personalized recommendations using OpenAI GPT-5
 */
export async function generatePersonalizedRecommendations(
  userId: string
): Promise<PersonalizedRecommendation[]> {
  try {
    // Get user profile data
    const userProfile = await buildUserProfile(userId);
    
    // Get market context
    const marketContext = await getMarketContext();
    
    // Generate recommendations using GPT-5
    const prompt = `
You are an AI commodities trading advisor for TUTELA platform. Analyze the user profile and current market conditions to provide personalized trading recommendations.

User Profile:
${JSON.stringify(userProfile, null, 2)}

Market Context:
${JSON.stringify(marketContext, null, 2)}

Generate 3-5 personalized recommendations focusing on:
1. Specific trading opportunities based on user's history
2. Market trends relevant to their commodities
3. Risk management suggestions
4. Partnership opportunities
5. Price optimization strategies

Respond with JSON in this exact format:
{
  "recommendations": [
    {
      "id": "unique_id",
      "type": "offer_match|market_opportunity|price_alert|strategy|partner",
      "title": "Short recommendation title",
      "description": "Detailed explanation with specific data points",
      "confidence": 0.85,
      "actionable": true,
      "cta": "Action text",
      "ctaUrl": "/marketplace?filter=crude",
      "priority": "high|medium|low",
      "category": "Trading|Market Analysis|Risk Management|Partnerships"
    }
  ]
}
    `;

    const response = await getOpenAIClient().chat.completions.create({
      model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are an expert commodities trading advisor. Provide actionable, data-driven recommendations in JSON format only."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 2000
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    return result.recommendations || [];

  } catch (error) {
    console.error("Error generating AI recommendations:", error);
    
    // Fallback to rule-based recommendations
    return generateFallbackRecommendations(userId);
  }
}

/**
 * Build comprehensive user profile for recommendations
 */
async function buildUserProfile(userId: string): Promise<UserProfile> {
  const user = await storage.getUser(userId);
  const allOffers = await storage.getOffers();
  const allContracts = await storage.getContracts(userId);
  
  // Filter user's data
  const userOffers = allOffers.filter(offer => offer.userId === userId);
  const userContracts = allContracts.filter(contract => contract.buyerId === userId || contract.sellerId === userId);
  
  // Analyze trading history
  const tradingHistory = analyzeTradingHistory(userOffers, userContracts);
  
  // Extract preferences
  const preferences = extractUserPreferences(userOffers, user);
  
  // Get current active offers
  const currentOffers = userOffers
    .filter((offer: any) => offer.status === 'active')
    .map((offer: any) => ({
      type: offer.type,
      commodity: offer.commodity?.name || '',
      quantity: offer.quantity,
      pricePerUnit: offer.pricePerUnit
    }));

  return {
    userId,
    tradingHistory,
    preferences,
    currentOffers
  };
}

/**
 * Get current market context for recommendations
 */
async function getMarketContext() {
  const offers = await storage.getOffers();
  const commodities = await storage.getCommodities();
  
  // Calculate market metrics
  const marketVolume = offers.reduce((sum: number, offer: any) => sum + (offer.quantity * offer.pricePerUnit), 0);
  const avgPrices = calculateAveragePrices(offers);
  const trendingCommodities = getTrendingCommodities(offers);
  
  return {
    totalMarketVolume: marketVolume,
    averagePrices: avgPrices,
    trendingCommodities,
    totalActiveOffers: offers.length,
    verifiedTraders: offers.filter(o => o.sellerOrgVerified).length
  };
}

/**
 * Analyze user's trading patterns
 */
function analyzeTradingHistory(offers: any[], contracts: any[]) {
  const commodityStats = new Map();
  
  [...offers, ...contracts].forEach(item => {
    const commodity = item.commodity?.name || item.commodityType;
    if (!commodity) return;
    
    if (!commodityStats.has(commodity)) {
      commodityStats.set(commodity, {
        commodityType: commodity,
        preferredUnit: item.unit || 'MT',
        volumes: [],
        prices: []
      });
    }
    
    const stats = commodityStats.get(commodity);
    stats.volumes.push(item.quantity || 0);
    stats.prices.push(item.pricePerUnit || 0);
  });
  
  return Array.from(commodityStats.values()).map((stats: any) => ({
    commodityType: stats.commodityType,
    preferredUnit: stats.preferredUnit,
    avgVolume: stats.volumes.reduce((a: number, b: number) => a + b, 0) / stats.volumes.length,
    priceRange: {
      min: Math.min(...stats.prices),
      max: Math.max(...stats.prices)
    }
  }));
}

/**
 * Extract user preferences from trading behavior
 */
function extractUserPreferences(offers: any[], user: any) {
  const commodities = [...new Set(offers.map(o => o.commodity?.name).filter(Boolean))];
  const regions = [...new Set(offers.map(o => o.location).filter(Boolean))];
  
  // Determine risk tolerance based on trading patterns
  const avgOrderSize = offers.length > 0 ? offers.reduce((sum: number, o: any) => sum + (o.quantity * o.pricePerUnit), 0) / offers.length : 0;
  const riskTolerance: "high" | "medium" | "low" = avgOrderSize > 1000000 ? "high" : avgOrderSize > 100000 ? "medium" : "low";
  
  return {
    commodities,
    regions,
    riskTolerance
  };
}

/**
 * Calculate average prices by commodity
 */
function calculateAveragePrices(offers: any[]) {
  const priceMap = new Map();
  
  offers.forEach((offer: any) => {
    const commodity = offer.commodity?.name;
    if (!commodity) return;
    
    if (!priceMap.has(commodity)) {
      priceMap.set(commodity, []);
    }
    priceMap.get(commodity).push(offer.pricePerUnit);
  });
  
  const result: Record<string, number> = {};
  priceMap.forEach((prices: number[], commodity: string) => {
    result[commodity] = prices.reduce((a: number, b: number) => a + b, 0) / prices.length;
  });
  
  return result;
}

/**
 * Identify trending commodities
 */
function getTrendingCommodities(offers: any[]) {
  const commodityCounts = new Map();
  
  offers.forEach((offer: any) => {
    const commodity = offer.commodity?.name;
    if (!commodity) return;
    
    commodityCounts.set(commodity, (commodityCounts.get(commodity) || 0) + 1);
  });
  
  return Array.from(commodityCounts.entries())
    .sort(([,a], [,b]) => (b as number) - (a as number))
    .slice(0, 5)
    .map(([commodity, count]) => ({ commodity, offerCount: count }));
}

/**
 * Fallback recommendations when AI fails
 */
async function generateFallbackRecommendations(userId: string): Promise<PersonalizedRecommendation[]> {
  return [
    {
      id: "fallback_1",
      type: "market_opportunity",
      title: "Explore High-Volume Commodities",
      description: "Based on current market activity, crude oil and gold are showing strong trading volumes. Consider diversifying your portfolio.",
      confidence: 0.7,
      actionable: true,
      cta: "Browse Marketplace",
      ctaUrl: "/marketplace",
      priority: "medium",
      category: "Market Analysis"
    },
    {
      id: "fallback_2", 
      type: "strategy",
      title: "Complete KYB Verification",
      description: "Verified traders receive 3x more partnership requests. Complete your KYB verification to unlock premium features.",
      confidence: 0.9,
      actionable: true,
      cta: "Start Verification",
      ctaUrl: "/verification",
      priority: "high",
      category: "Strategy"
    }
  ];
}
