
import { GoogleGenAI, Type } from "@google/genai";
import { ReceiptAnalysis } from "../types";

export class GeminiService {
  private static ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

  static async analyzeReceiptImage(base64Image: string): Promise<ReceiptAnalysis | null> {
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: base64Image,
              },
            },
            {
              text: "Analyze this business receipt or cash report. Extract the total cash amount, total card/terminal payments, and any expenses listed. Return the result in the specified JSON format."
            },
          ],
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              cashAmount: { type: Type.NUMBER, description: "Total cash listed" },
              terminalAmount: { type: Type.NUMBER, description: "Total card/terminal payments" },
              expenses: { type: Type.NUMBER, description: "Total expenses or cash outs" },
              summary: { type: Type.STRING, description: "A brief summary of the findings" }
            },
            required: ["cashAmount", "terminalAmount", "expenses", "summary"]
          }
        }
      });

      const text = response.text;
      if (!text) return null;
      return JSON.parse(text) as ReceiptAnalysis;
    } catch (error) {
      console.error("Error analyzing receipt:", error);
      return null;
    }
  }

  static async getDashboardInsights(data: any): Promise<string> {
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analyze these business stats: ${JSON.stringify(data)}. Provide a one-sentence punchy insight or recommendation for the administrator.`,
      });
      return response.text || "Continue monitoring your daily performance metrics.";
    } catch (error) {
      console.error("Error getting insights:", error);
      return "Unable to generate insights at this time.";
    }
  }
}
