
import { db } from './firebase';
import { 
  collection, 
  query, 
  onSnapshot,
  where,
  Timestamp,
  orderBy,
  collectionGroup,
  getDocs,
  limit
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { AccountMovement } from '../types';

export interface RegisterRubric {
  id: string;
  accountId: string;
  label: string;
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
}

export interface RegisterSchema {
  ingresos: RegisterRubric[];
  egresos: RegisterRubric[];
}

export class AccountingService {
  static async getDailyRegisterSchema(uid: string): Promise<RegisterSchema> {
    const ingresos: RegisterRubric[] = [
      { id: 'in_ventas', accountId: 'ventas', label: 'Ventas efectivo', type: 'INCOME' },
      { id: 'in_fiesta', accountId: 'fiesta', label: 'Fiesta', type: 'INCOME' },
      { id: 'in_recargas', accountId: 'recargas', label: 'Recargas', type: 'INCOME' },
      { id: 'in_estancias', accountId: 'estancias', label: 'Estancias', type: 'INCOME' },
      { id: 'in_cxc_venta', accountId: 'cxc', label: 'Ventas a crédito (CxC)', type: 'INCOME' },
      { id: 'in_cxc_pago', accountId: 'cxc', label: 'Pago clientes (Cobranza CxC)', type: 'INCOME' },
      { id: 'in_sobrante', accountId: 'ventas', label: 'Sobrante de Caja', type: 'INCOME' }
    ];

    const egresos: RegisterRubric[] = [
      { id: 'ex_empleados', accountId: 'ventas', label: 'Gastos empleados', type: 'EXPENSE' },
      { id: 'ex_renta', accountId: 'ventas', label: 'Renta', type: 'EXPENSE' },
      { id: 'ex_personal', accountId: 'estancias', label: 'Consumo personal', type: 'EXPENSE' },
      { id: 'ex_mercancias', accountId: 'ventas', label: 'Gastos Abarrotes', type: 'EXPENSE' },
      { id: 'ex_fiesta', accountId: 'fiesta', label: 'Gastos Fiesta', type: 'EXPENSE' },
      { id: 'ex_recargas', accountId: 'recargas', label: 'Gastos Recargas', type: 'EXPENSE' },
      { id: 'ex_otros', accountId: 'ventas', label: 'Otros gastos', type: 'EXPENSE' }
    ];

    return { ingresos, egresos };
  }

  static getInventoryMirrorTitle(rubricId: string): string | null {
    const map: Record<string, string> = {
      'ex_mercancias': 'ENTRADA INV (MERCANCÍA)',
      'ex_fiesta': 'ENTRADA INV (FIESTA)',
      'ex_recargas': 'ENTRADA INV (RECARGAS)'
    };
    return map[rubricId] || null;
  }

  static async getMovementPicklists(uid: string) {
    const schema = await this.getDailyRegisterSchema(uid);
    return {
      income: schema.ingresos.map(r => ({ id: r.id, accountId: r.accountId, label: r.label })),
      expense: schema.egresos.map(r => ({ id: r.id, accountId: r.accountId, label: r.label }))
    };
  }

  static isMovementContable(m: AccountMovement): boolean {
    if (m.status === 'VOID' || m.status === 'DELETED' || m.status === 'MOVED') return false;
    const normalizedId = (m.accountId || '').toLowerCase().trim();
    if (normalizedId === 'inventarios') return false;
    return true;
  }

  static subscribeToTodayDashboard(uid: string, callback: (movements: AccountMovement[]) => void, onError?: (err: string) => void) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const startTs = Timestamp.fromDate(start);
    const endTs = Timestamp.fromDate(end);

    const q = query(
      collectionGroup(db, "movements"),
      where("uid", "==", uid),
      where("createdAt", ">=", startTs),
      where("createdAt", "<=", endTs),
      orderBy("createdAt", "desc")
    );

    return onSnapshot(q, (snap) => {
      const movs = snap.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          uid: String(data.uid || uid),
          accountId: String(data.accountId || ''),
          amount: Number(data.amount || 0),
          type: data.type,
          direction: data.direction || (data.type === 'INCOME' ? 'IN' : 'OUT'),
          signedAmount: Number(data.signedAmount || 0),
          conceptTitle: String(data.conceptTitle || ''),
          conceptSubtitle: String(data.conceptSubtitle || ''),
          source: String(data.source || ''),
          status: String(data.status || 'ACTIVE'),
          createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now()
        } as any;
      });
      callback(movs);
    }, (err) => {
      const msg = err.message || "Error desconocido en suscripción";
      console.warn("F1-QUERY-WARNING:", msg);
      if (onError) onError(msg);
    });
  }

  static subscribeToMovements(uid: string, startDate: Date, endDate: Date, callback: (movements: AccountMovement[]) => void, onError?: (err: string) => void) {
    const startTs = Timestamp.fromDate(startDate);
    const endTs = Timestamp.fromDate(endDate);
    
    const q = query(
      collectionGroup(db, "movements"),
      where("uid", "==", uid),
      where("createdAt", ">=", startTs),
      where("createdAt", "<=", endTs),
      orderBy("createdAt", "desc")
    );

    return onSnapshot(q, (snap) => {
      const movs = snap.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          uid: String(data.uid || uid),
          accountId: String(data.accountId || ''),
          amount: Number(data.amount || 0),
          type: data.type,
          direction: data.direction || (data.type === 'INCOME' ? 'IN' : 'OUT'),
          conceptTitle: String(data.conceptTitle || ''),
          conceptSubtitle: String(data.conceptSubtitle || ''),
          effectiveAt: data.effectiveAt?.toMillis ? data.effectiveAt.toMillis() : null,
          createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : null,
          status: data.status || 'ACTIVE'
        } as any;
      });
      callback(movs);
    }, (err) => {
      console.warn("F1-HISTORY-WARNING:", err.message);
      if (onError) onError(err.message);
    });
  }

  static calculateTotals(movements: AccountMovement[]) {
    let income = 0;
    let expense = 0;
    
    movements.forEach(m => {
      if (!this.isMovementContable(m) || m.type === 'TRANSFER') return;
      
      const amt = Number(m.amount) || 0;
      const direction = (m as any).direction || (m.type === 'INCOME' || (m.type as any) === 'INGRESO' ? 'IN' : 'OUT');
      
      if (direction === 'IN') income += amt;
      else if (direction === 'OUT') expense += amt;
    });

    return { income, expense, balance: income - expense };
  }

  static groupStatsByAccount(movements: AccountMovement[]) {
    const groups: Record<string, { income: number, expense: number, net: number }> = {};
    
    movements.forEach(m => {
      if (!this.isMovementContable(m)) return;
      const aid = (m.accountId || 'otros').toLowerCase().trim();
      if (!groups[aid]) groups[aid] = { income: 0, expense: 0, net: 0 };
      
      const amt = Number(m.amount) || 0;
      const direction = (m as any).direction || (m.type === 'INCOME' || (m.type as any) === 'INGRESO' ? 'IN' : 'OUT');
      
      if (direction === 'IN') groups[aid].income += amt;
      else if (direction === 'OUT') groups[aid].expense += amt;
      
      groups[aid].net = groups[aid].income - groups[aid].expense;
    });

    return groups;
  }

  static getDailyHistory(movements: AccountMovement[], startDate: Date, endDate: Date) {
    const daily: Record<string, { income: number, expense: number, balance: number }> = {};
    
    let current = new Date(startDate);
    while (current <= endDate) {
      const key = current.toISOString().split('T')[0];
      daily[key] = { income: 0, expense: 0, balance: 0 };
      current.setDate(current.getDate() + 1);
    }

    movements.forEach(m => {
      if (!this.isMovementContable(m)) return;
      const date = typeof (m as any).createdAt === 'number' ? new Date((m as any).createdAt) : new Date();
      const key = date.toISOString().split('T')[0];
      if (daily[key]) {
        const amt = Number(m.amount) || 0;
        const direction = (m as any).direction || (m.type === 'INCOME' ? 'IN' : 'OUT');
        
        if (direction === 'IN') daily[key].income += amt;
        else if (direction === 'OUT') daily[key].expense += amt;
        daily[key].balance = daily[key].income - daily[key].expense;
      }
    });

    return Object.entries(daily).map(([date, data]) => ({
      date,
      ...data
    })).sort((a, b) => a.date.localeCompare(b.date));
  }
}
