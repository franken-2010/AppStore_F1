
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import { db } from '../services/firebase';
import { useNotifications } from '../context/NotificationContext';
import { 
  doc, 
  getDoc, 
  updateDoc, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const EditProductScreen: React.FC = () => {
  const { productKey } = useParams();
  const navigate = useNavigate();
  const { addNotification } = useNotifications();
  
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeHelp, setActiveHelp] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    Producto: '',
    Presentación: '',
    Categoría: '',
    Proveedor_principal: '',
    Uni_por_caja: 1
  });

  const helpContent: Record<string, string> = {
    producto: "Nombre base del artículo sin la presentación (ej. Coca-Cola, Aceite Nutrioli).",
    presentacion: "Contenido o tamaño del producto (ej. 600ml, 1Kg, Pack 6 piezas).",
    categoria: "Agrupación para reportes de ventas y organización (ej. Bebidas, Botanas, Abarrotes).",
    proveedor: "Compañía que suministra este artículo mayoritariamente.",
    unidades: "Cantidad de piezas individuales que vienen en una caja cerrada de proveedor."
  };

  useEffect(() => {
    if (!productKey) return;
    const fetchProduct = async () => {
      try {
        const docRef = doc(db, "products", productKey);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          setFormData({
            Producto: data.Producto || '',
            Presentación: data.Presentación || '',
            Categoría: data.Categoría || '',
            Proveedor_principal: data.Proveedor_principal || '',
            Uni_por_caja: Number(data.Uni_por_caja) || 1
          });
        } else {
          setError("Producto no encontrado en colección productos");
        }
      } catch (err) {
        console.error(err);
        setError("Error al cargar datos.");
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [productKey]);

  const Nombre_Completo = useMemo(() => {
    return `${formData.Producto.trim()} ${formData.Presentación.trim()}`.trim();
  }, [formData.Producto, formData.Presentación]);

  const normalizeText = (text: string): string => {
    if (!text) return "";
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Quita diacríticos
      .replace(/ñ/g, "n")
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const handleSave = async () => {
    if (!productKey) return;
    if (!formData.Producto.trim() || !formData.Presentación.trim()) {
      alert("Producto y Presentación son obligatorios.");
      return;
    }
    if (formData.Uni_por_caja <= 0) {
      alert("Uni_por_caja debe ser mayor a 0.");
      return;
    }

    setIsSaving(true);
    const normName = normalizeText(Nombre_Completo);

    try {
      // Escritura 1: productos
      const prodRef = doc(db, "products", productKey);
      await updateDoc(prodRef, {
        ...formData,
        Nombre_Completo,
        Nombre_Completo_norm: normName,
        updatedAt: serverTimestamp()
      });

      // Escritura 2: costs_catalog (Sincronización de nombre)
      const costRef = doc(db, "costs_catalog", productKey);
      await updateDoc(costRef, {
        Nombre_Completo,
        Nombre_Completo_norm: normName,
        updatedAt: serverTimestamp()
      }).catch(e => console.warn("Catálogo de costos no actualizado:", e));

      addNotification({ 
        title: 'Producto actualizado', 
        message: `Se ha actualizado: ${Nombre_Completo}`, 
        type: 'system' 
      });

      navigate(-1);
    } catch (err: any) {
      console.error(err);
      alert("Error al guardar: " + err.message);
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
             <LabelWithHelp label="Categoría" fieldId="categoria" />
             <input 
               value={formData.Categoría}
               onChange={e => setFormData({...formData, Categoría: e.target.value})}
               className="w-full rounded-2xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/5 p-4.5 font-bold outline-none focus:ring-2 focus:ring-primary shadow-sm dark:text-white"
               placeholder="Bebidas, Botanas..."
             />
           </div>

           <div className="flex flex-col relative">
             <LabelWithHelp label="Proveedor Principal" fieldId="proveedor" />
             <input 
               value={formData.Proveedor_principal}
               onChange={e => setFormData({...formData, Proveedor_principal: e.target.value})}
               className="w-full rounded-2xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/5 p-4.5 font-bold outline-none focus:ring-2 focus:ring-primary shadow-sm dark:text-white"
               placeholder="Nombre del proveedor"
             />
           </div>

           <div className="flex flex-col relative">
             <LabelWithHelp label="Uni por Caja" fieldId="unidades" />
             <input 
               type="number"
               value={formData.Uni_por_caja}
               onChange={e => setFormData({...formData, Uni_por_caja: Number(e.target.value)})}
               className="w-full rounded-2xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/5 p-4.5 font-bold outline-none focus:ring-2 focus:ring-primary shadow-sm dark:text-white"
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
