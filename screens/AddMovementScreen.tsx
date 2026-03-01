
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { 
  collection, 
  serverTimestamp, 
  doc, 
  runTransaction
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { AccountingService } from '../services/AccountingService';
import { AccountResolver } from '../services/AccountResolver';
import MoneyInputWithCalculator from '../components/MoneyInputWithCalculator';

const AddMovementScreen: React.FC = () => {
  const { accountId: urlAccountDocId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [picklists, setPicklists] = useState<{income: any[], expense: any[]}>({ income: [], expense: [] });
  
  const [formData, setFormData] = useState({
    amount: 0,
    type: 'EXPENSE' as 'INCOME' | 'EXPENSE',
    selectedRubricId: '', 
    concept: ''
  });

  const [status, setStatus] = useState<{ text: string, type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    if (!user) return;
    AccountResolver.loadIndex(user.uid);
    AccountingService.getMovementPicklists(user.uid).then(res => {
      setPicklists(res);
    });
  }, [user]);

  const currentOptions = useMemo(() => {
    return formData.type === 'INCOME' ? (picklists.income || []) : (picklists.expense || []);
  }, [formData.type, picklists]);

  useEffect(() => {
    setFormData(prev => ({ ...prev, selectedRubricId: '' }));
  }, [formData.type]);

  const handleSave = async () => {
    if (!user || !formData.amount || !formData.selectedRubricId) {
      setStatus({ text: "Completa el monto y rubro.", type: 'error' });
      return;
    }
    
    setLoading(true);
    setStatus({ text: "Sincronizando...", type: 'info' });

    try {
      const selectedRubric = currentOptions.find(o => o.id === formData.selectedRubricId);
      if (!selectedRubric) throw new Error("Rubro no válido.");

      const accountInfo = await AccountResolver.assertAccount(user.uid, selectedRubric.accountId);
      const accountDocId = accountInfo.accountDocId;

      const invMirrorTitle = AccountingService.getInventoryMirrorTitle(formData.selectedRubricId);
      let invAccountDocId: string | null = null;
      if (invMirrorTitle) {
        const invAccountInfo = await AccountResolver.assertAccount(user.uid, 'inventarios');
        invAccountDocId = invAccountInfo.accountDocId;
      }

      await runTransaction(db, async (transaction) => {
        const accountRef = doc(db, "users", user.uid, "accounts", accountDocId);
        const invRef = invAccountDocId ? doc(db, "users", user.uid, "accounts", invAccountDocId) : null;

        const accSnap = await transaction.get(accountRef);
        if (!accSnap.exists()) throw new Error("Cuenta no encontrada.");

        let invSnap = null;
        if (invRef) {
          invSnap = await transaction.get(invRef);
          if (!invSnap.exists()) throw new Error("Inventarios no disponible.");
        }

        const currentBalance = Number(accSnap.data()?.balance || 0);
        const amount = Math.round(formData.amount * 100) / 100;
        const direction = formData.type === 'INCOME' ? 'IN' : 'OUT';
        const impact = direction === 'IN' ? amount : -amount;
        const newBalance = currentBalance + impact;

        const newMovRef = doc(collection(db, "users", user.uid, "accounts", accountDocId, "movements"));
        const conceptTitle = formData.concept.trim() 
          ? formData.concept.trim().toUpperCase() 
          : (formData.type === 'INCOME' ? `INGRESO: ${selectedRubric.label}` : `EGRESO: ${selectedRubric.label}`);

        transaction.set(newMovRef, {
          uid: user.uid,
          accountId: selectedRubric.accountId,
          amount: amount,
          type: formData.type,
          direction: direction,
          signedAmount: impact,
          rubro: selectedRubric.accountId,
          conceptTitle: conceptTitle,
          conceptSubtitle: "Registro Manual",
          source: 'manual',
          status: 'ACTIVE',
          createdAt: serverTimestamp()
        });

        transaction.update(accountRef, {
          balance: newBalance,
          updatedAt: serverTimestamp()
        });

        if (invRef && invMirrorTitle) {
          const invMovRef = doc(collection(db, "users", user.uid, "accounts", invAccountDocId!, "movements"));
          const currentInvBalance = Number(invSnap!.data()?.balance || 0);
          
          transaction.set(invMovRef, {
            uid: user.uid,
            accountId: 'inventarios',
            amount: amount,
            type: 'INCOME',
            direction: 'IN',
            signedAmount: amount,
            rubro: 'inventarios',
            conceptTitle: invMirrorTitle,
            conceptSubtitle: "Auto-ajuste F1",
            source: 'auto_inventory',
            status: 'ACTIVE',
            createdAt: serverTimestamp()
          });

          transaction.update(invRef, {
            balance: currentInvBalance + amount,
            updatedAt: serverTimestamp()
          });
        }
      });

      setStatus({ text: `Guardado ✅`, type: 'success' });
      setTimeout(() => navigate('/dashboard'), 800);
    } catch (e: any) {
      console.error(e);
      setStatus({ text: `Error al guardar.`, type: 'error' });
      setLoading(false);
    }
  };

  const isFormValid = formData.amount > 0 && formData.selectedRubricId !== '';

  return (
    <div className="relative flex flex-col h-screen w-full max-w-md mx-auto bg-[#0a0f1d] font-display text-white overflow-hidden">
      <header className="pt-12 px-6 pb-3 flex justify-between items-center bg-[#0a0f1d] border-b border-white/5 shrink-0">
        <button onClick={() => navigate(-1)} className="p-1 -ml-1 text-slate-400 active:text-white active:scale-90 transition-all">
          <span className="material-symbols-outlined text-[28px]">close</span>
        </button>
        <h1 className="text-sm font-black tracking-[0.15em] uppercase text-white">Nuevo Registro</h1>
        <div className="w-8"></div>
      </header>

      <main className="flex-1 p-5 space-y-4 flex flex-col justify-between overflow-hidden">
        <div className="space-y-5">
          {/* Alerta de Status Temporal */}
          {status && (
            <div className={`p-3.5 rounded-xl flex items-center gap-3 text-[10px] font-black uppercase tracking-widest border animate-in slide-in-from-top-2 ${
              status.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
              status.type === 'error' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 
              'bg-blue-500/10 text-blue-400 border-blue-500/20'
            }`}>
              <span className="material-symbols-outlined text-base">{status.type === 'success' ? 'verified' : 'info'}</span>
              {status.text}
            </div>
          )}

          <div className="p-1 bg-white/5 rounded-2xl flex border border-white/5 shadow-inner">
            <button onClick={() => setFormData({...formData, type: 'INCOME'})} className={`flex-1 py-3 rounded-[14px] text-[10px] font-black uppercase tracking-widest transition-all ${formData.type === 'INCOME' ? 'bg-blue-500 text-white shadow-lg' : 'text-slate-500'}`}>Entrada</button>
            <button onClick={() => setFormData({...formData, type: 'EXPENSE'})} className={`flex-1 py-3 rounded-[14px] text-[10px] font-black uppercase tracking-widest transition-all ${formData.type === 'EXPENSE' ? 'bg-rose-400 text-white shadow-lg' : 'text-slate-500'}`}>Salida</button>
          </div>

          <MoneyInputWithCalculator label="Valor de Operación" field="amount" value={formData.amount} onChange={(_, v) => setFormData({...formData, amount: parseFloat(v) || 0})} />

          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest ml-1">Rubro de Operación</label>
            <div className="relative">
              <select 
                value={formData.selectedRubricId} 
                onChange={e => setFormData({...formData, selectedRubricId: e.target.value})} 
                className="w-full bg-white/5 border border-white/5 rounded-xl py-4 px-5 font-bold text-sm text-white outline-none appearance-none"
              >
                <option value="" disabled className="bg-[#0a0f1d]">Selecciona un rubro...</option>
                {currentOptions.map((opt, i) => <option key={i} value={opt.id} className="bg-[#1a1f2e]">{opt.label}</option>)}
              </select>
              <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">expand_more</span>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest ml-1">Concepto Corto</label>
            <input 
              value={formData.concept} 
              onChange={e => setFormData({...formData, concept: e.target.value})} 
              className="w-full bg-white/5 border border-white/5 rounded-xl py-4 px-5 font-bold text-sm text-white outline-none focus:ring-1 focus:ring-blue-400/40" 
              placeholder="Ej. PAGO LUZ, VENTA EXTRA..." 
            />
          </div>
        </div>

        <div className="pt-2 pb-6">
           <button 
             onClick={handleSave} 
             disabled={loading || !isFormValid} 
             className="w-full py-5 bg-blue-500 text-white font-black rounded-2xl shadow-xl shadow-primary/20 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-3 text-xs uppercase tracking-widest"
           >
             {loading ? <span className="material-symbols-outlined animate-spin">sync</span> : <span className="material-symbols-outlined">send</span>} 
             {loading ? 'Sincronizando...' : 'Registrar Ahora'}
           </button>
        </div>
      </main>
    </div>
  );
};

export default AddMovementScreen;
