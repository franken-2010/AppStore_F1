
import { GoogleGenAI, Type } from "@google/genai";
import { ReceiptAnalysis } from "../types";

export class GeminiService {
  private static ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  static async findProductsSemantic(userQuery: string, productsInDb: any[]): Promise<any[]> {
    try {
      if (productsInDb.length === 0) return [];

      const productsContext = productsInDb.map(p => ({
        name: p.nombreCompleto,
        price: p.precioSugRed,
        id: p.productoID
      }));

      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Consulta del usuario: "${userQuery}".\nProductos disponibles en la base de datos:\n${JSON.stringify(productsContext)}`,
        config: {
          systemInstruction: "Eres un buscador inteligente de inventario. Tu tarea es encontrar los productos que más coincidan con la búsqueda del usuario basándote en el nombre. Devuelve un máximo de 5 resultados en formato JSON. El JSON debe ser un array de objetos con las propiedades: 'name' (que sea el nombreCompleto) y 'price' (que sea el precioSugRed).",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                price: { type: Type.NUMBER }
              },
              required: ["name", "price"]
            }
          }
        }
      });

      return JSON.parse(response.text || '[]');
    } catch (error) {
      console.error("Error in semantic search:", error);
      return [];
    }
  }

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

  static async parseCorteText(rawText: string, fecha: string): Promise<any> {
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Fecha: ${fecha}\nTexto:\n${rawText}`,
        config: {
          systemInstruction: `Devuelve SOLO JSON válido. Sin texto extra.
Vas a leer un "corte del día" pegado en texto y extraer montos por rubro.
Los rubros SIEMPRE existen aunque sean 0:
- ventas
- fiesta
- recargas
- totalGeneral
- estancias
- pagosCxc
- subtotalIngresos
- consumoPersonal
- gastosGenerales
- subtotalDespuesEgresos
- dineroEntregado
- diferencia
- clasificacion (sobrante|faltante|cuadrado)
- ingresosCxc (aparte; NO se suma a totalGeneral)

Reglas de extracción:
- Para cada rubro, toma el número que aparece como "$X" o "**$X**" o "→ $X".
- Quita comas de miles.
- Acepta negativos con "−$326" y normaliza a -326.
- Si el texto trae "Resultado: ...", úsalo como referencia pero clasificacion se determina por el signo de diferencia.

Reglas de validación matemática (OBLIGATORIAS):
- totalGeneral = ventas + fiesta + recargas
- subtotalIngresos = totalGeneral + estancias + pagosCxc
- subtotalDespuesEgresos = subtotalIngresos - (consumoPersonal + gastosGenerales)
- diferencia = dineroEntregado - subtotalDespuesEgresos

Devuelve también:
- status: "ok" si todas las validaciones cuadran, si no "inconsistente"
- errors: lista de strings con los campos que no cuadran
- parserVersion: "v1"`,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              status: { type: Type.STRING },
              parserVersion: { type: Type.STRING },
              errors: { type: Type.ARRAY, items: { type: Type.STRING } },
              ventas: { type: Type.NUMBER },
              fiesta: { type: Type.NUMBER },
              recargas: { type: Type.NUMBER },
              totalGeneral: { type: Type.NUMBER },
              estancias: { type: Type.NUMBER },
              pagosCxc: { type: Type.NUMBER },
              subtotalIngresos: { type: Type.NUMBER },
              consumoPersonal: { type: Type.NUMBER },
              gastosGenerales: { type: Type.NUMBER },
              subtotalDespuesEgresos: { type: Type.NUMBER },
              dineroEntregado: { type: Type.NUMBER },
              diferencia: { type: Type.NUMBER },
              clasificacion: { type: Type.STRING },
              ingresosCxc: { type: Type.NUMBER }
            },
            required: ["status", "parserVersion", "errors", "ventas", "fiesta", "recargas", "totalGeneral", "estancias", "pagosCxc", "subtotalIngresos", "consumoPersonal", "gastosGenerales", "subtotalDespuesEgresos", "dineroEntregado", "diferencia", "clasificacion", "ingresosCxc"]
          }
        }
      });

      return JSON.parse(response.text || '{}');
    } catch (error) {
      console.error("Error parsing corte text:", error);
      throw error;
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
