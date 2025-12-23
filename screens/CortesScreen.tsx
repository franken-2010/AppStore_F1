
import React, { useState, useMemo } from 'react';
import BottomNav from '../components/BottomNav';
import ProfileMenu from '../components/ProfileMenu';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { GeminiService } from '../services/geminiService';

type TabMode = 'manual' | 'raw';

const CortesScreen: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabMode>('manual');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<{ text: string, type: 'success' | 'error' | 'warning' } | null>(null);

  // Fecha Común
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);

  // --- ESTADO MODO MANUAL ---
  const [manualData, setManualData] = useState({
    ventas: 0,
    fiesta: 0,
    recargas: 0,
    estancias: 0,
    pagosCxc: 0,
    consumoPersonal: 0,
    gastosGenerales: 0,
    dineroEntregado: 0,
    ingresosCxc: 0,
    nota: ''
  });

  // Cálculos Manuales basados en la nueva estructura
  const totalIngresos = manualData.ventas + manualData.fiesta + manualData.recargas + manualData.estancias + manualData.pagosCxc;
  const totalEgresos = manualData.consumoPersonal + manualData.gastosGenerales;
  const efectivoReal = totalIngresos - totalEgresos;
  const diferencia = manualData.dineroEntregado - efectivoReal;

  const clasificacion = useMemo(() => {
    if (diferencia > 0) return 'sobrante';
    if (diferencia < 0) return 'faltante';
    return 'cuadrado';
  }, [diferencia]);

  // --- ESTADO MODO RAW ---
  const [rawText, setRawText] = useState('');
  const [parsedPreview, setParsedPreview] = useState<any>(null);

  const handleInputChange = (field: string, value: string) => {
    const num = parseFloat(value) || 0;
    setManualData(prev => ({ ...prev, [field]: num }));
  };

  const handleSaveManual = async () => {
    if (!user) return;
    setIsSaving(true);
    setStatus(null);

    try {
      const creditNeto = manualData.ingresosCxc - manualData.pagosCxc;

      const payload = {
        uid: user.uid,
        fecha,
        createdAt: serverTimestamp(),
        modo: 'manual',
        ventas: manualData.ventas,
        fiesta: manualData.fiesta,
        recargas: manualData.recargas,
        totalGeneral: manualData.ventas + manualData.fiesta + manualData.recargas,
        estancias: manualData.estancias,
        pagosCxc: manualData.pagosCxc,
        subtotalIngresos: totalIngresos,
        consumoPersonal: manualData.consumoPersonal,
        gastosGenerales: manualData.gastosGenerales,
        totalEgresos: totalEgresos,
        efectivoReal: efectivoReal,
        dineroEntregado: manualData.dineroEntregado,
        diferencia,
        clasificacion,
        ingresosCxc: creditNeto,
        ingresosCxcBruto: manualData.ingresosCxc,
        nota: manualData.nota
      };

      await addDoc(collection(db, "cortes"), payload);
      
      setStatus({ text: 'Corte manual guardado con éxito.', type: 'success' });
      setManualData({
        ventas: 0, fiesta: 0, recargas: 0, estancias: 0,
        pagosCxc: 0, consumoPersonal: 0, gastosGenerales: 0,
        dineroEntregado: 0, ingresosCxc: 0, nota: ''
      });
      setTimeout(() => setStatus(null), 3000);
    } catch (err) {
      setStatus({ text: 'Error al guardar en Firestore.', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleProcessRaw = async () => {
    if (!rawText) return;
    setIsSaving(true);
    setStatus(null);
    setParsedPreview(null);

    try {
      const result = await GeminiService.parseCorteText(rawText, fecha);
      
      if (result.status === 'inconsistente') {
        setStatus({ 
          text: `Corte inconsistente: ${result.errors?.join(', ') || 'Error matemático'}`, 
          type: 'warning' 
        });
      }
      
      setParsedPreview(result);
    } catch (err) {
      setStatus({ text: 'Error al procesar con IA. Intente de nuevo.', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmRawSave = async () => {
    if (!user || !parsedPreview) return;
    setIsSaving(true);

    try {
      const creditNeto = (parsedPreview.ingresosCxc || 0) - (parsedPreview.pagosCxc || 0);

      const finalPayload = {
        ...parsedPreview,
        uid: user.uid,
        fecha,
        createdAt: serverTimestamp(),
        modo: 'raw',
        rawText,
        ingresosCxc: creditNeto,
        ingresosCxcBruto: parsedPreview.ingresosCxc
      };

      await addDoc(collection(db, "cortes"), finalPayload);
      setStatus({ text: 'Corte procesado y guardado correctamente.', type: 'success' });
      setRawText('');
      setParsedPreview(null);
      setTimeout(() => setStatus(null), 3000);
    } catch (err) {
      setStatus({ text: 'Error al guardar en Firestore.', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const InputRow = ({ label, field, icon, value }: any) => (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 ml-1 flex items-center gap-1">
        <span className="material-symbols-outlined text-xs">{icon}</span>
        {label}
      </label>
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">$</span>
        <input 
          type="number" 
          value={value === 0 ? '' : value}
          onChange={(e) => handleInputChange(field, e.target.value)}
          className="w-full bg-white dark:bg-surface-dark border-none rounded-xl py-3 pl-8 pr-4 text-base font-bold focus:ring-2 focus:ring-primary shadow-sm transition-all"
          placeholder="0.00"
        />
      </div>
    </div>
  );

  return (
    <div className="relative flex h-full min-h-screen w-full flex-col overflow-x-hidden pb-32 max-w-md mx-auto bg-background-light dark:bg-background-dark font-display">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      <header className="sticky top-0 z-30 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md pt-12 px-5 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10">
              <span className="material-symbols-outlined">menu</span>
            </button>
            <h1 className="text-xl font-extrabold tracking-tight">Registro Diario</h1>
          </div>
          <ProfileMenu />
        </div>

        <div className="flex p-1 bg-slate-200 dark:bg-surface-dark rounded-2xl">
          <button 
            onClick={() => { setActiveTab('manual'); setStatus(null); }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'manual' ? 'bg-white dark:bg-primary shadow-sm text-primary dark:text-white' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Manual
          </button>
          <button 
            onClick={() => { setActiveTab('raw'); setStatus(null); }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'raw' ? 'bg-white dark:bg-primary shadow-sm text-primary dark:text-white' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Pegar Corte
          </button>
        </div>
      </header>

      <main className="px-5 mt-4 space-y-6">
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 ml-1">Fecha del Corte</label>
          <div className="relative">
            <input 
              type="date" 
              value={fecha} 
              onChange={(e) => setFecha(e.target.value)}
              className="w-full bg-white dark:bg-surface-dark border-none rounded-xl py-4 px-4 text-base font-bold focus:ring-2 focus:ring-primary shadow-sm"
            />
            <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">calendar_today</span>
          </div>
        </div>

        {status && (
          <div className={`p-4 rounded-xl flex items-center gap-3 border animate-in fade-in slide-in-from-top-2 ${
            status.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 
            status.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-700' :
            'bg-red-50 border-red-200 text-red-700'
          }`}>
            <span className="material-symbols-outlined">{status.type === 'success' ? 'check_circle' : status.type === 'warning' ? 'warning' : 'error'}</span>
            <p className="text-xs font-bold">{status.text}</p>
          </div>
        )}

        {activeTab === 'manual' ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <InputRow label="Ventas" field="ventas" icon="shopping_bag" value={manualData.ventas} />
              <InputRow label="Fiesta" field="fiesta" icon="celebration" value={manualData.fiesta} />
              <InputRow label="Recargas" field="recargas" icon="bolt" value={manualData.recargas} />
              <InputRow label="Estancias" field="estancias" icon="hotel" value={manualData.estancias} />
              <InputRow label="Pago Clientes" field="pagosCxc" icon="payments" value={manualData.pagosCxc} />
              <InputRow label="Ingresos CxC" field="ingresosCxc" icon="call_received" value={manualData.ingresosCxc} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <InputRow label="Consumo Pers." field="consumoPersonal" icon="person" value={manualData.consumoPersonal} />
              <InputRow label="Gastos Gral." field="gastosGenerales" icon="receipt" value={manualData.gastosGenerales} />
            </div>

            <div className="bg-slate-50 dark:bg-surface-dark border border-slate-200 dark:border-white/5 rounded-2xl p-5 space-y-4 shadow-inner">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 ml-1">Dinero Entregado</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">$</span>
                  <input 
                    type="number" 
                    value={manualData.dineroEntregado === 0 ? '' : manualData.dineroEntregado}
                    onChange={(e) => handleInputChange('dineroEntregado', e.target.value)}
                    className="w-full bg-white dark:bg-background-dark border-none rounded-xl py-4 pl-8 pr-4 text-2xl font-black focus:ring-2 focus:ring-primary shadow-sm"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-white/10 flex flex-col gap-3">
                <div className="flex justify-between items-center text-xs font-bold text-slate-500">
                  <span>Efectivo Real</span>
                  <span className="text-slate-900 dark:text-white font-black">${efectivoReal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                   <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase text-slate-400">Balance</span>
                    <div className="flex items-center gap-2">
                       <span className={`text-xl font-black ${diferencia >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        ${diferencia.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <button 
              onClick={handleSaveManual}
              disabled={isSaving}
              className="w-full py-4 bg-primary hover:bg-primary-dark text-white font-black rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSaving ? <span className="material-symbols-outlined animate-spin">sync</span> : 'Guardar Corte Manual'}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 ml-1">Corte Completo (Texto)</label>
              <textarea 
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                className="w-full h-64 bg-white dark:bg-surface-dark border-none rounded-xl p-4 text-sm font-mono focus:ring-2 focus:ring-primary shadow-sm resize-none"
                placeholder="Pega aquí el reporte completo..."
              />
            </div>

            {parsedPreview && (
              <div className="p-5 rounded-2xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/5 space-y-6 shadow-xl animate-in fade-in zoom-in duration-300">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-2">
                  <h3 className="font-black text-sm text-primary uppercase">Resumen IA</h3>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${parsedPreview.status === 'ok' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-amber-500/10 border-amber-500/20 text-amber-500'}`}>
                    {parsedPreview.status === 'ok' ? 'Consistente' : 'Inconsistente'}
                  </span>
                </div>

                <div className="space-y-4">
                  {/* Ingresos en efectivo */}
                  <div>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Ingresos en efectivo</h4>
                    <div className="space-y-1 pl-2 border-l-2 border-primary/20 text-xs font-bold text-slate-700 dark:text-slate-300">
                      <div className="flex justify-between"><span>Ventas:</span> <span>${parsedPreview.ventas}</span></div>
                      <div className="flex justify-between"><span>Fiesta:</span> <span>${parsedPreview.fiesta}</span></div>
                      <div className="flex justify-between"><span>Recargas:</span> <span>${parsedPreview.recargas}</span></div>
                      <div className="flex justify-between"><span>Estancias:</span> <span>${parsedPreview.estancias}</span></div>
                      <div className="flex justify-between"><span>Pago de clientes:</span> <span>${parsedPreview.pagosCxc}</span></div>
                      <div className="flex justify-between pt-1 border-t border-slate-100 dark:border-white/5 text-slate-900 dark:text-white">
                        <span>Total de ingresos:</span> <span>${parsedPreview.subtotalIngresos}</span>
                      </div>
                    </div>
                  </div>

                  {/* Egresos */}
                  <div>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Egresos</h4>
                    <div className="space-y-1 pl-2 border-l-2 border-red-400/20 text-xs font-bold text-slate-700 dark:text-slate-300">
                      <div className="flex justify-between"><span>Gastos generales:</span> <span>${parsedPreview.gastosGenerales}</span></div>
                      <div className="flex justify-between"><span>Consumo personal:</span> <span>${parsedPreview.consumoPersonal}</span></div>
                      <div className="flex justify-between pt-1 border-t border-slate-100 dark:border-white/5 text-slate-900 dark:text-white">
                        <span>Total de egresos:</span> <span>${(parsedPreview.gastosGenerales + parsedPreview.consumoPersonal).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Balance General */}
                  <div className="pt-2">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Balance general</h4>
                    <div className="space-y-3 p-3 bg-slate-50 dark:bg-white/5 rounded-xl text-xs font-black">
                      <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                        <span className="text-[10px] uppercase font-bold tracking-tight">Efectivo real</span>
                        <span className="text-primary text-sm">${parsedPreview.subtotalDespuesEgresos.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center border-t border-slate-200 dark:border-white/10 pt-2">
                        <span className="text-[10px] uppercase font-bold tracking-tight text-slate-900 dark:text-white">Diferencia Final</span>
                        <span className={`text-xl font-black ${parsedPreview.diferencia >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          ${parsedPreview.diferencia.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Crédito Standalone */}
                  <div className="pt-2 border-t border-slate-100 dark:border-white/5 flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Ingresos CXC (Crédito):</span>
                    <span className="text-sm font-black text-blue-500">${parsedPreview.ingresosCxc}</span>
                  </div>
                </div>

                <button 
                  onClick={handleConfirmRawSave}
                  disabled={isSaving}
                  className="w-full py-4 bg-primary text-white font-black rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  Confirmar y Guardar Todo
                </button>
              </div>
            )}

            {!parsedPreview && (
              <button 
                onClick={handleProcessRaw}
                disabled={isSaving || !rawText}
                className="w-full py-4 bg-primary hover:bg-primary-dark text-white font-black rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSaving ? <span className="material-symbols-outlined animate-spin">sync</span> : <><span className="material-symbols-outlined">psychology</span> Procesar y Guardar</>}
              </button>
            )}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default CortesScreen;
