
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { 
  collection, 
  query, 
  onSnapshot, 
  orderBy, 
  doc, 
  getDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { AccountingAccount, AccountMovement } from '../types';

const AccountHistoryScreen: React.FC = () => {
  const { accountId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [account, setAccount] = useState<AccountingAccount | null>(null);
  const [movements, setMovements] = useState<AccountMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [currentPeriod, setCurrentPeriod] = useState({
    month: new Date().getMonth(),
    year: new Date().getFullYear()
  });

  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  useEffect(() => {
    if (!user || !accountId) return;
    setLoading(true);

    // 1. Cargar datos de la cuenta
    const fetchAccount = async () => {
      try {
        const snap = await getDoc(doc(db, "users", user.uid, "accounts", accountId));
        if (snap.exists()) setAccount(snap.data() as AccountingAccount);
      } catch (e) { console.error(e); }
    };
    fetchAccount();

    // 2. Escuchar movimientos
    const q = query(
      collection(db, "users", user.uid, "accounts", accountId, "movements"),
      orderBy("ts", "desc")
    );

    const unsub = onSnapshot(q, (snap) => {
      const allMovs = snap.docs.map(d => ({ id: d.id, ...d.data() } as AccountMovement));
      
      // Filtrar por periodo seleccionado en memoria (o podrías hacerlo en el query)
      const filtered = allMovs.filter(m => {
        const date = m.ts?.toDate() || new Date();
        return date.getMonth() === currentPeriod.month && date.getFullYear() === currentPeriod.year;
      });

      setMovements(filtered);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setError("Error al cargar movimientos.");
      setLoading(false);
    });

    return () => unsub();
  }, [user, accountId, currentPeriod]);

  const changePeriod = (dir: number) => {
    let nextMonth = currentPeriod.month + dir;
    let nextYear = currentPeriod.year;
    if (nextMonth < 0) { nextMonth = 11; nextYear--; }
    if (nextMonth > 11) { nextMonth = 0; nextYear++; }
    setCurrentPeriod({ month: nextMonth, year: nextYear });
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
  };

  // Cálculos del periodo
  const depositTotal = movements.filter(m => m.direction === 'in').reduce((s, m) => s + m.amount, 0);
  const withdrawTotal = movements.filter(m => m.direction === 'out').reduce((s, m) => s + m.amount, 0);
  const balancePeriod = depositTotal - withdrawTotal;
  
  // Agrupar movimientos por día
  const groupedMovements: { [key: string]: AccountMovement[] } = {};
  movements.forEach(m => {
    const date = m.ts?.toDate() || new Date();
    const key = date.toISOString().split('T')[0];
    if (!groupedMovements[key]) groupedMovements[key] = [];
    groupedMovements[key].push(m);
  });

  const sortedDays = Object.keys(groupedMovements).sort((a, b) => b.localeCompare(a));

  const StatBox = ({ label, value, color }: { label: string, value: string, color: string }) => (
    <div className="flex flex-col items-center justify-center p-3 bg-white/5 rounded-2xl border border-white/5">
      <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-1">{label}</span>
      <span className={`text-sm font-bold ${color}`}>$ {value}</span>
    </div>
  );

  return (
    <div className="relative flex flex-col h-screen w-full max-w-md mx-auto bg-[#0f172a] font-display antialiased overflow-hidden">
      <header className="sticky top-0 z-50 bg-[#0f172a] pt-12 px-4 pb-4 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/finance-accounts')} className="p-1 text-white">
              <span className="material-symbols-outlined text-[28px]">arrow_back</span>
            </button>
            <h1 className="text-lg font-bold text-white truncate max-w-[150px]">{account?.name || 'Cargando...'}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => navigate(`/account/charts/${accountId}`)}
              className="p-2 text-primary"
            >
              <span className="material-symbols-outlined text-[24px]">bar_chart</span>
            </button>
            <button 
              onClick={() => navigate(`/account/edit/${accountId}`)}
              className="p-2 text-slate-400"
            >
              <span className="material-symbols-outlined text-[24px]">edit_note</span>
            </button>
          </div>
        </div>

        {/* Period Selector */}
        <div className="flex items-center justify-between mt-6 px-2">
          <button onClick={() => changePeriod(-1)} className="p-2 text-slate-400 hover:text-white transition-colors">
            <span className="material-symbols-outlined">chevron_left</span>
          </button>
          <div className="flex flex-col items-center">
            <span className="text-xs font-black uppercase tracking-[0.2em] text-white">
              {months[currentPeriod.month]} {currentPeriod.year}
            </span>
            <span className="text-[10px] font-bold text-slate-500 mt-0.5">
              01.{currentPeriod.month + 1 < 10 ? '0' : ''}{currentPeriod.month + 1}.{currentPeriod.year.toString().slice(-2)} ~ 
              31.{currentPeriod.month + 1 < 10 ? '0' : ''}{currentPeriod.month + 1}.{currentPeriod.year.toString().slice(-2)}
            </span>
          </div>
          <button onClick={() => changePeriod(1)} className="p-2 text-slate-400 hover:text-white transition-colors">
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto no-scrollbar">
        {/* Stats Summary */}
        <div className="grid grid-cols-2 gap-2 p-5 border-b border-white/5 bg-[#111827]">
          <StatBox label="Depósito" value={formatCurrency(depositTotal)} color="text-blue-400" />
          <StatBox label="Retiro" value={formatCurrency(withdrawTotal)} color="text-red-400" />
          <StatBox label="Balance" value={formatCurrency(balancePeriod)} color="text-white" />
          <StatBox label="Saldo Actual" value={formatCurrency(account?.balance || 0)} color="text-emerald-400" />
        </div>

        {loading ? (
          <div className="p-20 flex justify-center"><span className="material-symbols-outlined animate-spin text-slate-600">sync</span></div>
        ) : movements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 px-10 text-center space-y-4">
            <span className="material-symbols-outlined text-6xl text-slate-700">inventory</span>
            <p className="text-sm font-bold text-slate-500">Sin movimientos en este periodo.</p>
            <button onClick={() => navigate(`/account/add-movement/${accountId}`)} className="text-primary text-xs font-black uppercase tracking-widest bg-primary/10 px-6 py-2.5 rounded-full">Agregar ahora</button>
          </div>
        ) : (
          <div className="pb-32">
            {sortedDays.map(day => {
              const dayMovs = groupedMovements[day];
              const date = new Date(day + 'T12:00:00Z');
              const dayNum = date.getDate().toString().padStart(2, '0');
              const dayName = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'][date.getDay()];
              
              const dayIn = dayMovs.filter(m => m.direction === 'in').reduce((s, m) => s + m.amount, 0);
              const dayOut = dayMovs.filter(m => m.direction === 'out').reduce((s, m) => s + m.amount, 0);

              return (
                <div key={day} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="bg-[#0f172a] py-2 px-5 flex items-center justify-between border-b border-white/5">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-black text-slate-200">{dayNum}</span>
                      <div className="flex flex-col leading-none">
                        <span className="text-[10px] font-black uppercase text-primary tracking-widest">{dayName}</span>
                        <span className="text-[10px] font-bold text-slate-500 uppercase">{day.split('-').reverse().slice(0,2).join('.')}</span>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      {dayIn > 0 && <span className="text-[11px] font-black text-blue-400">+ {formatCurrency(dayIn)}</span>}
                      {dayOut > 0 && <span className="text-[11px] font-black text-red-400">- {formatCurrency(dayOut)}</span>}
                    </div>
                  </div>
                  
                  <div className="divide-y divide-white/5">
                    {dayMovs.map(m => (
                      <div key={m.id} className="px-5 py-4 flex items-center justify-between active:bg-white/5 transition-colors">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[13px] font-bold text-slate-300">{m.category}</span>
                          <span className="text-[11px] font-medium text-slate-500 italic max-w-[200px] truncate">{m.description}</span>
                          {m.fromAccountId && (
                            <div className="flex items-center gap-1 text-[9px] font-bold text-slate-600 uppercase">
                              <span className="material-symbols-outlined text-[12px]">sync_alt</span>
                              Traspaso
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end">
                          <span className={`text-[15px] font-black ${m.direction === 'in' ? 'text-blue-400' : 'text-red-400'}`}>
                            {m.direction === 'in' ? '' : '-'} {formatCurrency(m.amount)}
                          </span>
                          {m.balanceAfter !== undefined && (
                            <span className="text-[9px] font-bold text-slate-600">(${formatCurrency(m.balanceAfter)})</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* FAB */}
      <button 
        onClick={() => navigate(`/account/add-movement/${accountId}`)}
        className="fixed bottom-24 right-6 size-16 bg-primary text-white rounded-2xl shadow-2xl shadow-primary/30 flex items-center justify-center active:scale-90 transition-transform z-50"
      >
        <span className="material-symbols-outlined text-3xl">add</span>
      </button>
    </div>
  );
};

export default AccountHistoryScreen;
