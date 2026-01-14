
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import { db } from '../services/firebase';
import { 
  collection, 
  query, 
  where,
  orderBy, 
  limit, 
  getDocs 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import VoiceInputButton from '../components/VoiceInputButton';

const PriceVerificationScreen: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [productQuery, setProductQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizeText = (text: string): string => {
    if (!text) return "";
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Quita diacríticos
      .replace(/[-_.,/\\()]/g, ' ') // Reemplaza separadores por espacio
      .replace(/[^a-z0-9\s]/g, '') // Solo letras, números y espacios
      .replace(/\s+/g, ' ') // Colapsa espacios múltiples
      .trim();
  };

  const tokenize = (text: string): string[] => {
    return text.split(' ').filter(t => t.length >= 2 || !isNaN(Number(t)));
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const qNorm = normalizeText(productQuery);
    const qTokens = tokenize(qNorm);
    
    if (qTokens.length === 0) {
      setResults([]);
      setError("Escribe al menos una palabra o número.");
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      const colRef = collection(db, "costs_catalog");
      let finalResults: any[] = [];

      // ESTRATEGIA PRINCIPAL: Búsqueda por tokens (array-contains)
      const anchorToken = qTokens.reduce((a, b) => a.length > b.length ? a : b);
      
      const qMain = query(
        colRef,
        where("searchTokens", "array-contains", anchorToken),
        limit(60)
      );

      const snapMain = await getDocs(qMain);
      
      let hits = snapMain.docs.map(doc => {
        const data = doc.data();
        const rawPrice = data?.Precio_sug_red;
        
        // Conversión segura de precio para evitar NaN (limpiando $, comas y espacios)
        const cleanPriceStr = String(rawPrice || '').replace(/[$,\s]/g, '');
        const price = typeof rawPrice === "number" ? rawPrice : Number(cleanPriceStr);
        const safePrice = Number.isFinite(price) ? price : null;

        return { 
          id: doc.id, // Este es el ProductKey
          ...data,
          _safePrice: safePrice,
          _isPriceMissing: safePrice === null
        };
      });

      if (hits.length > 0) {
        finalResults = hits.filter((h: any) => {
          const hName = h.searchName || normalizeText(h.Nombre_Completo || "");
          const containsFull = hName.includes(qNorm);
          const matchedTokens = qTokens.filter(t => hName.includes(t)).length;
          return containsFull || matchedTokens >= Math.ceil(qTokens.length * 0.7);
        });

        // Ranking por relevancia
        finalResults.sort((a, b) => {
          const aName = a.searchName || normalizeText(a.Nombre_Completo || "");
          const bName = b.searchName || normalizeText(b.Nombre_Completo || "");
          
          const aFull = aName.includes(qNorm) ? 1 : 0;
          const bFull = bName.includes(qNorm) ? 1 : 0;
          if (aFull !== bFull) return bFull - aFull;

          const aMatches = qTokens.filter(t => aName.includes(t)).length;
          const bMatches = qTokens.filter(t => bName.includes(t)).length;
          if (aMatches !== bMatches) return bMatches - aMatches;

          return aName.length - bName.length;
        });
      }

      // FALLBACK: Si no hay resultados directos
      if (finalResults.length === 0) {
        const qFallback = query(colRef, orderBy("searchName"), limit(100));
        const snapFallback = await getDocs(qFallback);
        const candidates = snapFallback.docs.map(doc => {
          const data = doc.data();
          const rawPrice = data?.Precio_sug_red;
          const cleanPriceStr = String(rawPrice || '').replace(/[$,\s]/g, '');
          const price = typeof rawPrice === "number" ? rawPrice : Number(cleanPriceStr);
          const safePrice = Number.isFinite(price) ? price : null;
          return { 
            id: doc.id, 
            ...data, 
            _safePrice: safePrice,
            _isPriceMissing: safePrice === null
          };
        });

        finalResults = candidates.filter((c: any) => {
          const cName = c.searchName || normalizeText(c.Nombre_Completo || "");
          return qTokens.some(t => cName.includes(t));
        }).slice(0, 20);
      }

      setResults(finalResults.slice(0, 25));
      if (finalResults.length === 0) {
        setError("Sin coincidencias en el catálogo.");
      }
      
    } catch (err: any) {
      console.error(err);
      setError("Error en la conexión. Intenta de nuevo.");
    } finally {
      setIsSearching(false);
    }
  };

  // Re-ejecutar búsqueda al volver si hay query
  useEffect(() => {
    if (productQuery.length >= 2) {
      handleSearch();
    }
  }, [location.key]);

  return (
    <div className="relative flex flex-col h-screen w-full max-w-md mx-auto bg-background-light dark:bg-background-dark shadow-2xl overflow-hidden pb-32 font-display">
      <header className="flex items-center justify-between p-4 pb-2 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md shrink-0 z-30 pt-12">
        <button onClick={() => navigate('/tools')} className="flex items-center justify-center size-10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-slate-900 dark:text-white">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-lg font-bold flex-1 text-center pr-10">Verificación de Precios</h1>
      </header>

      <main className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
        <div className="bg-primary rounded-[2.5rem] p-7 text-white shadow-xl shadow-primary/20 relative overflow-hidden">
          <span className="material-symbols-outlined absolute right-0 top-0 text-9xl opacity-10">inventory_2</span>
          <h2 className="text-xl font-black mb-1">Buscador F1</h2>
          <p className="text-blue-100 text-[11px] font-bold uppercase tracking-wider leading-tight max-w-[75%]">Consulta precios finales por nombre, marca o presentación.</p>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">¿Qué producto buscas?</label>
          <div className="relative flex items-center">
            <input 
              type="text" 
              value={productQuery} 
              onChange={(e) => setProductQuery(e.target.value)} 
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Ej: Cloralex 1lt, Sabritas..." 
              className="w-full rounded-2xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/5 py-4.5 px-6 pr-14 text-sm font-bold outline-none focus:ring-2 focus:ring-primary shadow-sm dark:text-white" 
            />
            <div className="absolute right-2 flex items-center gap-1">
               <VoiceInputButton onResult={(t) => {setProductQuery(t); setTimeout(handleSearch, 100);}} />
               <button 
                onClick={() => handleSearch()} 
                disabled={isSearching}
                className="size-10 bg-primary text-white rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-all disabled:opacity-50"
               >
                 {isSearching ? <span className="material-symbols-outlined animate-spin text-sm">sync</span> : <span className="material-symbols-outlined text-sm">search</span>}
               </button>
            </div>
          </div>
        </div>

        {error && <p className="text-red-500 text-[10px] font-black uppercase text-center animate-pulse">{error}</p>}

        <div className="space-y-3 pb-20">
          {results.map((product, idx) => (
            <div 
              key={idx} 
              onClick={() => navigate(`/tools/product-edit/${product.id}`)}
              className="p-5 bg-white dark:bg-surface-dark rounded-3xl shadow-sm flex items-center justify-between border border-slate-100 dark:border-white/5 active:scale-[0.98] transition-all cursor-pointer group"
            >
              <div className="flex-1 pr-4">
                <p className="text-[13px] font-black text-slate-900 dark:text-white leading-tight uppercase group-hover:text-primary transition-colors">
                  {product.Nombre_Completo || "Sin Nombre"}
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Sugerido F1</span>
                  {product._isPriceMissing && (
                    <span 
                      className="text-[8px] bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-lg font-black border border-amber-500/20"
                    >
                      PRECIO NO DEFINIDO
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-2xl font-black text-primary tracking-tighter">
                  {product._isPriceMissing ? '---' : `$${product._safePrice.toFixed(2)}`}
                </p>
              </div>
            </div>
          ))}

          {!isSearching && results.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center py-10 opacity-20">
              <span className="material-symbols-outlined text-6xl">search_off</span>
              <p className="text-xs font-black uppercase tracking-[0.2em] mt-2 text-center">Inicia una búsqueda</p>
            </div>
          )}
        </div>
      </main>
      <BottomNav />
    </div>
  );
};

export default PriceVerificationScreen;
