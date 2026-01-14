
import { GoogleGenAI, Type } from "@google/genai";
import { ChatMessage } from "../types";

export class GeminiService {
  /**
   * Procesa el chat con el modelo Gemini asegurando que la estructura sea plana 
   * y compatible con los tipos esperados por el SDK.
   */
  static async chatWithContext(messages: ChatMessage[], userName: string): Promise<string> {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const history = messages
        .filter(m => m.role === 'user' || m.role === 'model')
        .map(m => ({
          role: m.role as 'user' | 'model',
          parts: [{ text: String(m.text || '') }]
        }));

      while (history.length > 0 && history[0].role !== 'user') {
        history.shift();
      }

      if (history.length === 0) return "No hay historial válido para procesar.";

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: history,
        config: {
          systemInstruction: `Eres F1-AI, asistente de "Abarrotes F1". Admin: ${userName}. Ayuda con el inventario y finanzas de la tienda. Sé conciso y profesional.`,
        }
      });

      return response.text || "Lo siento, no pude procesar tu solicitud.";
    } catch (error) {
      console.error("Error in AI Chat:", error);
      return "Error al conectar con F1-AI.";
    }
  }

  /**
   * Analiza el texto de un corte de caja y extrae montos estructurados.
   */
  static async parseCorteText(rawText: string, fecha: string): Promise<any> {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const promptText = `Reporte de Corte ${fecha}: ${rawText}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{
          role: 'user',
          parts: [{ text: promptText }]
        }],
        config: {
          systemInstruction: `Analiza el reporte de ventas y gastos de la tienda. 
          Extrae los montos para los siguientes rubros (usa 0 si no se menciona):
          
          INGRESOS:
          - ventas, fiesta, recargas, estancias.
          
          RUBROS CRÍTICOS DE CUENTAS POR COBRAR (CxC):
          - pagos_clientes_cxc = COBRANZA: Dinero que ENTRA físicamente hoy por créditos otorgados en días anteriores. Keywords: "pago clientes", "pagos cxc", "cobranza", "abonos", "cobrado".
          - ventas_a_credito_cxc = VENTA A CRÉDITO: Venta realizada hoy pero que NO entró dinero en efectivo; incrementa la deuda de clientes. Keywords: "ventas a crédito", "crédito", "cxc generado", "por cobrar".

          REGLA DE ORO: 
          - Si el texto dice "Pagos CxC: 200", mapear 200 a pagos_clientes_cxc y 0 a ventas_a_credito_cxc.
          - Si el texto dice "Crédito: 150", mapear 150 a ventas_a_credito_cxc y 0 a pagos_clientes_cxc.

          EGRESOS:
          - gastos_empleados (sueldos), renta, consumo_personal, gastos_abarrotes (compras), gastos_fiesta, gastos_recargas, otros_gastos.
          
          CIERRE:
          - dinero_entregado: El monto final en efectivo que el cajero entrega físicamente.

          Devuelve un JSON estrictamente estructurado.`,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              ingresos: { 
                type: Type.OBJECT, 
                properties: { 
                  ventas: { type: Type.NUMBER }, 
                  fiesta: { type: Type.NUMBER }, 
                  recargas: { type: Type.NUMBER }, 
                  estancias: { type: Type.NUMBER }, 
                  pagos_clientes_cxc: { type: Type.NUMBER }, 
                  ventas_a_credito_cxc: { type: Type.NUMBER }
                } 
              },
              egresos: { 
                type: Type.OBJECT, 
                properties: { 
                  gastos_empleados: { type: Type.NUMBER }, 
                  renta: { type: Type.NUMBER }, 
                  consumo_personal: { type: Type.NUMBER }, 
                  gastos_abarrotes: { type: Type.NUMBER }, 
                  gastos_fiesta: { type: Type.NUMBER }, 
                  gastos_recargas: { type: Type.NUMBER }, 
                  otros_gastos: { type: Type.NUMBER } 
                } 
              },
              dinero_entregado: { type: Type.NUMBER },
              human_summary: { type: Type.STRING }
            },
            required: ["ingresos", "egresos", "dinero_entregado", "human_summary"]
          }
        }
      });
      
      const responseText = response.text || '{}';
      return JSON.parse(responseText);
    } catch (error) {
      console.error("Error parsing corte text:", error);
      throw error;
    }
  }
}
