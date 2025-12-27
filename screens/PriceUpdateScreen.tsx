
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import { useAuth } from '../context/AuthContext';

const PriceUpdateScreen: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [provider, setProvider] = useState('');
  const [productList, setProductList] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  const handleSendToMake = async () => {
    const webhookUrl = profile?.webhookPriceUpdate;
    
    if (!webhookUrl) {
      setStatusMessage({ text: 'Error: No hay un webhook configurado en Ajustes > Webhooks.', type: 'error' });
      return;
    }

    if (!provider || !productList) {
      setStatusMessage({ text: 'Por favor, complete todos los campos.', type: 'error' });
      return;
    }

    setIsSending(true);
    setStatusMessage(null);

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timestamp: new Date().toISOString(),
          provider,
          productList,
          type: 'price_update',
          admin: profile?.displayName
        })
      });

      if (response.ok) {
        setStatusMessage({ text: '¡Datos enviados con éxito a Make!', type: 'success' });
        setProductList('');
      } else {
        throw new Error('Failed to send');
      }
    } catch (error) {
      console.error(error);
      setStatusMessage({ text: 'Error al enviar los datos. Verifique la URL del webhook en ajustes.', type: 'error' });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="relative flex flex-col h-screen w-full max-w-md mx-auto bg-background-light dark:bg-background-dark shadow-2xl overflow-hidden pb-32 font-display">
      <header className="flex items-center justify-between p-4 pb-2 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md shrink-0 z-30 pt-12">
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center justify-center size-10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-slate-900 dark:text-white"
        >
          <span className="material-symbols-outlined text-[24px]">arrow_back</span>
        </button>
        <h1 className="text-lg font-bold flex-1 text-center pr-10">Actualización Precios</h1>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-6 no-scrollbar">
        <div className="relative rounded-[2rem] overflow-hidden bg-surface-dark shadow-lg h-44 flex items-end">
          <div 
            className="absolute inset-0 bg-cover bg-center opacity-40 mix-blend-overlay" 
            style={{backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuC_JsbWn6odGrxxSW3JR50J1aarIKH0WqdCRukBp0RklRU-wx_1rWUBsh6atMsUjfwYuXti92d9ov3AZlbovUlnPSgCC20VbokmuBvQYDLM3HlyTHjnDN04iM9rfQIbACVIItoBwooIpW3X1GpKcqso-Ld4Hdvf91ELZBH4936uV-J6zdY9bw9lUKIwGqA-8xJF_Bwhncg8Et6IcHBu8MA5vz9A3lm98feruZAAvGp35wMKEUhvYuzl_gf6M8gD4bBLZI0ciSa8NJ0')"}}
          ></div>
          <div className="relative p-6 bg-gradient-to-t from-surface-dark via-surface-dark/80 to-transparent w-full">
            <h2 className="text-xl font-black text-white">Sincronización Make</h2>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">Conectado a Firebase BDD</p>
          </div>
        </div>

        {statusMessage && (
          <div className={`p-4 rounded-2xl flex items-start gap-3 border animate-in slide-in-from-top-2 ${statusMessage.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400'}`}>
            <span className="material-symbols-outlined shrink-0">{statusMessage.type === 'success' ? 'verified' : 'error'}</span>
            <p className="text-sm font-bold leading-tight">{statusMessage.text}</p>
          </div>
        )}

        <form className="flex flex-col gap-6" onSubmit={(e) => e.preventDefault()}>
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Proveedor Socio</label>
            <div className="relative">
              <select 
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="w-full appearance-none rounded-2xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark text-slate-900 dark:text-white font-bold py-4 px-5 text-base transition-all outline-none shadow-sm focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Seleccione socio comercial</option>
                <option value="Barcel">Barcel</option>
                <option value="Bimbo">Bimbo</option>
                <option value="Bodega">Bodega</option>
                <option value="Botanas LC">Botanas LC</option>
                <option value="Desechables Miranda">Desechables Miranda</option>
                <option value="Dunosusa">Dunosusa</option>
                <option value="Sabritas">Sabritas</option>
                <option value="Sigma">Sigma</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">CSV de Productos</label>
            <textarea 
              value={productList}
              onChange={(e) => setProductList(e.target.value)}
              className="w-full rounded-2xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark text-slate-900 dark:text-white p-5 text-sm min-h-[220px] font-mono leading-relaxed transition-all outline-none resize-none shadow-inner focus:ring-2 focus:ring-primary/20" 
              placeholder="Ej: Producto_A, 25.50&#10;Producto_B, 12.00"
            ></textarea>
          </div>
        </form>
      </main>

      <div className="fixed bottom-[88px] left-0 right-0 px-6 max-w-md mx-auto z-40">
        <button 
          onClick={handleSendToMake}
          disabled={isSending}
          className="w-full bg-primary hover:bg-primary-dark active:scale-[0.98] transition-all text-white font-black py-4.5 rounded-2xl shadow-xl flex items-center justify-center gap-3 group disabled:opacity-50"
        >
          {isSending ? (
            <span className="material-symbols-outlined animate-spin">sync</span>
          ) : (
            <>
              <span>Enviar a Firebase via Make</span>
              <span className="material-symbols-outlined text-[20px] group-hover:translate-x-1 transition-transform">send</span>
            </>
          )}
        </button>
      </div>

      <BottomNav />
    </div>
  );
};

export default PriceUpdateScreen;
