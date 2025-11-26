import OpenAI from "openai";

const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
const openai = hasOpenAIKey
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
  : null;

export interface DocumentValidationResult {
  isValid: boolean;
  confidence: number;
  extractedData: Record<string, any>;
  issues: string[];
  recommendations: string[];
}

export async function validateDocument(
  filePath: string,
  documentType: string
): Promise<DocumentValidationResult> {
  const fallbackResult: DocumentValidationResult = {
    isValid: false,
    confidence: 0,
    extractedData: { documentType, filePath },
    issues: [],
    recommendations: [],
  };

  if (!hasOpenAIKey || !openai) {
    console.warn(
      "OPENAI_API_KEY is not set; using fallback document validation result."
    );
    return {
      ...fallbackResult,
      issues: ["AI validation key not configured"],
      recommendations: [
        "Configure OPENAI_API_KEY to enable automated document analysis.",
      ],
    };
  }

  try {
    const validationPrompt = `
      Analyze this ${documentType} document for authenticity and completeness.

      Please provide a JSON response with the following structure:
      {
        "isValid": boolean,
        "confidence": number (0-1),
        "extractedData": {
          "companyName": "string",
          "documentNumber": "string",
          "issueDate": "string",
          "expiryDate": "string",
          "signatories": ["string"]
        },
        "issues": ["string"],
        "recommendations": ["string"]
      }

      Respond ONLY with valid JSON.
    `;

    // TODO: في النسخة الحالية لا نستخدم filePath فعليًا
    // لاحقًا يمكن إضافة OCR / قراءة ملف وضمّه للـ prompt.

    const response = await openai.responses.create({
      model: "gpt-4o",
      input: validationPrompt,
    });

    const text =
      (response.output[0]?.content[0] as any)?.text?.value ??
      JSON.stringify(fallbackResult);

    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      console.warn("Failed to parse AI JSON; falling back.");
      return {
        ...fallbackResult,
        issues: ["AI response could not be parsed"],
        recommendations: [
          "Please try again or contact support if the issue persists.",
        ],
      };
    }

    const enhancedResult: DocumentValidationResult = {
      isValid: !!parsed.isValid,
      confidence:
        typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
      extractedData: parsed.extractedData ?? { documentType },
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      recommendations: Array.isArray(parsed.recommendations)
        ? parsed.recommendations
        : [],
    };

    // Document-type specific tweaks
    if (documentType === "business_license") {
      enhancedResult.extractedData.documentType = "Business License";
      if (!enhancedResult.extractedData.documentNumber) {
        enhancedResult.issues.push("License/document number not found");
        enhancedResult.confidence *= 0.8;
      }
    } else if (documentType === "financial_statement") {
      enhancedResult.extractedData.documentType = "Financial Statement";
      if (!enhancedResult.extractedData.auditFirm) {
        enhancedResult.recommendations.push(
          "Consider providing audited financial statements."
        );
      }
    } else if (documentType === "tax_certificate") {
      enhancedResult.extractedData.documentType = "Tax Certificate";
      if (!enhancedResult.extractedData.taxId) {
        enhancedResult.issues.push("Tax ID not clearly visible");
        enhancedResult.confidence *= 0.7;
      }
    }

    return enhancedResult;
  } catch (error) {
    console.error("AI validation error:", error);
    return {
      ...fallbackResult,
      issues: ["AI validation service temporarily unavailable"],
      recommendations: [
        "Please try uploading the document again or contact support.",
      ],
    };
  }
}

export async function analyzeCommodityMarket(
  commodityType: string,
  quantity: number,
  location: string
): Promise<{
  marketPrice: number;
  priceRange: { min: number; max: number };
  marketTrend: "up" | "down" | "stable";
  recommendations: string[];
}> {
  // Fallback logic if no key
  if (!hasOpenAIKey || !openai) {
    const normalizedType = commodityType.toLowerCase();
    let basePrice = 100;

    if (normalizedType.includes("diesel") || normalizedType.includes("en590")) {
      basePrice = 650;
    } else if (normalizedType.includes("crude")) {
      basePrice = 80;
    } else if (normalizedType.includes("gold")) {
      basePrice = 2300;
    } else if (normalizedType.includes("wheat")) {
      basePrice = 320;
    }

    const trend: "up" | "down" | "stable" =
      quantity > 100000 ? "up" : quantity < 1000 ? "down" : "stable";

    const volatilityFactor =
      trend === "up" ? 0.12 : trend === "down" ? 0.08 : 0.05;

    const marketPrice = basePrice;
    const priceRange = {
      min: Math.round(basePrice * (1 - volatilityFactor)),
      max: Math.round(basePrice * (1 + volatilityFactor)),
    };

    const recommendations: string[] = [
      `Demo analysis for ${commodityType} in ${location}.`,
      "Configure OPENAI_API_KEY to enable AI-powered market analysis.",
    ];

    return {
      marketPrice,
      priceRange,
      marketTrend: trend,
      recommendations,
    };
  }

  try {
    const analysisPrompt = `
      Analyze the current market conditions for ${commodityType} in ${location}.
      Quantity: ${quantity} units.

      Provide a JSON response with:
      {
        "marketPrice": number,
        "priceRange": { "min": number, "max": number },
        "marketTrend": "up" | "down" | "stable",
        "recommendations": ["string"]
      }

      Respond ONLY with valid JSON.
    `;

    const response = await openai.responses.create({
      model: "gpt-4o",
      input: analysisPrompt,
    });

    const text =
      (response.output[0]?.content[0] as any)?.text?.value ??
      JSON.stringify({
        marketPrice: 0,
        priceRange: { min: 0, max: 0 },
        marketTrend: "stable",
        recommendations: [],
      });

    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      console.warn("Failed to parse AI market JSON; using fallback heuristic.");
      // نعيد استخدام fallback البسيط أعلاه
      return analyzeCommodityMarket(commodityType, quantity, location);
    }

    return {
      marketPrice:
        typeof parsed.marketPrice === "number" ? parsed.marketPrice : 0,
      priceRange: parsed.priceRange ?? { min: 0, max: 0 },
      marketTrend:
        parsed.marketTrend === "up" ||
        parsed.marketTrend === "down" ||
        parsed.marketTrend === "stable"
          ? parsed.marketTrend
          : "stable",
      recommendations: Array.isArray(parsed.recommendations)
        ? parsed.recommendations
        : [],
    };
  } catch (error) {
    console.error("AI market analysis error:", error);
    // في حالة فشل OpenAI نرجع إلى fallback البسيط
    return analyzeCommodityMarket(commodityType, quantity, location);
  }
}
