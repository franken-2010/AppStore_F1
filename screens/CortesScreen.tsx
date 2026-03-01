
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import ProfileMenu from '../components/ProfileMenu';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { 
  collection, 
  serverTimestamp,
  doc,
  writeBatch,
  increment
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { GeminiService } from '../services/geminiService';
import { AccountResolver } from '../services/AccountResolver';
import { AccountingService, RegisterSchema } from '../services/AccountingService';
import MoneyInputWithCalculator from '../components/MoneyInputWithCalculator';

type TabMode = 'manual' | 'raw';

interface CutCanonical {
  income: {
    ventas: number;
    fiesta: number;
    recargas: number;
    estancias: number;
    pagoClientes: number;
    cxc: number;
  };
  expenses: {
    mercancias: number;
    empleados: number;
    consumoPersonal: number;
  };
  cash: {
    dineroEntregado: number;
  };
}

interface AuditMetrics {
  subtotal1: number;
  subtotal2: number;
  totalIngresos: number;
  subtotalEgresos: number;
  totalEsperado: number;
  resultadoCaja: number;
  tipoResultado: 'SOBRANTE' | 'FALTANTE' | 'OK';
}

const CortesScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabMode>('manual');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<{ text: string, type: 'success' | 'error' | 'info' | 'warning' } | null>(null);
  
  const [schema, setSchema] = useState<RegisterSchema | null>(null);
  const [manualValues, setManualValues] = useState<Record<string, number>>({});
  
  // RAW Mode States
  const [rawText, setRawText] = useState('');
  const [parsedCut, setParsedCut] = useState<CutCanonical | null>(null);

  useEffect(() => {
    if (!user) return;
    AccountResolver.loadIndex(user.uid);
    AccountingService.getDailyRegisterSchema(user.uid).then(res => {
      setSchema(res);
      const initial: Record<string, number> = {};
      [...res.ingresos, ...res.egresos].forEach(r => initial[r.id] = 0);
      setManualValues(initial);
    });
  }, [user]);

  const formatMXN = (val: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);

  const handleInputChange = (id: string, value: string) => {
    setManualValues(prev => ({ ...prev, [id]: parseFloat(value) || 0 }));
  };

  const auditMetrics = useMemo((): AuditMetrics | null => {
    if (!parsedCut) return null;
    const { income, expenses, cash } = parsedCut;
    
    const sub1 = Number((income.ventas + income.fiesta + income.recargas).toFixed(2));
    const sub2 = Number((income.estancias + income.pagoClientes).toFixed(2));
    const totalIn = Number((sub1 + sub2).toFixed(2));
    const subEx = Number((expenses.mercancias + expenses.empleados + expenses.consumoPersonal).toFixed(2));
    const totalExp = Number((totalIn - subEx).toFixed(2));
    const diff = Number((cash.dineroEntregado - totalExp).toFixed(2));

    let tipo: any = 'OK';
    if (diff > 0.1) tipo = 'SOBRANTE';
    else if (diff < -0.1) tipo = 'FALTANTE';

    return {
      subtotal1: sub1,
      subtotal2: sub2,
      totalIngresos: totalIn,
      subtotalEgresos: subEx,
      totalEsperado: totalExp,
      resultadoCaja: diff,
      tipoResultado: tipo
    };
  }, [parsedCut]);

  const handleAnalyzeIA = async () => {
    if (!rawText.trim() || !schema) return;
    setIsSaving(true);
    setStatus({ text: "F1-AI analizando reporte...", type: 'info' });
    
    try {
      const today = new Date().toISOString().split('T')[0];
      const data = await GeminiService.parseCorteText(rawText, today);
      
      // Asegurar integridad de datos (Self-check)
      const canonical: CutCanonical = {
        income: {
          ventas: Number(data.income?.ventas || 0),
          fiesta: Number(data.income?.fiesta || 0),
          recargas: Number(data.income?.recargas || 0),
          estancias: Number(data.income?.estancias || 0),
          pagoClientes: Number(data.income?.pagoClientes || 0),
          cxc: Number(data.income?.cxc || 0)
        },
        expenses: {
          mercancias: Number(data.expenses?.mercancias || 0),
          empleados: Number(data.expenses?.empleados || 0),
          consumoPersonal: Number(data.expenses?.consumoPersonal || 0)
        },
        cash: {
          dineroEntregado: Number(data.cash?.dineroEntregado || 0)
        }
      };

      setParsedCut(canonical);

      // --- CÁLCULO DE SOBRANTE PARA MAPEO ---
      const sub1 = canonical.income.ventas + canonical.income.fiesta + canonical.income.recargas;
      const sub2 = canonical.income.estancias + canonical.income.pagoClientes;
      const totalIn = sub1 + sub2;
      const subEx = canonical.expenses.mercancias + canonical.expenses.empleados + canonical.expenses.consumoPersonal;
      const totalExp = totalIn - subEx;
      const diff = canonical.cash.dineroEntregado - totalExp;
      const surplus = diff > 0.1 ? Number(diff.toFixed(2)) : 0;
      
      // Mapeo automático a campos manuales para el flujo de guardado
      const mappedManual: Record<string, number> = {
        'in_ventas': canonical.income.ventas,
        'in_fiesta': canonical.income.fiesta,
        'in_recargas': canonical.income.recargas,
        'in_estancias': canonical.income.estancias,
        'in_cxc_pago': canonical.income.pagoClientes,
        'in_cxc_venta': canonical.income.cxc,
        'in_sobrante': surplus, // Corregido: Mapeo del sobrante detectado
        'ex_mercancias': canonical.expenses.mercancias,
        'ex_empleados': canonical.expenses.empleados,
        'ex_personal': canonical.expenses.consumoPersonal
      };
      setManualValues(mappedManual);

      setStatus({ text: "Análisis completado exitosamente.", type: 'success' });
    } catch (error: any) {
      console.error(error);
      setStatus({ text: `Error en IA: ${error.message}`, type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (!user || !schema) return;
    setIsSaving(true);
    setStatus({ text: "Sincronizando movimientos contables...", type: 'info' });
    
    try {
      const batch = writeBatch(db); 
      const todayKey = new Date().toISOString().split('T')[0];
      const groupId = `RD-${todayKey}-${Math.floor(Math.random()*1000)}`;
      const sourceLabel = activeTab === 'raw' ? 'CORTE_IA' : 'MANUAL';
      
      // 1. Guardar movimientos estándar del manualValues (que ya están mapeados si se usó IA)
      // Esto incluye 'in_sobrante' si fue detectado en el análisis de IA
      for (const rubric of [...schema.ingresos, ...schema.egresos]) {
        const amount = Number((manualValues[rubric.id] || 0).toFixed(2));
        if (amount <= 0) continue;

        const accInfo = await AccountResolver.assertAccount(user.uid, rubric.accountId);
        const movDocRef = doc(collection(db, "users", user.uid, "accounts", accInfo.accountDocId, "movements"));
        const direction = rubric.type === 'INCOME' ? 'IN' : 'OUT';
        const signedAmount = direction === 'IN' ? amount : -amount;
        const conceptTitle = rubric.label.toUpperCase();

        batch.update(doc(db, "users", user.uid, "accounts", accInfo.accountDocId), { balance: increment(signedAmount), updatedAt: serverTimestamp() });
        batch.set(movDocRef, {
          uid: user.uid, accountId: rubric.accountId, amount, type: rubric.type, direction, signedAmount, rubro: rubric.accountId,
          conceptTitle, conceptSubtitle: `Registro vía ${sourceLabel}`, source: activeTab === 'raw' ? 'corte_ia' : 'manual',
          status: 'ACTIVE', createdAt: serverTimestamp(), groupId
        });

        // Espejo Inventarios
        const mirrorTitle = AccountingService.getInventoryMirrorTitle(rubric.id);
        if (mirrorTitle || (rubric.type === 'INCOME' && ['ventas', 'fiesta', 'recargas', 'cxc'].includes(rubric.accountId))) {
          const invAcc = await AccountResolver.assertAccount(user.uid, 'inventarios');
          const invMovRef = doc(collection(db, "users", user.uid, "accounts", invAcc.accountDocId, "movements"));
          const isInvIn = !!mirrorTitle;
          const invImpact = isInvIn ? amount : -amount;
          const invTitle = mirrorTitle || `SALIDA INV (${rubric.label.toUpperCase()})`;

          batch.update(doc(db, "users", user.uid, "accounts", invAcc.accountDocId), { balance: increment(invImpact), updatedAt: serverTimestamp() });
          batch.set(invMovRef, {
            uid: user.uid, accountId: 'inventarios', amount, direction: isInvIn ? 'IN' : 'OUT', signedAmount: invImpact,
            rubro: 'inventarios', type: isInvIn ? 'INCOME' : 'EXPENSE', conceptTitle: invTitle, conceptSubtitle: "Auto-ajuste F1",
            source: 'auto_inventory', status: 'ACTIVE', createdAt: serverTimestamp(), groupId
          });
        }
      }

      await batch.commit();
      setStatus({ text: `✅ Corte registrado con éxito.`, type: 'success' });
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch (e: any) {
      console.error(e);
      setStatus({ text: `Error al guardar: ${e.message}`, type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="relative flex h-full min-h-screen w-full flex-col overflow-x-hidden pb-32 max-w-md mx-auto bg-background-light dark:bg-background-dark font-display">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      <header className="sticky top-0 z-30 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md pt-12 px-5 pb-4 border-b dark:border-white/5">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-slate-700 dark:text-white"><span className="material-symbols-outlined text-3xl">menu</span></button>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">Corte de Caja</h1>
          <ProfileMenu />
        </div>
        <div className="flex p-1 bg-slate-200 dark:bg-surface-dark rounded-2xl">
          {['manual', 'raw'].map(mode => (
            <button key={mode} onClick={() => setActiveTab(mode as any)} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase transition-all ${activeTab === mode ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-500'}`}>{mode === 'manual' ? 'Carga Manual' : 'Pegar Corte'}</button>
          ))}
        </div>
      </header>

      <main className="px-5 mt-6 space-y-8 pb-10">
        {status && (
          <div className={`p-5 rounded-2xl flex items-center gap-3 text-sm font-bold border animate-in slide-in-from-top-2 ${status.type === 'success' ? 'bg-emerald-50/10 text-emerald-500 border-emerald-500/20' : status.type === 'error' ? 'bg-red-50/10 text-red-500 border-red-500/20' : 'bg-blue-50/10 text-blue-500 border-blue-500/20'}`}>
            <span className="material-symbols-outlined text-xl">{status.type === 'success' ? 'verified' : 'info'}</span>
            {status.text}
          </div>
        )}

        {activeTab === 'manual' ? (
          <div className="space-y-8">
            <section className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Entradas de Dinero</h3>
              <div className="bg-white dark:bg-surface-dark p-6 rounded-[2rem] shadow-sm space-y-6">
                {schema?.ingresos.map(rubric => (
                  <MoneyInputWithCalculator key={rubric.id} label={rubric.label} field={rubric.id} value={manualValues[rubric.id] || 0} onChange={handleInputChange} />
                ))}
              </div>
            </section>
            <section className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Salidas / Gastos</h3>
              <div className="bg-white dark:bg-surface-dark p-6 rounded-[2rem] shadow-sm space-y-6">
                {schema?.egresos.map(rubric => (
                  <MoneyInputWithCalculator key={rubric.id} label={rubric.label} field={rubric.id} value={manualValues[rubric.id] || 0} onChange={handleInputChange} />
                ))}
              </div>
            </section>
            <button onClick={handleSave} disabled={isSaving} className="w-full py-6 bg-primary text-white font-black rounded-3xl shadow-xl shadow-primary/20 flex items-center justify-center gap-3 active:scale-95 transition-all text-base disabled:opacity-50">
              {isSaving ? <span className="material-symbols-outlined animate-spin">sync</span> : <span className="material-symbols-outlined">send</span>}
              Sincronizar Operación
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {!parsedCut ? (
              <div className="bg-white dark:bg-surface-dark p-7 rounded-[2.5rem] shadow-sm space-y-5 border dark:border-white/5 animate-in fade-in">
                <div className="space-y-1">
                  <h3 className="text-sm font-black text-indigo-500 uppercase tracking-widest">Dictado o Reporte F1</h3>
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Pega el texto de ventas y gastos de WhatsApp.</p>
                </div>
                <textarea value={rawText} onChange={(e) => setRawText(e.target.value)} placeholder="Ventas: 4500, Luz: 1200, Entregue: 3000..." className="w-full h-56 bg-slate-50 dark:bg-background-dark/50 border border-slate-100 dark:border-white/5 rounded-2xl p-5 text-base font-medium outline-none resize-none dark:text-white" />
                <button onClick={handleAnalyzeIA} disabled={isSaving || !rawText.trim()} className="w-full py-5 bg-indigo-600 text-white font-black rounded-2xl shadow-lg active:scale-95 flex items-center justify-center gap-2 text-base disabled:opacity-50">
                  <span className="material-symbols-outlined">analytics</span> Analizar con F1-AI
                </button>
              </div>
            ) : (
              <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                {/* AUDITORÍA DE CORTE - FORMATO SOLICITADO */}
                <div className="p-8 bg-white dark:bg-surface-dark rounded-[2.5rem] border dark:border-white/10 shadow-2xl space-y-6 relative overflow-hidden">
                  <div className="flex justify-between items-start">
                    <h3 className="text-base font-black uppercase tracking-[0.2em] text-blue-500 dark:text-blue-400">Auditoría de Corte</h3>
                    <div className={`px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest text-white ${auditMetrics?.tipoResultado === 'FALTANTE' ? 'bg-rose-500' : 'bg-emerald-500'}`}>
                      {auditMetrics?.tipoResultado === 'OK' ? 'SISTEMA OK' : auditMetrics?.tipoResultado}
                    </div>
                  </div>

                  <div className="space-y-6 font-bold text-sm text-slate-700 dark:text-slate-300">
                    {/* Bloque Ingresos */}
                    <div className="space-y-2">
                      <p className="text-xs font-black uppercase tracking-widest text-primary dark:text-blue-400 border-b border-slate-100 dark:border-white/5 pb-1">Ingresos contables</p>
                      <div className="flex justify-between"><span>Ventas:</span> <span>{formatMXN(parsedCut.income.ventas)}</span></div>
                      <div className="flex justify-between"><span>Fiesta:</span> <span>{formatMXN(parsedCut.income.fiesta)}</span></div>
                      <div className="flex justify-between"><span>Recargas:</span> <span>{formatMXN(parsedCut.income.recargas)}</span></div>
                      <div className="flex justify-between text-primary dark:text-blue-400 font-black border-t border-slate-50 dark:border-white/5 pt-1"><span>Subtotal 1:</span> <span>{formatMXN(auditMetrics?.subtotal1 || 0)}</span></div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between"><span>Estancias:</span> <span>{formatMXN(parsedCut.income.estancias)}</span></div>
                      <div className="flex justify-between"><span>Pago de clientes:</span> <span>{formatMXN(parsedCut.income.pagoClientes)}</span></div>
                      <div className="flex justify-between text-primary dark:text-blue-400 font-black border-t border-slate-50 dark:border-white/5 pt-1"><span>Subtotal 2:</span> <span>{formatMXN(auditMetrics?.subtotal2 || 0)}</span></div>
                    </div>

                    <div className="flex justify-between text-lg font-black text-slate-900 dark:text-white bg-slate-50 dark:bg-white/5 p-3 rounded-xl">
                      <span>Total de ingresos:</span>
                      <span>{formatMXN(auditMetrics?.totalIngresos || 0)}</span>
                    </div>

                    {/* Bloque Egresos */}
                    <div className="space-y-2">
                      <p className="text-xs font-black uppercase tracking-widest text-rose-500 dark:text-rose-400 border-b border-slate-100 dark:border-white/5 pb-1">Egresos contables</p>
                      <div className="flex justify-between text-xs"><span>Gastos en mercancías (abarrotes, fiesta, recargas):</span> <span>{formatMXN(parsedCut.expenses.mercancias)}</span></div>
                      <div className="flex justify-between"><span>Consumo o gastos empleados:</span> <span>{formatMXN(parsedCut.expenses.empleados)}</span></div>
                      <div className="flex justify-between"><span>Consumo personal:</span> <span>{formatMXN(parsedCut.expenses.consumoPersonal)}</span></div>
                      <div className="flex justify-between text-rose-500 dark:text-rose-400 font-black border-t border-slate-50 dark:border-white/5 pt-1"><span>Subtotal:</span> <span>{formatMXN(auditMetrics?.subtotalEgresos || 0)}</span></div>
                    </div>

                    {/* Totales Finales */}
                    <div className="space-y-3 pt-4 border-t-2 border-slate-100 dark:border-white/5">
                      <div className="flex justify-between"><span>Total:</span> <span>{formatMXN(auditMetrics?.totalEsperado || 0)}</span></div>
                      <div className="flex justify-between text-primary dark:text-blue-400 font-black"><span>Dinero entregado:</span> <span>{formatMXN(parsedCut.cash.dineroEntregado)}</span></div>
                      <div className={`flex justify-between text-lg font-black p-3 rounded-xl ${auditMetrics?.resultadoCaja! >= 0 ? 'bg-emerald-500/10 text-emerald-500 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-500 dark:text-rose-400'}`}>
                        <span>Resultado:</span>
                        <span>{formatMXN(auditMetrics?.resultadoCaja || 0)} ({auditMetrics?.tipoResultado})</span>
                      </div>
                    </div>

                    {/* Bloque Crédito */}
                    <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-white/5 opacity-70">
                      <p className="text-xs font-black uppercase tracking-widest text-slate-500">Ingresos por crédito:</p>
                      <div className="flex justify-between"><span>CxC:</span> <span>{formatMXN(parsedCut.income.cxc)}</span></div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-4 pt-4">
                  <button onClick={handleSave} disabled={isSaving} className="w-full py-6 bg-primary text-white font-black rounded-3xl shadow-2xl shadow-primary/30 flex items-center justify-center gap-3 text-base active:scale-95 transition-all">
                    {isSaving ? <span className="material-symbols-outlined animate-spin">sync</span> : <span className="material-symbols-outlined">verified</span>} 
                    Confirmar y Registrar
                  </button>
                  <button onClick={() => { setParsedCut(null); setRawText(''); }} className="w-full py-4 text-slate-400 font-bold text-xs uppercase tracking-widest active:scale-95">Descartar y Limpiar</button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
};

export default CortesScreen;
