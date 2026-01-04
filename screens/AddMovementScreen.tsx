
import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const AddMovementScreen: React.FC = () => {
  const { accountId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    amount: '',
    direction: 'out' as 'in' | 'out',
    category: 'Varios',
    description: ''
  });

  const handleSave = async () => {
    if (!user || !accountId || !formData.amount) return;
    setLoading(true);
    try {
      const amount = parseFloat(formData.amount);
      const batch = [];
      
      // 1. Agregar movimiento
      const movRef = collection(db, "users", user.uid, "accounts", accountId, "movements");
      await addDoc(movRef, {
        amount,
        direction: formData.direction,
        category: formData.category,
        description: formData.description,
        ts: serverTimestamp(),
        balanceAfter: 0 // Simplificado para este placeholder
      });

      // 2. Actualizar balance de la cuenta
      const accRef = doc(db, "users", user.uid, "accounts", accountId);
      await updateDoc(accRef, {
        balance: increment(formData.direction === 'in' ? amount : -amount),
        updatedAt: serverTimestamp()
      });

      navigate(`/account/history/${accountId}`);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  return (
    <div className="relative flex flex-col h-screen w-full max-w-md mx-auto bg-[#0f172a] font-display text-white overflow-hidden">
      <header className="pt-12 px-5 pb-4 flex items-center gap-4 border-b border-white/5">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2"><span className="material-symbols-outlined">close</span></button>
        <h1 className="text-xl font-bold">Nuevo Movimiento</h1>
      </header>

      <main className="flex-1 p-6 space-y-6 overflow-y-auto no-scrollbar">
        <div className="flex p-1 bg-white/5 rounded-2xl">
          <button 
            onClick={() => setFormData({...formData, direction: 'in'})}
            className={`flex-1 py-3 rounded-xl text-xs font-black uppercase transition-all ${formData.direction === 'in' ? 'bg-blue-500 text-white shadow-lg' : 'text-slate-500'}`}
          >Ingreso</button>
          <button 
            onClick={() => setFormData({...formData, direction: 'out'})}
            className={`flex-1 py-3 rounded-xl text-xs font-black uppercase transition-all ${formData.direction === 'out' ? 'bg-red-500 text-white shadow-lg' : 'text-slate-500'}`}
          >Egreso</button>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Monto</label>
            <div className="relative">
              <span className="absolute left-5 top-1/2 -translate-y-1/2 text-primary font-bold text-xl">$</span>
              <input 
                type="number" 
                value={formData.amount}
                onChange={e => setFormData({...formData, amount: e.target.value})}
                placeholder="0.00"
                className="w-full bg-white/5 border-none rounded-2xl py-6 px-10 text-3xl font-black outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Categoría</label>
            <input 
              value={formData.category}
              onChange={e => setFormData({...formData, category: e.target.value})}
              className="w-full bg-white/5 border-none rounded-xl py-4 px-5 font-bold outline-none"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Descripción</label>
            <textarea 
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
              rows={3}
              className="w-full bg-white/5 border-none rounded-xl py-4 px-5 font-bold outline-none resize-none"
              placeholder="Notas adicionales..."
            />
          </div>
        </div>

        <button 
          onClick={handleSave}
          disabled={loading || !formData.amount}
          className="w-full py-5 bg-primary text-white font-black rounded-3xl shadow-2xl shadow-primary/30 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? <span className="material-symbols-outlined animate-spin">sync</span> : <span className="material-symbols-outlined">save</span>}
          Registrar Movimiento
        </button>
      </main>
    </div>
  );
};

export default AddMovementScreen;
