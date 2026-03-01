
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { 
  collection, 
  getDocs, 
  doc, 
  serverTimestamp, 
  writeBatch, 
  runTransaction,
  query,
  orderBy,
  limit,
  where
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const ProductAddScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [availableProviders, setAvailableProviders] = useState<string[]>([]);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  
  const [formData, setFormData] = useState({
    categoria: '',
    producto: '',
    presentacion: '',
    uniPorCaja: 1,
    costoBase: '',
    utilidad: 0.2,
    proveedor: ''
  });

  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<{ text: string, type: 'success' | 'error' } | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      try {
        // 1. Obtener proveedores desde suppliers_directory (Nuevo origen de verdad)
        // FIX: Eliminamos orderBy para evitar error de índice compuesto en tiempo real.
        const qDir = query(
          collection(db, "suppliers_directory"), 
          where("uid", "==", user.uid),
          where("isActive", "==", true)
        );
        const dirSnap = await getDocs(qDir);
        // Explicitly cast to string[] to resolve potential 'unknown' type issues
        let provs = dirSnap.docs.map(d => d.data().supplierName as string).filter(Boolean);
        
        // Si no hay contactos en el directorio, intentamos sacar del catálogo existente como fallback
        if (provs.length === 0) {
          const provSnap = await getDocs(collection(db, "providers"));
          // Explicitly cast result to string[] for consistent typing
          provs = Array.from(new Set(provSnap.docs.map(d => (d.data().Proveedor || d.data().name) as string).filter(Boolean)));
        }
        
        // Ordenamos en memoria
        // Fix: Explicitly type sort parameters as strings to resolve the 'unknown' error on localeCompare
        setAvailableProviders(Array.from(new Set(provs)).sort((a: string, b: string) => a.localeCompare(b)));

        // 2. Obtener categorías
        const prodSnap = await getDocs(collection(db, "products"));
        const cats = Array.from(new Set(prodSnap.docs.map(d => d.data().Categoría).filter(Boolean))) as string[];
        const defaultCats = cats.length > 0 ? cats : ['Abarrotes', 'Bebidas', 'Botanas', 'Limpieza', 'Lácteos', 'Panadería'];
        setAvailableCategories(defaultCats.sort((a, b) => a.localeCompare(b)));

      } catch (error) {
        console.error("Error fetching catalogs:", error);
      } finally {
        setLoadingInitial(false);
      }
    };
    fetchData();
  }, [user]);

  const normalizeText = (text: string): string => {
    if (!text) return "";
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/ñ/g, "n")
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const tokenize = (text: string): string[] => {
    return text.split(' ').filter(t => t.length >= 1);
  };

  const formatCurrency = (val: number) => `$${val.toFixed(2)}`;

  const parseCurrencyInput = (val: string): string => {
    const numeric = val.replace(/[$,]/g, '');
    const parsed = parseFloat(numeric);
    return isNaN(parsed) ? "" : parsed.toFixed(2);
  };

  const handleCostoBlur = () => {
    if (formData.costoBase) {
      const formatted = parseCurrencyInput(formData.costoBase);
      if (formatted) setFormData({ ...formData, costoBase: `$${formatted}` });
    }
  };

  const handleSave = async () => {
    if (!user) return;

    if (!formData.categoria || !formData.producto || !formData.presentacion || !formData.proveedor || !formData.costoBase) {
      setStatus({ text: 'Todos los campos son obligatorios.', type: 'error' });
      return;
    }

    setIsSaving(true);
    setStatus(null);

    try {
      const counterRef = doc(db, "counters", "products");
      
      const newProductoID = await runTransaction(db, async (transaction) => {
        const counterSnap = await transaction.get(counterRef);
        let nextId = 1;
        if (counterSnap.exists()) {
          nextId = (counterSnap.data().lastProductoID || 0) + 1;
        } else {
          const qMax = query(collection(db, "products"), orderBy("ProductoID", "desc"), limit(1));
          const maxSnap = await getDocs(qMax);
          if (!maxSnap.empty) nextId = (maxSnap.docs[0].data().ProductoID || 0) + 1;
        }
        transaction.set(counterRef, { lastProductoID: nextId }, { merge: true });
        return nextId;
      });

      const ProductKey = `PRD-${newProductoID.toString().padStart(6, '0')}`;
      const Nombre_Completo = `${formData.producto.trim()} ${formData.presentacion.trim()}`;
      const searchName = normalizeText(Nombre_Completo);
      const searchTokens = tokenize(searchName);
      
      const costoBaseNum = parseFloat(formData.costoBase.replace(/[$,]/g, '')) || 0;
      const costoUnidadNum = costoBaseNum / formData.uniPorCaja;
      const precioSugeridoNum = costoUnidadNum * (1 + formData.utilidad);
      const precioSugRedNum = Math.ceil(precioSugeridoNum);
      const margenNum = precioSugRedNum - costoUnidadNum;

      const batch = writeBatch(db);

      // C1) Products
      const prodRef = doc(db, "products", ProductKey);
      batch.set(prodRef, {
        Categoría: formData.categoria,
        Producto: formData.producto.trim(),
        Presentación: formData.presentacion.trim(),
        Uni_por_caja: formData.uniPorCaja,
        Proveedor_principal: formData.proveedor,
        ProductoID: newProductoID,
        ProductKey: ProductKey,
        Nombre_Completo: Nombre_Completo,
        _importDate: serverTimestamp()
      });

      // C2) costs_catalog
      const costRef = doc(db, "costs_catalog", ProductKey);
      batch.set(costRef, {
        ProductKey, ProductoID: newProductoID, Nombre_Completo,
        Uni_por_caja: formData.uniPorCaja, "Utilidad_%": formData.utilidad,
        Costo_base_principal: formatCurrency(costoBaseNum),
        Costo_unidad: formatCurrency(costoUnidadNum),
        Precio_sugerido: formatCurrency(precioSugeridoNum),
        Precio_sug_red: precioSugRedNum,
        Precio_sug_red_raw: formatCurrency(precioSugRedNum),
        "Margen_$": formatCurrency(margenNum),
        searchName, searchTokens,
        searchIndexedAt: serverTimestamp(),
        priceNormalizedAt: serverTimestamp(),
        _importDate: serverTimestamp()
      });

      // C3) providers
      const providerProdRef = doc(db, "providers", ProductKey);
      batch.set(providerProdRef, {
        ProductKey, ProductoID: newProductoID,
        Proveedor: formData.proveedor, Nombre_Completo,
        Uni_por_caja: formData.uniPorCaja, Costo_actual: costoBaseNum,
        Fecha_ult_actualización: serverTimestamp(),
        _importDate: serverTimestamp()
      });

      await batch.commit();

      setStatus({ 
        text: `✅ Producto creado: ${ProductKey}. Sugerido: ${formatCurrency(precioSugRedNum)}`, 
        type: 'success' 
      });

      setFormData({ categoria: '', producto: '', presentacion: '', uniPorCaja: 1, costoBase: '', utilidad: 0.2, proveedor: '' });

    } catch (error: any) {
      console.error(error);
      setStatus({ text: `Error: ${error.message}`, type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  if (loadingInitial) return <div className="min-h-screen bg-background-dark flex items-center justify-center"><span className="material-symbols-outlined animate-spin text-primary text-4xl">sync</span></div>;

  return (
    <div className="relative flex flex-col h-screen w-full max-w-md mx-auto bg-background-light dark:bg-background-dark shadow-2xl overflow-hidden pb-32 font-display">
      <header className="flex items-center justify-between p-4 pb-2 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md shrink-0 z-30 pt-12 border-b border-slate-100 dark:border-white/5">
        <button onClick={() => navigate(-1)} className="flex items-center justify-center size-10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-slate-900 dark:text-white">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-lg font-bold flex-1 text-center pr-10">Alta de Productos</h1>
      </header>

      <main className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
        <div className="p-7 rounded-[2.5rem] bg-indigo-600 text-white shadow-xl shadow-indigo-600/20 relative overflow-hidden">
          <div className="flex items-center gap-3 mb-2 relative z-10">
            <span className="material-symbols-outlined text-3xl">add_box</span>
            <h2 className="text-xl font-black">Registro Triple F1</h2>
          </div>
          <p className="text-indigo-100 text-[10px] font-black uppercase tracking-widest relative z-10 leading-relaxed">Sincronización automática con directorio</p>
          <span className="material-symbols-outlined absolute right-[-10px] top-[-10px] text-9xl opacity-10">inventory_2</span>
        </div>

        {status && (
          <div className={`p-5 rounded-2xl border animate-in slide-in-from-top-2 ${status.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
            <p className="text-xs font-bold leading-relaxed">{status.text}</p>
          </div>
        )}

        <div className="flex flex-col gap-5 pb-10">
          {/* Form Fields Mapping */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Categoría</label>
            <div className="relative">
              <select 
                value={formData.categoria} 
                onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                className="w-full py-4 px-5 rounded-xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/5 outline-none font-bold appearance-none dark:text-white"
              >
                <option value="">Seleccionar Categoría...</option>
                {availableCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
              <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Producto (Nombre)</label>
            <input value={formData.producto} onChange={(e) => setFormData({ ...formData, producto: e.target.value })} className="w-full py-4 px-5 rounded-xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/5 outline-none font-bold dark:text-white" placeholder="Ej: Aceite Nutrioli" />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Presentación</label>
            <input value={formData.presentacion} onChange={(e) => setFormData({ ...formData, presentacion: e.target.value })} className="w-full py-4 px-5 rounded-xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/5 outline-none font-bold dark:text-white" placeholder="Ej: 500 ml" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Uni por Caja</label>
              <input type="number" value={formData.uniPorCaja} onChange={(e) => setFormData({ ...formData, uniPorCaja: parseInt(e.target.value) || 0 })} className="w-full py-4 px-5 rounded-xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/5 outline-none font-bold dark:text-white" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Utilidad (Ej: 0.20)</label>
              <input type="number" step="0.01" value={formData.utilidad} onChange={(e) => setFormData({ ...formData, utilidad: parseFloat(e.target.value) || 0 })} className="w-full py-4 px-5 rounded-xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/5 outline-none font-bold dark:text-white" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Costo Base ($)</label>
            <input value={formData.costoBase} onChange={(e) => setFormData({ ...formData, costoBase: e.target.value })} onBlur={handleCostoBlur} className="w-full py-4 px-5 rounded-xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/5 outline-none font-bold dark:text-white" placeholder="$0.00" />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Proveedor Principal</label>
            <div className="relative">
              <select 
                value={formData.proveedor} 
                onChange={(e) => setFormData({ ...formData, proveedor: e.target.value })}
                className="w-full py-4 px-5 rounded-xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/5 outline-none font-bold appearance-none dark:text-white"
              >
                <option value="">Seleccionar del Directorio...</option>
                {availableProviders.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
            </div>
          </div>
        </div>
      </main>

      <div className="fixed bottom-[88px] left-0 right-0 px-6 max-w-md mx-auto z-40">
        <button onClick={handleSave} disabled={isSaving} className="w-full bg-primary text-white font-black py-4.5 rounded-2xl shadow-xl shadow-primary/30 active:scale-95 transition-all disabled:opacity-50">
          {isSaving ? 'Sincronizando...' : 'Guardar Producto'}
        </button>
      </div>

      <BottomNav />
    </div>
  );
};

export default ProductAddScreen;
