
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import { db } from '../services/firebase';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { GeminiService } from '../services/geminiService';
import VoiceInputButton from '../components/VoiceInputButton';

const PriceVerificationScreen: React.FC = () => {
  const navigate = useNavigate();
  const [productQuery, setProductQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!productQuery) return;
    setIsSearching(true);
    setError(null);
    try {
      const snapshot = await getDocs(collection(db, "products"));
      const productsDb = snapshot.docs.map(doc => doc.data());
      if (productsDb.length === 0) { setError("Base de datos vacía."); return; }
      const matches = await GeminiService.findProductsSemantic(productQuery, productsDb);
      setResults(matches);
      if (matches.length === 0) setError("Sin coincidencias.");
    } catch (err) { setError("Error de conexión."); } finally { setIsSearching(false); }
  };

  return (
    <div className="relative flex flex-col h-screen w-full max-w-md mx-auto bg-background-light dark:bg-background-dark shadow-2xl overflow-hidden pb-32 font-display">
      <header className="flex items-center justify-between p-4 pb-2 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md shrink-0 z-30 pt-12">
        <button onClick={() => navigate(-1)} className="flex items-center justify-center size-10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-slate-900 dark:text-white"><span className="material-symbols-outlined">arrow_back</span></button>
        <h1 className="text-lg font-bold flex-1 text-center pr-10">Verificación de Precios</h1>
      </header>
      <main className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
        <div className="bg-blue-600 rounded-[2.5rem] p-7 text-white shadow-xl shadow-blue-600/20 relative overflow-hidden">
          <span className="material-symbols-outlined absolute right-0 top-0 text-9xl opacity-10">search_insights</span>
          <h2 className="text-xl font-black mb-1">Buscador Inteligente</h2>
          <p className="text-blue-100 text-[11px] font-bold uppercase tracking-wider leading-tight max-w-[75%]">Consulta precios sugeridos con dictado por voz.</p>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">¿Qué producto buscas?</label>
          <div className="relative flex items-center">
            <input type="text" value={productQuery} onChange={(e) => setProductQuery(e.target.value)} placeholder="Ej: Cloralex, Sabritas..." className="w-full rounded-2xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/5 py-4.5 px-6 pr-14 text-base font-bold outline-none focus:ring-2 focus:ring-primary shadow-sm" />
            <div className="absolute right-2 flex items-center gap-1">
               <VoiceInputButton onResult={(t) => {setProductQuery(t); handleSearch();}} />
               <button onClick={() => handleSearch()} className="size-8 bg-primary text-white rounded-full flex items-center justify-center shadow-lg"><span className="material-symbols-outlined text-sm">search</span></button>
            </div>
          </div>
        </div>
        {error && <p className="text-red-500 text-xs font-bold text-center">{error}</p>}
        <div className="space-y-3">
          {results.map((product, idx) => (
            <div key={idx} className="p-5 bg-white dark:bg-surface-dark rounded-3xl shadow-sm flex items-center justify-between border dark:border-white/5 animate-in slide-in-from-bottom-2">
              <p className="text-sm font-black text-slate-900 dark:text-white leading-tight">{product.name}</p>
              <p className="text-2xl font-black text-primary tracking-tighter">${product.price.toFixed(2)}</p>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  );
};

export default PriceVerificationScreen;
