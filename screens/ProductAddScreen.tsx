
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import { useAuth } from '../context/AuthContext';

const ProductAddScreen: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [cost, setCost] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  const handleAddProduct = async () => {
    const webhookUrl = profile?.webhookAddProduct;
    
    if (!webhookUrl) {
      setStatus({ text: 'Error: No hay webhook configurado en Ajustes > Webhooks.', type: 'error' });
      return;
    }

    if (!sku || !name || !category) {
      setStatus({ text: 'Complete los campos obligatorios (SKU, Nombre, Categoría).', type: 'error' });
      return;
    }

    setIsSending(true);
    setStatus(null);

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku, name, category, cost,
          timestamp: new Date().toISOString(),
          type: 'add_product',
          admin: profile?.displayName
        })
      });

      if (response.ok) {
        setStatus({ text: 'Producto registrado con éxito en Firebase.', type: 'success' });
        setSku(''); setName(''); setCategory(''); setCost('');
      } else {
        throw new Error('Error de servidor');
      }
    } catch (error) {
      setStatus({ text: 'Error al enviar datos. Verifique su conexión.', type: 'error' });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="relative flex flex-col h-screen w-full max-w-md mx-auto bg-background-light dark:bg-background-dark shadow-2xl overflow-hidden pb-32 font-display">
      <header className="flex items-center justify-between p-4 pb-2 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md shrink-0 z-30 pt-12">
        <button onClick={() => navigate(-1)} className="flex items-center justify-center size-10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-slate-900 dark:text-white">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-lg font-bold flex-1 text-center pr-10">Alta de Producto</h1>
      </header>

      <main className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
        <div className="p-7 rounded-[2.5rem] bg-emerald-500 text-white shadow-xl shadow-emerald-500/20 relative overflow-hidden">
          <div className="flex items-center gap-3 mb-2 relative z-10">
            <span className="material-symbols-outlined text-3xl">inventory_2</span>
            <h2 className="text-xl font-black">Nuevo Ítem F1</h2>
          </div>
          <p className="text-emerald-50 text-[10px] font-black uppercase tracking-widest relative z-10">Registro en Base de Datos Central</p>
          <span className="material-symbols-outlined absolute right-[-10px] top-[-10px] text-9xl opacity-10">add_circle</span>
        </div>

        {status && (
          <div className={`p-5 rounded-2xl flex items-center gap-3 border animate-in slide-in-from-top-2 ${status.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
            <span className="material-symbols-outlined">{status.type === 'success' ? 'verified' : 'error'}</span>
            <p className="text-sm font-bold leading-tight">{status.text}</p>
          </div>
        )}

        <div className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">SKU / Código de Barras</label>
            <input value={sku} onChange={(e) => setSku(e.target.value)} className="w-full py-4 px-5 rounded-xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/5 outline-none font-bold focus:ring-2 focus:ring-emerald-500/20 shadow-sm" placeholder="750100..." />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nombre Completo</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full py-4 px-5 rounded-xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/5 outline-none font-bold focus:ring-2 focus:ring-emerald-500/20 shadow-sm" placeholder="Ej: Sabritas Original 45g" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Categoría F1</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full py-4 px-5 rounded-xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/5 outline-none font-bold focus:ring-2 focus:ring-emerald-500/20 shadow-sm appearance-none">
              <option value="">Seleccionar...</option>
              <option value="Bebidas">Bebidas</option>
              <option value="Botanas">Botanas</option>
              <option value="Abarrotes">Abarrotes</option>
              <option value="Lácteos">Lácteos</option>
              <option value="Limpieza">Limpieza</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Costo Neto ($)</label>
            <input type="number" value={cost} onChange={(e) => setCost(e.target.value)} className="w-full py-4 px-5 rounded-xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/5 outline-none font-bold focus:ring-2 focus:ring-emerald-500/20 shadow-sm" placeholder="0.00" />
          </div>
        </div>
      </main>

      <div className="fixed bottom-[88px] left-0 right-0 px-6 max-w-md mx-auto z-40">
        <button 
          onClick={handleAddProduct}
          disabled={isSending}
          className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-4.5 rounded-2xl shadow-xl flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50"
        >
          {isSending ? <span className="material-symbols-outlined animate-spin">sync</span> : <span className="material-symbols-outlined">add_task</span>}
          <span>Guardar en Firebase</span>
        </button>
      </div>

      <BottomNav />
    </div>
  );
};

export default ProductAddScreen;
