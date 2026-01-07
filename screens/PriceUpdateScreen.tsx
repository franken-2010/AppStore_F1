
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  updateDoc, 
  getDoc,
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

interface ProcessResult {
  name: string;
  status: 'BAJÓ' | 'SIN CAMBIOS' | 'SUBIÓ' | 'NO ENCONTRADO' | 'ERROR';
  newSuggestedPrice?: number;
  utility?: number;
  error?: string;
}

const PriceUpdateScreen: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [productList, setProductList] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [report, setReport] = useState<ProcessResult[] | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ text: string, type: 'success' | 'error' | 'info' } | null>(null);

  // Helper para normalización robusta: ignora acentos, minúsculas, trim y colapsa espacios
  const normalizeText = (text: string) => {
    if (!text) return "";
    return text
      .normalize("NFD") // Descompone acentos
      .replace(/\p{Diacritic}/gu, "") // Remueve diacríticos
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' '); // Colapsa espacios múltiples
  };

  // Helper para redondear a 2 decimales
  const roundTo2 = (num: number) => {
    return Math.round((num + Number.EPSILON) * 100) / 100;
  };

  const parseLine = (line: string) => {
    const parts = line.split(/[,|\t]/).map(p => p.trim());
    if (parts.length < 2) return null;
    
    const name = parts[0];
    const priceStr = parts[1].replace(/[$,]/g, '');
    const price = parseFloat(priceStr);
    
    if (!name || isNaN(price)) return null;
    return { name, price: roundTo2(price) };
  };

  const handleProcessUpdates = async () => {
    if (!productList.trim()) {
      setStatusMessage({ text: 'Por favor, ingresa la lista de productos.', type: 'error' });
      return;
    }

    setIsProcessing(true);
    setStatusMessage({ text: 'Iniciando procesamiento de base de datos...', type: 'info' });
    const lines = productList.split('\n').filter(l => l.trim() !== '');
    const results: ProcessResult[] = [];

    try {
      // Cargamos todos los proveedores una vez para hacer matching local flexible
      const providersSnap = await getDocs(collection(db, "providers"));
      const allProviders = providersSnap.docs.map(d => ({ id: d.id, data: d.data() }));

      for (const line of lines) {
        const parsed = parseLine(line);
        if (!parsed) {
          results.push({ name: line, status: 'NO ENCONTRADO', error: 'Formato inválido (Nombre, Precio)' });
          continue;
        }

        const { name: inputName, price: newPrice } = parsed;
        const normalizedInput = normalizeText(inputName);

        // Búsqueda flexible en memoria ignorando acentos
        let bestMatch: any = null;
        
        // 1. Intento Match Exacto con Normalización Completa
        bestMatch = allProviders.find(p => normalizeText(p.data.Nombre_Completo || '') === normalizedInput);

        // 2. Intento Match Substring si no hay exacto
        if (!bestMatch) {
          bestMatch = allProviders.find(p => normalizeText(p.data.Nombre_Completo || '').includes(normalizedInput));
        }

        if (!bestMatch) {
          results.push({ name: inputName, status: 'NO ENCONTRADO' });
          continue;
        }

        const providerDoc = bestMatch.data;
        const providerId = bestMatch.id;
        const currentCost = roundTo2(providerDoc.Costo_actual || 0);
        const productKey = providerDoc.ProductKey;
        
        let priceStatus: 'BAJÓ' | 'SIN CAMBIOS' | 'SUBIÓ' = 'SIN CAMBIOS';
        if (newPrice < currentCost) priceStatus = 'BAJÓ';
        else if (newPrice > currentCost) priceStatus = 'SUBIÓ';

        // Actualizar providers si cambió
        if (priceStatus !== 'SIN CAMBIOS') {
          await updateDoc(doc(db, "providers", providerId), {
            Costo_actual: newPrice,
            Fecha_ult_actualización: serverTimestamp()
          });
        }

        // Actualizar costs_catalog
        let suggestedPrice = 0;
        let utility = 0;
        let errorMsg = '';

        if (productKey) {
          const costDocRef = doc(db, "costs_catalog", productKey.toString());
          const costSnap = await getDoc(costDocRef);

          if (costSnap.exists()) {
            const costData = costSnap.data();
            const uniPorCaja = costData.Uni_por_caja || 0;
            const utilidadDecimal = costData["Utilidad_%"] !== undefined ? costData["Utilidad_%"] : 0;
            utility = utilidadDecimal;

            if (uniPorCaja <= 0) {
              errorMsg = 'Uni_por_caja inválido (0 o nulo)';
            } else {
              const costoUnidad = roundTo2(newPrice / uniPorCaja);
              const precioSugeridoRaw = roundTo2(costoUnidad * (1 + utilidadDecimal));
              const precioSugeridoRed = roundTo2(Math.ceil(precioSugeridoRaw));
              const margen = roundTo2(precioSugeridoRaw - costoUnidad);

              suggestedPrice = precioSugeridoRed;

              await updateDoc(costDocRef, {
                Costo_base_principal: newPrice,
                Costo_unidad: costoUnidad,
                Precio_sugerido: precioSugeridoRaw,
                Precio_sug_red: precioSugeridoRed,
                Margen: margen,
                last_update: serverTimestamp()
              });
            }
          } else {
            errorMsg = 'No se encontró registro en costs_catalog';
          }
        }

        results.push({
          name: providerDoc.Nombre_Completo || inputName,
          status: errorMsg ? 'ERROR' : priceStatus,
          newSuggestedPrice: suggestedPrice,
          utility: utility,
          error: errorMsg
        });
      }

      setReport(results);
      setProductList('');
      setStatusMessage({ text: 'Sincronización finalizada con éxito.', type: 'success' });
    } catch (err: any) {
      console.error(err);
      setStatusMessage({ text: `Error: ${err.message}`, type: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="relative flex flex-col h-screen w-full max-w-md mx-auto bg-background-light dark:bg-background-dark shadow-2xl overflow-hidden pb-32 font-display text-slate-900 dark:text-white">
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
            style={{backgroundImage: "url('https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&q=80&w=800')"}}
          ></div>
          <div className="relative p-6 bg-gradient-to-t from-surface-dark via-surface-dark/80 to-transparent w-full">
            <h2 className="text-xl font-black text-white">Sincronización Transaccional</h2>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">Cálculo de Margen y Precio Sugerido (2 Dec)</p>
          </div>
        </div>

        {statusMessage && (
          <div className={`p-4 rounded-2xl flex items-start gap-3 border animate-in slide-in-from-top-2 ${
            statusMessage.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400' : 
            statusMessage.type === 'info' ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20 text-blue-700 dark:text-blue-400' :
            'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400'
          }`}>
            <span className="material-symbols-outlined shrink-0">
              {statusMessage.type === 'success' ? 'verified' : statusMessage.type === 'info' ? 'info' : 'error'}
            </span>
            <p className="text-sm font-bold leading-tight">{statusMessage.text}</p>
          </div>
        )}

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Entrada de Datos</label>
            <p className="text-[9px] text-slate-400 font-bold mb-1 ml-1 uppercase">Pega aquí: Nombre del Producto, Precio Nuevo</p>
            <textarea 
              value={productList}
              onChange={(e) => setProductList(e.target.value)}
              className="w-full rounded-2xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark text-slate-900 dark:text-white p-5 text-sm min-h-[260px] font-mono leading-relaxed transition-all outline-none resize-none shadow-inner focus:ring-2 focus:ring-primary/20" 
              placeholder="Ej: SABRITAS ORIGINAL 45G, 18.50&#10;COCA COLA 600ML, 17.00"
            ></textarea>
          </div>
        </div>
      </main>

      {/* MODAL DE INFORME FINAL */}
      {report && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-full max-w-sm bg-white dark:bg-surface-dark rounded-[2.5rem] flex flex-col max-h-[85vh] shadow-2xl border border-slate-100 dark:border-white/5 overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-white/5 bg-primary/5">
              <h3 className="text-xl font-black text-slate-900 dark:text-white">Resumen de Operación</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Status de Inventario Firestore</p>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
              {report.map((res, i) => (
                <div key={i} className={`p-4 rounded-2xl border transition-colors ${
                  res.status === 'SUBIÓ' ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20' :
                  res.status === 'BAJÓ' ? 'bg-red-50 dark:bg-red-500/10 border-red-100 dark:border-red-500/20' :
                  res.status === 'SIN CAMBIOS' ? 'bg-slate-50 dark:bg-white/5 border-slate-100 dark:border-white/10' :
                  'bg-white dark:bg-surface-dark border-slate-200 dark:border-white/10'
                }`}>
                  <p className="text-xs font-black text-slate-900 dark:text-white uppercase truncate">{res.name}</p>
                  
                  <div className="flex justify-between items-center mt-2">
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${
                      res.status === 'SUBIÓ' ? 'bg-emerald-500 text-white' :
                      res.status === 'BAJÓ' ? 'bg-red-500 text-white' :
                      res.status === 'SIN CAMBIOS' ? 'bg-slate-300 text-slate-700' :
                      'bg-slate-100 text-slate-400'
                    }`}>
                      {res.status}
                    </span>
                    {res.newSuggestedPrice !== undefined && res.status !== 'NO ENCONTRADO' && (
                      <span className="text-xs font-black text-primary">Venta: ${res.newSuggestedPrice.toFixed(2)}</span>
                    )}
                  </div>

                  {(res.utility !== undefined || res.error) && (
                    <div className="mt-2 pt-2 border-t border-black/5 flex justify-between items-center">
                      <p className="text-[9px] font-bold text-slate-500 uppercase">
                        Utilidad: {res.utility !== undefined ? (res.utility * 100).toFixed(0) : '0'}%
                      </p>
                      {res.error && <p className="text-[9px] text-red-500 font-bold uppercase">{res.error}</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="p-4 bg-slate-50 dark:bg-white/5">
              <button 
                onClick={() => setReport(null)}
                className="w-full py-4 bg-primary text-white font-black rounded-2xl shadow-lg active:scale-95 transition-all"
              >
                Cerrar Informe
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-[88px] left-0 right-0 px-6 max-w-md mx-auto z-40">
        <button 
          onClick={handleProcessUpdates}
          disabled={isProcessing}
          className="w-full bg-primary hover:bg-primary-dark active:scale-[0.98] transition-all text-white font-black py-4.5 rounded-2xl shadow-xl flex items-center justify-center gap-3 group disabled:opacity-50"
        >
          {isProcessing ? (
            <span className="material-symbols-outlined animate-spin">sync</span>
          ) : (
            <>
              <span>Ejecutar Actualización</span>
              <span className="material-symbols-outlined text-[20px] group-hover:translate-x-1 transition-transform">database</span>
            </>
          )}
        </button>
      </div>

      <BottomNav />
    </div>
  );
};

export default PriceUpdateScreen;
