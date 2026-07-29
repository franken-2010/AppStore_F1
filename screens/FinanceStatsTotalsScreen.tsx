import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AccountMovement } from '../types';
import { handleFirestoreError, OperationType } from '../services/errorHandling';
import BottomNav from '../components/BottomNav';
import { AccountResolver } from '../services/AccountResolver';
import { AccountingService } from '../services/AccountingService';
import { db } from '../services/firebase';
import { 
  collection, 
  collectionGroup,
  getDocs, 
  query, 
  where, 
  Timestamp, 
  doc, 
  getDoc, 
  setDoc 
} from 'firebase/firestore';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip, 
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  ArrowLeft, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Sliders, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Info, 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  Settings, 
  LayoutDashboard, 
  CreditCard, 
  Briefcase, 
  Store, 
  Layers, 
  Calculator, 
  Sparkles,
  RefreshCw
} from 'lucide-react';

type PeriodType = 'day' | 'week' | 'month' | 'year';

// Helper functions to safely extract contable properties
const getAfectaCaja = (m: any): boolean => {
  const val = m.afecta_caja !== undefined ? m.afecta_caja : m.afectaCaja;
  if (val === 'sí' || val === 'si' || val === true) return true;
  if (val === 'no' || val === false) return false;
  return true; // default
};

const getAfectaVentas = (m: any): boolean => {
  const val = m.afecta_ventas !== undefined ? m.afecta_ventas : m.afectaVentas;
  if (val === 'sí' || val === 'si' || val === true) return true;
  if (val === 'no' || val === false) return false;
  // Fallback for older movements
  const opType = m.tipo_operacion || '';
  const rubric = m.rubro || m.accountId || '';
  if (opType === 'venta_contado' || opType === 'venta_credito' || rubric.startsWith('in_ventas') || rubric === 'in_fiesta' || rubric === 'in_recargas' || rubric === 'in_estancias') return true;
  return false;
};

const getAfectaCxC = (m: any): boolean => {
  const val = m.afecta_cxc !== undefined ? m.afecta_cxc : m.afectaCxC;
  if (val === 'sí' || val === 'si' || val === true) return true;
  if (val === 'no' || val === false) return false;
  // Fallback
  const opType = m.tipo_operacion || '';
  const rubric = m.rubro || m.accountId || '';
  if (opType === 'venta_credito' || opType === 'cobranza_cxc' || rubric === 'in_cxc_venta' || rubric === 'in_cxc_pago') return true;
  return false;
};

const getAfectaGasto = (m: any): boolean => {
  const val = m.afecta_gasto;
  if (val === 'sí' || val === 'si' || val === true) return true;
  if (val === 'no' || val === false) return false;
  // Fallback
  if (m.type === 'EXPENSE' || m.direction === 'OUT') {
    const opType = m.tipo_operacion || '';
    const rubric = m.rubro || m.accountId || '';
    const isPurchase = opType === 'compra_mercancia' || rubric === 'ex_mercancias' || rubric === 'ex_fiesta' || rubric === 'ex_recargas' || rubric === 'inventarios';
    if (!isPurchase) return true;
  }
  return false;
};

const getAfectaCosto = (m: any): boolean => {
  const val = m.afecta_costo;
  if (val === 'sí' || val === 'si' || val === true) return true;
  if (val === 'no' || val === false) return false;
  return false;
};

const getEsControl = (m: any): boolean => {
  const val = m.es_control !== undefined ? m.es_control : m.esControl;
  if (val === 'sí' || val === 'si' || val === true) return true;
  if (val === 'no' || val === false) return false;
  return false;
};

const getCentroUtilidad = (m: any): string => {
  const center = String(m.centro_utilidad || m.centroUtilidad || 'Abarrotes').trim();
  const lower = center.toLowerCase();
  if (lower === 'fiesta') return 'Fiesta';
  if (lower === 'recargas' || lower === 'recarga') return 'Recargas';
  if (lower === 'estancias' || lower === 'estancia') return 'Estancias';
  return 'Abarrotes'; // Default
};

const UtilityInputRow = ({ 
  cat, 
  costMargin, 
  onChange 
}: { 
  cat: string; 
  costMargin: number; 
  onChange: (value: number) => void; 
}) => {
  const initialUtility = (100 - costMargin).toFixed(2).replace(/\.?0+$/, '');
  const [inputValue, setInputValue] = useState(initialUtility);

  // Sync if prop changes externally
  useEffect(() => {
    const currentUtilStr = (100 - costMargin).toFixed(2).replace(/\.?0+$/, '');
    if (parseFloat(inputValue) !== parseFloat(currentUtilStr)) {
      setInputValue(currentUtilStr);
    }
  }, [costMargin]);

  const handleChange = (val: string) => {
    setInputValue(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed)) {
      const clamped = Math.max(0, Math.min(100, parsed));
      const newCostMargin = Number((100 - clamped).toFixed(2));
      onChange(newCostMargin);
    }
  };

  const handleBlur = () => {
    const parsed = parseFloat(inputValue);
    if (isNaN(parsed)) {
      const resetVal = (100 - costMargin).toFixed(2).replace(/\.?0+$/, '');
      setInputValue(resetVal);
    } else {
      const clamped = Math.max(0, Math.min(100, parsed));
      const formatted = clamped.toFixed(2).replace(/\.?0+$/, '');
      setInputValue(formatted);
    }
  };

  return (
    <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950/45 rounded-2xl border border-slate-100 dark:border-slate-800/40">
      <div className="text-left">
        <p className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">{cat}</p>
        <p className="text-[9px] font-bold text-slate-400 mt-0.5">
          Equivale a: <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">{costMargin}% Costo</span>
        </p>
      </div>
      <div className="flex items-center gap-2">
        <div className="relative flex items-center bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-inner focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all">
          <input 
            type="number" 
            min="0" 
            max="100" 
            step="any"
            value={inputValue} 
            onChange={(e) => handleChange(e.target.value)}
            onBlur={handleBlur}
            className="w-16 bg-transparent text-right font-black text-sm text-slate-800 dark:text-slate-100 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="ml-1 text-[10px] font-bold text-slate-400">% Utilidad</span>
        </div>
      </div>
    </div>
  );
};

const FinanceStatsTotalsScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'rentabilidad' | 'flujo_caja'>('rentabilidad');
  const [periodType, setPeriodType] = useState<PeriodType>('month');
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [movements, setMovements] = useState<AccountMovement[]>([]);
  
  // Margen de costos por defecto
  const [costMargins, setCostMargins] = useState<Record<string, number>>({
    abarrotes: 83.33,
    fiesta: 75.00,
    recargas: 95.00,
    estancias: 50.00,
    otros: 80.00
  });

  // Toggle para tratar sobrantes como ventas
  const [sobrantesComoVentas, setSobrantesComoVentas] = useState(false);

  // Catálogo de productos en memoria para Costo de Venta
  const [catalog, setCatalog] = useState<Array<{
    productKey: string;
    Nombre_Completo: string;
    Costo_unidad: number;
    Categoria: string;
  }>>([]);

  // Caja Inicial para el periodo seleccionado
  const [cajaInicial, setCajaInicial] = useState<number>(0);
  const [loadingCajaInicial, setLoadingCajaInicial] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  const formatMXN = (val: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);

  // Date Range Calculation
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
    } else if (periodType === 'month') {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(start.getMonth() + 1);
      end.setDate(0);
      end.setHours(23, 59, 59, 999);
    } else if (periodType === 'year') {
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(11, 31);
      end.setHours(23, 59, 59, 999);
    }
    return { start, end };
  }, [currentDate, periodType]);

  // Load configuration and products catalog
  useEffect(() => {
    if (!user) return;
    const loadSettingsAndCatalog = async () => {
      try {
        // 1. Load settings
        const settingsSnap = await getDoc(doc(db, "users", user.uid, "settings", "financial_engine"));
        if (settingsSnap.exists()) {
          const data = settingsSnap.data();
          if (data.costMargins) setCostMargins(data.costMargins);
          if (data.sobrantesComoVentas !== undefined) setSobrantesComoVentas(data.sobrantesComoVentas);
        }

        // 2. Load catalog
        const prodsSnap = await getDocs(collection(db, "products"));
        const costsSnap = await getDocs(collection(db, "costs_catalog"));
        
        const prodsMap = new Map<string, string>();
        prodsSnap.docs.forEach(doc => {
          const d = doc.data();
          prodsMap.set(doc.id, d.Categoría || d.Categoria || 'Abarrotes');
        });

        const catData = costsSnap.docs.map(doc => {
          const d = doc.data();
          const productKey = doc.id;
          return {
            productKey,
            Nombre_Completo: String(d.Nombre_Completo || ''),
            Costo_unidad: d.Costo_unidad ? parseFloat(String(d.Costo_unidad).replace(/[$,]/g, '')) : 0,
            Categoria: prodsMap.get(productKey) || 'Abarrotes'
          };
        });
        setCatalog(catData);
      } catch (err) {
        console.error("Error loading financial settings or catalog:", err);
      }
    };
    loadSettingsAndCatalog();
  }, [user]);

  // Subscribe to movements in selected range
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    AccountResolver.loadIndex(user.uid);
    const unsub = AccountingService.subscribeToMovements(user.uid, dateRange.start, dateRange.end, (movs) => {
      setMovements(movs);
      setLoading(false);
    }, (err) => {
      setLoading(false);
    });
    return () => unsub();
  }, [user, dateRange]);

  // Fetch Caja Inicial
  useEffect(() => {
    if (!user) return;
    const loadCajaInicial = async () => {
      setLoadingCajaInicial(true);
      try {
        const qPrev = query(
          collectionGroup(db, "movements"),
          where("uid", "==", user.uid),
          where("createdAt", "<", Timestamp.fromDate(dateRange.start))
        );
        const snap = await getDocs(qPrev);
        let prevSum = 0;
        snap.docs.forEach(doc => {
          const d = doc.data() as any;
          if (d.status === 'DELETED' || d.status === 'VOID' || d.status === 'MOVED') return;
          if (d.accountId === 'inventarios') return; // Exclude inventory
          
          if (getAfectaCaja(d)) {
            const amt = Number(d.amount || 0);
            const dir = d.direction || (d.type === 'INCOME' ? 'IN' : 'OUT');
            if (dir === 'IN') prevSum += amt;
            else if (dir === 'OUT') prevSum -= amt;
          }
        });
        setCajaInicial(prevSum);
      } catch (err) {
        console.error("Error loading previous cash balance:", err);
      } finally {
        setLoadingCajaInicial(false);
      }
    };
    loadCajaInicial();
  }, [user, dateRange.start]);

  // Save Settings
  const handleSaveSettings = async (newMargins: Record<string, number>, newSobrantesVenta: boolean) => {
    if (!user) return;
    setSavingSettings(true);
    try {
      await setDoc(doc(db, "users", user.uid, "settings", "financial_engine"), {
        costMargins: newMargins,
        sobrantesComoVentas: newSobrantesVenta,
        updatedAt: new Date()
      }, { merge: true });
    } catch (e) {
      console.error("Error saving financial engine settings:", e);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleMarginChange = (cat: string, value: number) => {
    const updated = { ...costMargins, [cat]: value };
    setCostMargins(updated);
    handleSaveSettings(updated, sobrantesComoVentas);
  };

  const handleToggleSobrantes = () => {
    const newVal = !sobrantesComoVentas;
    setSobrantesComoVentas(newVal);
    handleSaveSettings(costMargins, newVal);
  };

  // MOTOR 1: ESTADO DE RESULTADOS (Rentabilidad)
  const rentabilidadEngine = useMemo(() => {
    let ventasContado = 0;
    let ventasCredito = 0;
    let exactCatalogCosts = 0;
    let estimatedCategoryCosts = 0;
    
    const ventasPorCentro: Record<string, { contado: number, credito: number, total: number }> = {
      Abarrotes: { contado: 0, credito: 0, total: 0 },
      Fiesta: { contado: 0, credito: 0, total: 0 },
      Recargas: { contado: 0, credito: 0, total: 0 },
      Estancias: { contado: 0, credito: 0, total: 0 }
    };

    const costoPorCentro: Record<string, number> = {
      Abarrotes: 0,
      Fiesta: 0,
      Recargas: 0,
      Estancias: 0
    };

    const gastosPorCentro: Record<string, number> = {
      Abarrotes: 0,
      Fiesta: 0,
      Recargas: 0,
      Estancias: 0
    };

    let sueldos = 0;
    let bonos = 0;
    let renta = 0;
    let gastosAdministrativos = 0;
    let consumoEmpleados = 0;
    let cortesias = 0;
    let faltantes = 0;
    let otrosGastos = 0;

    movements.forEach(m => {
      if (m.status === 'VOID' || m.status === 'DELETED' || m.status === 'MOVED') return;
      if (m.accountId === 'inventarios') return; // Strict boundary: no inventory modifications

      const amount = Number(m.amount) || 0;
      const concept = (m.conceptTitle || '').toLowerCase();
      const opType = m.tipo_operacion || '';
      const rubric = m.rubro || m.accountId || '';
      const account = (m.cuenta_contable || '').toLowerCase();
      const center = getCentroUtilidad(m);

      const isControl = getEsControl(m);
      const isSale = getAfectaVentas(m);
      const isCxC = getAfectaCxC(m);

      // Check if it's a sale
      const isContadoSale = (isSale && !isCxC && !isControl) || opType === 'venta_contado';
      const isCreditSale = (isSale && isCxC && !isControl) || opType === 'venta_credito';
      const isSobranteVenta = (opType === 'sobrante_caja' || rubric === 'in_sobrante') && sobrantesComoVentas;

      let isAnySale = false;
      let saleCenter = center;

      if (isContadoSale || isSobranteVenta) {
        const actualCenter = isSobranteVenta ? 'Abarrotes' : center;
        ventasContado += amount;
        if (ventasPorCentro[actualCenter]) {
          ventasPorCentro[actualCenter].contado += amount;
          ventasPorCentro[actualCenter].total += amount;
        }
        isAnySale = true;
        saleCenter = actualCenter;
      } else if (isCreditSale) {
        ventasCredito += amount;
        if (ventasPorCentro[center]) {
          ventasPorCentro[center].credito += amount;
          ventasPorCentro[center].total += amount;
        }
        isAnySale = true;
        saleCenter = center;
      }

      // Cost of sales calculation
      if (isAnySale) {
        let matchedCost = 0;
        let isMatched = false;

        // A. Structured product array
        if ((m as any).productos && Array.isArray((m as any).productos)) {
          (m as any).productos.forEach((p: any) => {
            matchedCost += Number(p.costo || p.cost || 0) * Number(p.cantidad || p.qty || 1);
          });
          isMatched = true;
        } else if ((m as any).items && Array.isArray((m as any).items)) {
          (m as any).items.forEach((p: any) => {
            matchedCost += Number(p.costo || p.cost || 0) * Number(p.cantidad || p.qty || 1);
          });
          isMatched = true;
        } else {
          // B. Exact concept title string match to costs_catalog
          const matchedProd = catalog.find(p => p.Nombre_Completo.toLowerCase() === m.conceptTitle.trim().toLowerCase());
          if (matchedProd) {
            let qty = 1;
            const qtyMatch = m.conceptTitle.match(/(\d+)\s*x/i) || m.conceptTitle.match(/x\s*(\d+)/i);
            if (qtyMatch) qty = parseInt(qtyMatch[1]) || 1;
            
            matchedCost = matchedProd.Costo_unidad * qty;
            isMatched = true;
          }
        }

        if (isMatched) {
          exactCatalogCosts += matchedCost;
          if (costoPorCentro[saleCenter] !== undefined) {
            costoPorCentro[saleCenter] += matchedCost;
          }
        } else {
          // C. Fallback: Configurable average cost percentage
          const costPct = costMargins[saleCenter.toLowerCase()] || costMargins.abarrotes || 83.33;
          const estimatedCost = Number((amount * (costPct / 100)).toFixed(2));
          estimatedCategoryCosts += estimatedCost;
          if (costoPorCentro[saleCenter] !== undefined) {
            costoPorCentro[saleCenter] += estimatedCost;
          }
        }
      }

      // Expenses classification
      const isExpense = m.type === 'EXPENSE' || m.direction === 'OUT' || getAfectaGasto(m);
      if (isExpense && !isAnySale) {
        const isPurchase = opType === 'compra_mercancia' || rubric === 'ex_mercancias' || rubric === 'ex_fiesta' || rubric === 'ex_recargas';
        if (!isPurchase) {
          let expenseAmount = amount;
          let isClassifiedExpense = false;

          if (opType === 'consumo_empleados' || account === 'consumo empleados' || rubric === 'ex_consumo_empleados') {
            expenseAmount = amount * 0.82;
            consumoEmpleados += expenseAmount;
            isClassifiedExpense = true;
          } else if (opType === 'cortesia' || account === 'cortesías' || rubric === 'ex_personal') {
            expenseAmount = amount * 0.82;
            cortesias += expenseAmount;
            isClassifiedExpense = true;
          } else if (account === 'renta' || rubric === 'ex_renta') {
            renta += amount;
            isClassifiedExpense = true;
          } else if (account === 'sueldos' || rubric === 'ex_empleados') {
            sueldos += amount;
            isClassifiedExpense = true;
          } else if (concept.includes('bono') || account === 'bonos') {
            bonos += amount;
            isClassifiedExpense = true;
          } else if (opType === 'faltante_caja' || rubric === 'ex_faltante') {
            faltantes += amount;
            isClassifiedExpense = true;
          } else if (account === 'gastos administrativos' || rubric === 'ex_mantenimiento' || rubric === 'ex_gastos_administrativos' || rubric === 'ex_estancias_admin' || account === 'gastos administrativos estancias') {
            gastosAdministrativos += amount;
            isClassifiedExpense = true;
          } else {
            otrosGastos += amount;
            isClassifiedExpense = true;
          }

          if (isClassifiedExpense) {
            if (gastosPorCentro[center] !== undefined) {
              gastosPorCentro[center] += expenseAmount;
            }
          }
        }
      }
    });

    const ventasTotales = ventasContado + ventasCredito;
    const costoVentasTotal = exactCatalogCosts + estimatedCategoryCosts;
    const utilidadBruta = ventasTotales - costoVentasTotal;
    const totalGastosOperativos = sueldos + bonos + renta + gastosAdministrativos + consumoEmpleados + cortesias + faltantes + otrosGastos;
    const utilidadOperativa = utilidadBruta - totalGastosOperativos;

    const margenBruto = ventasTotales > 0 ? (utilidadBruta / ventasTotales) * 100 : 0;
    const margenOperativo = ventasTotales > 0 ? (utilidadOperativa / ventasTotales) * 100 : 0;

    const centrosList = Object.keys(ventasPorCentro).map(center => {
      const v = ventasPorCentro[center];
      const c = costoPorCentro[center] || 0;
      const exp = gastosPorCentro[center] || 0;
      const ub = v.total - c;
      const mb = v.total > 0 ? (ub / v.total) * 100 : 0;
      const uop = ub - exp;
      const mop = v.total > 0 ? (uop / v.total) * 100 : 0;
      const part = ventasTotales > 0 ? (v.total / ventasTotales) * 100 : 0;
      return {
        name: center,
        ventas: v.total,
        ventasContado: v.contado,
        ventasCredito: v.credito,
        costo: c,
        utilidadBruta: ub,
        margenBruto: mb,
        gastosOperativos: exp,
        utilidadOperativa: uop,
        margenOperativo: mop,
        participacion: part
      };
    });

    return {
      ventasTotales,
      ventasContado,
      ventasCredito,
      costoVentasTotal,
      exactCatalogCosts,
      estimatedCategoryCosts,
      utilidadBruta,
      totalGastosOperativos,
      utilidadOperativa,
      margenBruto,
      margenOperativo,
      sueldos,
      bonos,
      renta,
      gastosAdministrativos,
      consumoEmpleados,
      cortesias,
      faltantes,
      otrosGastos,
      centrosList
    };
  }, [movements, catalog, costMargins, sobrantesComoVentas]);

  // MOTOR 2: FLUJO DE CAJA (Cash Flow)
  const flujoCajaEngine = useMemo(() => {
    let ventasCobradas = 0;
    let cobranzaCxC = 0;
    let sobrantes = 0;
    let otrosIngresos = 0;

    let compras = 0;
    let gastosAdministrativos = 0;
    let sueldos = 0;
    let bonos = 0;
    let renta = 0;
    let recargas = 0;
    let faltantes = 0;
    let otrosEgresos = 0;

    movements.forEach(m => {
      if (m.status === 'VOID' || m.status === 'DELETED' || m.status === 'MOVED') return;
      if (m.accountId === 'inventarios') return;

      const affectsCash = getAfectaCaja(m);
      if (!affectsCash) return;

      const amount = Number(m.amount) || 0;
      const concept = (m.conceptTitle || '').toLowerCase();
      const opType = m.tipo_operacion || '';
      const rubric = m.rubro || m.accountId || '';
      const account = (m.cuenta_contable || '').toLowerCase();

      // Exclude employee consumption and courtesies (no real physical cash outflow)
      const isConsumo = opType === 'consumo_empleados' || account === 'consumo empleados' || rubric === 'ex_consumo_empleados';
      const isCortesias = opType === 'cortesia' || account === 'cortesías' || rubric === 'ex_personal';
      if (isConsumo || isCortesias) return;

      const isDirectionIn = m.direction === 'IN' || m.type === 'INCOME';

      if (isDirectionIn) {
        if (opType === 'venta_contado' || (getAfectaVentas(m) && !getAfectaCxC(m))) {
          ventasCobradas += amount;
        } else if (opType === 'cobranza_cxc' || rubric === 'in_cxc_pago') {
          cobranzaCxC += amount;
        } else if (opType === 'sobrante_caja' || rubric === 'in_sobrante') {
          sobrantes += amount;
        } else {
          otrosIngresos += amount;
        }
      } else {
        if (opType === 'compra_mercancia' || rubric === 'ex_mercancias' || rubric === 'ex_fiesta') {
          compras += amount;
        } else if (rubric === 'ex_recargas' || account.includes('recarga') || concept.includes('recarga')) {
          recargas += amount;
        } else if (account === 'sueldos' || rubric === 'ex_empleados') {
          sueldos += amount;
        } else if (concept.includes('bono') || account === 'bonos') {
          bonos += amount;
        } else if (account === 'renta' || rubric === 'ex_renta') {
          renta += amount;
        } else if (opType === 'faltante_caja' || rubric === 'ex_faltante') {
          faltantes += amount;
        } else if (account === 'gastos administrativos' || rubric === 'ex_mantenimiento' || rubric === 'ex_gastos_administrativos' || rubric === 'ex_estancias_admin' || account === 'gastos administrativos estancias') {
          gastosAdministrativos += amount;
        } else {
          otrosEgresos += amount;
        }
      }
    });

    const totalEntradas = ventasCobradas + cobranzaCxC + sobrantes + otrosIngresos;
    const totalSalidas = compras + gastosAdministrativos + sueldos + bonos + renta + recargas + otrosEgresos + faltantes;
    const flujoNeto = totalEntradas - totalSalidas;

    return {
      ventasCobradas,
      cobranzaCxC,
      sobrantes,
      otrosIngresos,
      totalEntradas,
      compras,
      gastosAdministrativos,
      sueldos,
      bonos,
      renta,
      recargas,
      otrosEgresos,
      faltantes,
      totalSalidas,
      flujoNeto
    };
  }, [movements]);

  const cajaFinal = cajaInicial + flujoCajaEngine.flujoNeto;

  const changePeriod = (dir: number) => {
    const next = new Date(currentDate);
    if (periodType === 'day') next.setDate(next.getDate() + dir);
    else if (periodType === 'week') next.setDate(next.getDate() + (dir * 7));
    else if (periodType === 'month') next.setMonth(next.getMonth() + dir);
    else if (periodType === 'year') next.setFullYear(next.getFullYear() + dir);
    setCurrentDate(next);
  };

  // Daily running cash flow dataset for charts
  const chartData = useMemo(() => {
    const dailyMap: Record<string, { dateLabel: string, entradas: number, salidas: number, balance: number }> = {};
    const formatDate = (d: Date) => {
      const day = String(d.getDate()).padStart(2, '0');
      const month = d.toLocaleDateString('es-MX', { month: 'short' });
      return `${day} ${month}`;
    };

    // Initialize all dates in range with zero values
    let current = new Date(dateRange.start);
    while (current <= dateRange.end) {
      const key = formatDate(current);
      dailyMap[key] = { dateLabel: key, entradas: 0, salidas: 0, balance: 0 };
      current.setDate(current.getDate() + 1);
    }

    movements.forEach(m => {
      if (m.status === 'VOID' || m.status === 'DELETED' || m.status === 'MOVED') return;
      if (m.accountId === 'inventarios') return;

      if (!getAfectaCaja(m)) return;

      const date = m.createdAt ? new Date(m.createdAt) : new Date();
      const key = formatDate(date);
      if (dailyMap[key]) {
        const amount = Number(m.amount) || 0;
        if (m.type === 'INCOME' || m.direction === 'IN') {
          dailyMap[key].entradas += amount;
        } else if (m.type === 'EXPENSE' || m.direction === 'OUT') {
          dailyMap[key].salidas += amount;
        }
      }
    });

    // Compute rolling balance starting from Caja Inicial
    let rolling = cajaInicial;
    return Object.entries(dailyMap).map(([_, val]) => {
      rolling += val.entradas - val.salidas;
      return {
        ...val,
        balance: rolling
      };
    }).sort((a, b) => a.dateLabel.localeCompare(b.dateLabel));
  }, [movements, dateRange, cajaInicial]);

  // Executive PDF Generator incorporating BOTH engines
  const handleDownloadPDF = () => {
    if (movements.length === 0) return;
    
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      
      // Page 1: Estado de Resultados (Rentabilidad)
      doc.setFillColor(15, 23, 42); // Sophisticated Slate Dark
      doc.rect(0, 0, pageWidth, 42, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.text("ESTADO DE RESULTADOS GERENCIAL V2", 14, 18);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      const rangeStr = `Periodo evaluado: ${dateRange.start.toLocaleDateString('es-MX')} al ${dateRange.end.toLocaleDateString('es-MX')}`;
      doc.text(rangeStr, 14, 26);
      doc.text(`Abarrotes F1 • Generado el: ${new Date().toLocaleString('es-MX')} • Usuario: ${user?.email || 'Gerente'}`, 14, 32);

      // Profitability Executive Stats Grid
      doc.setDrawColor(226, 232, 240);
      doc.setFillColor(248, 250, 252);
      
      // Sales Card
      doc.roundedRect(14, 48, 56, 22, 2, 2, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 110, 130);
      doc.text("VENTAS TOTALES", 18, 54);
      doc.setFontSize(12);
      doc.setTextColor(30, 41, 59);
      doc.text(formatMXN(rentabilidadEngine.ventasTotales), 18, 63);

      // COGS Card
      doc.roundedRect(77, 48, 56, 22, 2, 2, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 110, 130);
      doc.text("COSTO DE VENTAS (COGS)", 81, 54);
      doc.setFontSize(12);
      doc.setTextColor(220, 38, 38);
      doc.text(formatMXN(rentabilidadEngine.costoVentasTotal), 81, 63);

      // Operating Profit Card
      const isProfitable = rentabilidadEngine.utilidadOperativa >= 0;
      doc.setFillColor(isProfitable ? 240 : 254, isProfitable ? 253 : 242, isProfitable ? 244 : 242);
      doc.setDrawColor(isProfitable ? 187 : 254, isProfitable ? 247 : 202, isProfitable ? 208 : 202);
      doc.roundedRect(140, 48, 56, 22, 2, 2, 'FD');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 110, 130);
      doc.text("UTILIDAD OPERATIVA", 144, 54);
      doc.setFontSize(12);
      doc.setTextColor(isProfitable ? 21 : 185, isProfitable ? 128 : 28, isProfitable ? 61 : 28);
      doc.text(formatMXN(rentabilidadEngine.utilidadOperativa), 144, 63);

      // Income Statement Details Table
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text("DESGLOSE DE RENTABILIDAD GENERAL", 14, 82);

      const incomeRows = [
        ['(+) Ventas de Contado', formatMXN(rentabilidadEngine.ventasContado), 'Ingresos directos por ventas en efectivo/tarjeta.'],
        ['(+) Ventas a Crédito (CxC)', formatMXN(rentabilidadEngine.ventasCredito), 'Ventas comprometidas por cobrar.'],
        ['(=) VENTAS TOTALES', formatMXN(rentabilidadEngine.ventasTotales), 'Mide el volumen de ventas total sin incluir cobranza ni ajustes.'],
        ['(-) Costo de Ventas (COGS)', formatMXN(rentabilidadEngine.costoVentasTotal), 'Costo directo de mercancías vendidas (Catálogo + Estimado).'],
        ['(=) UTILIDAD BRUTA', formatMXN(rentabilidadEngine.utilidadBruta), `Margen comercial de ganancia bruta (${rentabilidadEngine.margenBruto.toFixed(1)}%).`],
        ['(-) Sueldos / Nómina', formatMXN(rentabilidadEngine.sueldos), 'Egresos dedicados a salarios de personal.'],
        ['(-) Bonos / Incentivos', formatMXN(rentabilidadEngine.bonos), 'Bonificaciones por metas.'],
        ['(-) Renta', formatMXN(rentabilidadEngine.renta), 'Gasto de renta de inmueble.'],
        ['(-) Gastos Administrativos', formatMXN(rentabilidadEngine.gastosAdministrativos), 'Gastos generales y de operación.'],
        ['(-) Consumo Empleados (Costo)', formatMXN(rentabilidadEngine.consumoEmpleados), 'Consumos de stock valuados al 82% real de costo.'],
        ['(-) Cortesías / Consumo Personal', formatMXN(rentabilidadEngine.cortesias), 'Cortesías operativas valuadas al 82% real de costo.'],
        ['(-) Faltantes de Caja', formatMXN(rentabilidadEngine.faltantes), 'Faltantes detectados en arqueo.'],
        ['(-) Otros Gastos Operativos', formatMXN(rentabilidadEngine.otrosGastos), 'Mantenimiento y otros egresos de operación.'],
        ['(=) UTILIDAD OPERATIVA (NETA)', formatMXN(rentabilidadEngine.utilidadOperativa), `Rendimiento neto real del negocio (${rentabilidadEngine.margenOperativo.toFixed(1)}% de las ventas).`]
      ];

      autoTable(doc, {
        startY: 86,
        head: [['Cuenta Contable', 'Monto', 'Concepto / Propósito']],
        body: incomeRows,
        theme: 'striped',
        styles: { fontSize: 8.5, cellPadding: 3, font: 'helvetica' },
        headStyles: { fillColor: [30, 41, 59], fontStyle: 'bold', textColor: 255 },
        columnStyles: {
          1: { halign: 'right', fontStyle: 'bold' }
        }
      });

      // Utility Centers Table
      const lastY = (doc as any).lastAutoTable.finalY || 160;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text("ESTADO DE RESULTADOS POR CENTRO DE UTILIDAD", 14, lastY + 12);

      const centerRows = rentabilidadEngine.centrosList.map(c => [
        c.name,
        formatMXN(c.ventas),
        formatMXN(c.costo),
        formatMXN(c.utilidadBruta),
        `${c.margenBruto.toFixed(1)}%`,
        formatMXN(c.gastosOperativos),
        formatMXN(c.utilidadOperativa),
        `${c.margenOperativo.toFixed(1)}%`,
        `${c.participacion.toFixed(1)}%`
      ]);

      autoTable(doc, {
        startY: lastY + 16,
        head: [['Centro de Utilidad', 'Ventas Totales', 'Costo de Ventas', 'Utilidad Bruta', 'Margen Bruto %', 'Gastos Op.', 'Utilidad Op.', 'Margen Op. %', 'Participación']],
        body: centerRows,
        theme: 'striped',
        styles: { fontSize: 8.5, cellPadding: 3, font: 'helvetica' },
        headStyles: { fillColor: [79, 70, 229], fontStyle: 'bold', textColor: 255 },
        columnStyles: {
          1: { halign: 'right' },
          2: { halign: 'right' },
          3: { halign: 'right' },
          4: { halign: 'right' },
          5: { halign: 'right' },
          6: { halign: 'right' },
          7: { halign: 'right', fontStyle: 'bold' },
          8: { halign: 'right' },
          9: { halign: 'right' }
        }
      });

      // Page 2: Flujo de Caja (Cash Flow)
      doc.addPage();
      doc.setFillColor(79, 70, 229); // Premium Indigo Header for Cash Flow
      doc.rect(0, 0, pageWidth, 42, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.text("ESTADO DE FLUJO DE CAJA V2", 14, 18);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.text(rangeStr, 14, 26);
      doc.text(`Análisis Exclusivo de Movimiento de Efectivo • Caja F1`, 14, 32);

      // Cash Flow Executive Cards
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      
      // Caja Inicial Card
      doc.roundedRect(14, 48, 41, 22, 2, 2, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(100, 110, 130);
      doc.text("SALDO INICIAL CAJA", 16, 54);
      doc.setFontSize(10.5);
      doc.setTextColor(30, 41, 59);
      doc.text(formatMXN(cajaInicial), 16, 63);

      // Entradas Card
      doc.roundedRect(61, 48, 41, 22, 2, 2, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(100, 110, 130);
      doc.text("(+) ENTRADAS DE CAJA", 63, 54);
      doc.setFontSize(10.5);
      doc.setTextColor(16, 185, 129);
      doc.text(formatMXN(flujoCajaEngine.totalEntradas), 63, 63);

      // Salidas Card
      doc.roundedRect(108, 48, 41, 22, 2, 2, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(100, 110, 130);
      doc.text("(-) SALIDAS DE CAJA", 110, 54);
      doc.setFontSize(10.5);
      doc.setTextColor(239, 68, 68);
      doc.text(formatMXN(flujoCajaEngine.totalSalidas), 110, 63);

      // Caja Final Card
      const isPositiveFlow = flujoCajaEngine.flujoNeto >= 0;
      doc.setFillColor(isPositiveFlow ? 240 : 254, isPositiveFlow ? 253 : 242, isPositiveFlow ? 244 : 242);
      doc.setDrawColor(isPositiveFlow ? 187 : 254, isPositiveFlow ? 247 : 202, isPositiveFlow ? 208 : 202);
      doc.roundedRect(155, 48, 41, 22, 2, 2, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(100, 110, 130);
      doc.text("SALDO FINAL CAJA", 157, 54);
      doc.setFontSize(10.5);
      doc.setTextColor(isPositiveFlow ? 21 : 185, isPositiveFlow ? 128 : 28, isPositiveFlow ? 61 : 28);
      doc.text(formatMXN(cajaFinal), 157, 63);

      // Cash Flow Details Table
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text("CONCILIACIÓN INTEGRAL DE FLUJO DE EFECTIVO", 14, 82);

      const cashFlowRows = [
        ['(+) Ventas Cobradas (Contado)', formatMXN(flujoCajaEngine.ventasCobradas), 'Ingresos de ventas ordinarios en efectivo.'],
        ['(+) Cobranza de Créditos (CxC)', formatMXN(flujoCajaEngine.cobranzaCxC), 'Pagos recibidos de deudas de clientes (No altera ventas).'],
        ['(+) Sobrantes de Caja', formatMXN(flujoCajaEngine.sobrantes), 'Efectivo excedente conciliado en corte.'],
        ['(+) Otros Ingresos de Efectivo', formatMXN(flujoCajaEngine.otrosIngresos), 'Transferencias o captaciones complementarias.'],
        ['(=) TOTAL ENTRADAS DE CAJA', formatMXN(flujoCajaEngine.totalEntradas), 'Suma absoluta de efectivo ingresado en el lapso.'],
        ['(-) Compras de Mercancía', formatMXN(flujoCajaEngine.compras), 'Efectivo pagado por mercancías directas.'],
        ['(-) Gastos Administrativos', formatMXN(flujoCajaEngine.gastosAdministrativos), 'Efectivo pagado por gastos administrativos.'],
        ['(-) Sueldos de Personal', formatMXN(flujoCajaEngine.sueldos), 'Nóminas liquidadas de empleados en efectivo.'],
        ['(-) Bonos', formatMXN(flujoCajaEngine.bonos), 'Incentivos entregados en efectivo.'],
        ['(-) Renta de Inmueble', formatMXN(flujoCajaEngine.renta), 'Alquiler del establecimiento liquidados.'],
        ['(-) Compra / Fondeo Recargas', formatMXN(flujoCajaEngine.recargas), 'Efectivo destinado a recargas.'],
        ['(-) Faltantes de Caja', formatMXN(flujoCajaEngine.faltantes), 'Diferencias negativas en conciliación de arqueo.'],
        ['(-) Otros Egresos Diversos', formatMXN(flujoCajaEngine.otrosEgresos), 'Egresos generales liquidados en caja.'],
        ['(=) TOTAL SALIDAS DE CAJA', formatMXN(flujoCajaEngine.totalSalidas), 'Suma absoluta de efectivo desembolsado.'],
        ['(=) FLUJO NETO EN PERIODO', formatMXN(flujoCajaEngine.flujoNeto), 'Variación del efectivo neto en este periodo.']
      ];

      autoTable(doc, {
        startY: 86,
        head: [['Rubro de Caja', 'Monto', 'Concepto / Justificación']],
        body: cashFlowRows,
        theme: 'striped',
        styles: { fontSize: 8.5, cellPadding: 3, font: 'helvetica' },
        headStyles: { fillColor: [79, 70, 229], fontStyle: 'bold', textColor: 255 },
        columnStyles: {
          1: { halign: 'right', fontStyle: 'bold' }
        }
      });

      // Executive Audit Statement
      const finalAuditY = (doc as any).lastAutoTable.finalY || 180;
      doc.setDrawColor(226, 232, 240);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(14, finalAuditY + 8, 182, 24, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
      doc.text("AUDITORÍA DE CONCILIACIÓN DE EFECTIVO", 18, finalAuditY + 14);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text(`La Caja inició con ${formatMXN(cajaInicial)}, registró entradas netas por ${formatMXN(flujoCajaEngine.totalEntradas)}, salidas por ${formatMXN(flujoCajaEngine.totalSalidas)}, dando un Flujo Neto de ${formatMXN(flujoCajaEngine.flujoNeto)}.`, 18, finalAuditY + 20);
      doc.text(`Saldo disponible auditado final en Caja: ${formatMXN(cajaFinal)}.`, 18, finalAuditY + 24);

      // Signatures
      const sigY = doc.internal.pageSize.height - 25;
      doc.setDrawColor(200, 200, 200);
      doc.line(14, sigY, 74, sigY);
      doc.line(136, sigY, 196, sigY);
      
      doc.setFontSize(8);
      doc.setTextColor(100, 110, 120);
      doc.text("Responsable de Contabilidad", 14, sigY + 4);
      doc.text("Firma de Dirección Ejecutiva", 136, sigY + 4);

      // Footers
      const pagesCount = doc.internal.pages.length;
      for (let i = 1; i <= pagesCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        doc.text(`Página ${i} de ${pagesCount} • Motor Financiero Gerencial V2 • Abarrotes F-1`, pageWidth - 86, doc.internal.pageSize.height - 10);
      }

      const pLabel = periodType === 'day' ? 'Dia' : periodType === 'week' ? 'Semana' : periodType === 'month' ? 'Mes' : 'Año';
      doc.save(`F1_Reporte_Financiero_V2_${pLabel}_${Date.now()}.pdf`);
    } catch (err) {
      console.error("Error generating comprehensive PDF:", err);
    }
  };

  return (
    <div className="relative flex flex-col h-screen w-full max-w-md mx-auto bg-background-light dark:bg-background-dark font-display antialiased overflow-hidden text-slate-800 dark:text-slate-100">
      
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background-light/95 dark:bg-background-dark/95 border-b border-slate-200 dark:border-white/5 backdrop-blur-md pt-12 px-5 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1">
            <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-slate-200 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300 transition-colors">
              <ArrowLeft className="size-5" />
            </button>
            <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">Análisis Gerencial</h1>
          </div>
          
          <button 
            onClick={handleDownloadPDF} 
            disabled={movements.length === 0}
            className="flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-indigo-500 hover:bg-indigo-600 disabled:opacity-30 disabled:pointer-events-none transition-all text-[10px] font-black uppercase tracking-widest text-white shadow-md shadow-indigo-500/10"
          >
            <Download className="size-3.5" />
            <span>PDF</span>
          </button>
        </div>

        {/* Time Selector */}
        <div className="mb-4">
          <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 w-full">
            {(['day', 'week', 'month', 'year'] as PeriodType[]).map(t => (
              <button 
                key={t} 
                onClick={() => setPeriodType(t)} 
                className={`flex-1 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all duration-300 ${periodType === t ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm font-bold' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}`}
              >
                {t === 'day' ? 'Día' : t === 'week' ? 'Semana' : t === 'month' ? 'Mes' : 'Año'}
              </button>
            ))}
          </div>
        </div>

        {/* Date Selector Navigation */}
        <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-950 rounded-2xl p-2 mb-4 border border-slate-200 dark:border-slate-800">
          <button onClick={() => changePeriod(-1)} className="p-2 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors active:scale-90">
            <ChevronLeft className="size-4" />
          </button>
          <div className="text-center">
            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-500 leading-none mb-1">Rango Contable</p>
            <p className="text-[10px] font-extrabold text-slate-900 dark:text-white">
              {dateRange.start.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })} - {dateRange.end.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          </div>
          <button onClick={() => changePeriod(1)} className="p-2 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors active:scale-90">
            <ChevronRight className="size-4" />
          </button>
        </div>

        {/* Dual Engine Switch Tabs */}
        <div className="flex p-1 bg-slate-100 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <button 
            onClick={() => setActiveTab('rentabilidad')} 
            className={`flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-1.5 ${activeTab === 'rentabilidad' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}`}
          >
            <Layers className="size-3.5" />
            <span>Rentabilidad (E.R)</span>
          </button>
          <button 
            onClick={() => setActiveTab('flujo_caja')} 
            className={`flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-1.5 ${activeTab === 'flujo_caja' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}`}
          >
            <CreditCard className="size-3.5" />
            <span>Flujo de Caja</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-4 py-6 space-y-6 no-scrollbar pb-32">
        {loading ? (
          <div className="py-32 flex flex-col items-center justify-center gap-4">
            <RefreshCw className="size-10 animate-spin text-indigo-500" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 animate-pulse">Procesando transacciones...</p>
          </div>
        ) : movements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="size-16 bg-white dark:bg-slate-900 rounded-3xl flex items-center justify-center mb-4 border border-slate-200 dark:border-slate-800">
              <LayoutDashboard className="size-7 text-slate-500 dark:text-slate-600" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">Sin registros</p>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 max-w-[200px]">No hay movimientos registrados en esta ventana temporal.</p>
          </div>
        ) : activeTab === 'rentabilidad' ? (
          // MOTOR 1 ENGINE VIEW
          <div className="space-y-6 animate-in fade-in duration-300">
            
            {/* Profitability Banner */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 relative overflow-hidden group">
              <p className="text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1">Resultado de Rentabilidad Neto</p>
              <h2 className={`text-3xl font-black tracking-tight mb-2 ${rentabilidadEngine.utilidadOperativa >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {formatMXN(rentabilidadEngine.utilidadOperativa)}
              </h2>
              <div className="flex gap-2 items-center">
                <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${rentabilidadEngine.utilidadOperativa >= 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'}`}>
                  {rentabilidadEngine.utilidadOperativa >= 0 ? 'Ganancia Neta' : 'Pérdida de Operación'}
                </span>
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                  MB: {rentabilidadEngine.margenBruto.toFixed(1)}% • MO: {rentabilidadEngine.margenOperativo.toFixed(1)}%
                </span>
              </div>
              <Sparkles className="absolute right-3 bottom-3 size-16 opacity-[0.03] pointer-events-none" />
            </div>

            {/* Income Statement Detailed Card */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                <Calculator className="size-4 text-indigo-500 dark:text-indigo-400" />
                <h3 className="text-xs font-black uppercase tracking-wide text-slate-900 dark:text-white">Estado de Resultados</h3>
              </div>
              
              <div className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Ventas de Contado:</span>
                  <span className="font-extrabold text-slate-900 dark:text-white">{formatMXN(rentabilidadEngine.ventasContado)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Ventas a Crédito (CxC):</span>
                  <span className="font-extrabold text-slate-900 dark:text-white">{formatMXN(rentabilidadEngine.ventasCredito)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 dark:border-slate-800/50 pt-2 font-bold text-slate-900 dark:text-white">
                  <span>Ventas Totales:</span>
                  <span className="text-indigo-600 dark:text-indigo-400">{formatMXN(rentabilidadEngine.ventasTotales)}</span>
                </div>
                <div className="flex justify-between text-rose-600 dark:text-rose-400">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Costo de Ventas (COGS):</span>
                  <span>{formatMXN(rentabilidadEngine.costoVentasTotal)}</span>
                </div>
                {rentabilidadEngine.exactCatalogCosts > 0 && (
                  <div className="text-[10px] text-slate-500 pl-3 leading-none flex justify-between">
                    <span>- Real de Catálogo:</span>
                    <span>{formatMXN(rentabilidadEngine.exactCatalogCosts)}</span>
                  </div>
                )}
                {rentabilidadEngine.estimatedCategoryCosts > 0 && (
                  <div className="text-[10px] text-slate-500 pl-3 leading-none flex justify-between">
                    <span>- Estimado de Categoría:</span>
                    <span>{formatMXN(rentabilidadEngine.estimatedCategoryCosts)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-slate-200 dark:border-slate-800/50 pt-2 font-extrabold text-emerald-600 dark:text-emerald-400">
                  <span>Utilidad Bruta:</span>
                  <span>{formatMXN(rentabilidadEngine.utilidadBruta)}</span>
                </div>

                <div className="border-t border-slate-200 dark:border-slate-800/50 pt-3">
                  <p className="text-[9px] font-black uppercase tracking-wider text-slate-500 mb-2">Gastos Operativos (Erogaciones Reales)</p>
                  <div className="space-y-1.5 pl-2 text-[11px] text-slate-600 dark:text-slate-400">
                    <div className="flex justify-between">
                      <span>Sueldos:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{formatMXN(rentabilidadEngine.sueldos)}</span>
                    </div>
                    {rentabilidadEngine.bonos > 0 && (
                      <div className="flex justify-between">
                        <span>Bonos:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{formatMXN(rentabilidadEngine.bonos)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>Renta:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{formatMXN(rentabilidadEngine.renta)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Gastos Administrativos:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{formatMXN(rentabilidadEngine.gastosAdministrativos)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Consumo Empleados (Costo 82%):</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{formatMXN(rentabilidadEngine.consumoEmpleados)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Cortesías (Costo 82%):</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{formatMXN(rentabilidadEngine.cortesias)}</span>
                    </div>
                    {rentabilidadEngine.faltantes > 0 && (
                      <div className="flex justify-between">
                        <span>Faltantes de Caja:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{formatMXN(rentabilidadEngine.faltantes)}</span>
                      </div>
                    )}
                    {rentabilidadEngine.otrosGastos > 0 && (
                      <div className="flex justify-between">
                        <span>Otros Gastos Operativos:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{formatMXN(rentabilidadEngine.otrosGastos)}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-between border-t border-slate-200 dark:border-slate-800 pt-2 font-black text-sm text-slate-900 dark:text-white">
                  <span>Utilidad Operativa:</span>
                  <span className={rentabilidadEngine.utilidadOperativa >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                    {formatMXN(rentabilidadEngine.utilidadOperativa)}
                  </span>
                </div>
              </div>
            </div>

            {/* Utility Centers Rentabilidad */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex items-center gap-2">
                <Store className="size-4 text-indigo-500 dark:text-indigo-400" />
                <h3 className="text-xs font-black uppercase tracking-wide text-slate-900 dark:text-white">Rendimiento por Centro de Utilidad</h3>
              </div>
              
              <div className="space-y-3">
                {rentabilidadEngine.centrosList.map(c => (
                  <div key={c.name} className="p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-black uppercase text-slate-900 dark:text-white">{c.name}</span>
                      <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full uppercase">
                        Part. {c.participacion.toFixed(0)}%
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[10px] text-slate-500 dark:text-slate-400">
                      <div>
                        <p className="text-[8px] uppercase tracking-wider text-slate-400 dark:text-slate-500 leading-none">Ventas</p>
                        <p className="font-bold text-slate-800 dark:text-slate-200 mt-1">{formatMXN(c.ventas)}</p>
                      </div>
                      <div>
                        <p className="text-[8px] uppercase tracking-wider text-slate-400 dark:text-slate-500 leading-none">Costo (COGS)</p>
                        <p className="font-bold text-rose-600 dark:text-rose-400 mt-1">{formatMXN(c.costo)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[8px] uppercase tracking-wider text-slate-400 dark:text-slate-500 leading-none">Margen Bruto</p>
                        <p className="font-bold text-emerald-600 dark:text-emerald-400 mt-1">{c.margenBruto.toFixed(1)}%</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Configurable Margins Card */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sliders className="size-4 text-indigo-500 dark:text-indigo-400" />
                  <h3 className="text-xs font-black uppercase tracking-wide text-slate-900 dark:text-white">Configurar Margen de Costos</h3>
                </div>
                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">
                  {savingSettings ? 'Sincronizando...' : 'Auto-guardado'}
                </span>
              </div>
              <p className="text-[9.5px] font-bold text-slate-500 leading-normal">
                Ajusta el porcentaje histórico estimado de Costo de Reposición usado para ventas sin detalle físico (Registro Rápido):
              </p>

              <div className="space-y-3 pt-2">
                {Object.keys(costMargins).map(cat => (
                  <UtilityInputRow 
                    key={cat}
                    cat={cat}
                    costMargin={costMargins[cat]}
                    onChange={(newVal) => handleMarginChange(cat, newVal)}
                  />
                ))}
              </div>

              {/* Treat Overages as Sales Switch */}
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 mt-2">
                <div className="text-left pr-4">
                  <p className="text-[10px] font-black uppercase text-slate-900 dark:text-white leading-tight">Integrar Sobrantes en Ventas</p>
                  <p className="text-[8px] font-bold text-slate-500 mt-0.5 leading-tight">
                    Suma los sobrantes de caja directamente como ventas no registradas de Abarrotes.
                  </p>
                </div>
                <button 
                  onClick={handleToggleSobrantes}
                  className={`w-10 h-6 flex items-center rounded-full p-1 cursor-pointer transition-all ${sobrantesComoVentas ? 'bg-indigo-600 justify-end' : 'bg-slate-300 dark:bg-slate-800 justify-start'}`}
                >
                  <span className="bg-white w-4 h-4 rounded-full shadow-md" />
                </button>
              </div>
            </div>

            {/* Explanatory Note Card */}
            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-950 dark:to-indigo-900 rounded-3xl p-5 border border-indigo-200 dark:border-indigo-800/30 text-left">
              <div className="flex items-center gap-2 mb-2 text-indigo-600 dark:text-indigo-400">
                <Info className="size-4" />
                <h4 className="text-[10px] font-black uppercase tracking-wider">Concepto de Rentabilidad</h4>
              </div>
              <p className="text-[9.5px] font-bold text-indigo-800 dark:text-indigo-300 leading-relaxed">
                Este motor mide la <strong>viabilidad y rentabilidad comercial</strong> de la sucursal. Compara ingresos ganados por ventas devengadas contra costos asociados, independientemente de si el pago ya fue recaudado físicamente en caja o se compró stock esta semana.
              </p>
            </div>

          </div>
        ) : (
          // MOTOR 2 CASH FLOW VIEW
          <div className="space-y-6 animate-in fade-in duration-300">
            
            {/* Cash Flow Running Summary */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800">
              <p className="text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1">Resultado de Flujo Neto en Caja</p>
              <h2 className={`text-3xl font-black tracking-tight mb-3 ${flujoCajaEngine.flujoNeto >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {flujoCajaEngine.flujoNeto >= 0 ? '+' : ''}{formatMXN(flujoCajaEngine.flujoNeto)}
              </h2>
              
              <div className="grid grid-cols-3 gap-2 border-t border-slate-200 dark:border-slate-800 pt-3 mt-1 text-[10px]">
                <div>
                  <span className="text-[8px] uppercase tracking-wider text-slate-500">Saldo Inicial</span>
                  <p className="font-extrabold text-slate-900 dark:text-white mt-1">{formatMXN(cajaInicial)}</p>
                </div>
                <div>
                  <span className="text-[8px] uppercase tracking-wider text-slate-500">Flujo Neto</span>
                  <p className={`font-extrabold mt-1 ${flujoCajaEngine.flujoNeto >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {formatMXN(flujoCajaEngine.flujoNeto)}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[8px] uppercase tracking-wider text-slate-500">Saldo Final</span>
                  <p className="font-extrabold text-indigo-600 dark:text-indigo-400 mt-1">{formatMXN(cajaFinal)}</p>
                </div>
              </div>
            </div>

            {/* Daily running balance visualization */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="size-4 text-indigo-500 dark:text-indigo-400" />
                <h3 className="text-xs font-black uppercase tracking-wide text-slate-900 dark:text-white">Evolución de Saldo Disponible</h3>
              </div>
              
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={document.documentElement.classList.contains('dark') ? '#1e293b' : '#f1f5f9'} />
                    <XAxis dataKey="dateLabel" stroke="#64748b" fontSize={7} tickLine={false} />
                    <YAxis stroke="#64748b" fontSize={7} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: document.documentElement.classList.contains('dark') ? '#0f172a' : '#fff', 
                        borderColor: document.documentElement.classList.contains('dark') ? '#334155' : '#e2e8f0', 
                        borderRadius: '12px' 
                      }} 
                      labelStyle={{ 
                        color: document.documentElement.classList.contains('dark') ? '#fff' : '#0f172a', 
                        fontSize: '10px', 
                        fontWeight: 'bold' 
                      }}
                      itemStyle={{ color: '#6366f1', fontSize: '10px' }}
                    />
                    <Area type="monotone" dataKey="balance" stroke="#6366f1" fillOpacity={1} fill="url(#colorBalance)" name="Caja Disponible" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Cash Flow Reconciliation Table Card */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                <Calculator className="size-4 text-indigo-500 dark:text-indigo-400" />
                <h3 className="text-xs font-black uppercase tracking-wide text-slate-900 dark:text-white">Entradas y Salidas de Efectivo</h3>
              </div>
              
              <div className="space-y-3.5 text-xs">
                
                {/* Entradas */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                    <TrendingUp className="size-3.5" />
                    <span className="text-[10px] font-black uppercase tracking-wider">Entradas de Caja</span>
                  </div>
                  <div className="space-y-1.5 pl-3 text-slate-700 dark:text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Ventas Cobradas (Contado):</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{formatMXN(flujoCajaEngine.ventasCobradas)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Cobranza de Crédito (CxC):</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{formatMXN(flujoCajaEngine.cobranzaCxC)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400 font-medium">Sobrantes de Caja:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{formatMXN(flujoCajaEngine.sobrantes)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400 font-medium">Otros Ingresos de Efectivo:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{formatMXN(flujoCajaEngine.otrosIngresos)}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-200 dark:border-slate-800/50 pt-1.5 font-extrabold text-emerald-600 dark:text-emerald-400">
                      <span>Total Entradas:</span>
                      <span>{formatMXN(flujoCajaEngine.totalEntradas)}</span>
                    </div>
                  </div>
                </div>

                {/* Salidas */}
                <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800/50">
                  <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                    <TrendingDown className="size-3.5" />
                    <span className="text-[10px] font-black uppercase tracking-wider">Salidas de Caja</span>
                  </div>
                  <div className="space-y-1.5 pl-3 text-slate-700 dark:text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Compras de Mercancía:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{formatMXN(flujoCajaEngine.compras)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Gastos Administrativos:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{formatMXN(flujoCajaEngine.gastosAdministrativos)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Sueldos:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{formatMXN(flujoCajaEngine.sueldos)}</span>
                    </div>
                    {flujoCajaEngine.bonos > 0 && (
                      <div className="flex justify-between">
                        <span>Bonos:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{formatMXN(flujoCajaEngine.bonos)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Renta:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{formatMXN(flujoCajaEngine.renta)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Compra / Fondeo Recargas:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{formatMXN(flujoCajaEngine.recargas)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Faltantes de Caja:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{formatMXN(flujoCajaEngine.faltantes)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Otros Egresos Diversos:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{formatMXN(flujoCajaEngine.otrosEgresos)}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-200 dark:border-slate-800/50 pt-1.5 font-extrabold text-rose-600 dark:text-rose-400">
                      <span>Total Salidas:</span>
                      <span>{formatMXN(flujoCajaEngine.totalSalidas)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between border-t border-slate-200 dark:border-slate-800 pt-3 font-black text-sm text-slate-900 dark:text-white">
                  <span>Flujo Neto Total:</span>
                  <span className={flujoCajaEngine.flujoNeto >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                    {formatMXN(flujoCajaEngine.flujoNeto)}
                  </span>
                </div>
              </div>
            </div>

            {/* Explanatory Note Card */}
            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-950 dark:to-indigo-900 rounded-3xl p-5 border border-indigo-200 dark:border-indigo-800/30 text-left">
              <div className="flex items-center gap-2 mb-2 text-indigo-600 dark:text-indigo-400">
                <Info className="size-4" />
                <h4 className="text-[10px] font-black uppercase tracking-wider">Concepto de Flujo de Caja</h4>
              </div>
              <p className="text-[9.5px] font-bold text-indigo-800 dark:text-indigo-300 leading-relaxed">
                Este motor mide strictly el <strong>movimiento físico del efectivo</strong> en Caja/Efectivo. Responde a si entró o salió dinero esta semana (ventas de contado reales cobradas, compras de stock físicas liquidadas, pagos de gastos, etc.), omitiendo ventas pendientes de cobrar o utilidades teóricas.
              </p>
            </div>

          </div>
        )}
      </main>
      
      <BottomNav />
    </div>
  );
};

export default FinanceStatsTotalsScreen;
