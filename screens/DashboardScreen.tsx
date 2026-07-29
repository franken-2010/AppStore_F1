
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
} from "firebase/firestore";
import { handleFirestoreError, OperationType } from '../services/errorHandling';
import { AccountMovement, AccountingAccount } from '../types';
import { AccountResolver } from '../services/AccountResolver';
import { AccountingService } from '../services/AccountingService';
import DashboardCustomizer from '../components/DashboardCustomizer';
import InventoryImpactModal from '../components/InventoryImpactModal';

type DashboardPeriodType = 'hoy' | 'semana' | 'mes' | 'anio' | 'custom';

const DashboardScreen: React.FC = () => {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [isImpactModalOpen, setIsImpactModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [queryError, setQueryError] = useState<string | null>(null);
  
  const [movementsToday, setMovementsToday] = useState<AccountMovement[]>([]);
  const [lastCorte, setLastCorte] = useState<any>(null);
  const [invAccount, setInvAccount] = useState<AccountingAccount | null>(null);

  const [periodType, setPeriodType] = useState<DashboardPeriodType>('hoy');
  const [customStart, setCustomStart] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7); // Default to last 7 days
    return d.toISOString().split('T')[0];
  });
  const [customEnd, setCustomEnd] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  const dateRange = useMemo(() => {
    const start = new Date();
    const end = new Date();

    if (periodType === 'hoy') {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (periodType === 'semana') {
      const day = start.getDay();
      const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Monday
      start.setDate(diff);
      start.setHours(0, 0, 0, 0);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else if (periodType === 'mes') {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(start.getMonth() + 1);
      end.setDate(0);
      end.setHours(23, 59, 59, 999);
    } else if (periodType === 'anio') {
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(11, 31);
      end.setHours(23, 59, 59, 999);
    } else if (periodType === 'custom') {
      const s = new Date(customStart + 'T00:00:00');
      const e = new Date(customEnd + 'T23:59:59');
      return { start: s, end: e };
    }

    return { start, end };
  }, [periodType, customStart, customEnd]);

  const periodLabel = useMemo(() => {
    if (periodType === 'hoy') return 'de Hoy';
    if (periodType === 'semana') return 'de la Semana';
    if (periodType === 'mes') return 'del Mes';
    if (periodType === 'anio') return 'del Año';
    return 'del Periodo';
  }, [periodType]);

  const dateRangeFormatted = useMemo(() => {
    const options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' };
    const startStr = dateRange.start.toLocaleDateString('es-MX', options);
    const endStr = dateRange.end.toLocaleDateString('es-MX', options);
    if (periodType === 'hoy') {
      return dateRange.start.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
    }
    return `${startStr} – ${endStr}`;
  }, [dateRange, periodType]);

  const dashboardConfig = useMemo(() => profile?.dashboardConfig || {
    showBalance: true,
    showPerformance: true,
    showLogistics: true,
    showClosings: true,
    performanceAccounts: ['ventas', 'fiesta', 'estancias', 'recargas']
  }, [profile?.dashboardConfig]);

  const formatMXN = (val: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);

  const handleCategoryClick = (catKey: string) => {
    const acc = AccountResolver.getAccount(catKey);
    if (acc && acc.accountDocId) {
      navigate(`/account/history/${acc.accountDocId}`);
    } else {
      navigate('/finance-accounts');
    }
  };

  useEffect(() => {
    if (!user?.uid) return;

    setLoading(true);
    setQueryError(null);
    AccountResolver.loadIndex(user.uid);

    const unsubscribeMovs = AccountingService.subscribeToMovements(
      user.uid, 
      dateRange.start,
      dateRange.end,
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
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}/cortes`);
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
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${user.uid}/accounts/${acc.id}`);
        });
      }
    });

    return () => {
      unsubscribeMovs();
      unsubCorte();
      if (unsubInv) unsubInv();
    };
  }, [user?.uid, dateRange.start.getTime(), dateRange.end.getTime()]);

  const totals = useMemo(() => AccountingService.calculateTotals(movementsToday), [movementsToday]);
  const statsByAccount = useMemo(() => AccountingService.groupStatsByAccount(movementsToday), [movementsToday]);

  const salesStats = useMemo(() => {
    const salesAccounts = ['ventas', 'fiesta', 'estancias', 'recargas'];
    let salesTotal = 0;
    let salesCount = 0;
    let lastSaleAmt = 0;
    
    const sortedMovs = [...movementsToday].sort((a, b) => b.createdAt - a.createdAt);
    
    movementsToday.forEach(m => {
      const aid = (m.accountId || '').toLowerCase().trim();
      if (salesAccounts.includes(aid)) {
        const direction = (m as any).direction || (m.type === 'INCOME' || (m.type as any) === 'INGRESO' ? 'IN' : 'OUT');
        if (direction === 'IN') {
          salesTotal += Number(m.amount) || 0;
          salesCount++;
        }
      }
    });

    const lastSaleMov = sortedMovs.find(m => {
      const aid = (m.accountId || '').toLowerCase().trim();
      const direction = (m as any).direction || (m.type === 'INCOME' || (m.type as any) === 'INGRESO' ? 'IN' : 'OUT');
      return salesAccounts.includes(aid) && direction === 'IN';
    });
    
    if (lastSaleMov) {
      lastSaleAmt = Number(lastSaleMov.amount) || 0;
    }

    return {
      total: salesTotal,
      count: salesCount,
      lastAmount: lastSaleAmt
    };
  }, [movementsToday]);

  // Opción 3: Relación de Gastos Operativos a Ventas/Ingresos de Hoy
  const relacionGastosIngresos = useMemo(() => {
    if (totals.income === 0) return 0;
    return (totals.expense / totals.income) * 100;
  }, [totals]);

  // Opción 4: Contribución de Ventas por Categoría (Centro de Utilidad) de Hoy
  const categorySales = useMemo(() => {
    const salesAccounts = ['ventas', 'fiesta', 'estancias', 'recargas'];
    const map: Record<string, number> = {
      ventas: 0,
      fiesta: 0,
      estancias: 0,
      recargas: 0,
    };
    
    let totalSales = 0;
    
    movementsToday.forEach(m => {
      const aid = (m.accountId || '').toLowerCase().trim();
      if (salesAccounts.includes(aid)) {
        const direction = (m as any).direction || (m.type === 'INCOME' || (m.type as any) === 'INGRESO' ? 'IN' : 'OUT');
        if (direction === 'IN') {
          const amt = Number(m.amount) || 0;
          map[aid] = (map[aid] || 0) + amt;
          totalSales += amt;
        }
      }
    });

    const labelMap: Record<string, string> = {
      ventas: 'Abarrotes',
      fiesta: 'Fiesta',
      estancias: 'Estancias',
      recargas: 'Recargas'
    };

    const colorMap: Record<string, string> = {
      ventas: 'bg-emerald-500',
      fiesta: 'bg-purple-500',
      estancias: 'bg-blue-500',
      recargas: 'bg-amber-500'
    };

    const textColorMap: Record<string, string> = {
      ventas: 'text-emerald-600 dark:text-emerald-400',
      fiesta: 'text-purple-600 dark:text-purple-400',
      estancias: 'text-blue-600 dark:text-blue-400',
      recargas: 'text-amber-600 dark:text-amber-400'
    };

    return Object.entries(map).map(([key, val]) => {
      const percentage = totalSales > 0 ? (val / totalSales) * 100 : 0;
      return {
        key,
        label: labelMap[key] || key,
        amount: val,
        percentage,
        color: colorMap[key] || 'bg-slate-500',
        textColor: textColorMap[key] || 'text-slate-600 dark:text-slate-400'
      };
    }).sort((a, b) => b.amount - a.amount);
  }, [movementsToday]);
  
  const rubrics = useMemo(() => {
    return dashboardConfig.performanceAccounts.map(id => {
      const acc = AccountResolver.getAccount(id);
      return { id, label: acc?.name || id };
    });
  }, [dashboardConfig.performanceAccounts]);

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
    <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-white antialiased min-h-screen relative pb-32">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      <header className="sticky top-0 z-30 w-full px-6 pt-12 pb-4 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-xl border-b border-slate-200 dark:border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 rounded-full hover:bg-slate-200 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300 transition-colors">
              <span className="material-symbols-outlined text-2xl">menu</span>
            </button>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-primary dark:text-blue-400 mb-0.5">Operación Central</p>
              <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">Hola, {profile?.displayName?.split(' ')[0] || 'Admin'}</h1>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setIsCustomizerOpen(true)}
              className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-blue-400 transition-all active:scale-90"
              title="Personalizar Dashboard"
            >
              <span className="material-symbols-outlined text-2xl">dashboard_customize</span>
            </button>
            <NotificationBell />
            <ProfileMenu />
          </div>
        </div>
      </header>
      
      <main className="flex flex-col w-full max-w-md mx-auto px-6 space-y-7 mt-6">
        
        {isCustomizerOpen && <DashboardCustomizer isOpen={isCustomizerOpen} onClose={() => setIsCustomizerOpen(false)} />}
        {isImpactModalOpen && <InventoryImpactModal isOpen={isImpactModalOpen} onClose={() => setIsImpactModalOpen(false)} />}

        {/* SELECTOR DE RANGO DE FECHAS GLOBAL */}
        <section className="space-y-3 animate-in fade-in duration-300">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <span className="material-symbols-outlined text-base">calendar_today</span>
              <p className="text-[10px] font-black uppercase tracking-tight">Periodo de Análisis</p>
            </div>
            <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400">
              {dateRangeFormatted}
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none -mx-2 px-2">
            {[
              { type: 'hoy', label: 'Hoy' },
              { type: 'semana', label: 'Semana' },
              { type: 'mes', label: 'Mes' },
              { type: 'anio', label: 'Año' },
              { type: 'custom', label: 'Personalizado' }
            ].map((p) => (
              <button
                key={p.type}
                onClick={() => setPeriodType(p.type as DashboardPeriodType)}
                className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider transition-all duration-200 shrink-0 select-none ${
                  periodType === p.type
                    ? 'bg-primary text-white shadow-md shadow-primary/10 dark:bg-blue-500 dark:shadow-blue-500/10'
                    : 'bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {periodType === 'custom' && (
            <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/5 rounded-[1.5rem] p-4 flex flex-col gap-3 animate-in slide-in-from-top-2 duration-250">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Fecha Inicio</label>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-primary dark:focus:border-blue-500 text-slate-800 dark:text-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Fecha Fin</label>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-primary dark:focus:border-blue-500 text-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>
            </div>
          )}
        </section>

        {/* COMPONENTE VISUAL: FLUJO DE CAJA NETO DEL DÍA */}
        <section className="animate-in fade-in duration-300">
          <div id="flujo-caja-neto-card" className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/5 rounded-[2rem] p-6 shadow-md relative overflow-hidden">
            <div className="relative z-10 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-slate-500 dark:text-slate-400 text-lg">account_balance</span>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Flujo de Caja Neto {periodLabel}</p>
                </div>
                <span className={`text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest ${
                  totals.balance >= 0 
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
                    : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                }`}>
                  {totals.balance >= 0 ? 'Superávit' : 'Déficit'}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h2 className={`text-3xl sm:text-4xl font-black font-mono tracking-tighter select-all leading-none break-all ${
                    totals.balance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                  }`}>
                    {loading ? '...' : (totals.balance >= 0 ? '+' : '') + formatMXN(totals.balance)}
                  </h2>
                  <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-tight">Entradas contables menos salidas</p>
                </div>
                <div className="flex flex-col text-left sm:text-right shrink-0 min-w-0">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-tight">Desglose rápido</span>
                  <span className="text-[10px] font-mono font-bold tracking-tight text-slate-700 dark:text-slate-300 break-all">
                    <span className="text-emerald-600 dark:text-emerald-400">+{formatMXN(totals.income)}</span>
                    <span className="text-slate-400 mx-1">/</span>
                    <span className="text-rose-600 dark:text-rose-400">-{formatMXN(totals.expense)}</span>
                  </span>
                </div>
              </div>

              {/* Barra de progreso / balance visual del flujo de caja (Entradas vs Salidas) */}
              {!loading && (totals.income > 0 || totals.expense > 0) && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between text-[8px] font-black text-slate-400 uppercase tracking-widest">
                    <span className="text-emerald-600 dark:text-[#34d399]">Entradas ({((totals.income / (totals.income + totals.expense || 1)) * 100).toFixed(0)}%)</span>
                    <span className="text-rose-600 dark:text-rose-400">Salidas ({((totals.expense / (totals.income + totals.expense || 1)) * 100).toFixed(0)}%)</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden flex">
                    <div 
                      className="bg-emerald-500 h-full transition-all duration-500" 
                      style={{ width: `${(totals.income / (totals.income + totals.expense || 1)) * 100}%` }}
                    />
                    <div 
                      className="bg-rose-500 h-full transition-all duration-500" 
                      style={{ width: `${(totals.expense / (totals.income + totals.expense || 1)) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
            
            {/* Fondo geométrico sutil */}
            <div className={`absolute -right-8 -bottom-8 size-24 rounded-full blur-2xl pointer-events-none opacity-20 ${
              totals.balance >= 0 ? 'bg-[#10b981]' : 'bg-rose-500'
            }`} />
          </div>
        </section>

        {/* SECCIÓN: ANÁLISIS Y RENDIMIENTO DEL NEGOCIO */}
        <section className="animate-in fade-in duration-300 space-y-4">
          {/* Opción 3: Relación de Gastos Operativos */}
          <div id="metric-eficiencia-caja" className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/5 rounded-[2rem] p-6 shadow-sm relative overflow-hidden flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 mb-1.5">
                <span className="material-symbols-outlined text-base">percent</span>
                <p className="text-[9px] font-black uppercase tracking-tight">Relación Gastos/Ingresos {periodLabel}</p>
              </div>
              <h3 className="text-2xl font-black font-mono tracking-tight text-amber-600 dark:text-[#fbe567] break-all leading-none">
                {loading ? '...' : `${relacionGastosIngresos.toFixed(1)}%`}
              </h3>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tight">
                De los ingresos del periodo
              </p>
              <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-1">
                {formatMXN(totals.expense)} / {formatMXN(totals.income)}
              </p>
            </div>
            <div className="absolute -right-4 -bottom-4 size-12 rounded-full bg-amber-500/5 blur-lg pointer-events-none" />
          </div>

          {/* Opción 4: Contribución de Ventas por Categoría (Centro de Utilidad) */}
          <div id="metric-participacion-categorias" className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/5 rounded-[2rem] p-6 shadow-sm relative overflow-hidden">
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 mb-4">
              <span className="material-symbols-outlined text-base">pie_chart</span>
              <p className="text-[9px] font-black uppercase tracking-tight">Ventas por Categoría {periodLabel}</p>
            </div>
            
            <div className="space-y-3.5">
              {categorySales.map((cat) => (
                <div 
                  key={cat.key} 
                  onClick={() => handleCategoryClick(cat.key)}
                  className="group/item space-y-1 cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 p-2 -mx-2 rounded-xl transition-all active:scale-[0.99]"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-tight flex items-center gap-1.5 group-hover/item:text-primary dark:group-hover/item:text-blue-400 transition-colors">
                      <span className={`size-1.5 rounded-full ${cat.color}`} />
                      {cat.label}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400">
                      <span className={`${cat.textColor} font-extrabold mr-1.5`}>{formatMXN(cat.amount)}</span>
                      ({cat.percentage.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                    <div 
                      className={`${cat.color} h-full rounded-full transition-all duration-500`} 
                      style={{ width: `${cat.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
              {categorySales.every(c => c.amount === 0) && (
                <p className="text-[9px] font-bold text-slate-400 text-center uppercase py-2">
                  No hay ventas registradas en este periodo todavía
                </p>
              )}
            </div>
          </div>
        </section>
        
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

        {dashboardConfig.showLogistics && (
          <section className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-[10px] font-black uppercase tracking-tight text-slate-500">Logística</h2>
              <button 
                type="button"
                onClick={() => setIsImpactModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 hover:bg-primary/20 text-primary dark:text-blue-400 dark:bg-blue-400/10 dark:hover:bg-blue-400/20 transition-all text-[8px] font-black uppercase tracking-tight cursor-pointer"
              >
                <span className="material-symbols-outlined text-[10px] font-black">analytics</span>
                Analizar Impacto
              </button>
            </div>
            <div 
              onClick={() => invAccount && navigate(`/account/history/${invAccount.id}`)}
              className="p-6 bg-white dark:bg-white/5 rounded-[2rem] border border-slate-200 dark:border-white/5 active:scale-[0.98] transition-all cursor-pointer relative overflow-hidden group min-w-0"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="size-8 rounded-xl bg-primary/10 text-primary dark:text-blue-400 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-lg">inventory_2</span>
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-tight text-slate-500 dark:text-slate-400 truncate">Valor en Mercancía</span>
                </div>
                <div className={`px-3 py-1 rounded-full text-[8px] font-black tracking-tight text-white shadow-lg shrink-0 ${inventoryStatus.color}`}>
                  {inventoryStatus.label}
                </div>
              </div>
              
              <p className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white mb-4 break-all">
                {invAccount ? formatMXN(invAccount.balance) : '...'}
              </p>
  
              {invAccount && (invAccount.inventoryMin !== null || invAccount.inventoryMax !== null) && (
                <div className="space-y-3">
                  <div className="w-full h-1.5 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-1000 ease-out rounded-full ${
                        inventoryStatus.status === 'LOW' ? 'bg-amber-500' :
                        inventoryStatus.status === 'HIGH' ? 'bg-rose-500' :
                        'bg-emerald-500'
                      }`}
                      style={{ width: `${inventoryStatus.progress * 100}%` }}
                    ></div>
                  </div>
                  <p className="text-[8px] font-bold text-slate-500 uppercase tracking-tight text-center break-all">
                    Rango: {invAccount.inventoryMin ? formatMXN(invAccount.inventoryMin) : '$0'} – {invAccount.inventoryMax ? formatMXN(invAccount.inventoryMax) : 'Max'}
                  </p>
                </div>
              )}
            </div>
          </section>
        )}


      </main>
      <BottomNav />
    </div>
  );
};

export default DashboardScreen;
