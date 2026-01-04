
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { collection, query, onSnapshot, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { AccountingAccount, AccountCategory } from '../types';
import BottomNav from '../components/BottomNav';
import Sidebar from '../components/Sidebar';
import ProfileMenu from '../components/ProfileMenu';

const FinanceAccountsScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [accounts, setAccounts] = useState<AccountingAccount[]>([]);
  const [categories, setCategories] = useState<AccountCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
    const unsubAcc = onSnapshot(qAcc, (snap) => {
      setAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() } as AccountingAccount)));
      setLoading(false);
    });

    return () => { unsubCat(); unsubAcc(); };
  }, [user]);

  const visibleAccounts = accounts.filter(a => a.isVisible !== false);
  const capital = visibleAccounts.filter(a => a.type === 'Capital').reduce((sum, a) => sum + (a.balance || 0), 0);
  const aDeber = visibleAccounts.filter(a => a.type === 'Pasivo').reduce((sum, a) => sum + (a.balance || 0), 0);
  const totalActivos = visibleAccounts.filter(a => a.type === 'Activo' || a.type === 'Ahorro').reduce((sum, a) => sum + (a.balance || 0), 0);
  const balance = totalActivos - aDeber;

  const formatValue = (val: number) => {
    return new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
  };

  const AccountRow: React.FC<{ account: AccountingAccount }> = ({ account }) => {
    const isNegative = account.type === 'Pasivo';
    return (
      <div 
        onClick={() => navigate(`/account/history/${account.id}`)}
        className="flex items-center justify-between py-4 px-5 border-b border-white/5 active:bg-white/5 transition-colors cursor-pointer"
      >
        <div className="flex flex-col gap-0.5">
          <span className="text-[15px] font-medium text-slate-200">{account.name}</span>
        </div>
        <span className={`text-[15px] font-medium ${isNegative ? 'text-red-400' : 'text-blue-400'}`}>
          $ {formatValue(account.balance || 0)}
        </span>
      </div>
    );
  };

  const SectionHeader = ({ title }: { title: string }) => (
    <div className="bg-[#0f172a] py-3 px-5 border-b border-white/5">
      <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{title}</h3>
    </div>
  );

  return (
    <div className="relative flex flex-col h-screen w-full max-w-md mx-auto bg-[#0f172a] font-display antialiased overflow-hidden pb-16">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      <header className="flex items-center justify-between pt-12 px-5 pb-3 bg-[#0f172a]">
        <div className="flex items-center gap-2">
          <button onClick={() => setIsSidebarOpen(true)} className="p-1 -ml-1 text-slate-300">
            <span className="material-symbols-outlined text-[28px]">menu</span>
          </button>
          <h1 className="text-xl font-medium text-white">Cuentas</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/finance-stats')} className="p-2 text-slate-300">
            <span className="material-symbols-outlined text-[24px]">bar_chart</span>
          </button>
          <div className="relative">
            <button onClick={() => setShowMenu(!showMenu)} className="p-2 text-slate-300">
              <span className="material-symbols-outlined text-[24px]">more_vert</span>
            </button>
            {showMenu && (
              <div className="absolute right-0 mt-2 w-52 bg-surface-dark border border-white/10 rounded-2xl shadow-2xl z-50 py-2 overflow-hidden animate-in fade-in zoom-in duration-150">
                <button onClick={() => { setShowMenu(false); navigate('/account/upsert'); }} className="flex items-center gap-3 w-full px-5 py-3 text-sm font-bold text-slate-200 hover:bg-white/5"><span className="material-symbols-outlined text-xl">add</span> Nueva Cuenta</button>
                <button onClick={() => { setShowMenu(false); navigate('/settings/account-categories'); }} className="flex items-center gap-3 w-full px-5 py-3 text-sm font-bold text-slate-200 hover:bg-white/5"><span className="material-symbols-outlined text-xl">category</span> Gestionar Categorías</button>
                <button onClick={() => { setShowMenu(false); navigate('/account/visibility'); }} className="flex items-center gap-3 w-full px-5 py-3 text-sm font-bold text-slate-200 hover:bg-white/5"><span className="material-symbols-outlined text-xl">visibility</span> Visibilidad</button>
                <button onClick={() => { setShowMenu(false); navigate('/account/delete'); }} className="flex items-center gap-3 w-full px-5 py-3 text-sm font-bold text-red-400 hover:bg-white/5"><span className="material-symbols-outlined text-xl">delete</span> Borrar</button>
              </div>
            )}
          </div>
          <div className="size-9 rounded-full bg-indigo-600 flex items-center justify-center text-[11px] font-black text-white ml-1 border-2 border-[#0f172a] shadow-lg">
            {profile?.displayName?.substring(0,2).toUpperCase() || 'AD'}
          </div>
        </div>
      </header>

      <div className="px-5 py-6 grid grid-cols-3 gap-1 bg-[#0f172a] border-b border-white/5">
        <div className="text-center">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Capital</p>
          <p className="text-[15px] font-bold text-blue-400">{formatValue(capital)}</p>
        </div>
        <div className="text-center border-x border-white/5">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">A deber</p>
          <p className="text-[15px] font-bold text-red-400">{formatValue(aDeber)}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Balance</p>
          <p className="text-[15px] font-bold text-white">{formatValue(balance)}</p>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto no-scrollbar bg-[#0f172a]">
        {loading ? (
          <div className="p-10 flex justify-center"><span className="material-symbols-outlined animate-spin text-slate-600">sync</span></div>
        ) : (
          <div className="pb-24">
            {categories.map(cat => {
              const catAccs = accounts.filter(a => a.categoryId === cat.id);
              if (catAccs.length === 0) return null;
              return (
                <section key={cat.id}>
                  <SectionHeader title={cat.name} />
                  {catAccs.map(acc => <AccountRow key={acc.id} account={acc} />)}
                </section>
              );
            })}

            {/* Cuentas sin categoría asignada o especiales (ej. Capital) */}
            {accounts.filter(a => !a.categoryId).length > 0 && (
              <section>
                <SectionHeader title="OTROS / CAPITAL" />
                {accounts.filter(a => !a.categoryId).map(acc => <AccountRow key={acc.id} account={acc} />)}
              </section>
            )}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default FinanceAccountsScreen;
