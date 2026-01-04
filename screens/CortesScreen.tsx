
import React, { useState, useEffect } from 'react';
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
  orderBy
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { GeminiService } from '../services/geminiService';
import VoiceInputButton from '../components/VoiceInputButton';
import { AccountingAccount, AccountCategory } from '../types';

type TabMode = 'manual' | 'raw';

const EditableMonto = ({ label, value, onChange }: { label: string, value: number, onChange: (val: number) => void }) => (
  <div className="flex items-center justify-between py-2 border-b border-white/5">
    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</span>
    <div className="relative">
      <span className="absolute left-0 top-1/2 -translate-y-1/2 text-primary font-bold">$</span>
      <input 
        type="number" 
        value={value} 
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="bg-transparent border-none text-right font-black text-sm p-0 pl-4 focus:ring-0 w-24 text-white"
      />
    </div>
  </div>
);

const InputRow = ({ label, field, icon, value, onChange }: { label: string, field: string, icon: string, value: number, onChange: (f: string, v: string) => void }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1 flex items-center gap-1">
      <span className="material-symbols-outlined text-xs">{icon}</span>
      {label}
    </label>
    <div className="relative">
      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary font-bold">$</span>
      <input 
        type="number" 
        value={value === 0 ? '' : value} 
        onChange={(e) => onChange(field, e.target.value)}
        className="w-full py-3 pl-8 pr-4 bg-white dark:bg-[#111827] border border-slate-200 dark:border-white/5 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-primary shadow-sm dark:text-white"
        placeholder="0.00"
      />
    </div>
  </div>
);

const CortesScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<TabMode>('manual');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<{ text: string, type: 'success' | 'error' | 'warning' } | null>(null);
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);

  const [accounts, setAccounts] = useState<AccountingAccount[]>([]);
  const [categories, setCategories] = useState<AccountCategory[]>([]);
  const [ventasEfectivoAcc, setVentasEfectivoAcc] = useState<AccountingAccount | null>(null);
  const [cxcAcc, setCxcAcc] = useState<AccountingAccount | null>(null);
  const [selectedExpenseAccId, setSelectedExpenseAccId] = useState('');

  const [manualData, setManualData] = useState({
    ventas: 0, fiesta: 0, recargas: 0, estancias: 0, pagosCxc: 0, gastosGenerales: 0
  });

  const [rawText, setRawText] = useState('');
  const [parsedPreview, setParsedPreview] = useState<any>(null);
  const [editedData, setEditedData] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    
    // Obtener categorías
    const qCat = query(collection(db, "users", user.uid, "categories"));
    const unsubCat = onSnapshot(qCat, (snap) => {
      setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() } as AccountCategory)));
    });

    // Obtener cuentas
    const qAcc = query(collection(db, "users", user.uid, "accounts"), orderBy("order", "asc"));
    const unsubAcc = onSnapshot(qAcc, (snap) => {
      const accs = snap.docs.map(d => ({ id: d.id, ...d.data() } as AccountingAccount));
      setAccounts(accs);
      
      const vEfectivo = accs.find(a => a.name.toLowerCase().includes('ventas') && a.name.toLowerCase().includes('efectivo'));
      const cxc = accs.find(a => a.name.toLowerCase().includes('cxc') || a.name.toLowerCase().includes('cobrar') || a.name.toLowerCase().includes('clientes'));
      
      if (vEfectivo) {
        setVentasEfectivoAcc(vEfectivo);
        setSelectedExpenseAccId(vEfectivo.id!); 
      }
      if (cxc) setCxcAcc(cxc);
    });

    return () => { unsubCat(); unsubAcc(); };
  }, [user]);

  // Filtrar cuentas para gastos: Categorías BANCOS/EFECTIVO o nombre específico
  const expenseAccounts = accounts.filter(acc => {
    const category = categories.find(c => c.id === acc.categoryId);
    const catName = category?.name?.toLowerCase() || '';
    const accName = acc.name.toLowerCase();
    
    return catName.includes('banco') || catName.includes('efectivo') || 
           accName.includes('banco') || accName.includes('efectivo') || accName.includes('caja');
  });

  const handleInputChange = (field: string, value: string) => {
    setManualData(prev => ({ ...prev, [field]: parseFloat(value) || 0 }));
  };

  const handleSaveManual = async () => {
    if (!user) return;
    if (!ventasEfectivoAcc) {
      setStatus({ text: 'Error: No se encontró la cuenta "Ventas en efectivo".', type: 'error' });
      return;
    }
    
    setIsSaving(true);
    setStatus(null);

    try {
      const batch = writeBatch(db);
      
      // 1. Registro del corte
      const corteRef = doc(collection(db, "users", user.uid, "cortes"));
      batch.set(corteRef, {
        fecha,
        modo: 'manual_v3_blocks',
        data: manualData,
        admin: profile?.displayName,
        createdAt: serverTimestamp()
      });

      // 2. BLOQUE INGRESOS -> Carga a "Ventas en efectivo"
      const totalIngresos = manualData.ventas + manualData.fiesta + manualData.recargas + manualData.estancias + manualData.pagosCxc;
      
      if (totalIngresos > 0) {
        const vEfectivoRef = doc(db, "users", user.uid, "accounts", ventasEfectivoAcc.id!);
        batch.update(vEfectivoRef, {
          balance: increment(totalIngresos),
          updatedAt: serverTimestamp()
        });

        const vEfectivoMoveRef = doc(collection(db, "users", user.uid, "accounts", ventasEfectivoAcc.id!, "movements"));
        batch.set(vEfectivoMoveRef, {
          ts: serverTimestamp(),
          amount: totalIngresos,
          direction: 'in',
          category: 'Ingreso Diario Manual',
          description: `Bloque de ingresos (Ventas, Fiesta, Recargas, etc) del día ${fecha}.`,
          balanceAfter: 0
        });
      }

      // 3. Lógica PAGOS CXC -> Egreso en la cuenta de CXC (abono al crédito)
      if (manualData.pagosCxc > 0 && cxcAcc) {
        const cxcRef = doc(db, "users", user.uid, "accounts", cxcAcc.id!);
        batch.update(cxcRef, {
          balance: increment(-manualData.pagosCxc),
          updatedAt: serverTimestamp()
        });

        const cxcMoveRef = doc(collection(db, "users", user.uid, "accounts", cxcAcc.id!, "movements"));
        batch.set(cxcMoveRef, {
          ts: serverTimestamp(),
          amount: manualData.pagosCxc,
          direction: 'out',
          category: 'Abono de Cliente (CXC)',
          description: `Pago a crédito recibido en corte manual del ${fecha}.`,
          balanceAfter: 0
        });
      }

      // 4. BLOQUE EGRESOS -> Deducción de la cuenta seleccionada (Bancos/Efectivo)
      if (manualData.gastosGenerales > 0 && selectedExpenseAccId) {
        const expenseAccRef = doc(db, "users", user.uid, "accounts", selectedExpenseAccId);
        batch.update(expenseAccRef, {
          balance: increment(-manualData.gastosGenerales),
          updatedAt: serverTimestamp()
        });

        const expenseMoveRef = doc(collection(db, "users", user.uid, "accounts", selectedExpenseAccId, "movements"));
        batch.set(expenseMoveRef, {
          ts: serverTimestamp(),
          amount: manualData.gastosGenerales,
          direction: 'out',
          category: 'Egreso Gral.',
          description: `Gasto general registrado manualmente el ${fecha}.`,
          balanceAfter: 0
        });
      }

      await batch.commit();
      setStatus({ text: '¡Registro manual finalizado con éxito!', type: 'success' });
      setManualData({ ventas: 0, fiesta: 0, recargas: 0, estancias: 0, pagosCxc: 0, gastosGenerales: 0 });
    } catch (e) {
      console.error(e);
      setStatus({ text: 'Error al procesar el registro manual.', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAnalyzeIA = async () => {
    if (!rawText) return;
    setIsSaving(true);
    setStatus(null);
    try {
      const result = await GeminiService.parseCorteText(rawText, fecha);
      setParsedPreview(result);
      setEditedData(JSON.parse(JSON.stringify(result)));
    } catch (e) {
      setStatus({ text: 'Error analizando con IA.', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="relative flex h-full min-h-screen w-full flex-col overflow-x-hidden pb-32 max-w-md mx-auto bg-background-light dark:bg-background-dark font-display">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      <header className="sticky top-0 z-30 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md pt-12 px-5 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-slate-700 dark:text-white">
              <span className="material-symbols-outlined">menu</span>
            </button>
            <h1 className="text-xl font-extrabold tracking-tight">Registro Diario</h1>
          </div>
          <ProfileMenu />
        </div>
        <div className="flex p-1 bg-slate-200 dark:bg-surface-dark rounded-2xl">
          {['manual', 'raw'].map(mode => (
            <button key={mode} onClick={() => setActiveTab(mode as any)} className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === mode ? 'bg-primary text-white shadow-sm' : 'text-slate-500'}`}>
              {mode === 'manual' ? 'Manual' : 'Pegar Corte'}
            </button>
          ))}
        </div>
      </header>

      <main className="px-5 mt-4 space-y-8 pb-10">
        {status && (
          <div className={`p-4 rounded-xl text-xs font-bold border animate-in slide-in-from-top-2 flex items-center gap-3 ${status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
            <span className="material-symbols-outlined text-lg">{status.type === 'success' ? 'verified' : 'error'}</span>
            {status.text}
          </div>
        )}

        {activeTab === 'manual' && (
          <div className="space-y-10 animate-in fade-in">
            {/* BLOQUE DE INGRESOS */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 px-1">
                <div className="size-8 bg-emerald-500/10 text-emerald-500 rounded-lg flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg">add_circle</span>
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 leading-none">Ingresos</h3>
                  <p className="text-[9px] font-bold text-slate-400 mt-0.5 italic">Se cargarán a: {ventasEfectivoAcc?.name || 'Ventas efectivo'}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 bg-white dark:bg-[#1a2235] p-5 rounded-[2.5rem] border border-slate-100 dark:border-white/5 shadow-sm">
                <InputRow label="Ventas" field="ventas" icon="shopping_bag" value={manualData.ventas} onChange={handleInputChange} />
                <InputRow label="Fiesta" field="fiesta" icon="celebration" value={manualData.fiesta} onChange={handleInputChange} />
                <InputRow label="Recargas" field="recargas" icon="bolt" value={manualData.recargas} onChange={handleInputChange} />
                <InputRow label="Estancias" field="estancias" icon="hotel" value={manualData.estancias} onChange={handleInputChange} />
                <div className="col-span-2 mt-2 pt-2 border-t border-slate-100 dark:border-white/5">
                  <InputRow label="Pagos CXC" field="pagosCxc" icon="payments" value={manualData.pagosCxc} onChange={handleInputChange} />
                  <p className="text-[9px] text-slate-400 font-bold mt-1 px-1">* Reduce saldo de {cxcAcc?.name || 'Cuentas por cobrar'}</p>
                </div>
              </div>
            </section>

            {/* BLOQUE DE EGRESOS */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 px-1">
                <div className="size-8 bg-red-500/10 text-red-500 rounded-lg flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg">remove_circle</span>
                </div>
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Egresos</h3>
              </div>
              
              <div className="bg-white dark:bg-[#1a2235] p-6 rounded-[2.5rem] border border-slate-100 dark:border-white/5 shadow-sm space-y-6">
                <InputRow label="Gastos Generales" field="gastosGenerales" icon="receipt_long" value={manualData.gastosGenerales} onChange={handleInputChange} />
                
                <div className="flex flex-col gap-2 pt-2 border-t border-slate-100 dark:border-white/5">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1 flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs text-primary">account_balance_wallet</span>
                    Cargar gasto a: (Bancos/Efectivo)
                  </label>
                  <div className="relative">
                    <select 
                      value={selectedExpenseAccId} 
                      onChange={(e) => setSelectedExpenseAccId(e.target.value)} 
                      className="w-full bg-slate-50 dark:bg-[#111827] border-2 border-slate-200 dark:border-white/10 rounded-2xl py-3.5 px-5 text-sm font-bold dark:text-white appearance-none outline-none focus:border-primary transition-all pr-12"
                    >
                      <option value="">Seleccionar cuenta origen...</option>
                      {expenseAccounts.map(acc => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} (${acc.balance?.toLocaleString()})
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <span className="material-symbols-outlined text-[20px]">expand_more</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <button 
              onClick={handleSaveManual} 
              disabled={isSaving} 
              className="w-full py-5 bg-primary text-white font-black rounded-3xl shadow-xl shadow-primary/20 active:scale-[0.98] transition-all flex items-center justify-center gap-3 text-lg mt-4"
            >
              {isSaving ? <span className="material-symbols-outlined animate-spin text-2xl">sync</span> : <span className="material-symbols-outlined text-2xl">save</span>}
              Finalizar Registro Manual
            </button>
          </div>
        )}

        {activeTab === 'raw' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center px-1">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Pega el reporte aquí</label>
                <VoiceInputButton onResult={(t) => setRawText(rawText + '\n' + t)} />
              </div>
              <textarea 
                value={rawText} 
                onChange={(e) => setRawText(e.target.value)} 
                className="w-full h-64 bg-white dark:bg-[#1a2235] rounded-3xl p-6 text-sm font-mono focus:ring-2 focus:ring-primary shadow-sm resize-none border-none outline-none dark:text-slate-300" 
                placeholder="Corte del día..." 
              />
            </div>
            <button 
              onClick={handleAnalyzeIA} 
              disabled={isSaving || !rawText} 
              className="w-full py-4 bg-primary text-white font-black rounded-2xl shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              {isSaving ? <span className="material-symbols-outlined animate-spin">sync</span> : <span className="material-symbols-outlined">psychology</span>}
              Analizar Auditoría con IA
            </button>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
};

export default CortesScreen;
