
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';

const PriceUpdateScreen: React.FC = () => {
  const navigate = useNavigate();
  const [provider, setProvider] = useState('');
  const [productList, setProductList] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  const handleSendToMake = async () => {
    const webhookUrl = localStorage.getItem('webhook_price_update');
    
    if (!webhookUrl) {
      setStatusMessage({ text: 'Error: No hay un webhook configurado en Ajustes.', type: 'error' });
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
          type: 'price_update'
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
      setStatusMessage({ text: 'Error al enviar los datos. Verifique la URL del webhook.', type: 'error' });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="relative flex flex-col h-screen w-full max-w-md mx-auto bg-background-light dark:bg-background-dark shadow-2xl overflow-hidden pb-32 font-display">
      {/* Header */}
      <header className="flex items-center justify-between p-4 pb-2 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md shrink-0 z-30 pt-12">
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center justify-center size-10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-slate-900 dark:text-white"
        >
          <span className="material-symbols-outlined text-[24px]">arrow_back</span>
        </button>
        <h1 className="text-lg font-bold leading-tight tracking-[-0.015em] text-center flex-1 pr-10">Actualización de Precios</h1>
      </header>

      {/* Main Content Area (Scrollable) */}
      <main className="flex-1 overflow-y-auto p-4 space-y-6 no-scrollbar">
        {/* Hero Card */}
        <div className="relative rounded-xl overflow-hidden bg-surface-dark shadow-lg h-48 flex items-end">
          <div 
            className="absolute inset-0 bg-cover bg-center opacity-40 mix-blend-overlay" 
            style={{backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuC_JsbWn6odGrxxSW3JR50J1aarIKH0WqdCRukBp0RklRU-wx_1rWUBsh6atMsUjfwYuXti92d9ov3AZlbovUlnPSgCC20VbokmuBvQYDLM3HlyTHjnDN04iM9rfQIbACVIItoBwooIpW3X1GpKcqso-Ld4Hdvf91ELZBH4936uV-J6zdY9bw9lUKIwGqA-8xJF_Bwhncg8Et6IcHBu8MA5vz9A3lm98feruZAAvGp35wMKEUhvYuzl_gf6M8gD4bBLZI0ciSa8NJ0')"}}
          ></div>
          <div className="relative p-6 bg-gradient-to-t from-surface-dark via-surface-dark/80 to-transparent w-full">
            <div className="flex items-center gap-3 mb-2">
              <div className="size-10 rounded-full bg-primary/20 flex items-center justify-center text-primary border border-primary/30 backdrop-blur-sm">
                <span className="material-symbols-outlined">currency_exchange</span>
              </div>
              <h2 className="text-xl font-bold text-white">Carga de Datos</h2>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed">
              Actualice los precios del catálogo enviando los datos directamente a la automatización de Make.
            </p>
          </div>
        </div>

        {/* Status Message */}
        {statusMessage && (
          <div className={`p-4 rounded-xl flex items-start gap-3 border ${statusMessage.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400'}`}>
            <span className="material-symbols-outlined shrink-0">{statusMessage.type === 'success' ? 'check_circle' : 'error'}</span>
            <p className="text-sm font-medium">{statusMessage.text}</p>
          </div>
        )}

        {/* Form Section */}
        <form className="flex flex-col gap-6" onSubmit={(e) => e.preventDefault()}>
          {/* Proveedor Field */}
          <div className="flex flex-col gap-2">
            <label className="text-slate-900 dark:text-white text-sm font-bold pl-1 flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-primary">storefront</span>
              Proveedor
            </label>
            <div className="relative">
              <select 
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="w-full appearance-none rounded-xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark text-slate-900 dark:text-white placeholder-slate-400 focus:border-primary focus:ring-1 focus:ring-primary py-4 pl-4 pr-10 text-base transition-all outline-none"
              >
                <option disabled selected value="">Seleccione un proveedor</option>
                <option value="Barcel">Barcel</option>
                <option value="Bimbo">Bimbo</option>
                <option value="Bodega">Bodega</option>
                <option value="Botanas LC">Botanas LC</option>
                <option value="Desechables Miranda">Desechables Miranda</option>
                <option value="Dunosusa">Dunosusa</option>
                <option value="Felipe Flores">Felipe Flores</option>
                <option value="Filis">Filis</option>
                <option value="Gatos">Gatos</option>
                <option value="Pantera">Pantera</option>
                <option value="Pedro Chi">Pedro Chi</option>
                <option value="Ricolino">Ricolino</option>
                <option value="Sabritas">Sabritas</option>
                <option value="Santos Lugo">Santos Lugo</option>
                <option value="Sigma">Sigma</option>
                <option value="Felipe">Felipe</option>
                <option value="BotanasLC">BotanasLC</option>
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-slate-400">
                <span className="material-symbols-outlined">expand_more</span>
              </div>
            </div>
          </div>

          {/* Product List Field */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between pl-1">
              <label className="text-slate-900 dark:text-white text-sm font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-primary">receipt_long</span>
                Lista de productos y precios
              </label>
              <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20 uppercase tracking-widest">CSV Simple</span>
            </div>
            <textarea 
              value={productList}
              onChange={(e) => setProductList(e.target.value)}
              className="w-full rounded-xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark text-slate-900 dark:text-white placeholder-slate-400 focus:border-primary focus:ring-1 focus:ring-primary p-4 text-base min-h-[200px] font-mono text-sm leading-relaxed transition-all outline-none resize-none shadow-inner" 
              placeholder="Coca_Cola_600ml, 15.50&#10;Pepsi_Lat_355ml, 12.00&#10;Agua_Bonafont_1L, 10.00"
            ></textarea>
            <div className="flex items-start gap-2 p-3 rounded-xl bg-primary/5 border border-primary/20">
              <span className="material-symbols-outlined text-primary text-[18px] mt-0.5">info</span>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                Formato requerido: <span className="text-slate-900 dark:text-white font-bold">Nombre_Producto, Precio</span>. Use una línea por cada producto nuevo a registrar.
              </p>
            </div>
          </div>
        </form>
      </main>

      {/* Floating Action Button Above Navigation */}
      <div className="fixed bottom-[88px] left-0 right-0 px-6 max-w-md mx-auto z-40">
        <button 
          onClick={handleSendToMake}
          disabled={isSending}
          className="w-full bg-primary hover:bg-primary-dark active:scale-[0.98] transition-all text-white font-bold py-4 rounded-xl shadow-[0_8px_30px_rgba(130,83,213,0.3)] flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isSending ? (
            <span className="material-symbols-outlined animate-spin">sync</span>
          ) : (
            <>
              <span>Enviar a Make</span>
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
