
export interface ReceiptAnalysis {
  cashAmount: number;
  terminalAmount: number;
  expenses: number;
  summary: string;
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

export type AccountType = 'Activo' | 'Pasivo' | 'Capital' | 'Ingreso' | 'Gasto';

export interface AccountingAccount {
  id?: string;
  code: string;
  name: string;
  type: AccountType;
  description: string;
  balance: number;
  initialBalance?: number;
  parentId?: string | null;
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
