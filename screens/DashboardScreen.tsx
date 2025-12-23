
import React, { useState, useEffect } from 'react';
import BottomNav from '../components/BottomNav';
import Sidebar from '../components/Sidebar';
import ProfileMenu from '../components/ProfileMenu';
import { GeminiService } from '../services/geminiService';
import { RECENT_ACTIVITY } from '../constants';
import NotificationBell from '../components/NotificationBell';
import { useAuth } from '../context/AuthContext';

const DashboardScreen: React.FC = () => {
  const { profile } = useAuth();
  const [insight, setInsight] = useState<string>("Analizando tendencias recientes...");
  const [isLoadingInsight, setIsLoadingInsight] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const fetchInsight = async () => {
      const data = { itemsProcessed: 1240, successRate: 0.98, weeklySales: 124500 };
      const result = await GeminiService.getDashboardInsights(data);
      setInsight(result);
      setIsLoadingInsight(false);
    };
    fetchInsight();
  }, []);

  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-white antialiased pb-32 min-h-screen">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      <header className="sticky top-0 z-30 w-full px-6 pt-12 pb-4 bg-background-light/90 dark:bg-background-dark/90 backdrop-blur-md transition-all duration-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 -ml-2 rounded-full hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-white"
            >
              <span className="material-symbols-outlined">menu</span>
            </button>
            <div className="flex flex-col">
              <p className="text-[10px] font-bold uppercase tracking-wider text-primary">DataFlow AI</p>
              <h1 className="text-xl font-extrabold tracking-tight">Hola, {profile?.displayName?.split(' ')[0] || 'Admin'}</h1>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <ProfileMenu />
          </div>
        </div>
      </header>
      
      <main className="flex flex-col w-full max-w-md mx-auto">
        <section className="px-6 mt-4">
           <div className="p-4 rounded-2xl bg-gradient-to-r from-primary to-purple-600 shadow-lg shadow-primary/20 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-2 opacity-20 transform translate-x-2 -translate-y-2 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-6xl">auto_awesome</span>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-white text-lg">psychology</span>
                <span className="text-[10px] font-bold text-white/80 uppercase tracking-widest">IA Insight</span>
              </div>
              <p className="text-white text-sm font-medium leading-relaxed">
                {isLoadingInsight ? (
                  <span className="animate-pulse">Analizando tus datos...</span>
                ) : insight}
              </p>
           </div>
        </section>

        <section className="mt-6 w-full">
          <div className="flex items-center justify-between px-6 py-2">
            <h2 className="text-lg font-bold leading-tight tracking-tight">Resumen del día</h2>
          </div>
          <div className="flex w-full overflow-x-auto gap-4 px-6 py-2 no-scrollbar snap-x">
            <div className="snap-start shrink-0 min-w-[200px] flex-1 p-5 rounded-xl bg-white dark:bg-card-dark shadow-sm ring-1 ring-slate-200 dark:ring-white/5 flex flex-col justify-between h-40">
              <div className="flex items-start justify-between">
                <div className="p-2 rounded-full bg-primary/10 text-primary">
                  <span className="material-symbols-outlined text-xl">dataset</span>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Ítems Procesados</p>
                <p className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">1,240</p>
              </div>
            </div>
            <div className="snap-start shrink-0 min-w-[200px] flex-1 p-5 rounded-xl bg-white dark:bg-card-dark shadow-sm ring-1 ring-slate-200 dark:ring-white/5 flex flex-col justify-between h-40">
              <div className="flex items-start justify-between">
                <div className="p-2 rounded-full bg-blue-500/10 text-blue-500">
                  <span className="material-symbols-outlined text-xl">check_circle</span>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Tasa de Éxito</p>
                <p className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">98%</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 px-6 w-full mb-10">
          <h2 className="text-lg font-bold leading-tight tracking-tight mb-4">Actividad Reciente</h2>
          <div className="flex flex-col gap-3">
            {RECENT_ACTIVITY.map(item => (
              <div key={item.id} className="flex items-center gap-4 p-4 rounded-xl bg-white dark:bg-card-dark shadow-sm border border-slate-100 dark:border-none">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${item.type === 'success' ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400'}`}>
                  <span className="material-symbols-outlined">{item.icon}</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{item.title}</p>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{item.description}</p>
                </div>
                <p className="text-[10px] font-bold text-slate-400">{item.time}</p>
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
