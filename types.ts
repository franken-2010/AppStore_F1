
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
  effectiveAt: any; 
  notes?: string;
  groupId?: string;
  movedTo?: { accountDocId: string; movementId: string };
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string;
  photoURL: string;
  role: string;
}
