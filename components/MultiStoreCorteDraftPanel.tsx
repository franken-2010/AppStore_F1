import React, { useEffect, useMemo, useRef, useState } from 'react';
import VoiceInputButton from './VoiceInputButton';
import { parseMultiStoreDraftFallback } from '../services/multiStoreCorteDraft';
import { F1_CATEGORY_LABELS, F1_STORES, calculateCashClosing,
  type StoreId, type SalesCategoryId } from '../services/multiStoreAccounting';
import type {
  MultiStoreCorteDraft, DraftIncomeKind, DraftOutlayKind,
} from '../services/multiStoreCorteDraft';

interface Props { dateKey: string; demoMode?: boolean; }
type MutableItem = { amount: number; needsReview: boolean; };
const money = (v: number) => new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(v);
const INCOME_TYPES: {value:DraftIncomeKind,label:string}[] = [
  {value:'cash_sale',label:'Venta en efectivo'},
  {value:'credit_sale',label:'Venta a crédito'},
  {value:'collection',label:'Cobro de crédito anterior'},
];
const OUTLAY_TYPES: {value:DraftOutlayKind,label:string}[] = [
  {value:'purchase',label:'Compra de mercancía'},
  {value:'direct_expense',label:'Gasto de categoría'},
  {value:'general_expense',label:'Gasto administrativo general'},
  {value:'temporary_advance',label:'Anticipo por comprobar'},
  {value:'owner_withdrawal',label:'Retiro personal'},
  {value:'non_cash_consumption',label:'Consumo de mercancía (sin efectivo)'},
];
const validNum = (str: string) => {
  const val = Number(str);
  return Number.isFinite(val) && val >= 0 ? Math.round(val * 100)/100 : 0;
};

const MultiStoreCorteDraftPanel: React.FC<Props> = ({dateKey,demoMode=false}) => {
  const [storeId,setStoreId] = useState<StoreId>('local_01');
  const [report,setReport] = useState('');
  const [interim,setInterim] = useState('');
  const [draft,setDraft] = useState<MultiStoreCorteDraft|null>(null);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [openingCash,setOpeningCash] = useState(0);
  const manualSequence = useRef(0);
  useEffect(()=>{setDraft(null);setError('');},[storeId,dateKey]);
  const store = F1_STORES.find(s=>s.id===storeId)!;

  const onVoiceResult = (text:string,isFinal:boolean) => {
    if (!isFinal) {setInterim(text);return;}
    setReport(previous => previous + (previous.trim()?'\n':'') + text.trim());
    setInterim('');
    setDraft(null);
  };

  const analyze = async () => {
    if (!report.trim() || busy) return;
    setBusy(true);setError('');setInterim('');
    try {
      const result = demoMode
        ? parseMultiStoreDraftFallback(report,storeId,dateKey)
        : await (await import('../services/geminiService')).GeminiService.parseMultiStoreCorteDraft(report,dateKey,storeId);
      setDraft(result);
    } catch {
      setError('No se pudo analizar el corte. Conservamos tu texto: revisa la conexión e inténtalo otra vez.');
    } finally {setBusy(false);}
  };
  const updateIncome = (id:string,changes:Record<string,unknown>) =>
    setDraft(previous=>previous ? {...previous,
      incomes:previous.incomes.map(item=>item.id===id?{...item,...changes}:item)} : previous);
  const updateOutlay = (id:string,changes:Record<string,unknown>) =>
    setDraft(previous=>previous ? {...previous,
      outlays:previous.outlays.map(item=>item.id===id?{...item,...changes}:item)} : previous);
  const updateCash = (key:'countedCash'|'manualSurplus',value:number|null) =>
    setDraft(previous=>previous ? {...previous,cash:{...previous.cash,[key]:value}} : previous);

  const addIncome = () => {
    const id='income-manual-'+(++manualSequence.current);
    setDraft(previous => previous ? {...previous,incomes:[...previous.incomes,{
      id,kind:'cash_sale' as const,categoryId:null,amount:0,rawText:'Renglón agregado manualmente',needsReview:true,
    }]} : previous);
  };
  const addOutlay = () => {
    const id='outlay-manual-'+(++manualSequence.current);
    setDraft(previous => previous ? {...previous,outlays:[...previous.outlays,{
      id,kind:'purchase' as const,categoryId:null,payingStoreId:storeId,amount:0,concept:'',
      rawText:'Renglón agregado manualmente',needsReview:true,
    }]} : previous);
  };
  const markIncomeReviewed = (id:string) => {
    const item=draft?.incomes.find(i=>i.id===id);
    if (!item || item.amount<=0 || (item.kind!=='collection' &&
      (!item.categoryId || !store.categories.includes(item.categoryId)))) {
      setError('Revisa el importe y la categoría de la venta antes de marcarla como verificada.');
      return;
    }
    setError('');
    setDraft(previous=>previous ? {...previous,
      incomes:previous.incomes.map(i=>i.id===id?{...i,needsReview:false}:i)} : previous);
  };
  const markOutlayReviewed = (id:string) => {
    const item=draft?.outlays.find(i=>i.id===id);
    if (!item || item.amount<=0 || !item.concept.trim() ||
       ((item.kind==='purchase'||item.kind==='direct_expense')&&!item.categoryId)) {
      setError('Revisa concepto, importe y categoría de la salida antes de verificarla.');
      return;
    }
    setError('');
    setDraft(previous=>previous ? {...previous,
      outlays:previous.outlays.map(i=>i.id===id?{...i,needsReview:false}:i)} : previous);
  };

  const review = useMemo(()=>{
    if (!draft) return null;
    const cashSales: Record<string,number> = {};
    const unclassified = draft.incomes.some(i=>i.kind!=='collection' && (!i.categoryId ||
      !store.categories.includes(i.categoryId))) ||
      draft.outlays.some(o=>(o.kind==='purchase'||o.kind==='direct_expense')&&!o.categoryId);
    const pendingCount = draft.incomes.filter(i=>i.needsReview).length +
      draft.outlays.filter(i=>i.needsReview).length;
    for (const row of draft.incomes) {
      if(row.kind==='cash_sale' && row.categoryId && store.categories.includes(row.categoryId))
        cashSales[row.categoryId]=(cashSales[row.categoryId]||0)+row.amount;
    }
    const collections = draft.incomes.filter(i=>i.kind==='collection')
      .reduce((sum,i)=>sum+i.amount,0);
    const payments = draft.outlays.filter(o=>o.payingStoreId===storeId && o.kind!=='non_cash_consumption');
    const purchases = payments.filter(o=>o.kind==='purchase').reduce((sum,o)=>sum+o.amount,0);
    const expense = payments.filter(o=>o.kind==='direct_expense'||o.kind==='general_expense')
      .reduce((sum,o)=>sum+o.amount,0);
    const withdrawals = payments.filter(o=>o.kind==='temporary_advance'||o.kind==='owner_withdrawal')
      .reduce((sum,o)=>sum+o.amount,0);
    const counted = draft.cash.countedCash;
    if(counted===null)return {closing:null,pendingCount,unclassified,missingCash:true};
    try {
      const closing=calculateCashClosing({
        storeId,dateKey,
        categorySales:store.categories.map(categoryId=>({
          categoryId,cashSales:validNum(String(cashSales[categoryId]||0)),
          creditSales:draft.incomes.filter(i=>i.kind==='credit_sale' && i.categoryId===categoryId)
            .reduce((a,b)=>a+b.amount,0),
        })),
        openingCash, cashCollections:validNum(String(collections)),
        cashPurchases:validNum(String(purchases)),
        cashOperatingExpenses:validNum(String(expense)),
        cashWithdrawals:validNum(String(withdrawals)),
        countedCash:counted,
      });
      return {closing,pendingCount,unclassified,missingCash:false};
    } catch {
      return {closing:null,pendingCount,unclassified:true,missingCash:false};
    }
  },[draft,openingCash,storeId,dateKey,store]);

  return (
    <div className="space-y-5">
      <section className="rounded-[2rem] bg-white p-5 shadow-sm dark:bg-surface-dark">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-black text-slate-900 dark:text-white">F1-AI · Corte por local</h2>
            <p className="mt-1 text-xs text-slate-500">{demoMode?'Sitio público de demostración: reglas locales, sin Gemini ni Firebase':'Modo experimental: solo lectura y revisión'}</p>
          </div>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-[10px] font-black text-amber-900">BORRADOR</span>
        </div>
        <label className="mt-5 block text-xs font-bold text-slate-700 dark:text-slate-200" htmlFor="multistore-local">
          Caja que realiza el corte
        </label>
        <select id="multistore-local" value={storeId} onChange={e=>setStoreId(e.target.value as StoreId)}
          className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
          {F1_STORES.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-300">
          Puedes dictar varias compras de diferentes categorías. La categoría del gasto puede ser distinta de la caja que pagó.
        </p>
        <div className="mt-4 flex items-center justify-between">
          <label htmlFor="multistore-dictation" className="text-xs font-black uppercase text-indigo-600 dark:text-indigo-300">
            Dictado o reporte F1
          </label>
          <VoiceInputButton onResult={onVoiceResult}/>
        </div>
        <textarea id="multistore-dictation" rows={9} value={report}
          onChange={e=>{setReport(e.target.value);setDraft(null);}}
          placeholder={'Ventas Abarrotes 1500 + 400\nCompra Fiesta 300 + 150 pagada caja 1\nCompra Frutas y verduras 650 pagada caja 1\nRenta 600 pagada caja 1\nSobrante 45\nDinero entregado 1200'}
          className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"/>
        {interim && <p className="mt-2 text-xs text-indigo-700 dark:text-indigo-300">Escuchando: {interim}</p>}
        {error && <p role="alert" className="mt-2 text-xs text-rose-600">{error}</p>}
        <button type="button" disabled={!report.trim()||busy} onClick={analyze}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-4 text-sm font-black text-white disabled:opacity-40">
          <span className="material-symbols-outlined">{busy?'sync':'analytics'}</span>
          {busy?'Analizando corte...':demoMode?'Analizar dictado · Motor local de prueba':'Analizar con F1-AI · Multilocal'}
        </button>
      </section>

      {draft && <section className="space-y-5 rounded-[2rem] border border-indigo-200 bg-white p-5 dark:border-indigo-900 dark:bg-surface-dark">
        <div>
          <h3 className="text-base font-black text-indigo-600 dark:text-indigo-300">Auditoría y revisión por renglón</h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
            Motor: {draft.engine==='gemini'?'Gemini (IA)':'Reglas locales (limitado)'}. Corrige tipo, importe, categoría o caja antes de registrarlos en el futuro.
          </p>
        </div>

        {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700">{error}</p>}
        {draft.warnings.length>0 && <div className="rounded-xl bg-amber-50 p-3 text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          <p className="text-xs font-black">Advertencias de interpretación ({draft.warnings.length})</p>
          <div className="mt-2 space-y-1">
            {draft.warnings.map((w,i)=><p key={i} className="text-xs">• {w}</p>)}
          </div>
        </div>}
        <section>
          <h4 className="mb-2 text-sm font-black text-slate-800 dark:text-white">Ingresos ({draft.incomes.length})</h4>
          {draft.incomes.length===0 && <p className="text-xs text-slate-500">No se detectaron ingresos.</p>}
          {draft.incomes.map(item=><div key={item.id} className="mb-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <p className="mb-2 break-words text-xs italic text-slate-500 dark:text-slate-300">“{item.rawText||'Sin referencia original'}”</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-slate-600 dark:text-slate-200">Tipo
                <select value={item.kind} onChange={e=>updateIncome(item.id,{kind:e.target.value,
                    categoryId:e.target.value==='collection'?null:item.categoryId})}
                  className="mt-1 w-full rounded-lg border bg-white p-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
                  {INCOME_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </label>
              <label className="text-xs text-slate-600 dark:text-slate-200">Importe
                <input type="number" min="0" step=".01" value={item.amount}
                  onChange={e=>updateIncome(item.id,{amount:validNum(e.target.value)})}
                  className="mt-1 w-full rounded-lg border bg-white p-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"/>
              </label>
            </div>
            {item.kind!=='collection' && <label className="mt-2 block text-xs text-slate-600 dark:text-slate-200">
              Categoría
              <select value={item.categoryId||''} onChange={e=>updateIncome(item.id,{categoryId:e.target.value||null})}
                className="mt-1 w-full rounded-lg border bg-white p-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
                <option value="">Pendiente de identificar</option>
                {store.categories.map(cat=><option key={cat} value={cat}>{F1_CATEGORY_LABELS[cat]}</option>)}
              </select>
            </label>}
            {item.needsReview && <p className="mt-2 text-xs font-bold text-amber-700">Revisar clasificación</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              {item.needsReview && <button type="button" onClick={()=>markIncomeReviewed(item.id)}
                className="rounded-lg bg-indigo-100 px-3 py-2 text-xs font-bold text-indigo-800">
                Marcar revisado
              </button>}
              <button type="button" onClick={()=>setDraft(previous=>previous ? {...previous,
                incomes:previous.incomes.filter(i=>i.id!==item.id)} : previous)}
                className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700">
                Quitar renglón
              </button>
            </div>
          </div>)}
          <button type="button" onClick={addIncome} className="mt-2 w-full rounded-xl border border-indigo-300 px-4 py-3 text-xs font-black text-indigo-700 dark:text-indigo-300">
            + Agregar ingreso manual
          </button>
        </section>

        <section>
          <h4 className="mb-2 text-sm font-black text-slate-800 dark:text-white">Salidas y consumos ({draft.outlays.length})</h4>
          {draft.outlays.length===0 && <p className="text-xs text-slate-500">No se detectaron salidas.</p>}
          {draft.outlays.map(item=><div key={item.id} className="mb-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <p className="mb-2 break-words text-xs italic text-slate-500 dark:text-slate-300">“{item.rawText||item.concept||'Sin referencia original'}”</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-slate-600 dark:text-slate-200">Concepto
                <input value={item.concept} onChange={e=>updateOutlay(item.id,{concept:e.target.value})}
                  className="mt-1 w-full rounded-lg border bg-white p-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"/>
              </label>
              <label className="text-xs text-slate-600 dark:text-slate-200">Importe
                <input type="number" min="0" step=".01" value={item.amount}
                  onChange={e=>updateOutlay(item.id,{amount:validNum(e.target.value)})}
                  className="mt-1 w-full rounded-lg border bg-white p-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"/>
              </label>
              <label className="text-xs text-slate-600 dark:text-slate-200">Tipo
                <select value={item.kind} onChange={e=>updateOutlay(item.id,{kind:e.target.value,
                    categoryId:e.target.value==='purchase'||e.target.value==='direct_expense'?item.categoryId:null})}
                  className="mt-1 w-full rounded-lg border bg-white p-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
                  {OUTLAY_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </label>
              <label className="text-xs text-slate-600 dark:text-slate-200">Caja pagadora
                <select value={item.payingStoreId} onChange={e=>updateOutlay(item.id,{payingStoreId:e.target.value})}
                  className="mt-1 w-full rounded-lg border bg-white p-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
                  {F1_STORES.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
            </div>
            {(item.kind==='purchase'||item.kind==='direct_expense') && <label className="mt-2 block text-xs text-slate-600 dark:text-slate-200">Categoría beneficiaria
              <select value={item.categoryId||''} onChange={e=>updateOutlay(item.id,{categoryId:e.target.value||null})}
                className="mt-1 w-full rounded-lg border bg-white p-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
                <option value="">Pendiente de identificar</option>
                {F1_STORES.flatMap(s=>s.categories.map(cat=><option key={cat} value={cat}>{F1_CATEGORY_LABELS[cat]}</option>))}
              </select>
            </label>}
            {item.needsReview && <p className="mt-2 text-xs font-bold text-amber-700">Verificar dato inferido por IA</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              {item.needsReview && <button type="button" onClick={()=>markOutlayReviewed(item.id)}
                className="rounded-lg bg-indigo-100 px-3 py-2 text-xs font-bold text-indigo-800">
                Marcar revisado
              </button>}
              <button type="button" onClick={()=>setDraft(previous=>previous ? {...previous,
                outlays:previous.outlays.filter(i=>i.id!==item.id)} : previous)}
                className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700">
                Quitar renglón
              </button>
            </div>
          </div>)}
          <button type="button" onClick={addOutlay} className="mt-2 w-full rounded-xl border border-indigo-300 px-4 py-3 text-xs font-black text-indigo-700 dark:text-indigo-300">
            + Agregar compra o gasto manual
          </button>
        </section>

        <section className="rounded-xl bg-slate-100 p-4 dark:bg-slate-900">
          <h4 className="text-sm font-black text-slate-900 dark:text-white">Conciliación provisional de {store.name}</h4>
          <label className="mt-3 block text-xs text-slate-700 dark:text-slate-200">Fondo inicial
            <input type="number" min="0" step=".01" value={openingCash}
              onChange={e=>setOpeningCash(validNum(e.target.value))}
              className="mt-1 w-full rounded-lg border bg-white p-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"/>
          </label>
          <label className="mt-3 block text-xs text-slate-700 dark:text-slate-200">Dinero entregado / contado
            <input type="number" min="0" step=".01" value={draft.cash.countedCash??''}
              onChange={e=>updateCash('countedCash',e.target.value===''?null:validNum(e.target.value))}
              className="mt-1 w-full rounded-lg border bg-white p-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"/>
          </label>
          <label className="mt-3 block text-xs text-slate-700 dark:text-slate-200">Sobrante declarado manualmente
            <input type="number" min="0" step=".01" value={draft.cash.manualSurplus??''}
              onChange={e=>updateCash('manualSurplus',e.target.value===''?null:validNum(e.target.value))}
              className="mt-1 w-full rounded-lg border bg-white p-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"/>
          </label>
          {review?.closing && <div className="mt-4 space-y-2 border-t border-slate-300 pt-3 text-sm dark:border-slate-700">
            <div className="flex justify-between"><span>Ventas de contado clasificadas</span><strong>{money(review.closing.classifiedCashSales)}</strong></div>
            <div className="flex justify-between"><span>Ventas a crédito identificadas</span><strong>{money(review.closing.classifiedCreditSales)}</strong></div>
            <div className="flex justify-between"><span>Efectivo esperado</span><strong>{money(review.closing.expectedCash)}</strong></div>
            <div className="flex justify-between"><span>Dinero contado</span><strong>{money(review.closing.countedCash)}</strong></div>
            <div className="flex justify-between font-black"><span>Diferencia calculada</span>
              <strong className={review.closing.variance<0?'text-rose-600':'text-amber-700'}>{money(review.closing.variance)}</strong></div>
            <div className="flex justify-between"><span>Sobrante manual (control, no venta)</span>
              <strong>{draft.cash.manualSurplus===null?'No informado':money(draft.cash.manualSurplus)}</strong></div>
            {draft.cash.manualSurplus!==null && <div className="flex justify-between">
              <span>Desfase sobrante manual/calculado</span>
              <strong>{money(review.closing.surplusPendingIdentification-draft.cash.manualSurplus)}</strong>
            </div>}
          </div>}
          {review?.missingCash && <p className="mt-3 text-xs font-bold text-amber-700">
            Falta el efectivo contado: no puede calcularse diferencia de caja.
          </p>}
          {review?.unclassified && <p className="mt-3 text-xs font-bold text-rose-600">
            Existen movimientos sin categoría válida. El resultado provisional podría estar incompleto.
          </p>}
          {review?.pendingCount!==undefined && review.pendingCount>0 && <p className="mt-3 text-xs font-bold text-amber-700">
            {review.pendingCount} movimiento(s) requieren revisión de la interpretación.
          </p>}
        </section>
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          MODO PRUEBA. El análisis y los cambios de esta pantalla NO SE GUARDAN en Firebase. {demoMode?' Esta vista pública no utiliza Gemini.':''}
          El botón actual «Confirmar y Registrar» de las otras pestañas no utiliza este borrador.
          Para registrar operaciones reales, sigue utilizando tu corte habitual.
        </div>
        <button type="button" onClick={()=>setDraft(null)}
          className="w-full rounded-2xl border border-slate-300 p-3 text-sm font-bold text-slate-700 dark:border-slate-600 dark:text-white">
          Volver al dictado y revisar texto
        </button>
      </section>}
    </div>
  );
};

export default MultiStoreCorteDraftPanel;
