
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  writeBatch 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { AccountingAccount } from '../types';

const AccountDeleteScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [accounts, setAccounts] = useState<AccountingAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const q = query(collection(db, "users", user.uid, "accounts"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const accs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AccountingAccount));
      setAccounts(accs);
      setLoading(false);
      setError(null);
    }, (err) => {
      console.error("Error fetching accounts:", err);
      setError("Error al cargar las cuentas.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleDelete = async () => {
    if (!user || selectedIds.size === 0) return;
    setIsDeleting(true);
    setShowConfirm(false);

    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        const docRef = doc(db, "users", user.uid, "accounts", id);
        batch.delete(docRef);
      });
      await batch.commit();
      navigate('/finance-accounts');
    } catch (err) {
      console.error("Error deleting accounts:", err);
      alert("Ocurrió un error al eliminar las cuentas.");
    } finally {
      setIsDeleting(false);
    }
  };

  const efectivo = accounts.filter(a => a.type === 'Activo');
  const cuentas = accounts.filter(a => a.type === 'Pasivo');
  const ahorros = accounts.filter(a => a.type === 'Ahorro');

  const SectionHeader = ({ title }: { title: string }) => (
    <div className="bg-slate-50 dark:bg-slate-800/40 py-3 px-6 border-y border-slate-100 dark:border-white/5 sticky top-[120px] z-20 backdrop-blur-sm">
      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{title}</h3>
    </div>
  );

  // Added React.FC type to fix 'key' prop error in list rendering
  const DeleteRow: React.FC<{ account: AccountingAccount }> = ({ account }) => {
    const isSelected = selectedIds.has(account.id!);
    return (
      <div 
        onClick={() => toggleSelection(account.id!)}
        className={`flex items-center gap-4 py-4 px-6 border-b border-slate-100 dark:border-white/5 transition-colors cursor-pointer ${isSelected ? 'bg-red-50 dark:bg-red-500/5' : 'bg-white dark:bg-transparent'}`}
      >
        <div className={`size-6 rounded-md border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-red-500 border-red-500' : 'border-slate-300 dark:border-white/10'}`}>
          {isSelected && <span className="material-symbols-outlined text-white text-sm">check</span>}
        </div>
        <div className="flex flex-col flex-1">
          <span className={`text-sm font-bold transition-colors ${isSelected ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-200'}`}>{account.name}</span>
          <span className="text-[10px] font-mono text-slate-400">{account.code}</span>
        </div>
      </div>
    );
  };

  const SkeletonRow = () => (
    <div className="flex items-center gap-4 py-4 px-6 border-b border-slate-100 dark:border-white/5 animate-pulse">
      <div className="size-6 rounded-md bg-slate-200 dark:bg-white/10"></div>
      <div className="flex-1 space-y-2">
        <div className="h-4 w-32 bg-slate-200 dark:bg-white/10 rounded"></div>
        <div className="h-2 w-12 bg-slate-200 dark:bg-white/10 rounded"></div>
      </div>
    </div>
  );

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center space-y-4 bg-background-light dark:bg-background-dark">
        <span className="material-symbols-outlined text-red-500 text-6xl">warning</span>
        <p className="text-slate-500 font-bold">{error}</p>
        <button onClick={() => window.location.reload()} className="px-10 py-3 bg-primary text-white font-black rounded-xl shadow-lg active:scale-95 transition-all">Reintentar</button>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col h-screen w-full max-w-md mx-auto bg-background-light dark:bg-background-dark font-display antialiased overflow-hidden">
      {/* Confirm Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-xs bg-white dark:bg-surface-dark rounded-[2rem] p-8 shadow-2xl border border-slate-100 dark:border-white/10 animate-in zoom-in duration-300">
            <div className="size-16 bg-red-100 dark:bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <span className="material-symbols-outlined text-3xl">delete_forever</span>
            </div>
            <h3 className="text-xl font-black text-center mb-2">¿Confirmar?</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-8 leading-relaxed">
              ¿Eliminar {selectedIds.size} cuenta(s)? Esta acción no se puede deshacer.
            </p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={handleDelete}
                disabled={isDeleting}
                className="w-full py-4 bg-red-500 text-white font-black rounded-2xl shadow-xl shadow-red-500/20 active:scale-95 transition-all"
              >
                {isDeleting ? 'Eliminando...' : 'Sí, Eliminar'}
              </button>
              <button 
                onClick={() => setShowConfirm(false)}
                className="w-full py-3 text-slate-500 dark:text-slate-400 font-bold"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-50 bg-background-light dark:bg-background-dark pt-12 px-4 pb-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-slate-700 dark:text-white">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 className="text-xl font-bold tracking-tight">Eliminar</h1>
        </div>
        <button 
          onClick={() => setShowConfirm(true)}
          disabled={selectedIds.size === 0 || isDeleting}
          className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${selectedIds.size > 0 ? 'bg-red-500 text-white shadow-lg shadow-red-500/20 active:scale-95' : 'bg-slate-100 dark:bg-white/5 text-slate-400 opacity-50'}`}
        >
          {isDeleting ? '...' : `Borrar (${selectedIds.size})`}
        </button>
      </header>

      <div className="px-6 py-5 bg-white dark:bg-slate-900/40 border-b border-slate-100 dark:border-white/5">
        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 leading-relaxed italic">
          Selecciona las cuentas que deseas remover permanentemente de tu registro financiero.
        </p>
      </div>

      <main className="flex-1 overflow-y-auto no-scrollbar">
        {loading ? (
          <div className="divide-y divide-slate-100 dark:divide-white/5">
            {Array(6).fill(0).map((_, i) => <SkeletonRow key={i} />)}
          </div>
        ) : accounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center px-10 space-y-4">
            <span className="material-symbols-outlined text-5xl text-slate-300">delete_sweep</span>
            <p className="text-sm font-bold text-slate-500">No hay cuentas disponibles.</p>
          </div>
        ) : (
          <div className="animate-in fade-in duration-500">
            {efectivo.length > 0 && (
              <section>
                <SectionHeader title="Efectivo" />
                {efectivo.map(acc => <DeleteRow key={acc.id} account={acc} />)}
              </section>
            )}

            {cuentas.length > 0 && (
              <section>
                <SectionHeader title="Cuentas" />
                {cuentas.map(acc => <DeleteRow key={acc.id} account={acc} />)}
              </section>
            )}

            {ahorros.length > 0 && (
              <section>
                <SectionHeader title="Ahorros" />
                {ahorros.map(acc => <DeleteRow key={acc.id} account={acc} />)}
              </section>
            )}
            
            <div className="h-12"></div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AccountDeleteScreen;
