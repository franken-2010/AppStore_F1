import { normalizeMultiStoreDraft, parseMultiStoreDraftFallback } from '../services/multiStoreCorteDraft';

function eq(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) throw new Error(label + ': esperado ' + expected + ', recibido ' + actual);
}
function check(cond: boolean, label: string) {
  if (!cond) throw new Error(label);
}

const draft = parseMultiStoreDraftFallback([
  'Ventas Abarrotes 100 + 200',
  'Ventas Fiesta 450',
  'Compra Frutas y verduras 650 pagada caja 1',
  'Compra Fiesta 120 + 80 pagada caja 1',
  'Renta 600 pagada caja 1',
  'Pago de clientes 300',
  'Consumo empleados 100',
  'Sobrante 45',
  'Dinero entregado 1650',
].join('\n'), 'local_01','2026-11-06');
eq(draft.engine,'local','Fallback conservador');
eq(draft.incomes.length,3,'Tres renglones de ingreso');
eq(draft.incomes[0].amount,300,'Suma exacta de ventas');
eq(draft.incomes[2].kind,'collection','Cobranza no es venta nueva');
eq(draft.outlays.length,4,'Múltiples movimientos distintos');
eq(draft.outlays[0].categoryId,'frutas_verduras','Categoría beneficiaria Local 2');
eq(draft.outlays[0].payingStoreId,'local_01','Caja pagadora Local 1');
eq(draft.outlays[0].amount,650,'No sumar 1 de identificador Caja 1');
eq(draft.outlays[1].categoryId,'fiesta','Compra Fiesta');
eq(draft.outlays[1].amount,200,'Sumas compra Fiesta');
eq(draft.outlays[2].kind,'general_expense','Renta no es mercancía');
eq(draft.outlays[2].concept,'Renta 600 pagada caja 1','Conservar concepto original');
eq(draft.outlays[3].kind,'non_cash_consumption','Consumo de empleados NO es efectivo');
eq(draft.cash.manualSurplus,45,'Sobrante manual');
eq(draft.cash.countedCash,1650,'Efectivo declarado');

const ambiguous = parseMultiStoreDraftFallback(
  'Compra fruta 25,50 caja 1\nCompra fruta 3 cajas por 200\nProveedor desconocido 700\nVenta Frutas 85',
  'local_01','2026-11-06');
check(ambiguous.warnings.some(w=>w.includes('coma decimal')), 'Coma decimal requiere revisión');
check(ambiguous.warnings.some(w=>w.includes('Varios importes')), 'Unidades de compra no se suman silenciosamente');
check(ambiguous.outlays.some(m=>m.categoryId===null&&m.needsReview), 'Proveedor sin categoría marcado');
check(ambiguous.incomes.some(i=>i.categoryId==='frutas_verduras'&&i.needsReview), 'Venta fuera de local debe revisarse');

const clean = normalizeMultiStoreDraft({
  incomes:[
    {kind:'cash_sale',categoryId:'abarrotes',amount:100.25,rawText:'Abarrotes 100.25'},
    {kind:'collection',categoryId:'abarrotes',amount:40,rawText:'Cobro cliente 40'},
    {kind:'cash_sale',categoryId:'inventado',amount:10,rawText:'Desconocido 10'},
    {kind:'cash_sale',categoryId:'fiesta',amount:-3,rawText:'Importe inválido'},
  ],
  outlays:[
    {kind:'purchase',categoryId:'frutas_verduras',payingStoreId:'local_01',amount:30.5,concept:'Proveedor fruta',rawText:'Pagué fruta 30.50 caja 1'},
    {kind:'purchase',categoryId:'inventada',amount:24,concept:'Compra desconocida',rawText:'Compra extra 24'},
  ],
  cash:{countedCash:450,manualSurplus:15},
  warnings:[],
}, 'local_01','2026-11-06','gemini');
eq(clean.incomes.length,3,'Descartar importes negativos de IA');
eq(clean.incomes[1].categoryId,null,'Cobro no añade venta a categoría');
eq(clean.incomes[2].categoryId,null,'Categoría inventada invalidada');
check(clean.incomes[2].needsReview,'Categoría desconocida requiere revisión');
eq(clean.outlays[0].payingStoreId,'local_01','Caja expresa permanece');
eq(clean.outlays[1].payingStoreId,'local_01','Caja sin especificar usa provisionalmente la seleccionada');
check(clean.outlays[1].needsReview,'Caja inferida requiere revisión');
eq(clean.cash.manualSurplus,15,'Sobrante no se borra');
check(clean.warnings.length>=2,'Alertas cuando IA entrega datos dudosos');
console.log('OK: borrador F1-AI multilocal, categorías y conciliación conservadora');
