
import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  doc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { AccountMovement, AccountingAccount } from '../types';
import { AccountResolver } from '../services/AccountResolver';
import { AccountingService } from '../services/AccountingService';

const DashboardScreen: React.FC = () => {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [queryError, setQueryError] = useState<string | null>(null);
  
  const [movementsToday, setMovementsToday] = useState<AccountMovement[]>([]);
  const [lastCorte, setLastCorte] = useState<any>(null);
  const [invAccount, setInvAccount] = useState<AccountingAccount | null>(null);

  const formatMXN = (val: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);

  useEffect(() => {
    if (!user?.uid) return;

    setLoading(true);
    setQueryError(null);
    AccountResolver.loadIndex(user.uid);

    const unsubscribeMovs = AccountingService.subscribeToTodayDashboard(
      user.uid, 
      (movs) => {
        const contableMovs = movs.filter(m => AccountingService.isMovementContable(m));
        setMovementsToday(contableMovs);
        setLoading(false);
      },
      (err) => {
        setQueryError(err);
        setLoading(false);
      }
    );

    const qCorte = query(
      collection(db, "users", user.uid, "cortes"),
      orderBy("createdAt", "desc"),
      limit(1)
    );
    
    const unsubCorte = onSnapshot(qCorte, (snap) => {
      if (!snap.empty) {
        const doc = snap.docs[0];
        const data = doc.data();
        setLastCorte({
          id: doc.id,
          fecha: String(data.fecha || ''),
          admin: String(data.admin || ''),
          status: String(data.status || 'ACTIVE'),
          audit: {
            diferencia: Number(data.audit?.diferencia || 0)
          }
        });
      }
    });

    let unsubInv: (() => void) | null = null;
    AccountResolver.resolveFullAccount(user.uid, 'inventarios').then(acc => {
      if (acc && acc.id) {
        unsubInv = onSnapshot(doc(db, "users", user.uid, "accounts", acc.id), (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            setInvAccount({
              id: snap.id,
              accountId: 'inventarios',
              name: String(data.name || 'Inventarios'),
              balance: Number(data.balance || 0),
              inventoryMin: data.inventoryMin !== undefined ? Number(data.inventoryMin) : null,
              inventoryMax: data.inventoryMax !== undefined ? Number(data.inventoryMax) : null,
              type: 'Activo'
            } as AccountingAccount);
          }
        });
      }
    });

    return () => {
      unsubscribeMovs();
      unsubCorte();
      if (unsubInv) unsubInv();
    };
  }, [user?.uid]);

  const totals = useMemo(() => AccountingService.calculateTotals(movementsToday), [movementsToday]);
  const statsByAccount = useMemo(() => AccountingService.groupStatsByAccount(movementsToday), [movementsToday]);

  const rubrics = [
    { id: 'ventas', label: 'Ventas' },
    { id: 'fiesta', label: 'Fiesta' },
    { id: 'estancias', label: 'Estancias' },
    { id: 'recargas', label: 'Recargas' }
  ];

  const inventoryStatus = useMemo(() => {
    if (!invAccount) return { label: 'Cargando...', color: 'bg-slate-500', icon: 'sync', progress: 0, status: 'UNKNOWN' };
    
    const bal = invAccount.balance || 0;
    const min = invAccount.inventoryMin;
    const max = invAccount.inventoryMax;

    let progress = 0;
    if (min !== null && max !== null && max > min) {
      const raw = (bal - min) / (max - min);
      progress = Math.max(0, Math.min(1, raw));
    }

    if (min === null && max === null) return { label: 'SIN RANGO', color: 'bg-slate-400', icon: 'info', progress, status: 'NONE' };
    if (min !== null && bal < min) return { label: 'BAJO', color: 'bg-amber-500', icon: 'warning', progress: 0.1, status: 'LOW' };
    if (max !== null && bal > max) return { label: 'ALTO', color: 'bg-rose-500', icon: 'priority_high', progress: 1, status: 'HIGH' };
    
    return { label: 'ÓPTIMO', color: 'bg-emerald-500', icon: 'check_circle', progress, status: 'OK' };
  }, [invAccount]);

  return (
    <div className="bg-[#0a0f1d] font-display text-white antialiased min-h-screen relative pb-32">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      <header className="sticky top-0 z-30 w-full px-6 pt-12 pb-4 bg-[#0a0f1d]/80 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 rounded-full hover:bg-white/5 transition-colors">
              <span className="material-symbols-outlined text-2xl">menu</span>
            </button>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-primary dark:text-blue-400 mb-0.5">Operación Central</p>
              <h1 className="text-lg font-bold tracking-tight">Hola, {profile?.displayName?.split(' ')[0] || 'Admin'}</h1>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <ProfileMenu />
          </div>
        </div>
      </header>
      
      <main className="flex flex-col w-full max-w-md mx-auto px-6 space-y-7 mt-6">
        
        {queryError?.includes('index') && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl animate-in slide-in-from-top-2">
            <div className="flex items-center gap-2 text-amber-500 mb-1">
              <span className="material-symbols-outlined text-sm">database_sync</span>
              <p className="text-[10px] font-black uppercase tracking-widest">Base de datos optimizándose</p>
            </div>
            <p className="text-[11px] text-slate-400 leading-tight">
              Los índices de Firestore se están creando. El resumen financiero podría tardar unos minutos en aparecer.
            </p>
          </div>
        )}

        <section className="animate-in fade-in slide-in-from-top-4 duration-500">
           <div className="bg-gradient-to-br from-indigo-500 to-blue-500 p-7 rounded-[2rem] shadow-2xl shadow-primary/20 relative overflow-hidden">
             <div className="relative z-10">
               <p className="text-[9px] font-black uppercase tracking-widest text-white/60 mb-2">Balance Neto de Hoy</p>
               <h2 className="text-4xl font-black tracking-tighter mb-6">
                 {loading ? '...' : formatMXN(totals.balance)}
               </h2>
               
               <div className="flex items-center gap-6 pt-5 border-t border-white/10">
                 <div className="flex-1">
                   <p className="text-[8px] font-black uppercase tracking-widest text-white/40 mb-0.5">Entradas</p>
                   <p className="text-sm font-bold text-emerald-300">{formatMXN(totals.income)}</p>
                 </div>
                 <div className="w-px h-6 bg-white/10"></div>
                 <div className="flex-1">
                   <p className="text-[8px] font-black uppercase tracking-widest text-white/40 mb-0.5">Salidas</p>
                   <p className="text-sm font-bold text-rose-300">{formatMXN(totals.expense)}</p>
                 </div>
               </div>
             </div>
             <span className="material-symbols-outlined absolute -right-6 -bottom-6 text-[140px] opacity-10 rotate-12">account_balance_wallet</span>
           </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Rendimiento Hoy</h2>
            <div className="h-px flex-1 bg-white/5 ml-4"></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {rubrics.map((r) => {
              const data = statsByAccount[r.id] || { income: 0, expense: 0, net: 0 };
              const accInfo = AccountResolver.getAccount(r.id);
              return (
                <div 
                  key={r.id} 
                  onClick={() => navigate(accInfo ? `/account/history/${accInfo.accountDocId}` : '/finance-accounts')}
                  className="p-5 bg-white/5 rounded-[1.8rem] border border-white/5 shadow-sm active:scale-95 transition-all cursor-pointer group"
                >
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 group-hover:text-primary dark:group-hover:text-blue-400 transition-colors">{r.label}</span>
                    <div className={`size-1.5 rounded-full ${data.net >= 0 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]'}`}></div>
                  </div>
                  <p className={`text-xl font-black tracking-tight ${data.net >= 0 ? 'text-white' : 'text-rose-400'}`}>
                    {formatMXN(data.net)}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Logística</h2>
            <div className="h-px flex-1 bg-white/5 ml-4"></div>
          </div>
          <div 
            onClick={() => invAccount && navigate(`/account/history/${invAccount.id}`)}
            className="p-6 bg-white/5 rounded-[2rem] border border-white/5 active:scale-[0.98] transition-all cursor-pointer relative overflow-hidden group"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-xl bg-primary/10 text-primary dark:text-blue-400 flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg">inventory_2</span>
                </div>
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Valor en Mercancía</span>
              </div>
              <div className={`px-3 py-1 rounded-full text-[8px] font-black tracking-widest text-white shadow-lg ${inventoryStatus.color}`}>
                {inventoryStatus.label}
              </div>
            </div>
            
            <p className="text-3xl font-black tracking-tighter text-white mb-4">
              {invAccount ? formatMXN(invAccount.balance) : '...'}
            </p>

            {invAccount && (invAccount.inventoryMin !== null || invAccount.inventoryMax !== null) && (
              <div className="space-y-3">
                <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-1000 ease-out rounded-full ${
                      inventoryStatus.status === 'LOW' ? 'bg-amber-500' :
                      inventoryStatus.status === 'HIGH' ? 'bg-rose-500' :
                      'bg-emerald-500'
                    }`}
                    style={{ width: `${inventoryStatus.progress * 100}%` }}
                  ></div>
                </div>
                <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest text-center">
                  Rango objetivo: {invAccount.inventoryMin ? formatMXN(invAccount.inventoryMin) : '$0'} – {invAccount.inventoryMax ? formatMXN(invAccount.inventoryMax) : 'Max'}
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="pb-8">
          <div className="flex items-center justify-between mb-4 px-1">
            <h2 className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Cierre Reciente</h2>
            <div className="h-px flex-1 bg-white/5 ml-4"></div>
          </div>
          {lastCorte ? (
             <div onClick={() => navigate('/cortes')} className="flex items-center gap-4 p-5 rounded-[1.8rem] bg-white/5 border border-white/5 cursor-pointer active:scale-[0.98] transition-all group">
                <div className={`size-12 rounded-2xl flex items-center justify-center shrink-0 ${lastCorte.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-500 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-500 dark:text-rose-400'}`}>
                  <span className="material-symbols-outlined text-2xl">{lastCorte.status === 'ACTIVE' ? 'verified' : 'report_problem'}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[8px] font-black uppercase text-slate-500 tracking-widest mb-1">Auditado el {lastCorte.fecha}</p>
                  <h4 className="text-sm font-bold text-white truncate uppercase">Admin: {lastCorte.admin || 'Paco'}</h4>
                </div>
                <div className="text-right">
                  <p className="text-[8px] font-black uppercase text-slate-500 mb-0.5">Diferencia</p>
                  <p className={`text-xs font-black ${lastCorte.audit?.diferencia >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {formatMXN(lastCorte.audit?.diferencia || 0)}
                  </p>
                </div>
                <span className="material-symbols-outlined text-slate-600 group-hover:text-primary dark:group-hover:text-blue-400 transition-colors">chevron_right</span>
             </div>
          ) : (
            <div className="p-8 text-center bg-white/5 rounded-[2rem] border border-dashed border-white/10">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Sin cortes registrados</p>
            </div>
          )}
        </section>
      </main>
      <BottomNav />
    </div>
  );
};

export default DashboardScreen;
