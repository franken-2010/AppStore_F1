
import { GoogleGenAI, Type } from "@google/genai";
import { ChatMessage } from "../types";

export class GeminiService {
  static async chatWithContext(messages: ChatMessage[], userName: string): Promise<string> {
    try {
      const apiKey = String(process.env.API_KEY || '');
      if (!apiKey) return "Error: API Key no configurada.";

      const ai = new GoogleGenAI({ apiKey });
      
      const history = messages
        .filter(m => m.role === 'user' || m.role === 'model')
        .map(m => ({
          role: m.role as 'user' | 'model',
          parts: [{ text: String(m.text || '').trim() }]
        }));

      while (history.length > 0 && history[0].role !== 'user') {
        history.shift();
      }

      if (history.length === 0) return "No hay historial válido para procesar.";

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: history,
        config: {
          systemInstruction: `Eres F1-AI, asistente de "Abarrotes F1". Admin: ${String(userName)}. Ayuda con el inventario y finanzas de la tienda. Sé conciso y profesional.`,
        }
      });

      return response.text || "Lo siento, no pude procesar tu solicitud.";
    } catch (error: any) {
      console.error("AI Chat Error:", error?.message || "Unknown error");
      return `Error al conectar con F1-AI: ${error?.message || ''}`;
    }
  }

  static async parseCorteText(rawText: string, fecha: string): Promise<any> {
    try {
      const apiKey = String(process.env.API_KEY || '');
      const ai = new GoogleGenAI({ apiKey });
      const promptText = `Analiza este reporte de corte del día ${String(fecha)} y extrae los montos numéricos. 
      Ignora símbolos de pesos, comas, acentos y mayúsculas. 
      Si un concepto no existe, usa 0. 
      
      REGLAS DE MAPEO:
      - "ventas" -> ventas efectivo normales.
      - "fiesta" -> ventas rubro fiesta.
      - "recargas" -> ventas tiempo aire.
      - "estancias" -> ingresos por estancias.
      - "pagoClientes" -> cobros de deudas, pagos cxc, clientes pagaron.
      - "cxc" -> ventas a credito realizadas (ingreso no efectivo).
      - "mercancias" -> gastos abarrotes, gastos fiesta, gastos recargas.
      - "empleados" -> sueldos, pagos personal.
      - "consumoPersonal" -> gastos del dueño o uso personal.
      - "dineroEntregado" -> efectivo final reportado.

      Reporte: ${String(rawText)}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: [{ text: promptText }] },
        config: {
          systemInstruction: `Eres un extractor de datos contables F1. Devuelve un JSON estricto con el schema canonical.`,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              income: { 
                type: Type.OBJECT, 
                properties: { 
                  ventas: { type: Type.NUMBER }, 
                  fiesta: { type: Type.NUMBER }, 
                  recargas: { type: Type.NUMBER }, 
                  estancias: { type: Type.NUMBER }, 
                  pagoClientes: { type: Type.NUMBER }, 
                  cxc: { type: Type.NUMBER }
                } 
              },
              expenses: { 
                type: Type.OBJECT, 
                properties: { 
                  mercancias: { type: Type.NUMBER }, 
                  empleados: { type: Type.NUMBER }, 
                  consumoPersonal: { type: Type.NUMBER } 
                } 
              },
              cash: {
                type: Type.OBJECT,
                properties: {
                  dineroEntregado: { type: Type.NUMBER }
                }
              }
            },
            required: ["income", "expenses", "cash"]
          }
        }
      });
      
      return JSON.parse(response.text || '{}');
    } catch (error: any) {
      console.error("Parse Error:", error?.message || "Unknown error");
      throw new Error(error?.message || "Error analizando reporte");
    }
  }

  static async parseOrderText(rawText: string): Promise<any> {
    try {
      const apiKey = String(process.env.API_KEY || '');
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: [{ text: String(rawText) }] },
        config: {
          systemInstruction: `Extrae items del pedido.`,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    rawName: { type: Type.STRING },
                    qty: { type: Type.NUMBER },
                    unit: { type: Type.STRING },
                    notes: { type: Type.ARRAY, items: { type: Type.STRING } }
                  },
                  required: ["rawName", "qty", "unit", "notes"]
                }
              }
            },
            required: ["items"]
          }
        }
      });
      return JSON.parse(response.text || '{"items":[]}');
    } catch (error: any) {
      console.error("Order Parser Error:", error?.message || "Unknown error");
      throw new Error(error?.message || "Error procesando pedido");
    }
  }
}
