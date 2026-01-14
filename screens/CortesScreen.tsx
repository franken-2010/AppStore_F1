
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import ProfileMenu from '../components/ProfileMenu';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { 
  collection, 
  onSnapshot, 
  query, 
  serverTimestamp,
  doc,
  writeBatch,
  increment,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { GeminiService } from '../services/geminiService';
import { AccountResolver } from '../services/AccountResolver';
import { AccountingService, RegisterSchema, RegisterRubric } from '../services/AccountingService';
import MoneyInputWithCalculator from '../components/MoneyInputWithCalculator';

type TabMode = 'manual' | 'raw';

const CortesScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabMode>('manual');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<{ text: string, type: 'success' | 'error' | 'info' | 'warning' } | null>(null);
  
  const [schema, setSchema] = useState<RegisterSchema | null>(null);
  const [manualValues, setManualValues] = useState<Record<string, number>>({});
  const [dineroEntregadoIA, setDineroEntregadoIA] = useState(0);
  
  const [rawText, setRawText] = useState('');
  const [analyzedData, setAnalyzedData] = useState<any>(null);

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

  const handleInputChange = (id: string, value: string) => {
    setManualValues(prev => ({ ...prev, [id]: parseFloat(value) || 0 }));
  };

  const hasCobranzaKeywords = (text: string) => {
    const keywords = ["pago clientes", "pagos cxc", "cobranza", "cobranza cxc", "abonos", "abono clientes", "cobrado", "cobros", "recibido de clientes", "clientes pagaron", "se cobraron"];
    const t = text.toLowerCase();
    return keywords.some(k => t.includes(k));
  };

  const hasCreditoKeywords = (text: string) => {
    const keywords = ["ventas a credito", "ventas a crédito", "credito", "crédito", "ingresos cxc", "ventas cxc", "cxc generado", "se vendio a credito", "por cobrar", "cartera generada", "cxc (venta)"];
    const t = text.toLowerCase();
    return keywords.some(k => t.includes(k));
  };

  const handleAnalyzeIA = async () => {
    if (!rawText.trim()) return;
    setIsSaving(true);
    setStatus({ text: "Analizando reporte con F1-AI...", type: 'info' });
    try {
      const today = new Date().toLocaleDateString();
      let data = await GeminiService.parseCorteText(rawText, today);
      
      // --- POST-PROCESADO DEFENSIVO CxC ---
      let p_cxc = Number(data.ingresos?.pagos_clientes_cxc || 0);
      let v_cxc = Number(data.ingresos?.ventas_a_credito_cxc || 0);
      
      const textLower = rawText.toLowerCase();
      const hasCobranza = hasCobranzaKeywords(textLower);
      const hasCredito = hasCreditoKeywords(textLower);

      // Si la IA se confundió de rubro basándonos en keywords dominantes
      if (hasCobranza && !hasCredito && v_cxc > 0 && p_cxc === 0) {
        console.log("CXC_SANITY_CHECK: Movido monto de Venta a Crédito -> Cobranza por keywords.");
        p_cxc = v_cxc;
        v_cxc = 0;
      } else if (hasCredito && !hasCobranza && p_cxc > 0 && v_cxc === 0) {
        console.log("CXC_SANITY_CHECK: Movido monto de Cobranza -> Venta a Crédito por keywords.");
        v_cxc = p_cxc;
        p_cxc = 0;
      }

      console.log("CXC_MAP", { pagos_clientes_cxc: p_cxc, ventas_a_credito_cxc: v_cxc });

      setAnalyzedData(data);
      setDineroEntregadoIA(Number(data.dinero_entregado) || 0);
      
      const newValues = { ...manualValues };
      
      if (data.ingresos) {
        if (data.ingresos.ventas) newValues['in_ventas'] = data.ingresos.ventas;
        if (data.ingresos.fiesta) newValues['in_fiesta'] = data.ingresos.fiesta;
        if (data.ingresos.recargas) newValues['in_recargas'] = data.ingresos.recargas;
        if (data.ingresos.estancias) newValues['in_estancias'] = data.ingresos.estancias;
        
        // Asignamos montos corregidos
        newValues['in_cxc_venta'] = v_cxc;
        newValues['in_cxc_pago'] = p_cxc;
        
        newValues['in_sobrante'] = 0;
      }
      
      if (data.egresos) {
        if (data.egresos.gastos_empleados) newValues['ex_empleados'] = data.egresos.gastos_empleados;
        if (data.egresos.renta) newValues['ex_renta'] = data.egresos.renta;
        if (data.egresos.consumo_personal) newValues['ex_personal'] = data.egresos.consumo_personal;
        if (data.egresos.gastos_abarrotes) newValues['ex_mercancias'] = data.egresos.gastos_abarrotes;
        if (data.egresos.gastos_fiesta) newValues['ex_fiesta'] = data.egresos.gastos_fiesta;
        if (data.egresos.gastos_recargas) newValues['ex_recargas'] = data.egresos.gastos_recargas;
        if (data.egresos.otros_gastos) newValues['ex_otros'] = data.egresos.otros_gastos;
      }

      setManualValues(newValues);
      setStatus({ text: "Análisis completado. Revisa la auditoría y confirma.", type: 'success' });
    } catch (error) {
      console.error(error);
      setStatus({ text: "Error analizando el texto. Intenta de nuevo.", type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const auditResults = useMemo(() => {
    if (!analyzedData) return null;
    const v = manualValues;
    const round2 = (n: number) => Math.round(n * 100) / 100;

    const ventasTotal = round2(v['in_ventas'] || 0);
    const fiestaTotal = round2(v['in_fiesta'] || 0);
    const recargasTotal = round2(v['in_recargas'] || 0);
    const subtotal1 = round2(ventasTotal + fiestaTotal + recargasTotal);

    const pagoClientesTotal = round2(v['in_cxc_pago'] || 0);
    const estanciasTotal = round2(v['in_estancias'] || 0);
    const subtotal2 = round2(subtotal1 + pagoClientesTotal + estanciasTotal);

    const gastosTotal = round2(
      (v['ex_empleados'] || 0) + (v['ex_renta'] || 0) + (v['ex_personal'] || 0) + 
      (v['ex_mercancias'] || 0) + (v['ex_fiesta'] || 0) + (v['ex_recargas'] || 0) + 
      (v['ex_otros'] || 0)
    );

    const balance = round2(subtotal2 - gastosTotal);
    const entregado = round2(dineroEntregadoIA);
    const diferencia = round2(entregado - balance);

    return {
      ventasTotal, fiestaTotal, recargasTotal, subtotal1,
      pagoClientesTotal, estanciasTotal, subtotal2,
      gastosTotal, balance, entregado, diferencia,
      sobrante: diferencia > 0 ? diferencia : 0,
      faltante: diferencia < 0 ? Math.abs(diferencia) : 0,
      ventaCreditoTotal: round2(v['in_cxc_venta'] || 0)
    };
  }, [manualValues, analyzedData, dineroEntregadoIA]);

  const handleSave = async () => {
    if (!user || !schema) return;
    setIsSaving(true);
    setStatus({ text: "Sincronizando con el Índice F1...", type: 'info' });
    
    try {
      const batch = writeBatch(db);
      const groupId = `RD-${new Date().toISOString().split('T')[0]}-${Math.floor(Math.random()*1000)}`;
      const sourceLabel = activeTab === 'raw' ? 'CORTE_IA' : 'MANUAL';
      
      const allRubrics = [...schema.ingresos, ...schema.egresos];
      let movementsCount = 0;

      for (const rubric of allRubrics) {
        const amount = Math.round((manualValues[rubric.id] || 0) * 100) / 100;
        if (!amount || amount <= 0) continue;

        if (rubric.id === 'in_cxc_pago') {
          const accVentas = await AccountResolver.assertAccount(user.uid, 'ventas');
          const movVentasRef = doc(collection(db, "users", user.uid, "accounts", accVentas.accountDocId, "movements"));
          
          batch.update(doc(db, "users", user.uid, "accounts", accVentas.accountDocId), {
            balance: increment(amount), updatedAt: serverTimestamp()
          });
          batch.set(movVentasRef, {
            uid: user.uid, accountId: 'ventas', amount, type: 'INCOME',
            conceptTitle: "PAGO DE CLIENTES", conceptSubtitle: `Registro vía ${sourceLabel}`,
            source: sourceLabel, groupId, status: 'ACTIVE', createdAt: serverTimestamp(), effectiveAt: serverTimestamp()
          });

          const accCxC = await AccountResolver.assertAccount(user.uid, 'cxc');
          const movCxCRef = doc(collection(db, "users", user.uid, "accounts", accCxC.accountDocId, "movements"));
          
          batch.update(doc(db, "users", user.uid, "accounts", accCxC.accountDocId), {
            balance: increment(-amount), updatedAt: serverTimestamp()
          });
          batch.set(movCxCRef, {
            uid: user.uid, accountId: 'cxc', amount, type: 'EXPENSE',
            conceptTitle: "PAGO DE CLIENTES", conceptSubtitle: `Registro vía ${sourceLabel}`,
            source: sourceLabel, groupId, status: 'ACTIVE', createdAt: serverTimestamp(), effectiveAt: serverTimestamp()
          });
          
          movementsCount += 2;
          continue;
        }

        const accInfo = await AccountResolver.assertAccount(user.uid, rubric.accountId);
        const accDocRef = doc(db, "users", user.uid, "accounts", accInfo.accountDocId);
        const movDocRef = doc(collection(db, "users", user.uid, "accounts", accInfo.accountDocId, "movements"));

        const balanceChange = rubric.type === 'INCOME' ? amount : -amount;
        const conceptTitle = rubric.type === 'EXPENSE' ? `EGRESO ${rubric.label.toUpperCase()}` : rubric.label.toUpperCase();

        batch.update(accDocRef, {
          balance: increment(balanceChange),
          updatedAt: serverTimestamp()
        });

        batch.set(movDocRef, {
          uid: user.uid,
          accountId: rubric.accountId,
          amount: amount,
          type: rubric.type,
          conceptTitle: conceptTitle,
          conceptSubtitle: `Registro vía ${sourceLabel}`,
          source: sourceLabel,
          groupId,
          status: 'ACTIVE',
          createdAt: serverTimestamp(),
          effectiveAt: serverTimestamp()
        });

        // Auto-ajuste de inventarios por venta (Incluyendo Ventas a Crédito 'cxc')
        if (rubric.type === 'INCOME' && ['ventas', 'fiesta', 'recargas', 'cxc'].includes(rubric.accountId)) {
          const invAcc = await AccountResolver.assertAccount(user.uid, 'inventarios');
          const invDocRef = doc(db, "users", user.uid, "accounts", invAcc.accountDocId);
          const invMovRef = doc(collection(db, "users", user.uid, "accounts", invAcc.accountDocId, "movements"));
          
          let invTitle = `SALIDA INV (${rubric.label.toUpperCase()})`;
          if (rubric.id === 'in_cxc_venta') invTitle = "SALIDA INV (CXC)";

          batch.update(invDocRef, { balance: increment(-amount), updatedAt: serverTimestamp() });
          batch.set(invMovRef, {
            uid: user.uid,
            accountId: 'inventarios',
            amount: amount,
            type: 'EXPENSE',
            conceptTitle: invTitle,
            conceptSubtitle: "Auto-ajuste por venta",
            source: 'auto_inventory_sale',
            groupId,
            status: 'ACTIVE',
            createdAt: serverTimestamp(),
            effectiveAt: serverTimestamp()
          });
        }

        // Auto-ajuste de inventarios por compra
        const purchaseRubrics = ['ex_mercancias', 'ex_fiesta', 'ex_recargas'];
        if (purchaseRubrics.includes(rubric.id)) {
          const invAcc = await AccountResolver.assertAccount(user.uid, 'inventarios');
          const invDocRef = doc(db, "users", user.uid, "accounts", invAcc.accountDocId);
          const invMovRef = doc(collection(db, "users", user.uid, "accounts", invAcc.accountDocId, "movements"));

          let invTitle = "";
          if (rubric.id === 'ex_mercancias') invTitle = "ENTRADA INV (MERCANCÍA)";
          else if (rubric.id === 'ex_fiesta') invTitle = "ENTRADA INV (FIESTA)";
          else if (rubric.id === 'ex_recargas') invTitle = "ENTRADA INV (RECARGAS)";

          batch.update(invDocRef, { balance: increment(amount), updatedAt: serverTimestamp() });
          batch.set(invMovRef, {
            uid: user.uid,
            accountId: 'inventarios',
            amount: amount,
            type: 'INCOME',
            conceptTitle: invTitle,
            conceptSubtitle: "Auto-ajuste por compra",
            source: 'auto_inventory_purchase',
            groupId,
            status: 'ACTIVE',
            createdAt: serverTimestamp(),
            effectiveAt: serverTimestamp()
          });
        }

        movementsCount++;
      }

      // Registro de SOBRANTE (solo si aplica y estamos en modo IA)
      if (activeTab === 'raw' && auditResults && auditResults.sobrante > 0) {
        const sobrante = auditResults.sobrante;
        const accVentas = await AccountResolver.assertAccount(user.uid, 'ventas');
        const movVentasRef = doc(collection(db, "users", user.uid, "accounts", accVentas.accountDocId, "movements"));
        
        batch.update(doc(db, "users", user.uid, "accounts", accVentas.accountDocId), {
          balance: increment(sobrante), updatedAt: serverTimestamp()
        });
        batch.set(movVentasRef, {
          uid: user.uid, accountId: 'ventas', amount: sobrante, type: 'INCOME',
          conceptTitle: "INGRESO SOBRANTES", conceptSubtitle: "Corte IA (auditoría)",
          source: 'corte_ia', groupId, status: 'ACTIVE', createdAt: serverTimestamp(), effectiveAt: serverTimestamp()
        });
        movementsCount++;

        // Auto-ajuste de inventarios por Sobrante (Considerado como una salida de mercancía no registrada)
        const invAcc = await AccountResolver.assertAccount(user.uid, 'inventarios');
        const invDocRef = doc(db, "users", user.uid, "accounts", invAcc.accountDocId);
        const invMovRef = doc(collection(db, "users", user.uid, "accounts", invAcc.accountDocId, "movements"));
        
        batch.update(invDocRef, { balance: increment(-sobrante), updatedAt: serverTimestamp() });
        batch.set(invMovRef, {
          uid: user.uid,
          accountId: 'inventarios',
          amount: sobrante,
          type: 'EXPENSE',
          conceptTitle: "SALIDA INV (SOBRANTE)",
          conceptSubtitle: "Auto-ajuste por venta",
          source: 'auto_inventory_sale',
          groupId,
          status: 'ACTIVE',
          createdAt: serverTimestamp(),
          effectiveAt: serverTimestamp()
        });
        movementsCount++;
      }

      if (movementsCount === 0) {
        setStatus({ text: "No hay valores para registrar.", type: 'warning' });
        setIsSaving(false);
        return;
      }

      const corteRef = doc(collection(db, "users", user.uid, "cortes"));
      batch.set(corteRef, {
        admin: user.displayName || 'Admin',
        fecha: new Date().toISOString().split('T')[0],
        groupId,
        status: 'ACTIVE',
        createdAt: serverTimestamp(),
        totalMovements: movementsCount,
        audit: auditResults ? { ...auditResults } : null
      });

      await batch.commit();
      setStatus({ text: `✅ Corte registrado correctamente. Movimientos creados: ${movementsCount}`, type: 'success' });
      
      const resetValues: Record<string, number> = {};
      allRubrics.forEach(r => resetValues[r.id] = 0);
      setManualValues(resetValues);
      setRawText('');
      setAnalyzedData(null);
      setDineroEntregadoIA(0);
      setActiveTab('manual');

    } catch (e: any) {
      console.error(e);
      setStatus({ text: `Error al guardar: ${e.message}`, type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const formatMXN = (val: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);

  return (
    <div className="relative flex h-full min-h-screen w-full flex-col overflow-x-hidden pb-32 max-w-md mx-auto bg-background-light dark:bg-background-dark font-display">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      <header className="sticky top-0 z-30 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md pt-12 px-5 pb-4 border-b dark:border-white/5">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-slate-700 dark:text-white">
            <span className="material-symbols-outlined">menu</span>
          </button>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">Registro Diario</h1>
          <ProfileMenu />
        </div>
        <div className="flex p-1 bg-slate-200 dark:bg-surface-dark rounded-2xl">
          {['manual', 'raw'].map(mode => (
            <button 
              key={mode} 
              onClick={() => setActiveTab(mode as any)} 
              className={`flex-1 py-2.5 rounded-xl text-[11px] font-black uppercase transition-all ${activeTab === mode ? 'bg-primary text-white shadow-lg' : 'text-slate-500'}`}
            >
              {mode === 'manual' ? 'Manual' : 'Pegar Corte'}
            </button>
          ))}
        </div>
      </header>

      <main className="px-5 mt-6 space-y-8 pb-10">
        {status && (
          <div className={`p-4 rounded-2xl flex items-center gap-3 text-[11px] font-bold border animate-in slide-in-from-top-2 ${
            status.type === 'success' ? 'bg-emerald-50/10 text-emerald-500 border-emerald-500/20' : 
            status.type === 'error' ? 'bg-red-50/10 text-red-500 border-red-500/20' : 
            'bg-blue-50/10 text-blue-500 border-blue-500/20'
          }`}>
            <span className="material-symbols-outlined text-lg">{status.type === 'success' ? 'verified' : 'info'}</span>
            {status.text}
          </div>
        )}

        {activeTab === 'manual' ? (
          <div className="space-y-8 animate-in fade-in duration-300">
            {schema ? (
              <>
                <section className="space-y-4">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 ml-1">Ingresos de Caja</h3>
                  <div className="bg-white dark:bg-surface-dark p-5 rounded-[2rem] shadow-sm space-y-5">
                    {schema.ingresos.map(rubric => (
                      <MoneyInputWithCalculator 
                        key={rubric.id}
                        label={rubric.label} 
                        field={rubric.id} 
                        value={manualValues[rubric.id] || 0} 
                        onChange={handleInputChange} 
                      />
                    ))}
                  </div>
                </section>

                <section className="space-y-4">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 ml-1">Egresos del Periodo</h3>
                  <div className="bg-white dark:bg-surface-dark p-5 rounded-[2rem] shadow-sm space-y-5">
                    {schema.egresos.map(rubric => (
                      <MoneyInputWithCalculator 
                        key={rubric.id}
                        label={rubric.label} 
                        field={rubric.id} 
                        value={manualValues[rubric.id] || 0} 
                        onChange={handleInputChange} 
                      />
                    ))}
                  </div>
                </section>

                <button 
                  onClick={handleSave} 
                  disabled={isSaving} 
                  className="w-full py-5 bg-primary text-white font-black rounded-3xl shadow-xl shadow-primary/20 flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50"
                >
                  {isSaving ? <span className="material-symbols-outlined animate-spin">sync</span> : <span className="material-symbols-outlined">send</span>}
                  Sincronizar Operación F1
                </button>
              </>
            ) : (
              <div className="py-20 flex justify-center"><span className="material-symbols-outlined animate-spin text-primary">sync</span></div>
            )}
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in duration-300">
            {!analyzedData ? (
              <div className="bg-white dark:bg-surface-dark p-6 rounded-[2.5rem] shadow-sm space-y-4 border dark:border-white/5">
                <div className="flex items-center gap-3 text-primary mb-2">
                  <span className="material-symbols-outlined">auto_awesome</span>
                  <h3 className="text-sm font-black uppercase tracking-tight">F1-AI Parser</h3>
                </div>
                <p className="text-[11px] text-slate-500 font-bold leading-relaxed">
                  Pega el reporte de ventas de WhatsApp o texto libre. Nuestra IA identificará automáticamente los montos por rubro.
                </p>
                <textarea 
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="Ej: Ventas hoy: 4500, Gastos: sueldo juan 300..."
                  className="w-full h-48 bg-slate-50 dark:bg-background-dark/50 border border-slate-100 dark:border-white/5 rounded-2xl p-4 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 resize-none dark:text-white"
                />
                <button 
                  onClick={handleAnalyzeIA}
                  disabled={isSaving || !rawText.trim()}
                  className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-lg active:scale-95 transition-all disabled:opacity-30 flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined">analytics</span>
                  Analizar Reporte
                </button>
              </div>
            ) : (
              <div className="space-y-6 animate-in slide-in-from-bottom-4">
                <div className="p-6 bg-white dark:bg-surface-dark rounded-[2.5rem] border dark:border-white/10 shadow-xl space-y-6">
                  {/* AUDITORÍA F1 */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 text-indigo-500">
                      <span className="material-symbols-outlined">fact_check</span>
                      <h3 className="text-sm font-black uppercase tracking-widest">Auditoría de Corte</h3>
                    </div>

                    {/* SECCIÓN INGRESOS */}
                    <div className="space-y-3">
                       <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-white/5 pb-2">Ingresos Detectados (Efectivo)</h4>
                       <div className="space-y-2.5">
                          <div className="flex justify-between items-center text-xs font-bold text-slate-600 dark:text-slate-300">
                            <span>Ventas efectivo:</span>
                            <span>{formatMXN(auditResults?.ventasTotal || 0)}</span>
                          </div>
                          <div className="flex justify-between items-center text-xs font-bold text-slate-600 dark:text-slate-300">
                            <span>Fiesta:</span>
                            <span>{formatMXN(auditResults?.fiestaTotal || 0)}</span>
                          </div>
                          <div className="flex justify-between items-center text-xs font-bold text-slate-600 dark:text-slate-300">
                            <span>Recargas:</span>
                            <span>{formatMXN(auditResults?.recargasTotal || 0)}</span>
                          </div>
                          <div className="flex justify-between items-center py-2 px-3 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl text-xs font-black text-indigo-600 dark:text-indigo-400">
                            <span>SUBTOTAL 1 (VENTAS):</span>
                            <span>{formatMXN(auditResults?.subtotal1 || 0)}</span>
                          </div>
                          <div className="flex justify-between items-center text-xs font-bold text-slate-600 dark:text-slate-300">
                            <span>Cobranza (Pagos CxC):</span>
                            <span>{formatMXN(auditResults?.pagoClientesTotal || 0)}</span>
                          </div>
                          <div className="flex justify-between items-center text-xs font-bold text-slate-600 dark:text-slate-300">
                            <span>Estancias:</span>
                            <span>{formatMXN(auditResults?.estanciasTotal || 0)}</span>
                          </div>
                          <div className="flex justify-between items-center py-2 px-3 bg-indigo-600 text-white rounded-xl text-xs font-black">
                            <span>SUBTOTAL 2 (EFECTIVO BRUTO):</span>
                            <span>{formatMXN(auditResults?.subtotal2 || 0)}</span>
                          </div>
                       </div>
                    </div>

                    {/* SECCIÓN CARTERA (NO AFECTA BALANCE EFECTIVO) */}
                    <div className="space-y-3">
                       <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-white/5 pb-2">Cartera / No Efectivo</h4>
                       <div className="flex justify-between items-center text-xs font-bold text-amber-600 dark:text-amber-400">
                         <span>VENTA A CRÉDITO (CxC):</span>
                         <span>{formatMXN(auditResults?.ventaCreditoTotal || 0)}</span>
                       </div>
                       <p className="text-[8px] font-bold text-slate-400 uppercase leading-none">* Este monto no entra a caja, incrementa deuda de clientes.</p>
                    </div>

                    {/* SECCIÓN GASTOS */}
                    <div className="space-y-3">
                       <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-white/5 pb-2">Gastos Detectados</h4>
                       <div className="space-y-2">
                          {schema?.egresos.map(r => manualValues[r.id] > 0 && (
                            <div key={r.id} className="flex justify-between items-center text-xs font-bold text-red-500">
                              <span className="uppercase">{r.label}:</span>
                              <span>{formatMXN(manualValues[r.id])}</span>
                            </div>
                          ))}
                          <div className="flex justify-between items-center py-2 px-3 bg-red-50 dark:bg-red-500/10 rounded-xl text-xs font-black text-red-600 dark:text-red-400">
                            <span>TOTAL GASTOS:</span>
                            <span>{formatMXN(auditResults?.gastosTotal || 0)}</span>
                          </div>
                       </div>
                    </div>

                    {/* CIERRE DE AUDITORÍA */}
                    <div className="pt-4 space-y-4 border-t-2 border-slate-100 dark:border-white/5">
                       <div className="flex justify-between items-center">
                          <span className="text-xs font-black text-slate-500 uppercase">Balance esperado:</span>
                          <span className="text-lg font-black dark:text-white">{formatMXN(auditResults?.balance || 0)}</span>
                       </div>
                       <div className="flex justify-between items-center">
                          <span className="text-xs font-black text-slate-500 uppercase">Dinero entregado:</span>
                          <div className="text-right">
                             <span className="text-lg font-black text-primary">{formatMXN(dineroEntregadoIA)}</span>
                             {dineroEntregadoIA === 0 && (
                               <p className="text-[8px] font-black text-amber-500 animate-pulse uppercase">Revisar Dinero Entregado</p>
                             )}
                          </div>
                       </div>
                       
                       <div className={`p-4 rounded-2xl border-2 flex flex-col gap-1 ${
                         (auditResults?.diferencia || 0) > 0 ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-500/20' :
                         (auditResults?.diferencia || 0) < 0 ? 'bg-red-50 dark:bg-red-500/10 border-red-500/20' :
                         'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10'
                       }`}>
                          <div className="flex justify-between items-center">
                             <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Diferencia Final:</span>
                             <span className={`text-xl font-black ${(auditResults?.diferencia || 0) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                               {(auditResults?.diferencia || 0) >= 0 ? '+' : ''}{formatMXN(auditResults?.diferencia || 0)}
                             </span>
                          </div>
                          <div className="flex justify-end">
                             <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase ${
                               (auditResults?.diferencia || 0) > 0 ? 'bg-emerald-500 text-white' :
                               (auditResults?.diferencia || 0) < 0 ? 'bg-red-500 text-white' :
                               'bg-slate-300 text-slate-700'
                             }`}>
                               {(auditResults?.diferencia || 0) > 0 ? 'SOBRANTE' : (auditResults?.diferencia || 0) < 0 ? 'FALTANTE' : 'CUADRADO'}
                             </span>
                          </div>
                       </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 pt-4">
                    <button 
                      onClick={handleSave}
                      disabled={isSaving}
                      className="w-full py-5 bg-primary text-white font-black rounded-3xl shadow-xl shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-3"
                    >
                      {isSaving ? <span className="material-symbols-outlined animate-spin">sync</span> : <span className="material-symbols-outlined">verified</span>}
                      Confirmar y Registrar
                    </button>
                    <button 
                      onClick={() => { setAnalyzedData(null); setRawText(''); setDineroEntregadoIA(0); }}
                      className="w-full py-3 text-slate-400 font-bold text-[10px] uppercase tracking-widest"
                    >
                      Cancelar / Limpiar
                    </button>
                  </div>
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
