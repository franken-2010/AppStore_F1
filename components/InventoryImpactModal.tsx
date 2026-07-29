import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { collection, query, orderBy, getDocs, limit } from 'firebase/firestore';
import { AccountResolver } from '../services/AccountResolver';
import { handleFirestoreError, OperationType } from '../services/errorHandling';

interface InventoryImpactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface InventoryMovement {
  id: string;
  amount: number;
  direction: 'IN' | 'OUT';
  signedAmount: number;
  conceptTitle: string;
  conceptSubtitle: string;
  source: string;
  createdAt: any;
}

const InventoryImpactModal: React.FC<InventoryImpactModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);

  const formatMXN = (val: number) => 
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);

  useEffect(() => {
    const fetchInventoryMovements = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const invInfo = await AccountResolver.assertAccount(user.uid, 'inventarios');
        const q = query(
          collection(db, "users", user.uid, "accounts", invInfo.accountDocId, "movements"),
          orderBy("createdAt", "desc"),
          limit(60)
        );
        const snap = await getDocs(q);
        const fetched = snap.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            amount: Number(data.amount || 0),
            direction: data.direction || 'IN',
            signedAmount: Number(data.signedAmount || 0),
            conceptTitle: String(data.conceptTitle || ''),
            conceptSubtitle: String(data.conceptSubtitle || 'Auto-ajuste'),
            source: String(data.source || ''),
            createdAt: data.createdAt?.toMillis ? new Date(data.createdAt.toMillis()) : new Date()
          } as InventoryMovement;
        });
        setMovements(fetched);
      } catch (err) {
        console.error("Error fetching inventory movements for analysis", err);
      } finally {
        setLoading(false);
      }
    };

    if (isOpen && user) {
      fetchInventoryMovements();
    }
  }, [isOpen, user]);

  const analysis = useMemo(() => {
    let positiveTotal = 0;
    let negativeTotal = 0;
    const statsByAccount: Record<string, { positive: number, negative: number, count: number }> = {
      'abarrotes': { positive: 0, negative: 0, count: 0 },
      'fiesta': { positive: 0, negative: 0, count: 0 },
      'recargas': { positive: 0, negative: 0, count: 0 },
      'cxc': { positive: 0, negative: 0, count: 0 },
      'otros': { positive: 0, negative: 0, count: 0 }
    };

    movements.forEach(m => {
      const amt = m.amount;
      const title = m.conceptTitle.toUpperCase();

      if (m.direction === 'IN') {
        positiveTotal += amt;
      } else {
        negativeTotal += amt;
      }

      // Clasificación por cuenta/rubro basándose en el conceptTitle
      let category = 'otros';
      if (title.includes('MERCANCÍA') || title.includes('ABARROTES') || title.includes('COMPRA')) {
        category = 'abarrotes';
      } else if (title.includes('FIESTA')) {
        category = 'fiesta';
      } else if (title.includes('RECARGA')) {
        category = 'recargas';
      } else if (title.includes('CRÉDITO') || title.includes('CXC') || title.includes('PAGO CLIENTE') || title.includes('COBRANZA')) {
        category = 'cxc';
      }

      if (m.direction === 'IN') {
        statsByAccount[category].positive += amt;
      } else {
        statsByAccount[category].negative += amt;
      }
      statsByAccount[category].count += 1;
    });

    return {
      positiveTotal,
      negativeTotal,
      netChange: positiveTotal - negativeTotal,
      stats: statsByAccount
    };
  }, [movements]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100]"
          />
          
          {/* Sheet container */}
          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="fixed inset-x-0 bottom-0 max-w-lg mx-auto bg-[#0a0f1d] border-t border-white/5 rounded-t-[2.5rem] z-[101] overflow-hidden flex flex-col max-h-[92vh]"
          >
            {/* Header */}
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">analytics</span>
                  Análisis de Inventario
                </h2>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Impactos positivos y negativos por cuenta</p>
              </div>
              <button onClick={onClose} className="size-10 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-7 no-scrollbar pb-10">
              
              {/* Resumen de Impacto Neto */}
              <div className="bg-gradient-to-br from-[#121928] to-[#0a0f1d] border border-white/5 p-6 rounded-3xl relative overflow-hidden">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Balance de Inventario Reciente</p>
                <h3 className={`text-4xl font-black tracking-tighter ${analysis.netChange >= 0 ? 'text-white' : 'text-rose-400'}`}>
                  {analysis.netChange >= 0 ? '+' : ''}{formatMXN(analysis.netChange)}
                </h3>
                
                <div className="grid grid-cols-2 gap-4 mt-5 pt-5 border-t border-white/5">
                  <div>
                    <div className="flex items-center gap-1.5 mb-1 text-emerald-400">
                      <span className="material-symbols-outlined text-sm font-bold">arrow_upward</span>
                      <span className="text-[8px] font-black uppercase tracking-wider">Altas de Stock (+)</span>
                    </div>
                    <p className="text-lg font-black text-white">{formatMXN(analysis.positiveTotal)}</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-1 text-rose-400">
                      <span className="material-symbols-outlined text-sm font-bold">arrow_downward</span>
                      <span className="text-[8px] font-black uppercase tracking-wider">Uso / Ventas (-)</span>
                    </div>
                    <p className="text-lg font-black text-white">{formatMXN(analysis.negativeTotal)}</p>
                  </div>
                </div>

                {/* Progress bar ratio */}
                {analysis.positiveTotal + analysis.negativeTotal > 0 && (
                  <div className="mt-5 space-y-1.5">
                    <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden flex">
                      <div 
                        className="bg-emerald-500 h-full transition-all duration-500"
                        style={{ width: `${(analysis.positiveTotal / (analysis.positiveTotal + analysis.negativeTotal)) * 100}%` }}
                      />
                      <div 
                        className="bg-rose-500 h-full transition-all duration-500"
                        style={{ width: `${(analysis.negativeTotal / (analysis.positiveTotal + analysis.negativeTotal)) * 100}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[8px] font-bold uppercase text-slate-500">
                      <span>Altas: {Math.round((analysis.positiveTotal / (analysis.positiveTotal + analysis.negativeTotal)) * 100)}%</span>
                      <span>Salidas: {Math.round((analysis.negativeTotal / (analysis.positiveTotal + analysis.negativeTotal)) * 100)}%</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Reglas e Impacto por Cuenta */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Análisis de Rubros y Cuentas</h4>
                
                <div className="space-y-3">
                  {/* Abarrotes / Mercancía */}
                  <div className="bg-white/5 border border-white/5 p-4 rounded-2xl flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-amber-400">storefront</span>
                        <div>
                          <p className="text-[11px] font-black uppercase text-white leading-none">Abarrotes y Mercancía</p>
                          <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-1">Cuentas vinculadas: ventas</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-[10px] mt-1">
                      <div className="bg-emerald-500/10 border border-emerald-500/10 p-2.5 rounded-xl">
                        <p className="font-bold text-emerald-400">Suma Positiva (+)</p>
                        <p className="text-sm font-black text-white mt-1">{formatMXN(analysis.stats.abarrotes.positive)}</p>
                        <p className="text-[8px] text-slate-400 mt-0.5 leading-tight">Compras de stock de abarrotes (Gasto).</p>
                      </div>
                      <div className="bg-rose-500/10 border border-rose-500/10 p-2.5 rounded-xl">
                        <p className="font-bold text-rose-400">Suma Negativa (-)</p>
                        <p className="text-sm font-black text-white mt-1">{formatMXN(analysis.stats.abarrotes.negative)}</p>
                        <p className="text-[8px] text-slate-400 mt-0.5 leading-tight">Ventas efectivas y mermas en caja.</p>
                      </div>
                    </div>
                  </div>

                  {/* Fiesta */}
                  <div className="bg-white/5 border border-white/5 p-4 rounded-2xl flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-purple-400">celebration</span>
                        <div>
                          <p className="text-[11px] font-black uppercase text-white leading-none">Insumos Fiesta</p>
                          <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-1">Cuentas vinculadas: fiesta</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-[10px] mt-1">
                      <div className="bg-emerald-500/10 border border-emerald-500/10 p-2.5 rounded-xl">
                        <p className="font-bold text-emerald-400">Suma Positiva (+)</p>
                        <p className="text-sm font-black text-white mt-1">{formatMXN(analysis.stats.fiesta.positive)}</p>
                        <p className="text-[8px] text-slate-400 mt-0.5 leading-tight">Adquisición e insumos de fiesta.</p>
                      </div>
                      <div className="bg-rose-500/10 border border-rose-500/10 p-2.5 rounded-xl">
                        <p className="font-bold text-rose-400">Suma Negativa (-)</p>
                        <p className="text-sm font-black text-white mt-1">{formatMXN(analysis.stats.fiesta.negative)}</p>
                        <p className="text-[8px] text-slate-400 mt-0.5 leading-tight font-medium">Ingresos / Consumos en eventos.</p>
                      </div>
                    </div>
                  </div>

                  {/* Recargas */}
                  <div className="bg-white/5 border border-white/5 p-4 rounded-2xl flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-sky-400">send_to_mobile</span>
                        <div>
                          <p className="text-[11px] font-black uppercase text-white leading-none">Saldo de Recargas</p>
                          <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-1">Cuentas vinculadas: recargas</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-[10px] mt-1">
                      <div className="bg-emerald-500/10 border border-emerald-500/10 p-2.5 rounded-xl">
                        <p className="font-bold text-emerald-400">Suma Positiva (+)</p>
                        <p className="text-sm font-black text-white mt-1">{formatMXN(analysis.stats.recargas.positive)}</p>
                        <p className="text-[8px] text-slate-400 mt-0.5 leading-tight">Monto invertido en bolsa de aire.</p>
                      </div>
                      <div className="bg-rose-500/10 border border-rose-500/10 p-2.5 rounded-xl">
                        <p className="font-bold text-rose-400">Suma Negativa (-)</p>
                        <p className="text-sm font-black text-white mt-1">{formatMXN(analysis.stats.recargas.negative)}</p>
                        <p className="text-[8px] text-slate-400 mt-0.5 leading-tight">Venta directa de saldo de recarga.</p>
                      </div>
                    </div>
                  </div>

                  {/* Clientes a Crédito (CxC) */}
                  <div className="bg-white/5 border border-white/5 p-4 rounded-2xl flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-pink-400">assignment_ind</span>
                        <div>
                          <p className="text-[11px] font-black uppercase text-white leading-none">Crédito y Cobranza (CxC)</p>
                          <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-1">Cuentas vinculadas: cxc</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-[10px] mt-1">
                      <div className="bg-[#121928] border border-white/5 p-2.5 rounded-xl col-span-2">
                        <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                          <span className="font-bold">Clientes con Adeudos (-)</span>
                          <span className="font-bold text-white">{formatMXN(analysis.stats.cxc.negative)}</span>
                        </div>
                        <p className="text-[8px] text-slate-500 leading-tight">Las ventas a crédito o pagos de CxC en caja representan salida de mercancía o saldo del inventario activo de la sucursal.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Log Histórico de Movimientos */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Historial de Ajustes</h4>
                  <span className="bg-primary/20 text-primary text-[8px] font-black px-2 py-0.5 rounded-full">Automático F1</span>
                </div>

                <div className="space-y-2.5">
                  {loading ? (
                    <div className="p-8 text-center text-slate-500 text-[10px] font-bold uppercase tracking-wider">Cargando movimientos...</div>
                  ) : movements.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-[10px] font-bold uppercase tracking-wider border border-dashed border-white/10 rounded-2xl">Sin movimientos registrados recientemente</div>
                  ) : (
                    movements.map(m => (
                      <div key={m.id} className="p-4 bg-white/5 rounded-2xl border border-white/5 flex items-center justify-between">
                        <div className="min-w-0 pr-3">
                          <p className="text-[11px] font-black text-white uppercase truncate">{m.conceptTitle}</p>
                          <p className="text-[8px] font-bold text-slate-500 uppercase mt-0.5">{m.conceptSubtitle} • {m.createdAt.toLocaleDateString('es-MX')}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-sm font-black ${m.direction === 'IN' ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {m.direction === 'IN' ? '+' : '-'}{formatMXN(m.amount)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default InventoryImpactModal;
