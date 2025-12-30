
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  updateDoc,
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { AccountingAccount } from '../types';

const AccountVisibilityScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<AccountingAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      setError("No se pudo conectar con la base de datos.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const toggleVisibility = async (id: string, current: boolean) => {
    if (!user) return;
    try {
      const docRef = doc(db, "users", user.uid, "accounts", id);
      await updateDoc(docRef, {
        isVisible: !current,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Error toggling visibility:", err);
    }
  };

  const efectivo = accounts.filter(a => a.type === 'Activo');
  const cuentas = accounts.filter(a => a.type === 'Pasivo');
  const ahorros = accounts.filter(a => a.type === 'Ahorro');

  const SectionHeader = ({ title }: { title: string }) => (
    <div className="bg-[#0f172a] py-3 px-5 border-b border-white/5">
      <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">{title}</h3>
    </div>
  );

  const VisibilityRow: React.FC<{ account: AccountingAccount }> = ({ account }) => {
    const isVisible = account.isVisible !== false; // Default true
    return (
      <div className="flex items-center justify-between py-4 px-5 border-b border-white/5 bg-[#0f172a] active:bg-white/5 transition-colors">
        <div className="flex flex-col gap-0.5">
          <span className="text-[15px] font-medium text-slate-200">{account.name}</span>
          <span className="text-[10px] font-medium text-slate-500 tracking-wider uppercase">{account.code}</span>
        </div>
        <button 
          onClick={() => toggleVisibility(account.id!, isVisible)}
          className={`relative w-11 h-6 rounded-full transition-colors duration-200 ease-in-out ${isVisible ? 'bg-primary' : 'bg-slate-700'}`}
        >
          <div className={`absolute top-1 size-4 bg-white rounded-full shadow-sm transition-transform duration-200 ease-in-out ${isVisible ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>
    );
  };

  const SkeletonRow = () => (
    <div className="flex items-center justify-between py-4 px-5 border-b border-white/5 animate-pulse">
      <div className="space-y-2">
        <div className="h-4 w-32 bg-white/5 rounded"></div>
        <div className="h-2 w-12 bg-white/5 rounded"></div>
      </div>
      <div className="h-6 w-11 bg-white/5 rounded-full"></div>
    </div>
  );

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center space-y-4 bg-[#0f172a]">
        <span className="material-symbols-outlined text-red-500 text-6xl">warning</span>
        <p className="text-slate-500 font-bold">{error}</p>
        <button onClick={() => window.location.reload()} className="px-10 py-3 bg-primary text-white font-black rounded-xl shadow-lg active:scale-95 transition-all">Reintentar</button>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col h-screen w-full max-w-md mx-auto bg-[#0f172a] font-display antialiased overflow-hidden">
      {/* Header idéntico a la imagen */}
      <header className="sticky top-0 z-50 bg-[#0f172a] pt-12 px-4 pb-4 flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-white/10 transition-colors text-white">
          <span className="material-symbols-outlined text-[28px]">arrow_back</span>
        </button>
        <h1 className="text-xl font-medium text-white">Mostrar/Ocultar</h1>
      </header>

      {/* Descripción técnica */}
      <div className="px-5 py-4 bg-[#0f172a]">
        <p className="text-[13px] font-medium text-slate-400 italic leading-relaxed">
          Oculta cuentas para que no aparezcan en el resumen general de la pantalla principal.
        </p>
      </div>

      <main className="flex-1 overflow-y-auto no-scrollbar bg-[#0f172a]">
        {loading ? (
          <div className="divide-y divide-white/5">
            {Array(8).fill(0).map((_, i) => <SkeletonRow key={i} />)}
          </div>
        ) : accounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center px-10 space-y-4">
            <span className="material-symbols-outlined text-5xl text-slate-300">visibility_off</span>
            <p className="text-sm font-bold text-slate-500">No hay cuentas para gestionar.</p>
          </div>
        ) : (
          <div className="animate-in fade-in duration-400 pb-20">
            {efectivo.length > 0 && (
              <section>
                <SectionHeader title="EFECTIVO" />
                {efectivo.sort((a,b) => (a.order||0)-(b.order||0)).map(acc => <VisibilityRow key={acc.id} account={acc} />)}
              </section>
            )}

            {cuentas.length > 0 && (
              <section>
                <SectionHeader title="CUENTAS" />
                {cuentas.sort((a,b) => (a.order||0)-(b.order||0)).map(acc => <VisibilityRow key={acc.id} account={acc} />)}
              </section>
            )}

            {ahorros.length > 0 && (
              <section>
                <SectionHeader title="AHORROS" />
                {ahorros.sort((a,b) => (a.order||0)-(b.order||0)).map(acc => <VisibilityRow key={acc.id} account={acc} />)}
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default AccountVisibilityScreen;
