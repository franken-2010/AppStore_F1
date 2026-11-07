import {
  assertStoreCategory,
  calculateCashClosing,
  F1_STORES,
  type CashClosingInput,
  type CashClosingResult,
  type SalesCategoryId,
  type StoreId,
} from './multiStoreAccounting';

/**
 * Modelo preliminar de múltiples salidas de efectivo por corte.
 *
 * La categoría beneficiada y la caja pagadora son dimensiones diferentes:
 * la caja de Local 1 puede pagar una compra de Frutas (categoría de Local 2).
 *
 * Funciones puras: no acceden a Firestore y no sustituyen al corte actual.
 */
export type CashOutlayKind = 'purchase' | 'direct_expense' | 'general_expense' |
  'temporary_advance' | 'owner_withdrawal';

export interface CashOutlay {
  id: string;
  payingStoreId: StoreId;
  kind: CashOutlayKind;
  amount: number;
  categoryId?: SalesCategoryId;
  concept?: string;
}

export interface ClosingWithOutlaysInput extends Omit<CashClosingInput,
  'cashPurchases' | 'cashOperatingExpenses' | 'cashWithdrawals'> {
  outlays: readonly CashOutlay[];
}

export interface OutlaySummary {
  cashOutflowByStore: Record<StoreId, number>;
  merchandisePurchasesByCategory: Partial<Record<SalesCategoryId, number>>;
  generalAdministrativeExpenses: number;
  directExpensesByCategory: Partial<Record<SalesCategoryId, number>>;
  openAdvancesByStore: Record<StoreId, number>;
}

export interface ClosingWithOutlaysResult {
  closing: CashClosingResult;
  surplus: number;
  shortage: number;
  outlaySummary: OutlaySummary;
  /** Si se paga desde Local 1 algo perteneciente a Local 2, se conserva el cruce. */
  crossStorePayments: CashOutlay[];
}

function cents(amount: number, field: string): number {
  if (!Number.isFinite(amount) || amount < 0) throw new Error(field + ': importe inválido');
  const x = Math.round(amount * 100);
  if (!Number.isSafeInteger(x) || Math.abs(amount * 100 - x) > 0.00001) {
    throw new Error(field + ': importe requiere máximo dos decimales');
  }
  return x;
}

export function summarizeCashOutlays(outlays: readonly CashOutlay[]): OutlaySummary {
  const ids = new Set<string>();
  const cashOutflow: Record<StoreId, number> = {local_01: 0, local_02: 0};
  const purchases: Partial<Record<SalesCategoryId, number>> = {};
  const direct: Partial<Record<SalesCategoryId, number>> = {};
  const advances: Record<StoreId, number> = {local_01: 0, local_02: 0};
  let shared = 0;

  for (const row of outlays) {
    if (!row.id.trim() || ids.has(row.id)) throw new Error('ID de movimiento vacío o duplicado');
    ids.add(row.id);
    if (!F1_STORES.some(store => store.id === row.payingStoreId)) {
      throw new Error('Caja pagadora inexistente');
    }
    const value = cents(row.amount, 'Movimiento ' + row.id);
    cashOutflow[row.payingStoreId] += value;

    if (row.kind === 'purchase' || row.kind === 'direct_expense') {
      if (!row.categoryId) throw new Error('Falta categoría para ' + row.id);
      // Validar que se conozca la categoría SIN exigir que pertenezca a la caja pagadora.
      const businessStoreId = F1_STORES.find(store => store.categories.includes(row.categoryId!))?.id;
      if (!businessStoreId) throw new Error('Categoría comercial desconocida');
      assertStoreCategory(businessStoreId, row.categoryId);
      const target = row.kind === 'purchase' ? purchases : direct;
      target[row.categoryId] = (target[row.categoryId] ?? 0) + value;
    } else if (row.kind === 'general_expense') {
      if (row.categoryId) throw new Error('Un gasto general no debe asignarse también a una categoría');
      shared += value;
    } else if (row.kind === 'temporary_advance') {
      if (row.categoryId) throw new Error('Un anticipo sin comprobar todavía no tiene categoría');
      advances[row.payingStoreId] += value;
    } else if (row.kind === 'owner_withdrawal') {
      if (row.categoryId) throw new Error('Un retiro personal no es gasto de una categoría');
    } else {
      throw new Error('Tipo de salida desconocido');
    }
  }

  return {
    cashOutflowByStore: {local_01: cashOutflow.local_01 / 100, local_02: cashOutflow.local_02 / 100},
    merchandisePurchasesByCategory: Object.fromEntries(
      Object.entries(purchases).map(([k,v]) => [k,v/100])) as Partial<Record<SalesCategoryId, number>>,
    generalAdministrativeExpenses: shared / 100,
    directExpensesByCategory: Object.fromEntries(
      Object.entries(direct).map(([k,v]) => [k,v/100])) as Partial<Record<SalesCategoryId, number>>,
    openAdvancesByStore: {local_01: advances.local_01/100,local_02: advances.local_02/100},
  };
}

/**
 * Una salida se registra una sola vez y se puede RECLASIFICAR manteniendo el ID.
 * Nunca registrar una compra adicional por un anticipo ya descontado de caja.
 */
export function reclassifyOutlay(
  outlays: readonly CashOutlay[], id: string,
  kind: 'purchase' | 'direct_expense' | 'general_expense' | 'owner_withdrawal',
  categoryId?: SalesCategoryId,
): CashOutlay[] {
  if (!outlays.some(row => row.id === id && row.kind === 'temporary_advance')) {
    throw new Error('No existe ese anticipo pendiente');
  }
  const updated = outlays.map(row => row.id === id ? {...row,kind,categoryId} : {...row});
  summarizeCashOutlays(updated); // validación previa sin efectos secundarios
  return updated;
}

export function calculateClosingWithOutlays(input: ClosingWithOutlaysInput): ClosingWithOutlaysResult {
  const {outlays, ...cashInput} = input;
  const summary = summarizeCashOutlays(outlays);
  const paying = outlays.filter(row => row.payingStoreId === input.storeId);
  const sumKind = (...kinds: CashOutlayKind[]): number =>
    paying.filter(row => kinds.includes(row.kind)).reduce((total, row) => total + cents(row.amount, row.id),0)/100;

  const closing = calculateCashClosing({
    ...cashInput,
    cashPurchases: sumKind('purchase'),
    cashOperatingExpenses: sumKind('direct_expense','general_expense'),
    cashWithdrawals: sumKind('temporary_advance','owner_withdrawal'),
  });

  return {
    closing,
    surplus: closing.surplusPendingIdentification,
    shortage: closing.shortagePendingInvestigation,
    outlaySummary: summary,
    crossStorePayments: paying.filter(row => {
      if (!row.categoryId) return false;
      return !F1_STORES.find(store=>store.id===row.payingStoreId)?.categories.includes(row.categoryId);
    }),
  };
}
