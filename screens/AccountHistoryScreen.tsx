
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
      if (snap.exists()) setAccount({ id: snap.id, ...snap.data() } as AccountingAccount);
    });

    const q = query(
      collection(db, "users", user.uid, "accounts", docId, "movements"),
      where("effectiveAt", ">=", Timestamp.fromDate(dateRange.start)),
      where("effectiveAt", "<=", Timestamp.fromDate(dateRange.end)),
      orderBy("effectiveAt", "desc")
    );

    const unsub = onSnapshot(q, (snap) => {
      const allMovs = snap.docs.map(d => ({ id: d.id, ...d.data() } as AccountMovement));
      setMovements(allMovs);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching movements:", error);
      setLoading(false);
    });

    return () => unsub();
  }, [user, docId, dateRange]);

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
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleString('es-MX', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="relative flex flex-col h-screen w-full max-w-md mx-auto bg-background-dark font-display antialiased overflow-hidden">
      <header className="sticky top-0 z-50 bg-background-dark/95 backdrop-blur-md pt-12 px-4 pb-4 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/finance-accounts')} className="p-1 text-white active:scale-90 transition-transform">
              <span className="material-symbols-outlined text-[28px]">arrow_back</span>
            </button>
            <div>
              <h1 className="text-lg font-bold text-white truncate max-w-[150px]">{account?.name || 'Cargando...'}</h1>
              <p className="text-[9px] font-black uppercase text-primary tracking-widest leading-none mt-0.5">Historial Contable</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => navigate(`/account/add-movement/${docId}`)} className="p-2 text-primary active:scale-90 transition-transform">
              <span className="material-symbols-outlined text-[28px]">add_circle</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex items-center justify-between py-4 px-6 bg-[#111827] border-b border-white/5">
        <button onClick={() => changePeriod(-1)} className="p-1 text-slate-500 active:text-white transition-colors">
          <span className="material-symbols-outlined">chevron_left</span>
        </button>
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">
          {months[currentDate.getMonth()]} {currentDate.getFullYear()}
        </span>
        <button onClick={() => changePeriod(1)} className="p-1 text-slate-500 active:text-white transition-colors">
          <span className="material-symbols-outlined">chevron_right</span>
        </button>
      </div>

      <div className="bg-background-dark px-6 py-5 border-b border-white/5 flex items-center justify-between shadow-lg">
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-0.5">Total Periodo (Activo)</p>
          <p className={`text-2xl font-black ${totalPeriodValue >= 0 ? 'text-white' : 'text-red-400'}`}>
            {formatCurrency(totalPeriodValue)}
          </p>
        </div>
        <div className={`size-12 rounded-2xl flex items-center justify-center ${totalPeriodValue >= 0 ? 'bg-primary/10 text-primary' : 'bg-red-500/10 text-red-500'}`}>
          <span className="material-symbols-outlined text-2xl">
            {totalPeriodValue >= 0 ? 'account_balance_wallet' : 'trending_down'}
          </span>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto no-scrollbar pb-32">
        {loading ? (
          <div className="p-20 flex justify-center"><span className="material-symbols-outlined animate-spin text-slate-600 text-3xl">sync</span></div>
        ) : activeMovements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center px-10 space-y-4 opacity-30">
            <span className="material-symbols-outlined text-5xl">history_toggle_off</span>
            <p className="text-xs font-black uppercase tracking-widest">Sin movimientos registrados</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {activeMovements.map(m => (
              <div 
                key={m.id} 
                className="flex items-center justify-between transition-colors relative"
              >
                <div 
                  onClick={() => setSelectedMovement(m)}
                  className="flex-1 px-5 py-5 flex items-center justify-between cursor-pointer active:bg-white/5 transition-colors"
                >
                  <div className="flex flex-col gap-0.5 max-w-[60%]">
                    <span className="text-[13px] font-black text-slate-200 uppercase truncate leading-tight">
                      {m.conceptTitle || 'MOVIMIENTO'}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest truncate">{m.conceptSubtitle || m.source}</span>
                    </div>
                  </div>

                  <div className="text-right pr-4">
                    <span className={`text-[15px] font-black ${(m.type === 'INCOME' || (m.type as any) === 'INGRESO') ? 'text-blue-400' : 'text-red-400'}`}>
                      {(m.type === 'INCOME' || (m.type as any) === 'INGRESO') ? '+' : '-'} {formatCurrency(m.amount)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 pr-5 border-l border-white/10 pl-4 py-4">
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      navigate(`/account/edit-movement/${docId}/${m.id}`);
                    }}
                    className="size-10 rounded-xl flex items-center justify-center transition-all bg-white/5 text-slate-400 hover:text-primary active:scale-90"
                    title="Editar"
                  >
                    <span className="material-symbols-outlined text-[20px]">edit</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* DETALLE DEL MOVIMIENTO (MODAL) */}
      {selectedMovement && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-sm bg-surface-dark rounded-[2.5rem] flex flex-col max-h-[85vh] shadow-2xl border border-white/5 overflow-hidden animate-in slide-in-from-bottom-10 duration-500">
            <header className="p-6 border-b border-white/5 flex justify-between items-center bg-primary/5">
              <div>
                <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-1">Detalle de Operación</p>
                <h3 className="text-lg font-black text-white uppercase leading-tight">{selectedMovement.conceptTitle}</h3>
              </div>
              <button 
                onClick={() => setSelectedMovement(null)}
                className="size-10 rounded-full bg-white/5 flex items-center justify-center text-white active:scale-90 transition-transform"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
              {/* Monto Principal */}
              <div className="text-center space-y-1">
                <p className={`text-4xl font-black tracking-tighter ${
                  (selectedMovement.type === 'INCOME' || (selectedMovement.type as any) === 'INGRESO') ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  {(selectedMovement.type === 'INCOME' || (selectedMovement.type as any) === 'INGRESO') ? '+' : '-'} {formatCurrency(selectedMovement.amount)}
                </p>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  {selectedMovement.type === 'INCOME' ? 'Ingreso de Fondos' : 'Egreso / Pago'}
                </p>
              </div>

              {/* Grid de Metadatos */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-white/5 rounded-2xl space-y-1">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Referencia</p>
                  <p className="text-xs font-bold text-slate-200">{selectedMovement.conceptSubtitle || 'Sin referencia'}</p>
                </div>
                <div className="p-4 bg-white/5 rounded-2xl space-y-1">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Origen / Fuente</p>
                  <p className="text-xs font-bold text-primary uppercase">{selectedMovement.source || 'Manual'}</p>
                </div>
              </div>

              {/* Fechas */}
              <div className="space-y-3">
                 <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl">
                    <div className="flex items-center gap-3">
                       <span className="material-symbols-outlined text-slate-500 text-lg">calendar_today</span>
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha Contable</span>
                    </div>
                    <span className="text-xs font-bold text-slate-200">{formatDate(selectedMovement.effectiveAt)}</span>
                 </div>
                 <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl">
                    <div className="flex items-center gap-3">
                       <span className="material-symbols-outlined text-slate-500 text-lg">history</span>
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Registro Sistema</span>
                    </div>
                    <span className="text-xs font-bold text-slate-500">{formatDate(selectedMovement.createdAt)}</span>
                 </div>
              </div>

              {/* Notas */}
              {selectedMovement.notes && (
                <div className="space-y-2">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Notas Internas</p>
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/5 italic text-sm text-slate-300 leading-relaxed">
                    {selectedMovement.notes}
                  </div>
                </div>
              )}
            </div>

            <footer className="p-4 bg-black/20 border-t border-white/5 grid grid-cols-2 gap-3">
              <button 
                onClick={() => {
                  const m = selectedMovement;
                  setSelectedMovement(null);
                  navigate(`/account/edit-movement/${docId}/${m.id}`);
                }}
                className="py-4 bg-primary text-white font-black rounded-2xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 text-sm"
              >
                <span className="material-symbols-outlined text-lg">edit</span>
                EDITAR
              </button>
              <button 
                onClick={() => setSelectedMovement(null)}
                className="py-4 bg-white/5 text-slate-300 font-black rounded-2xl active:scale-95 transition-all text-sm"
              >
                CERRAR
              </button>
            </footer>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
};

export default AccountHistoryScreen;
