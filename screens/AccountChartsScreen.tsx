
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { 
  collection, 
  query, 
  where,
  getDocs, 
  orderBy, 
  doc, 
  getDoc,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { AccountingAccount, AccountMovement } from '../types';
import { AccountingService } from '../services/AccountingService';

const AccountChartsScreen: React.FC = () => {
  const { accountId: docId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [account, setAccount] = useState<AccountingAccount | null>(null);
  const [movements, setMovements] = useState<AccountMovement[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  const dateRange = useMemo(() => {
    const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end };
  }, [currentDate]);

  useEffect(() => {
    if (!user || !docId) return;
    setLoading(true);

    const fetchData = async () => {
      try {
        const accSnap = await getDoc(doc(db, "users", user.uid, "accounts", docId));
        if (accSnap.exists()) {
          const accData = accSnap.data() as AccountingAccount;
          setAccount({ id: accSnap.id, ...accData });

          const q = query(
            collection(db, "users", user.uid, "accounts", docId, "movements"),
            where("effectiveAt", ">=", Timestamp.fromDate(dateRange.start)),
            where("effectiveAt", "<=", Timestamp.fromDate(dateRange.end)),
            orderBy("effectiveAt", "asc")
          );
          const movSnap = await getDocs(q);
          setMovements(movSnap.docs.map(d => ({ id: d.id, ...d.data() } as AccountMovement)).filter(m => m.status === 'ACTIVE' || !m.status));
        }
      } catch (e) {
        console.error("Error fetching charts data:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, docId, dateRange]);

  const dailyHistory = useMemo(() => {
    return AccountingService.getDailyHistory(movements, dateRange.start, dateRange.end);
  }, [movements, dateRange]);

  const totals = useMemo(() => AccountingService.calculateTotals(movements), [movements]);

  const selectedMovements = useMemo(() => {
    if (!selectedDay) return [];
    return movements.filter(m => {
      const mDate = m.effectiveAt?.toDate().toISOString().split('T')[0];
      return mDate === selectedDay;
    });
  }, [movements, selectedDay]);

  const changePeriod = (dir: number) => {
    setSelectedDay(null);
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + dir, 1));
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('es-MX', {style:'currency', currency:'MXN'}).format(val);

  const BarChart = () => {
    const maxVal = Math.max(...dailyHistory.flatMap(d => [d.income, d.expense]), 100);
    return (
      <div className="flex items-end justify-between h-48 w-full gap-1.5 mt-4">
        {dailyHistory.map((d, i) => {
          const isSelected = selectedDay === d.date;
          return (
            <div 
              key={i} 
              onClick={() => setSelectedDay(isSelected ? null : d.date)}
              className={`flex-1 flex flex-col items-center h-full transition-all cursor-pointer ${isSelected ? 'opacity-100' : 'opacity-60 hover:opacity-100'}`}
            >
              <div className={`flex items-end gap-[1px] w-full h-full p-[1px] rounded-t-lg ${isSelected ? 'bg-primary/20' : ''}`}>
                <div 
                  className={`flex-1 bg-blue-500 rounded-t-[2px] transition-all duration-500`} 
                  style={{ height: `${(d.income / maxVal) * 100}%` }}
                ></div>
                <div 
                  className={`flex-1 bg-red-500 rounded-t-[2px] transition-all duration-500`} 
                  style={{ height: `${(d.expense / maxVal) * 100}%` }}
                ></div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (loading) return <div className="min-h-screen bg-[#0f172a] flex items-center justify-center"><span className="material-symbols-outlined animate-spin text-primary">sync</span></div>;

  return (
    <div className="relative flex flex-col h-screen w-full max-w-md mx-auto bg-[#0f172a] font-display antialiased overflow-hidden">
      <header className="pt-12 px-5 pb-4 border-b border-white/5 flex items-center justify-between bg-[#0f172a]/95 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-1 text-white">
            <span className="material-symbols-outlined text-[28px]">arrow_back</span>
          </button>
          <div>
            <h1 className="text-lg font-bold text-white truncate max-w-[200px]">{account?.name}</h1>
            <p className="text-[9px] font-black uppercase tracking-widest text-primary">Análisis de Flujo</p>
          </div>
        </div>
      </header>

      <div className="flex items-center justify-between py-6 px-7 bg-[#111827] border-b border-white/5">
        <button onClick={() => changePeriod(-1)} className="p-2 text-slate-500 active:text-white"><span className="material-symbols-outlined">chevron_left</span></button>
        <div className="text-center">
          <span className="text-sm font-black uppercase tracking-[0.2em] text-white">{months[currentDate.getMonth()]} {currentDate.getFullYear()}</span>
          <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">Acumulado Mes: {formatCurrency(totals.balance)}</p>
        </div>
        <button onClick={() => changePeriod(1)} className="p-2 text-slate-500 active:text-white"><span className="material-symbols-outlined">chevron_right</span></button>
      </div>

      <main className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-10">
        <section className="animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Volumen Diario</h3>
            <div className="flex gap-3">
              <div className="flex items-center gap-1"><div className="size-2 bg-blue-500 rounded-full"></div><span className="text-[8px] font-black text-slate-500 uppercase">Ingresos</span></div>
              <div className="flex items-center gap-1"><div className="size-2 bg-red-500 rounded-full"></div><span className="text-[8px] font-black text-slate-500 uppercase">Egresos</span></div>
            </div>
          </div>
          <div className="bg-white/5 p-6 rounded-[2.5rem] border border-white/5 shadow-inner">
            {movements.length > 0 ? (
              <>
                <BarChart />
                <div className="flex justify-between mt-4">
                  <span className="text-[8px] font-black text-slate-600 uppercase">01 {months[currentDate.getMonth()]}</span>
                  <p className="text-[9px] font-black text-primary uppercase">Toca una barra para filtrar</p>
                  <span className="text-[8px] font-black text-slate-600 uppercase">{dailyHistory.length} {months[currentDate.getMonth()]}</span>
                </div>
              </>
            ) : (
              <div className="h-48 flex flex-col items-center justify-center space-y-3">
                <span className="material-symbols-outlined text-4xl text-slate-700">query_stats</span>
                <p className="text-xs text-slate-600 font-black uppercase tracking-widest">Sin datos este mes</p>
              </div>
            )}
          </div>
        </section>

        {/* Detalle Dinámico */}
        <section className="pb-32 animate-in slide-in-from-bottom-6 duration-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
              {selectedDay ? `Movimientos: ${new Date(selectedDay + 'T00:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'long' })}` : 'Resumen del Periodo'}
            </h3>
            {selectedDay && (
              <button onClick={() => setSelectedDay(null)} className="text-[9px] font-black text-primary uppercase border-b border-primary/30">Ver todo</button>
            )}
          </div>

          <div className="space-y-4">
            {selectedDay ? (
              selectedMovements.length > 0 ? (
                selectedMovements.map((m, i) => (
                  <div 
                    key={m.id || i}
                    onClick={() => navigate(`/account/history/${docId}`)}
                    className="p-5 bg-white/5 rounded-3xl border border-white/5 flex items-center justify-between active:bg-white/10 transition-colors cursor-pointer group"
                  >
                    <div className="flex-1 pr-4">
                      <p className="text-[13px] font-black text-slate-200 uppercase group-hover:text-primary transition-colors">{m.conceptTitle}</p>
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">{m.conceptSubtitle || m.source}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-[15px] font-black ${(m.type === 'INCOME' || (m.type as any) === 'INGRESO') ? 'text-blue-400' : 'text-red-400'}`}>
                        {(m.type === 'INCOME' || (m.type as any) === 'INGRESO') ? '+' : '-'} {formatCurrency(m.amount)}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-10 text-center bg-white/5 rounded-3xl border border-dashed border-white/10 opacity-40">
                  <p className="text-[10px] font-black uppercase tracking-widest">Sin movimientos este día</p>
                </div>
              )
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="p-6 bg-blue-500/10 border border-blue-500/20 rounded-[2rem] flex flex-col justify-between h-32">
                  <span className="material-symbols-outlined text-blue-400 text-xl">trending_up</span>
                  <div>
                    <p className="text-[9px] font-black text-blue-400 uppercase mb-1">Total Ingresos</p>
                    <p className="text-xl font-black text-white">{formatCurrency(totals.income)}</p>
                  </div>
                </div>
                <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-[2rem] flex flex-col justify-between h-32">
                  <span className="material-symbols-outlined text-red-400 text-xl">trending_down</span>
                  <div>
                    <p className="text-[9px] font-black text-red-400 uppercase mb-1">Total Egresos</p>
                    <p className="text-xl font-black text-white">{formatCurrency(totals.expense)}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

export default AccountChartsScreen;
