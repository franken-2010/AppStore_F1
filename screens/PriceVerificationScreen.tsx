
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import { db } from '../services/firebase';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { GeminiService } from '../services/geminiService';

const PriceVerificationScreen: React.FC = () => {
  const navigate = useNavigate();
  const [productQuery, setProductQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productQuery) {
      setError("Por favor, ingresa un nombre de producto para buscar.");
      return;
    }

    setIsSearching(true);
    setError(null);
    setResults([]);

    try {
      // 1. Consultar todos los productos en Firebase
      const productsRef = collection(db, "products");
      const querySnapshot = await getDocs(productsRef);
      
      const productsDb = querySnapshot.docs.map(doc => doc.data());

      if (productsDb.length === 0) {
        setError("La base de datos está vacía. Sube el catálogo en Ajustes > BDD.");
        setIsSearching(false);
        return;
      }

      // 2. Usar Gemini para búsqueda semántica sobre toda la base de datos
      const matches = await GeminiService.findProductsSemantic(productQuery, productsDb);
      setResults(matches);
      
      if (matches.length === 0) {
        setError("No se encontraron coincidencias para este producto.");
      }
    } catch (err) {
      console.error(err);
      setError("Error en la conexión con la base de datos.");
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="relative flex flex-col h-screen w-full max-w-md mx-auto bg-background-light dark:bg-background-dark shadow-2xl overflow-hidden pb-32 font-display">
      <header className="flex items-center justify-between p-4 pb-2 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md shrink-0 z-30 pt-12">
        <button onClick={() => navigate(-1)} className="flex items-center justify-center size-10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-slate-900 dark:text-white">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-lg font-bold flex-1 text-center pr-10">Verificación de Precios</h1>
      </header>

      <main className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
        <div className="bg-blue-600 rounded-[2.5rem] p-7 text-white shadow-xl shadow-blue-600/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-20">
            <span className="material-symbols-outlined text-7xl">search_insights</span>
          </div>
          <h2 className="text-xl font-black mb-1">Buscador de Precios</h2>
          <p className="text-blue-100 text-[11px] font-bold uppercase tracking-wider leading-tight max-w-[75%]">
            Consulta precios sugeridos en toda la base de datos maestra con IA.
          </p>
        </div>

        <form onSubmit={handleSearch} className="space-y-5">
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">¿Qué producto buscas?</label>
            <div className="relative group">
              <input 
                type="text"
                value={productQuery}
                onChange={(e) => setProductQuery(e.target.value)}
                placeholder="Ej: Cloralex, Suavitel, etc."
                className="w-full rounded-2xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/5 py-4.5 px-6 text-base font-bold outline-none focus:ring-2 focus:ring-primary shadow-sm transition-all"
              />
              <span className="material-symbols-outlined absolute right-5 top-1/2 -translate-y-1/2 text-primary font-black">manage_search</span>
            </div>
          </div>

          <button 
            type="submit"
            disabled={isSearching}
            className="w-full py-5 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/20 flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50"
          >
            {isSearching ? <span className="material-symbols-outlined animate-spin">sync</span> : 'Buscar en Catálogo Master'}
          </button>
        </form>

        {error && (
          <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 text-red-700 dark:text-red-400 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
            <span className="material-symbols-outlined shrink-0">warning</span>
            <p className="text-xs font-bold leading-tight">{error}</p>
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-6 duration-500">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Resultados de la IA:</h3>
              <span className="text-[10px] font-bold bg-primary/10 text-primary px-3 py-1 rounded-full uppercase tracking-tight">Precio Redondeado</span>
            </div>
            <div className="flex flex-col gap-3">
              {results.map((product, idx) => (
                <div key={idx} className="p-5 bg-white dark:bg-surface-dark rounded-3xl border border-slate-100 dark:border-white/5 shadow-sm flex items-center justify-between group hover:border-primary transition-all">
                  <div className="flex-1">
                    <p className="text-sm font-black text-slate-900 dark:text-white leading-tight">{product.name}</p>
                    <div className="flex items-center gap-1.5 mt-2">
                      <span className="material-symbols-outlined text-[14px] text-emerald-500">check_circle</span>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Sugerencia de Venta</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-primary tracking-tighter">${product.price.toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default PriceVerificationScreen;
