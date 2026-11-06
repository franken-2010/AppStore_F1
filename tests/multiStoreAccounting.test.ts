import { allocateOverheadExpenses, calculateCashClosing } from '../services/multiStoreAccounting';
function eq(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) throw new Error(label + ': esperado ' + expected + ', recibido ' + actual);
}
function fails(fn: () => unknown, label: string) {
  try { fn(); } catch { return; }
  throw new Error(label + ': falta validación');
}
const cut = calculateCashClosing({
  storeId:'local_02',dateKey:'2026-11-06',openingCash:500,
  categorySales:[
    {categoryId:'frutas_verduras',cashSales:1850},
    {categoryId:'pan_galletas',cashSales:920},
    {categoryId:'comida_preparada',cashSales:1030,creditSales:400},
  ],
  cashCollections:200,cashPurchases:650,cashOperatingExpenses:150,
  cashTransfersOut:100,cashWithdrawals:50,countedCash:3560,
});
eq(cut.classifiedTotalSales,4200,'Ventas clasificadas');
eq(cut.classifiedCashSales,3800,'Ventas de contado');
eq(cut.expectedCash,3550,'Caja esperada');
eq(cut.variance,10,'Sobrante');
eq(cut.surplusPendingIdentification,10,'Sobrante no identificado');
eq(cut.adjustedGeneralReceipts,3810,'Ingreso operativo de caja ajustado');
eq(cut.classifiedTotalSales,4200,'No convertir sobrante en venta');
const shortage = calculateCashClosing({
  storeId:'local_01',dateKey:'2026-11-06',openingCash:0,
  categorySales:[{categoryId:'fiesta',cashSales:100}],countedCash:97.99,
});
eq(shortage.shortagePendingInvestigation,2.01,'Faltante');
eq(shortage.surplusPendingIdentification,0,'Faltante sin sobrante');
fails(()=>calculateCashClosing({
  storeId:'local_01',dateKey:'2026-11-06',openingCash:0,
  categorySales:[{categoryId:'comida_preparada',cashSales:20}],countedCash:0,
}),'Categoría de otro local');
fails(()=>calculateCashClosing({
  storeId:'local_01',dateKey:'2026-11-06',openingCash:0,
  categorySales:[{categoryId:'fiesta',cashSales:20},{categoryId:'fiesta',cashSales:10}],countedCash:0,
}),'Categoría duplicada');
const r=allocateOverheadExpenses([
  {storeId:'local_01',categoryId:'abarrotes',eligibleRevenue:100},
  {storeId:'local_01',categoryId:'fiesta',eligibleRevenue:100},
  {storeId:'local_02',categoryId:'frutas_verduras',eligibleRevenue:100},
],[
  {id:'renta',concept:'Renta general',amount:10,scope:{kind:'company'}},
  {id:'sueldos',concept:'Sueldo local 2',amount:7,scope:{kind:'store',storeId:'local_02'}},
  {id:'directo',concept:'Mantenimiento Fiesta',amount:4,scope:{kind:'category',storeId:'local_01',categoryId:'fiesta'}},
]);
eq(r.totalExpenses,21,'Total gastos');
eq(r.totalAllocated,21,'Gastos asignados');
eq(r.totalUnallocated,0,'Nada pendiente');
eq(r.allocations.filter(x=>x.expenseId==='renta').reduce((a,b)=>a+b.amount,0),10,'Renta cuadrada');
eq(r.allocations.filter(x=>x.expenseId==='renta'&&x.amount===3.34).length,1,'Centavo sobrante');
if(r.allocations.some(x=>x.expenseId==='sueldos'&&x.storeId!=='local_02'))throw new Error('Sueldo cargado a local incorrecto');
if(r.allocations.some(x=>x.expenseId==='directo'&&x.categoryId!=='fiesta'))throw new Error('Gasto directo en categoría incorrecta');
const noRevenue=allocateOverheadExpenses([],[
  {id:'general',concept:'Gasto compartido',amount:35,scope:{kind:'company'}},
  {id:'directo',concept:'Gasto directo',amount:7,scope:{kind:'category',storeId:'local_02',categoryId:'pan_galletas'}},
]);
eq(noRevenue.totalAllocated,7,'Gasto directo sin ventas');
eq(noRevenue.totalUnallocated,35,'Sin reparto arbitrario');
if(noRevenue.allocations.some(x=>x.categoryId==='abarrotes'))throw new Error('Abarrotes carga gasto no asignado');
const cents=allocateOverheadExpenses([
  {storeId:'local_01',categoryId:'abarrotes',eligibleRevenue:1},
  {storeId:'local_01',categoryId:'fiesta',eligibleRevenue:1},
  {storeId:'local_01',categoryId:'recargas',eligibleRevenue:1},
],[{id:'c',concept:'Un centavo',amount:0.01,scope:{kind:'company'}}]);
eq(cents.totalAllocated,0.01,'Conservar centavo');
eq(cents.allocations.length,1,'Asignar un solo centavo');
console.log('OK: pruebas del motor multilocal F1');
