
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { ReceiptAnalysis, ChatMessage, ChatAttachment } from "../types";
import { db } from "./firebase";
import { collection, query, where, getDocs, limit } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const searchStoreProductsFunction: FunctionDeclaration = {
  name: 'searchStoreProducts',
  parameters: {
    type: Type.OBJECT,
    description: 'Busca productos en el inventario de la miscelánea por nombre o SKU.',
    properties: {
      searchTerm: {
        type: Type.STRING,
        description: 'El nombre del producto o parte del nombre para buscar.',
      },
    },
    required: ['searchTerm'],
  },
};

export class GeminiService {
  private static ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  static async chatWithContext(messages: ChatMessage[], userName: string): Promise<string> {
    try {
      // Convertir el historial a partes que Gemini entienda (incluyendo adjuntos)
      const formattedContents = messages.map(m => {
        const parts: any[] = [{ text: m.text }];
        
        if (m.attachments) {
          m.attachments.forEach(att => {
            if (att.type === 'image') {
              const base64Data = att.url.split(',')[1];
              parts.push({
                inlineData: {
                  data: base64Data,
                  mimeType: att.mimeType
                }
              });
            }
          });
        }
        
        return {
          role: m.role,
          parts: parts
        };
      });

      const response = await this.ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: formattedContents,
        config: {
          systemInstruction: `Eres F1-AI, el asistente experto de "Abarrotes F1".
          Administrador: ${userName}.
          Capacidades:
          - Analizar imágenes de estantes, productos o recibos.
          - Consultar el inventario real de Firebase usando la herramienta 'searchStoreProducts'.
          - Ayudar con cálculos de utilidad y precios sugeridos.
          
          Reglas:
          1. Si te preguntan por un precio, DEBES usar 'searchStoreProducts' para dar el dato real de la tienda.
          2. Si ves una imagen, descríbela y relaciónala con el negocio.
          3. Sé breve y profesional.`,
          tools: [{ functionDeclarations: [searchStoreProductsFunction] }],
        }
      });

      // Manejo de Function Calling
      if (response.functionCalls && response.functionCalls.length > 0) {
        const results: any[] = [];
        for (const fc of response.functionCalls) {
          if (fc.name === 'searchStoreProducts') {
            const searchTerm = (fc.args as any).searchTerm;
            const products = await this.executeProductSearch(searchTerm);
            results.push({
              id: fc.id,
              name: fc.name,
              response: { result: products },
            });
          }
        }

        // Enviar resultados de vuelta a Gemini para la respuesta final
        const finalResponse = await this.ai.models.generateContent({
          model: 'gemini-3-pro-preview',
          contents: [
            ...formattedContents,
            { role: 'model', parts: response.candidates[0].content.parts },
            { role: 'user', parts: [{ text: "Aquí tienes los resultados de la base de datos: " + JSON.stringify(results) }] }
          ]
        });

        return finalResponse.text || "He consultado la base de datos pero no obtuve una respuesta clara.";
      }

      return response.text || "Lo siento, no pude procesar tu solicitud.";
    } catch (error) {
      console.error("Error in AI Chat:", error);
      return "Hubo un error al conectar con F1-AI. Verifica tu conexión.";
    }
  }

  private static async executeProductSearch(term: string) {
    try {
      const q = query(
        collection(db, "products"),
        where("nombreCompleto", ">=", term.toUpperCase()),
        where("nombreCompleto", "<=", term.toUpperCase() + "\uf8ff"),
        limit(5)
      );
      const snap = await getDocs(q);
      return snap.docs.map(doc => doc.data());
    } catch (e) {
      console.error("Firebase Search Error:", e);
      return [];
    }
  }

  // Otros métodos se mantienen igual...
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
          systemInstruction: `Devuelve SOLO JSON válido. Sin texto extra.`,
          responseMimeType: "application/json",
        }
      });
      return JSON.parse(response.text || '{}');
    } catch (error) {
      console.error("Error parsing corte text:", error);
      throw error;
    }
  }
}
