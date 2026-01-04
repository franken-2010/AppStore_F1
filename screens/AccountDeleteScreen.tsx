
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  writeBatch,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { AccountingAccount, AccountCategory } from '../types';

const AccountDeleteScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [accounts, setAccounts] = useState<AccountingAccount[]>([]);
  const [categories, setCategories] = useState<AccountCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    
    // Escuchar categorías
    const qCat = query(collection(db, "users", user.uid, "categories"), orderBy("order", "asc"));
    const unsubCat = onSnapshot(qCat, (snap) => {
      setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() } as AccountCategory)));
    });

    // Escuchar cuentas
    const qAcc = query(collection(db, "users", user.uid, "accounts"), orderBy("order", "asc"));
    const unsubAcc = onSnapshot(qAcc, (snapshot) => {
      const accs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AccountingAccount));
      setAccounts(accs);
      setLoading(false);
      setError(null);
    }, (err) => {
      console.error("Error fetching accounts:", err);
      setError("Error al cargar las cuentas.");
      setLoading(false);
    });

    return () => { unsubCat(); unsubAcc(); };
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

  const SectionHeader = ({ title }: { title: string }) => (
    <div className="bg-[#0f172a] py-3 px-5 border-b border-white/5">
      <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">{title}</h3>
    </div>
  );

  const DeleteRow: React.FC<{ account: AccountingAccount }> = ({ account }) => {
    const isSelected = selectedIds.has(account.id!);
    return (
      <div 
        onClick={() => toggleSelection(account.id!)}
        className={`flex items-center gap-5 py-4 px-5 border-b border-white/5 transition-colors cursor-pointer bg-[#0f172a] active:bg-white/5`}
      >
        <div className={`size-6 rounded-lg border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-primary border-primary' : 'border-slate-700'}`}>
          {isSelected && <span className="material-symbols-outlined text-white text-[16px] font-bold">check</span>}
        </div>
        <div className="flex flex-col flex-1 gap-0.5">
          <span className="text-[15px] font-medium text-slate-100">{account.name}</span>
          <span className="text-[10px] font-medium text-slate-500 tracking-wider uppercase">{account.code}</span>
        </div>
      </div>
    );
  };

  const SkeletonRow = () => (
    <div className="flex items-center gap-5 py-4 px-5 border-b border-white/5 animate-pulse bg-[#0f172a]">
      <div className="size-6 rounded-lg bg-white/5"></div>
      <div className="flex-1 space-y-2">
        <div className="h-4 w-40 bg-white/5 rounded"></div>
        <div className="h-2 w-16 bg-white/5 rounded"></div>
      </div>
    </div>
  );

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center space-y-4 bg-[#0f172a]">
        <span className="material-symbols-outlined text-red-500 text-6xl">warning</span>
        <p className="text-slate-500 font-bold">{error}</p>
        <button onClick={() => window.location.reload()} className="px-10 py-3 bg-primary text-white font-black rounded-xl shadow-lg">Reintentar</button>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col h-screen w-full max-w-md mx-auto bg-[#0f172a] font-display antialiased overflow-hidden">
      {/* Confirm Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-xs bg-surface-dark rounded-[2.5rem] p-8 shadow-2xl border border-white/10 animate-in zoom-in duration-300">
            <div className="size-16 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <span className="material-symbols-outlined text-3xl">delete_forever</span>
            </div>
            <h3 className="text-xl font-bold text-center text-white mb-2">¿Confirmar?</h3>
            <p className="text-sm text-slate-400 text-center mb-8 leading-relaxed">
              ¿Eliminar {selectedIds.size} cuenta(s) permanentemente?
            </p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={handleDelete}
                disabled={isDeleting}
                className="w-full py-4 bg-red-500 text-white font-bold rounded-2xl shadow-xl active:scale-95 transition-all"
              >
                {isDeleting ? 'Eliminando...' : 'Sí, Eliminar'}
              </button>
              <button 
                onClick={() => setShowConfirm(false)}
                className="w-full py-3 text-slate-500 font-bold"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header idéntico a la imagen */}
      <header className="sticky top-0 z-50 bg-[#0f172a] pt-12 px-4 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-white/10 transition-colors text-white">
            <span className="material-symbols-outlined text-[28px]">arrow_back</span>
          </button>
          <h1 className="text-xl font-medium text-white">Eliminar</h1>
        </div>
        <button 
          onClick={() => setShowConfirm(true)}
          disabled={selectedIds.size === 0 || isDeleting}
          className={`px-5 py-2.5 rounded-full text-[11px] font-bold uppercase tracking-widest transition-all ${
            selectedIds.size > 0 
              ? 'bg-red-500 text-white shadow-lg active:scale-95' 
              : 'bg-slate-800/40 text-slate-500 cursor-not-allowed'
          }`}
        >
          {isDeleting ? '...' : `BORRAR (${selectedIds.size})`}
        </button>
      </header>

      {/* Descripción técnica */}
      <div className="px-5 py-4 bg-[#0f172a]">
        <p className="text-[13px] font-medium text-slate-400 italic leading-relaxed">
          Selecciona las cuentas que deseas remover permanentemente de tu registro financiero.
        </p>
      </div>

      <main className="flex-1 overflow-y-auto no-scrollbar bg-[#0f172a]">
        {loading ? (
          <div className="divide-y divide-white/5">
            {Array(6).fill(0).map((_, i) => <SkeletonRow key={i} />)}
          </div>
        ) : accounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center px-10 space-y-4">
            <span className="material-symbols-outlined text-5xl text-slate-300">delete_sweep</span>
            <p className="text-sm font-bold text-slate-500">No hay cuentas disponibles.</p>
          </div>
        ) : (
          <div className="animate-in fade-in duration-500 pb-20">
            {/* Secciones Dinámicas */}
            {categories.map(cat => {
              const catAccs = accounts.filter(a => a.categoryId === cat.id);
              if (catAccs.length === 0) return null;
              return (
                <section key={cat.id}>
                  <SectionHeader title={cat.name} />
                  {catAccs.map(acc => <DeleteRow key={acc.id} account={acc} />)}
                </section>
              );
            })}

            {/* Cuentas sin categoría asignada */}
            {accounts.filter(a => !a.categoryId).length > 0 && (
              <section>
                <SectionHeader title="SIN CATEGORÍA / OTROS" />
                {accounts.filter(a => !a.categoryId).map(acc => <DeleteRow key={acc.id} account={acc} />)}
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default AccountDeleteScreen;
