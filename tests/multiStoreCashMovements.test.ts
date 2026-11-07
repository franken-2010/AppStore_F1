import {
  calculateClosingWithOutlays,
  reclassifyOutlay,
  summarizeCashOutlays,
  type CashOutlay,
} from '../services/multiStoreCashMovements';

function eq(actual: unknown, expected: unknown, name: string) {
  if (actual !== expected) throw new Error(name + ': esperado ' + expected + ', recibido ' + actual);
}
function fails(fn: () => unknown, name: string) {
  try { fn(); } catch { return; }
  throw new Error(name + ': no falló');
}

const payments: CashOutlay[] = [
  { id: 'abarrotes1', payingStoreId: 'local_01', kind: 'purchase', categoryId: 'abarrotes', amount: 100 },
  { id: 'frutas1', payingStoreId: 'local_01', kind: 'purchase', categoryId: 'frutas_verduras', amount: 240 },
  { id: 'fiesta1', payingStoreId: 'local_01', kind: 'purchase', categoryId: 'fiesta', amount: 130 },
  { id: 'admin1', payingStoreId: 'local_01', kind: 'general_expense', amount: 80 },
  { id: 'pan1', payingStoreId: 'local_02', kind: 'purchase', categoryId: 'pan_galletas', amount: 300 },
  { id: 'anticipo1', payingStoreId: 'local_01', kind: 'temporary_advance', amount: 50 },
];
let r = summarizeCashOutlays(payments);
eq(r.merchandisePurchasesByCategory.frutas_verduras, 240, 'Frutas clasificadas Local 2');
eq(r.cashOutflowByStore.local_01, 600, 'Compra de Local 2 descontada de caja 1');
eq(r.cashOutflowByStore.local_02, 300, 'Caja 2 independiente');
eq(r.generalAdministrativeExpenses, 80, 'Gastos generales no adjudicados a Abarrotes');
eq(r.openAdvancesByStore.local_01, 50, 'Anticipo sin comprobar');

const cut = calculateClosingWithOutlays({
  storeId: 'local_01',dateKey:'2026-11-06',categorySales:[
    {categoryId:'abarrotes',cashSales:2800},
    {categoryId:'fiesta',cashSales:650},
  ],openingCash:500,cashCollections:100,countedCash:3070,manualSurplus:20,
  outlays:payments,
});
eq(cut.closing.expectedCash, 3450, 'Efectivo esperado');
eq(cut.closing.variance,-380, 'Faltante independiente de manual');
eq(cut.manualSurplus,20,'Sobrante manual conservado');
eq(cut.surplusCheckDifference,-20, 'Diferencia contra sobrante calculado, sin sumarlo');
eq(cut.crossStorePayments.length,1,'Cruce entre caja pagadora y local de categoría');
eq(cut.crossStorePayments[0].categoryId,'frutas_verduras','Categoría de cruce correcta');

const paidCashBefore = summarizeCashOutlays(payments).cashOutflowByStore.local_01;
const settled = reclassifyOutlay(payments,'anticipo1','purchase','frutas_verduras');
eq(settled.length,payments.length,'Reclasificar sin crear nueva salida');
eq(summarizeCashOutlays(settled).cashOutflowByStore.local_01,paidCashBefore,'Efectivo descontado una sola vez');
eq(summarizeCashOutlays(settled).openAdvancesByStore.local_01,0,'Anticipo regularizado');
eq(summarizeCashOutlays(settled).merchandisePurchasesByCategory.frutas_verduras,290,'Compra por anticipo clasificada correctamente');
fails(()=>summarizeCashOutlays([...payments,payments[0]]),'No permitir IDs duplicados');
fails(()=>summarizeCashOutlays([{id:'sin_categoria',payingStoreId:'local_01',kind:'purchase',amount:22}]),'Compra requiere categoría');
fails(()=>summarizeCashOutlays([{id:'general',payingStoreId:'local_01',kind:'general_expense',categoryId:'abarrotes',amount:22}]),'Gasto general no se carga automáticamente a Abarrotes');
fails(()=>reclassifyOutlay(payments,'frutas1','purchase','fiesta'),'Solo reclasificar anticipos pendientes');

console.log('OK: movimientos por categoría, caja pagadora y sobrantes');
