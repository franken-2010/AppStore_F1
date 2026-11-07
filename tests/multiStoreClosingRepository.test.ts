import {
  MemoryClosingRepository, registerClosing, correctClosing,
  prepareRegisteredClosing, type RegisterClosingInput,
} from '../services/multiStoreClosingRepository';
import { parseMultiStoreDraftFallback, type MultiStoreCorteDraft } from '../services/multiStoreCorteDraft';

function eq(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) throw new Error(label+': se esperaba '+expected+', se obtuvo '+actual);
}
function check(ok: boolean, label: string) {if(!ok)throw new Error(label);}
async function fails(task:()=>Promise<unknown>|unknown,label:string) {
  try{await task();}catch{return;}
  throw new Error(label+': faltó rechazar caso inválido');
}
const clone = <T>(item:T):T=>JSON.parse(JSON.stringify(item));

const local1=parseMultiStoreDraftFallback([
  'Ventas 455 + 677 + 3343',
  'Fiesta 500',
  'Recargas 200',
  'Estancias 450',
  'Compra Abarrotes 300 + 150',
  'Compra Frutas y verduras 350 pagada caja 1',
  'Renta 600',
  'Pago clientes 200',
  'Consumo empleados 75',
  'Sobrante 40',
  'Dinero entregado 3800',
].join('\n'),'local_01','2026-11-06');
eq(local1.warnings.length,0,'Dictado F1 sin advertencias');
const input: RegisterClosingInput={uid:'usuario_demo',draft:local1,openingCash:0,now:'2026-11-07T02:00:00.000Z'};
const prepared=prepareRegisteredClosing(input);
eq(prepared.id,'cut_local_01_2026-11-06','ID fijo local y fecha');
eq(prepared.audit.classifiedCashSales,5625,'Ventas reales separadas');
eq(prepared.audit.previousDebtCollections,200,'Cobranza no es venta nueva');
eq(prepared.audit.cashOutflows,1400,'Compras y renta pagadas');
eq(prepared.audit.employeeAndOwnerConsumption,75,'Consumo de producto sin efectivo');
eq(prepared.audit.manualSurplus,40,'Sobrante manual, no venta');
eq(prepared.audit.cashDifference,-625,'Faltante reportado');

const repo=new MemoryClosingRepository();
const first=await registerClosing(repo,input);
eq(first.status,'created','Corte nuevo');
const duplicate=await registerClosing(repo,input);
eq(duplicate.status,'duplicate','Segundo intento mismo local/fecha');
eq((await repo.getRevisions(input.uid,prepared.id)).length,1,'No se generan asientos duplicados');

const raceRepo=new MemoryClosingRepository();
const races=await Promise.all([registerClosing(raceRepo,input),registerClosing(raceRepo,input),registerClosing(raceRepo,input)]);
eq(races.filter(x=>x.status==='created').length,1,'Dos envíos simultáneos no duplican el corte');
eq((await raceRepo.getRevisions(input.uid,prepared.id)).length,1,'Una única versión en creación concurrente');

const otherUser=await registerClosing(repo,{...input,uid:'otro_usuario'});
eq(otherUser.status,'created','No se mezclan UIDs distintos');
const local2=parseMultiStoreDraftFallback('Frutas 1000\nPan y galletas 500\nCompra frutas 200\nDinero entregado 1300',
'local_02','2026-11-06');
const from2=await registerClosing(repo,{uid:'usuario_demo',draft:local2,now:'2026-11-07T02:01:00.000Z'});
eq(from2.status,'created','Local 2 misma fecha permitido');
eq(from2.closing.audit.expectedCash,1300,'Corte segundo local independiente');
eq((await repo.getRevisions('usuario_demo',from2.closing.id)).length,1,'Historia Local 2 independiente');

const corrected=clone(local1);
corrected.outlays[0].amount=500; // modificar importe compra Abarrotes
corrected.cash.countedCash=3850;
const update1=await correctClosing(repo,{
  uid:'usuario_demo',draft:corrected,openingCash:0,
  expectedRevision:1,reason:'Corrección comprobante del proveedor',
  now:'2026-11-07T03:00:00.000Z',
});
eq(update1.status,'corrected','Guardar corrección');
eq(update1.closing.revision,2,'Aumentar revisión');
eq(update1.closing.audit.cashPurchases,850,'Compra corregida');
const revisions=await repo.getRevisions(input.uid,prepared.id);
eq(revisions.length,2,'Historial append-only');
eq(revisions[0].after.audit.cashPurchases,800,'Original conserva importe');
eq(revisions[1].before?.audit.cashPurchases,800,'Corrección conserva antes');
eq(revisions[1].after.audit.cashPurchases,850,'Corrección después');
eq(revisions[1].reason,'Corrección comprobante del proveedor','Motivo histórico');
const stale=await correctClosing(repo,{
 uid:'usuario_demo',draft:corrected,expectedRevision:1,
 reason:'Otro operador intentó modificar',
});
eq(stale.status,'conflict','Evitar sobrescribir una versión posterior');
eq((await repo.getRevisions(input.uid,prepared.id)).length,2,'Conflicto no crea eventos');

const originalRead=await repo.get(input.uid,prepared.id);
check(!!originalRead,'Existe el corte');
if(originalRead){originalRead.draft.incomes[0].amount=999_999;}
eq((await repo.get(input.uid,prepared.id))?.draft.incomes[0].amount,4475,'No modificar snapshot al editar respuesta');

const pending=parseMultiStoreDraftFallback('Ventas 100\nAnticipo de caja 50\nDinero entregado 50',
'local_01','2026-11-05');
const advanceSaved=await registerClosing(repo,{
 uid:'usuario_demo',draft:pending,now:'2026-11-07T01:00:00.000Z',
});
eq(advanceSaved.closing.audit.cashOutflows,50,'Anticipo se descuenta una vez');
const advanceReclassified=clone(pending);
advanceReclassified.outlays[0].kind='purchase';
advanceReclassified.outlays[0].categoryId='frutas_verduras';
advanceReclassified.outlays[0].needsReview=false;
const result=await correctClosing(repo,{
 uid:'usuario_demo',draft:advanceReclassified,expectedRevision:1,
 reason:'El anticipo pagó mercancía de frutas',
 now:'2026-11-07T04:00:00.000Z',
});
eq(result.status,'corrected','Anticipo reclasificado');
eq(result.closing.audit.cashOutflows,50,'Efectivo no se descuenta dos veces');
eq(result.closing.audit.purchases.frutas_verduras,50,'Categoría beneficiaria correcta');
eq((await repo.getRevisions(input.uid,result.closing.id)).length,2,'Reclasificación queda auditada');

const missingCash=clone(local1);missingCash.cash.countedCash=null;
await fails(()=>registerClosing(repo,{...input,draft:missingCash}),'Rechazar corte sin dinero contado');
const missingCategory=clone(local1);missingCategory.outlays[1].categoryId=null;
await fails(()=>registerClosing(repo,{...input,draft:missingCategory}),'Rechazar compra sin categoría');
const extraStore=clone(local1);extraStore.outlays[1].payingStoreId='local_02';
await fails(()=>registerClosing(repo,{...input,draft:extraStore}),'Rechazar egreso pagado con caja ajena');
const wrongSale=clone(local1);wrongSale.incomes[0].categoryId='frutas_verduras';
await fails(()=>registerClosing(repo,{...input,draft:wrongSale}),'Venta de otro local no se guarda');
const doubleRow=clone(local1);doubleRow.outlays[1].id=doubleRow.outlays[0].id;
await fails(()=>registerClosing(repo,{...input,draft:doubleRow}),'Dos gastos no pueden tener mismo ID');
const zeroRow=clone(local1);zeroRow.incomes[0].amount=0;
await fails(()=>registerClosing(repo,{...input,draft:zeroRow}),'Movimiento importe cero');
const dirty=clone(local1);dirty.warnings.push('Concepto sin clasificar');
await fails(()=>registerClosing(repo,{...input,draft:dirty}),'Rechazar advertencias no revisadas');
const acknowledged=prepareRegisteredClosing({...input,draft:dirty,acknowledgeWarnings:true});
eq(acknowledged.id,prepared.id,'Permitir advertencias tras reconocerlas explícitamente');
await fails(()=>correctClosing(repo,{
 uid:'usuario_demo',draft:local1,expectedRevision:2,reason:'No',
}),'Rechazar corrección sin motivo');
eq((await repo.getRevisions('otro_usuario',prepared.id)).length,1,'Aislar historial entre usuarios');
console.log('OK: guardado ficticio por local, concurrencia, correcciones e historial protegido');
