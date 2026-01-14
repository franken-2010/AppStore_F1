
import React, { useState } from 'react';
import { db } from '../services/firebase';
import { 
  doc, 
  runTransaction, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

interface MovementDeleteButtonProps {
  uid: string;
  accountDocId: string;
  movementDocId: string;
  movementType: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  amount: number;
  onDone?: () => void;
}

const MovementDeleteButton: React.FC<MovementDeleteButtonProps> = ({
  uid,
  accountDocId,
  movementDocId,
  movementType,
  amount,
  onDone
}) => {
  const [loading, setLoading] = useState(false);

  const handleDeleteClick = async (e: React.MouseEvent) => {
    // REGLA CRÍTICA: Detener propagación para evitar clics en el padre
    e.stopPropagation();
    e.preventDefault();

    // 1. PRUEBA DE CLICK INMEDIATA (Requerida para validación)
    console.log("DELETE_CLICK_TRIGGERED", { uid, accountDocId, movementDocId, movementType, amount });
    alert("DELETE CLICK OK: Iniciando proceso de anulación.");

    // 2. CONFIRMACIÓN
    const confirmed = window.confirm(
      "¿ANULAR MOVIMIENTO?\n\nEl saldo de la cuenta se ajustará automáticamente y este registro dejará de contar en reportes."
    );
    if (!confirmed) return;

    setLoading(true);

    try {
      const movementRef = doc(db, "users", uid, "accounts", accountDocId, "movements", movementDocId);
      const accountRef = doc(db, "users", uid, "accounts", accountDocId);

      await runTransaction(db, async (transaction) => {
        // Leer movimiento actual
        const movSnap = await transaction.get(movementRef);
        if (!movSnap.exists()) throw new Error("El movimiento ya no existe en la base de datos.");
        
        const movData = movSnap.data();
        if (movData.status === 'VOID') throw new Error("Este movimiento ya ha sido anulado.");

        // Leer cuenta para balance
        const accSnap = await transaction.get(accountRef);
        if (!accSnap.exists()) throw new Error("La cuenta asociada no existe.");
        
        const currentBalance = Number(accSnap.data().balance || 0);

        // LÓGICA DE REVERSIÓN CONTABLE
        // INCOME (+) -> Restar del balance
        // EXPENSE (-) -> Sumar al balance
        const isIncome = movData.type === 'INCOME' || (movData.type as any) === 'INGRESO';
        const impact = isIncome ? Number(movData.amount) : -Number(movData.amount);
        const newBalance = currentBalance - impact;

        console.log(`TRANSACTION: Reinvirtiendo impacto de ${impact}. Nuevo Saldo: ${newBalance}`);

        // Actualizar Cuenta
        transaction.update(accountRef, {
          balance: newBalance,
          updatedAt: serverTimestamp()
        });

        // Marcar Movimiento como VOID
        transaction.update(movementRef, {
          status: 'VOID',
          voidedAt: serverTimestamp(),
          voidedBy: uid,
          updatedAt: serverTimestamp()
        });
      });

      console.log("DELETE_SUCCESS: Movimiento anulado correctamente.");
      if (onDone) onDone();
      
    } catch (err: any) {
      console.error("DELETE_ERROR:", err);
      alert(`⚠️ ERROR AL ANULAR: ${err.message || 'Error desconocido'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleDeleteClick}
      disabled={loading}
      className={`size-10 rounded-xl flex items-center justify-center transition-all bg-white/5 text-slate-400 hover:text-red-400 active:scale-90 shadow-sm ${loading ? 'opacity-50' : 'opacity-100'}`}
      title="Anular Movimiento"
    >
      {loading ? (
        <span className="material-symbols-outlined animate-spin text-[20px]">sync</span>
      ) : (
        <span className="material-symbols-outlined text-[20px]">delete</span>
      )}
    </button>
  );
};

export default MovementDeleteButton;
