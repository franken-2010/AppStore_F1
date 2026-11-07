import React, { useCallback, useEffect, useState } from 'react';
import { makeDailyClosingId } from '../services/multiStoreAccounting';
import type { MultiStoreCorteDraft } from '../services/multiStoreCorteDraft';
import {
  correctClosing, MemoryClosingRepository, registerClosing,
  type ClosingRevision, type RegisteredClosing,
} from '../services/multiStoreClosingRepository';

/** Persistencia de DEMOSTRACIÓN: dura solo hasta recargar el navegador. */
const demoRepo = new MemoryClosingRepository();
const DEMO_UID='f1_demo_usuario';
const fmt=(v:number)=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(v);

interface Props { draft: MultiStoreCorteDraft; openingCash: number; }
export const TrialClosingControls: React.FC<Props> = ({draft,openingCash}) => {
  const closingId=makeDailyClosingId(draft.storeId,draft.dateKey);
  const [saved,setSaved]=useState<RegisteredClosing|null>(null);
  const [revisions,setRevisions]=useState<ClosingRevision[]>([]);
  const [reason,setReason]=useState('');
  const [ack,setAck]=useState(false);
  const [working,setWorking]=useState(false);
  const [notice,setNotice]=useState('');
  const [failed,setFailed]=useState(false);
  const refresh=useCallback(async()=>{
    const record=await demoRepo.get(DEMO_UID,closingId);
    setSaved(record);
    setRevisions(await demoRepo.getRevisions(DEMO_UID,closingId));
  },[closingId]);

  useEffect(()=>{
    setNotice('');setReason('');setAck(false);setSaved(null);
    void refresh();
  },[refresh]);

  const save=async(asCorrection:boolean)=>{
    if(working)return;
    setWorking(true);setFailed(false);setNotice('');
    try {
      const input={uid:DEMO_UID,draft,openingCash,
        acknowledgeWarnings:ack,source:'f1_ai' as const};
      const result=asCorrection
        ? await correctClosing(demoRepo,{...input,
          expectedRevision:saved?.revision??0,reason})
        : await registerClosing(demoRepo,input);
      await refresh();
      if(result.status==='created')setNotice('Corte de prueba guardado en memoria. Versión 1.');
      else if(result.status==='duplicate')setNotice('Duplicado rechazado: ya existe el corte de este local y fecha. No se sumó dos veces.');
      else if(result.status==='corrected')setNotice('Corrección registrada como versión '+result.closing.revision+'. Se conservó el corte original.');
      else {setFailed(true);setNotice('Conflicto: existe una revisión más reciente. Revisa el historial.');}
      if(result.status==='corrected')setReason('');
    } catch(e){
      setFailed(true);
      setNotice(e instanceof Error?e.message:'No se pudo simular el guardado');
    } finally{setWorking(false);}
  };

  return (
    <section className="space-y-3 rounded-2xl border border-emerald-600/40 bg-emerald-50 p-4 text-slate-900 dark:bg-emerald-950/30 dark:text-white">
      <div>
        <h4 className="flex items-center gap-2 text-sm font-black">
          <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400">shield_lock</span>
          Guardado seguro — Simulación
        </h4>
        <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
          Prueba local en memoria. No usa Firebase, no modifica cuentas ni envía operaciones a un servidor.
        </p>
      </div>
      <p className="break-all rounded-lg bg-white p-2 font-mono text-[11px] dark:bg-slate-900">
        ID: {closingId}
      </p>
      {draft.warnings.length>0&&<label className="flex items-start gap-2 text-xs font-bold">
        <input type="checkbox" checked={ack} onChange={e=>setAck(e.target.checked)} className="mt-0.5"/>
        Revisé todas las advertencias y confirmo que el dictado no omitió movimientos.
      </label>}
      {!saved?(
        <button type="button" onClick={()=>void save(false)} disabled={working}
          className="w-full rounded-xl bg-emerald-600 p-3 text-sm font-black text-white disabled:opacity-40">
          {working?'Validando...':'Registrar corte de PRUEBA'}
        </button>
      ):(
        <>
          <div className="rounded-xl border border-emerald-300 bg-white p-3 text-xs dark:border-emerald-800 dark:bg-slate-900">
            <strong>Corte de prueba existente</strong>
            <p className="mt-1">Versión {saved.revision} · Efectivo esperado {fmt(saved.audit.expectedCash)} · Diferencia {fmt(saved.audit.cashDifference??0)}</p>
          </div>
          <button type="button" onClick={()=>void save(false)} disabled={working}
            className="w-full rounded-xl border border-slate-400 p-3 text-xs font-black">
            Probar envío duplicado (debe rechazarse)
          </button>
          <label className="block text-xs font-bold">
            Motivo de corrección (mínimo 8 caracteres)
            <input value={reason} onChange={e=>setReason(e.target.value)} maxLength={500}
              placeholder="Ej. Se corrigió importe de proveedor"
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"/>
          </label>
          <button type="button" onClick={()=>void save(true)} disabled={working||reason.trim().length<8}
            className="w-full rounded-xl bg-indigo-600 p-3 text-xs font-black text-white disabled:opacity-40">
            Guardar corrección como nueva versión
          </button>
        </>
      )}
      {notice&&<p role="status" className={'rounded-xl p-3 text-xs font-bold '+(failed?
        'bg-rose-100 text-rose-800':'bg-emerald-100 text-emerald-900')}>{notice}</p>}
      {revisions.length>0&&<div className="border-t border-emerald-300 pt-3 dark:border-emerald-800">
        <h5 className="text-xs font-black">Historial de versiones ({revisions.length})</h5>
        {revisions.map(event=><div key={event.number} className="mt-2 flex justify-between gap-3 text-xs">
          <span>V{event.number} · {event.reason}</span>
          <span className="shrink-0 font-black">{fmt(event.after.audit.cashOutflows)}</span>
        </div>)}
      </div>}
      <p className="text-[11px] text-slate-600 dark:text-slate-300">
        La simulación se borra al recargar esta página. El guardado real necesitará un proyecto Firebase de pruebas y reglas de seguridad validadas.
      </p>
    </section>
  );
};
