import { inferF1Category, normalizeMultiStoreDraft, parseMultiStoreDraftFallback } from '../services/multiStoreCorteDraft';
import { buildF1AuditSummary } from '../services/multiStoreCorteSummary';

const eq=(a:unknown,b:unknown,label:string) => {
  if (a!==b) throw new Error(label+': esperaba '+b+', obtuve '+a);
};
const check=(v:boolean,label:string) => {if(!v)throw new Error(label);};
eq(inferF1Category('Ventas 455 + 677 + 3343'),'abarrotes','Ventas = Abarrotes');
eq(inferF1Category('Fiesta 800'),'fiesta','Fiesta automática');
eq(inferF1Category('Recargas 400'),'recargas','Recargas automática');
eq(inferF1Category('Estancias 500'),'estancias','Estancias automática');
eq(inferF1Category('Gastos abarrotes 80'),'abarrotes','Gastos abarrotes automáticos');
eq(inferF1Category('Compra Frutas y verduras 300'),'frutas_verduras','Frutas automática');
eq(inferF1Category('Pan y galletas 150'),'pan_galletas','Pan automático');
eq(inferF1Category('Comida preparada 200'),'comida_preparada','Comida automática');

const raw=[
  'Ventas 455 + 677 + 3343',
  'Fiesta 500',
  'Recargas 200',
  'Estancias 450',
  'Gastos Abarrotes 300 + 150',
  'Compra Frutas y verduras 350',
  'Renta 600',
  'Pago clientes 200',
  'Consumo empleados 75',
  'Dinero entregado 3800',
].join('\n');
const draft=parseMultiStoreDraftFallback(raw,'local_01','2026-11-06');
eq(draft.incomes.length,5,'Ventas y cobranza');
eq(draft.incomes.find(i=>i.categoryId==='abarrotes')?.amount,4475,'Suma de Ventas');
eq(draft.incomes.find(i=>i.categoryId==='fiesta')?.amount,500,'Fiesta');
eq(draft.outlays.find(i=>i.categoryId==='frutas_verduras')?.amount,350,'Compra Frutas');
eq(draft.outlays.find(i=>i.categoryId==='frutas_verduras')?.payingStoreId,'local_01','Pagó Caja 1 por defecto');
eq(draft.outlays.find(i=>i.categoryId==='frutas_verduras')?.needsReview,false,'No pedir elegir la caja innecesariamente');
eq(draft.outlays.find(i=>i.categoryId==='abarrotes')?.amount,450,'Compra Abarrotes');
eq(draft.outlays.find(i=>i.kind==='general_expense')?.amount,600,'Renta');
eq(draft.outlays.find(i=>i.kind==='non_cash_consumption')?.amount,75,'Consumo sin efectivo');
eq(draft.cash.countedCash,3800,'Dinero contado');

const audit=buildF1AuditSummary(draft);
eq(audit.cashSales.abarrotes,4475,'Auditoría Ventas Abarrotes');
eq(audit.cashSales.fiesta,500,'Auditoría Fiesta');
eq(audit.cashSales.recargas,200,'Auditoría Recargas');
eq(audit.cashSales.estancias,450,'Auditoría Estancias');
eq(audit.classifiedCashSales,5625,'Ventas contadas');
eq(audit.previousDebtCollections,200,'Cobranza separada');
eq(audit.totalCashEntries,5825,'Entradas en efectivo');
eq(audit.cashPurchases,800,'Compras efectivo, abarrotes y frutas');
eq(audit.cashGeneralExpenses,600,'Renta pagada en efectivo');
eq(audit.cashOutflows,1400,'Egresos caja sin consumo mercancía');
eq(audit.expectedCash,4425,'Efectivo esperado');
eq(audit.cashDifference,-625,'Diferencia de caja');
eq(audit.surplus,0,'No declarar sobrante cuando realmente falta efectivo');
eq(audit.shortage,625,'Faltante calculado automáticamente');
const positive = structuredClone(draft);
positive.cash.countedCash = 4465;
const surplusAudit = buildF1AuditSummary(positive);
eq(surplusAudit.expectedCash,4425,'Efectivo esperado fijo');
eq(surplusAudit.cashDifference,40,'Diferencia automática positiva');
eq(surplusAudit.surplus,40,'Sobrante calculado sin captura');
eq(surplusAudit.shortage,0,'Sin faltante cuando hay sobrante');

eq(audit.employeeAndOwnerConsumption,75,'Consumo sin salida efectivo');
eq(audit.unresolved,0,'Conceptos explícitos no necesitan etiquetarse otra vez');

const onlyTwoLines=parseMultiStoreDraftFallback('Ventas 455 + 677 + 3343\nFiesta 900','local_01','2026-11-06');
eq(onlyTwoLines.incomes[0].amount,4475,'Dictado abreviado suma');
eq(onlyTwoLines.incomes[1].categoryId,'fiesta','Dictado abreviado Fiesta');
eq(buildF1AuditSummary(onlyTwoLines).unresolved,0,'Corte claro sin reetiquetar');

const geminiNoCategory=normalizeMultiStoreDraft({
  incomes:[{kind:'cash_sale',amount:1530,rawText:'Ventas 530 + 1000'}],
  outlays:[{kind:'purchase',amount:350,rawText:'Compra Frutas y verduras 350',concept:'Compra Frutas'}],
  cash:{countedCash:1180},
},'local_01','2026-11-06','gemini');
eq(geminiNoCategory.incomes[0].categoryId,'abarrotes','Normalización IA infiere Ventas');
eq(geminiNoCategory.outlays[0].categoryId,'frutas_verduras','Normalización IA infiere compra Frutas');
eq(geminiNoCategory.outlays[0].payingStoreId,'local_01','Normalización caja pagadora por defecto');
eq(geminiNoCategory.outlays[0].needsReview,false,'No exigir repetir categoría/caja ya indicadas');
eq(buildF1AuditSummary(geminiNoCategory).unresolved,0,'Auditoría IA lista sin etiquetado manual');

const needsHelp=normalizeMultiStoreDraft({
  outlays:[{kind:'purchase',amount:150,rawText:'Proveedor desconocido 150',concept:'Proveedor desconocido'}],
},'local_01','2026-11-06','gemini');
check(needsHelp.outlays[0].needsReview,'Proveedor ambiguo requiere intervención');
eq(buildF1AuditSummary(needsHelp).unresolved,1,'Marcar solo movimientos ambiguos');
console.log('OK: captura rápida F1, etiquetas automáticas y auditoría clásica');
