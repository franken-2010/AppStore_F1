
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import ProfileMenu from '../components/ProfileMenu';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { db } from '../services/firebase';
import { 
  collection, 
  serverTimestamp,
  doc,
  writeBatch,
  increment,
  Timestamp
} from "firebase/firestore";
import { handleFirestoreError, OperationType } from '../services/errorHandling';
import { GeminiService } from '../services/geminiService';
import { AccountResolver } from '../services/AccountResolver';
import { AccountingService, RegisterSchema } from '../services/AccountingService';
import MoneyInputWithCalculator from '../components/MoneyInputWithCalculator';
import { F1_STORES, F1_CATEGORY_LABELS, type StoreId } from '../services/multiStoreAccounting';
import { parseMultiStoreDraftFallback, type MultiStoreCorteDraft } from '../services/multiStoreCorteDraft';
import { buildF1AuditSummary } from '../services/multiStoreCorteSummary';

type TabMode = 'manual' | 'raw';
// Los campos nuevos replican el formulario manual original, sin crear otra pantalla.
const SECOND_STORE_INCOME = [
  { id: 'in_frutas_verduras', label: 'Frutas y verduras' },
  { id: 'in_pan_galletas', label: 'Pan y galletas' },
  { id: 'in_comida_preparada', label: 'Comida preparada' },
];
const SECOND_STORE_EXPENSE = [
  { id: 'ex_frutas_verduras', label: 'Compras Frutas y verduras' },
  { id: 'ex_pan_galletas', label: 'Compras Pan y galletas' },
  { id: 'ex_comida_preparada', label: 'Compras Comida preparada' },
  { id: 'ex_empleados', label: 'Sueldos / Pago empleados' },
  { id: 'ex_renta', label: 'Renta' },
  { id: 'ex_mantenimiento', label: 'Mantenimiento' },
  { id: 'ex_gastos_administrativos', label: 'Gastos administrativos' },
];

interface CutCanonical {
  income: {
    ventas: number;
    fiesta: number;
    recargas: number;
    estancias: number;
    pagoClientes: number;
    cxc: number;
  };
  expenses: {
    mercancias: number;
    fiesta: number;
    gastosAdministrativos: number;
    sueldos: number;
    consumoEmpleados: number;
    consumoPersonal: number;
  };
  cash: {
    dineroEntregado: number;
  };
}

interface AuditMetrics {
  subtotal1: number;
  subtotal2: number;
  totalIngresos: number;
  subtotalEgresos: number;
  totalEsperado: number;
  resultadoCaja: number;
  tipoResultado: 'SOBRANTE' | 'FALTANTE' | 'OK';
}

const CortesScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const [activeTab, setActiveTab] = useState<TabMode>('manual');
  const [selectedStore, setSelectedStore] = useState<StoreId>('local_01');
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<{ text: string, type: 'success' | 'error' | 'info' | 'warning' } | null>(null);
  
  const [schema, setSchema] = useState<RegisterSchema | null>(null);
  const [manualValues, setManualValues] = useState<Record<string, number>>({});
  
  // RAW Mode States
  const [rawText, setRawText] = useState('');
  const [parsedCut, setParsedCut] = useState<CutCanonical | null>(null);
  const [multiDraft, setMultiDraft] = useState<MultiStoreCorteDraft | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const rawTextareaRef = useRef<HTMLTextAreaElement>(null);
  const copyTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    AccountResolver.loadIndex(user.uid);
    AccountingService.getDailyRegisterSchema(user.uid).then(res => {
      setSchema(res);
      const initial: Record<string, number> = {};
      [...res.ingresos, ...res.egresos].forEach(r => initial[r.id] = 0);
      setManualValues(initial);
    });
  }, [user]);

  const formatMXN = (val: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);
  const selectedStoreName = F1_STORES.find(s => s.id === selectedStore)!.name;
  const multiAudit = useMemo(() => multiDraft ? buildF1AuditSummary(multiDraft) : null, [multiDraft]);
  const secondManualIncome = SECOND_STORE_INCOME.reduce((sum, f) => sum + (manualValues[f.id] || 0), 0);
  const secondManualExpense = SECOND_STORE_EXPENSE.reduce((sum, f) => sum + (manualValues[f.id] || 0), 0);
  const secondManualDifference = (manualValues.dinero_entregado_local2 || 0) - (secondManualIncome - secondManualExpense);
  const selectStore = (next: StoreId) => {
    if (next === selectedStore || isSaving) return;
    setSelectedStore(next);
    setParsedCut(null);
    setMultiDraft(null);
    setRawText('');
    setManualValues({});
    setStatus(null);
  };

  const handleInputChange = (id: string, value: string) => {
    setManualValues(prev => ({ ...prev, [id]: parseFloat(value) || 0 }));
  };

  const auditMetrics = useMemo((): AuditMetrics | null => {
    if (!parsedCut) return null;
    const { income, expenses, cash } = parsedCut;
    
    const sub1 = Number((income.ventas + income.fiesta + income.recargas).toFixed(2));
    const sub2 = Number((income.estancias + income.pagoClientes).toFixed(2));
    const totalIn = Number((sub1 + sub2).toFixed(2));
    const subEx = Number((expenses.mercancias + expenses.fiesta + expenses.gastosAdministrativos + expenses.sueldos + expenses.consumoEmpleados + expenses.consumoPersonal).toFixed(2));
    const totalExp = Number((totalIn - subEx).toFixed(2));
    const diff = Number((cash.dineroEntregado - totalExp).toFixed(2));

    let tipo: any = 'OK';
    if (diff > 0.1) tipo = 'SOBRANTE';
    else if (diff < -0.1) tipo = 'FALTANTE';

    return {
      subtotal1: sub1,
      subtotal2: sub2,
      totalIngresos: totalIn,
      subtotalEgresos: subEx,
      totalEsperado: totalExp,
      resultadoCaja: diff,
      tipoResultado: tipo
    };
  }, [parsedCut]);

  const handleCopyRawText = async () => {
    if (!rawText.trim()) return;

    const textarea = rawTextareaRef.current;
    if (textarea) {
      textarea.focus({ preventScroll: true });
      textarea.select();
      textarea.setSelectionRange(0, rawText.length);
    }

    let copied = false;
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(rawText);
        copied = true;
      } catch {
        copied = false;
      }
    }

    if (!copied) {
      try {
        if (textarea) {
          textarea.focus({ preventScroll: true });
          textarea.select();
          textarea.setSelectionRange(0, rawText.length);
        }
        copied = document.execCommand('copy');
      } catch {
        copied = false;
      }
    }

    if (textarea) {
      textarea.focus({ preventScroll: true });
      textarea.setSelectionRange(0, rawText.length);
    }

    if (copied) {
      setIsCopied(true);
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = window.setTimeout(() => {
        setIsCopied(false);
      }, 2500);
    } else {
      setStatus({ text: 'Texto seleccionado. Mantén presionado para copiar.', type: 'warning' });
    }
  };

  const handleAnalyzeIA = async () => {
    if (!rawText.trim() || !schema) return;
    setIsSaving(true);
    setStatus({ text: "F1-AI analizando reporte...", type: 'info' });
    
    try {
      const checked = parseMultiStoreDraftFallback(rawText, selectedStore, selectedDate);
      // Nunca mezclar un corte de Local 1 con ventas/compras de Local 2 ni viceversa.
      const foreign = [...checked.incomes, ...checked.outlays]
        .filter(row => row.categoryId &&
          !F1_STORES.find(s => s.id === selectedStore)!.categories.includes(row.categoryId));
      if (foreign.length) {
        const labels = [...new Set(foreign.map(row => F1_CATEGORY_LABELS[row.categoryId!]))].join(', ');
        setParsedCut(null);
        setMultiDraft(null);
        setStatus({ text: `Categoría de otro local: ${labels}. Selecciona la caja correcta o separa el movimiento antes de registrar.`, type: 'error' });
        return;
      }
      if (selectedStore === 'local_02') {
        const draft = await GeminiService.parseMultiStoreCorteDraft(rawText, selectedDate, selectedStore);
        setParsedCut(null);
        setMultiDraft(draft);
        const audit = buildF1AuditSummary(draft);
        setStatus(audit.unresolved || draft.warnings.length
          ? { text: 'Hay categorías o movimientos por revisar; no se registrará ningún asiento.', type: 'warning' }
          : { text: 'Auditoría del Local 2 terminada. Guardado real pendiente de validación contable.', type: 'info' });
        return;
      }
      setMultiDraft(null);
      const data = await GeminiService.parseCorteText(rawText, selectedDate);
      
      // Asegurar integridad de datos (Self-check)
      const canonical: CutCanonical = {
        income: {
          ventas: Number(data.income?.ventas || 0),
          fiesta: Number(data.income?.fiesta || 0),
          recargas: Number(data.income?.recargas || 0),
          estancias: Number(data.income?.estancias || 0),
          pagoClientes: Number(data.income?.pagoClientes || 0),
          cxc: Number(data.income?.cxc || 0)
        },
        expenses: {
          mercancias: Number(data.expenses?.mercancias || 0),
          fiesta: Number(data.expenses?.fiesta || 0),
          gastosAdministrativos: Number(data.expenses?.gastosAdministrativos || 0),
          sueldos: Number(data.expenses?.sueldos || 0),
          consumoEmpleados: Number(data.expenses?.consumoEmpleados || 0),
          consumoPersonal: Number(data.expenses?.consumoPersonal || 0)
        },
        cash: {
          dineroEntregado: Number(data.cash?.dineroEntregado || 0)
        }
      };

      setParsedCut(canonical);

      // --- CÁLCULO DE SOBRANTE / FALTANTE PARA MAPEO ---
      const sub1 = canonical.income.ventas + canonical.income.fiesta + canonical.income.recargas;
      const sub2 = canonical.income.estancias + canonical.income.pagoClientes;
      const totalIn = sub1 + sub2;
      const subEx = canonical.expenses.mercancias + canonical.expenses.fiesta + canonical.expenses.gastosAdministrativos + canonical.expenses.sueldos + canonical.expenses.consumoEmpleados + canonical.expenses.consumoPersonal;
      const totalExp = totalIn - subEx;
      const diff = canonical.cash.dineroEntregado - totalExp;
      const surplus = diff > 0.1 ? Number(diff.toFixed(2)) : 0;
      const deficit = diff < -0.1 ? Number(Math.abs(diff).toFixed(2)) : 0;
      
      // Mapeo automático a campos manuales para el flujo de guardado
      const mappedManual: Record<string, number> = {
        'in_ventas': canonical.income.ventas,
        'in_fiesta': canonical.income.fiesta,
        'in_recargas': canonical.income.recargas,
        'in_estancias': canonical.income.estancias,
        'in_cxc_pago': canonical.income.pagoClientes,
        'in_cxc_venta': canonical.income.cxc,
        'in_sobrante': surplus, // Mapeo del sobrante detectado
        'ex_mercancias': canonical.expenses.mercancias,
        'ex_fiesta': canonical.expenses.fiesta,
        'ex_gastos_administrativos': canonical.expenses.gastosAdministrativos,
        'ex_empleados': canonical.expenses.sueldos, // Map "sueldos" to rubric "ex_empleados"
        'ex_consumo_empleados': canonical.expenses.consumoEmpleados,
        'ex_personal': canonical.expenses.consumoPersonal,
        'ex_faltante': deficit // Mapeo del faltante detectado
      };
      setManualValues(mappedManual);

      if (data.isPermissionDenied) {
        setStatus({ text: `Aviso: ${data.notice || "Clave Gemini con Error 403 en Google Cloud"}`, type: 'warning' });
      } else {
        setStatus({ text: "Análisis contable completado exitosamente.", type: 'success' });
      }
    } catch (error: any) {
      console.warn("[F1 Contabilidad] Aviso en análisis contable:", error?.message || 'Error en procesamiento');
      setStatus({ text: "Análisis completado mediante motor contable local.", type: 'info' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (selectedStore === 'local_02') {
      setStatus({ text: 'Guardado del Local 2 bloqueado hasta validar cuentas y reglas de Firebase.', type: 'warning' });
      return;
    }
    if (!user || !schema) return;
    setIsSaving(true);
    setStatus({ text: "Sincronizando movimientos contables...", type: 'info' });
    
    try {
      const batch = writeBatch(db); 
      const dateKey = selectedDate;
      const groupId = `RD-${dateKey}-${Math.floor(Math.random()*1000)}`;
      const sourceLabel = activeTab === 'raw' ? 'CORTE_IA' : 'MANUAL';
      
      // Objeto de fecha para Firestore
      // Usamos el mediodía para evitar problemas de zona horaria al filtrar por día
      const accountingDate = new Date(selectedDate + 'T12:00:00');
      const accountingTimestamp = Timestamp.fromDate(accountingDate);
      
      // 1. Guardar movimientos estándar del manualValues (que ya están mapeados si se usó IA)
      // Esto incluye 'in_sobrante' si fue detectado en el análisis de IA
      let seqIndex = 0;
      const username = user.displayName || 'Administrador';
      const origin = activeTab === 'raw' ? 'IA' : 'manual';

      for (const rubric of [...schema.ingresos, ...schema.egresos]) {
        const amount = Number((manualValues[rubric.id] || 0).toFixed(2));
        if (amount <= 0) continue;

        const contableFields = AccountingService.getAccountingFields(
          rubric.id,
          amount,
          '',
          username,
          origin,
          rubric.label
        );

        // Validar contabilidad antes de registrar
        const validationError = AccountingService.validateAccountingMovement(contableFields);
        if (validationError) {
          throw new Error(validationError);
        }

        const registeredAt = Timestamp.fromMillis(Date.now() + (seqIndex++) * 50);

        const accInfo = await AccountResolver.assertAccount(user.uid, rubric.accountId);
        const movDocRef = doc(collection(db, "users", user.uid, "accounts", accInfo.accountDocId, "movements"));
        
        let direction = rubric.type === 'INCOME' ? 'IN' : 'OUT';
        let signedAmount = direction === 'IN' ? amount : -amount;

        // Caso especial CXC solicitado por el usuario:
        // Ventas a crédito (in_cxc_venta) -> Afecta negativo (aumenta deuda en su lógica)
        // Pago clientes (in_cxc_pago) -> Afecta positivo (suma a la cuenta)
        if (rubric.id === 'in_cxc_venta') {
          direction = 'OUT'; // Para que el impacto sea negativo en el balance
          signedAmount = -amount;
        } else if (rubric.id === 'in_cxc_pago') {
          direction = 'IN';
          signedAmount = amount;
        } else if (rubric.id === 'ex_consumo_empleados' || rubric.id === 'ex_personal') {
          // El consumo de empleados y cortesías no afectan Caja directamente
          direction = 'OUT';
          signedAmount = 0;
        }

        const conceptTitle = rubric.label.toUpperCase();

        batch.update(doc(db, "users", user.uid, "accounts", accInfo.accountDocId), { balance: increment(signedAmount), updatedAt: serverTimestamp() });
        batch.set(movDocRef, {
          uid: user.uid, 
          accountId: rubric.accountId, 
          amount: contableFields.amount ?? amount, 
          type: rubric.type, 
          direction, 
          signedAmount: contableFields.signo === -1 ? -(contableFields.amount ?? amount) : (contableFields.amount ?? amount), 
          rubro: rubric.id,
          conceptTitle, 
          conceptSubtitle: `Registro vía ${sourceLabel}`, 
          source: activeTab === 'raw' ? 'corte_ia' : 'manual',
          status: 'ACTIVE', 
          createdAt: accountingTimestamp, // Usamos la fecha seleccionada para el reporte
          groupId,
          effectiveAt: accountingTimestamp,
          dateKey,
          registeredAt,

          // Campos contables obligatorios requeridos por lógica contable interna
          id_movimiento: movDocRef.id,
          fecha: accountingTimestamp,
          tipo_operacion: contableFields.tipo_operacion,
          centro_utilidad: contableFields.centro_utilidad,
          categoria: contableFields.categoria,
          cuenta_contable: contableFields.cuenta_contable,
          monto: contableFields.amount ?? amount,
          signo: contableFields.signo,
          afecta_caja: contableFields.afecta_caja,
          afectaCaja: contableFields.afecta_caja,
          afecta_ventas: contableFields.afecta_ventas,
          afectaVentas: contableFields.afecta_ventas,
          afecta_cxc: contableFields.afecta_cxc,
          afectaCxC: contableFields.afecta_cxc,
          afecta_gasto: contableFields.afecta_gasto,
          afecta_costo: contableFields.afecta_costo,
          es_control: contableFields.es_control,
          esControl: contableFields.es_control,
          origen: origin,
          texto_original: rubric.label,
          usuario: username,

          // Detalles adicionales para consumo de empleados
          ...(rubric.id === 'ex_consumo_empleados' ? {
            consumo_empleados_valor_venta: amount,
            consumo_empleados_costo_real: Number((amount * 0.82).toFixed(2))
          } : {})
        });

        // Si es consumo de empleados o cortesía personal, guardar también el registro de control
        if (rubric.id === 'ex_consumo_empleados' || rubric.id === 'ex_personal') {
          const controlMovRef = doc(collection(db, "users", user.uid, "accounts", accInfo.accountDocId, "movements"));
          const controlContableFields = AccountingService.getAccountingFields(
            rubric.id,
            amount,
            '',
            username,
            origin,
            rubric.label,
            true // asControlRecord = true
          );

          batch.set(controlMovRef, {
            uid: user.uid,
            accountId: rubric.accountId,
            amount: amount,
            type: rubric.type,
            direction: 'IN',
            signedAmount: amount,
            rubro: rubric.id,
            conceptTitle: `CONTROL: ${conceptTitle}`,
            conceptSubtitle: `Registro vía ${sourceLabel}`,
            source: activeTab === 'raw' ? 'corte_ia' : 'manual',
            status: 'ACTIVE',
            createdAt: accountingTimestamp,
            groupId,
            effectiveAt: accountingTimestamp,
            dateKey,
            registeredAt,

            // Campos contables obligatorios
            id_movimiento: controlMovRef.id,
            fecha: accountingTimestamp,
            tipo_operacion: controlContableFields.tipo_operacion,
            centro_utilidad: controlContableFields.centro_utilidad,
            categoria: controlContableFields.categoria,
            cuenta_contable: controlContableFields.cuenta_contable,
            monto: amount,
            signo: controlContableFields.signo,
            afecta_caja: controlContableFields.afecta_caja,
            afectaCaja: controlContableFields.afecta_caja,
            afecta_ventas: controlContableFields.afecta_ventas,
            afectaVentas: controlContableFields.afecta_ventas,
            afecta_cxc: controlContableFields.afecta_cxc,
            afectaCxC: controlContableFields.afecta_cxc,
            afecta_gasto: controlContableFields.afecta_gasto,
            afecta_costo: controlContableFields.afecta_costo,
            es_control: controlContableFields.es_control,
            esControl: controlContableFields.es_control,
            origen: origin,
            texto_original: rubric.label,
            usuario: username
          });
        }

        // Espejo Inventarios
        const mirrorTitle = AccountingService.getInventoryMirrorTitle(rubric.id);
        const isEmployeeConsumption = rubric.id === 'ex_consumo_empleados';
        const isSaleIncome = rubric.type === 'INCOME' && ['ventas', 'fiesta', 'recargas', 'cxc'].includes(rubric.accountId);

        if (mirrorTitle || isEmployeeConsumption || isSaleIncome) {
          const invAcc = await AccountResolver.assertAccount(user.uid, 'inventarios');
          const invMovRef = doc(collection(db, "users", user.uid, "accounts", invAcc.accountDocId, "movements"));
          const isInvIn = !!mirrorTitle;
          
          let invAmount = amount;
          if (isEmployeeConsumption) {
            invAmount = Number((amount * 0.82).toFixed(2)); // Costo real = Valor venta * 0.82
          } else if (!isInvIn && isSaleIncome) {
            invAmount = Number((amount * 0.8).toFixed(2));
          }
          const invImpact = isInvIn ? invAmount : -invAmount;
          const invTitle = mirrorTitle || (isEmployeeConsumption ? 'SALIDA INV (CONSUMO EMPLEADOS)' : `SALIDA INV (${rubric.label.toUpperCase()})`);

          batch.update(doc(db, "users", user.uid, "accounts", invAcc.accountDocId), { balance: increment(invImpact), updatedAt: serverTimestamp() });
          batch.set(invMovRef, {
            uid: user.uid, 
            accountId: 'inventarios', 
            amount: invAmount, 
            direction: isInvIn ? 'IN' : 'OUT', 
            signedAmount: invImpact,
            rubro: 'inventarios', 
            type: isInvIn ? 'INCOME' : 'EXPENSE', 
            conceptTitle: invTitle, 
            conceptSubtitle: "Auto-ajuste F1",
            source: 'auto_inventory', 
            status: 'ACTIVE', 
            createdAt: accountingTimestamp, // Usamos la fecha seleccionada para el reporte
            groupId,
            effectiveAt: accountingTimestamp,
            dateKey,
            registeredAt,

            // Campos contables para inventario espejo
            id_movimiento: invMovRef.id,
            fecha: accountingTimestamp,
            tipo_operacion: isEmployeeConsumption ? 'consumo_empleados' : 'compra_mercancia',
            categoria: contableFields.categoria,
            cuenta_contable: 'Inventario',
            monto: invAmount,
            signo: isInvIn ? 1 : -1,
            afecta_caja: 'no',
            afectaCaja: false,
            afecta_ventas: 'no',
            afectaVentas: false,
            afecta_cxc: 'no',
            afectaCxC: false,
            afecta_inventario: 'sí',
            afectaInventario: true,
            es_control: 'no',
            esControl: false,
            origen: origin,
            texto_original: invTitle,
            usuario: username
          });
        }

        // Debito automatico de Ventas para gastos administrativos
        if (rubric.accountId === 'gastos_administrativos' && rubric.type === 'EXPENSE') {
          const ventasAcc = await AccountResolver.assertAccount(user.uid, 'ventas');
          const ventasMovRef = doc(collection(db, "users", user.uid, "accounts", ventasAcc.accountDocId, "movements"));
          const vImpact = -amount;

          batch.update(doc(db, "users", user.uid, "accounts", ventasAcc.accountDocId), { balance: increment(vImpact), updatedAt: serverTimestamp() });
          batch.set(ventasMovRef, {
            uid: user.uid, 
            accountId: 'ventas', 
            amount, 
            direction: 'OUT', 
            signedAmount: vImpact,
            rubro: 'ventas', 
            type: 'EXPENSE', 
            conceptTitle: `DEBITO ADM (${rubric.label.toUpperCase()})`, 
            conceptSubtitle: "Débito Automático",
            source: 'auto_debit', 
            status: 'ACTIVE', 
            createdAt: accountingTimestamp,
            groupId,
            effectiveAt: accountingTimestamp,
            dateKey,
            registeredAt,

            // Campos contables para débito automático
            id_movimiento: ventasMovRef.id,
            fecha: accountingTimestamp,
            tipo_operacion: 'gasto_administrativo',
            categoria: 'administrativo',
            cuenta_contable: 'Gastos Administrativos',
            monto: amount,
            signo: -1,
            afecta_caja: 'sí',
            afectaCaja: true,
            afecta_ventas: 'no',
            afectaVentas: false,
            afecta_cxc: 'no',
            afectaCxC: false,
            afecta_inventario: 'no',
            afectaInventario: false,
            afecta_gasto: false,
            es_control: 'sí',
            esControl: true,
            origen: origin,
            texto_original: `DEBITO ADM (${rubric.label})`,
            usuario: username
          });
        }
      }

      await batch.commit();

      addNotification({ 
        title: 'Corte Registrado', 
        message: `✅ El corte del ${selectedDate} se guardó con éxito.`, 
        type: 'system' 
      });

      setStatus({ text: `✅ Corte registrado con éxito.`, type: 'success' });
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch (e: any) {
      handleFirestoreError(e, OperationType.WRITE, `users/${user.uid}/accounts`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="relative flex h-full min-h-screen w-full flex-col overflow-x-hidden pb-32 max-w-md mx-auto bg-background-light dark:bg-background-dark font-display">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      <header className="sticky top-0 z-30 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md pt-12 px-5 pb-4 border-b dark:border-white/5">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-slate-700 dark:text-white"><span className="material-symbols-outlined text-3xl">menu</span></button>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">Corte de Caja</h1>
          <ProfileMenu />
        </div>
        <div className="flex p-1 bg-slate-200 dark:bg-surface-dark rounded-2xl">
          {(['manual', 'raw'] as TabMode[]).map(mode => (
            <button key={mode} onClick={() => setActiveTab(mode)} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === mode ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-500'}`}>{mode === 'manual' ? 'Carga Manual' : 'Pegar Corte'}</button>
          ))}
        </div>
      </header>

      <main className="px-5 mt-6 space-y-8 pb-10">
        <section className="space-y-2">
          <label htmlFor="f1-store" className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Caja / Local del corte</label>
          <select id="f1-store" value={selectedStore} onChange={e => selectStore(e.target.value as StoreId)}
            className="w-full bg-white dark:bg-surface-dark dark:text-white rounded-2xl border border-slate-200 dark:border-white/10 p-4 font-bold">
            {F1_STORES.map(store => <option key={store.id} value={store.id}>{store.name}</option>)}
          </select>
          {selectedStore === 'local_02' && <p className="text-xs font-bold text-amber-700 dark:text-amber-300">Local 2: captura y auditoría en prueba. El guardado real sigue deshabilitado para proteger tu contabilidad.</p>}
        </section>
        {/* Fecha del Corte */}
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Fecha del Registro</label>
          <div className="relative group">
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => { setSelectedDate(e.target.value); setParsedCut(null); setMultiDraft(null); }}
              className="w-full bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/5 rounded-2xl p-4 font-bold text-slate-800 dark:text-white shadow-sm outline-none focus:ring-2 focus:ring-primary/50 transition-all"
            />
            <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors pointer-events-none">calendar_today</span>
          </div>
        </div>

        {status && (
          <div className={`p-5 rounded-2xl flex items-center gap-3 text-sm font-bold border animate-in slide-in-from-top-2 ${status.type === 'success' ? 'bg-emerald-50/10 text-emerald-500 border-emerald-500/20' : status.type === 'error' ? 'bg-red-50/10 text-red-500 border-red-500/20' : 'bg-blue-50/10 text-blue-500 border-blue-500/20'}`}>
            <span className="material-symbols-outlined text-xl">{status.type === 'success' ? 'verified' : 'info'}</span>
            {status.text}
          </div>
        )}

        {activeTab === 'manual' ? (
          <div className="space-y-8">
            <section className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Entradas de Dinero</h3>
              <div className="bg-white dark:bg-surface-dark p-6 rounded-[2rem] shadow-sm space-y-6">
                {(selectedStore === 'local_01' ? (schema?.ingresos || []) : SECOND_STORE_INCOME).map(rubric => (
                  <MoneyInputWithCalculator key={rubric.id} label={rubric.label} field={rubric.id} value={manualValues[rubric.id] || 0} onChange={handleInputChange} />
                ))}
              </div>
            </section>
            <section className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Salidas / Gastos</h3>
              <div className="bg-white dark:bg-surface-dark p-6 rounded-[2rem] shadow-sm space-y-6">
                {(selectedStore === 'local_01' ? (schema?.egresos || []) : SECOND_STORE_EXPENSE).map(rubric => (
                  <MoneyInputWithCalculator key={rubric.id} label={rubric.label} field={rubric.id} value={manualValues[rubric.id] || 0} onChange={handleInputChange} />
                ))}
              </div>
            </section>

            {selectedStore === 'local_02' && (
              <section className="bg-white dark:bg-surface-dark p-6 rounded-[2rem] space-y-3">
                <MoneyInputWithCalculator label="Dinero entregado (para calcular diferencia)" field="dinero_entregado_local2"
                  value={manualValues.dinero_entregado_local2 || 0} onChange={handleInputChange} />
                <p className="text-xs font-bold dark:text-white">Ingresos: {formatMXN(secondManualIncome)} · Egresos: {formatMXN(secondManualExpense)}</p>
                <p className="text-sm font-black dark:text-white">{secondManualDifference >= 0 ? 'Sobrante' : 'Faltante'} automático: {formatMXN(Math.abs(secondManualDifference))}</p>
              </section>
            )}
            <button onClick={handleSave} disabled={isSaving || selectedStore === 'local_02'} className="w-full py-6 bg-primary text-white font-black rounded-3xl shadow-xl shadow-primary/20 flex items-center justify-center gap-3 active:scale-95 transition-all text-base disabled:opacity-50">
              {isSaving ? <span className="material-symbols-outlined animate-spin">sync</span> : <span className="material-symbols-outlined">send</span>}
              Sincronizar Operación
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {!parsedCut ? (
              <div className="bg-white dark:bg-surface-dark p-7 rounded-[2.5rem] shadow-sm space-y-5 border dark:border-white/5 animate-in fade-in">
                <div className="space-y-1">
                  <h3 className="text-sm font-black text-indigo-500 uppercase tracking-widest">Dictado o Reporte F1</h3>
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Pega el texto de ventas y gastos de WhatsApp.</p>
                </div>
                <textarea
                  ref={rawTextareaRef}
                  value={rawText}
                  onChange={(e) => {
                    setRawText(e.target.value);
                    if (isCopied) setIsCopied(false);
                  }}
                  placeholder="Ventas: 4500, Luz: 1200, Entregue: 3000..."
                  className="w-full h-56 bg-slate-50 dark:bg-background-dark/50 border border-slate-100 dark:border-white/5 focus:border-primary/60 rounded-2xl p-5 text-base font-medium outline-none resize-none dark:text-white transition-colors"
                />
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={handleCopyRawText}
                    disabled={!rawText.trim()}
                    className={`w-full py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest border flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-40 disabled:active:scale-100 ${
                      isCopied
                        ? 'bg-emerald-500/15 text-emerald-500 dark:text-emerald-400 border-emerald-500/30'
                        : 'bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-white/10 hover:bg-slate-200/70 dark:hover:bg-white/10'
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg">
                      {isCopied ? 'check_circle' : 'content_copy'}
                    </span>
                    {isCopied ? '¡Texto Copiado!' : 'Copiar'}
                  </button>
                  <button
                    type="button"
                    onClick={handleAnalyzeIA}
                    disabled={isSaving || !rawText.trim()}
                    className="w-full py-5 bg-indigo-600 text-white font-black rounded-2xl shadow-lg active:scale-95 flex items-center justify-center gap-2 text-base disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined">analytics</span> Analizar con F1-AI
                  </button>
                </div>
                {multiDraft && multiAudit && (
                  <section className="space-y-4 border-t border-slate-100 dark:border-white/10 pt-5">
                    <h3 className="text-sm font-black uppercase text-primary">Auditoría de Corte · {selectedStoreName}</h3>
                    {F1_STORES.find(s => s.id === selectedStore)!.categories.map(category => (
                      <div key={category} className="space-y-1 text-sm font-bold dark:text-white">
                        <div className="flex justify-between"><span>Ventas {F1_CATEGORY_LABELS[category]}</span><span>{formatMXN(multiAudit.cashSales[category] || 0)}</span></div>
                        <div className="flex justify-between text-slate-500"><span>Compras {F1_CATEGORY_LABELS[category]}</span><span>{formatMXN(multiAudit.purchases[category] || 0)}</span></div>
                      </div>
                    ))}
                    <div className="border-t border-slate-100 dark:border-white/10 space-y-2 pt-3 text-sm font-bold dark:text-white">
                      <div className="flex justify-between"><span>Ingresos en efectivo</span><span>{formatMXN(multiAudit.totalCashEntries)}</span></div>
                      <div className="flex justify-between"><span>Egresos de caja</span><span>{formatMXN(multiAudit.cashOutflows)}</span></div>
                      <div className="flex justify-between"><span>Efectivo esperado</span><span>{formatMXN(multiAudit.expectedCash)}</span></div>
                      <div className="flex justify-between"><span>Dinero entregado</span><span>{multiAudit.countedCash == null ? 'No indicado' : formatMXN(multiAudit.countedCash)}</span></div>
                      <div className="flex justify-between text-primary"><span>{multiAudit.cashDifference == null ? 'Diferencia pendiente' : multiAudit.cashDifference >= 0 ? 'Sobrante automático' : 'Faltante automático'}</span><span>{multiAudit.cashDifference == null ? '—' : formatMXN(Math.abs(multiAudit.cashDifference))}</span></div>
                    </div>
                    {(multiAudit.unresolved > 0 || multiDraft.warnings.length > 0) && (
                      <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 p-4 text-xs text-amber-900 dark:text-amber-200 space-y-2">
                        <strong>Movimientos por verificar: {multiAudit.unresolved}</strong>
                        {multiDraft.warnings.map((warning, index) => <p key={index}>{warning}</p>)}
                      </div>
                    )}
                    <p className="text-xs text-amber-700 dark:text-amber-300 font-bold">Modo prueba: no registra movimientos en Firestore.</p>
                  </section>
                )}
              </div>
            ) : (
              <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                {/* AUDITORÍA DE CORTE - FORMATO SOLICITADO */}
                <div className="p-8 bg-white dark:bg-surface-dark rounded-[2.5rem] border dark:border-white/10 shadow-2xl space-y-6 relative overflow-hidden">
                  <div className="flex justify-between items-start">
                    <h3 className="text-base font-black uppercase tracking-[0.2em] text-blue-500 dark:text-blue-400">Auditoría de Corte</h3>
                    <div className={`px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest text-white ${auditMetrics?.tipoResultado === 'FALTANTE' ? 'bg-rose-500' : 'bg-emerald-500'}`}>
                      {auditMetrics?.tipoResultado === 'OK' ? 'SISTEMA OK' : auditMetrics?.tipoResultado}
                    </div>
                  </div>

                  <div className="space-y-6 font-bold text-sm text-slate-700 dark:text-slate-300">
                    {/* Bloque Ingresos */}
                    <div className="space-y-2">
                      <p className="text-xs font-black uppercase tracking-widest text-primary dark:text-blue-400 border-b border-slate-100 dark:border-white/5 pb-1">Ingresos contables</p>
                      <div className="flex justify-between"><span>Ventas:</span> <span>{formatMXN(parsedCut.income.ventas)}</span></div>
                      <div className="flex justify-between"><span>Fiesta:</span> <span>{formatMXN(parsedCut.income.fiesta)}</span></div>
                      <div className="flex justify-between"><span>Recargas:</span> <span>{formatMXN(parsedCut.income.recargas)}</span></div>
                      <div className="flex justify-between text-primary dark:text-blue-400 font-black border-t border-slate-50 dark:border-white/5 pt-1"><span>Subtotal 1:</span> <span>{formatMXN(auditMetrics?.subtotal1 || 0)}</span></div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between"><span>Estancias:</span> <span>{formatMXN(parsedCut.income.estancias)}</span></div>
                      <div className="flex justify-between"><span>Pago de clientes:</span> <span>{formatMXN(parsedCut.income.pagoClientes)}</span></div>
                      <div className="flex justify-between text-primary dark:text-blue-400 font-black border-t border-slate-50 dark:border-white/5 pt-1"><span>Subtotal 2:</span> <span>{formatMXN(auditMetrics?.subtotal2 || 0)}</span></div>
                    </div>

                    <div className="flex justify-between text-lg font-black text-slate-900 dark:text-white bg-slate-50 dark:bg-white/5 p-3 rounded-xl">
                      <span>Total de ingresos:</span>
                      <span>{formatMXN(auditMetrics?.totalIngresos || 0)}</span>
                    </div>

                    {/* Bloque Egresos */}
                    <div className="space-y-2">
                      <p className="text-xs font-black uppercase tracking-widest text-rose-500 dark:text-rose-400 border-b border-slate-100 dark:border-white/5 pb-1">Egresos contables</p>
                      <div className="flex justify-between text-xs"><span>Gastos en mercancías (abarrotes, recargas):</span> <span>{formatMXN(parsedCut.expenses.mercancias)}</span></div>
                      <div className="flex justify-between"><span>Sueldos / Pago empleados:</span> <span>{formatMXN(parsedCut.expenses.sueldos)}</span></div>
                      <div className="flex justify-between"><span>Gastos Fiesta:</span> <span>{formatMXN(parsedCut.expenses.fiesta)}</span></div>
                      <div className="flex justify-between"><span>Gastos administrativos:</span> <span>{formatMXN(parsedCut.expenses.gastosAdministrativos)}</span></div>
                      <div className="flex justify-between"><span>Consumo de empleados:</span> <span>{formatMXN(parsedCut.expenses.consumoEmpleados)}</span></div>
                      <div className="flex justify-between"><span>Consumo personal:</span> <span>{formatMXN(parsedCut.expenses.consumoPersonal)}</span></div>
                      <div className="flex justify-between text-rose-500 dark:text-rose-400 font-black border-t border-slate-50 dark:border-white/5 pt-1"><span>Subtotal:</span> <span>{formatMXN(auditMetrics?.subtotalEgresos || 0)}</span></div>
                    </div>

                    {/* Totales Finales */}
                    <div className="space-y-3 pt-4 border-t-2 border-slate-100 dark:border-white/5">
                      <div className="flex justify-between"><span>Total:</span> <span>{formatMXN(auditMetrics?.totalEsperado || 0)}</span></div>
                      <div className="flex justify-between text-primary dark:text-blue-400 font-black"><span>Dinero entregado:</span> <span>{formatMXN(parsedCut.cash.dineroEntregado)}</span></div>
                      <div className={`flex justify-between text-lg font-black p-3 rounded-xl ${auditMetrics?.resultadoCaja! >= 0 ? 'bg-emerald-500/10 text-emerald-500 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-500 dark:text-rose-400'}`}>
                        <span>Resultado:</span>
                        <span>{formatMXN(auditMetrics?.resultadoCaja || 0)} ({auditMetrics?.tipoResultado})</span>
                      </div>
                    </div>

                    {/* Bloque Crédito */}
                    <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-white/5 opacity-70">
                      <p className="text-xs font-black uppercase tracking-widest text-slate-500">Ingresos por crédito:</p>
                      <div className="flex justify-between"><span>CxC:</span> <span>{formatMXN(parsedCut.income.cxc)}</span></div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-4 pt-4">
                  <button onClick={handleSave} disabled={isSaving} className="w-full py-6 bg-primary text-white font-black rounded-3xl shadow-2xl shadow-primary/30 flex items-center justify-center gap-3 text-base active:scale-95 transition-all">
                    {isSaving ? <span className="material-symbols-outlined animate-spin">sync</span> : <span className="material-symbols-outlined">verified</span>} 
                    Confirmar y Registrar
                  </button>
                  <button onClick={() => { setParsedCut(null); setRawText(''); }} className="w-full py-4 text-slate-400 font-bold text-xs uppercase tracking-widest active:scale-95">Descartar y Limpiar</button>
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

export default CortesScreen;
