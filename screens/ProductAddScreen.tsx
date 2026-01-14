
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
  limit
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const ProductAddScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Listas para dropdowns
  const [availableProviders, setAvailableProviders] = useState<string[]>([]);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  
  // Estado del formulario
  const [formData, setFormData] = useState({
    categoria: '',
    producto: '',
    presentacion: '',
    uniPorCaja: 1,
    costoBase: '',
    utilidad: 0.2, // 20% por defecto
    proveedor: ''
  });

  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<{ text: string, type: 'success' | 'error' } | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Cargar catálogos iniciales
  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Obtener proveedores únicos de la colección raíz 'providers'
        // Según requerimiento: "La lista se obtiene de la colección providers existente"
        const provSnap = await getDocs(collection(db, "providers"));
        const provs = Array.from(new Set(provSnap.docs.map(d => d.data().Proveedor || d.data().name).filter(Boolean))) as string[];
        setAvailableProviders(provs.sort());

        // 2. Obtener categorías únicas de 'products'
        const prodSnap = await getDocs(collection(db, "products"));
        const cats = Array.from(new Set(prodSnap.docs.map(d => d.data().Categoría).filter(Boolean))) as string[];
        // Si no hay categorías, ponemos unas por defecto
        const defaultCats = cats.length > 0 ? cats : ['Abarrotes', 'Bebidas', 'Botanas', 'Limpieza', 'Lácteos', 'Panadería'];
        setAvailableCategories(defaultCats.sort());

      } catch (error) {
        console.error("Error fetching catalogs:", error);
      } finally {
        setLoadingInitial(false);
      }
    };
    fetchData();
  }, []);

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

    // Validaciones
    if (!formData.categoria || !formData.producto || !formData.presentacion || !formData.proveedor || !formData.costoBase) {
      setStatus({ text: 'Todos los campos son obligatorios.', type: 'error' });
      return;
    }

    if (formData.uniPorCaja <= 0) {
      setStatus({ text: 'Unidades por caja debe ser mayor a 0.', type: 'error' });
      return;
    }

    if (formData.utilidad < 0 || formData.utilidad > 1) {
      setStatus({ text: 'Utilidad debe estar entre 0 y 1.', type: 'error' });
      return;
    }

    setIsSaving(true);
    setStatus(null);

    try {
      // 1. Obtener Siguiente ProductoID mediante Transacción (Consistencia)
      const counterRef = doc(db, "counters", "products");
      
      const newProductoID = await runTransaction(db, async (transaction) => {
        const counterSnap = await transaction.get(counterRef);
        let nextId = 1;

        if (counterSnap.exists()) {
          nextId = (counterSnap.data().lastProductoID || 0) + 1;
        } else {
          // Fallback: Si el contador no existe, buscamos el max en la colección
          const qMax = query(collection(db, "products"), orderBy("ProductoID", "desc"), limit(1));
          const maxSnap = await getDocs(qMax);
          if (!maxSnap.empty) {
            nextId = (maxSnap.docs[0].data().ProductoID || 0) + 1;
          }
        }

        transaction.set(counterRef, { lastProductoID: nextId }, { merge: true });
        return nextId;
      });

      // 2. Preparar Datos y Cálculos
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

      // C1) Colección products
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

      // C2) Colección costs_catalog
      const costRef = doc(db, "costs_catalog", ProductKey);
      batch.set(costRef, {
        ProductKey,
        ProductoID: newProductoID,
        Nombre_Completo,
        Uni_por_caja: formData.uniPorCaja,
        "Utilidad_%": formData.utilidad,
        Costo_base_principal: formatCurrency(costoBaseNum),
        Costo_unidad: formatCurrency(costoUnidadNum),
        Precio_sugerido: formatCurrency(precioSugeridoNum),
        Precio_sug_red: precioSugRedNum,
        Precio_sug_red_raw: formatCurrency(precioSugRedNum),
        "Margen_$": formatCurrency(margenNum),
        searchName,
        searchTokens,
        searchIndexedAt: serverTimestamp(),
        priceNormalizedAt: serverTimestamp(),
        _importDate: serverTimestamp()
      });

      // C3) Colección providers
      const providerProdRef = doc(db, "providers", ProductKey);
      batch.set(providerProdRef, {
        ProductKey,
        ProductoID: newProductoID,
        Proveedor: formData.proveedor,
        Nombre_Completo,
        Uni_por_caja: formData.uniPorCaja,
        Costo_actual: costoBaseNum,
        Fecha_ult_actualización: serverTimestamp(),
        _importDate: serverTimestamp()
      });

      await batch.commit();

      setStatus({ 
        text: `✅ Producto creado: ${ProductKey}. ${Nombre_Completo} (${formData.proveedor}). Precio Redondeado: ${formatCurrency(precioSugRedNum)}`, 
        type: 'success' 
      });

      // Limpiar formulario
      setFormData({
        categoria: '',
        producto: '',
        presentacion: '',
        uniPorCaja: 1,
        costoBase: '',
        utilidad: 0.2,
        proveedor: ''
      });

    } catch (error: any) {
      console.error("Error saving product:", error);
      setStatus({ text: `Error: ${error.message || 'No se pudo generar ProductKey. Reintenta.'}`, type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  if (loadingInitial) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark flex flex-col items-center justify-center space-y-4">
        <span className="material-symbols-outlined animate-spin text-primary text-4xl">sync</span>
        <p className="text-xs font-black uppercase text-slate-500 tracking-widest">Cargando catálogos...</p>
      </div>
    );
  }

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
          <p className="text-indigo-100 text-[10px] font-black uppercase tracking-widest relative z-10 leading-relaxed">
            Sincronización automática en:<br/>Products, Costs Catalog y Providers
          </p>
          <span className="material-symbols-outlined absolute right-[-10px] top-[-10px] text-9xl opacity-10">inventory_2</span>
        </div>

        {status && (
          <div className={`p-5 rounded-2xl flex items-start gap-3 border animate-in slide-in-from-top-2 ${status.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20' : 'bg-red-50 border-red-200 text-red-700 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20'}`}>
            <span className="material-symbols-outlined mt-0.5">{status.type === 'success' ? 'verified' : 'error'}</span>
            <p className="text-xs font-bold leading-relaxed">{status.text}</p>
          </div>
        )}

        <div className="flex flex-col gap-5 pb-10">
          {/* Categoría */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Categoría</label>
            <div className="relative">
              <select 
                value={formData.categoria} 
                onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                className="w-full py-4 px-5 rounded-xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/5 outline-none font-bold focus:ring-2 focus:ring-indigo-500/20 shadow-sm appearance-none dark:text-white"
              >
                <option value="">Seleccionar Categoría...</option>
                {availableCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
              <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
            </div>
          </div>

          {/* Producto */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Producto (Nombre)</label>
            <input 
              value={formData.producto} 
              onChange={(e) => setFormData({ ...formData, producto: e.target.value })} 
              className="w-full py-4 px-5 rounded-xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/5 outline-none font-bold focus:ring-2 focus:ring-indigo-500/20 shadow-sm dark:text-white" 
              placeholder="Ej: Aceite Nutrioli" 
            />
          </div>

          {/* Presentación */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Presentación</label>
            <input 
              value={formData.presentacion} 
              onChange={(e) => setFormData({ ...formData, presentacion: e.target.value })} 
              className="w-full py-4 px-5 rounded-xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/5 outline-none font-bold focus:ring-2 focus:ring-indigo-500/20 shadow-sm dark:text-white" 
              placeholder="Ej: 500 ml, 1 Kg" 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Uni por Caja */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Uni por Caja</label>
              <input 
                type="number" 
                value={formData.uniPorCaja} 
                onChange={(e) => setFormData({ ...formData, uniPorCaja: parseInt(e.target.value) || 0 })} 
                className="w-full py-4 px-5 rounded-xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/5 outline-none font-bold focus:ring-2 focus:ring-indigo-500/20 shadow-sm dark:text-white" 
              />
            </div>
            
            {/* Utilidad % */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Utilidad (Ej: 0.20)</label>
              <input 
                type="number" 
                step="0.01" 
                value={formData.utilidad} 
                onChange={(e) => setFormData({ ...formData, utilidad: parseFloat(e.target.value) || 0 })} 
                className="w-full py-4 px-5 rounded-xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/5 outline-none font-bold focus:ring-2 focus:ring-indigo-500/20 shadow-sm dark:text-white" 
              />
            </div>
          </div>

          {/* Costo Base Principal */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Costo Base Principal ($)</label>
            <div className="relative">
              <input 
                value={formData.costoBase} 
                onChange={(e) => setFormData({ ...formData, costoBase: e.target.value })} 
                onBlur={handleCostoBlur}
                className="w-full py-4 px-5 rounded-xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/5 outline-none font-bold focus:ring-2 focus:ring-indigo-500/20 shadow-sm dark:text-white" 
                placeholder="$0.00" 
              />
              <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">payments</span>
            </div>
          </div>

          {/* Proveedor Principal */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Proveedor Principal</label>
            <div className="relative">
              <select 
                value={formData.proveedor} 
                onChange={(e) => setFormData({ ...formData, proveedor: e.target.value })}
                className="w-full py-4 px-5 rounded-xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/5 outline-none font-bold focus:ring-2 focus:ring-indigo-500/20 shadow-sm appearance-none dark:text-white"
              >
                <option value="">Seleccionar Proveedor...</option>
                {availableProviders.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">local_shipping</span>
            </div>
          </div>
        </div>
      </main>

      <div className="fixed bottom-[88px] left-0 right-0 px-6 max-w-md mx-auto z-40 bg-gradient-to-t from-background-light dark:from-background-dark via-background-light dark:via-background-dark to-transparent pt-4 pb-2">
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="w-full bg-primary hover:bg-primary-dark text-white font-black py-4.5 rounded-2xl shadow-xl shadow-primary/30 flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50"
        >
          {isSaving ? <span className="material-symbols-outlined animate-spin">sync</span> : <span className="material-symbols-outlined">save_as</span>}
          <span>Sincronizar Producto F1</span>
        </button>
      </div>

      <BottomNav />
    </div>
  );
};

export default ProductAddScreen;
