import { ChatMessage } from "../types";
import type { StoreId } from './multiStoreAccounting';
import type { MultiStoreCorteDraft } from './multiStoreCorteDraft';
import {
  NetworkService,
  GeminiDiagnosticReport,
  GeminiServerStatus,
  logGemini403Diagnostic,
  is403PermissionError,
  safeJsonFetch,
  CLEAR_403_USER_MESSAGE,
} from "./networkService";

export {
  NetworkService,
  logGemini403Diagnostic,
  is403PermissionError,
  safeJsonFetch,
  CLEAR_403_USER_MESSAGE,
};
export type { GeminiDiagnosticReport, GeminiServerStatus };

/**
 * GeminiService delegates all calls to NetworkService,
 * applying the 403 diagnostic interception routine.
 */
export class GeminiService {
  /**
   * Retrieves server-side status of Gemini configuration and active engine
   */
  static async getStatus(): Promise<GeminiServerStatus> {
    return NetworkService.getGeminiStatus();
  }

  /**
   * Diagnostic routine to test and verify the Gemini API health and credentials
   */
  static async runDiagnostic(): Promise<GeminiDiagnosticReport> {
    return NetworkService.runGeminiDiagnostic();
  }

  static async chatWithContext(messages: ChatMessage[], userName: string): Promise<string> {
    return NetworkService.chatWithContext(messages, userName);
  }

  static async parseMultiStoreCorteDraft(rawText: string, fecha: string, storeId: StoreId): Promise<MultiStoreCorteDraft> {
    return NetworkService.parseMultiStoreCorteDraft(rawText,fecha,storeId);
  }

  static async parseCorteText(rawText: string, fecha: string): Promise<any> {
    return NetworkService.parseCorteText(rawText, fecha);
  }

  static async parseOrderText(rawText: string): Promise<any> {
    return NetworkService.parseOrderText(rawText);
  }

  static async generateAvatar(prompt?: string): Promise<string> {
    return NetworkService.generateAvatar(prompt);
  }
}
