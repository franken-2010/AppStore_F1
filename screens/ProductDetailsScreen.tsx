
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import { db } from '../services/firebase';
import { 
  doc, 
  getDoc,
  writeBatch,
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const ProductDetailsScreen: React.FC = () => {
  const { productKey } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [productData, setProductData] = useState<any>(null);
  const [costData, setCostData] = useState<any>(null);

  // Edit Mode States
  const [editMode, setEditMode] = useState(false);
  const [localCostoBase, setLocalCostoBase] = useState<string>('');
  const [localUniCaja, setLocalUniCaja] = useState<number>(1);

  const fetchData = async () => {
    if (!productKey) return;
    setLoading(true);
    try {
      const [prodSnap, costSnap] = await Promise.all([
        getDoc(doc(db, "products", productKey)),
        getDoc(doc(db, "costs_catalog", productKey))
      ]);

      if (!prodSnap.exists() && !costSnap.exists()) {
        setError("El producto no existe en el sistema.");
      } else {
        const pData = prodSnap.data() || null;
        const cData = costSnap.data() || null;
        setProductData(pData);
        setCostData(cData);
        
        // Initialize edit states
        if (cData) setLocalCostoBase(parsePrice(cData.Costo_base_principal).toString());
        setLocalUniCaja(pData?.Uni_por_caja || cData?.Uni_por_caja || 1);
      }
    } catch (err) {
      console.error(err);
      setError("Error al conectar con la base de datos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [productKey]);

  const parsePrice = (price: any): number => {
    if (typeof price === 'number') return price;
    if (typeof price === 'string') {
      const clean = price.replace(/[$,\s]/g, '');
      return parseFloat(clean) || 0;
    }
    return 0;
  };

  const formatMXN = (val: number) => {
    return new Intl.NumberFormat('es-MX', { 
      style: 'currency', 
      currency: 'MXN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(val);
  };

  const metrics = useMemo(() => {
    if (!costData) return null;
    
    const sug = parsePrice(costData.Precio_sugerido);
    const unit = parsePrice(costData.Costo_unidad);
    const utilidadPerc = costData["Utilidad_%"] ?? 0.20;
    const utilPercDisplay = Math.round(utilidadPerc * 100);
    const utilPesos = sug - unit;
    const uniCaja = productData?.Uni_por_caja || costData?.Uni_por_caja || 1;
    const margenCaja = utilPesos * uniCaja;

    let rentabilityColor = 'bg-red-500';
    let rentabilityLabel = 'Baja';
    if (utilidadPerc >= 0.30) {
      rentabilityColor = 'bg-emerald-500';
      rentabilityLabel = 'Alta';
    } else if (utilidadPerc >= 0.15) {
      rentabilityColor = 'bg-amber-500';
      rentabilityLabel = 'Media';
    }

    return {
      sug,
      unit,
      utilPercDisplay,
      utilidadPerc,
      utilPesos,
      margenCaja,
      rentabilityColor,
      rentabilityLabel,
      uniCaja
    };
  }, [costData, productData]);

  const handleSave = async () => {
    if (!productKey || !costData) return;
    
    const newCostoBase = parseFloat(localCostoBase);
    const newUniCaja = Number(localUniCaja);

    if (isNaN(newCostoBase) || newCostoBase <= 0) {
      alert("Costo base inválido");
      return;
    }
    if (isNaN(newUniCaja) || newUniCaja < 1) {
      alert("Unidades por caja debe ser al menos 1");
      return;
    }

    setIsSaving(true);
    try {
      const batch = writeBatch(db);
      const prodRef = doc(db, "products", productKey);
      const costRef = doc(db, "costs_catalog", productKey);

      // Calculations
      const utilidadDecimal = costData["Utilidad_%"] ?? 0.20;
      const costoUnidad = newCostoBase / newUniCaja;
      const precioSugerido = costoUnidad * (1 + utilidadDecimal);
      const precioSugRed = Math.ceil(precioSugerido);
      const margenUnit = precioSugerido - costoUnidad;

      // Update collections/products
      batch.update(prodRef, {
        Uni_por_caja: newUniCaja,
        updatedAt: serverTimestamp()
      });

      // Update collections/costs_catalog
      batch.update(costRef, {
        Costo_base_principal: `$${newCostoBase.toFixed(2)}`,
        Costo_unidad: `$${costoUnidad.toFixed(2)}`,
        Precio_sugerido: `$${precioSugerido.toFixed(2)}`,
        Precio_sug_red: precioSugRed,
        Precio_sug_red_raw: `$${precioSugRed.toFixed(2)}`,
        "Margen_$": `$${margenUnit.toFixed(2)}`,
        Uni_por_caja: newUniCaja,
        updatedAt: serverTimestamp()
      });

      await batch.commit();
      setEditMode(false);
      await fetchData();
      alert("Producto actualizado y recalculado correctamente ✅");
    } catch (err: any) {
      console.error(err);
      alert("Error al guardar cambios: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-background-dark flex flex-col items-center justify-center gap-4">
      <span className="material-symbols-outlined animate-spin text-primary text-5xl">sync</span>
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 animate-pulse">Cargando expediente F1...</p>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-background-dark flex flex-col items-center justify-center p-8 text-center">
      <span className="material-symbols-outlined text-6xl text-red-500 mb-6">error</span>
      <h2 className="text-xl font-black text-white mb-2">{error}</h2>
      <p className="text-sm text-slate-400 mb-8">No pudimos encontrar los registros para: {productKey}</p>
      <button onClick={() => navigate('/tools/price-verification')} className="px-10 py-4 bg-primary text-white font-black rounded-2xl shadow-xl active:scale-95 transition-all">Volver al buscador</button>
    </div>
  );

  const mainName = productData?.Nombre_Completo || costData?.Nombre_Completo || "Producto sin nombre";

  return (
    <div className="relative flex flex-col h-screen w-full max-w-md mx-auto bg-[#0a1120] font-display antialiased overflow-hidden pb-32">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0a1120]/95 backdrop-blur-md pt-12 px-5 pb-4 shrink-0 flex items-center justify-between border-b border-white/5">
        <button onClick={() => navigate('/tools/price-verification')} className="p-2 -ml-2 text-white active:scale-90 transition-transform">
          <span className="material-symbols-outlined text-[28px]">arrow_back</span>
        </button>
        <h1 className="text-[14px] font-black tracking-widest text-white uppercase flex-1 text-center">
          Expediente de Producto
        </h1>
        <button 
          onClick={() => setEditMode(!editMode)}
          className={`p-2 -mr-2 transition-all active:scale-90 ${editMode ? 'text-primary' : 'text-slate-400'}`}
        >
          <span className="material-symbols-outlined text-[28px]">{editMode ? 'close' : 'edit'}</span>
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
        {/* Rentability Badge */}
        {metrics && (
          <div className="flex justify-center -mb-4">
             <div className={`${metrics.rentabilityColor} text-white px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg animate-in zoom-in duration-500`}>
               Rentabilidad {metrics.rentabilityLabel}
             </div>
          </div>
        )}

        {/* A) Identificación */}
        <section className="animate-in fade-in duration-500">
          <div className="bg-gradient-to-br from-indigo-900 to-[#1a2333] rounded-[2.5rem] p-7 shadow-2xl border border-white/10 relative overflow-hidden">
            <div className="relative z-10">
              <p className="text-[9px] font-black text-primary-light uppercase tracking-[0.3em] mb-2">Ficha Técnica</p>
              <h2 className="text-2xl font-black text-white uppercase leading-tight mb-4">{mainName}</h2>
              
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                <div>
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">ProductKey</p>
                  <p className="text-xs font-bold text-slate-300">{productKey}</p>
                </div>
                <div>
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Categoría</p>
                  <p className="text-xs font-bold text-slate-300">{productData?.Categoría || 'General'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Proveedor Principal</p>
                  <p className="text-xs font-bold text-primary-light uppercase">{productData?.Proveedor_principal || 'Sin definir'}</p>
                </div>
              </div>
            </div>
            <span className="material-symbols-outlined absolute -right-6 -bottom-6 text-[120px] opacity-5 rotate-12 pointer-events-none">inventory</span>
          </div>
        </section>

        {/* B) Precios y costos */}
        <section className="space-y-4 animate-in slide-in-from-bottom-4 duration-600">
          <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 px-1">Estrategia Comercial</h3>
          <div className="bg-[#1a2333] rounded-[2rem] p-6 shadow-xl border border-white/5 space-y-6">
            <div className="flex items-center justify-between p-4 bg-[#242d3d] rounded-2xl border border-white/5">
              <div className="space-y-1">
                <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Sugerido (Redondeado)</p>
                <p className="text-2xl font-black text-white">
                   {costData ? formatMXN(parsePrice(costData.Precio_sug_red)) : '---'}
                </p>
              </div>
              <div className="size-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                <span className="material-symbols-outlined text-2xl">payments</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-[#242d3d] rounded-2xl border border-white/5 space-y-2">
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Costo Base (Caja)</p>
                {editMode ? (
                  <input 
                    type="number" 
                    value={localCostoBase}
                    onChange={(e) => setLocalCostoBase(e.target.value)}
                    className="w-full bg-[#0a1120] border-none rounded-lg py-1 px-2 text-primary font-black outline-none focus:ring-1 focus:ring-primary text-sm"
                  />
                ) : (
                  <p className="text-sm font-bold text-slate-200">{costData ? formatMXN(parsePrice(costData.Costo_base_principal)) : '---'}</p>
                )}
              </div>
              <div className="p-4 bg-[#242d3d] rounded-2xl border border-white/5 space-y-2">
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Costo por Unidad</p>
                <p className="text-sm font-bold text-slate-200">{costData ? formatMXN(parsePrice(costData.Costo_unidad)) : '---'}</p>
              </div>
              <div className="p-4 bg-[#242d3d] rounded-2xl border border-white/5 space-y-1 col-span-2">
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Sugerido (Raw)</p>
                <p className="text-sm font-bold text-slate-200">{costData ? formatMXN(parsePrice(costData.Precio_sugerido)) : '---'}</p>
              </div>
            </div>
            {!costData && (
              <p className="text-[10px] font-bold text-amber-500 text-center uppercase tracking-widest italic animate-pulse">Sin datos de costos detallados</p>
            )}
          </div>
        </section>

        {/* C) Empaque y utilidad */}
        <section className="space-y-4 animate-in slide-in-from-bottom-6 duration-700">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-1">Empaque y Rentabilidad</h3>
          <div className="bg-[#1a2333] rounded-[2rem] p-6 shadow-xl border border-white/5 space-y-6">
            <div className="flex items-center gap-4 p-4">
              <div className="size-12 rounded-2xl bg-primary/10 text-primary-light flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl">package_2</span>
              </div>
              <div className="flex flex-col flex-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Unidades por Caja</p>
                {editMode ? (
                   <input 
                    type="number" 
                    value={localUniCaja}
                    onChange={(e) => setLocalUniCaja(parseInt(e.target.value) || 1)}
                    className="w-20 bg-[#0a1120] border-none rounded-lg py-1 px-2 text-primary font-black outline-none focus:ring-1 focus:ring-primary text-sm"
                  />
                ) : (
                  <p className="text-lg font-black text-white leading-none">{metrics?.uniCaja || '1'} pz</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Margen Caja</p>
                <p className="text-sm font-black text-white">{metrics ? formatMXN(metrics.margenCaja) : '---'}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#242d3d] rounded-3xl p-5 border border-white/5 space-y-1 text-center">
                <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Utilidad %</p>
                <p className="text-2xl font-black text-emerald-400">{metrics?.utilPercDisplay || '0'}%</p>
              </div>
              <div className="bg-[#242d3d] rounded-3xl p-5 border border-white/5 space-y-1 text-center">
                <p className="text-[9px] font-black text-primary-light uppercase tracking-widest">Margen Unidad</p>
                <p className="text-2xl font-black text-primary-light">
                  {metrics ? formatMXN(metrics.utilPesos) : '---'}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Buttons */}
        <div className="pt-10 flex flex-col gap-4 items-center pb-20">
           {editMode ? (
             <div className="w-full space-y-3">
                <button 
                  onClick={handleSave}
                  disabled={isSaving}
                  className="w-full py-5 bg-emerald-600 text-white font-black rounded-3xl shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3 text-sm"
                >
                  {isSaving ? <span className="material-symbols-outlined animate-spin">sync</span> : <span className="material-symbols-outlined">save</span>}
                  GUARDAR CAMBIOS
                </button>
                <button 
                  onClick={() => {
                    setEditMode(false);
                    // Revert values
                    if (costData) setLocalCostoBase(parsePrice(costData.Costo_base_principal).toString());
                    setLocalUniCaja(productData?.Uni_por_caja || costData?.Uni_por_caja || 1);
                  }}
                  className="w-full py-4 text-slate-500 font-black text-[11px] uppercase tracking-[0.3em] active:opacity-50 transition-opacity"
                >
                  Cancelar Edición
                </button>
             </div>
           ) : (
             <>
               <button 
                 onClick={() => setEditMode(true)}
                 disabled={!costData}
                 className="w-full py-5 bg-white text-slate-900 font-black rounded-3xl shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3 text-sm disabled:opacity-50"
               >
                 <span className="material-symbols-outlined font-black">edit</span>
                 EDITAR COSTO Y EMPAQUE
               </button>
               
               <button 
                 onClick={() => navigate('/tools/price-verification')}
                 className="text-slate-500 font-black text-[11px] uppercase tracking-[0.3em] active:opacity-50 transition-opacity"
               >
                 Volver a Resultados
               </button>
             </>
           )}
        </div>
      </main>

      <BottomNav />
    </div>
  );
};

export default ProductDetailsScreen;
