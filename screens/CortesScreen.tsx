
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import ProfileMenu from '../components/ProfileMenu';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  serverTimestamp,
  doc,
  writeBatch,
  increment,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { GeminiService } from '../services/geminiService';
import VoiceInputButton from '../components/VoiceInputButton';
import { AccountingAccount } from '../types';

type TabMode = 'manual' | 'raw';

const CortesScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabMode>('manual');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<{ text: string, type: 'success' | 'error' | 'warning' } | null>(null);
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);

  const [accounts, setAccounts] = useState<AccountingAccount[]>([]);
  const [selectedIncomeAcc, setSelectedIncomeAcc] = useState('');
  const [selectedExpenseAcc, setSelectedExpenseAcc] = useState('');

  const [manualData, setManualData] = useState({
    ventas: 0, fiesta: 0, recargas: 0, estancias: 0, pagosCxc: 0, consumoPersonal: 0, gastosGenerales: 0, dineroEntregado: 0, ingresosCxc: 0, nota: ''
  });

  useEffect(() => {
    if (!user) return;
    // Cargar cuentas del usuario para clasificación
    const q = query(collection(db, "users", user.uid, "accounts"), orderBy("order", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() } as AccountingAccount)));
    });
    return () => unsub();
  }, [user]);

  const totalIngresos = manualData.ventas + manualData.fiesta + manualData.recargas + manualData.estancias + manualData.pagosCxc;
  const totalEgresos = manualData.consumoPersonal + manualData.gastosGenerales;
  const efectivoReal = totalIngresos - totalEgresos;
  const diferencia = manualData.dineroEntregado - efectivoReal;

  const [rawText, setRawText] = useState('');
  const [parsedPreview, setParsedPreview] = useState<any>(null);

  const handleInputChange = (field: string, value: string) => {
    setManualData(prev => ({ ...prev, [field]: parseFloat(value) || 0 }));
  };

  const handleSaveManual = async () => {
    if (!user) return;
    if (!selectedIncomeAcc) {
      setStatus({ text: 'Debes seleccionar una cuenta de ingreso (ej. Caja).', type: 'error' });
      return;
    }

    setIsSaving(true);
    setStatus(null);

    try {
      const batch = writeBatch(db);

      // 1. Guardar el registro del corte
      const corteRef = doc(collection(db, "users", user.uid, "cortes"));
      batch.set(corteRef, {
        fecha, 
        modo: 'manual', 
        ...manualData, 
        totalIngresos, 
        totalEgresos, 
        efectivoReal, 
        diferencia,
        incomeAccountId: selectedIncomeAcc,
        expenseAccountId: selectedExpenseAcc || null,
        createdAt: serverTimestamp()
      });

      // 2. Actualizar balance de la cuenta de Ingresos (Suma ventas netas)
      const incomeAccRef = doc(db, "users", user.uid, "accounts", selectedIncomeAcc);
      batch.update(incomeAccRef, {
        balance: increment(efectivoReal),
        updatedAt: serverTimestamp()
      });

      // 3. Si hay cuenta de gastos y hay gastos, opcionalmente registrar (ya incluido en efectivoReal)
      // Nota: Aquí se asume que el efectivoReal es lo que entra a la cuenta seleccionada.

      await batch.commit();

      setStatus({ text: 'Corte guardado y saldo de cuenta actualizado.', type: 'success' });
      
      // Resetear form
      setManualData({ ventas: 0, fiesta: 0, recargas: 0, estancias: 0, pagosCxc: 0, consumoPersonal: 0, gastosGenerales: 0, dineroEntregado: 0, ingresosCxc: 0, nota: '' });
      setSelectedIncomeAcc(''); 
      setSelectedExpenseAcc('');
      
    } catch (err) { 
      console.error("Error saving corte:", err);
      setStatus({ text: 'Error al conectar con la base de datos.', type: 'error' }); 
    } finally { 
      setIsSaving(false); 
    }
  };

  const InputRow = ({ label, field, icon, value }: any) => (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 ml-1 flex items-center gap-1">
        <span className="material-symbols-outlined text-xs">{icon}</span> {label}
      </label>
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">$</span>
        <input type="number" value={value === 0 ? '' : value} onChange={(e) => handleInputChange(field, e.target.value)} className="w-full bg-white dark:bg-surface-dark border-none rounded-xl py-3 pl-8 pr-4 text-base font-bold focus:ring-2 focus:ring-primary shadow-sm transition-all" placeholder="0.00" />
      </div>
    </div>
  );

  return (
    <div className="relative flex h-full min-h-screen w-full flex-col overflow-x-hidden pb-32 max-w-md mx-auto bg-background-light dark:bg-background-dark font-display">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      <header className="sticky top-0 z-30 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md pt-12 px-5 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10"><span className="material-symbols-outlined">menu</span></button>
            <h1 className="text-xl font-extrabold tracking-tight">Registro Diario</h1>
          </div>
          <ProfileMenu />
        </div>
        <div className="flex p-1 bg-slate-200 dark:bg-surface-dark rounded-2xl">
          {['manual', 'raw'].map(mode => (
            <button key={mode} onClick={() => setActiveTab(mode as any)} className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === mode ? 'bg-white dark:bg-primary text-primary dark:text-white shadow-sm' : 'text-slate-500'}`}>
              {mode === 'manual' ? 'Manual' : 'Pegar Corte'}
            </button>
          ))}
        </div>
      </header>

      <main className="px-5 mt-4 space-y-6">
        {status && (
          <div className={`p-4 rounded-xl text-xs font-bold border animate-in slide-in-from-top-2 ${status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
            {status.text}
          </div>
        )}

        {activeTab === 'manual' ? (
          <div className="space-y-6 animate-in fade-in">
            <div className="flex flex-col gap-1 mb-2">
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Fecha del Corte</label>
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full bg-white dark:bg-surface-dark rounded-xl py-3 px-4 text-sm font-bold border-none" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <InputRow label="Ventas" field="ventas" icon="shopping_bag" value={manualData.ventas} />
              <InputRow label="Fiesta" field="fiesta" icon="celebration" value={manualData.fiesta} />
              <InputRow label="Recargas" field="recargas" icon="bolt" value={manualData.recargas} />
              <InputRow label="Estancias" field="estancias" icon="hotel" value={manualData.estancias} />
            </div>

            {/* Clasificación Contable */}
            <div className="p-5 bg-white dark:bg-surface-dark border border-slate-100 dark:border-white/5 rounded-3xl space-y-4 shadow-sm">
              <h3 className="text-[10px] font-black text-primary uppercase tracking-widest px-1">Clasificación Contable</h3>
              <div className="space-y-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] font-black uppercase text-slate-400 ml-1">¿A qué cuenta entra el dinero?</label>
                  <select 
                    value={selectedIncomeAcc} 
                    onChange={(e) => setSelectedIncomeAcc(e.target.value)} 
                    className="w-full bg-slate-50 dark:bg-background-dark rounded-xl py-3 px-4 text-xs font-bold border-none"
                  >
                    <option value="">Seleccionar cuenta (ej. Caja)...</option>
                    {accounts.filter(a => a.type === 'Activo').map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.name} - Bal: ${acc.balance?.toLocaleString()}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-surface-dark p-5 rounded-3xl space-y-4 shadow-inner">
               <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Nota / Observación</label>
               <div className="relative">
                 <textarea value={manualData.nota} onChange={(e) => setManualData({...manualData, nota: e.target.value})} className="w-full h-24 bg-white dark:bg-background-dark rounded-xl p-4 pr-12 text-sm font-bold border-none outline-none focus:ring-2 focus:ring-primary shadow-sm" placeholder="Opcional..." />
                 <VoiceInputButton onResult={(t) => setManualData({...manualData, nota: manualData.nota + ' ' + t})} className="absolute right-2 bottom-2" />
               </div>
            </div>

            <div className="p-6 bg-slate-900 rounded-3xl space-y-3 text-white">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-400 uppercase">Efectivo Calculado</span>
                <span className="text-xl font-black">${efectivoReal.toLocaleString()}</span>
              </div>
              <div className="h-px bg-white/10 w-full"></div>
              <div className="flex flex-col gap-1.5">
                 <label className="text-[10px] font-black uppercase text-slate-400">Efectivo en mano (Dinero entregado)</label>
                 <input 
                  type="number" 
                  value={manualData.dineroEntregado || ''} 
                  onChange={(e) => handleInputChange('dineroEntregado', e.target.value)} 
                  className="w-full bg-white/10 border-none rounded-xl py-3 px-4 text-white font-black" 
                  placeholder="0.00" 
                 />
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-xs font-bold text-slate-400 uppercase">Diferencia</span>
                <span className={`text-lg font-black ${diferencia === 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {diferencia > 0 ? '+' : ''}{diferencia.toLocaleString()}
                </span>
              </div>
            </div>
            
            <button 
              onClick={handleSaveManual} 
              disabled={isSaving} 
              className="w-full py-4 bg-primary text-white font-black rounded-2xl shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              {isSaving ? <span className="material-symbols-outlined animate-spin">sync</span> : <span className="material-symbols-outlined">save</span>}
              {isSaving ? 'Guardando...' : 'Finalizar y Actualizar Cuentas'}
            </button>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in">
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center px-1">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Reporte Completo (Make/WhatsApp)</label>
                <VoiceInputButton onResult={(t) => setRawText(rawText + '\n' + t)} />
              </div>
              <textarea value={rawText} onChange={(e) => setRawText(e.target.value)} className="w-full h-64 bg-white dark:bg-surface-dark rounded-2xl p-4 text-sm font-mono focus:ring-2 focus:ring-primary shadow-sm resize-none" placeholder="Pega el reporte aquí..." />
            </div>
            <button onClick={async () => {setIsSaving(true); try { const r = await GeminiService.parseCorteText(rawText, fecha); setParsedPreview(r); } catch(e) { setStatus({text: 'Error analizando el texto.', type:'error'})} finally { setIsSaving(false); }}} disabled={isSaving || !rawText} className="w-full py-4 bg-primary text-white font-black rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95">
              {isSaving ? 'Analizando...' : <><span className="material-symbols-outlined">psychology</span> Analizar con IA</>}
            </button>
            {parsedPreview && (
              <div className="p-6 bg-white dark:bg-surface-dark border border-primary/20 rounded-[2.5rem] animate-in zoom-in duration-300 shadow-2xl space-y-4">
                <div>
                  <p className="text-3xl font-black text-primary tracking-tighter">${parsedPreview.subtotalDespuesEgresos?.toLocaleString() || '0'}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Efectivo Detectado</p>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-500">Cuenta de destino</label>
                  <select 
                    value={selectedIncomeAcc} 
                    onChange={(e) => setSelectedIncomeAcc(e.target.value)} 
                    className="w-full bg-slate-50 dark:bg-background-dark rounded-xl py-3 px-4 text-xs font-bold border-none"
                  >
                    <option value="">Seleccionar cuenta...</option>
                    {accounts.filter(a => a.type === 'Activo').map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.name}</option>
                    ))}
                  </select>
                </div>
                <button 
                  onClick={() => {
                    // Mapear datos de IA a manualData para guardar
                    setManualData({
                      ...manualData,
                      ventas: parsedPreview.ventas || 0,
                      fiesta: parsedPreview.fiesta || 0,
                      recargas: parsedPreview.recargas || 0,
                      gastosGenerales: parsedPreview.egresos || 0,
                      dineroEntregado: parsedPreview.subtotalDespuesEgresos || 0
                    });
                    setActiveTab('manual');
                    setParsedPreview(null);
                  }} 
                  className="w-full py-3.5 bg-emerald-500 text-white font-black rounded-xl active:scale-95 transition-all shadow-lg shadow-emerald-500/20"
                >
                  Usar estos datos
                </button>
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
