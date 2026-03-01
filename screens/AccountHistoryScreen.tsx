
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { 
  collection, 
  query, 
  onSnapshot, 
  orderBy, 
  doc, 
  getDoc,
  where,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { AccountingAccount, AccountMovement } from '../types';
import BottomNav from '../components/BottomNav';

const AccountHistoryScreen: React.FC = () => {
  const { accountId: docId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [account, setAccount] = useState<AccountingAccount | null>(null);
  const [movements, setMovements] = useState<AccountMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMovement, setSelectedMovement] = useState<AccountMovement | null>(null);
  
  const [currentDate, setCurrentDate] = useState(new Date());

  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  const dateRange = useMemo(() => {
    const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end };
  }, [currentDate]);

  useEffect(() => {
    if (!user || !docId) return;
    setLoading(true);

    getDoc(doc(db, "users", user.uid, "accounts", docId)).then(snap => {
      if (snap.exists()) {
        const data = snap.data();
        setAccount({ 
          id: snap.id, 
          name: String(data.name || ''),
          type: data.type as any,
          balance: Number(data.balance || 0),
          accountId: String(data.accountId || '')
        } as AccountingAccount);
      }
    });

    const q = query(
      collection(db, "users", user.uid, "accounts", docId, "movements"),
      where("createdAt", ">=", Timestamp.fromDate(dateRange.start)),
      where("createdAt", "<=", Timestamp.fromDate(dateRange.end)),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, (snap) => {
      const allMovs = snap.docs.map(d => {
        const data = d.data();
        // Convertimos a tipos primitivos para evitar errores circulares
        return {
          id: d.id,
          uid: user.uid,
          accountId: String(data.accountId || ''),
          amount: Number(data.amount || 0),
          type: data.type,
          conceptTitle: String(data.conceptTitle || ''),
          conceptSubtitle: String(data.conceptSubtitle || ''),
          source: String(data.source || ''),
          status: String(data.status || 'ACTIVE'),
          createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : null,
          notes: String(data.notes || '')
        } as any;
      });
      setMovements(allMovs);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching movements:", error);
      setLoading(false);
    });

    return () => unsub();
  }, [user?.uid, docId, dateRange]);

  const activeMovements = useMemo(() => {
    return movements.filter(m => m.status === 'ACTIVE' || !m.status);
  }, [movements]);

  const totalPeriodValue = useMemo(() => {
    return activeMovements.reduce((sum, m) => {
      const isIncome = m.type === 'INCOME' || (m.type as any) === 'INGRESO';
      return sum + (isIncome ? m.amount : -m.amount);
    }, 0);
  }, [activeMovements]);

  const changePeriod = (dir: number) => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + dir, 1));
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);

  const formatDate = (ts: any) => {
    if (!ts) return '---';
    const date = typeof ts === 'number' ? new Date(ts) : (ts.toDate ? ts.toDate() : new Date(ts));
    return date.toLocaleString('es-MX', { 
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="relative flex flex-col h-screen w-full max-w-md mx-auto bg-background-dark font-display antialiased overflow-hidden">
      <header className="sticky top-0 z-50 bg-background-dark/95 backdrop-blur-md pt-12 px-4 pb-4 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/finance-accounts')} className="p-2 -ml-2 text-white active:scale-90 transition-transform">
              <span className="material-symbols-outlined text-[26px]">arrow_back</span>
            </button>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-white truncate max-w-[180px]">{account?.name || 'Cargando...'}</h1>
              <p className="text-[9px] font-black uppercase text-blue-400 tracking-widest mt-0.5">Historial Operativo</p>
            </div>
          </div>
          <button onClick={() => navigate(`/account/add-movement/${docId}`)} className="p-2 text-blue-400 active:scale-90 transition-transform">
            <span className="material-symbols-outlined text-[28px]">add_circle</span>
          </button>
        </div>
      </header>

      <div className="flex items-center justify-between py-3 px-6 bg-[#111827] border-b border-white/5">
        <button onClick={() => changePeriod(-1)} className="p-1 text-slate-500 active:text-white transition-colors"><span className="material-symbols-outlined">chevron_left</span></button>
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">{months[currentDate.getMonth()]} {currentDate.getFullYear()}</span>
        <button onClick={() => changePeriod(1)} className="p-1 text-slate-500 active:text-white transition-colors"><span className="material-symbols-outlined">chevron_right</span></button>
      </div>

      <div className="bg-background-dark px-6 py-6 border-b border-white/5 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-0.5">Acumulado del Mes</p>
          <p className={`text-3xl font-black ${totalPeriodValue >= 0 ? 'text-white' : 'text-red-400'} tracking-tighter`}>{formatCurrency(totalPeriodValue)}</p>
        </div>
        <div className={`size-12 rounded-2xl flex items-center justify-center ${totalPeriodValue >= 0 ? 'bg-blue-500/10 text-blue-400' : 'bg-rose-500/10 text-rose-400'}`}><span className="material-symbols-outlined text-2xl">{totalPeriodValue >= 0 ? 'account_balance_wallet' : 'trending_down'}</span></div>
      </div>

      <main className="flex-1 overflow-y-auto no-scrollbar pb-32">
        {loading ? (
          <div className="p-20 flex justify-center"><span className="material-symbols-outlined animate-spin text-slate-600 text-3xl">sync</span></div>
        ) : activeMovements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center px-10 space-y-4 opacity-30"><span className="material-symbols-outlined text-5xl">history_toggle_off</span><p className="text-xs font-black uppercase tracking-widest">Sin registros este periodo</p></div>
        ) : (
          <div className="divide-y divide-white/5">
            {activeMovements.map(m => (
              <div key={m.id} className="flex items-center px-5 py-4 gap-4 active:bg-white/5 transition-all group overflow-hidden">
                <div onClick={() => setSelectedMovement(m)} className="flex-1 min-w-0 flex flex-col justify-center cursor-pointer">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-black text-slate-200 uppercase truncate leading-tight flex-1">{m.conceptTitle || 'MOVIMIENTO'}</span>
                    <span className={`text-[14px] font-black shrink-0 ${(m.type === 'INCOME' || (m.type as any) === 'INGRESO') ? 'text-blue-400' : 'text-red-400'}`}>{(m.type === 'INCOME' || (m.type as any) === 'INGRESO') ? '+' : '-'} {formatCurrency(m.amount)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight truncate flex-1">{m.conceptSubtitle || m.source}</span>
                    <span className="text-[9px] font-black text-slate-600 uppercase shrink-0">{m.createdAt ? new Date(m.createdAt).toLocaleDateString('es-MX', {day: '2-digit', month: 'short'}) : ''}</span>
                  </div>
                </div>
                <button onClick={() => navigate(`/account/edit-movement/${docId}/${m.id}`)} className="size-10 rounded-xl bg-white/5 text-slate-400 hover:text-blue-400 active:scale-90 transition-all flex items-center justify-center shrink-0 border border-white/5"><span className="material-symbols-outlined text-[20px]">edit</span></button>
              </div>
            ))}
          </div>
        )}
      </main>

      {selectedMovement && (
        <div className="fixed inset-0 z-[200] bg-[#0a0f1d] flex flex-col font-display animate-in fade-in duration-300">
          <header className="pt-12 px-6 pb-3 flex justify-between items-center border-b border-white/5 bg-[#0a0f1d]">
            <button onClick={() => setSelectedMovement(null)} className="p-1 -ml-1 text-slate-400 active:text-white active:scale-90 transition-all"><span className="material-symbols-outlined text-[28px]">arrow_back</span></button>
            <h1 className="text-sm font-black tracking-[0.15em] uppercase text-white">Ficha de Operación</h1><div className="w-8"></div>
          </header>
          <main className="flex-1 p-6 space-y-8 flex flex-col overflow-hidden">
            <div className="flex-1 space-y-8">
              <div className="bg-blue-500/5 p-6 rounded-[2.5rem] border border-blue-500/10 text-center space-y-1">
                <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.25em] mb-3">Concepto Principal</p>
                <h2 className="text-2xl font-black text-white uppercase leading-tight mb-2">{selectedMovement.conceptTitle}</h2>
                <div className="h-px w-12 bg-blue-500/30 mx-auto mb-4"></div>
                <p className={`text-5xl font-black tracking-tighter ${(selectedMovement.type === 'INCOME' || (selectedMovement.type as any) === 'INGRESO') ? 'text-emerald-400' : 'text-rose-400'}`}>{(selectedMovement.type === 'INCOME' || (selectedMovement.type as any) === 'INGRESO') ? '+' : '-'} {formatCurrency(selectedMovement.amount)}</p>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2">Monto Neto de Operación</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-5 bg-white/5 rounded-2xl border border-white/5 space-y-1.5"><p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Referencia</p><p className="text-[13px] font-bold text-slate-200 leading-tight">{selectedMovement.conceptSubtitle || 'Registro Manual'}</p></div>
                <div className="p-5 bg-white/5 rounded-2xl border border-white/5 space-y-1.5"><p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Canal</p><p className="text-[13px] font-bold text-blue-400 uppercase">{selectedMovement.source || 'Manual'}</p></div>
                <div className="col-span-2 p-5 bg-white/5 rounded-2xl border border-white/5 flex justify-between items-center"><div className="flex items-center gap-3"><span className="material-symbols-outlined text-slate-500 text-xl">calendar_month</span><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha y Hora</p></div><span className="text-xs font-bold text-slate-200">{formatDate(selectedMovement.createdAt)}</span></div>
              </div>
              {selectedMovement.notes && <div className="space-y-3"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Observaciones</label><div className="p-5 bg-white/5 rounded-2xl border border-white/5 italic text-[14px] text-slate-300 leading-relaxed shadow-inner">"{selectedMovement.notes}"</div></div>}
            </div>
            <div className="pt-4 pb-8 space-y-3">
              <button onClick={() => { const m = selectedMovement; setSelectedMovement(null); navigate(`/account/edit-movement/${docId}/${m.id}`); }} className="w-full py-5 bg-blue-500 text-white font-black rounded-2xl shadow-xl shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-3 text-xs uppercase tracking-widest"><span className="material-symbols-outlined text-xl">edit</span> Editar este registro</button>
              <button onClick={() => setSelectedMovement(null)} className="w-full py-4 bg-white/5 text-slate-400 font-black rounded-2xl active:scale-95 transition-all text-xs uppercase tracking-widest">Regresar al Historial</button>
            </div>
          </main>
        </div>
      )}
      <BottomNav />
    </div>
  );
};

export default AccountHistoryScreen;
