import { getOpenAIClient } from "./openaiClient";

export interface DocumentValidationResult {
  isValid: boolean;
  confidence: number;
  extractedData: Record<string, any>;
  issues: string[];
  recommendations: string[];
}

export async function validateDocument(filePath: string, documentType: string): Promise<DocumentValidationResult> {
  try {
    // For demo purposes, we'll simulate document validation
    // In a real implementation, you would:
    // 1. Convert the document to base64 if it's an image
    // 2. Use OCR to extract text from PDFs
    // 3. Send the content to OpenAI for analysis

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
      
      Focus on:
      - Document format and structure
      - Presence of required fields
      - Date validity
      - Professional appearance
      - Potential fraud indicators
    `;

    const response = await getOpenAIClient().chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert document validator specializing in business and trading documents. Analyze documents for authenticity, completeness, and compliance."
        },
        {
          role: "user",
          content: validationPrompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    // Add some realistic validation logic based on document type
    const enhancedResult: DocumentValidationResult = {
      isValid: result.isValid ?? true,
      confidence: result.confidence ?? 0.85,
      extractedData: result.extractedData ?? {},
      issues: result.issues ?? [],
      recommendations: result.recommendations ?? []
    };

    // Add document-type specific validation
    if (documentType === "business_license") {
      enhancedResult.extractedData.documentType = "Business License";
      if (!enhancedResult.extractedData.licenseNumber) {
        enhancedResult.issues.push("License number not found");
        enhancedResult.confidence *= 0.8;
      }
    } else if (documentType === "financial_statement") {
      enhancedResult.extractedData.documentType = "Financial Statement";
      if (!enhancedResult.extractedData.auditFirm) {
        enhancedResult.recommendations.push("Consider providing audited financial statements");
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
    
    // Return a safe fallback result
    return {
      isValid: false,
      confidence: 0.0,
      extractedData: { documentType },
      issues: ["AI validation service temporarily unavailable"],
      recommendations: ["Please try uploading the document again or contact support"]
    };
  }
}

export async function analyzeCommodityMarket(commodityType: string, quantity: number, location: string): Promise<{
  marketPrice: number;
  priceRange: { min: number; max: number };
  marketTrend: "up" | "down" | "stable";
  recommendations: string[];
}> {
  try {
    const analysisPrompt = `
      Analyze the current market conditions for ${commodityType} in ${location}.
      Quantity: ${quantity} units
      
      Provide a JSON response with:
      {
        "marketPrice": number,
        "priceRange": { "min": number, "max": number },
        "marketTrend": "up" | "down" | "stable",
        "recommendations": ["string"]
      }
      
      Consider current market conditions, seasonal factors, and regional pricing.
    `;

    const response = await getOpenAIClient().chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a commodity market analyst with expertise in global trading patterns and price forecasting."
        },
        {
          role: "user",
          content: analysisPrompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    return result;
  } catch (error) {
    console.error("Market analysis error:", error);
    
    // Return conservative estimates
    return {
      marketPrice: 0,
      priceRange: { min: 0, max: 0 },
      marketTrend: "stable",
      recommendations: ["Market analysis service temporarily unavailable"]
    };
  }
}

export async function validatePartnerCredentials(partnerData: {
  companyName: string;
  businessType: string;
  location: string;
  yearsInBusiness: number;
}): Promise<{
  riskScore: number;
  creditRating: string;
  verificationStatus: string;
  riskFactors: string[];
  strengths: string[];
}> {
  try {
    const validationPrompt = `
      Assess the business credentials and risk profile for this trading partner:
      
      Company: ${partnerData.companyName}
      Business Type: ${partnerData.businessType}
      Location: ${partnerData.location}
      Years in Business: ${partnerData.yearsInBusiness}
      
      Provide a JSON response with:
      {
        "riskScore": number (0-100, where 0 is lowest risk),
        "creditRating": "AAA" | "AA" | "A" | "BBB" | "BB" | "B" | "CCC" | "CC" | "C" | "D",
        "verificationStatus": "verified" | "pending" | "requires_additional_docs",
        "riskFactors": ["string"],
        "strengths": ["string"]
      }
    `;

    const response = await getOpenAIClient().chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a risk assessment specialist for commodity trading partnerships."
        },
        {
          role: "user",
          content: validationPrompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    return result;
  } catch (error) {
    console.error("Partner validation error:", error);
    
    return {
      riskScore: 50,
      creditRating: "BBB",
      verificationStatus: "pending",
      riskFactors: ["Assessment service temporarily unavailable"],
      strengths: []
    };
  }
}
