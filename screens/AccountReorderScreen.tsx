
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { 
  collection, 
  query, 
  getDocs, 
  writeBatch, 
  doc, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { AccountingAccount } from '../types';

const AccountReorderScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [accounts, setAccounts] = useState<AccountingAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [draggedItem, setDraggedItem] = useState<AccountingAccount | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetchAccounts = async () => {
      try {
        const q = query(collection(db, "users", user.uid, "accounts"));
        const snap = await getDocs(q);
        const accs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AccountingAccount));
        // Ordenar inicialmente por el campo 'order' si existe
        accs.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        setAccounts(accs);
      } catch (err) {
        console.error("Error fetching accounts:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAccounts();
  }, [user]);

  const handleDragStart = (e: React.DragEvent, item: AccountingAccount) => {
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = 'move';
    // Para Firefox compatibilidad
    e.dataTransfer.setData('text/plain', item.id!);
  };

  const handleDragOver = (e: React.DragEvent, targetItem: AccountingAccount) => {
    e.preventDefault();
    if (!draggedItem || draggedItem.id === targetItem.id) return;
    if (draggedItem.type !== targetItem.type) return; // Solo permitir reordenar dentro de la misma sección

    const updatedAccounts = [...accounts];
    const draggedIdx = updatedAccounts.findIndex(a => a.id === draggedItem.id);
    const targetIdx = updatedAccounts.findIndex(a => a.id === targetItem.id);

    updatedAccounts.splice(draggedIdx, 1);
    updatedAccounts.splice(targetIdx, 0, draggedItem);

    setAccounts(updatedAccounts);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const batch = writeBatch(db);
      accounts.forEach((acc, index) => {
        const docRef = doc(db, "users", user.uid, "accounts", acc.id!);
        batch.update(docRef, { 
          order: index,
          updatedAt: serverTimestamp()
        });
      });
      await batch.commit();
      navigate('/finance-accounts');
    } catch (err) {
      console.error("Error saving order:", err);
      alert("Error al guardar el nuevo orden.");
    } finally {
      setIsSaving(false);
    }
  };

  const renderSection = (title: string, type: string) => {
    const filtered = accounts.filter(a => (type === 'Ahorro' ? (a as any).type === 'Ahorro' : a.type === type));
    if (filtered.length === 0) return null;

    return (
      <section key={type} className="animate-in fade-in duration-300">
        <div className="bg-slate-50 dark:bg-slate-800/40 py-3 px-6 border-y border-slate-100 dark:border-white/5 sticky top-[120px] z-20 backdrop-blur-sm">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{title}</h3>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-white/5">
          {filtered.map(acc => (
            <div 
              key={acc.id}
              draggable
              onDragStart={(e) => handleDragStart(e, acc)}
              onDragOver={(e) => handleDragOver(e, acc)}
              onDragEnd={handleDragEnd}
              className={`flex items-center gap-4 py-4 px-6 bg-white dark:bg-transparent transition-all ${draggedItem?.id === acc.id ? 'opacity-30 scale-95' : 'opacity-100'}`}
            >
              <div className="cursor-grab active:cursor-grabbing p-1 text-slate-300 dark:text-slate-600">
                <span className="material-symbols-outlined">drag_handle</span>
              </div>
              <div className="flex flex-col flex-1">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{acc.name}</span>
                <span className="text-[10px] font-mono text-slate-400">{acc.code}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  };

  const SkeletonItem = () => (
    <div className="flex items-center gap-4 py-4 px-6 border-b border-slate-100 dark:border-white/5 animate-pulse">
      <div className="size-6 rounded bg-slate-200 dark:bg-white/10"></div>
      <div className="flex-1 space-y-2">
        <div className="h-4 w-32 bg-slate-200 dark:bg-white/10 rounded"></div>
        <div className="h-2 w-12 bg-slate-200 dark:bg-white/10 rounded"></div>
      </div>
    </div>
  );

  return (
    <div className="relative flex flex-col h-screen w-full max-w-md mx-auto bg-background-light dark:bg-background-dark font-display antialiased overflow-hidden">
      <header className="sticky top-0 z-50 bg-background-light dark:bg-background-dark pt-12 px-4 pb-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-slate-700 dark:text-white">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 className="text-xl font-bold tracking-tight">Modificar órdenes</h1>
        </div>
        <button 
          onClick={handleSave}
          disabled={loading || isSaving}
          className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${!loading && !isSaving ? 'bg-primary text-white shadow-lg shadow-primary/30 active:scale-95' : 'bg-slate-100 dark:bg-white/5 text-slate-400'}`}
        >
          {isSaving ? '...' : 'Guardar'}
        </button>
      </header>

      <div className="px-6 py-5 bg-white dark:bg-slate-900/40 border-b border-slate-100 dark:border-white/5">
        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 leading-relaxed italic">
          Arrastra las cuentas por el icono de la izquierda para cambiar su orden de aparición dentro de su sección.
        </p>
      </div>

      <main className="flex-1 overflow-y-auto no-scrollbar pb-20">
        {loading ? (
          <div className="divide-y divide-slate-100 dark:divide-white/5">
            {Array(8).fill(0).map((_, i) => <SkeletonItem key={i} />)}
          </div>
        ) : accounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center px-10 space-y-4">
            <span className="material-symbols-outlined text-5xl text-slate-300">reorder</span>
            <p className="text-sm font-bold text-slate-500">No hay cuentas para ordenar.</p>
          </div>
        ) : (
          <>
            {renderSection('Efectivo', 'Activo')}
            {renderSection('Cuentas', 'Pasivo')}
            {renderSection('Ahorros', 'Ahorro')}
          </>
        )}
      </main>
    </div>
  );
};

export default AccountReorderScreen;
