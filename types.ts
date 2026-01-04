
export interface ReceiptAnalysis {
  cashAmount: number;
  terminalAmount: number;
  expenses: number;
  summary: string;
}

export interface ChatAttachment {
  type: 'image' | 'file';
  url: string; // base64 o blob url
  name?: string;
  mimeType: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  attachments?: ChatAttachment[];
}

export interface ActivityItem {
  id: string;
  title: string;
  description: string;
  time: string;
  type: 'success' | 'warning' | 'info';
  icon: string;
}

export interface HistoryItem {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: 'completed' | 'revision';
}

export interface StoreProduct {
  productoID: number;
  nombreCompleto: string;
  costoBasePrincipal: number;
  uniPorCaja: number;
  costoUnidad: number;
  utilidadPorcentaje: number;
  precioSugerido: number;
  precioSugRed: number;
  margenPesos: number;
  lastUpdated: string;
}

export type AccountType = 'Activo' | 'Pasivo' | 'Capital' | 'Ingreso' | 'Gasto' | 'Ahorro';

export interface AccountCategory {
  id?: string;
  name: string;
  accountingType: AccountType;
  order: number;
  color?: string;
}

export interface AccountingAccount {
  id?: string;
  code: string;
  name: string;
  type: AccountType; // Mantenido para lógica contable interna
  categoryId?: string; // ID de la categoría dinámica
  description: string;
  balance: number;
  initialBalance?: number;
  parentId?: string | null;
  isVisible?: boolean;
  order?: number;
}

export interface AccountMovement {
  id?: string;
  ts: any; // firebase timestamp
  amount: number;
  direction: 'in' | 'out';
  category: string;
  description: string;
  fromAccountId?: string;
  toAccountId?: string;
  balanceAfter?: number;
}

export interface AccountingProvider {
  id?: string;
  name: string;
  contactName?: string;
  whatsapp?: string;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string;
  photoURL: string;
  role: string;
  webhookPriceUpdate?: string;
  webhookAddProduct?: string;
  webhookCortes?: string;
  webhookNotifications?: string;
}
