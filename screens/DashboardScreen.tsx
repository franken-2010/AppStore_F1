
import React, { useState, useEffect } from 'react';
import BottomNav from '../components/BottomNav';
import { GeminiService } from '../services/geminiService';
import { RECENT_ACTIVITY } from '../constants';

const DashboardScreen: React.FC = () => {
  const [insight, setInsight] = useState<string>("Analizando tendencias recientes...");
  const [isLoadingInsight, setIsLoadingInsight] = useState(true);

  useEffect(() => {
    const fetchInsight = async () => {
      const data = {
        itemsProcessed: 1240,
        successRate: 0.98,
        weeklySales: 124500
      };
      const result = await GeminiService.getDashboardInsights(data);
      setInsight(result);
      setIsLoadingInsight(false);
    };
    fetchInsight();
  }, []);

  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-white antialiased selection:bg-primary selection:text-white pb-32 min-h-screen">
      <header className="sticky top-0 z-30 w-full px-6 pt-12 pb-4 bg-background-light/90 dark:bg-background-dark/90 backdrop-blur-md transition-all duration-300">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">24 Oct, 2023</p>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">Hola, Admin</h1>
          </div>
          <div className="flex items-center">
            <button className="group flex h-12 w-12 items-center justify-center rounded-full bg-white dark:bg-card-dark shadow-sm ring-1 ring-slate-200 dark:ring-white/10 transition-transform active:scale-95">
              <span className="material-symbols-outlined text-slate-600 dark:text-white group-hover:text-primary transition-colors">notifications</span>
              <span className="absolute top-3 right-3 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-white dark:border-card-dark"></span>
            </button>
          </div>
        </div>
      </header>
      
      <main className="flex flex-col w-full max-w-md mx-auto">
        {/* Gemini Insight Section */}
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
            <button className="text-xs font-bold text-primary hover:text-primary/80 transition-colors">Ver todo</button>
          </div>
          <div className="flex w-full overflow-x-auto gap-4 px-6 py-2 no-scrollbar snap-x">
            <div className="snap-start shrink-0 min-w-[200px] flex-1 p-5 rounded-xl bg-white dark:bg-card-dark shadow-sm ring-1 ring-slate-200 dark:ring-white/5 flex flex-col justify-between h-40 group relative overflow-hidden border border-slate-100 dark:border-none">
              <div className="absolute -right-4 -top-4 w-20 h-20 bg-primary/5 rounded-full blur-xl group-hover:bg-primary/10 transition-all"></div>
              <div className="flex items-start justify-between z-10">
                <div className="p-2 rounded-full bg-primary/10 text-primary">
                  <span className="material-symbols-outlined text-xl">dataset</span>
                </div>
                <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-bold">
                  <span className="material-symbols-outlined text-sm">trending_up</span>
                  <span>12%</span>
                </div>
              </div>
              <div className="z-10">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Ítems Procesados</p>
                <p className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">1,240</p>
              </div>
            </div>
            <div className="snap-start shrink-0 min-w-[200px] flex-1 p-5 rounded-xl bg-white dark:bg-card-dark shadow-sm ring-1 ring-slate-200 dark:ring-white/5 flex flex-col justify-between h-40 group relative overflow-hidden border border-slate-100 dark:border-none">
              <div className="absolute -right-4 -top-4 w-20 h-20 bg-blue-500/5 rounded-full blur-xl group-hover:bg-blue-500/10 transition-all"></div>
              <div className="flex items-start justify-between z-10">
                <div className="p-2 rounded-full bg-blue-500/10 text-blue-500">
                  <span className="material-symbols-outlined text-xl">check_circle</span>
                </div>
                <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-bold">
                  <span className="material-symbols-outlined text-sm">trending_up</span>
                  <span>0.5%</span>
                </div>
              </div>
              <div className="z-10">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Tasa de Éxito</p>
                <p className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">98%</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 px-6 w-full">
          <h2 className="text-lg font-bold leading-tight tracking-tight mb-4">Tendencias</h2>
          <div className="w-full rounded-xl bg-white dark:bg-card-dark shadow-sm ring-1 ring-slate-200 dark:ring-white/5 p-6 relative overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 bg-primary/20 blur-[60px] rounded-full pointer-events-none"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-300">Volumen</h3>
                <div className="flex p-1 bg-slate-100 dark:bg-background-dark rounded-full">
                  <button className="px-4 py-1.5 rounded-full bg-white dark:bg-card-dark shadow-sm text-xs font-bold text-slate-900 dark:text-white ring-1 ring-slate-200 dark:ring-white/10">Día</button>
                  <button className="px-4 py-1.5 rounded-full text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-primary transition">Semana</button>
                </div>
              </div>
              <div className="h-48 w-full relative">
                <svg className="w-full h-full visible overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
                  <defs>
                    <linearGradient id="gradientArea" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#8253d5" stopOpacity="0.3"></stop>
                      <stop offset="100%" stopColor="#8253d5" stopOpacity="0"></stop>
                    </linearGradient>
                  </defs>
                  <path d="M0,80 Q15,70 30,50 T60,40 T90,20 L100,25 L100,100 L0,100 Z" fill="url(#gradientArea)"></path>
                  <path className="drop-shadow-[0_0_10px_rgba(130,83,213,0.5)]" d="M0,80 Q15,70 30,50 T60,40 T90,20 L100,25" fill="none" stroke="#8253d5" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3"></path>
                  <circle cx="90" cy="20" fill="#17131f" r="4" stroke="#8253d5" strokeWidth="3"></circle>
                </svg>
              </div>
              <div className="flex justify-between mt-4 text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                <span>Lun</span><span>Mar</span><span>Mié</span><span>Jue</span><span>Vie</span><span>Sáb</span><span>Dom</span>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 px-6 w-full mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold leading-tight tracking-tight">Actividad Reciente</h2>
          </div>
          <div className="flex flex-col gap-3">
            {RECENT_ACTIVITY.map(item => (
              <div key={item.id} className="flex items-center gap-4 p-4 rounded-xl bg-white dark:bg-card-dark shadow-sm ring-1 ring-slate-200 dark:ring-white/5 active:scale-[0.99] transition-transform cursor-pointer border border-slate-100 dark:border-none">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${item.type === 'success' ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : item.type === 'warning' ? 'bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400' : 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400'}`}>
                  <span className="material-symbols-outlined">{item.icon}</span>
                </div>
                <div className="flex flex-1 flex-col gap-0.5">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{item.title}</p>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{item.description}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-slate-400">{item.time}</p>
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
