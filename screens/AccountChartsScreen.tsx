
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { 
  collection, 
  query, 
  getDocs, 
  orderBy, 
  limit, 
  doc, 
  getDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { AccountingAccount } from '../types';

const AccountChartsScreen: React.FC = () => {
  const { accountId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [account, setAccount] = useState<AccountingAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPeriod, setCurrentPeriod] = useState({
    month: new Date().getMonth(),
    year: new Date().getFullYear()
  });

  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  // Mock data para las gráficas simulando últimos 6 meses
  const mockHistory = [
    { label: 'Ene', balance: 45000, in: 12000, out: 8000 },
    { label: 'Feb', balance: 48000, in: 15000, out: 12000 },
    { label: 'Mar', balance: 42000, in: 9000, out: 15000 },
    { label: 'Abr', balance: 52000, in: 22000, out: 12000 },
    { label: 'May', balance: 55000, in: 18000, out: 15000 },
    { label: 'Jun', balance: 58000, in: 20000, out: 17000 },
  ];

  useEffect(() => {
    if (!user || !accountId) return;
    const fetchAccount = async () => {
      try {
        const snap = await getDoc(doc(db, "users", user.uid, "accounts", accountId));
        if (snap.exists()) setAccount(snap.data() as AccountingAccount);
        setLoading(false);
      } catch (e) { console.error(e); }
    };
    fetchAccount();
  }, [user, accountId]);

  const changePeriod = (dir: number) => {
    let nextMonth = currentPeriod.month + dir;
    let nextYear = currentPeriod.year;
    if (nextMonth < 0) { nextMonth = 11; nextYear--; }
    if (nextMonth > 11) { nextMonth = 0; nextYear++; }
    setCurrentPeriod({ month: nextMonth, year: nextYear });
  };

  const LineChart = () => {
    const data = mockHistory.map(d => d.balance);
    const max = Math.max(...data) * 1.2;
    const points = data.map((val, i) => {
      const x = (i / 5) * 100;
      const y = 100 - (val / max) * 100;
      return `${x},${y}`;
    }).join(' ');

    return (
      <div className="relative h-44 w-full mt-6">
        <svg viewBox="0 0 100 100" className="h-full w-full" preserveAspectRatio="none">
          <polyline fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={points} />
          {data.map((val, i) => (
            <circle key={i} cx={(i / 5) * 100} cy={100 - (val / max) * 100} r="2" fill="#2563eb" />
          ))}
        </svg>
      </div>
    );
  };

  const BarChart = () => {
    const max = Math.max(...mockHistory.flatMap(d => [d.in, d.out])) * 1.2;
    return (
      <div className="flex items-end justify-between h-44 w-full gap-2 mt-6">
        {mockHistory.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div className="flex items-end gap-1 w-full h-full">
              <div className="flex-1 bg-blue-500 rounded-t-sm" style={{ height: `${(d.in / max) * 100}%` }}></div>
              <div className="flex-1 bg-red-500 rounded-t-sm" style={{ height: `${(d.out / max) * 100}%` }}></div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (loading) return <div className="min-h-screen bg-[#0f172a] flex items-center justify-center"><span className="material-symbols-outlined animate-spin text-primary">sync</span></div>;

  return (
    <div className="relative flex flex-col h-screen w-full max-w-md mx-auto bg-[#0f172a] font-display antialiased overflow-hidden">
      <header className="pt-12 px-5 pb-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-1 text-white">
            <span className="material-symbols-outlined text-[28px]">arrow_back</span>
          </button>
          <h1 className="text-lg font-bold text-white truncate max-w-[200px]">{account?.name}</h1>
        </div>
      </header>

      {/* Period Selector Reusable */}
      <div className="flex items-center justify-between py-6 px-7 bg-[#111827]">
        <button onClick={() => changePeriod(-1)} className="p-1 text-slate-500"><span className="material-symbols-outlined">chevron_left</span></button>
        <span className="text-xs font-black uppercase tracking-widest">{months[currentPeriod.month]} {currentPeriod.year}</span>
        <button onClick={() => changePeriod(1)} className="p-1 text-slate-500"><span className="material-symbols-outlined">chevron_right</span></button>
      </div>

      <main className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-10">
        <section>
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Evolución de Saldo</h3>
          <div className="bg-white/5 p-6 rounded-3xl border border-white/5">
            <LineChart />
            <div className="flex justify-between mt-4">
              {mockHistory.map((d, i) => <span key={i} className="text-[9px] font-bold text-slate-500">{d.label}</span>)}
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Depósitos vs Retiros</h3>
          <div className="bg-white/5 p-6 rounded-3xl border border-white/5">
            <div className="flex gap-4 mb-2">
              <div className="flex items-center gap-1"><div className="size-2 bg-blue-500 rounded-full"></div><span className="text-[9px] font-bold text-slate-500 uppercase">In</span></div>
              <div className="flex items-center gap-1"><div className="size-2 bg-red-500 rounded-full"></div><span className="text-[9px] font-bold text-slate-500 uppercase">Out</span></div>
            </div>
            <BarChart />
            <div className="flex justify-between mt-4">
              {mockHistory.map((d, i) => <span key={i} className="text-[9px] font-bold text-slate-500">{d.label}</span>)}
            </div>
          </div>
        </section>

        <section className="pb-10">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-3">Histórico Mensual</h3>
          <div className="bg-white/5 rounded-2xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/10 text-slate-500 uppercase font-black tracking-tighter">
                <tr>
                  <th className="p-3">Mes</th>
                  <th className="p-3 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-medium">
                {mockHistory.map((d, i) => (
                  <tr key={i}>
                    <td className="p-3 text-slate-300">{d.label} {currentPeriod.year}</td>
                    <td className="p-3 text-right text-blue-400">$ {d.balance.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
};

export default AccountChartsScreen;
