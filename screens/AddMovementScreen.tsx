
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
    selectedRubricId: '', // ID de rubro (ej: ex_mercancias)
    concept: '',
    effectiveAt: new Date()
  });

  const [status, setStatus] = useState<{ text: string, type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    if (!user) return;
    AccountResolver.loadIndex(user.uid);
    // FIX: Usar getMovementPicklists para obtener el formato { income, expense }
    AccountingService.getMovementPicklists(user.uid).then(res => {
      setPicklists(res);
    });
  }, [user]);

  const currentOptions = useMemo(() => {
    return formData.type === 'INCOME' ? (picklists.income || []) : (picklists.expense || []);
  }, [formData.type, picklists]);

  // Al cambiar tipo, resetear rubro seleccionado para evitar errores de lógica cruzada
  useEffect(() => {
    setFormData(prev => ({ ...prev, selectedRubricId: '' }));
  }, [formData.type]);

  const handleSave = async () => {
    if (!user || !formData.amount || !formData.selectedRubricId) {
      setStatus({ text: "Complete monto y seleccione un rubro.", type: 'error' });
      return;
    }
    
    setLoading(true);
    setStatus({ text: "Sincronizando con base de datos...", type: 'info' });

    try {
      // 1. Obtener info del rubro seleccionado
      const selectedRubric = currentOptions.find(o => o.id === formData.selectedRubricId);
      if (!selectedRubric) throw new Error("Rubro no válido.");

      // 2. Resolver docId de la cuenta principal
      const accountInfo = await AccountResolver.assertAccount(user.uid, selectedRubric.accountId);
      const accountDocId = accountInfo.accountDocId;

      // 3. Resolver cuenta de inventarios si aplica espejo
      const invMirrorTitle = AccountingService.getInventoryMirrorTitle(formData.selectedRubricId);
      let invAccountDocId: string | null = null;
      if (invMirrorTitle) {
        const invAccountInfo = await AccountResolver.assertAccount(user.uid, 'inventarios');
        invAccountDocId = invAccountInfo.accountDocId;
      }

      await runTransaction(db, async (transaction) => {
        const accountRef = doc(db, "users", user.uid, "accounts", accountDocId);
        const invRef = invAccountDocId ? doc(db, "users", user.uid, "accounts", invAccountDocId) : null;

        // ✅ REGLA: TODAS LAS LECTURAS PRIMERO
        const accSnap = await transaction.get(accountRef);
        if (!accSnap.exists()) throw new Error("La cuenta principal no existe.");

        let invSnap = null;
        if (invRef) {
          invSnap = await transaction.get(invRef);
          if (!invSnap.exists()) throw new Error("La cuenta de inventarios no existe.");
        }

        // --- CÁLCULOS ---
        const currentBalance = Number(accSnap.data()?.balance || 0);
        const amount = Math.round(formData.amount * 100) / 100;
        const impact = formData.type === 'INCOME' ? amount : -amount;
        const newBalance = currentBalance + impact;

        let currentInvBalance = 0;
        let newInvBalance = 0;
        if (invSnap) {
          currentInvBalance = Number(invSnap.data()?.balance || 0);
          newInvBalance = currentInvBalance + amount; // En compra, el inventario siempre sube (+)
        }

        // ✅ REGLA: TODAS LAS ESCRITURAS AL FINAL
        
        // Escritura Movimiento Principal
        const newMovRef = doc(collection(db, "users", user.uid, "accounts", accountDocId, "movements"));
        const conceptTitle = formData.concept.trim() 
          ? formData.concept.trim().toUpperCase() 
          : (formData.type === 'INCOME' ? `INGRESO: ${selectedRubric.label}` : `EGRESO: ${selectedRubric.label}`);

        transaction.set(newMovRef, {
          uid: user.uid,
          accountId: selectedRubric.accountId,
          amount: amount,
          type: formData.type,
          conceptTitle: conceptTitle,
          conceptSubtitle: "Registro Manual",
          source: 'manual',
          status: 'ACTIVE',
          createdAt: serverTimestamp(),
          effectiveAt: serverTimestamp() 
        });

        // Actualizar Balance Principal
        transaction.update(accountRef, {
          balance: newBalance,
          updatedAt: serverTimestamp()
        });

        // Escritura Movimiento Espejo Inventario (Si aplica)
        if (invRef && invMirrorTitle) {
          const invMovRef = doc(collection(db, "users", user.uid, "accounts", invAccountDocId!, "movements"));
          transaction.set(invMovRef, {
            uid: user.uid,
            accountId: 'inventarios',
            amount: amount,
            type: 'INCOME', // Entra inventario (sube nivel)
            conceptTitle: invMirrorTitle,
            conceptSubtitle: "Auto-ajuste por compra",
            source: 'auto_inventory_purchase',
            status: 'ACTIVE',
            createdAt: serverTimestamp(),
            effectiveAt: serverTimestamp()
          });

          // Actualizar Balance Inventarios
          transaction.update(invRef, {
            balance: newInvBalance,
            updatedAt: serverTimestamp()
          });
        }
      });

      setStatus({ text: "¡Registro sincronizado correctamente! ✅", type: 'success' });
      setTimeout(() => navigate(-1), 1000);
    } catch (e: any) {
      console.error(e);
      setStatus({ text: `Error: ${e.message}`, type: 'error' });
      setLoading(false);
    }
  };

  const isFormValid = formData.amount > 0 && formData.selectedRubricId !== '';

  return (
    <div className="relative flex flex-col h-screen w-full max-w-md mx-auto bg-background-dark font-display text-white overflow-hidden">
      <header className="pt-12 px-6 pb-6 border-b border-white/5 flex justify-between items-center bg-background-dark/95 backdrop-blur-md sticky top-0 z-50">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-white active:scale-90 transition-transform">
          <span className="material-symbols-outlined text-[28px]">close</span>
        </button>
        <h1 className="text-xl font-black tracking-tight">Nuevo Registro</h1>
        <div className="w-10"></div>
      </header>

      <main className="flex-1 p-6 space-y-7 overflow-y-auto no-scrollbar pb-32">
        {status && (
          <div className={`p-4 rounded-2xl flex items-center gap-3 text-[11px] font-bold border animate-in slide-in-from-top-2 ${
            status.type === 'success' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 
            status.type === 'error' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 
            'bg-blue-500/10 text-blue-500 border-blue-500/20'
          }`}>
            <span className="material-symbols-outlined text-lg">
              {status.type === 'success' ? 'verified' : status.type === 'error' ? 'error' : 'info'}
            </span>
            {status.text}
          </div>
        )}

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Tipo de Flujo</label>
          <div className="p-1 bg-white/5 rounded-2xl flex border border-white/5 shadow-inner">
            <button 
              onClick={() => setFormData({...formData, type: 'INCOME'})} 
              className={`flex-1 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${formData.type === 'INCOME' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-500'}`}
            >
              Ingreso
            </button>
            <button 
              onClick={() => setFormData({...formData, type: 'EXPENSE'})} 
              className={`flex-1 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${formData.type === 'EXPENSE' ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'text-slate-500'}`}
            >
              Egreso
            </button>
          </div>
        </div>

        <MoneyInputWithCalculator 
          label="Monto del Movimiento" 
          field="amount" 
          value={formData.amount} 
          onChange={(_, v) => setFormData({...formData, amount: parseFloat(v) || 0})} 
        />

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Clasificación / Rubro</label>
          <div className="relative group">
            <select 
              value={formData.selectedRubricId} 
              onChange={e => setFormData({...formData, selectedRubricId: e.target.value})}
              className="w-full bg-white/5 border border-white/5 rounded-2xl py-4.5 px-6 font-bold text-white outline-none focus:ring-2 focus:ring-primary/20 appearance-none shadow-sm cursor-pointer"
            >
              <option value="" disabled className="bg-background-dark">Selecciona un rubro...</option>
              {currentOptions.map((opt, i) => (
                <option key={i} value={opt.id} className="bg-surface-dark">{opt.label}</option>
              ))}
            </select>
            <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
              <span className="material-symbols-outlined">expand_more</span>
            </div>
          </div>
          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter px-1">
            Los gastos de compra ajustarán automáticamente el nivel de Inventarios.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Referencia / Notas (Opcional)</label>
          <input 
            value={formData.concept} 
            onChange={e => setFormData({...formData, concept: e.target.value})} 
            className="w-full bg-white/5 border border-white/5 rounded-2xl py-4.5 px-6 font-bold text-white outline-none focus:ring-2 focus:ring-primary/20 shadow-sm" 
            placeholder="Ej. Factura 123, Pago Coca-Cola..."
          />
        </div>

        <div className="pt-6">
           <button 
             onClick={handleSave} 
             disabled={loading || !isFormValid} 
             className="w-full py-5 bg-primary text-white font-black rounded-3xl shadow-xl shadow-primary/30 active:scale-95 disabled:opacity-50 disabled:grayscale transition-all flex items-center justify-center gap-3"
           >
             {loading ? <span className="material-symbols-outlined animate-spin text-xl">sync</span> : <span className="material-symbols-outlined text-xl">send</span>}
             {loading ? 'Sincronizando...' : 'Guardar en Sistema F1'}
           </button>
        </div>
      </main>
    </div>
  );
};

export default AddMovementScreen;
