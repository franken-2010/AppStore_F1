
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { 
  doc, 
  getDoc, 
  writeBatch, 
  increment, 
  serverTimestamp, 
  Timestamp,
  collectionGroup,
  query,
  where,
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
        // 1. Obtener datos actuales de la base
        const currentMovSnap = await transaction.get(oldMovRef);
        if (!currentMovSnap.exists()) throw new Error("El movimiento ya no existe.");
        const currentMov = currentMovSnap.data() as AccountMovement;

        // 2. Calcular Impacto Anterior
        // Solo impactó si era ACTIVE. Si ya era VOID, el impacto previo era 0.
        let oldImpact = 0;
        if (currentMov.status !== 'VOID') {
          const isOldIncome = currentMov.type === 'INCOME' || (currentMov.type as any) === 'INGRESO';
          oldImpact = isOldIncome ? currentMov.amount : -currentMov.amount;
        }

        // 3. Calcular Impacto Nuevo
        // Solo impactará si el nuevo estado es ACTIVE.
        let newImpact = 0;
        if (formData.status === 'ACTIVE') {
          newImpact = formData.type === 'INCOME' ? formData.amount : -formData.amount;
        }

        // 4. Actualizar Balances
        if (!isAccountChanged) {
          const delta = newImpact - oldImpact;
          if (delta !== 0) {
            const accSnap = await transaction.get(oldAccRef);
            const currentBal = accSnap.data()?.balance || 0;
            transaction.update(oldAccRef, { balance: currentBal + delta, updatedAt: serverTimestamp() });
          }
          
          // Actualizar movimiento existente
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
          // Cambio de cuenta: Revertir en vieja, aplicar en nueva
          const oldAccSnap = await transaction.get(oldAccRef);
          transaction.update(oldAccRef, { balance: (oldAccSnap.data()?.balance || 0) - oldImpact, updatedAt: serverTimestamp() });

          const newAccSnap = await transaction.get(newAccRef);
          transaction.update(newAccRef, { balance: (newAccSnap.data()?.balance || 0) + newImpact, updatedAt: serverTimestamp() });

          // Marcar original como MOVED
          transaction.update(oldMovRef, { 
            status: 'MOVED', 
            movedTo: { accountDocId: formData.targetAccountDocId, movementId: movementId },
            updatedAt: serverTimestamp() 
          });

          // Crear nuevo movimiento en cuenta destino
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

  if (fetching) return <div className="min-h-screen bg-background-dark flex items-center justify-center"><span className="material-symbols-outlined animate-spin text-primary">sync</span></div>;

  return (
    <div className="relative flex flex-col h-screen w-full max-w-md mx-auto bg-background-dark font-display text-white overflow-hidden">
      <header className="pt-12 px-6 pb-6 border-b border-white/5 flex justify-between items-center bg-background-dark/95 backdrop-blur-md sticky top-0 z-50">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-white active:scale-90"><span className="material-symbols-outlined text-[28px]">close</span></button>
        <h1 className="text-xl font-black tracking-tight">Editar Movimiento</h1>
        <div className="w-10"></div>
      </header>

      <main className="flex-1 p-6 space-y-7 overflow-y-auto no-scrollbar pb-40">
        <div className="p-1 bg-white/5 rounded-2xl flex border border-white/5 shadow-inner">
          <button 
            type="button"
            onClick={() => setFormData({...formData, type: 'INCOME'})} 
            className={`flex-1 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${formData.type === 'INCOME' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Ingreso
          </button>
          <button 
            type="button"
            onClick={() => setFormData({...formData, type: 'EXPENSE'})} 
            className={`flex-1 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${formData.type === 'EXPENSE' ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Egreso
          </button>
        </div>

        <MoneyInputWithCalculator 
          label="Monto" 
          field="amount" 
          value={formData.amount} 
          onChange={(_, v) => setFormData({...formData, amount: parseFloat(v) || 0})} 
        />

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Cuenta de Origen</label>
          <select 
            value={formData.targetAccountDocId} 
            onChange={e => setFormData({...formData, targetAccountDocId: e.target.value})}
            className="w-full bg-white/5 border border-white/5 rounded-2xl py-4.5 px-6 font-bold text-white outline-none focus:ring-2 focus:ring-primary/20 appearance-none shadow-sm"
          >
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id} className="bg-surface-dark">{acc.name} ({acc.type})</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Estatus del Movimiento</label>
          <div className="grid grid-cols-2 gap-3">
             <button 
               type="button"
               onClick={() => setFormData({...formData, status: 'ACTIVE'})}
               className={`py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest border transition-all ${formData.status === 'ACTIVE' ? 'bg-emerald-500/10 border-emerald-500 text-emerald-500 shadow-lg' : 'bg-white/5 border-white/5 text-slate-500'}`}
             >
               Activo
             </button>
             <button 
               type="button"
               onClick={() => setFormData({...formData, status: 'VOID'})}
               className={`py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest border transition-all ${formData.status === 'VOID' ? 'bg-red-500/10 border-red-500 text-red-500 shadow-lg' : 'bg-white/5 border-white/5 text-slate-500'}`}
             >
               Anulado (VOID)
             </button>
          </div>
          {formData.status === 'VOID' && (
            <p className="text-[9px] font-bold text-red-400 uppercase text-center mt-2 animate-pulse tracking-tighter">
              ⚠️ Al guardar como VOID, el balance se ajustará automáticamente.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Concepto</label>
          <input 
            value={formData.title} 
            onChange={e => setFormData({...formData, title: e.target.value})} 
            className="w-full bg-white/5 border border-white/5 rounded-2xl py-4.5 px-6 font-bold text-white outline-none focus:ring-2 focus:ring-primary/20 shadow-sm"
            placeholder="Título del movimiento"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Fecha Contable</label>
          <input 
            type="datetime-local" 
            value={new Date(formData.effectiveAt.getTime() - formData.effectiveAt.getTimezoneOffset() * 60000).toISOString().slice(0, 16)} 
            onChange={e => setFormData({...formData, effectiveAt: new Date(e.target.value)})} 
            className="w-full bg-white/5 border border-white/5 rounded-2xl py-4.5 px-6 font-bold text-white outline-none focus:ring-2 focus:ring-primary/20 shadow-sm" 
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Notas Internas</label>
          <textarea 
            value={formData.notes} 
            onChange={e => setFormData({...formData, notes: e.target.value})} 
            className="w-full bg-white/5 border border-white/5 rounded-2xl py-4.5 px-6 font-bold text-white outline-none min-h-[120px] resize-none focus:ring-2 focus:ring-primary/20 shadow-sm" 
            placeholder="Escribe detalles adicionales aquí..."
          />
        </div>

        <div className="pt-4 pb-12">
           <button 
             type="button"
             onClick={handleSave} 
             disabled={loading || !formData.amount || !formData.title} 
             className="w-full py-5 bg-primary text-white font-black rounded-3xl shadow-xl shadow-primary/30 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-3"
           >
             {loading ? <span className="material-symbols-outlined animate-spin text-xl">sync</span> : <span className="material-symbols-outlined text-xl">verified</span>}
             {loading ? 'Sincronizando...' : 'Guardar Cambios F1'}
           </button>
        </div>
      </main>
    </div>
  );
};

export default EditMovementScreen;
