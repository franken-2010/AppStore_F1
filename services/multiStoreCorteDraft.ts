import { F1_STORES, F1_CATEGORY_LABELS, type SalesCategoryId, type StoreId } from './multiStoreAccounting';

export type DraftIncomeKind = 'cash_sale' | 'credit_sale' | 'collection';
export type DraftOutlayKind =
  'purchase' | 'direct_expense' | 'general_expense' |
  'temporary_advance' | 'owner_withdrawal' | 'non_cash_consumption';

export interface DraftIncome {
  id: string;
  kind: DraftIncomeKind;
  categoryId: SalesCategoryId | null;
  amount: number;
  rawText: string;
  needsReview: boolean;
}
export interface DraftOutlay {
  id: string;
  kind: DraftOutlayKind;
  categoryId: SalesCategoryId | null;
  payingStoreId: StoreId;
  amount: number;
  concept: string;
  rawText: string;
  needsReview: boolean;
}
export interface MultiStoreCorteDraft {
  version: 2;
  storeId: StoreId;
  dateKey: string;
  incomes: DraftIncome[];
  outlays: DraftOutlay[];
  cash: {
    countedCash: number | null;
    manualSurplus: number | null;
  };
  warnings: string[];
  engine: 'gemini' | 'local';
}

type DraftRaw = {
  incomes?: unknown;
  outlays?: unknown;
  cash?: unknown;
  warnings?: unknown;
};

const CATEGORIES = Object.keys(F1_CATEGORY_LABELS) as SalesCategoryId[];
const INCOME_TYPES: DraftIncomeKind[] = ['cash_sale','credit_sale','collection'];
const OUTLAY_TYPES: DraftOutlayKind[] =
  ['purchase','direct_expense','general_expense','temporary_advance','owner_withdrawal','non_cash_consumption'];

function safeAmount(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1_000_000_000) return null;
  const cents = Math.round(value * 100);
  return Math.abs(value * 100 - cents) < 0.001 ? cents / 100 : null;
}
function safeText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}
function categoryOf(value: unknown): SalesCategoryId | null {
  return typeof value === 'string' && CATEGORIES.includes(value as SalesCategoryId)
    ? value as SalesCategoryId : null;
}

/**
 * Convenciones conocidas de F1: "Ventas" sin más calificativo = Abarrotes.
 * Solo una etiqueta sin ambigüedad se clasifica automáticamente.
 */
export function inferF1Category(label: string): SalesCategoryId | null {
  const t = label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/\b(frutas?|verduras?|vegetales?|hortalizas?)\b/.test(t)) return 'frutas_verduras';
  if (/\b(panaderia|panes?|galletas?)\b/.test(t)) return 'pan_galletas';
  if (/\b(comida\s+preparada|alimentos?\s+preparados?|sandwich|sanduich|licuados?|waffles?|tortas?|desayunos?)\b/.test(t)) return 'comida_preparada';
  if (/\b(fiesta|desechables?|globos?)\b/.test(t)) return 'fiesta';
  if (/\b(recargas?|tiempo\s+aire|tae)\b/.test(t)) return 'recargas';
  if (/\b(estancias?|cuartos?|hospedaje)\b/.test(t)) return 'estancias';
  if (/\b(ventas?|abarrotes?|tienda|mercancias?|surtido|refrescos?)\b/.test(t)) return 'abarrotes';
  return null;
}
function isStoreId(value: unknown): value is StoreId {
  return value === 'local_01' || value === 'local_02';
}
function plainArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.slice(0, 100).filter(
    (row): row is Record<string, unknown> => !!row && typeof row === 'object' && !Array.isArray(row),
  ) : [];
}

export function normalizeMultiStoreDraft(
  raw: DraftRaw, storeId: StoreId, dateKey: string, engine: 'gemini' | 'local',
): MultiStoreCorteDraft {
  if (!isStoreId(storeId) || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) throw new Error('Local o fecha inválidos');
  const warnings: string[] = Array.isArray(raw?.warnings)
    ? raw.warnings.filter((s): s is string => typeof s === 'string').slice(0, 30).map(x => x.slice(0, 220))
    : [];
  const incomes: DraftIncome[] = [];
  for (const [index, row] of plainArray(raw?.incomes).entries()) {
    const amount = safeAmount(row.amount);
    if (amount === null || amount === 0) {
      warnings.push('Ingreso ' + (index + 1) + ': importe faltante o inválido');
      continue;
    }
    const kind = INCOME_TYPES.includes(row.kind as DraftIncomeKind) ? row.kind as DraftIncomeKind : 'cash_sale';
    const category = categoryOf(row.categoryId) ?? inferF1Category(safeText(row.rawText, 280));
    const needsReview = kind !== 'collection' && (
      category === null || !F1_STORES.find(s => s.id === storeId)?.categories.includes(category)
    );
    incomes.push({
      id: 'income-' + index, kind, categoryId: kind === 'collection' ? null : category,
      amount, rawText: safeText(row.rawText, 280),
      needsReview: needsReview || Boolean(row.needsReview) || !INCOME_TYPES.includes(row.kind as DraftIncomeKind),
    });
    if (needsReview) warnings.push('Ingreso ' + (index + 1) + ': revisar categoría/local antes de guardar');
  }
  const outlays: DraftOutlay[] = [];
  for (const [index, row] of plainArray(raw?.outlays).entries()) {
    const amount = safeAmount(row.amount);
    if (amount === null || amount === 0) {
      warnings.push('Salida ' + (index + 1) + ': importe faltante o inválido');
      continue;
    }
    const validKind = OUTLAY_TYPES.includes(row.kind as DraftOutlayKind);
    const kind = validKind ? row.kind as DraftOutlayKind : 'general_expense';
    const category = categoryOf(row.categoryId) ?? inferF1Category(
      safeText(row.rawText, 280) || safeText(row.concept, 160)
    );
    const hasExplicitPayer = isStoreId(row.payingStoreId);
    const payingStoreId = hasExplicitPayer ? row.payingStoreId as StoreId : storeId;
    const needsCategory = kind === 'purchase' || kind === 'direct_expense';
    const needsReview = !validKind || (needsCategory && !category) || Boolean(row.needsReview);
    outlays.push({
      id: 'outlay-' + index, kind, categoryId: needsCategory ? category : null,
      payingStoreId, amount, concept: safeText(row.concept, 160),
      rawText: safeText(row.rawText, 280), needsReview,
    });
    if (needsReview) warnings.push('Salida ' + (index + 1) + ': verificar tipo o categoría');
  }
  const cash = raw?.cash && typeof raw.cash === 'object' && !Array.isArray(raw.cash)
    ? raw.cash as Record<string, unknown> : {};
  const countedCash = cash.countedCash == null ? null : safeAmount(cash.countedCash);
  const manualSurplus = cash.manualSurplus == null ? null : safeAmount(cash.manualSurplus);
  if (cash.countedCash != null && countedCash === null) warnings.push('Efectivo contado inválido');
  if (cash.manualSurplus != null && manualSurplus === null) warnings.push('Sobrante manual inválido');
  return {version: 2, storeId, dateKey, incomes, outlays,
    cash: {countedCash, manualSurplus}, warnings, engine};
}

/** Fallback local intencionalmente conservador: líneas ambiguas quedan pendientes. */
function cleanLabel(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
function findCategory(line: string): SalesCategoryId | null {
  return inferF1Category(line);
}
function lineAmounts(line: string): number[] {
  const withoutDates = line.replace(/\b\d{1,4}[/-]\d{1,2}[/-]\d{2,4}\b/g,' ')
    // El número de caja/local es un identificador, NO dinero.
    .replace(/\b(?:caja|local)\s*(?:1|2|uno|dos)\b/gi,' ');
  const matches = withoutDates.match(/(?:\$?\s*\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\$?\s*\d+(?:\.\d{1,2})?)/g) || [];
  return matches.map(s => Number(s.replace(/[$,\s]/g,'')))
    .filter(s => Number.isFinite(s) && s >= 0);
}
function fallbackSum(line: string): number | null {
  const numbers = lineAmounts(line);
  if (!numbers.length) return null;
  return Math.round(numbers.reduce((a,b) => a+b,0) * 100)/100;
}
function findPayer(line: string): StoreId | null {
  const x = cleanLabel(line);
  if (/caja\s*(?:1|uno)\b|local\s*(?:1|uno)\b/.test(x)) return 'local_01';
  if (/caja\s*(?:2|dos)\b|local\s*(?:2|dos)\b/.test(x)) return 'local_02';
  return null;
}

/**
 * Este parser no intenta adivinar la categoría de un proveedor desconocido.
 * Si una línea incluye dos conceptos independientes, dividirla antes de validar.
 */
export function parseMultiStoreDraftFallback(
  rawText: string, storeId: StoreId, dateKey: string,
): MultiStoreCorteDraft {
  const incomes: Record<string, unknown>[] = [];
  const outlays: Record<string, unknown>[] = [];
  const warnings: string[] = [];
  const cash: Record<string, unknown> = {};
  const lines = rawText
    .split(/[\r\n;]+/)
    .flatMap(line => line.split(/(?<=\d)\s+(?:y\s+)?(?=(?:ventas?|fiesta|recargas?|estancias?|frutas?|verduras?|pan(?:aderia)?|galletas?|comida\s+preparada|compras?|gastos?|pago\s+clientes?|sueldos?|nomina|renta|luz|agua|internet|sobrante|dinero\s+entregado)\b)/i))
    .map(s => s.trim()).filter(Boolean).slice(0, 150);
  for (const line of lines) {
    const lower = cleanLabel(line);
    if (/^subtotal\b|^total\s+(de\s+)?(ingreso|venta|egreso)|^resultado\b/.test(lower)) continue;
    // Comas decimales como "25,50" NO deben convertirse en 25 + 50.
    if (/\b\d+,\d{1,2}\b/.test(line)) {
      warnings.push('Importe con coma decimal: revisar manualmente «' + line.slice(0,100) + '»');
      continue;
    }
    const withoutPayer = line.replace(/\b(?:caja|local)\s*(?:1|2|uno|dos)\b/gi,' ');
    const amounts = lineAmounts(withoutPayer);
    // Varios números sin operador explícito pueden ser unidades, referencias o importes.
    if (amounts.length > 1 && !/\+|\b(?:mas|más)\b/i.test(withoutPayer)) {
      warnings.push('Varios importes sin suma clara: revisar «' + line.slice(0,100) + '»');
      continue;
    }
    const amount = fallbackSum(line);
    if (amount === null) { warnings.push('Sin importe: ' + line.slice(0,100)); continue; }
    if (/sobrante/.test(lower)) { cash.manualSurplus = amount; continue; }
    if (/entregad|efectivo\s+final|caja\s+final|dinero\s+contado|dinero\s+en\s+caja/.test(lower)) {
      cash.countedCash = amount; continue;
    }
    const categoryId = findCategory(line);
    const payer = findPayer(line);
    const collection = /(pago|cobro|abono|pagaron).*?(cliente|cuenta|deuda|cxc)/.test(lower);
    const credit = /credito|fiad|a\s+cuenta|cxc/.test(lower);
    const nonCash = /consumo\s+(de\s+)?(emplead|personal)|cortesia/.test(lower);
    const expense = /compr[ao]|gasto|casto|costo|pago|pag(ue|amos|ado)|proveedor|renta|nomina|sueldo|mantenimiento|retiro|anticipo|prestamo|luz|agua|internet|cfe\b|egreso/.test(lower);
    const clearlySale = /venta|vendimos|ingreso|recargas|fiesta|abarrotes|estancias/.test(lower) && !expense;
    if (collection) {
      incomes.push({kind:'collection',categoryId:null,amount,rawText:line}); continue;
    }
    if (credit && !expense) {
      incomes.push({kind:'credit_sale',categoryId,amount,rawText:line,needsReview:!categoryId}); continue;
    }
    if (nonCash) {
      outlays.push({kind:'non_cash_consumption',categoryId:null,payingStoreId:payer||storeId,
        amount,rawText:line,concept:line,needsReview:true}); continue;
    }
    if (expense) {
      let kind: DraftOutlayKind = 'purchase';
      if (/anticipo|prestamo/.test(lower)) kind = 'temporary_advance';
      else if (/retiro|para\s+mi\s+casa/.test(lower)) kind = 'owner_withdrawal';
      else if (/renta|nomina|sueldo|mantenimiento|luz|agua|internet|cfe\b|administrativ|limpieza/.test(lower)) kind = 'general_expense';
      else if (/gasto/.test(lower) && categoryId) kind = 'direct_expense';
      const needsCategory = kind === 'purchase' || kind === 'direct_expense';
      outlays.push({kind,categoryId:needsCategory?categoryId:null,payingStoreId:payer||storeId,
        amount,concept:line,rawText:line,needsReview:(needsCategory&&!categoryId)});
      continue;
    }
    if (clearlySale || categoryId) {
      incomes.push({kind:'cash_sale',categoryId,amount,rawText:line,needsReview:!categoryId});
      continue;
    }
    warnings.push('No clasificado: ' + line.slice(0,100));
  }
  return normalizeMultiStoreDraft({incomes,outlays,cash,warnings},storeId,dateKey,'local');
}
