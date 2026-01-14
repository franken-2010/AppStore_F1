
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import Sidebar from '../components/Sidebar';
import ProfileMenu from '../components/ProfileMenu';
import NotificationBell from '../components/NotificationBell';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { 
  collection, 
  query, 
  onSnapshot, 
  orderBy, 
  limit,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { AccountMovement, AccountingAccount } from '../types';
import { AccountResolver } from '../services/AccountResolver';
import { AccountingService } from '../services/AccountingService';

const DashboardScreen: React.FC = () => {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [todayMovements, setTodayMovements] = useState<AccountMovement[]>([]);
  const [lastCorte, setLastCorte] = useState<any>(null);
  const [invAccount, setInvAccount] = useState<AccountingAccount | null>(null);

  const formatMXN = (val: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);

  useEffect(() => {
    if (!user) return;

    const now = new Date();
    const startToday = new Date(now);
    startToday.setHours(0, 0, 0, 0);
    const endToday = new Date(now);
    endToday.setHours(23, 59, 59, 999);

    AccountResolver.loadIndex(user.uid);

    const unsubMovs = AccountingService.subscribeToMovements(user.uid, startToday, endToday, (movs) => {
      setTodayMovements(movs);
      setLoading(false);
    });

    const qCorte = query(
      collection(db, "users", user.uid, "cortes"),
      orderBy("createdAt", "desc"),
      limit(1)
    );
    const unsubCorte = onSnapshot(qCorte, (snap) => {
      if (!snap.empty) setLastCorte({ id: snap.docs[0].id, ...snap.docs[0].data() });
    });

    // Suscribirse a la cuenta de inventarios para el KPI
    AccountResolver.resolveFullAccount(user.uid, 'inventarios').then(acc => {
      if (acc) {
        const unsubInv = onSnapshot(doc(db, "users", user.uid, "accounts", acc.id!), (snap) => {
          if (snap.exists()) setInvAccount({ id: snap.id, ...snap.data() } as AccountingAccount);
        });
        return () => unsubInv();
      }
    });

    return () => {
      unsubMovs();
      unsubCorte();
    };
  }, [user]);

  const totals = useMemo(() => AccountingService.calculateTotals(todayMovements), [todayMovements]);
  const statsByAccount = useMemo(() => AccountingService.groupStatsByAccount(todayMovements), [todayMovements]);

  const rubrics = [
    { id: 'ventas', label: 'Ventas' },
    { id: 'fiesta', label: 'Fiesta' },
    { id: 'estancias', label: 'Estancias' },
    { id: 'recargas', label: 'Recargas' }
  ];

  // Lógica de Alerta de Inventario y Termómetro (REFINADA)
  const inventoryStatus = useMemo(() => {
    if (!invAccount) return { label: 'Cargando...', color: 'bg-slate-500', icon: 'sync', progress: 0, status: 'UNKNOWN' };
    
    const bal = invAccount.balance || 0;
    const min = invAccount.inventoryMin;
    const max = invAccount.inventoryMax;

    // Calcular progreso para el termómetro
    let progress = 0;
    if (min !== null && max !== null && max > min) {
      const raw = (bal - min) / (max - min);
      progress = Math.max(0, Math.min(1, raw));
    }

    if (min === null && max === null) return { label: 'SIN RANGO', color: 'bg-slate-500', icon: 'info', progress, status: 'NONE' };
    
    if (min !== null && bal < min) {
      return { label: 'BAJO', color: 'bg-amber-500', icon: 'warning', progress: 0, status: 'LOW' };
    }
    
    if (max !== null && bal > max) {
      return { label: 'ALTO', color: 'bg-red-500', icon: 'priority_high', progress: 1, status: 'HIGH' };
    }
    
    return { label: 'OK', color: 'bg-emerald-500', icon: 'check_circle', progress, status: 'OK' };
  }, [invAccount]);

  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-white antialiased min-h-screen relative">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      <header className="sticky top-0 z-30 w-full px-6 pt-12 pb-4 bg-background-light/90 dark:bg-background-dark/90 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 rounded-full hover:bg-slate-200 dark:hover:bg-white/10 transition-colors">
              <span className="material-symbols-outlined">menu</span>
            </button>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Operación Diaria</p>
              <h1 className="text-xl font-extrabold tracking-tight">Hola, {profile?.displayName?.split(' ')[0] || 'Admin'}</h1>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <ProfileMenu />
          </div>
        </div>
      </header>
      
      <main className="flex flex-col w-full max-w-md mx-auto px-6 space-y-8 mt-4 pb-32">
        
        <section className="animate-in fade-in slide-in-from-top-4 duration-500">
           <div className="bg-gradient-to-br from-indigo-600 to-primary p-7 rounded-[2.5rem] text-white shadow-2xl shadow-primary/30 relative overflow-hidden">
             <div className="relative z-10">
               <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/70 mb-1">Resultado Neto Hoy</p>
               <h2 className="text-4xl font-black tracking-tighter mb-6">
                 {loading ? '...' : formatMXN(totals.balance)}
               </h2>
               
               <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                 <div>
                   <p className="text-[9px] font-black uppercase tracking-widest text-white/60 mb-0.5">Ingresos</p>
                   <p className="text-sm font-bold text-emerald-300">{formatMXN(totals.income)}</p>
                 </div>
                 <div>
                   <p className="text-[9px] font-black uppercase tracking-widest text-white/60 mb-0.5">Egresos</p>
                   <p className="text-sm font-bold text-red-300">{formatMXN(totals.expense)}</p>
                 </div>
               </div>
             </div>
             <span className="material-symbols-outlined absolute -right-6 -bottom-6 text-[180px] opacity-10 rotate-12">account_balance_wallet</span>
           </div>
        </section>

        {/* NIVEL DE INVENTARIOS CON TERMÓMETRO */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Nivel de Inventarios</h2>
            <div className="h-px flex-1 bg-slate-100 dark:bg-white/5 ml-4"></div>
          </div>
          <div 
            onClick={() => invAccount && navigate(`/account/history/${invAccount.id}`)}
            className="p-6 bg-white dark:bg-surface-dark rounded-[2rem] border border-slate-100 dark:border-white/5 shadow-sm active:scale-95 transition-all cursor-pointer relative overflow-hidden group"
          >
            <div className="flex justify-between items-start mb-2 relative z-10">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-slate-400">inventory_2</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Valor de Mercancía</span>
              </div>
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-white text-[8px] font-black tracking-tighter shadow-lg ${inventoryStatus.color}`}>
                <span className="material-symbols-outlined text-[12px]">{inventoryStatus.icon}</span>
                {inventoryStatus.label}
              </div>
            </div>
            
            <p className="text-3xl font-black tracking-tighter text-slate-900 dark:text-white mb-2 relative z-10">
              {invAccount ? formatMXN(invAccount.balance) : '...'}
            </p>

            {invAccount && (invAccount.inventoryMin !== null || invAccount.inventoryMax !== null) ? (
              <div className="space-y-3 relative z-10">
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                  Objetivo: {invAccount.inventoryMin !== null ? formatMXN(invAccount.inventoryMin) : '$0'} – {invAccount.inventoryMax !== null ? formatMXN(invAccount.inventoryMax) : 'Max'}
                </p>
                
                {/* TERMÓMETRO VISUAL */}
                {invAccount.inventoryMax && invAccount.inventoryMin && invAccount.inventoryMax > invAccount.inventoryMin && (
                  <div className="space-y-1.5">
                    <div className="w-full h-2.5 bg-slate-100 dark:bg-black/40 rounded-full overflow-hidden shadow-inner flex items-center">
                      <div 
                        className={`h-full transition-all duration-700 ease-out rounded-full shadow-lg ${
                          inventoryStatus.status === 'LOW' ? 'bg-gradient-to-r from-amber-400 to-amber-500' :
                          inventoryStatus.status === 'HIGH' ? 'bg-gradient-to-r from-red-500 to-red-600' :
                          'bg-gradient-to-r from-emerald-400 to-emerald-500'
                        }`}
                        style={{ width: `${inventoryStatus.progress * 100}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between items-center text-[8px] font-black text-slate-400 uppercase tracking-tighter">
                       <span>Min {formatMXN(invAccount.inventoryMin)}</span>
                       {inventoryStatus.status === 'LOW' && <span className="text-amber-500 animate-pulse">Por debajo del mínimo</span>}
                       {inventoryStatus.status === 'HIGH' && <span className="text-red-500 animate-pulse">Por encima del máximo</span>}
                       <span>Max {formatMXN(invAccount.inventoryMax)}</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest relative z-10 italic">Objetivo no configurado</p>
            )}
            
            <span className="material-symbols-outlined absolute -right-4 -bottom-4 text-8xl opacity-[0.03] group-hover:opacity-[0.08] transition-opacity pointer-events-none">shelves</span>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Rendimiento Contable</h2>
            <div className="h-px flex-1 bg-slate-100 dark:bg-white/5 ml-4"></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {rubrics.map((r) => {
              const data = statsByAccount[r.id] || { income: 0, expense: 0, net: 0 };
              const accInfo = AccountResolver.getAccount(r.id);
              return (
                <div 
                  key={r.id} 
                  onClick={() => navigate(accInfo ? `/account/history/${accInfo.accountDocId}` : '/finance-accounts')}
                  className="p-5 bg-white dark:bg-surface-dark rounded-[2rem] border border-slate-100 dark:border-white/5 shadow-sm active:scale-95 transition-all cursor-pointer group"
                >
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 truncate max-w-[70%] group-hover:text-primary transition-colors">{r.label}</span>
                    <div className={`size-2 rounded-full ${data.net >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                  </div>
                  <p className={`text-xl font-black tracking-tighter ${data.net >= 0 ? 'text-slate-900 dark:text-white' : 'text-red-500'}`}>
                    {formatMXN(data.net)}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="pb-4">
          <div className="flex items-center justify-between mb-4 px-1">
            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Último Cierre</h2>
            <div className="h-px flex-1 bg-slate-100 dark:bg-white/5 ml-4"></div>
          </div>
          {lastCorte ? (
             <div onClick={() => navigate('/cortes')} className="flex items-center gap-5 p-6 rounded-[2rem] bg-white dark:bg-surface-dark border border-slate-100 dark:border-white/5 shadow-sm cursor-pointer active:scale-[0.98] transition-all">
                <div className={`size-14 rounded-2xl flex items-center justify-center shrink-0 ${lastCorte.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                  <span className="material-symbols-outlined text-3xl">{lastCorte.status === 'ACTIVE' ? 'verified' : 'report_problem'}</span>
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="text-[9px] font-black uppercase text-slate-400 tracking-[0.15em] mb-1.5">Registro del {lastCorte.fecha}</p>
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-black dark:text-white truncate">Admin: {lastCorte.admin || 'Admin'}</h4>
                  </div>
                  <p className="text-xs font-bold text-slate-500">Total Operado: {formatMXN(lastCorte.totalGeneral || 0)}</p>
                </div>
                <span className="material-symbols-outlined text-slate-300">chevron_right</span>
             </div>
          ) : (
            <div className="p-8 text-center bg-slate-50 dark:bg-white/5 rounded-[2rem] border-2 border-dashed border-slate-100 dark:border-white/5">
              <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">history_toggle_off</span>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Sin cortes recientes</p>
            </div>
          )}
        </section>

      </main>
      <BottomNav />
    </div>
  );
};

export default DashboardScreen;
