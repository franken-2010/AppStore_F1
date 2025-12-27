
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import Sidebar from '../components/Sidebar';
import ProfileMenu from '../components/ProfileMenu';
import { RECENT_CORTES, QUICK_STATS } from '../constants';
import NotificationBell from '../components/NotificationBell';
import { useAuth } from '../context/AuthContext';

const DashboardScreen: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-white antialiased pb-32 min-h-screen">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      <header className="sticky top-0 z-30 w-full px-6 pt-12 pb-4 bg-background-light/90 dark:bg-background-dark/90 backdrop-blur-md transition-all duration-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 -ml-2 rounded-full hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-white transition-colors"
            >
              <span className="material-symbols-outlined">menu</span>
            </button>
            <div className="flex flex-col">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Abarrotes F1 Intelligence</p>
              <h1 className="text-xl font-extrabold tracking-tight">Hola, {profile?.displayName?.split(' ')[0] || 'Admin'}</h1>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <ProfileMenu />
          </div>
        </div>
      </header>
      
      <main className="flex flex-col w-full max-w-md mx-auto px-6">
        {/* QUICK STATS */}
        <section className="mt-4 grid grid-cols-2 gap-4">
          {QUICK_STATS.map((stat, idx) => (
            <div key={idx} className="p-6 rounded-3xl bg-white dark:bg-surface-dark border border-slate-100 dark:border-white/5 shadow-sm hover:shadow-md transition-all">
              <div className={`size-10 rounded-2xl flex items-center justify-center mb-4 ${stat.color} bg-current/10`}>
                <span className="material-symbols-outlined">{stat.icon}</span>
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{stat.label}</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter">{stat.value}</p>
            </div>
          ))}
        </section>

        {/* ACTION GRID */}
        <section className="mt-8">
          <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-5 px-1 flex items-center gap-2">
            Gestión F1
            <div className="flex-1 h-px bg-slate-100 dark:bg-white/5"></div>
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <button 
              onClick={() => navigate('/cortes')}
              className="flex flex-col items-center gap-3 p-5 rounded-[2rem] bg-white dark:bg-surface-dark border border-slate-100 dark:border-white/5 active:scale-95 transition-all shadow-sm group"
            >
              <div className="size-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors duration-300">
                <span className="material-symbols-outlined text-2xl">point_of_sale</span>
              </div>
              <span className="text-[10px] font-black uppercase tracking-tight text-center leading-none text-slate-600 dark:text-slate-400">Caja</span>
            </button>
            <button 
              onClick={() => navigate('/accounting')}
              className="flex flex-col items-center gap-3 p-5 rounded-[2rem] bg-white dark:bg-surface-dark border border-slate-100 dark:border-white/5 active:scale-95 transition-all shadow-sm group"
            >
              <div className="size-14 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center group-hover:bg-indigo-500 group-hover:text-white transition-colors duration-300">
                <span className="material-symbols-outlined text-2xl">account_balance</span>
              </div>
              <span className="text-[10px] font-black uppercase tracking-tight text-center leading-none text-slate-600 dark:text-slate-400">Conta</span>
            </button>
            <button 
              onClick={() => navigate('/tools/price-verification')}
              className="flex flex-col items-center gap-3 p-5 rounded-[2rem] bg-white dark:bg-surface-dark border border-slate-100 dark:border-white/5 active:scale-95 transition-all shadow-sm group"
            >
              <div className="size-14 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-white transition-colors duration-300">
                <span className="material-symbols-outlined text-2xl">search_check</span>
              </div>
              <span className="text-[10px] font-black uppercase tracking-tight text-center leading-none text-slate-600 dark:text-slate-400">Precios</span>
            </button>
          </div>
        </section>

        {/* RECENT CORTES LIST */}
        <section className="mt-10 mb-10">
          <div className="flex items-center justify-between mb-6 px-1">
            <h2 className="text-xl font-black tracking-tight">Cortes Recientes</h2>
            <button 
              onClick={() => navigate('/cortes')} 
              className="text-[10px] font-black text-primary uppercase tracking-[0.2em] px-4 py-2 bg-primary/10 rounded-full hover:bg-primary hover:text-white transition-all"
            >
              Historial
            </button>
          </div>
          <div className="space-y-4">
            {RECENT_CORTES.map(corte => (
              <div key={corte.id} className="flex items-center gap-4 p-5 rounded-3xl bg-white dark:bg-surface-dark border border-slate-100 dark:border-white/5 shadow-sm hover:border-primary/30 transition-all cursor-pointer">
                <div className={`size-12 rounded-2xl shrink-0 flex items-center justify-center ${corte.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                  <span className="material-symbols-outlined text-2xl">
                    {corte.status === 'completed' ? 'task_alt' : 'error_outline'}
                  </span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-black text-slate-900 dark:text-white leading-tight">{corte.description}</p>
                    <span className="text-[9px] font-black bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full uppercase tracking-widest">{corte.date}</span>
                  </div>
                  <p className="text-xs font-bold text-slate-400 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">payments</span>
                    Efectivo: ${corte.amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="text-right">
                  <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl ${corte.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                    {corte.status === 'completed' ? 'Cuadrado' : 'Revisar'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
      <BottomNav />
    </div>
  );
};

export default DashboardScreen;
