
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
} from "firebase/firestore";
import { handleFirestoreError, OperationType } from './errorHandling';
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
    let directAdminEnabled = false;
    try {
      const catSnap = await getDocs(collection(db, "users", uid, "categories"));
      catSnap.forEach(doc => {
        const data = doc.data();
        if (data.name && (data.name.trim().toLowerCase() === 'estancias' || data.name.trim().toLowerCase() === 'estancia') && data.enableDirectAdminExpenses === true) {
          directAdminEnabled = true;
        }
      });
    } catch (e) {
      console.error("Error checking direct admin status for Estancias", e);
    }

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
      { id: 'ex_consumo_empleados', accountId: 'ventas', label: 'Consumo de empleados', type: 'EXPENSE' },
      { id: 'ex_empleados', accountId: 'gastos_administrativos', label: 'Sueldos / Pago empleados', type: 'EXPENSE' },
      { id: 'ex_renta', accountId: 'gastos_administrativos', label: 'Renta', type: 'EXPENSE' },
      { id: 'ex_mantenimiento', accountId: 'gastos_administrativos', label: 'Mantenimiento local', type: 'EXPENSE' },
      { id: 'ex_gastos_administrativos', accountId: 'gastos_administrativos', label: 'Gastos administrativos', type: 'EXPENSE' },
      { id: 'ex_personal', accountId: 'estancias', label: 'Consumo personal', type: 'EXPENSE' },
      ...(directAdminEnabled ? [
        { id: 'ex_estancias_admin', accountId: 'estancias', label: 'Gastos Administrativos Directos', type: 'EXPENSE' as const }
      ] : []),
      { id: 'ex_mercancias', accountId: 'ventas', label: 'Gastos Abarrotes', type: 'EXPENSE' },
      { id: 'ex_fiesta', accountId: 'fiesta', label: 'Gastos Fiesta', type: 'EXPENSE' },
      { id: 'ex_recargas', accountId: 'recargas', label: 'Gastos Recargas', type: 'EXPENSE' },
      { id: 'ex_otros', accountId: 'ventas', label: 'Otros gastos', type: 'EXPENSE' },
      { id: 'ex_faltante', accountId: 'ventas', label: 'Faltante de Caja', type: 'EXPENSE' }
    ];

    return { ingresos, egresos };
  }

  static getAccountingFields(
    rubricId: string, 
    amount: number, 
    notes: string = '', 
    userName: string = 'Administrador', 
    origin: 'manual' | 'voz' | 'IA' = 'manual', 
    textoOriginal: string = '',
    asControlRecord: boolean = false
  ): Partial<AccountMovement> {
    const defaultFields: Partial<AccountMovement> = {
      amount: amount,
      notes: notes,
      texto_original: textoOriginal || notes,
      usuario: userName,
      origen: origin,
      createdAt: new Date()
    };

    let tipo_operacion: AccountMovement['tipo_operacion'] = 'ajuste_contable';
    let centro_utilidad = 'Otros';
    let cuenta_contable = 'Caja / Efectivo';
    let signo: 1 | -1 = 1;
    let afecta_caja = true;
    let afecta_ventas = false;
    let afecta_cxc = false;
    let afecta_gasto = false;
    let afecta_costo = false;
    let es_control = false;

    switch (rubricId) {
      case 'in_ventas':
        tipo_operacion = 'venta_contado';
        centro_utilidad = 'Abarrotes';
        cuenta_contable = 'Ventas Abarrotes';
        signo = 1;
        afecta_caja = true;
        afecta_ventas = true;
        break;
      case 'in_fiesta':
        tipo_operacion = 'venta_contado';
        centro_utilidad = 'Fiesta';
        cuenta_contable = 'Ventas Fiesta';
        signo = 1;
        afecta_caja = true;
        afecta_ventas = true;
        break;
      case 'in_recargas':
        tipo_operacion = 'venta_contado';
        centro_utilidad = 'Recargas';
        cuenta_contable = 'Ventas Recargas';
        signo = 1;
        afecta_caja = true;
        afecta_ventas = true;
        break;
      case 'in_estancias':
        tipo_operacion = 'venta_contado';
        centro_utilidad = 'Estancias';
        cuenta_contable = 'Ventas Estancias';
        signo = 1;
        afecta_caja = true;
        afecta_ventas = true;
        break;
      case 'in_cxc_venta':
        tipo_operacion = 'venta_credito';
        centro_utilidad = 'Abarrotes';
        cuenta_contable = 'Cuentas por Cobrar Clientes';
        signo = 1;
        afecta_caja = false;
        afecta_ventas = true;
        afecta_cxc = true;
        break;
      case 'in_cxc_pago':
        tipo_operacion = 'cobranza_cxc';
        centro_utilidad = 'Abarrotes';
        cuenta_contable = 'Cobranza CxC';
        signo = 1;
        afecta_caja = true;
        afecta_ventas = false;
        afecta_cxc = true;
        es_control = true;
        break;
      case 'in_sobrante':
        tipo_operacion = 'sobrante_caja';
        centro_utilidad = 'Otros';
        cuenta_contable = 'Sobrantes de Caja';
        signo = 1;
        afecta_caja = true;
        afecta_ventas = false;
        es_control = true;
        break;
      case 'ex_consumo_empleados':
        tipo_operacion = 'consumo_empleados';
        centro_utilidad = 'Abarrotes';
        afecta_caja = false;
        afecta_ventas = false;
        afecta_cxc = false;
        afecta_costo = false;
        if (asControlRecord) {
          cuenta_contable = 'Consumo Empleados Valor Venta';
          signo = 1;
          afecta_gasto = false;
          es_control = true;
        } else {
          cuenta_contable = 'Consumo Empleados';
          signo = -1;
          afecta_gasto = true;
          es_control = false;
        }
        break;
      case 'ex_personal': // Cortesía / Consumo personal
        tipo_operacion = 'cortesia';
        centro_utilidad = 'Otros';
        afecta_caja = false;
        afecta_ventas = false;
        afecta_cxc = false;
        afecta_costo = false;
        if (asControlRecord) {
          cuenta_contable = 'Cortesías Valor Venta';
          signo = 1;
          afecta_gasto = false;
          es_control = true;
        } else {
          cuenta_contable = 'Cortesías';
          signo = -1;
          afecta_gasto = true;
          es_control = false;
        }
        break;
      case 'ex_estancias_admin':
        tipo_operacion = 'gasto_operativo';
        centro_utilidad = 'Estancias';
        cuenta_contable = 'Gastos Administrativos Estancias';
        signo = -1;
        afecta_caja = true;
        afecta_ventas = false;
        afecta_gasto = true;
        break;
      case 'ex_empleados':
        tipo_operacion = 'gasto_operativo';
        centro_utilidad = 'Otros';
        cuenta_contable = 'Sueldos';
        signo = -1;
        afecta_caja = true;
        afecta_ventas = false;
        afecta_gasto = true;
        break;
      case 'ex_renta':
        tipo_operacion = 'gasto_operativo';
        centro_utilidad = 'Otros';
        cuenta_contable = 'Renta';
        signo = -1;
        afecta_caja = true;
        afecta_ventas = false;
        afecta_gasto = true;
        break;
      case 'ex_mantenimiento':
        tipo_operacion = 'gasto_operativo';
        centro_utilidad = 'Otros';
        cuenta_contable = 'Gastos Administrativos';
        signo = -1;
        afecta_caja = true;
        afecta_ventas = false;
        afecta_gasto = true;
        break;
      case 'ex_gastos_administrativos':
        tipo_operacion = 'gasto_operativo';
        centro_utilidad = 'Otros';
        cuenta_contable = 'Gastos Administrativos';
        signo = -1;
        afecta_caja = true;
        afecta_ventas = false;
        afecta_gasto = true;
        break;
      case 'ex_mercancias':
        tipo_operacion = 'compra_mercancia';
        centro_utilidad = 'Abarrotes';
        cuenta_contable = 'Costo Abarrotes';
        signo = -1;
        afecta_caja = true;
        afecta_ventas = false;
        afecta_costo = true;
        break;
      case 'ex_fiesta':
        tipo_operacion = 'compra_mercancia';
        centro_utilidad = 'Fiesta';
        cuenta_contable = 'Costo Fiesta';
        signo = -1;
        afecta_caja = true;
        afecta_ventas = false;
        afecta_costo = true;
        break;
      case 'ex_recargas':
        tipo_operacion = 'compra_mercancia';
        centro_utilidad = 'Recargas';
        cuenta_contable = 'Costo Recargas';
        signo = -1;
        afecta_caja = true;
        afecta_ventas = false;
        afecta_costo = true;
        break;
      case 'ex_otros':
        tipo_operacion = 'gasto_operativo';
        centro_utilidad = 'Otros';
        cuenta_contable = 'Otros Gastos Operativos';
        signo = -1;
        afecta_caja = true;
        afecta_ventas = false;
        afecta_gasto = true;
        break;
      case 'ex_faltante':
        tipo_operacion = 'faltante_caja';
        centro_utilidad = 'Otros';
        cuenta_contable = 'Faltantes de Caja';
        signo = -1;
        afecta_caja = true;
        afecta_ventas = false;
        afecta_gasto = true;
        break;
    }

    // Calcular monto real para consumo/cortesía real (no control)
    let finalAmount = amount;
    if ((rubricId === 'ex_consumo_empleados' || rubricId === 'ex_personal') && !asControlRecord) {
      finalAmount = Number((amount * 0.82).toFixed(2));
    }

    const matched: Partial<AccountMovement> = {
      ...defaultFields,
      amount: finalAmount,
      tipo_operacion,
      centro_utilidad,
      categoria: centro_utilidad.toLowerCase(),
      cuenta_contable,
      signo,
      afecta_caja,
      afectaCaja: afecta_caja,
      afecta_ventas,
      afectaVentas: afecta_ventas,
      afecta_cxc,
      afectaCxC: afecta_cxc,
      afecta_gasto,
      afecta_costo,
      es_control,
      esControl: es_control
    };

    return matched;
  }

  static validateAccountingMovement(m: Partial<AccountMovement>): string | null {
    if (!m.tipo_operacion) {
      return "La operación debe tener un tipo de operación contable especificado.";
    }
    if (!m.cuenta_contable) {
      return "La operación debe tener una cuenta contable asignada.";
    }

    if (m.tipo_operacion === 'cobranza_cxc' && m.afecta_ventas) {
      return "Error de validación contable: Una cobranza CxC no puede aumentar ventas.";
    }
    if (m.tipo_operacion === 'venta_credito') {
      if (m.afecta_caja) {
        return "Error de validación contable: Una venta a crédito no puede afectar la caja.";
      }
      if (m.signo === -1 || m.type === 'EXPENSE') {
        return "Error de validación contable: Una venta a crédito no puede registrarse como egreso ni tener signo negativo.";
      }
    }
    if (m.tipo_operacion === 'sobrante_caja' && m.afecta_ventas) {
      return "Error de validación contable: Un sobrante de caja no puede registrarse automáticamente como venta.";
    }

    // El gasto real para consumo de empleados o cortesía debe ser 82% del valor capturado
    if (m.tipo_operacion === 'consumo_empleados' && m.cuenta_contable === 'Consumo Empleados' && m.monto !== undefined) {
      // Validar que represente el 82% aproximadamente
    }
    if (m.tipo_operacion === 'cortesia' && m.cuenta_contable === 'Cortesías' && m.monto !== undefined) {
      // Validar que represente el 82% aproximadamente
    }

    return null;
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
          ...data,
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
      handleFirestoreError(err, OperationType.GET, "movements (collectionGroup)");
      if (onError) onError(err.message);
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
          ...data,
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
          effectiveAt: data.effectiveAt?.toMillis ? data.effectiveAt.toMillis() : null,
          createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now(),
          status: data.status || 'ACTIVE'
        } as any;
      });
      callback(movs);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, "movements (collectionGroup)");
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
    
    const formatDate = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    let current = new Date(startDate);
    while (current <= endDate) {
      const key = formatDate(current);
      daily[key] = { income: 0, expense: 0, balance: 0 };
      current.setDate(current.getDate() + 1);
    }

    movements.forEach(m => {
      if (!this.isMovementContable(m)) return;
      const date = typeof (m as any).createdAt === 'number' ? new Date((m as any).createdAt) : (m as any).createdAt?.toDate ? (m as any).createdAt.toDate() : new Date();
      const key = formatDate(date);
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
