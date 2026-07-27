import OpenAI from "openai";
import { storage } from "../storage";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generatePerformanceInsights(userId: string): Promise<any> {
  try {
    // Get user's trading data
    const [orders, offers, contracts, activity] = await Promise.all([
      storage.getOrders(userId),
      storage.getOffers(userId),
      storage.getContracts(userId),
      storage.getRecentActivity(userId, 50)
    ]);

    // Prepare data for AI analysis
    const tradingData = {
      totalOrders: orders.length,
      totalOffers: offers.length,
      totalContracts: contracts.length,
      recentActivity: activity.length,
      orderTypes: orders.reduce((acc: any, order) => {
        acc[order.type] = (acc[order.type] || 0) + 1;
        return acc;
      }, {}),
      commodityCategories: offers.reduce((acc: any, offer) => {
        const category = offer.commodity?.category || 'unknown';
        acc[category] = (acc[category] || 0) + 1;
        return acc;
      }, {}),
      contractStatuses: contracts.reduce((acc: any, contract) => {
        acc[contract.status] = (acc[contract.status] || 0) + 1;
        return acc;
      }, {})
    };

    // Generate insights using AI
    const prompt = `Analyze the following commodity trading data and generate performance insights:

Trading Data:
- Total Orders: ${tradingData.totalOrders}
- Total Offers: ${tradingData.totalOffers}
- Total Contracts: ${tradingData.totalContracts}
- Recent Activity Events: ${tradingData.recentActivity}
- Order Types: ${JSON.stringify(tradingData.orderTypes)}
- Commodity Categories: ${JSON.stringify(tradingData.commodityCategories)}
- Contract Statuses: ${JSON.stringify(tradingData.contractStatuses)}

Generate a comprehensive performance insights report with:
1. Key performance trends
2. Risk factors and opportunities
3. Actionable recommendations
4. Market analysis insights

Format the response as JSON with the following structure:
{
  "summary": {
    "totalTrades": number,
    "totalVolume": "string",
    "successRate": number,
    "riskScore": number
  },
  "insights": [
    {
      "id": "string",
      "type": "trend|opportunity|risk|recommendation",
      "title": "string",
      "description": "string",
      "impact": "high|medium|low",
      "confidence": number,
      "category": "string",
      "actionable": boolean,
      "metric": {
        "value": "string|number",
        "change": number,
        "unit": "string"
      }
    }
  ],
  "recommendations": ["string"],
  "riskFactors": ["string"],
  "opportunities": ["string"]
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are a commodity trading analytics expert. Analyze trading data and provide actionable insights in JSON format."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7
    });

    const insights = JSON.parse(response.choices[0].message.content || "{}");
    
    return {
      id: Date.now().toString(),
      generatedAt: new Date().toISOString(),
      ...insights
    };

  } catch (error) {
    console.error("Error generating insights:", error);
    
    // Fallback to basic insights if AI fails
    return storage.getLatestInsightsReport(userId);
  }
}