
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { 
  collection, 
  serverTimestamp, 
  doc, 
  runTransaction
} from "firebase/firestore";
import { handleFirestoreError, OperationType } from '../services/errorHandling';
import { AccountingService } from '../services/AccountingService';
import { AccountResolver } from '../services/AccountResolver';
import MoneyInputWithCalculator from '../components/MoneyInputWithCalculator';

const AddMovementScreen: React.FC = () => {
  const { accountId: urlAccountDocId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [picklists, setPicklists] = useState<{income: any[], expense: any[]}>({ income: [], expense: [] });
  
  const [formData, setFormData] = useState({
    amount: 0,
    type: 'EXPENSE' as 'INCOME' | 'EXPENSE',
    selectedRubricId: '', 
    concept: ''
  });

  const [status, setStatus] = useState<{ text: string, type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    if (!user) return;
    AccountResolver.loadIndex(user.uid);
    AccountingService.getMovementPicklists(user.uid).then(res => {
      setPicklists(res);
    });
  }, [user]);

  const currentOptions = useMemo(() => {
    return formData.type === 'INCOME' ? (picklists.income || []) : (picklists.expense || []);
  }, [formData.type, picklists]);

  useEffect(() => {
    setFormData(prev => ({ ...prev, selectedRubricId: '' }));
  }, [formData.type]);

  const handleSave = async () => {
    if (!user || !formData.amount || !formData.selectedRubricId) {
      setStatus({ text: "Completa el monto y rubro.", type: 'error' });
      return;
    }
    
    setLoading(true);
    setStatus({ text: "Sincronizando...", type: 'info' });

    try {
      const selectedRubric = currentOptions.find(o => o.id === formData.selectedRubricId);
      if (!selectedRubric) throw new Error("Rubro no válido.");

      const username = user.displayName || 'Administrador';
      const contableFields = AccountingService.getAccountingFields(
        formData.selectedRubricId,
        formData.amount,
        formData.concept.trim(),
        username,
        'manual'
      );

      // Validaciones Obligatorias de Lógica Contable
      const validationError = AccountingService.validateAccountingMovement(contableFields);
      if (validationError) {
        setStatus({ text: validationError, type: 'error' });
        setLoading(false);
        return;
      }

       const accountInfo = await AccountResolver.assertAccount(user.uid, selectedRubric.accountId);
      const accountDocId = accountInfo.accountDocId;

      const isGastoAdm = selectedRubric.accountId === 'gastos_administrativos' && formData.type === 'EXPENSE';
      let ventasAccountDocId: string | null = null;
      if (isGastoAdm) {
        const ventasAccountInfo = await AccountResolver.assertAccount(user.uid, 'ventas');
        ventasAccountDocId = ventasAccountInfo.accountDocId;
      }

      const invMirrorTitle = AccountingService.getInventoryMirrorTitle(formData.selectedRubricId);
      const isEmployeeConsumption = formData.selectedRubricId === 'ex_consumo_empleados';
      const isSaleIncome = formData.type === 'INCOME' && ['ventas', 'fiesta', 'recargas', 'cxc'].includes(selectedRubric.accountId);
      let invAccountDocId: string | null = null;
      if (invMirrorTitle || isEmployeeConsumption || isSaleIncome) {
        const invAccountInfo = await AccountResolver.assertAccount(user.uid, 'inventarios');
        invAccountDocId = invAccountInfo.accountDocId;
      }

      await runTransaction(db, async (transaction) => {
        const accountRef = doc(db, "users", user.uid, "accounts", accountDocId);
        const invRef = invAccountDocId ? doc(db, "users", user.uid, "accounts", invAccountDocId) : null;
        const ventasRef = ventasAccountDocId ? doc(db, "users", user.uid, "accounts", ventasAccountDocId) : null;

        const accSnap = await transaction.get(accountRef);
        if (!accSnap.exists()) throw new Error("Cuenta no encontrada.");

        let invSnap = null;
        if (invRef) {
          invSnap = await transaction.get(invRef);
          if (!invSnap.exists()) throw new Error("Inventarios no disponible.");
        }

        let ventasSnap = null;
        if (ventasRef) {
          ventasSnap = await transaction.get(ventasRef);
          if (!ventasSnap.exists()) throw new Error("Ventas no disponible.");
        }

        const currentBalance = Number(accSnap.data()?.balance || 0);
        const amount = Math.round(formData.amount * 100) / 100;
        
        let direction = formData.type === 'INCOME' ? 'IN' : 'OUT';
        let impact = direction === 'IN' ? amount : -amount;

        // Caso especial CXC solicitado por el usuario:
        // Ventas a crédito (in_cxc_venta) -> Afecta negativo
        // Pago clientes (in_cxc_pago) -> Afecta positivo
        if (formData.selectedRubricId === 'in_cxc_venta') {
          direction = 'OUT';
          impact = -amount;
        } else if (formData.selectedRubricId === 'in_cxc_pago') {
          direction = 'IN';
          impact = amount;
        } else if (formData.selectedRubricId === 'ex_consumo_empleados') {
          // Consumo empleados no tiene entrada ni salida de caja (afecta_caja: no)
          direction = 'OUT';
          impact = 0;
        }

        const newBalance = currentBalance + impact;

        const newMovRef = doc(collection(db, "users", user.uid, "accounts", accountDocId, "movements"));
        const conceptTitle = formData.concept.trim() 
          ? formData.concept.trim().toUpperCase() 
          : (formData.type === 'INCOME' ? `INGRESO: ${selectedRubric.label}` : `EGRESO: ${selectedRubric.label}`);

        // Combinar datos operativos estándar con los campos canónicos de la lógica contable
        const finalMovementPayload = {
          uid: user.uid,
          accountId: selectedRubric.accountId,
          amount: contableFields.amount ?? amount,
          type: formData.type,
          direction: direction,
          signedAmount: contableFields.signo === -1 ? -(contableFields.amount ?? amount) : (contableFields.amount ?? amount),
          rubro: formData.selectedRubricId,
          conceptTitle: conceptTitle,
          conceptSubtitle: "Registro Manual",
          source: 'manual',
          status: 'ACTIVE',
          createdAt: serverTimestamp(),
          registeredAt: serverTimestamp(),
          effectiveAt: serverTimestamp(),
          
          // Campos contables obligatorios
          id_movimiento: newMovRef.id,
          fecha: serverTimestamp(),
          tipo_operacion: contableFields.tipo_operacion,
          centro_utilidad: contableFields.centro_utilidad,
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
          origen: 'manual',
          texto_original: formData.concept.trim() || conceptTitle,
          usuario: username,
          
          // Detalles adicionales para consumo empleados
          ...(isEmployeeConsumption ? {
            consumo_empleados_valor_venta: amount,
            consumo_empleados_costo_real: Number((amount * 0.82).toFixed(2))
          } : {})
        };

        transaction.set(newMovRef, finalMovementPayload);

        // Si es consumo de empleados o cortesía personal, guardar también el registro de control
        if (formData.selectedRubricId === 'ex_consumo_empleados' || formData.selectedRubricId === 'ex_personal') {
          const controlMovRef = doc(collection(db, "users", user.uid, "accounts", accountDocId, "movements"));
          const controlContableFields = AccountingService.getAccountingFields(
            formData.selectedRubricId,
            amount,
            formData.concept.trim(),
            username,
            'manual',
            formData.concept.trim() || conceptTitle,
            true // asControlRecord = true
          );

          const controlMovementPayload = {
            uid: user.uid,
            accountId: selectedRubric.accountId,
            amount: amount,
            type: formData.type,
            direction: 'IN',
            signedAmount: amount,
            rubro: formData.selectedRubricId,
            conceptTitle: `CONTROL: ${conceptTitle}`,
            conceptSubtitle: "Cuenta de Control",
            source: 'manual',
            status: 'ACTIVE',
            createdAt: serverTimestamp(),
            registeredAt: serverTimestamp(),
            effectiveAt: serverTimestamp(),

            // Campos contables obligatorios
            id_movimiento: controlMovRef.id,
            fecha: serverTimestamp(),
            tipo_operacion: controlContableFields.tipo_operacion,
            centro_utilidad: controlContableFields.centro_utilidad,
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
            origen: 'manual',
            texto_original: formData.concept.trim() || conceptTitle,
            usuario: username
          };

          transaction.set(controlMovRef, controlMovementPayload);
        }

        transaction.update(accountRef, {
          balance: newBalance,
          updatedAt: serverTimestamp()
        });

        if (invRef && (invMirrorTitle || isEmployeeConsumption || isSaleIncome)) {
          const invMovRef = doc(collection(db, "users", user.uid, "accounts", invAccountDocId!, "movements"));
          const currentInvBalance = Number(invSnap!.data()?.balance || 0);
          
          const isInvIn = !!invMirrorTitle;
          
          let invAmount = amount;
          if (isEmployeeConsumption) {
            invAmount = Number((amount * 0.82).toFixed(2)); // Costo real = Valor venta * 0.82
          } else if (!isInvIn && isSaleIncome) {
            invAmount = Number((amount * 0.8).toFixed(2));
          }
          
          const invImpact = isInvIn ? invAmount : -invAmount;
          const invTitle = invMirrorTitle || (isEmployeeConsumption ? 'SALIDA INV (CONSUMO EMPLEADOS)' : `SALIDA INV (${selectedRubric.label.toUpperCase()})`);

          transaction.set(invMovRef, {
            uid: user.uid,
            accountId: 'inventarios',
            amount: invAmount,
            type: isInvIn ? 'INCOME' : 'EXPENSE',
            direction: isInvIn ? 'IN' : 'OUT',
            signedAmount: invImpact,
            rubro: 'inventarios',
            conceptTitle: invTitle,
            conceptSubtitle: "Auto-ajuste F1",
            source: 'auto_inventory',
            status: 'ACTIVE',
            createdAt: serverTimestamp(),
            registeredAt: serverTimestamp(),
            effectiveAt: serverTimestamp(),

            // Campos contables para inventario espejo
            id_movimiento: invMovRef.id,
            fecha: serverTimestamp(),
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
            origen: 'manual',
            texto_original: invTitle,
            usuario: username
          });

          transaction.update(invRef, {
            balance: currentInvBalance + invImpact,
            updatedAt: serverTimestamp()
          });
        }

        if (ventasRef && isGastoAdm) {
          const ventasMovRef = doc(collection(db, "users", user.uid, "accounts", ventasAccountDocId!, "movements"));
          const currentVentasBalance = Number(ventasSnap!.data()?.balance || 0);

          transaction.set(ventasMovRef, {
            uid: user.uid,
            accountId: 'ventas',
            amount: amount,
            type: 'EXPENSE',
            direction: 'OUT',
            signedAmount: -amount,
            rubro: 'ventas',
            conceptTitle: `DEBITO ADM (${conceptTitle})`,
            conceptSubtitle: "Débito Automático",
            source: 'auto_debit',
            status: 'ACTIVE',
            createdAt: serverTimestamp(),
            registeredAt: serverTimestamp(),
            effectiveAt: serverTimestamp(),

            // Campos contables para débito automático
            id_movimiento: ventasMovRef.id,
            fecha: serverTimestamp(),
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
            es_control: 'no',
            esControl: false,
            origen: 'manual',
            texto_original: `DEBITO ADM (${conceptTitle})`,
            usuario: username
          });

          transaction.update(ventasRef, {
            balance: currentVentasBalance - amount,
            updatedAt: serverTimestamp()
          });
        }
      });

      setStatus({ text: `Guardado ✅`, type: 'success' });
      setTimeout(() => navigate('/dashboard'), 800);
    } catch (e: any) {
      handleFirestoreError(e, OperationType.WRITE, `users/${user.uid}/accounts`);
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = formData.amount > 0 && formData.selectedRubricId !== '';

  return (
    <div className="relative flex flex-col h-screen w-full max-w-md mx-auto bg-[#0a0f1d] font-display text-white overflow-hidden">
      <header className="pt-12 px-6 pb-3 flex justify-between items-center bg-[#0a0f1d] border-b border-white/5 shrink-0">
        <button onClick={() => navigate(-1)} className="p-1 -ml-1 text-slate-400 active:text-white active:scale-90 transition-all">
          <span className="material-symbols-outlined text-[28px]">close</span>
        </button>
        <h1 className="text-sm font-black tracking-[0.15em] uppercase text-white">Nuevo Registro</h1>
        <div className="w-8"></div>
      </header>

      <main className="flex-1 p-5 space-y-4 flex flex-col justify-between overflow-hidden">
        <div className="space-y-5">
          {/* Alerta de Status Temporal */}
          {status && (
            <div className={`p-3.5 rounded-xl flex items-center gap-3 text-[10px] font-black uppercase tracking-widest border animate-in slide-in-from-top-2 ${
              status.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
              status.type === 'error' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 
              'bg-blue-500/10 text-blue-400 border-blue-500/20'
            }`}>
              <span className="material-symbols-outlined text-base">{status.type === 'success' ? 'verified' : 'info'}</span>
              {status.text}
            </div>
          )}

          <div className="p-1 bg-white/5 rounded-2xl flex border border-white/5 shadow-inner">
            <button onClick={() => setFormData({...formData, type: 'INCOME'})} className={`flex-1 py-3 rounded-[14px] text-[10px] font-black uppercase tracking-widest transition-all ${formData.type === 'INCOME' ? 'bg-blue-500 text-white shadow-lg' : 'text-slate-500'}`}>Entrada</button>
            <button onClick={() => setFormData({...formData, type: 'EXPENSE'})} className={`flex-1 py-3 rounded-[14px] text-[10px] font-black uppercase tracking-widest transition-all ${formData.type === 'EXPENSE' ? 'bg-rose-400 text-white shadow-lg' : 'text-slate-500'}`}>Salida</button>
          </div>

          <MoneyInputWithCalculator label="Valor de Operación" field="amount" value={formData.amount} onChange={(_, v) => setFormData({...formData, amount: parseFloat(v) || 0})} />

          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest ml-1">Rubro de Operación</label>
            <div className="relative">
              <select 
                value={formData.selectedRubricId} 
                onChange={e => setFormData({...formData, selectedRubricId: e.target.value})} 
                className="w-full bg-white/5 border border-white/5 rounded-xl py-4 px-5 font-bold text-sm text-white outline-none appearance-none"
              >
                <option value="" disabled className="bg-[#0a0f1d]">Selecciona un rubro...</option>
                {currentOptions.map((opt, i) => <option key={i} value={opt.id} className="bg-[#1a1f2e]">{opt.label}</option>)}
              </select>
              <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">expand_more</span>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest ml-1">Concepto Corto</label>
            <input 
              value={formData.concept} 
              onChange={e => setFormData({...formData, concept: e.target.value})} 
              className="w-full bg-white/5 border border-white/5 rounded-xl py-4 px-5 font-bold text-sm text-white outline-none focus:ring-1 focus:ring-blue-400/40" 
              placeholder="Ej. PAGO LUZ, VENTA EXTRA..." 
            />
          </div>
        </div>

        <div className="pt-2 pb-6">
           <button 
             onClick={handleSave} 
             disabled={loading || !isFormValid} 
             className="w-full py-5 bg-blue-500 text-white font-black rounded-2xl shadow-xl shadow-primary/20 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-3 text-xs uppercase tracking-widest"
           >
             {loading ? <span className="material-symbols-outlined animate-spin">sync</span> : <span className="material-symbols-outlined">send</span>} 
             {loading ? 'Sincronizando...' : 'Registrar Ahora'}
           </button>
        </div>
      </main>
    </div>
  );
};

export default AddMovementScreen;
