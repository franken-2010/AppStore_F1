/**
 * Motor contable preliminar F1 para dos locales y siete centros comerciales.
 * Funciones puras: no consultan ni modifican Firebase.
 * Los importes se calculan en centavos para evitar errores de redondeo.
 */
export type StoreId = 'local_01' | 'local_02';
export type SalesCategoryId =
  | 'abarrotes' | 'fiesta' | 'recargas' | 'estancias'
  | 'frutas_verduras' | 'pan_galletas' | 'comida_preparada';

export interface StoreDefinition {
  id: StoreId;
  name: string;
  categories: readonly SalesCategoryId[];
}

export const F1_STORES: readonly StoreDefinition[] = [
  { id: 'local_01', name: 'Local 1 — Tienda actual', categories: ['abarrotes', 'fiesta', 'recargas', 'estancias'] },
  { id: 'local_02', name: 'Local 2 — Ampliación', categories: ['frutas_verduras', 'pan_galletas', 'comida_preparada'] },
] as const;

const storeByCategory: Record<SalesCategoryId, StoreId> = {
  abarrotes: 'local_01', fiesta: 'local_01', recargas: 'local_01', estancias: 'local_01',
  frutas_verduras: 'local_02', pan_galletas: 'local_02', comida_preparada: 'local_02',
};

export const F1_CATEGORY_LABELS: Record<SalesCategoryId, string> = {
  abarrotes: 'Abarrotes', fiesta: 'Fiesta', recargas: 'Recargas', estancias: 'Estancias',
  frutas_verduras: 'Frutas y verduras', pan_galletas: 'Pan y galletas', comida_preparada: 'Comida preparada',
};

function assertMoney(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label}: importe no válido`);
  const cents = Math.round(value * 100);
  if (!Number.isSafeInteger(cents) || Math.abs(value * 100 - cents) > 0.00001) {
    throw new Error(`${label}: se requieren importes con máximo dos decimales`);
  }
  return cents;
}

function toMoney(cents: number): number { return cents / 100; }

export function assertStoreCategory(storeId: StoreId, categoryId: SalesCategoryId): void {
  if (storeByCategory[categoryId] !== storeId) {
    throw new Error(`La categoría ${categoryId} no corresponde al local ${storeId}`);
  }
}

/**
 * ID determinista para un corte diario POR LOCAL.
 * La prevención efectiva de duplicados exigirá transacción + create en Firestore.
 */
export function makeDailyClosingId(storeId: StoreId, dateKey: string): string {
  if (!F1_STORES.some(store => store.id === storeId)) throw new Error('Local desconocido');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) throw new Error('Fecha de corte no válida');
  const date = new Date(dateKey + 'T12:00:00Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== dateKey) {
    throw new Error('Fecha de corte inexistente');
  }
  return 'cut_' + storeId + '_' + dateKey;
}

export interface CategorySales {
  categoryId: SalesCategoryId;
  cashSales: number;
  creditSales?: number; // Las ventas a crédito cuentan como ventas, pero NO como entrada de caja.
}

export interface CashClosingInput {
  storeId: StoreId;
  dateKey: string; // YYYY-MM-DD; fecha operativa en Mérida, sin convertir a UTC.
  categorySales: readonly CategorySales[];
  openingCash: number;
  cashCollections?: number; // Cobros de ventas a crédito anteriores: no generan otra venta.
  cashPurchases?: number;
  cashOperatingExpenses?: number;
  cashTransfersIn?: number; // Traspasos entre cajas: NO son ventas.
  cashTransfersOut?: number;
  cashWithdrawals?: number; // Retiro/entrega al propietario u oficina.
  countedCash: number;
}

export interface CashClosingResult {
  storeId: StoreId;
  dateKey: string;
  categorySales: readonly CategorySales[];
  classifiedCashSales: number;
  classifiedCreditSales: number;
  classifiedTotalSales: number;
  expectedCash: number;
  countedCash: number;
  variance: number; // Negativo: faltante. Positivo: sobrante en conciliación.
  surplusPendingIdentification: number;
  shortagePendingInvestigation: number;
  adjustedGeneralReceipts: number; // Indicador operativo, NO venta ni utilidad reconocida.
}

/**
 * Calcula un corte sin registrar el sobrante como venta de ninguna categoría.
 * Un sobrante se mantiene pendiente de identificación/regularización contable.
 */
export function calculateCashClosing(input: CashClosingInput): CashClosingResult {
  if (!F1_STORES.some(s => s.id === input.storeId)) throw new Error('Local desconocido');
  makeDailyClosingId(input.storeId, input.dateKey);
  const uniqueCategories = new Set<SalesCategoryId>();
  let cashSalesCents = 0;
  let creditSalesCents = 0;
  for (const sale of input.categorySales) {
    assertStoreCategory(input.storeId, sale.categoryId);
    if (uniqueCategories.has(sale.categoryId)) throw new Error(`Categoría repetida: ${sale.categoryId}`);
    uniqueCategories.add(sale.categoryId);
    cashSalesCents += assertMoney(sale.cashSales, `Venta ${sale.categoryId}`);
    creditSalesCents += assertMoney(sale.creditSales ?? 0, `Crédito ${sale.categoryId}`);
  }
  const expectedCents =
    assertMoney(input.openingCash, 'Fondo inicial') + cashSalesCents +
    assertMoney(input.cashCollections ?? 0, 'Cobranza') +
    assertMoney(input.cashTransfersIn ?? 0, 'Transferencia de entrada') -
    assertMoney(input.cashPurchases ?? 0, 'Compras pagadas') -
    assertMoney(input.cashOperatingExpenses ?? 0, 'Gastos pagados') -
    assertMoney(input.cashTransfersOut ?? 0, 'Transferencia de salida') -
    assertMoney(input.cashWithdrawals ?? 0, 'Retiros de efectivo');
  const countedCents = assertMoney(input.countedCash, 'Efectivo contado');
  const varianceCents = countedCents - expectedCents;
  return {
    storeId: input.storeId, dateKey: input.dateKey, categorySales: input.categorySales,
    classifiedCashSales: toMoney(cashSalesCents),
    classifiedCreditSales: toMoney(creditSalesCents),
    classifiedTotalSales: toMoney(cashSalesCents + creditSalesCents),
    expectedCash: toMoney(expectedCents), countedCash: toMoney(countedCents),
    variance: toMoney(varianceCents),
    surplusPendingIdentification: toMoney(Math.max(varianceCents, 0)),
    shortagePendingInvestigation: toMoney(Math.max(-varianceCents, 0)),
    adjustedGeneralReceipts: toMoney(cashSalesCents + Math.max(varianceCents, 0)),
  };
}

/**
 * Base de distribución: ingresos comerciales elegibles, EXCLUYENDO sobrantes, cobros de
 * cartera y traspasos. En Recargas usar la comisión/ingreso reconocido cuando se conozca.
 */
export interface AllocationBase {
  storeId: StoreId;
  categoryId: SalesCategoryId;
  eligibleRevenue: number;
}

export type ExpenseScope =
  | { kind: 'company' }
  | { kind: 'store'; storeId: StoreId }
  | { kind: 'category'; storeId: StoreId; categoryId: SalesCategoryId };

export interface OverheadExpense {
  id: string;
  concept: string;
  amount: number;
  scope: ExpenseScope;
}

export interface ExpenseAllocation {
  expenseId: string;
  storeId: StoreId;
  categoryId: SalesCategoryId;
  amount: number;
}

export interface UnallocatedExpense {
  expenseId: string;
  amount: number;
  reason: string;
}

export interface OverheadAllocationResult {
  allocations: ExpenseAllocation[];
  unallocated: UnallocatedExpense[];
  totalExpenses: number;
  totalAllocated: number;
  totalUnallocated: number;
}

/** Asigna centavos residuales al mayor resto fraccional; suma exacta por gasto. */
function splitCents(total: number, weights: readonly number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) return weights.map(() => 0);
  const shares = weights.map(weight => total * weight / sum);
  const floors = shares.map(share => Math.floor(share));
  let remainder = total - floors.reduce((a, b) => a + b, 0);
  const ordered = shares.map((share, index) => ({index, remainder: share - floors[index]}))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (let i = 0; i < remainder; i++) floors[ordered[i].index]++;
  return floors;
}

/**
 * Prorratea gastos comunes según ingresos comerciales elegibles.
 * Gastos directos se asignan íntegramente; si no existen ingresos para un gasto
 * compartido, se marca PENDIENTE, nunca se reparte arbitrariamente a Abarrotes.
 */
export function allocateOverheadExpenses(
  bases: readonly AllocationBase[],
  expenses: readonly OverheadExpense[],
): OverheadAllocationResult {
  const amounts = new Map<string, number>();
  for (const base of bases) {
    assertStoreCategory(base.storeId, base.categoryId);
    const key = `${base.storeId}/${base.categoryId}`;
    amounts.set(key, (amounts.get(key) ?? 0) + assertMoney(base.eligibleRevenue, `Ingreso ${key}`));
  }
  // También incluir categorías con venta cero, para permitir gastos directos.
  const all = F1_STORES.flatMap(store => store.categories.map(categoryId => ({
    storeId: store.id, categoryId, weight: amounts.get(`${store.id}/${categoryId}`) ?? 0,
  })));
  const ids = new Set<string>();
  const allocations: ExpenseAllocation[] = [];
  const unallocated: UnallocatedExpense[] = [];
  let totalCents = 0;
  let allocatedCents = 0;
  let unallocatedCents = 0;
  for (const expense of expenses) {
    if (!expense.id.trim() || ids.has(expense.id)) throw new Error('ID de gasto vacío o duplicado');
    ids.add(expense.id);
    const cents = assertMoney(expense.amount, `Gasto ${expense.id}`);
    totalCents += cents;
    let candidates = all;
    const scope = expense.scope;
    if (scope.kind !== 'company') {
      if (!F1_STORES.some(s => s.id === scope.storeId)) throw new Error('Local de gasto inválido');
      candidates = candidates.filter(c => c.storeId === scope.storeId);
    }
    if (scope.kind === 'category') {
      assertStoreCategory(scope.storeId, scope.categoryId);
      candidates = candidates.filter(c => c.categoryId === scope.categoryId);
    }
    if (scope.kind !== 'category' && !candidates.some(c => c.weight > 0)) {
      unallocated.push({ expenseId: expense.id, amount: toMoney(cents), reason: 'Sin ingresos elegibles para prorrateo' });
      unallocatedCents += cents;
      continue;
    }
    const apportioned = scope.kind === 'category'
      ? [cents] : splitCents(cents, candidates.map(c => c.weight));
    candidates.forEach((c, idx) => {
      if (apportioned[idx] > 0) allocations.push({
        expenseId: expense.id, storeId: c.storeId, categoryId: c.categoryId,
        amount: toMoney(apportioned[idx]),
      });
      allocatedCents += apportioned[idx];
    });
  }
  return {
    allocations, unallocated,
    totalExpenses: toMoney(totalCents),
    totalAllocated: toMoney(allocatedCents),
    totalUnallocated: toMoney(unallocatedCents),
  };
}
