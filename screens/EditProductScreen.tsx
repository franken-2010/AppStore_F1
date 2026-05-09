
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import { db } from '../services/firebase';
import { useNotifications } from '../context/NotificationContext';
import { 
  doc, 
  getDoc, 
  updateDoc, 
  serverTimestamp,
  collection,
  getDocs,
  writeBatch,
  query,
  where,
  Timestamp
} from "firebase/firestore";
import { handleFirestoreError, OperationType } from '../services/errorHandling';
import { useAuth } from '../context/AuthContext';

const EditProductScreen: React.FC = () => {
  const { productKey } = useParams();
  const navigate = useNavigate();
  const { addNotification } = useNotifications();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSummary, setSaveSummary] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeHelp, setActiveHelp] = useState<string | null>(null);
  const [availableProviders, setAvailableProviders] = useState<string[]>([]);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);

  const [formData, setFormData] = useState<any>({
    Producto: '',
    Presentación: '',
    Categoría: '',
    Proveedor_principal: '',
    Uni_por_caja: '1',
    Costo_base: '',
    Utilidad: 0.2
  });

  const helpContent: Record<string, string> = {
    producto: "Nombre base del artículo sin la presentación (ej. Coca-Cola, Aceite Nutrioli).",
    presentacion: "Contenido o tamaño del producto (ej. 600ml, 1Kg, Pack 6 piezas).",
    categoria: "Agrupación para reportes de ventas y organización (ej. Bebidas, Botanas, Abarrotes).",
    proveedor: "Compañía que suministra este artículo mayoritariamente.",
    unidades: "Cantidad de piezas individuales que vienen en una caja cerrada de proveedor.",
    costo: "Costo pagado por una caja completa al proveedor (en pesos).",
    utilidad: "Margen de ganancia deseado (ej. 0.20 para ganar el 20% sobre el costo)."
  };

  useEffect(() => {
    if (!productKey || !user) return;
    const loadData = async () => {
      try {
        // 1. Fetch Lists
        const qDir = query(
          collection(db, "suppliers_directory"), 
          where("uid", "==", user.uid),
          where("isActive", "==", true)
        );
        const dirSnap = await getDocs(qDir);
        let provs = dirSnap.docs.map(d => d.data().supplierName as string).filter(Boolean);
        if (provs.length === 0) {
          const provSnap = await getDocs(collection(db, "providers"));
          provs = Array.from(new Set(provSnap.docs.map(d => (d.data().Proveedor || d.data().name) as string).filter(Boolean)));
        }
        setAvailableProviders(Array.from(new Set(provs)).sort((a, b) => a.localeCompare(b)));

        const prodListSnap = await getDocs(collection(db, "products"));
        const cats = Array.from(new Set(prodListSnap.docs.map(d => d.data().Categoría).filter(Boolean))) as string[];
        const defaultCats = cats.length > 0 ? cats : ['Abarrotes', 'Bebidas', 'Botanas', 'Limpieza', 'Lácteos', 'Panadería'];
        setAvailableCategories(defaultCats.sort((a, b) => a.localeCompare(b)));

        // 2. Fetch Product Data
        const prodRef = doc(db, "products", productKey);
        const costRef = doc(db, "costs_catalog", productKey);
        
        const [prodSnap, costSnap] = await Promise.all([
          getDoc(prodRef),
          getDoc(costRef)
        ]);

        if (prodSnap.exists()) {
          const pData = prodSnap.data();
          const cData = costSnap.exists() ? costSnap.data() : {};
          
          setFormData({
            Producto: pData.Producto || '',
            Presentación: pData.Presentación || '',
            Categoría: pData.Categoría || '',
            Proveedor_principal: pData.Proveedor_principal || '',
            Uni_por_caja: (pData.Uni_por_caja || 1).toString(),
            Costo_base: (cData.Costo_base_principal || '').toString(),
            Utilidad: cData["Utilidad_%"] || 0.2
          });
        } else {
          setError("Producto no encontrado");
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `products_edit/${productKey}`);
        setError("Error al cargar datos.");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [productKey, user]);

  const Nombre_Completo = useMemo(() => {
    const p = formData.Producto || '';
    const pres = formData.Presentación || '';
    return `${p.trim()} ${pres.trim()}`.trim();
  }, [formData.Producto, formData.Presentación]);

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

  const parseCurrencyInput = (val: any): string => {
    const numeric = String(val || '').replace(/[$,]/g, '');
    const parsed = parseFloat(numeric);
    return isNaN(parsed) ? "" : parsed.toFixed(2);
  };

  const handleCostoBlur = () => {
    if (formData.Costo_base) {
      const formatted = parseCurrencyInput(formData.Costo_base);
      if (formatted) setFormData({ ...formData, Costo_base: `$${formatted}` });
    }
  };

  const handleSave = async () => {
    if (!productKey || !user) return;
    
    const uniPorCajaNum = parseInt(formData.Uni_por_caja);
    if (!formData.Categoría || !formData.Producto || !formData.Presentación || !formData.Proveedor_principal || !formData.Costo_base || isNaN(uniPorCajaNum) || uniPorCajaNum <= 0) {
      alert("Todos los campos con (*) son obligatorios.");
      return;
    }

    setIsSaving(true);
    const normName = normalizeText(Nombre_Completo);
    const tokens = tokenize(normName);
    const costoBaseNum = parseFloat(String(formData.Costo_base).replace(/[$,]/g, '')) || 0;
    const costoUnidadNum = costoBaseNum / uniPorCajaNum;
    const precioSugeridoNum = costoUnidadNum * (1 + formData.Utilidad);
    const precioSugRedNum = Math.ceil(precioSugeridoNum);
    const margenNum = precioSugRedNum - costoUnidadNum;

    try {
      const batch = writeBatch(db);
      const prodRef = doc(db, "products", productKey);
      const costRef = doc(db, "costs_catalog", productKey);
      const provRef = doc(db, "providers", productKey);

      // 1. Update Products
      batch.update(prodRef, {
        Producto: formData.Producto.trim(),
        Presentación: formData.Presentación.trim(),
        Categoría: formData.Categoría,
        Proveedor_principal: formData.Proveedor_principal,
        Uni_por_caja: uniPorCajaNum,
        Nombre_Completo,
        Nombre_Completo_norm: normName,
        updatedAt: serverTimestamp()
      });

      // 2. Update Costs Catalog
      batch.set(costRef, {
        Nombre_Completo,
        Nombre_Completo_norm: normName,
        Uni_por_caja: uniPorCajaNum,
        "Utilidad_%": formData.Utilidad,
        Costo_base_principal: formatCurrency(costoBaseNum),
        Costo_unidad: formatCurrency(costoUnidadNum),
        Precio_sugerido: formatCurrency(precioSugeridoNum),
        Precio_sug_red: precioSugRedNum,
        Precio_sug_red_raw: formatCurrency(precioSugRedNum),
        "Margen_$": formatCurrency(margenNum),
        searchName: normName,
        searchTokens: tokens,
        updatedAt: serverTimestamp(),
        searchIndexedAt: serverTimestamp(),
        priceNormalizedAt: serverTimestamp()
      }, { merge: true });

      // 3. Update Providers
      batch.set(provRef, {
        Proveedor: formData.Proveedor_principal,
        Nombre_Completo,
        Uni_por_caja: uniPorCajaNum,
        Costo_actual: costoBaseNum,
        Fecha_ult_actualización: serverTimestamp()
      }, { merge: true });

      await batch.commit();

      addNotification({ 
        title: 'Operación Exitosa', 
        message: `Se sincronizó el expediente de ${formData.Producto}`, 
        type: 'system' 
      });

      setSaveSummary({
        Producto: formData.Producto.trim(),
        Presentación: formData.Presentación.trim(),
        Categoría: formData.Categoría,
        Proveedor: formData.Proveedor_principal,
        CostoCaja: formatCurrency(costoBaseNum),
        CostoUnidad: formatCurrency(costoUnidadNum),
        PrecioSugerido: formatCurrency(precioSugeridoNum),
        PrecioRedondeado: formatCurrency(precioSugRedNum),
        Utilidad: `${(formData.Utilidad * 100).toFixed(1)}%`,
        Margen: formatCurrency(margenNum)
      });
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, `full_product_edit/${productKey}`);
    } finally {
      setIsSaving(false);
    }
  };

  const LabelWithHelp = ({ label, fieldId }: { label: string, fieldId: string }) => (
    <div className="flex items-center gap-2 mb-1.5 ml-1">
      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</label>
      <button
        type="button"
        onClick={() => setActiveHelp(activeHelp === fieldId ? null : fieldId)}
        className={`size-5 rounded-full flex items-center justify-center transition-all ${activeHelp === fieldId ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-110' : 'text-slate-400 hover:text-primary bg-slate-100 dark:bg-white/5'}`}
      >
        <span className="material-symbols-outlined text-[14px]">{activeHelp === fieldId ? 'close' : 'help'}</span>
      </button>
      {activeHelp === fieldId && (
        <div className="absolute z-50 left-6 right-6 mt-14 p-3 bg-slate-900 text-white text-[10px] font-bold rounded-xl shadow-2xl border border-white/10 animate-in fade-in zoom-in duration-200">
          <p className="leading-relaxed">{helpContent[fieldId]}</p>
        </div>
      )}
    </div>
  );

  if (loading) return <div className="min-h-screen bg-background-dark flex items-center justify-center"><span className="material-symbols-outlined animate-spin text-primary text-4xl">sync</span></div>;

  if (saveSummary) return (
    <div className="relative flex flex-col h-screen w-full max-w-md mx-auto bg-background-light dark:bg-background-dark shadow-2xl overflow-hidden pb-32 font-display">
      <header className="flex flex-col items-center p-8 bg-emerald-500/10 border-b border-emerald-500/20 pt-16">
        <div className="size-16 rounded-full bg-emerald-500 text-white flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/20">
          <span className="material-symbols-outlined text-4xl">check_circle</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white text-center">¡Producto Actualizado!</h1>
        <p className="text-sm font-bold text-slate-500 mt-1 uppercase tracking-widest text-center">Los cambios se han guardado con éxito</p>
      </header>

      <main className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
        <div className="bg-white dark:bg-surface-dark rounded-[2.5rem] p-6 border border-slate-100 dark:border-white/5 space-y-4 shadow-sm">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Producto</p>
            <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase leading-tight">{saveSummary.Producto} {saveSummary.Presentación}</h2>
            <p className="text-[10px] font-bold text-primary mt-1 uppercase tracking-widest">{saveSummary.Categoría} • {saveSummary.Proveedor}</p>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100 dark:border-white/5">
            <div className="space-y-4">
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase">Costo Base (Caja)</p>
                <p className="text-lg font-black text-slate-900 dark:text-white">{saveSummary.CostoCaja}</p>
              </div>
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase">Costo por Unidad</p>
                <p className="text-sm font-black text-slate-700 dark:text-slate-300">{saveSummary.CostoUnidad}</p>
              </div>
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase">Margen Deseado</p>
                <p className="text-sm font-black text-emerald-500">{saveSummary.Utilidad}</p>
              </div>
            </div>
            <div className="space-y-4 text-right">
              <div className="p-3 bg-primary/5 rounded-2xl border border-primary/10">
                <p className="text-[9px] font-black text-primary uppercase">Precio Sugerido</p>
                <p className="text-xl font-black text-primary">{saveSummary.PrecioRedondeado}</p>
                <p className="text-[9px] font-bold text-slate-400 mt-0.5">(Raw: {saveSummary.PrecioSugerido})</p>
              </div>
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase">Margen de Venta</p>
                <p className="text-sm font-black text-emerald-500">+{saveSummary.Margen}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3 pt-4">
          <button onClick={() => navigate(-1)} className="w-full py-5 bg-primary text-white font-black rounded-3xl shadow-xl shadow-primary/20 flex items-center justify-center gap-3 active:scale-95 transition-all">
            <span className="material-symbols-outlined">arrow_back</span> Volver al Catálogo
          </button>
          <button onClick={() => setSaveSummary(null)} className="w-full py-4 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 font-bold rounded-2xl active:scale-95 transition-all text-sm">
            Editar nuevamente
          </button>
        </div>
      </main>

      <BottomNav />
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-background-dark flex flex-col items-center justify-center p-6 text-center">
      <span className="material-symbols-outlined text-6xl text-red-500 mb-4">error</span>
      <h2 className="text-xl font-black text-white">{error}</h2>
      <button onClick={() => navigate(-1)} className="mt-6 px-10 py-4 bg-primary text-white font-black rounded-2xl">Volver</button>
    </div>
  );

  return (
    <div className="relative flex flex-col h-screen w-full max-w-md mx-auto bg-background-light dark:bg-background-dark shadow-2xl overflow-hidden pb-32 font-display">
      <header className="flex items-center justify-between p-4 pb-2 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md shrink-0 z-30 pt-12">
        <button onClick={() => navigate(-1)} className="flex items-center justify-center size-10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-slate-900 dark:text-white">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-lg font-bold flex-1 text-center pr-10">Editar Producto</h1>
      </header>

      <main className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar" onClick={() => activeHelp && setActiveHelp(null)}>
        <div className="bg-surface-dark p-6 rounded-[2rem] border border-white/5 space-y-1 shadow-sm">
           <p className="text-[10px] font-black text-primary uppercase tracking-widest">Vista Previa</p>
           <h2 className="text-xl font-black text-white uppercase leading-tight">{Nombre_Completo || 'Escribe un nombre...'}</h2>
           <p className="text-[11px] font-bold text-slate-500">Key: {productKey}</p>
        </div>

        <div className="space-y-5">
           <div className="flex flex-col relative">
             <LabelWithHelp label="Producto" fieldId="producto" />
             <input 
               value={formData.Producto}
               onChange={e => setFormData({...formData, Producto: e.target.value})}
               className="w-full rounded-2xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/5 p-4.5 font-bold outline-none focus:ring-2 focus:ring-primary shadow-sm dark:text-white"
               placeholder="Nombre del producto"
             />
           </div>

           <div className="flex flex-col relative">
             <LabelWithHelp label="Presentación" fieldId="presentacion" />
             <input 
               value={formData.Presentación}
               onChange={e => setFormData({...formData, Presentación: e.target.value})}
               className="w-full rounded-2xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/5 p-4.5 font-bold outline-none focus:ring-2 focus:ring-primary shadow-sm dark:text-white"
               placeholder="Ej: 1 Litro, 45g..."
             />
           </div>

            <div className="flex flex-col relative">
              <LabelWithHelp label="Categoría *" fieldId="categoria" />
              <div className="relative">
                <select 
                  value={formData.Categoría}
                  onChange={e => setFormData({...formData, Categoría: e.target.value})}
                  className="w-full rounded-2xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/5 p-4.5 font-bold outline-none focus:ring-2 focus:ring-primary shadow-sm dark:text-white appearance-none"
                >
                  <option value="">Seleccionar...</option>
                  {availableCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
                <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
              </div>
            </div>

            <div className="flex flex-col relative">
              <LabelWithHelp label="Proveedor Principal *" fieldId="proveedor" />
              <div className="relative">
                <select 
                  value={formData.Proveedor_principal}
                  onChange={e => setFormData({...formData, Proveedor_principal: e.target.value})}
                  className="w-full rounded-2xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/5 p-4.5 font-bold outline-none focus:ring-2 focus:ring-primary shadow-sm dark:text-white appearance-none"
                >
                  <option value="">Seleccionar...</option>
                  {availableProviders.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col relative">
                <LabelWithHelp label="Uni por Caja *" fieldId="unidades" />
                <input 
                  type="number"
                  value={formData.Uni_por_caja}
                  onChange={e => setFormData({...formData, Uni_por_caja: e.target.value})}
                  className="w-full rounded-2xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/5 p-4.5 font-bold outline-none focus:ring-2 focus:ring-primary shadow-sm dark:text-white"
                />
              </div>
              <div className="flex flex-col relative">
                <LabelWithHelp label="Utilidad (Ej: 0.20) *" fieldId="utilidad" />
                <input 
                  type="number"
                  step="0.01"
                  value={formData.Utilidad}
                  onChange={e => setFormData({...formData, Utilidad: parseFloat(e.target.value) || 0})}
                  className="w-full rounded-2xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/5 p-4.5 font-bold outline-none focus:ring-2 focus:ring-primary shadow-sm dark:text-white"
                />
              </div>
            </div>

            <div className="flex flex-col relative">
              <LabelWithHelp label="Costo Base (Caja) *" fieldId="costo" />
              <input 
                value={formData.Costo_base}
                onChange={e => setFormData({...formData, Costo_base: e.target.value})}
                onBlur={handleCostoBlur}
                className="w-full rounded-2xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/5 p-4.5 font-bold outline-none focus:ring-2 focus:ring-primary shadow-sm dark:text-white"
                placeholder="$0.00"
              />
            </div>
        </div>

        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="w-full py-5 bg-primary text-white font-black rounded-3xl shadow-xl shadow-primary/20 flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50 mt-8 mb-10"
        >
          {isSaving ? <span className="material-symbols-outlined animate-spin">sync</span> : <span className="material-symbols-outlined">save</span>}
          {isSaving ? 'Guardando...' : 'Guardar Cambios'}
        </button>
      </main>

      <BottomNav />
    </div>
  );
};

export default EditProductScreen;
