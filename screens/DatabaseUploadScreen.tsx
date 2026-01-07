
import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import { db } from '../services/firebase';
import { collection, writeBatch, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

type UploadContext = 'products' | 'providers' | 'costs';

const DatabaseUploadScreen: React.FC = () => {
  const navigate = useNavigate();
  
  const productsInputRef = useRef<HTMLInputElement>(null);
  const providersInputRef = useRef<HTMLInputElement>(null);
  const costsInputRef = useRef<HTMLInputElement>(null);
  
  const [activeSubTab, setActiveSubTab] = useState<'upload' | 'apk'>('upload');
  
  const [parsedProducts, setParsedProducts] = useState<any[]>([]);
  const [parsedProviders, setParsedProviders] = useState<any[]>([]);
  const [parsedCosts, setParsedCosts] = useState<any[]>([]);

  const [isUploading, setIsUploading] = useState<UploadContext | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [status, setStatus] = useState<{ text: string, type: 'success' | 'error' | 'info', context: UploadContext | 'all' } | null>(null);

  const sanitizeId = (id: any): string => {
    if (id === undefined || id === null || id === '') return Math.random().toString(36).substr(2, 9);
    return id.toString()
      .replace(/\//g, '-') 
      .replace(/[#.$\[\]]/g, '') 
      .trim() || Math.random().toString(36).substr(2, 9);
  };

  const getDocId = (item: any): string => {
    // Prioridad absoluta a "Product Key" como identificador del documento
    const priorityKeys = ['product key', 'productkey', 'clave producto', 'id', 'identificador'];
    const itemKeys = Object.keys(item);
    
    const foundKey = itemKeys.find(k => 
      priorityKeys.includes(k.toLowerCase().trim())
    );
    
    if (foundKey && item[foundKey]) {
      return sanitizeId(item[foundKey]);
    }
    
    // Fallback al primer campo si no se encuentra el Key específico
    return sanitizeId(item[itemKeys[0]]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, context: UploadContext) => {
    const file = e.target.files?.[0];
    if (file && (file.type === "text/csv" || file.name.endsWith('.csv'))) {
      processCSV(file, context);
    } else {
      setStatus({ text: "Error: El archivo debe ser un CSV válido.", type: "error", context });
    }
  };

  const processCSV = (file: File, context: UploadContext) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
      if (lines.length < 2) {
        setStatus({ text: "El archivo no contiene datos o encabezados.", type: 'error', context });
        return;
      }

      // Obtener encabezados dinámicos (primera fila)
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      const dataLines = lines.slice(1);

      try {
        const result = dataLines.map(line => {
          const values = line.split(',').map(val => val.trim().replace(/^"|"$/g, ''));
          const entry: any = {};
          
          headers.forEach((header, index) => {
            let val: any = values[index] || "";
            // Conversión automática de números
            if (val !== "" && !isNaN(val as any)) {
              val = val.includes('.') ? parseFloat(val) : parseInt(val);
            }
            entry[header] = val;
          });
          
          return entry;
        });

        if (context === 'products') setParsedProducts(result);
        else if (context === 'providers') setParsedProviders(result);
        else if (context === 'costs') setParsedCosts(result);

        setStatus({ text: `CSV Procesado: ${result.length} filas listas.`, type: 'info', context });
      } catch (err) {
        setStatus({ text: "Error procesando columnas dinámicas.", type: 'error', context });
      }
    };
    reader.readAsText(file);
  };

  const syncWithFirestore = async (context: UploadContext) => {
    let dataToUpload: any[] = [];
    let collectionName = "";

    if (context === 'products') { dataToUpload = parsedProducts; collectionName = "products"; }
    else if (context === 'providers') { dataToUpload = parsedProviders; collectionName = "providers"; }
    else if (context === 'costs') { dataToUpload = parsedCosts; collectionName = "costs_catalog"; }

    if (dataToUpload.length === 0) return;

    setIsUploading(context);
    setUploadProgress(0);
    const batchSize = 450; 

    try {
      const colRef = collection(db, collectionName);
      
      for (let i = 0; i < dataToUpload.length; i += batchSize) {
        const batch = writeBatch(db);
        const chunk = dataToUpload.slice(i, i + batchSize);
        
        chunk.forEach(item => {
          const docId = getDocId(item);
          const docRef = doc(colRef, docId);
          // Se sube el objeto completo con todos sus campos dinámicos
          batch.set(docRef, { 
            ...item, 
            _importDate: serverTimestamp() 
          });
        });

        await batch.commit();
        setUploadProgress(Math.round(((i + chunk.length) / dataToUpload.length) * 100));
      }

      setStatus({ text: `Importación exitosa en "${collectionName}"`, type: 'success', context });
      if (context === 'products') setParsedProducts([]);
      if (context === 'providers') setParsedProviders([]);
      if (context === 'costs') setParsedCosts([]);
      
    } catch (err: any) {
      setStatus({ text: `Error en Firestore: ${err.message}`, type: 'error', context });
    } finally {
      setIsUploading(null);
    }
  };

  const CategoryCard = ({ title, icon, context, count, inputRef, onUpload }: { 
    title: string, icon: string, context: UploadContext, count: number, inputRef: React.RefObject<HTMLInputElement>, onUpload: () => void 
  }) => (
    <div className="bg-white dark:bg-surface-dark rounded-[2.5rem] p-6 shadow-sm border border-slate-100 dark:border-white/5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">{icon}</span>
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">{title}</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ID: Product Key</p>
          </div>
        </div>
        {count > 0 && (
          <div className="px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-full text-[10px] font-black animate-pulse">
            {count} PENDIENTES
          </div>
        )}
      </div>

      {isUploading === context && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-[9px] font-black uppercase text-primary">
            <span>Subiendo datos...</span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="w-full h-2 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-primary transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
          </div>
        </div>
      )}

      {status?.context === context && (
        <div className={`text-[10px] font-bold px-3 py-2.5 rounded-2xl flex items-center gap-2 ${
          status.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 
          status.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
        }`}>
          <span className="material-symbols-outlined text-sm">
            {status.type === 'success' ? 'check_circle' : status.type === 'error' ? 'error' : 'info'}
          </span>
          {status.text}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <button 
          onClick={() => inputRef.current?.click()}
          className="py-3.5 bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-400 font-black text-[10px] rounded-xl uppercase tracking-widest border border-slate-100 dark:border-white/5 active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-sm">attach_file</span>
          Cargar CSV
        </button>
        <button 
          disabled={count === 0 || isUploading !== null}
          onClick={onUpload}
          className="py-3.5 bg-primary text-white font-black text-[10px] rounded-xl uppercase tracking-widest shadow-lg shadow-primary/20 active:scale-95 transition-all disabled:opacity-30 flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-sm">publish</span>
          Importar
        </button>
      </div>
      <input type="file" ref={inputRef} onChange={(e) => handleFileChange(e, context)} accept=".csv" className="hidden" />
    </div>
  );

  return (
    <div className="relative flex flex-col h-screen w-full max-w-md mx-auto bg-background-light dark:bg-background-dark shadow-2xl overflow-hidden pb-32 font-display">
      <header className="flex items-center justify-between p-4 pb-2 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md shrink-0 z-30 pt-12">
        <button onClick={() => navigate('/settings')} className="flex items-center justify-center size-10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-slate-900 dark:text-white">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-lg font-bold flex-1 text-center pr-10">Mantenimiento BDD</h1>
      </header>

      <div className="flex px-6 pt-2 gap-4">
        <button onClick={() => setActiveSubTab('upload')} className={`pb-2 text-xs font-black uppercase tracking-widest border-b-2 transition-colors ${activeSubTab === 'upload' ? 'border-primary text-primary' : 'border-transparent text-slate-400'}`}>Cargas CSV</button>
        <button onClick={() => setActiveSubTab('apk')} className={`pb-2 text-xs font-black uppercase tracking-widest border-b-2 transition-colors ${activeSubTab === 'apk' ? 'border-primary text-primary' : 'border-transparent text-slate-400'}`}>Instalación</button>
      </div>

      <main className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar pb-10">
        {activeSubTab === 'upload' ? (
          <>
            <div className="bg-gradient-to-br from-primary to-indigo-600 p-8 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden mb-2">
              <div className="relative z-10">
                <h2 className="text-2xl font-black">Importación Dinámica</h2>
                <p className="text-white/70 text-[10px] font-bold uppercase tracking-[0.2em] mt-1">Firestore Document Integration</p>
              </div>
              <span className="material-symbols-outlined absolute -right-4 -bottom-4 text-9xl opacity-10">storage</span>
            </div>

            <CategoryCard 
              title="Base de Productos" 
              icon="inventory_2" 
              context="products" 
              count={parsedProducts.length} 
              inputRef={productsInputRef} 
              onUpload={() => syncWithFirestore('products')} 
            />

            <CategoryCard 
              title="Base de Proveedores" 
              icon="local_shipping" 
              context="providers" 
              count={parsedProviders.length} 
              inputRef={providersInputRef} 
              onUpload={() => syncWithFirestore('providers')} 
            />

            <CategoryCard 
              title="Base de Precios / Costos" 
              icon="payments" 
              context="costs" 
              count={parsedCosts.length} 
              inputRef={costsInputRef} 
              onUpload={() => syncWithFirestore('costs')} 
            />

            <div className="p-5 bg-blue-500/5 border border-blue-500/10 rounded-3xl space-y-3">
               <div className="flex items-center gap-2 text-blue-500">
                 <span className="material-symbols-outlined text-lg">info</span>
                 <h4 className="text-[10px] font-black uppercase tracking-widest">Manual de Importación</h4>
               </div>
               <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 leading-relaxed uppercase">
                 1. Asegúrate de que el CSV tenga una columna llamada <span className="text-primary font-black">"Product Key"</span> para identificar cada registro.<br/>
                 2. Todos los campos de las columnas restantes se crearán automáticamente en la base de datos.<br/>
                 3. La subida es por lotes para optimizar el rendimiento de Firebase.
               </p>
            </div>
          </>
        ) : (
          <div className="space-y-6 animate-in fade-in">
             <div className="bg-amber-500/10 border border-amber-500/20 p-6 rounded-3xl">
              <div className="flex items-center gap-3 mb-4 text-amber-500">
                <span className="material-symbols-outlined text-4xl">smartphone</span>
                <h3 className="text-lg font-black leading-tight">Acceso Local APK</h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4 font-bold">
                Para instalar esta herramienta como una aplicación independiente en tu dispositivo Android:
              </p>
              <div className="space-y-4">
                <div className="p-4 bg-black/5 rounded-2xl border border-black/5">
                  <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Paso 1: Compilación</p>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Utilice el comando <span className="text-primary font-bold">npx cap add android</span> para generar el proyecto nativo.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default DatabaseUploadScreen;
