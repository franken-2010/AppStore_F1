
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { 
  doc, 
  getDoc, 
  serverTimestamp, 
  Timestamp,
  getDocs,
  collection,
  runTransaction
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { AccountingAccount, AccountMovement } from '../types';
import MoneyInputWithCalculator from '../components/MoneyInputWithCalculator';

const EditMovementScreen: React.FC = () => {
  const { accountId: docId, movementId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [movement, setMovement] = useState<AccountMovement | null>(null);
  const [accounts, setAccounts] = useState<AccountingAccount[]>([]);
  
  const [formData, setFormData] = useState({
    amount: 0,
    type: 'EXPENSE' as 'INCOME' | 'EXPENSE',
    status: 'ACTIVE' as 'ACTIVE' | 'VOID',
    title: '',
    subtitle: '',
    effectiveAt: new Date(),
    notes: '',
    targetAccountDocId: ''
  });

  useEffect(() => {
    if (!user || !docId || !movementId) return;
    
    const loadData = async () => {
      try {
        const accsSnap = await getDocs(collection(db, "users", user.uid, "accounts"));
        setAccounts(accsSnap.docs.map(d => ({ id: d.id, ...d.data() } as AccountingAccount)));

        const snap = await getDoc(doc(db, "users", user.uid, "accounts", docId, "movements", movementId));
        if (snap.exists()) {
          const data = snap.data() as AccountMovement;
          setMovement({ id: snap.id, ...data });
          setFormData({
            amount: data.amount,
            type: (data.type === 'INCOME' || (data.type as any) === 'INGRESO') ? 'INCOME' : 'EXPENSE',
            status: data.status === 'VOID' ? 'VOID' : 'ACTIVE',
            title: data.conceptTitle,
            subtitle: data.conceptSubtitle,
            effectiveAt: data.effectiveAt?.toDate() || new Date(),
            notes: data.notes || '',
            targetAccountDocId: docId
          });
        }
      } catch (e) {
        console.error("Error loading movement data:", e);
      } finally {
        setFetching(false);
      }
    };
    loadData();
  }, [user, docId, movementId]);

  const handleSave = async () => {
    if (!user || !docId || !movementId || !movement) return;
    setLoading(true);

    try {
      const isAccountChanged = formData.targetAccountDocId !== docId;
      const oldAccRef = doc(db, "users", user.uid, "accounts", docId);
      const newAccRef = doc(db, "users", user.uid, "accounts", formData.targetAccountDocId);
      const oldMovRef = doc(db, "users", user.uid, "accounts", docId, "movements", movementId);

      await runTransaction(db, async (transaction) => {
        const currentMovSnap = await transaction.get(oldMovRef);
        if (!currentMovSnap.exists()) throw new Error("El movimiento ya no existe.");
        const currentMov = currentMovSnap.data() as AccountMovement;

        let oldImpact = 0;
        if (currentMov.status !== 'VOID') {
          const isOldIncome = currentMov.type === 'INCOME' || (currentMov.type as any) === 'INGRESO';
          oldImpact = isOldIncome ? currentMov.amount : -currentMov.amount;
        }

        let newImpact = 0;
        if (formData.status === 'ACTIVE') {
          newImpact = formData.type === 'INCOME' ? formData.amount : -formData.amount;
        }

        if (!isAccountChanged) {
          const delta = newImpact - oldImpact;
          if (delta !== 0) {
            const accSnap = await transaction.get(oldAccRef);
            const currentBal = accSnap.data()?.balance || 0;
            transaction.update(oldAccRef, { balance: currentBal + delta, updatedAt: serverTimestamp() });
          }
          
          transaction.update(oldMovRef, {
            amount: Number(formData.amount),
            type: formData.type,
            status: formData.status,
            conceptTitle: formData.title.toUpperCase(),
            conceptSubtitle: formData.subtitle,
            effectiveAt: Timestamp.fromDate(formData.effectiveAt),
            notes: formData.notes,
            updatedAt: serverTimestamp(),
            ...(formData.status === 'VOID' && currentMov.status !== 'VOID' ? { voidedAt: serverTimestamp(), voidedBy: user.uid } : {})
          });
        } else {
          const oldAccSnap = await transaction.get(oldAccRef);
          transaction.update(oldAccRef, { balance: (oldAccSnap.data()?.balance || 0) - oldImpact, updatedAt: serverTimestamp() });

          const newAccSnap = await transaction.get(newAccRef);
          transaction.update(newAccRef, { balance: (newAccSnap.data()?.balance || 0) + newImpact, updatedAt: serverTimestamp() });

          transaction.update(oldMovRef, { 
            status: 'MOVED', 
            movedTo: { accountDocId: formData.targetAccountDocId, movementId: movementId },
            updatedAt: serverTimestamp() 
          });

          const newMovRef = doc(collection(db, "users", user.uid, "accounts", formData.targetAccountDocId, "movements"));
          transaction.set(newMovRef, {
            uid: user.uid,
            accountId: accounts.find(a => a.id === formData.targetAccountDocId)?.accountId || 'desconocida',
            amount: Number(formData.amount),
            type: formData.type,
            status: formData.status,
            conceptTitle: formData.title.toUpperCase(),
            conceptSubtitle: formData.subtitle,
            effectiveAt: Timestamp.fromDate(formData.effectiveAt),
            notes: formData.notes,
            source: currentMov.source,
            createdAt: currentMov.createdAt,
            updatedAt: serverTimestamp(),
            ...(formData.status === 'VOID' ? { voidedAt: serverTimestamp(), voidedBy: user.uid } : {})
          });
        }
      });

      navigate(`/account/history/${formData.targetAccountDocId}`);
    } catch (e: any) {
      console.error("F1-TRANSACTION-ERROR:", e);
      alert(`⚠️ Error al guardar: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return <div className="min-h-screen bg-[#0a0f1d] flex items-center justify-center"><span className="material-symbols-outlined animate-spin text-blue-400">sync</span></div>;

  return (
    <div className="relative flex flex-col h-screen w-full max-w-md mx-auto bg-[#0a0f1d] font-display text-white overflow-hidden">
      <header className="pt-12 px-6 pb-3 flex justify-between items-center bg-[#0a0f1d] border-b border-white/5 shrink-0">
        <button onClick={() => navigate(-1)} className="p-1 -ml-1 text-slate-400 active:text-white active:scale-90 transition-all">
          <span className="material-symbols-outlined text-[28px]">close</span>
        </button>
        <h1 className="text-sm font-black tracking-[0.15em] uppercase text-white">Editar Operación</h1>
        <div className="w-8"></div>
      </header>

      <main className="flex-1 p-5 space-y-4 flex flex-col justify-between overflow-hidden">
        <div className="space-y-4">
          {/* Switch de Tipo Compacto */}
          <div className="p-1 bg-white/5 rounded-2xl flex border border-white/5 shadow-inner shrink-0">
            <button 
              type="button"
              onClick={() => setFormData({...formData, type: 'INCOME'})} 
              className={`flex-1 py-3 rounded-[14px] text-[10px] font-black uppercase tracking-widest transition-all ${formData.type === 'INCOME' ? 'bg-blue-500 text-white shadow-lg shadow-primary/20' : 'text-slate-500'}`}
            >
              Entrada
            </button>
            <button 
              type="button"
              onClick={() => setFormData({...formData, type: 'EXPENSE'})} 
              className={`flex-1 py-3 rounded-[14px] text-[10px] font-black uppercase tracking-widest transition-all ${formData.type === 'EXPENSE' ? 'bg-rose-400 text-white shadow-lg shadow-rose-500/20' : 'text-slate-500'}`}
            >
              Salida
            </button>
          </div>

          <MoneyInputWithCalculator 
            label="Monto de la Operación" 
            field="amount" 
            value={formData.amount} 
            onChange={(_, v) => setFormData({...formData, amount: parseFloat(v) || 0})} 
          />

          <div className="grid grid-cols-2 gap-3 shrink-0">
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest ml-1">Cuenta Destino</label>
              <div className="relative">
                <select 
                  value={formData.targetAccountDocId} 
                  onChange={e => setFormData({...formData, targetAccountDocId: e.target.value})}
                  className="w-full bg-white/5 border border-white/5 rounded-xl py-3 px-4 font-bold text-[12px] text-white outline-none appearance-none pr-8"
                >
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id} className="bg-[#1a1f2e]">{acc.name}</option>
                  ))}
                </select>
                <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none text-sm">expand_more</span>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest ml-1">Estatus</label>
              <div className="relative">
                <select 
                  value={formData.status} 
                  onChange={e => setFormData({...formData, status: e.target.value as any})}
                  className={`w-full border rounded-xl py-3 px-4 font-bold text-[12px] outline-none appearance-none pr-8 ${formData.status === 'ACTIVE' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'}`}
                >
                  <option value="ACTIVE" className="bg-[#1a1f2e]">ACTIVO</option>
                  <option value="VOID" className="bg-[#1a1f2e]">ANULADO</option>
                </select>
                <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none text-sm">expand_more</span>
              </div>
            </div>
          </div>

          <div className="space-y-1 shrink-0">
            <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest ml-1">Concepto o Título</label>
            <input 
              value={formData.title} 
              onChange={e => setFormData({...formData, title: e.target.value})} 
              className="w-full bg-white/5 border border-white/5 rounded-xl py-3.5 px-4 font-bold text-sm text-white outline-none focus:ring-1 focus:ring-blue-400/40"
              placeholder="Ej. VENTA MAYORISTA..."
            />
          </div>

          <div className="space-y-1 shrink-0">
            <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest ml-1">Fecha de Registro</label>
            <input 
              type="datetime-local" 
              value={new Date(formData.effectiveAt.getTime() - formData.effectiveAt.getTimezoneOffset() * 60000).toISOString().slice(0, 16)} 
              onChange={e => setFormData({...formData, effectiveAt: new Date(e.target.value)})} 
              className="w-full bg-white/5 border border-white/5 rounded-xl py-3 px-4 font-bold text-xs text-white outline-none" 
            />
          </div>

          <div className="space-y-1 shrink-0">
            <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest ml-1">Notas (Opcional)</label>
            <textarea 
              value={formData.notes} 
              onChange={e => setFormData({...formData, notes: e.target.value})} 
              className="w-full bg-white/5 border border-white/5 rounded-xl py-3 px-4 font-bold text-xs text-white outline-none h-16 resize-none no-scrollbar" 
              placeholder="Detalles de la transacción..."
            />
          </div>
        </div>

        <div className="pt-2 pb-6">
           <button 
             type="button"
             onClick={handleSave} 
             disabled={loading || !formData.amount || !formData.title} 
             className="w-full py-5 bg-blue-500 text-white font-black rounded-2xl shadow-xl shadow-primary/20 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-3 text-xs uppercase tracking-widest"
           >
             {loading ? <span className="material-symbols-outlined animate-spin">sync</span> : <span className="material-symbols-outlined">verified</span>}
             {loading ? 'Sincronizando...' : 'Confirmar Cambios'}
           </button>
        </div>
      </main>
    </div>
  );
};

export default EditMovementScreen;
