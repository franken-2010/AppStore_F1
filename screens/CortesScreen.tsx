
import React, { useState, useEffect } from 'react';
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
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { GeminiService } from '../services/geminiService';
import VoiceInputButton from '../components/VoiceInputButton';
import { AccountingAccount } from '../types';

type TabMode = 'manual' | 'raw';

const CortesScreen: React.FC = () => {
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
    const unsub = onSnapshot(query(collection(db, "users", user.uid, "accounts")), (snap) => {
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
    setIsSaving(true);
    try {
      await addDoc(collection(db, "cortes"), {
        uid: user.uid, 
        fecha, 
        modo: 'manual', 
        ...manualData, 
        totalIngresos, 
        totalEgresos, 
        efectivoReal, 
        diferencia,
        accounting: {
          incomeAccountId: selectedIncomeAcc,
          expenseAccountId: selectedExpenseAcc
        },
        createdAt: serverTimestamp()
      });
      setStatus({ text: 'Corte guardado y clasificado en contabilidad.', type: 'success' });
      setManualData({ ventas: 0, fiesta: 0, recargas: 0, estancias: 0, pagosCxc: 0, consumoPersonal: 0, gastosGenerales: 0, dineroEntregado: 0, ingresosCxc: 0, nota: '' });
      setSelectedIncomeAcc(''); setSelectedExpenseAcc('');
    } catch (err) { setStatus({ text: 'Error al guardar.', type: 'error' }); } finally { setIsSaving(false); }
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
                  <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Cuenta de Ingresos</label>
                  <select value={selectedIncomeAcc} onChange={(e) => setSelectedIncomeAcc(e.target.value)} className="w-full bg-slate-50 dark:bg-background-dark rounded-xl py-3 px-4 text-xs font-bold border-none appearance-none">
                    <option value="">Seleccionar cuenta...</option>
                    {accounts.filter(a => a.type === 'Ingreso' || a.type === 'Activo').map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Cuenta de Gastos</label>
                  <select value={selectedExpenseAcc} onChange={(e) => setSelectedExpenseAcc(e.target.value)} className="w-full bg-slate-50 dark:bg-background-dark rounded-xl py-3 px-4 text-xs font-bold border-none appearance-none">
                    <option value="">Seleccionar cuenta...</option>
                    {accounts.filter(a => a.type === 'Gasto' || a.type === 'Pasivo').map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
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
            
            <button onClick={handleSaveManual} disabled={isSaving} className="w-full py-4 bg-primary text-white font-black rounded-2xl shadow-xl active:scale-95 transition-all">
              {isSaving ? 'Guardando...' : 'Guardar y Clasificar'}
            </button>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in">
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center px-1">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Reporte Completo</label>
                <VoiceInputButton onResult={(t) => setRawText(rawText + '\n' + t)} />
              </div>
              <textarea value={rawText} onChange={(e) => setRawText(e.target.value)} className="w-full h-64 bg-white dark:bg-surface-dark rounded-2xl p-4 text-sm font-mono focus:ring-2 focus:ring-primary shadow-sm resize-none" placeholder="Pega el reporte..." />
            </div>
            <button onClick={async () => {setIsSaving(true); const r = await GeminiService.parseCorteText(rawText, fecha); setParsedPreview(r); setIsSaving(false);}} disabled={isSaving || !rawText} className="w-full py-4 bg-primary text-white font-black rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95">
              {isSaving ? 'Analizando...' : <><span className="material-symbols-outlined">psychology</span> Analizar con IA</>}
            </button>
            {parsedPreview && (
              <div className="p-6 bg-white dark:bg-surface-dark border border-primary/20 rounded-[2.5rem] animate-in zoom-in duration-300 shadow-2xl">
                <p className="text-3xl font-black text-primary tracking-tighter">${parsedPreview.subtotalDespuesEgresos.toLocaleString()}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Efectivo Calculado</p>
                <button onClick={() => setParsedPreview(null)} className="w-full py-3.5 bg-emerald-500 text-white font-black rounded-xl active:scale-95 transition-all shadow-lg shadow-emerald-500/20">Confirmar y Guardar</button>
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
