import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { db } from '../services/firebase';
import { 
  collection, 
  query, 
  limit, 
  onSnapshot, 
  getDocs, 
  where,
  writeBatch,
  increment,
  serverTimestamp,
  doc
} from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../services/errorHandling';

export interface CorteRecord {
  id: string;
  fecha: string;
  admin: string;
  status: string;
  groupId?: string;
  createdAt?: any;
  isSynthetic?: boolean;
  audit?: {
    totalIngresos?: number;
    subtotalEgresos?: number;
    totalEsperado?: number;
    dineroEntregado?: number;
    resultadoCaja?: number;
    tipoResultado?: 'SOBRANTE' | 'FALTANTE' | 'OK';
    diferencia?: number;
    movementsCount?: number;
  };
}

interface CortesHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDate?: (dateStr: string) => void;
  onEditCorte?: (corte: CorteRecord) => void;
  currentDate?: string;
  /** Bloquear modificaciones hasta migrar el historial a cortes identificados por local. */
  readOnly?: boolean;
}

export const CortesHistoryModal: React.FC<CortesHistoryModalProps> = ({
  isOpen,
  onClose,
  onSelectDate,
  onEditCorte,
  currentDate,
  readOnly = true
}) => {
  const { user } = useAuth();
  const { addNotification } = useNotifications();

  // Helper para obtener fecha de hoy en formato YYYY-MM-DD local
  const getTodayStr = useCallback(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const todayStr = useMemo(() => getTodayStr(), [getTodayStr]);

  // Estados de datos
  const [cortes, setCortes] = useState<CorteRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados de filtrado por fecha: de forma predeterminada activo con la fecha del día calendario vigente
  const [filterMode, setFilterMode] = useState<'today' | 'all' | 'custom'>('today');
  const [filterDate, setFilterDate] = useState<string>(todayStr);

  // Estados de eliminación
  const [corteToDelete, setCorteToDelete] = useState<CorteRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState<string | null>(null);

  const formatMXN = (val?: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val || 0);

  // Al abrir el modal, asegurar que el filtro predeterminado apunte al día calendario vigente
  useEffect(() => {
    if (isOpen) {
      const today = getTodayStr();
      setFilterMode('today');
      setFilterDate(currentDate || today);
    }
  }, [isOpen, getTodayStr, currentDate]);

  /**
   * Carga dual-source ultra robusta:
   * 1. Lee documentos de la colección /users/{uid}/cortes (sin exigir ordenación en Firestore para evitar fallos de índice).
   * 2. Escanea movimientos en las cuentas para descubrir cortes registrados como movimientos (con groupId 'RD-...' o dateKey).
   * 3. Fusiona y deduplica ambos orígenes para que NINGÚN corte realizado hoy o en sesiones previas quede oculto.
   */
  useEffect(() => {
    if (!isOpen || !user) return;
    setLoading(true);

    let isMounted = true;
    let cutsFromCollection: CorteRecord[] = [];
    let cutsFromMovements: CorteRecord[] = [];

    const mergeAndSetCortes = () => {
      if (!isMounted) return;

      const mapByKey = new Map<string, CorteRecord>();

      // 1. Primero agregamos los documentos formales de /cortes
      cutsFromCollection.forEach((c) => {
        const key = c.groupId || c.id;
        mapByKey.set(key, c);
        if (c.fecha) {
          mapByKey.set(`date_${c.fecha}`, c);
        }
      });

      // 2. Agregamos cortes sintetizados a partir de movimientos de cuentas
      cutsFromMovements.forEach((synth) => {
        const key = synth.groupId || synth.id;
        const dateKey = `date_${synth.fecha}`;
        if (!mapByKey.has(key) && !mapByKey.has(dateKey)) {
          mapByKey.set(key, synth);
        }
      });

      const combined = Array.from(new Set(mapByKey.values()));

      // Ordenar por fecha o timestamp descendente (más recientes primero)
      combined.sort((a, b) => {
        const getMs = (rec: CorteRecord) => {
          if (rec.createdAt?.toMillis) return rec.createdAt.toMillis();
          if (rec.createdAt?.seconds) return rec.createdAt.seconds * 1000;
          if (rec.createdAt) {
            const parsed = new Date(rec.createdAt).getTime();
            if (!isNaN(parsed)) return parsed;
          }
          if (rec.fecha) {
            const parsed = new Date(`${rec.fecha}T12:00:00`).getTime();
            if (!isNaN(parsed)) return parsed;
          }
          return 0;
        };
        return getMs(b) - getMs(a);
      });

      setCortes(combined);
      setLoading(false);
    };

    // 1. Listener de /users/{uid}/cortes (sin orderBy para evitar fallos si falta índice en Firestore)
    const cortesColRef = collection(db, 'users', user.uid, 'cortes');
    const unsub = onSnapshot(
      cortesColRef,
      (snapshot) => {
        cutsFromCollection = snapshot.docs.map((d) => {
          const data = d.data();
          const cleanFecha = String(data.fecha || d.id.replace('corte_', '').split('_')[0] || '');
          return {
            id: d.id,
            fecha: cleanFecha,
            admin: String(data.admin || 'Administrador'),
            status: String(data.status || 'ACTIVE'),
            groupId: data.groupId ? String(data.groupId) : undefined,
            createdAt: data.createdAt,
            isSynthetic: false,
            audit: data.audit ? {
              totalIngresos: Number(data.audit.totalIngresos || 0),
              subtotalEgresos: Number(data.audit.subtotalEgresos || 0),
              totalEsperado: Number(data.audit.totalEsperado || 0),
              dineroEntregado: Number(data.audit.dineroEntregado || 0),
              resultadoCaja: Number(data.audit.resultadoCaja ?? data.audit.diferencia ?? 0),
              tipoResultado: data.audit.tipoResultado || 'OK',
              diferencia: Number(data.audit.diferencia || 0),
              movementsCount: data.audit.movementsCount ? Number(data.audit.movementsCount) : undefined
            } : undefined
          };
        });
        mergeAndSetCortes();
      },
      (error) => {
        console.warn('Aviso al consultar colección cortes:', error);
        mergeAndSetCortes();
      }
    );

    // 2. Descubrimiento proactivo desde los movimientos de cuentas de usuario
    const discoverFromMovements = async () => {
      try {
        const accountsSnap = await getDocs(collection(db, 'users', user.uid, 'accounts'));
        const groups = new Map<string, {
          groupId?: string;
          dateKey: string;
          createdAt: any;
          usuario?: string;
          ingresos: number;
          egresos: number;
          count: number;
        }>();

        for (const accDoc of accountsSnap.docs) {
          const movsRef = collection(db, 'users', user.uid, 'accounts', accDoc.id, 'movements');
          const recentMovsSnap = await getDocs(query(movsRef, limit(80)));

          recentMovsSnap.docs.forEach((mDoc) => {
            const m = mDoc.data();
            const source = m.source || '';
            const groupId = m.groupId;
            const dateKey = m.dateKey || (m.createdAt?.toDate ? m.createdAt.toDate().toISOString().split('T')[0] : '');

            // Determinar si este movimiento pertenece a un corte de caja
            const isCorte = (groupId && String(groupId).startsWith('RD-')) ||
                            source === 'corte_ia' ||
                            source === 'manual' ||
                            (m.conceptSubtitle && String(m.conceptSubtitle).toUpperCase().includes('CORTE'));

            if (!isCorte) return;

            const groupKey = groupId || `corte_date_${dateKey}`;
            const cur = groups.get(groupKey) || {
              groupId,
              dateKey: dateKey || todayStr,
              createdAt: m.createdAt,
              usuario: m.usuario,
              ingresos: 0,
              egresos: 0,
              count: 0
            };

            const isControl = m.es_control === true || m.esControl === true;
            const isAutoAdjustment = source === 'auto_inventory' || source === 'auto_debit';

            if (!isControl && !isAutoAdjustment) {
              const amt = Number(m.amount || 0);
              if (m.type === 'INCOME') cur.ingresos += amt;
              else if (m.type === 'EXPENSE') cur.egresos += amt;
            }

            cur.count += 1;
            groups.set(groupKey, cur);
          });
        }

        const discovered: CorteRecord[] = [];
        groups.forEach((g, key) => {
          discovered.push({
            id: `synth_${key}`,
            fecha: g.dateKey || todayStr,
            admin: g.usuario || 'Administrador',
            status: 'ACTIVE',
            groupId: g.groupId,
            createdAt: g.createdAt,
            isSynthetic: true,
            audit: {
              totalIngresos: Number(g.ingresos.toFixed(2)),
              subtotalEgresos: Number(g.egresos.toFixed(2)),
              totalEsperado: Number((g.ingresos - g.egresos).toFixed(2)),
              dineroEntregado: 0,
              resultadoCaja: Number((g.ingresos - g.egresos).toFixed(2)),
              tipoResultado: 'OK',
              diferencia: 0,
              movementsCount: g.count
            }
          });
        });

        cutsFromMovements = discovered;
        mergeAndSetCortes();
      } catch (err) {
        console.warn('Aviso al descubrir movimientos de cortes:', err);
        mergeAndSetCortes();
      }
    };

    discoverFromMovements();

    return () => {
      isMounted = false;
      unsub();
    };
  }, [isOpen, user, todayStr]);

  /**
   * Helper inteligente para validar si un corte corresponde a "Hoy":
   * Compara tanto fecha string como fecha de creación (Timestamp/Date)
   * tolerando posibles desfases de zona horaria entre el cliente y el servidor.
   */
  const isCorteToday = useCallback((corte: CorteRecord) => {
    if (corte.fecha === todayStr) return true;
    if (currentDate && corte.fecha === currentDate) return true;

    // Verificar también el timestamp de creación si fue registrado en las últimas 24 horas
    if (corte.createdAt) {
      try {
        const d = corte.createdAt.toDate ? corte.createdAt.toDate() : new Date(corte.createdAt);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const dStr = `${y}-${m}-${day}`;
        if (dStr === todayStr || (currentDate && dStr === currentDate)) {
          return true;
        }
      } catch {
        // ignore
      }
    }
    return false;
  }, [todayStr, currentDate]);

  // Filtrado reactivo en memoria por fecha seleccionada
  const filteredCortes = useMemo(() => {
    if (filterMode === 'all') {
      return cortes;
    }
    if (filterMode === 'today') {
      return cortes.filter(isCorteToday);
    }
    if (filterMode === 'custom' && filterDate) {
      return cortes.filter((c) => {
        if (c.fecha === filterDate) return true;
        if (c.createdAt) {
          try {
            const d = c.createdAt.toDate ? c.createdAt.toDate() : new Date(c.createdAt);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}` === filterDate;
          } catch {
            return false;
          }
        }
        return false;
      });
    }
    return cortes;
  }, [cortes, filterMode, filterDate, isCorteToday]);

  // Contadores para chips informativos
  const todayCount = useMemo(() => {
    return cortes.filter(isCorteToday).length;
  }, [cortes, isCorteToday]);

  /**
   * Eliminar un corte completo con un solo clic:
   * 1. Localiza todos los movimientos vinculados al corte (por groupId o dateKey/fecha).
   * 2. Revierte los saldos de cada cuenta contable afectada (balance -= signedAmount).
   * 3. Elimina los documentos de movimientos de las subcolecciones.
   * 4. Elimina el documento del corte en /users/{uid}/cortes/{corteId}.
   */
  const handleExecuteDelete = async () => {
    if (readOnly) {setDeleteStatus('Eliminación deshabilitada hasta validar el ámbito de cada caja.');return;}
    if (!user || !corteToDelete) return;
    const target = corteToDelete;
    setIsDeleting(true);
    setDeleteStatus('Buscando movimientos del corte...');

    try {
      // 1. Obtener todas las cuentas del usuario para mapear docId y balance
      const accountsSnap = await getDocs(collection(db, 'users', user.uid, 'accounts'));
      const accountDocs = accountsSnap.docs;

      // 2. Buscar movimientos en cada cuenta vinculados a este corte
      setDeleteStatus('Localizando registros en cuentas...');
      const movementsToDelete: Array<{
        accountDocId: string;
        movementId: string;
        signedAmount: number;
      }> = [];

      for (const accDoc of accountDocs) {
        const movsColRef = collection(db, 'users', user.uid, 'accounts', accDoc.id, 'movements');

        // Búsqueda prioritaria por groupId si el corte lo tiene
        if (target.groupId) {
          const qGroup = query(movsColRef, where('groupId', '==', target.groupId));
          const snapGroup = await getDocs(qGroup);
          snapGroup.docs.forEach((mDoc) => {
            const data = mDoc.data();
            movementsToDelete.push({
              accountDocId: accDoc.id,
              movementId: mDoc.id,
              signedAmount: Number(data.signedAmount || 0)
            });
          });
        }

        // Búsqueda complementaria o de respaldo por dateKey / fecha
        const qDate = query(movsColRef, where('dateKey', '==', target.fecha));
        const snapDate = await getDocs(qDate);
        snapDate.docs.forEach((mDoc) => {
          // Evitar duplicados si ya fue encontrado por groupId
          if (!movementsToDelete.some((m) => m.movementId === mDoc.id)) {
            const data = mDoc.data();
            movementsToDelete.push({
              accountDocId: accDoc.id,
              movementId: mDoc.id,
              signedAmount: Number(data.signedAmount || 0)
            });
          }
        });
      }

      setDeleteStatus(`Revirtiendo saldos de ${movementsToDelete.length} movimientos...`);

      // 3. Revertir saldos y eliminar movimientos por lotes (writeBatch)
      const balanceImpactByAccount: Record<string, number> = {};
      movementsToDelete.forEach((m) => {
        const revertDelta = -m.signedAmount;
        balanceImpactByAccount[m.accountDocId] = (balanceImpactByAccount[m.accountDocId] || 0) + revertDelta;
      });

      let batch = writeBatch(db);
      let opCount = 0;

      // Aplicar ajustes a los balances de cuenta
      for (const [accDocId, netDelta] of Object.entries(balanceImpactByAccount)) {
        if (netDelta !== 0) {
          const accRef = doc(db, 'users', user.uid, 'accounts', accDocId);
          batch.update(accRef, {
            balance: increment(netDelta),
            updatedAt: serverTimestamp()
          });
          opCount++;
        }
      }

      // Eliminar los documentos de movimientos
      for (const m of movementsToDelete) {
        const mRef = doc(db, 'users', user.uid, 'accounts', m.accountDocId, 'movements', m.movementId);
        batch.delete(mRef);
        opCount++;

        if (opCount >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          opCount = 0;
        }
      }

      // 4. Eliminar el documento del corte si no es sintético
      if (!target.id.startsWith('synth_')) {
        const corteRef = doc(db, 'users', user.uid, 'cortes', target.id);
        batch.delete(corteRef);
        opCount++;
      }

      if (opCount > 0) {
        await batch.commit();
      }

      // Actualizar estado local inmediatamente para que desaparezca al instante sin esperar recargas
      setCortes((prev) =>
        prev.filter((c) => c.id !== target.id && (target.groupId ? c.groupId !== target.groupId : true))
      );

      addNotification({
        title: 'Corte Eliminado',
        message: `El corte del ${target.fecha} y sus ${movementsToDelete.length} movimientos fueron revertidos y eliminados con éxito.`,
        type: 'system'
      });

      setCorteToDelete(null);
    } catch (err: any) {
      console.error('Error al eliminar corte:', err);
      handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/cortes/${target.id}`);
      alert('Error al eliminar el corte: ' + (err.message || 'Error desconocido'));
    } finally {
      setIsDeleting(false);
      setDeleteStatus(null);
    }
  };

  const formatDisplayDate = (dateStr: string) => {
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const d = new Date(year, month, day);
        return d.toLocaleDateString('es-MX', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        });
      }
    } catch {
      // Ignorar fallback
    }
    return dateStr;
  };

  const handleEditClick = (corte: CorteRecord) => {
    if (readOnly) return;
    if (onEditCorte) {
      onEditCorte(corte);
    } else if (onSelectDate) {
      onSelectDate(corte.fecha);
    }
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90]"
          />

          {/* Modal Drawer */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 220 }}
            className="fixed inset-x-0 bottom-0 max-w-md mx-auto bg-white dark:bg-[#0f172a] border-t border-slate-200 dark:border-white/10 rounded-t-[2.5rem] z-[95] overflow-hidden flex flex-col max-h-[90vh] shadow-2xl font-display"
          >
            {/* Header del Modal */}
            <div className="p-5 pb-3 border-b border-slate-100 dark:border-white/5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="size-11 rounded-2xl bg-primary/10 text-primary dark:text-blue-400 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-2xl">history</span>
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
                    Historial de Cortes
                  </h2>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Filtra por fecha para seleccionar, editar o eliminar
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="size-9 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors shrink-0"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* BARRA DE FILTRO POR FECHA - PREDETERMINADO: DÍA CALENDARIO VIGENTE */}
            <div className="p-4 bg-slate-50 dark:bg-white/5 border-b border-slate-100 dark:border-white/5 space-y-3 shrink-0">
              {/* Selector de modo de filtro */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-200/80 dark:bg-black/30 rounded-2xl">
                <button
                  type="button"
                  onClick={() => {
                    setFilterMode('today');
                    setFilterDate(todayStr);
                  }}
                  className={`flex-1 py-2 px-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                    filterMode === 'today'
                      ? 'bg-primary text-white shadow-md shadow-primary/25'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">today</span>
                  <span>Hoy ({todayCount})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFilterMode('custom')}
                  className={`flex-1 py-2 px-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                    filterMode === 'custom'
                      ? 'bg-primary text-white shadow-md shadow-primary/25'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">calendar_month</span>
                  <span>Por Fecha</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFilterMode('all')}
                  className={`flex-1 py-2 px-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                    filterMode === 'all'
                      ? 'bg-primary text-white shadow-md shadow-primary/25'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">view_agenda</span>
                  <span>Todos ({cortes.length})</span>
                </button>
              </div>

              {/* Input selector de fecha específica (en modo custom o para ver/ajustar fecha) */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1 group">
                  <input
                    type="date"
                    value={filterDate}
                    onChange={(e) => {
                      setFilterDate(e.target.value);
                      setFilterMode('custom');
                    }}
                    className="w-full bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/10 rounded-xl py-2 px-3 pl-9 text-xs font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-primary/40 shadow-sm"
                  />
                  <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-base pointer-events-none group-focus-within:text-primary">
                    event
                  </span>
                </div>

                {filterMode !== 'today' && (
                  <button
                    type="button"
                    onClick={() => {
                      setFilterMode('today');
                      setFilterDate(todayStr);
                    }}
                    className="px-3 py-2 rounded-xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/10 text-[10px] font-bold text-slate-700 dark:text-slate-300 hover:border-primary/40 transition-colors shrink-0"
                    title="Volver a los cortes del día de hoy"
                  >
                    Ir a Hoy
                  </button>
                )}
              </div>

              {/* Etiqueta de estado del filtro activo */}
              <div className="flex items-center justify-between text-[11px] px-0.5">
                <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  {filterMode === 'today'
                    ? `Cortes de hoy (${formatDisplayDate(todayStr)})`
                    : filterMode === 'custom'
                    ? `Cortes del ${formatDisplayDate(filterDate)}`
                    : 'Todos los cortes registrados'}
                </span>
                <span className="text-[10px] font-black text-primary dark:text-blue-400">
                  {filteredCortes.length} {filteredCortes.length === 1 ? 'resultado' : 'resultados'}
                </span>
              </div>
            </div>

            {readOnly && <div className="mx-4 mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              Consulta de historial únicamente. Editar y borrar permanecen deshabilitados durante la integración de dos locales.
            </div>}
            {/* Lista de Cortes Filtrados */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
              {loading ? (
                <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-400">
                  <span className="material-symbols-outlined animate-spin text-3xl text-primary">sync</span>
                  <p className="text-xs font-bold uppercase tracking-wider">Cargando historial...</p>
                </div>
              ) : filteredCortes.length === 0 ? (
                <div className="py-10 text-center text-slate-400 space-y-4">
                  <div className="size-16 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center mx-auto text-slate-400">
                    <span className="material-symbols-outlined text-3xl">event_busy</span>
                  </div>

                  <div className="space-y-1.5 px-4">
                    <p className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                      {filterMode === 'today'
                        ? `No se encontró corte con la fecha de hoy (${todayStr})`
                        : `Sin cortes en la fecha seleccionada (${filterDate})`}
                    </p>
                    <p className="text-[11px] max-w-xs mx-auto text-slate-400 font-normal leading-relaxed">
                      {cortes.length > 0
                        ? `Hay un total de ${cortes.length} corte(s) registrado(s) en tu historial. Puedes verlos todos de inmediato presionando el botón abajo:`
                        : 'Aún no se han guardado cortes de caja. Al registrar tu corte desde la pantalla principal aparecerá aquí.'}
                    </p>
                  </div>

                  {/* Acceso directo a ver todos si hoy no tiene registros */}
                  {cortes.length > 0 && (
                    <div className="pt-2 px-2 space-y-3">
                      <button
                        type="button"
                        onClick={() => setFilterMode('all')}
                        className="w-full py-3 rounded-2xl bg-primary text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-primary/25 hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
                      >
                        <span className="material-symbols-outlined text-base">view_agenda</span>
                        <span>Ver Todos los Cortes ({cortes.length})</span>
                      </button>

                      {/* Vista previa rápida de los últimos cortes para eliminarlos de inmediato sin cambiar de filtro */}
                      <div className="pt-2 text-left space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                          Cortes Recientes en tu Historial:
                        </p>
                        {cortes.slice(0, 3).map((rec) => (
                          <div
                            key={rec.id}
                            className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/5 flex items-center justify-between gap-2"
                          >
                            <div>
                              <p className="text-xs font-black text-slate-800 dark:text-white capitalize">
                                {formatDisplayDate(rec.fecha)}
                              </p>
                              <p className="text-[10px] text-slate-400 font-mono">
                                {rec.fecha} • {rec.audit?.totalIngresos ? formatMXN(rec.audit.totalIngresos) : `${rec.audit?.movementsCount || 0} movs`}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleEditClick(rec)}
                                disabled={readOnly}
                                title={readOnly ? 'Edición bloqueada en pruebas multilocal' : 'Editar corte'}
                                className="px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary dark:text-blue-400 text-[10px] font-black uppercase tracking-wider hover:bg-primary/20 transition-all"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => setCorteToDelete(rec)}
                                 disabled={readOnly}
                                 title={readOnly ? 'Eliminación bloqueada en pruebas multilocal' : 'Eliminar corte'}
                                className="px-2.5 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] font-black uppercase tracking-wider hover:bg-rose-100 transition-all"
                              >
                                Eliminar
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                filteredCortes.map((corte) => {
                  const audit = corte.audit;
                  const resCaja = audit?.resultadoCaja || 0;
                  const isSobrante = resCaja > 0.1;
                  const isFaltante = resCaja < -0.1;
                  const isToday = isCorteToday(corte);

                  return (
                    <div
                      key={corte.id}
                      className="p-4 rounded-2xl bg-white dark:bg-surface-dark border border-slate-200/80 dark:border-white/5 shadow-sm hover:border-primary/40 transition-all flex flex-col gap-3 group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className={`size-10 rounded-2xl flex items-center justify-center font-black ${
                            isToday
                              ? 'bg-primary text-white shadow-md shadow-primary/20'
                              : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300'
                          }`}>
                            <span className="material-symbols-outlined text-xl">
                              {isToday ? 'today' : 'calendar_month'}
                            </span>
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-black text-slate-900 dark:text-white capitalize">
                                {formatDisplayDate(corte.fecha)}
                              </p>
                              {isToday && (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[9px] font-black uppercase tracking-wider border border-emerald-500/25">
                                  Hoy
                                </span>
                              )}
                              {corte.isSynthetic && (
                                <span className="px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[8px] font-bold uppercase tracking-wider">
                                  Movimientos
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] font-mono text-slate-400">
                              {corte.fecha} • {corte.admin}
                            </p>
                          </div>
                        </div>

                        {/* Botón Eliminar con un solo clic */}
                        <button
                          type="button"
                          onClick={() => setCorteToDelete(corte)}
                           disabled={readOnly}
                          className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-xs font-black uppercase tracking-wider flex items-center gap-1 transition-all active:scale-95 shrink-0"
                          title="Eliminar corte completo y revertir saldos"
                        >
                          <span className="material-symbols-outlined text-base">delete</span>
                          <span>Eliminar</span>
                        </button>
                      </div>

                      {/* Métricas del corte si existen */}
                      {audit && (
                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-white/5 text-[11px]">
                          <div className="bg-slate-50 dark:bg-white/5 p-2 rounded-xl">
                            <span className="text-[9px] font-bold text-slate-400 block uppercase">Ingresos</span>
                            <span className="font-extrabold text-emerald-600 dark:text-emerald-400 truncate block">
                              {formatMXN(audit.totalIngresos)}
                            </span>
                          </div>
                          <div className="bg-slate-50 dark:bg-white/5 p-2 rounded-xl">
                            <span className="text-[9px] font-bold text-slate-400 block uppercase">Egresos</span>
                            <span className="font-extrabold text-rose-500 dark:text-rose-400 truncate block">
                              {formatMXN(audit.subtotalEgresos)}
                            </span>
                          </div>
                          <div className="bg-slate-50 dark:bg-white/5 p-2 rounded-xl">
                            <span className="text-[9px] font-bold text-slate-400 block uppercase">Resultado</span>
                            <span
                              className={`font-black truncate block ${
                                isSobrante
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : isFaltante
                                  ? 'text-rose-500 dark:text-rose-400'
                                  : 'text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              {formatMXN(resCaja)}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Botón destacado para SELECCIONAR / EDITAR este corte */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-white/5">
                        <span className="text-[10px] text-slate-400 font-medium">
                          {audit?.movementsCount ? `${audit.movementsCount} movs.` : 'Corte diario'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleEditClick(corte)}
                          className="px-3.5 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary dark:text-blue-400 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95"
                          title="Cargar y editar los datos de este corte"
                        >
                          <span className="material-symbols-outlined text-sm">edit</span>
                          <span>Seleccionar / Editar</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>

          {/* Modal de Confirmación de Eliminación Inmediata */}
          {corteToDelete && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
              <div className="w-full max-w-sm bg-white dark:bg-surface-dark rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-white/10 space-y-4 font-display">
                <div className="size-14 rounded-2xl bg-rose-500/10 text-rose-500 mx-auto flex items-center justify-center">
                  <span className="material-symbols-outlined text-3xl">delete_forever</span>
                </div>

                <div className="text-center space-y-1">
                  <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
                    ¿Eliminar Corte Completo?
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Se eliminará el corte del <strong className="text-slate-900 dark:text-white">{formatDisplayDate(corteToDelete.fecha)}</strong> y se <strong>revertirán automáticamente todos los saldos</strong> de las cuentas de ventas, inventarios y gastos afectados.
                  </p>
                </div>

                {deleteStatus && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400">
                    <span className="material-symbols-outlined animate-spin text-sm">sync</span>
                    <span>{deleteStatus}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => !isDeleting && setCorteToDelete(null)}
                    disabled={isDeleting}
                    className="w-full py-3.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 font-bold text-xs uppercase tracking-wider hover:bg-slate-100 dark:hover:bg-white/5 transition-all disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteDelete}
                    disabled={isDeleting || readOnly}
                    className="w-full py-3.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-rose-600/30 flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {isDeleting ? (
                      <span className="material-symbols-outlined animate-spin text-sm">sync</span>
                    ) : (
                      <span className="material-symbols-outlined text-sm">delete</span>
                    )}
                    <span>{isDeleting ? 'Eliminando...' : 'Sí, Eliminar'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </AnimatePresence>
  );
};

export default CortesHistoryModal;
