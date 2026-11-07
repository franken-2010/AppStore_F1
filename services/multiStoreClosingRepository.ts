import { F1_STORES, makeDailyClosingId, type StoreId, type SalesCategoryId } from './multiStoreAccounting';
import { buildF1AuditSummary, type F1AuditSummary } from './multiStoreCorteSummary';
import type { MultiStoreCorteDraft } from './multiStoreCorteDraft';

/**
 * Persistencia multimodal F1: contrato independiente de Firebase.
 * No consulta la contabilidad histórica ni actualiza saldos de las cuentas viejas.
 */
export type ClosingSource = 'f1_ai' | 'manual';
export interface RegisteredClosing {
  id: string;
  uid: string;
  storeId: StoreId;
  dateKey: string;
  schemaVersion: 1;
  revision: number;
  source: ClosingSource;
  createdAt: string;
  updatedAt: string;
  openingCash: number;
  draft: MultiStoreCorteDraft;
  audit: F1AuditSummary;
}
export interface ClosingRevision {
  closingId: string;
  number: number;
  kind: 'create' | 'correction';
  actorUid: string;
  reason: string;
  updatedAt: string;
  before: RegisteredClosing | null;
  after: RegisteredClosing;
}
export interface SaveOutcome {
  status: 'created' | 'duplicate' | 'corrected' | 'conflict';
  closing: RegisteredClosing;
}
export interface ClosingRepository {
  get(uid: string, closingId: string): Promise<RegisteredClosing | null>;
  createIfAbsent(record: RegisteredClosing, revision: ClosingRevision): Promise<boolean>;
  updateIfVersion(record: RegisteredClosing, expectedRevision: number, revision: ClosingRevision): Promise<boolean>;
  getRevisions(uid: string, closingId: string): Promise<ClosingRevision[]>;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
function assertMoney(amount: number, field: string): number {
  if (!Number.isFinite(amount) || amount < 0) throw new Error(field + ': importe inválido');
  const cents = Math.round(amount * 100);
  if (!Number.isSafeInteger(cents) || Math.abs(cents - amount * 100) > 0.00001)
    throw new Error(field + ': requiere máximo dos decimales');
  return amount;
}
function assertUid(uid: string): void {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(uid)) throw new Error('Identificador de usuario inválido');
}
function assertTimestamp(value: string): void {
  if (!Number.isFinite(Date.parse(value)) || !value.endsWith('Z')) throw new Error('Fecha de registro inválida');
}
function assertDraft(draft: MultiStoreCorteDraft, openingCash: number, acknowledgeWarnings: boolean) {
  if (draft.version !== 2) throw new Error('Versión de corte desconocida');
  makeDailyClosingId(draft.storeId, draft.dateKey);
  assertMoney(openingCash, 'Fondo inicial');
  if (draft.incomes.length + draft.outlays.length === 0)
    throw new Error('El corte debe contener al menos un movimiento');
  if (draft.incomes.length > 100 || draft.outlays.length > 100)
    throw new Error('Demasiados movimientos para un corte');
  if (draft.cash.countedCash === null) throw new Error('Falta el efectivo contado');
  assertMoney(draft.cash.countedCash, 'Dinero contado');
  if (draft.cash.manualSurplus !== null) assertMoney(draft.cash.manualSurplus,'Sobrante declarado');
  if (draft.warnings.length > 0 && !acknowledgeWarnings)
    throw new Error('Existen advertencias del dictado; deben revisarse y aceptarse antes de registrar');

  const ids = new Set<string>();
  const categories = new Set<SalesCategoryId>(F1_STORES.flatMap(s=>s.categories));
  const selected=F1_STORES.find(s=>s.id===draft.storeId)!;
  for (const [index, row] of draft.incomes.entries()) {
    if (!row.id || ids.has('in:'+row.id)) throw new Error('Ingreso duplicado '+(index+1));
    ids.add('in:'+row.id);
    assertMoney(row.amount,'Ingreso '+row.id);
    if (row.amount <= 0) throw new Error('Ingreso sin importe: '+row.id);
    if (row.needsReview) throw new Error('Ingreso pendiente de revisión: '+row.id);
    if (row.kind==='collection') {
      if (row.categoryId !== null) throw new Error('Cobranza no debe tener categoría de venta nueva');
    } else if (!row.categoryId || !selected.categories.includes(row.categoryId)) {
      throw new Error('Venta asignada a categoría de otro local: '+row.id);
    }
  }
  for (const [index, row] of draft.outlays.entries()) {
    if (!row.id || ids.has('out:'+row.id)) throw new Error('Salida duplicada '+(index+1));
    ids.add('out:'+row.id);
    assertMoney(row.amount,'Salida '+row.id);
    if(row.amount <= 0) throw new Error('Salida sin importe: '+row.id);
    if(row.needsReview) throw new Error('Salida pendiente de revisión: '+row.id);
    if (!row.concept.trim()) throw new Error('Salida sin concepto: '+row.id);
    if (!F1_STORES.some(s=>s.id===row.payingStoreId)) throw new Error('Caja pagadora inválida');
    // El corte de un local no puede registrar débito de otra caja todavía:
    // requiere un protocolo de traspaso/pago cruzado específico.
    if (row.kind !== 'non_cash_consumption' && row.payingStoreId !== draft.storeId) {
      throw new Error('Pago desde otra caja: debe asentarse en el corte de esa caja');
    }
    if (row.kind==='purchase'||row.kind==='direct_expense') {
      if (!row.categoryId || !categories.has(row.categoryId))
        throw new Error('Compra/gasto sin categoría beneficiaria: '+row.id);
    } else if (row.categoryId !== null && row.kind !== 'non_cash_consumption') {
      throw new Error('La categoría no aplica a este tipo de salida: '+row.id);
    }
  }
  const audit=buildF1AuditSummary(draft, openingCash);
  if(audit.unresolved > 0) throw new Error('Hay movimientos sin clasificar');
  return audit;
}

export interface RegisterClosingInput {
  uid: string;
  draft: MultiStoreCorteDraft;
  openingCash?: number;
  source?: ClosingSource;
  acknowledgeWarnings?: boolean;
  now?: string;
}
export function prepareRegisteredClosing(input: RegisterClosingInput): RegisteredClosing {
  assertUid(input.uid);
  const draft=clone(input.draft);
  const openingCash=input.openingCash ?? 0;
  const audit=assertDraft(draft,openingCash,Boolean(input.acknowledgeWarnings));
  const now=input.now??new Date().toISOString();
  assertTimestamp(now);
  return {
    id:makeDailyClosingId(draft.storeId,draft.dateKey),
    uid:input.uid,storeId:draft.storeId,dateKey:draft.dateKey,
    schemaVersion:1,revision:1,source:input.source??'f1_ai',
    createdAt:now,updatedAt:now,openingCash,draft,audit,
  };
}

/** Intento único: si la fecha/local ya existe, jamás suma otra vez al ledger. */
export async function registerClosing(
  repo: ClosingRepository,input: RegisterClosingInput,
): Promise<SaveOutcome> {
  const record=prepareRegisteredClosing(input);
  const event: ClosingRevision = {
    closingId:record.id,number:1,kind:'create',
    actorUid:record.uid,reason:'Registro inicial',updatedAt:record.createdAt,
    before:null,after:clone(record),
  };
  const created=await repo.createIfAbsent(record,event);
  if (created) return {status:'created',closing:clone(record)};
  const previous=await repo.get(record.uid,record.id);
  if (!previous) throw new Error('Corte ocupado; inténtalo de nuevo');
  return {status:'duplicate',closing:previous};
}

export interface CorrectClosingInput extends RegisterClosingInput {
  expectedRevision: number;
  reason: string;
}
export async function correctClosing(
  repo: ClosingRepository,input: CorrectClosingInput,
): Promise<SaveOutcome> {
  assertUid(input.uid);
  if(!input.reason || input.reason.trim().length < 8 || input.reason.trim().length>500)
    throw new Error('Es obligatorio explicar la corrección (8 a 500 caracteres)');
  const id=makeDailyClosingId(input.draft.storeId,input.draft.dateKey);
  const existing=await repo.get(input.uid,id);
  if(!existing) throw new Error('No existe ese corte para corregir');
  if(existing.revision !== input.expectedRevision) return {status:'conflict',closing:existing};
  const prepared=prepareRegisteredClosing(input);
  const updated:RegisteredClosing={
    ...prepared,revision:existing.revision+1,createdAt:existing.createdAt,
  };
  const event:ClosingRevision={
    closingId:id,number:updated.revision,kind:'correction',
    actorUid:input.uid,reason:input.reason.trim(),updatedAt:updated.updatedAt,
    before:clone(existing),after:clone(updated),
  };
  const ok=await repo.updateIfVersion(updated,existing.revision,event);
  if(ok) return {status:'corrected',closing:clone(updated)};
  const latest=await repo.get(input.uid,id);
  if(!latest) throw new Error('Corte desapareció durante la corrección');
  return {status:'conflict',closing:latest};
}

/** Implementación aislada para ensayos; persiste solo en memoria del navegador/proceso. */
export class MemoryClosingRepository implements ClosingRepository {
  private readonly records=new Map<string,RegisteredClosing>();
  private readonly events=new Map<string,ClosingRevision[]>();
  private key(uid:string,id:string) {return uid+'/'+id;}
  async get(uid:string,closingId:string) {
    assertUid(uid);
    const found=this.records.get(this.key(uid,closingId));
    return found ? clone(found) : null;
  }
  async createIfAbsent(record:RegisteredClosing,event:ClosingRevision):Promise<boolean> {
    const key=this.key(record.uid,record.id);
    if(this.records.has(key))return false;
    this.records.set(key,clone(record));
    this.events.set(key,[clone(event)]);
    return true;
  }
  async updateIfVersion(record:RegisteredClosing,expectedRevision:number,event:ClosingRevision):Promise<boolean> {
    const key=this.key(record.uid,record.id);
    const previous=this.records.get(key);
    if(!previous || previous.revision!==expectedRevision)return false;
    if(record.uid!==previous.uid||record.id!==previous.id||
       record.storeId!==previous.storeId||record.dateKey!==previous.dateKey)
      throw new Error('No se puede cambiar el propietario, local ni fecha de un corte');
    if(record.revision!==expectedRevision+1||event.number!==record.revision)
      throw new Error('Número de revisión inválido');
    this.records.set(key,clone(record));
    this.events.set(key,[...(this.events.get(key)||[]).map(x=>clone(x)),clone(event)]);
    return true;
  }
  async getRevisions(uid:string,closingId:string) {
    assertUid(uid);
    return clone(this.events.get(this.key(uid,closingId))||[]);
  }
}
