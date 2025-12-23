
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';

const ProductAddScreen: React.FC = () => {
  const navigate = useNavigate();
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [cost, setCost] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  const handleAddProduct = async () => {
    const webhookUrl = localStorage.getItem('webhook_add_product');
    
    if (!webhookUrl) {
      setStatus({ text: 'No hay webhook configurado.', type: 'error' });
      return;
    }

    if (!sku || !name || !category) {
      setStatus({ text: 'Complete los campos obligatorios.', type: 'error' });
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
          type: 'add_product'
        })
      });

      if (response.ok) {
        setStatus({ text: 'Producto registrado en Make.', type: 'success' });
        setSku(''); setName(''); setCategory(''); setCost('');
      } else {
        throw new Error('Error de servidor');
      }
    } catch (error) {
      setStatus({ text: 'Error al enviar datos.', type: 'error' });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="relative flex flex-col h-screen w-full max-w-md mx-auto bg-background-light dark:bg-background-dark shadow-2xl overflow-hidden pb-32">
      <header className="flex items-center justify-between p-4 pb-2 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md shrink-0 z-30 pt-12">
        <button onClick={() => navigate(-1)} className="flex items-center justify-center size-10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-slate-900 dark:text-white">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-lg font-bold flex-1 text-center pr-10">Alta de Producto</h1>
      </header>

      <main className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
        <div className="p-6 rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/20">
          <div className="flex items-center gap-3 mb-2">
            <span className="material-symbols-outlined text-3xl">inventory_2</span>
            <h2 className="text-xl font-bold">Nuevo Ítem</h2>
          </div>
          <p className="text-emerald-50 text-sm">Registre el producto en la base de datos central automáticamente.</p>
        </div>

        {status && (
          <div className={`p-4 rounded-xl flex items-center gap-3 border ${status.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
            <span className="material-symbols-outlined">{status.type === 'success' ? 'check_circle' : 'error'}</span>
            <p className="text-sm font-bold">{status.text}</p>
          </div>
        )}

        <div className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase ml-1">SKU / Código</label>
            <input value={sku} onChange={(e) => setSku(e.target.value)} className="w-full py-4 px-4 rounded-xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/5 outline-none focus:ring-2 focus:ring-emerald-500" placeholder="750100..." />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase ml-1">Nombre del Producto</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full py-4 px-4 rounded-xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/5 outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Coca Cola 600ml" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase ml-1">Categoría</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full py-4 px-4 rounded-xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/5 outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="">Seleccionar...</option>
              <option value="Bebidas">Bebidas</option>
              <option value="Botanas">Botanas</option>
              <option value="Abarrotes">Abarrotes</option>
              <option value="Lácteos">Lácteos</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase ml-1">Costo ($)</label>
            <input type="number" value={cost} onChange={(e) => setCost(e.target.value)} className="w-full py-4 px-4 rounded-xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/5 outline-none focus:ring-2 focus:ring-emerald-500" placeholder="0.00" />
          </div>
        </div>
      </main>

      <div className="fixed bottom-[88px] left-0 right-0 px-6 max-w-md mx-auto z-40">
        <button 
          onClick={handleAddProduct}
          disabled={isSending}
          className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-4 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
        >
          {isSending ? <span className="material-symbols-outlined animate-spin">sync</span> : <span className="material-symbols-outlined">add_box</span>}
          <span>Registrar Producto</span>
        </button>
      </div>

      <BottomNav />
    </div>
  );
};

export default ProductAddScreen;
