
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AccountMovement } from '../types';
import BottomNav from '../components/BottomNav';
import { AccountResolver } from '../services/AccountResolver';
import { AccountingService } from '../services/AccountingService';

type ReportTab = 'resumen' | 'ingresos' | 'egresos';
type PeriodType = 'day' | 'week' | 'month';

interface AccountStats {
  income: number;
  expense: number;
  net: number;
}

const FinanceStatsTotalsScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [activeTab, setActiveTab] = useState<ReportTab>('resumen');
  const [periodType, setPeriodType] = useState<PeriodType>('month');
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [movements, setMovements] = useState<AccountMovement[]>([]);

  const dateRange = useMemo(() => {
    const start = new Date(currentDate);
    const end = new Date(currentDate);
    if (periodType === 'day') {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (periodType === 'week') {
      const day = start.getDay();
      const diff = start.getDate() - day + (day === 0 ? -6 : 1);
      start.setDate(diff);
      start.setHours(0, 0, 0, 0);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(start.getMonth() + 1);
      end.setDate(0);
      end.setHours(23, 59, 59, 999);
    }
    return { start, end };
  }, [currentDate, periodType]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    AccountResolver.loadIndex(user.uid);
    const unsub = AccountingService.subscribeToMovements(user.uid, dateRange.start, dateRange.end, (movs) => {
      setMovements(movs);
      setLoading(false);
    });
    return () => unsub();
  }, [user, dateRange]);

  const totals = useMemo(() => AccountingService.calculateTotals(movements), [movements]);
  const statsByAccount = useMemo(() => AccountingService.groupStatsByAccount(movements), [movements]);
  const dailyHistory = useMemo(() => {
    return AccountingService.getDailyHistory(movements, dateRange.start, dateRange.end);
  }, [movements, dateRange]);

  const formatMXN = (val: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);

  const changePeriod = (dir: number) => {
    const next = new Date(currentDate);
    if (periodType === 'day') next.setDate(next.getDate() + dir);
    else if (periodType === 'week') next.setDate(next.getDate() + (dir * 7));
    else next.setMonth(next.getMonth() + dir);
    setCurrentDate(next);
  };

  const getAccountName = (id: string) => {
    return AccountResolver.getAccount(id)?.name || id.toUpperCase();
  };

  const TrendLineChart = () => {
    if (dailyHistory.length < 2) return <div className="h-20 flex items-center justify-center text-[9px] text-slate-500 uppercase tracking-widest">Datos insuficientes para tendencia</div>;
    
    const data = dailyHistory.map(d => d.balance);
    const minVal = Math.min(...data);
    const maxVal = Math.max(...data);
    const range = maxVal - minVal || 100;
    
    const points = dailyHistory.map((d, i) => {
      const x = (i / (dailyHistory.length - 1)) * 100;
      const y = 80 - ((d.balance - minVal) / range) * 60;
      return `${x},${y}`;
    }).join(' ');

    return (
      <div className="relative h-24 w-full mt-4">
        <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible" preserveAspectRatio="none">
          <defs>
            <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path 
            d={`M 0 100 L 0 ${80 - ((dailyHistory[0].balance - minVal) / range) * 60} ${points.split(' ').map(p => `L ${p}`).join(' ')} L 100 100 Z`} 
            fill="url(#lineGrad)" 
          />
          <polyline 
            fill="none" 
            stroke="#6366f1" 
            strokeWidth="2.5" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            points={points} 
            className="drop-shadow-lg"
          />
          {dailyHistory.length < 15 && dailyHistory.map((d, i) => (
            <circle 
              key={i} 
              cx={(i / (dailyHistory.length - 1)) * 100} 
              cy={80 - ((d.balance - minVal) / range) * 60} 
              r="1.5" 
              fill="#6366f1" 
              stroke="white" 
              strokeWidth="0.5"
            />
          ))}
        </svg>
      </div>
    );
  };

  return (
    <div className="relative flex flex-col h-screen w-full max-w-md mx-auto bg-background-light dark:bg-background-dark font-display antialiased overflow-hidden">
      <header className="sticky top-0 z-50 bg-background-light/95 dark:bg-background-dark/95 pt-12 px-5 pb-4 border-b border-slate-100 dark:border-white/5 backdrop-blur-md">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-slate-700 dark:text-white transition-colors">
              <span className="material-symbols-outlined text-2xl">arrow_back</span>
            </button>
            <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Análisis Financiero</h1>
          </div>
          <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-2xl shadow-inner">
            {(['day', 'week', 'month'] as PeriodType[]).map(t => (
              <button 
                key={t} 
                onClick={() => setPeriodType(t)} 
                className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all duration-300 ${periodType === t ? 'bg-white dark:bg-white/10 shadow-md text-primary' : 'text-slate-500'}`}
              >
                {t === 'day' ? 'Día' : t === 'week' ? 'Sem' : 'Mes'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between bg-slate-50 dark:bg-white/5 rounded-2xl p-2 mb-4 border border-slate-100 dark:border-white/5">
          <button onClick={() => changePeriod(-1)} className="p-2 text-slate-400 hover:text-primary transition-colors active:scale-90">
            <span className="material-symbols-outlined">chevron_left</span>
          </button>
          <div className="text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary leading-none mb-1">Ventana Temporal</p>
            <p className="text-[11px] font-extrabold text-slate-700 dark:text-white">
              {dateRange.start.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })} - {dateRange.end.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          </div>
          <button onClick={() => changePeriod(1)} className="p-2 text-slate-400 hover:text-primary transition-colors active:scale-90">
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
        </div>

        <div className="flex p-1 bg-slate-200/50 dark:bg-surface-dark/50 rounded-2xl border border-slate-200 dark:border-white/5">
          {(['resumen', 'ingresos', 'egresos'] as const).map(tab => (
            <button 
              key={tab} 
              onClick={() => setActiveTab(tab)} 
              className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${activeTab === tab ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              {tab === 'resumen' ? 'Balance' : tab}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar pb-32">
        {loading ? (
          <div className="py-40 flex flex-col items-center justify-center gap-4">
            <span className="material-symbols-outlined animate-spin text-primary text-5xl">sync</span>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 animate-pulse">Calculando métricas...</p>
          </div>
        ) : movements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="size-24 bg-slate-100 dark:bg-white/5 rounded-[2.5rem] flex items-center justify-center mb-6">
              <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-700">analytics</span>
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Sin actividad</p>
            <p className="text-xs font-bold text-slate-500 max-w-[180px]">No hay transacciones registradas en este periodo.</p>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in duration-500 slide-in-from-bottom-4">
            {activeTab === 'resumen' ? (
              <>
                <div className="p-8 bg-gradient-to-br from-indigo-500 via-indigo-600 to-blue-600 rounded-[3rem] text-white shadow-2xl shadow-indigo-500/30 relative overflow-hidden group">
                   <div className="relative z-10">
                    <p className="text-[10px] font-black uppercase tracking-widest text-indigo-100/70 mb-2">Resultado Operativo</p>
                    <h2 className="text-4xl font-black tracking-tighter mb-4 group-hover:scale-105 transition-transform origin-left duration-500">
                      {formatMXN(totals.balance)}
                    </h2>
                    
                    <TrendLineChart />

                    <div className="grid grid-cols-2 gap-6 pt-6 mt-4 border-t border-white/10">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[14px] text-emerald-300">trending_up</span>
                            <p className="text-[9px] font-black uppercase tracking-widest text-white/50">Ingresos</p>
                          </div>
                          <p className="text-lg font-black text-emerald-300">{formatMXN(totals.income)}</p>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[14px] text-red-300">trending_down</span>
                            <p className="text-[9px] font-black uppercase tracking-widest text-white/50">Egresos</p>
                          </div>
                          <p className="text-lg font-black text-red-300">{formatMXN(totals.expense)}</p>
                        </div>
                    </div>
                   </div>
                   <span className="material-symbols-outlined absolute -right-8 -bottom-8 text-[200px] opacity-10 rotate-12 pointer-events-none group-hover:rotate-45 transition-transform duration-700">finance_mode</span>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Comparativa por Rubro</h3>
                    <span className="text-[9px] font-bold text-indigo-400 bg-indigo-400/10 px-3 py-1 rounded-full uppercase">Flujo Neto</span>
                  </div>
                  
                  {(Object.entries(statsByAccount) as [string, AccountStats][]).sort((a, b) => b[1].income - a[1].income).map(([id, data]) => {
                    const totalVolume = Math.max(data.income, data.expense) || 1;
                    const incomeWidth = (data.income / totalVolume) * 100;
                    const expenseWidth = (data.expense / totalVolume) * 100;
                    
                    return (
                      <div key={id} className="bg-white dark:bg-surface-dark rounded-[2.5rem] p-6 shadow-sm border border-slate-100 dark:border-white/5 hover:shadow-xl hover:shadow-indigo-500/5 active:scale-[0.98] transition-all group overflow-hidden relative">
                        <div className="flex justify-between items-start mb-5 relative z-10">
                          <div>
                            <h4 className="text-sm font-black uppercase text-slate-800 dark:text-white group-hover:text-primary transition-colors">{getAccountName(id)}</h4>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">ID: {id}</p>
                          </div>
                          <div className="text-right">
                            <p className={`text-lg font-black tracking-tighter ${data.net >= 0 ? 'text-slate-900 dark:text-white' : 'text-rose-500 dark:text-rose-400'}`}>
                              {formatMXN(data.net)}
                            </p>
                            <div className="flex items-center justify-end gap-1 mt-0.5">
                               <span className={`size-1.5 rounded-full ${data.net >= 0 ? 'bg-emerald-500' : 'bg-rose-500 dark:bg-rose-400'}`}></span>
                               <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Resultado</p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="space-y-4 relative z-10">
                          <div className="space-y-2">
                             <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-widest mb-1">
                               <span className="text-emerald-500">Ingreso: {formatMXN(data.income)}</span>
                               <span className="text-slate-400">{incomeWidth.toFixed(0)}% del volumen</span>
                             </div>
                             <div className="h-1.5 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden shadow-inner">
                               <div className="h-full bg-emerald-500 transition-all duration-1000 ease-out delay-100 rounded-full" style={{ width: `${incomeWidth}%` }} />
                             </div>
                          </div>

                          <div className="space-y-2">
                             <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-widest mb-1">
                               <span className="text-red-400">Egreso: {formatMXN(data.expense)}</span>
                               <span className="text-slate-400">{expenseWidth.toFixed(0)}% del volumen</span>
                             </div>
                             <div className="h-1.5 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden shadow-inner">
                               <div className="h-full bg-red-400 transition-all duration-1000 ease-out delay-200 rounded-full" style={{ width: `${expenseWidth}%` }} />
                             </div>
                          </div>
                        </div>
                        
                        {/* Background subtle decoration */}
                        <div className="absolute top-0 right-0 p-2 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                          <span className="material-symbols-outlined text-8xl">bar_chart_4_bars</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="animate-in slide-in-from-bottom-6 duration-500">
                <div className="bg-white dark:bg-surface-dark rounded-[3rem] p-8 shadow-sm border border-slate-100 dark:border-white/5 relative overflow-hidden">
                  <div className="relative z-10 text-center space-y-2 mb-10">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Total {activeTab}</p>
                    <p className={`text-5xl font-black tracking-tighter ${activeTab === 'ingresos' ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>
                      {formatMXN(activeTab === 'ingresos' ? totals.income : totals.expense)}
                    </p>
                    <div className="flex justify-center pt-2">
                       <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${activeTab === 'ingresos' ? 'bg-emerald-500/10 text-emerald-500 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-500 dark:text-rose-400'}`}>
                         {movements.filter(m => {
                            const type = (m.type as any);
                            return activeTab === 'ingresos' ? (type === 'INCOME' || type === 'INGRESO') : (type === 'EXPENSE' || type === 'EGRESO');
                         }).length} transacciones
                       </span>
                    </div>
                  </div>
                  
                  <div className="space-y-12 relative z-10">
                    {(Object.entries(statsByAccount) as [string, AccountStats][])
                      .filter(([_, data]) => activeTab === 'ingresos' ? data.income > 0 : data.expense > 0)
                      .map(([id, data]) => (
                      <div key={id} className="space-y-6">
                        <div className="flex items-center gap-4">
                          <div className={`size-10 rounded-2xl flex items-center justify-center ${activeTab === 'ingresos' ? 'bg-emerald-500/10 text-emerald-500 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-500 dark:text-rose-400'}`}>
                            <span className="material-symbols-outlined text-xl">{activeTab === 'ingresos' ? 'call_received' : 'call_made'}</span>
                          </div>
                          <div className="flex-1">
                            <h4 className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-900 dark:text-white">{getAccountName(id)}</h4>
                            <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">Acumulado: {formatMXN(activeTab === 'ingresos' ? data.income : data.expense)}</p>
                          </div>
                          <div className="h-px flex-1 bg-slate-100 dark:bg-white/5 opacity-50"></div>
                        </div>
                        
                        <div className="space-y-3 pl-4">
                          {movements
                            .filter(m => {
                              const type = (m.type as any);
                              const isTabType = activeTab === 'ingresos' 
                                ? (type === 'INCOME' || type === 'INGRESO')
                                : (type === 'EXPENSE' || type === 'EGRESO');
                              return m.accountId === id && isTabType;
                            })
                            .map((m, i) => (
                              <div key={i} className="group flex justify-between items-center p-4 bg-slate-50/50 dark:bg-white/5 rounded-2xl hover:bg-white dark:hover:bg-white/10 transition-all border border-transparent hover:border-slate-100 dark:hover:border-white/5 shadow-sm hover:shadow-lg hover:shadow-indigo-500/5">
                                <div className="flex-1 pr-4 text-left">
                                  <p className="text-xs font-black uppercase truncate text-slate-700 dark:text-slate-200 group-hover:text-primary transition-colors">{m.conceptTitle}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase truncate max-w-[80px]">{m.conceptSubtitle || m.source}</span>
                                    <span className="size-1 bg-slate-300 dark:bg-slate-700 rounded-full"></span>
                                    <p className="text-[9px] font-bold text-slate-400 whitespace-nowrap">{m.effectiveAt?.toDate().toLocaleDateString('es-MX', {day:'2-digit', month:'short'})}</p>
                                  </div>
                                </div>
                                <p className={`text-sm font-black whitespace-nowrap ${activeTab === 'ingresos' ? 'text-emerald-500' : 'text-red-400'}`}>
                                  {formatMXN(m.amount)}
                                </p>
                              </div>
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Decorative elements */}
                  <div className="absolute -left-12 -top-12 size-48 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>
                  <div className="absolute -right-12 -bottom-12 size-48 bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
};

export default FinanceStatsTotalsScreen;
