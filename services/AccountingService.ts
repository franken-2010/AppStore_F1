
import { db } from './firebase';
import { 
  collectionGroup, 
  query, 
  getDocs, 
  onSnapshot,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { AccountMovement } from '../types';

export interface RegisterRubric {
  id: string;
  accountId: string;
  label: string;
  type: 'INCOME' | 'EXPENSE';
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
      { id: 'in_cxc_pago', accountId: 'cxc_pago', label: 'Pago clientes (Cobranza CxC)', type: 'INCOME' },
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

  /**
   * Obtiene el título que debe llevar el movimiento espejo en inventarios
   * si el rubro seleccionado representa una compra de mercancía.
   */
  static getInventoryMirrorTitle(rubricId: string): string | null {
    const map: Record<string, string> = {
      'ex_mercancias': 'ENTRADA INV (MERCANCÍA)',
      'ex_fiesta': 'ENTRADA INV (FIESTA)',
      'ex_recargas': 'ENTRADA INV (RECARGAS)'
    };
    return map[rubricId] || null;
  }

  /**
   * Obtiene listas simplificadas para dropdowns de selección de rubros.
   * Ahora incluye el ID del rubro para lógica de negocio precisa.
   */
  static async getMovementPicklists(uid: string) {
    const schema = await this.getDailyRegisterSchema(uid);
    return {
      income: schema.ingresos.map(r => ({ id: r.id, accountId: r.accountId, label: r.label })),
      expense: schema.egresos.map(r => ({ id: r.id, accountId: r.accountId, label: r.label }))
    };
  }

  /**
   * REGLA DE FILTRADO CONTABLE (OBLIGATORIA)
   * Excluye movimientos que no deben afectar la contabilidad financiera (como inventarios).
   */
  static isMovementContable(m: AccountMovement): boolean {
    // Excluir VOID o estados inactivos
    if (m.status === 'VOID' || m.status === 'DELETED' || m.status === 'MOVED') return false;
    
    // EXCLUIR INVENTARIOS DE LA CONTABILIDAD
    const normalizedId = (m.accountId || '').toLowerCase().trim();
    if (normalizedId === 'inventarios') return false;

    return true;
  }

  static subscribeToMovements(uid: string, startDate: Date, endDate: Date, callback: (movements: AccountMovement[]) => void) {
    const q = query(collectionGroup(db, "movements"));

    return onSnapshot(q, (snap) => {
      const startT = startDate.getTime();
      const endT = endDate.getTime();

      const movements = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as AccountMovement))
        .filter(m => {
          if (m.uid !== uid) return false;
          // Aplicar filtrado contable centralizado
          if (!this.isMovementContable(m)) return false;
          
          const effectiveTime = m.effectiveAt?.toMillis?.() || 0;
          return effectiveTime >= startT && effectiveTime <= endT;
        });
      
      movements.sort((a, b) => {
        const timeA = a.effectiveAt?.toMillis?.() || 0;
        const timeB = b.effectiveAt?.toMillis?.() || 0;
        return timeB - timeA;
      });
      
      callback(movements);
    }, (err) => {
      console.error("Subscription error:", err);
    });
  }

  static calculateTotals(movements: AccountMovement[]) {
    let income = 0;
    let expense = 0;
    
    movements.forEach(m => {
      if (!this.isMovementContable(m) || m.type === 'TRANSFER') return;
      const amt = Math.abs(Number(m.amount) || 0);
      const type = (m.type as any);
      if (type === 'INCOME' || type === 'INGRESO') income += amt;
      else if (type === 'EXPENSE' || type === 'EGRESO') expense += amt;
    });

    return { income, expense, balance: income - expense };
  }

  static groupStatsByAccount(movements: AccountMovement[]) {
    const groups: Record<string, { income: number, expense: number, net: number }> = {};
    
    movements.forEach(m => {
      if (!this.isMovementContable(m)) return;
      const aid = (m.accountId || 'otros').toLowerCase().trim();
      if (!groups[aid]) groups[aid] = { income: 0, expense: 0, net: 0 };
      
      const amt = Math.abs(Number(m.amount) || 0);
      const type = (m.type as any);
      if (type === 'INCOME' || type === 'INGRESO') groups[aid].income += amt;
      else if (type === 'EXPENSE' || type === 'EGRESO') groups[aid].expense += amt;
      
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
      const date = m.effectiveAt?.toDate?.() || new Date();
      const key = date.toISOString().split('T')[0];
      if (daily[key]) {
        const amt = Math.abs(Number(m.amount) || 0);
        const type = (m.type as any);
        if (type === 'INCOME' || type === 'INGRESO') daily[key].income += amt;
        else if (type === 'EXPENSE' || type === 'EGRESO') daily[key].expense += amt;
        daily[key].balance = daily[key].income - daily[key].expense;
      }
    });

    return Object.entries(daily).map(([date, data]) => ({
      date,
      ...data
    })).sort((a, b) => a.date.localeCompare(b.date));
  }
}
