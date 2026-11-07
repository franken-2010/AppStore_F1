import { F1_STORES, F1_CATEGORY_LABELS, type SalesCategoryId, type StoreId } from './multiStoreAccounting';
import type { MultiStoreCorteDraft } from './multiStoreCorteDraft';

/**
 * Auditoría resumida en el formato familiar de F1.
 * Nunca registra movimientos; diferencia ventas, cobros, egresos en efectivo
 * y consumo de mercancía sin salida de caja.
 */
export interface F1AuditSummary {
  storeId: StoreId;
  cashSales: Partial<Record<SalesCategoryId,number>>;
  creditSales: Partial<Record<SalesCategoryId,number>>;
  purchases: Partial<Record<SalesCategoryId,number>>;
  directExpenses: Partial<Record<SalesCategoryId,number>>;
  generalExpenses: number;
  employeeAndOwnerConsumption: number;
  cashWithdrawals: number;
  temporaryAdvances: number;
  previousDebtCollections: number;
  classifiedCashSales: number;
  totalCashEntries: number;
  cashPurchases: number;
  cashDirectExpenses: number;
  cashGeneralExpenses: number;
  cashOutflows: number;
  openingCash: number;
  expectedCash: number;
  countedCash: number | null;
  cashDifference: number | null;
  manualSurplus: number | null;
  surplusDiscrepancy: number | null;
  unresolved: number;
  unclassifiedSources: string[];
}
const c = (amount: number): number => Math.round(amount*100);
const m = (cents: number): number => cents/100;

export function buildF1AuditSummary(draft: MultiStoreCorteDraft, openingCash = 0): F1AuditSummary {
  const selected = F1_STORES.find(s=>s.id === draft.storeId);
  if (!selected) throw new Error('Caja desconocida');
  if (!Number.isFinite(openingCash) || openingCash<0) throw new Error('Fondo inválido');
  const cashSales: Partial<Record<SalesCategoryId,number>> = {};
  const creditSales: Partial<Record<SalesCategoryId,number>> = {};
  const purchases: Partial<Record<SalesCategoryId,number>> = {};
  const directExpenses: Partial<Record<SalesCategoryId,number>> = {};
  let generalExpenses=0,nonCash=0,withdrawals=0,advances=0,
    collections=0,cashPurchases=0,cashDirectExpenses=0,cashGeneralExpenses=0;
  let unresolved=0;
  const unclassifiedSources: string[]=[];
  const increment=(group:Partial<Record<SalesCategoryId,number>>,category:SalesCategoryId,amount:number) => {
    group[category]=(group[category]||0)+c(amount);
  };
  for (const row of draft.incomes) {
    const missing=row.kind!=='collection' && (!row.categoryId || !selected.categories.includes(row.categoryId));
    if (row.needsReview || missing) unresolved++;
    if (missing) unclassifiedSources.push(row.rawText || 'Ingreso sin categoría');
    if (row.kind==='collection') {collections += c(row.amount);continue;}
    if (!row.categoryId || missing) continue;
    increment(row.kind==='cash_sale' ? cashSales : creditSales,row.categoryId,row.amount);
  }
  for (const row of draft.outlays) {
    const reqCategory=row.kind==='purchase'||row.kind==='direct_expense';
    const missing=reqCategory&&!row.categoryId;
    if(row.needsReview||missing) unresolved++;
    if(missing) unclassifiedSources.push(row.rawText || row.concept || 'Salida sin categoría');
    const amount=c(row.amount);
    if(row.kind==='non_cash_consumption') {nonCash+=amount;continue;}
    if(row.kind==='temporary_advance') advances+=amount;
    else if(row.kind==='owner_withdrawal') withdrawals+=amount;
    else if(row.kind==='general_expense') generalExpenses+=amount;
    else if(row.kind==='purchase' && row.categoryId) increment(purchases,row.categoryId,row.amount);
    else if(row.kind==='direct_expense' && row.categoryId) increment(directExpenses,row.categoryId,row.amount);
    // La caja pagadora determina el efectivo descontado; una compra de
    // Local 2 puede haberse pagado con efectivo de Local 1.
    if(row.payingStoreId!==draft.storeId) continue;
    if(row.kind==='purchase')cashPurchases+=amount;
    if(row.kind==='direct_expense')cashDirectExpenses+=amount;
    if(row.kind==='general_expense')cashGeneralExpenses+=amount;
  }
  const classifiedCashSales=Object.values(cashSales).reduce((sum,amount)=>sum+(amount||0),0);
  const totalCashEntries=classifiedCashSales+collections;
  const cashOutflows=draft.outlays.reduce((sum,row)=>{
    if(row.payingStoreId!==draft.storeId||row.kind==='non_cash_consumption')return sum;
    return sum+c(row.amount);
  },0);
  const expected=c(openingCash)+totalCashEntries-cashOutflows;
  const counted=draft.cash.countedCash===null?null:c(draft.cash.countedCash);
  const diff=counted===null?null:counted-expected;
  const surplus=diff===null?null:Math.max(diff,0);
  return {
    storeId:draft.storeId,
    cashSales:Object.fromEntries(Object.entries(cashSales).map(([k,v])=>[k,m(v)])),
    creditSales:Object.fromEntries(Object.entries(creditSales).map(([k,v])=>[k,m(v)])),
    purchases:Object.fromEntries(Object.entries(purchases).map(([k,v])=>[k,m(v)])),
    directExpenses:Object.fromEntries(Object.entries(directExpenses).map(([k,v])=>[k,m(v)])),
    generalExpenses:m(generalExpenses),employeeAndOwnerConsumption:m(nonCash),
    cashWithdrawals:m(withdrawals),temporaryAdvances:m(advances),
    previousDebtCollections:m(collections),classifiedCashSales:m(classifiedCashSales),
    totalCashEntries:m(totalCashEntries),cashPurchases:m(cashPurchases),
    cashDirectExpenses:m(cashDirectExpenses),cashGeneralExpenses:m(cashGeneralExpenses),
    cashOutflows:m(cashOutflows),openingCash,expectedCash:m(expected),
    countedCash:counted===null?null:m(counted),cashDifference:diff===null?null:m(diff),
    manualSurplus:draft.cash.manualSurplus,
    surplusDiscrepancy:surplus===null||draft.cash.manualSurplus===null
      ? null:m(surplus-c(draft.cash.manualSurplus)),
    unresolved,unclassifiedSources,
  };
}
