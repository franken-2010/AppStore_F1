
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

export type AccountType = 'Activo' | 'Pasivo' | 'Capital' | 'Ingreso' | 'Gasto' | 'Ahorro';

export interface AccountCategory {
  id?: string;
  name: string;
  accountingType: AccountType;
  order: number;
  color?: string;
  enableDirectAdminExpenses?: boolean;
}

export interface AccountIndex {
  accountId: string;
  accountDocId: string;
  name: string;
  type: AccountType;
  categoryId?: string | null;
  isActive: boolean;
  isContable?: boolean;
  inventoryMin?: number;
  inventoryMax?: number;
  createdAt: any;
  updatedAt: any;
}

export interface AccountingAccount {
  id?: string;
  accountId: string;
  name: string;
  type: AccountType;
  categoryId?: string | null;
  balance: number;
  isVisible?: boolean;
  isContable?: boolean;
  inventoryMin?: number;
  inventoryMax?: number;
  order?: number;
  createdAt?: any;
  updatedAt?: any;
  code?: string;
  description?: string;
}

export interface AccountMovement {
  id?: string;
  uid: string;
  accountId: string; 
  amount: number;
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  conceptTitle: string;
  conceptSubtitle: string;
  source: string;
  status?: 'ACTIVE' | 'DELETED' | 'MOVED' | 'VOID';
  createdAt: any; 
  registeredAt?: any;
  effectiveAt: any; 
  notes?: string;
  groupId?: string;
  movedTo?: { accountDocId: string; movementId: string };
  // Standardized Fields for F1 Intelligence
  direction?: 'IN' | 'OUT';
  signedAmount?: number;
  rubro?: string;
  cutId?: string;
  dateKey?: string; // Campo YYYY-MM-DD para consultas rápidas

  // Lógica Contable Interna (Requerimientos de Cuenta)
  id_movimiento?: string;
  fecha?: any;
  tipo_operacion?: 'venta_contado' | 'venta_credito' | 'cobranza_cxc' | 'compra_mercancia' | 'gasto_operativo' | 'gasto_administrativo' | 'consumo_empleados' | 'cortesia' | 'sobrante_caja' | 'faltante_caja' | 'ajuste_contable';
  centro_utilidad?: 'Abarrotes' | 'Fiesta' | 'Recargas' | 'Estancias' | 'Otros' | string;
  categoria?: string; // Para compatibilidad
  cuenta_contable?: string;
  monto?: number;
  signo?: 1 | -1;
  afecta_caja?: boolean;
  afectaCaja?: boolean; // Para compatibilidad
  afecta_ventas?: boolean;
  afectaVentas?: boolean; // Para compatibilidad
  afecta_cxc?: boolean;
  afectaCxC?: boolean; // Para compatibilidad
  afecta_gasto?: boolean;
  afecta_costo?: boolean;
  afecta_inventario?: 'sí' | 'no'; // Para compatibilidad
  afectaInventario?: boolean; // Para compatibilidad
  es_control?: boolean;
  esControl?: boolean; // Para compatibilidad
  origen?: 'manual' | 'voz' | 'IA';
  texto_original?: string;
  usuario?: string;
}

export interface DashboardConfig {
  showBalance: boolean;
  showPerformance: boolean;
  showLogistics: boolean;
  showClosings: boolean;
  performanceAccounts: string[]; // IDs de cuentas a mostrar en Rendimiento
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string;
  photoURL: string;
  role: string;
  dashboardConfig?: DashboardConfig;
}
