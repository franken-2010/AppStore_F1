
import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import { db } from '../services/firebase';
import { collection, writeBatch, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { StoreProduct } from '../types';

const DatabaseUploadScreen: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<StoreProduct[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ text: string, type: 'success' | 'error' | 'info' } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const cleanCurrency = (val: string) => {
    if (!val) return 0;
    return parseFloat(val.replace(/[$,]/g, '').trim()) || 0;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && (selectedFile.type === "text/csv" || selectedFile.name.endsWith('.csv'))) {
      setFile(selectedFile);
      processCSV(selectedFile);
    } else {
      setUploadStatus({ text: "Por favor selecciona un archivo CSV válido.", type: "error" });
    }
  };

  const processCSV = (file: File) => {
    setIsProcessing(true);
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n');
      const result: StoreProduct[] = [];
      const now = new Date().toISOString();

      // Formato esperado (9 columnas): 
      // ProductoID, Nombre_Completo, Costo_base_principal, Uni_por_caja, Costo_unidad, Utilidad_%, Precio_sugerido, Precio_sug_red, Margen_$
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const parts = line.split(',').map(p => p.trim());
        if (parts.length >= 9) {
          result.push({
            productoID: parseInt(parts[0]) || 0,
            nombreCompleto: parts[1],
            costoBasePrincipal: cleanCurrency(parts[2]),
            uniPorCaja: parseInt(parts[3]) || 0,
            costoUnidad: cleanCurrency(parts[4]),
            utilidadPorcentaje: parseFloat(parts[5].replace('%', '')) || 0,
            precioSugerido: cleanCurrency(parts[6]),
            precioSugRed: cleanCurrency(parts[7]),
            margenPesos: cleanCurrency(parts[8]),
            lastUpdated: now
          });
        }
      }
      
      setParsedData(result);
      setIsProcessing(false);
      if (result.length > 0) {
        setUploadStatus({ text: `Se han detectado ${result.length} productos listos para procesar.`, type: "info" });
      } else {
        setUploadStatus({ text: "El formato del CSV no es correcto. Se requieren las 9 columnas técnicas.", type: "error" });
      }
    };

    reader.readAsText(file);
  };

  const handleUploadToFirebase = async () => {
    if (parsedData.length === 0) return;
    
    setIsUploading(true);
    setUploadStatus({ text: "Sincronizando BDD con Firebase...", type: "info" });
    setUploadProgress(0);

    try {
      const productsRef = collection(db, "products");
      const total = parsedData.length;
      const chunkSize = 400; // Firestore limit is 500 per batch
      
      for (let i = 0; i < total; i += chunkSize) {
        const batch = writeBatch(db);
        const chunk = parsedData.slice(i, i + chunkSize);
        
        chunk.forEach((product) => {
          const docId = product.productoID.toString();
          const docRef = doc(productsRef, docId);
          batch.set(docRef, product);
        });

        await batch.commit();
        setUploadProgress(Math.min(100, Math.round(((i + chunk.length) / total) * 100)));
      }
      
      setUploadStatus({ text: `¡Sincronización masiva completada! ${total} productos actualizados.`, type: "success" });
      setParsedData([]);
      setFile(null);
    } catch (error) {
      console.error("Error uploading BDD:", error);
      setUploadStatus({ text: "Error crítico al actualizar Firebase. Verifique la conexión.", type: "error" });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="relative flex flex-col h-screen w-full max-w-md mx-auto bg-background-light dark:bg-background-dark shadow-2xl overflow-hidden pb-32 font-display">
      <header className="flex items-center justify-between p-4 pb-2 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md shrink-0 z-30 pt-12">
        <button onClick={() => navigate('/settings')} className="flex items-center justify-center size-10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-slate-900 dark:text-white">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-lg font-bold flex-1 text-center pr-10">Carga BDD Maestra</h1>
      </header>

      <main className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
        <div className="bg-primary/10 border border-primary/20 rounded-[2.5rem] p-8 text-center space-y-4">
          <div className="size-20 bg-primary text-white rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-primary/20 transform -rotate-3">
            <span className="material-symbols-outlined text-4xl">database</span>
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">Actualización Total</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              Sube el archivo CSV con las 9 columnas técnicas para actualizar todo el catálogo.
            </p>
          </div>
        </div>

        {uploadStatus && (
          <div className={`p-5 rounded-2xl flex items-start gap-4 border animate-in fade-in slide-in-from-top-2 ${
            uploadStatus.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 
            uploadStatus.type === 'error' ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-500/10 dark:text-red-400' :
            'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400'
          }`}>
            <span className="material-symbols-outlined shrink-0 mt-0.5">
              {uploadStatus.type === 'success' ? 'verified' : uploadStatus.type === 'error' ? 'report' : 'analytics'}
            </span>
            <div className="flex-1">
              <p className="text-xs font-black uppercase tracking-widest mb-1 opacity-70">{uploadStatus.type === 'info' ? 'Resumen de detección' : 'Estado'}</p>
              <p className="text-sm font-bold leading-tight">{uploadStatus.text}</p>
            </div>
          </div>
        )}

        <div 
          onClick={() => !isUploading && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-[2.5rem] p-12 flex flex-col items-center justify-center gap-6 cursor-pointer transition-all hover:border-primary group ${file ? 'border-primary bg-primary/5' : 'border-slate-300 dark:border-white/10 bg-white dark:bg-surface-dark'} ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept=".csv" 
            className="hidden" 
          />
          <div className="relative">
             <span className={`material-symbols-outlined text-7xl transition-transform group-hover:scale-110 ${file ? 'text-primary' : 'text-slate-300 dark:text-slate-700'}`}>
              {file ? 'cloud_done' : 'upload_file'}
            </span>
            {file && !isUploading && (
              <div className="absolute -top-1 -right-1 size-6 bg-emerald-500 rounded-full border-4 border-white dark:border-surface-dark shadow-sm"></div>
            )}
          </div>
          <div className="text-center">
            <p className="font-black text-lg text-slate-900 dark:text-white">{file ? file.name : 'Adjuntar Catálogo CSV'}</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-[0.2em] font-black mt-3">9 Columnas Requeridas</p>
          </div>
        </div>

        {isUploading && (
          <div className="space-y-3 animate-in fade-in zoom-in duration-300">
            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-primary">
              <span>Progreso de sincronización</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full h-3 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-300 ease-out"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
          </div>
        )}

        <div className="p-6 bg-white dark:bg-surface-dark border border-slate-100 dark:border-white/5 rounded-[2rem] space-y-4">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Formato de Columnas</h3>
          <ul className="grid grid-cols-1 gap-2 text-[11px] font-bold text-slate-600 dark:text-slate-400">
            <li className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-primary"></span>
              ProductoID, Nombre_Completo, Costo_base_principal...
            </li>
            <li className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-primary"></span>
              Uni_por_caja, Costo_unidad, Utilidad_%, Precio_sugerido...
            </li>
            <li className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-primary"></span>
              Precio_sug_red, Margen_$
            </li>
          </ul>
        </div>
      </main>

      {parsedData.length > 0 && !isUploading && (
        <div className="fixed bottom-[88px] left-0 right-0 px-6 max-w-md mx-auto z-40 animate-in slide-in-from-bottom-10">
          <button 
            onClick={handleUploadToFirebase}
            className="w-full bg-primary text-white font-black py-5 rounded-2xl shadow-2xl shadow-primary/20 flex items-center justify-center gap-3 transition-all active:scale-[0.97]"
          >
            <span className="material-symbols-outlined">publish</span>
            <span className="tracking-tight">Actualizar {parsedData.length} Productos</span>
          </button>
        </div>
      )}

      <BottomNav />
    </div>
  );
};

export default DatabaseUploadScreen;
