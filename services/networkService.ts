import { ChatMessage } from '../types';
import { parseCorteFallback, parseOrderFallback } from './corteParser';
import { auth } from './firebase';
import { normalizeMultiStoreDraft, parseMultiStoreDraftFallback, type MultiStoreCorteDraft } from './multiStoreCorteDraft';
import type { StoreId } from './multiStoreAccounting';

export interface GeminiDiagnosticReport {
  timestamp: string;
  endpoint: string;
  status: number;
  isPermissionDenied: boolean;
  errorType: 'PERMISSION_DENIED_403' | 'NOT_FOUND_404' | 'AUTH_MISSING_401' | 'NETWORK_ERROR' | 'SUCCESS' | 'UNKNOWN';
  rawError?: string;
  userMessage: string;
  remediationGuide: string[];
  details?: any;
}

export interface GeminiServerStatus {
  configured: boolean;
  keyPrefix: string;
  keyLength: number;
  primaryModel: string;
  fallbackModels: string[];
  localEngineAvailable: boolean;
  serverProxy: boolean;
  storageMethod: string;
  timestamp: string;
}

export const CLEAR_403_USER_MESSAGE =
  "Error 403 (Permiso Denegado): La clave de API de Gemini no tiene permisos suficientes para este modelo o la 'Generative Language API' no está habilitada en el proyecto de Google Cloud. Por favor actualiza o verifica la clave en Settings > Secrets.";

export const CLEAR_401_USER_MESSAGE =
  "Error 401 (Sesión Requerida): Inicia sesión activa en Abarrotes F1 para autenticarte ante el servidor seguro de IA.";

export const CLEAR_404_USER_MESSAGE =
  "Error 404 (No Encontrado): El modelo de Gemini solicitado no está disponible o ha cambiado de identificador en la API de Google.";

async function buildAuthorizedOptions(options: RequestInit = {}, forceRefresh = false): Promise<RequestInit> {
  const headers = new Headers(options.headers || {});
  try {
    if (typeof (auth as any).authStateReady === 'function') {
      await (auth as any).authStateReady();
    }
    const currentUser = auth.currentUser;
    if (currentUser) {
      const idToken = await currentUser.getIdToken(forceRefresh);
      if (idToken) {
        headers.set('Authorization', `Bearer ${idToken}`);
      }
    }
  } catch (err) {
    console.warn('[NetworkService] No se pudo adjuntar token de sesión:', err);
  }
  return {
    ...options,
    headers,
  };
}

/**
 * Utility to identify whether an error or HTTP response status represents a 403 Permission Denied
 */
export function is403PermissionError(error: any, status?: number): boolean {
  if (status === 403) return true;
  const str = (
    (typeof error === 'string' ? error : '') ||
    error?.message ||
    error?.error ||
    error?.details ||
    JSON.stringify(error || {})
  ).toLowerCase();

  return (
    str.includes('403') ||
    str.includes('permission_denied') ||
    str.includes('permission denied') ||
    str.includes('caller does not have permission') ||
    str.includes('generative language api has not been used') ||
    str.includes('has not been used in project') ||
    str.includes('api key not valid') ||
    str.includes('api_key_invalid') ||
    str.includes('forbidden')
  );
}

/**
 * Diagnostic routine that logs structured diagnostic data to the console for 403 errors
 * and constructs an actionable, informative diagnostic report.
 */
export function logGemini403Diagnostic(info: {
  endpoint: string;
  status?: number;
  rawError: any;
  userMessage?: string;
  timestamp?: string;
}): GeminiDiagnosticReport {
  const timestamp = info.timestamp || new Date().toISOString();
  const rawErrorStr = typeof info.rawError === 'object' ? JSON.stringify(info.rawError, null, 2) : String(info.rawError);

  const report: GeminiDiagnosticReport = {
    timestamp,
    endpoint: info.endpoint,
    status: info.status || 403,
    isPermissionDenied: true,
    errorType: 'PERMISSION_DENIED_403',
    rawError: rawErrorStr,
    userMessage: info.userMessage || CLEAR_403_USER_MESSAGE,
    remediationGuide: [
      "1. Habilitar la 'Generative Language API' en Google Cloud Console para el proyecto asociado a la clave.",
      "2. Verificar las restricciones de API de la clave en Google Cloud > APIs & Services > Credenciales.",
      "3. Generar una clave de API nueva en Google AI Studio (https://aistudio.google.com/) y guardarla en Settings > Secrets.",
      "4. Nota: El sistema F1-AI mantiene activos los motores locales de respaldo para cortes de caja, pedidos y finanzas."
    ]
  };

  console.group(`🔍 [Diagnóstico de Red Gemini] Error 403 Detectado (${timestamp})`);
  console.error(`📍 Servicio / Endpoint: ${report.endpoint}`);
  console.error(`⛔ Código HTTP: ${report.status} (PERMISSION_DENIED)`);
  console.error(`📢 Mensaje claro al usuario: ${report.userMessage}`);
  console.warn(`🛠️ Pasos de resolución:`);
  report.remediationGuide.forEach(step => console.warn(`   ${step}`));
  console.groupEnd();

  return report;
}

/**
 * Robust network fetch with Firebase Bearer token authentication, 403 diagnostic interception, and warmup retry
 */
export async function safeJsonFetch(url: string, options: RequestInit = {}, maxRetries = 1): Promise<any> {
  let lastError: any = null;
  let refreshedToken = false;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let response: Response;
    try {
      const reqOptions = url.startsWith('/api/gemini')
        ? await buildAuthorizedOptions(options, refreshedToken)
        : options;
      response = await fetch(url, reqOptions);
    } catch (netErr: any) {
      if (is403PermissionError(netErr)) {
        const report = logGemini403Diagnostic({
          endpoint: url,
          status: 403,
          rawError: netErr,
          userMessage: CLEAR_403_USER_MESSAGE
        });
        const err: any = new Error(report.userMessage);
        err.diagnostic = report;
        err.status = 403;
        err.isPermissionDenied = true;
        throw err;
      }
      lastError = new Error(`Error de conexión de red al servidor: ${netErr?.message || 'Verifica tu conexión a Internet'}`);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      throw lastError;
    }

    // If token just expired, refresh once and retry immediately
    if (response.status === 401 && url.startsWith('/api/gemini') && auth.currentUser && !refreshedToken && attempt < maxRetries) {
      refreshedToken = true;
      continue;
    }

    const rawText = await response.text();
    let parsed: any = null;

    const isHtml = (rawText || '').trim().startsWith('<') ||
      (rawText || '').includes('<!DOCTYPE') ||
      (rawText || '').includes('<html') ||
      (rawText || '').includes('Starting Server...') ||
      (rawText || '').includes('warmup');

    if (isHtml) {
      if (attempt < maxRetries) {
        console.warn(`[safeJsonFetch] Recibida respuesta HTML de proxy/warmup en ${url}, reintentando (${attempt + 1}/${maxRetries})...`);
        await new Promise(r => setTimeout(r, 1200 * (attempt + 1)));
        continue;
      }
      if (response.status === 403 || is403PermissionError(rawText)) {
        const report = logGemini403Diagnostic({
          endpoint: url,
          status: 403,
          rawError: rawText,
          userMessage: CLEAR_403_USER_MESSAGE
        });
        const err: any = new Error(report.userMessage);
        err.diagnostic = report;
        err.status = 403;
        err.isPermissionDenied = true;
        throw err;
      }
      throw new Error("El servidor está iniciando o devolvió una respuesta no válida (HTML en vez de JSON).");
    }

    if (rawText && rawText.trim()) {
      try {
        parsed = JSON.parse(rawText);
      } catch {
        if (response.status === 403 || is403PermissionError(rawText)) {
          const report = logGemini403Diagnostic({
            endpoint: url,
            status: 403,
            rawError: rawText,
            userMessage: CLEAR_403_USER_MESSAGE
          });
          const err: any = new Error(report.userMessage);
          err.diagnostic = report;
          err.status = 403;
          err.isPermissionDenied = true;
          throw err;
        }
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }
        throw new Error("El servidor devolvió una respuesta no válida (no JSON).");
      }
    }

    if (response.status === 403 || is403PermissionError(parsed, response.status)) {
      const errorDetails = parsed?.details || parsed?.error || rawText;
      const report = logGemini403Diagnostic({
        endpoint: url,
        status: response.status || 403,
        rawError: errorDetails,
        userMessage: parsed?.error || CLEAR_403_USER_MESSAGE
      });
      const err: any = new Error(report.userMessage);
      err.diagnostic = report;
      err.status = 403;
      err.isPermissionDenied = true;
      throw err;
    }

    if (parsed?.isPermissionDenied || (parsed?.isFallback && is403PermissionError(parsed?.notice))) {
      logGemini403Diagnostic({
        endpoint: url,
        status: 403,
        rawError: parsed?.notice || parsed?.details || 'Fallback activated due to 403',
        userMessage: parsed?.notice || CLEAR_403_USER_MESSAGE
      });
    }

    if (!response.ok) {
      if (response.status === 401) {
        const err: any = new Error(parsed?.error || CLEAR_401_USER_MESSAGE);
        err.status = 401;
        throw err;
      }
      if (response.status === 404) {
        const err: any = new Error(parsed?.error || CLEAR_404_USER_MESSAGE);
        err.status = 404;
        throw err;
      }
      const errorMsg = parsed?.error || parsed?.message || `Error del servidor (HTTP ${response.status})`;
      const err: any = new Error(errorMsg);
      err.status = response.status;
      throw err;
    }

    return parsed || {};
  }

  throw lastError || new Error("Error de comunicación con el servidor.");
}

/**
 * Network Service providing authenticated communication, error diagnostics,
 * and failover handling for the Gemini API.
 */
export class NetworkService {
  static async getGeminiStatus(): Promise<GeminiServerStatus> {
    try {
      return await safeJsonFetch('/api/gemini/status');
    } catch {
      return {
        configured: false,
        keyPrefix: 'No detectada',
        keyLength: 0,
        primaryModel: 'gemini-3.1-flash-lite',
        fallbackModels: ['gemini-flash-latest', 'gemini-3.8-flash'],
        localEngineAvailable: true,
        serverProxy: true,
        storageMethod: 'Google AI Studio Server Secrets (GEMINI_API_KEY)',
        timestamp: new Date().toISOString()
      };
    }
  }

  static async runGeminiDiagnostic(): Promise<GeminiDiagnosticReport> {
    try {
      const data = await safeJsonFetch('/api/gemini/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ping: true }),
      });

      return {
        timestamp: new Date().toISOString(),
        endpoint: '/api/gemini/diagnose',
        status: 200,
        isPermissionDenied: false,
        errorType: 'SUCCESS',
        userMessage: 'Conexión con la API de Gemini verificada y operativa exitosamente.',
        remediationGuide: [],
        details: data
      };
    } catch (err: any) {
      if (err.diagnostic) {
        return err.diagnostic;
      }
      if (is403PermissionError(err, err.status)) {
        return logGemini403Diagnostic({
          endpoint: '/api/gemini/diagnose',
          status: 403,
          rawError: err.message,
          userMessage: err.message || CLEAR_403_USER_MESSAGE
        });
      }
      return {
        timestamp: new Date().toISOString(),
        endpoint: '/api/gemini/diagnose',
        status: err.status || 500,
        isPermissionDenied: false,
        errorType: err.status === 401 ? 'AUTH_MISSING_401' : 'UNKNOWN',
        rawError: err.message,
        userMessage: err.message || 'Error inesperado al conectar con el servicio de IA.',
        remediationGuide: ['Verifica que tu sesión esté activa y que GEMINI_API_KEY esté configurada en Settings > Secrets.']
      };
    }
  }

  static async chatWithContext(messages: ChatMessage[], userName: string): Promise<string> {
    try {
      const data = await safeJsonFetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, userName }),
      });

      return data.text || "Lo siento, no pude procesar tu solicitud.";
    } catch {
      console.warn("[F1 Chat] Servicio de chat temporalmente no disponible.");
      return `F1-AI temporalmente en modo de espera. El resto del sistema continúa operando con normalidad.`;
    }
  }

  /**
   * IA de cortes multilocales, SOLO borrrador para revisión humana. No guarda nada.
   * Usa el mismo proxy autenticado de Gemini que la aplicación actual.
   */
  static async parseMultiStoreCorteDraft(rawText: string, fecha: string, storeId: StoreId): Promise<MultiStoreCorteDraft> {
    try {
      const result = await safeJsonFetch('/api/gemini/parse-corte-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText, fecha, storeId }),
      }, 0);
      return normalizeMultiStoreDraft(result,storeId,fecha,result.engine === 'local' ? 'local' : 'gemini');
    } catch {
      const draft = parseMultiStoreDraftFallback(rawText,storeId,fecha);
      draft.warnings.push('Servidor IA inaccesible: interpretación local limitada; verificar todo antes de continuar.');
      return draft;
    }
  }

  static async parseCorteText(rawText: string, fecha: string): Promise<any> {
    try {
      const data = await safeJsonFetch('/api/gemini/parse-corte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText, fecha }),
      });

      return data;
    } catch {
      console.log("[F1 Contabilidad] Activando motor contable local de respaldo en cliente.");
      const localResult = parseCorteFallback(rawText);
      localResult.isFallback = true;
      localResult.notice = "Reporte procesado exitosamente con el motor contable local.";
      return localResult;
    }
  }

  static async parseOrderText(rawText: string): Promise<any> {
    try {
      const data = await safeJsonFetch('/api/gemini/parse-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText }),
      });

      return data;
    } catch {
      console.log("[F1 Pedidos] Activando motor de pedidos local en cliente.");
      const localResult = parseOrderFallback(rawText);
      localResult.isFallback = true;
      localResult.notice = "Lista de pedido procesada exitosamente con el motor local.";
      return localResult;
    }
  }

  static async generateAvatar(prompt?: string): Promise<string> {
    const data = await safeJsonFetch('/api/gemini/generate-avatar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });

    if (!data.imageUrl) {
      throw new Error(data.error || 'Error generando avatar');
    }

    return data.imageUrl;
  }
}
