
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { collection, query, onSnapshot, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { AccountingAccount } from '../types';

const FinanceStatsTotalsScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPeriod, setCurrentPeriod] = useState({
    month: new Date().getMonth(),
    year: new Date().getFullYear()
  });

  const [accounts, setAccounts] = useState<AccountingAccount[]>([]);
  
  // Datos simulados para las gráficas ya que no hay una colección de snapshots histórica completa
  // En un entorno real, estos vendrían de una colección 'history_balances' o agregaciones de 'cortes'
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const last6MonthsIndices = Array.from({length: 6}, (_, i) => (currentPeriod.month - 5 + i + 12) % 12);
  const last6MonthsLabels = last6MonthsIndices.map(i => months[i]);

  const [mockStats] = useState({
    balanceHistory: [145000, 152000, 148000, 165000, 172000, 168500],
    incomeVsExpenses: [
      { inc: 45000, exp: 32000 },
      { inc: 48000, exp: 35000 },
      { inc: 42000, exp: 38000 },
      { inc: 55000, exp: 42000 },
      { inc: 52000, exp: 39000 },
      { inc: 49000, exp: 41000 },
    ]
  });

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const q = query(collection(db, "users", user.uid, "accounts"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const accs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AccountingAccount));
      setAccounts(accs);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setError("Error al cargar datos financieros.");
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  const totalBalance = accounts.filter(a => a.type === 'Activo' || (a as any).type === 'Ahorro').reduce((s, a) => s + (a.balance || 0), 0) 
                  - accounts.filter(a => a.type === 'Pasivo').reduce((s, a) => s + (a.balance || 0), 0);

  const formatMXN = (val: number) => {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);
  };

  const changePeriod = (dir: number) => {
    let nextMonth = currentPeriod.month + dir;
    let nextYear = currentPeriod.year;
    if (nextMonth < 0) { nextMonth = 11; nextYear--; }
    if (nextMonth > 11) { nextMonth = 0; nextYear++; }
    setCurrentPeriod({ month: nextMonth, year: nextYear });
  };

  // Renderizador de Gráfica de Línea Simple (Balance)
  const LineChart = () => {
    const max = Math.max(...mockStats.balanceHistory) * 1.1;
    const points = mockStats.balanceHistory.map((val, i) => {
      const x = (i / 5) * 100;
      const y = 100 - (val / max) * 100;
      return `${x},${y}`;
    }).join(' ');

    return (
      <div className="relative h-40 w-full mt-4">
        <svg viewBox="0 0 100 100" className="h-full w-full" preserveAspectRatio="none">
          {/* Grid lines */}
          <line x1="0" y1="25" x2="100" y2="25" className="stroke-slate-100 dark:stroke-white/5" strokeWidth="0.5" />
          <line x1="0" y1="50" x2="100" y2="50" className="stroke-slate-100 dark:stroke-white/5" strokeWidth="0.5" />
          <line x1="0" y1="75" x2="100" y2="75" className="stroke-slate-100 dark:stroke-white/5" strokeWidth="0.5" />
          
          <polyline
            fill="none"
            stroke="url(#gradient)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={points}
            className="drop-shadow-lg"
          />
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#2563eb" />
              <stop offset="100%" stopColor="#60a5fa" />
            </linearGradient>
          </defs>
          {/* Puntos */}
          {mockStats.balanceHistory.map((val, i) => (
            <circle 
              key={i} 
              cx={(i / 5) * 100} 
              cy={100 - (val / max) * 100} 
              r="2" 
              className="fill-primary stroke-white dark:stroke-background-dark stroke-[1px]" 
            />
          ))}
        </svg>
      </div>
    );
  };

  // Renderizador de Gráfica de Barras (Ingresos vs Gastos)
  const BarChart = () => {
    const max = Math.max(...mockStats.incomeVsExpenses.map(d => Math.max(d.inc, d.exp))) * 1.1;
    return (
      <div className="flex items-end justify-between h-40 w-full gap-3 mt-4 px-2">
        {mockStats.incomeVsExpenses.map((data, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
            <div className="flex items-end gap-1 w-full h-32">
              <div 
                className="flex-1 bg-emerald-500 rounded-t-md transition-all group-hover:opacity-80" 
                style={{ height: `${(data.inc / max) * 100}%` }}
              ></div>
              <div 
                className="flex-1 bg-red-500 rounded-t-md transition-all group-hover:opacity-80" 
                style={{ height: `${(data.exp / max) * 100}%` }}
              ></div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center">
        <span className="material-symbols-outlined animate-spin text-primary text-4xl">sync</span>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col h-screen w-full max-w-md mx-auto bg-background-light dark:bg-background-dark font-display antialiased overflow-hidden">
      {/* AppBar */}
      <header className="sticky top-0 z-50 bg-background-light dark:bg-background-dark pt-12 px-4 pb-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-slate-700 dark:text-white">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 className="text-xl font-bold tracking-tight">Estadísticas totales</h1>
        </div>
        
        {/* Period Selector */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-white/5 px-2 py-1 rounded-xl border border-slate-200 dark:border-white/10">
          <button onClick={() => changePeriod(-1)} className="p-1 rounded-lg hover:bg-white dark:hover:bg-white/10 transition-colors">
            <span className="material-symbols-outlined text-sm">chevron_left</span>
          </button>
          <span className="text-[10px] font-black uppercase tracking-widest min-w-[80px] text-center">
            {months[currentPeriod.month]} {currentPeriod.year}
          </span>
          <button onClick={() => changePeriod(1)} className="p-1 rounded-lg hover:bg-white dark:hover:bg-white/10 transition-colors">
            <span className="material-symbols-outlined text-sm">chevron_right</span>
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6 space-y-10 no-scrollbar">
        {/* Saldo Grande */}
        <div className="text-center space-y-2 animate-in fade-in slide-in-from-top-4 duration-500">
          <p className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-400">Saldo del periodo</p>
          <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">
            {formatMXN(totalBalance)}
          </h2>
          <div className="flex items-center justify-center gap-2 text-emerald-500 font-bold text-xs">
            <span className="material-symbols-outlined text-sm">trending_up</span>
            <span>+8.4% vs mes anterior</span>
          </div>
        </div>

        {/* Sección Gráfica Línea (Saldo Histórico) */}
        <section className="bg-white dark:bg-surface-dark rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-white/5 animate-in fade-in duration-700 delay-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tendencia de Saldo</h3>
            <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-1 rounded-lg">6 Meses</span>
          </div>
          <LineChart />
          <div className="flex justify-between mt-4">
            {last6MonthsLabels.map((l, i) => (
              <div key={i} className="text-center space-y-1">
                <p className="text-[9px] font-bold text-slate-400 uppercase">{l}</p>
                <p className="text-[9px] font-black text-slate-900 dark:text-white">{(mockStats.balanceHistory[i]/1000).toFixed(0)}k</p>
              </div>
            ))}
          </div>
        </section>

        {/* Sección Gráfica Barras (Ingresos vs Gastos) */}
        <section className="bg-white dark:bg-surface-dark rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-white/5 animate-in fade-in duration-700 delay-200 pb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ingresos vs Gastos</h3>
            <div className="flex gap-4">
               <div className="flex items-center gap-1">
                 <div className="size-2 bg-emerald-500 rounded-full"></div>
                 <span className="text-[9px] font-bold text-slate-500">Ingresos</span>
               </div>
               <div className="flex items-center gap-1">
                 <div className="size-2 bg-red-500 rounded-full"></div>
                 <span className="text-[9px] font-bold text-slate-500">Gastos</span>
               </div>
            </div>
          </div>
          <BarChart />
          
          <div className="mt-8 space-y-4">
            <div className="grid grid-cols-3 text-[9px] font-black uppercase text-slate-400 border-b border-slate-100 dark:border-white/5 pb-2 px-1">
              <span>Mes</span>
              <span className="text-right">Ingreso</span>
              <span className="text-right">Gasto</span>
            </div>
            {last6MonthsLabels.map((label, i) => (
              <div key={i} className="grid grid-cols-3 items-center py-1 px-1">
                <span className="text-xs font-bold">{label}</span>
                <span className="text-xs font-black text-emerald-500 text-right">{formatMXN(mockStats.incomeVsExpenses[i].inc)}</span>
                <span className="text-xs font-black text-red-500 text-right">{formatMXN(mockStats.incomeVsExpenses[i].exp)}</span>
              </div>
            ))}
          </div>
        </section>
        
        <div className="h-10"></div>
      </main>
    </div>
  );
};

export default FinanceStatsTotalsScreen;
