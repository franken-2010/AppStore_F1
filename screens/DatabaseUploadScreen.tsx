
import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import { db } from '../services/firebase';
import { collection, writeBatch, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { StoreProduct } from '../types';

const DatabaseUploadScreen: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [activeSubTab, setActiveSubTab] = useState<'upload' | 'apk'>('upload');
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
      const chunkSize = 400; 
      
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
      setUploadStatus({ text: "Error crítico al actualizar Firebase.", type: "error" });
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
        <h1 className="text-lg font-bold flex-1 text-center pr-10">Mantenimiento BDD</h1>
      </header>

      <div className="flex px-6 pt-2 gap-4">
        <button onClick={() => setActiveSubTab('upload')} className={`pb-2 text-xs font-black uppercase tracking-widest border-b-2 transition-colors ${activeSubTab === 'upload' ? 'border-primary text-primary' : 'border-transparent text-slate-400'}`}>Carga CSV</button>
        <button onClick={() => setActiveSubTab('apk')} className={`pb-2 text-xs font-black uppercase tracking-widest border-b-2 transition-colors ${activeSubTab === 'apk' ? 'border-primary text-primary' : 'border-transparent text-slate-400'}`}>Generar APK</button>
      </div>

      <main className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
        {activeSubTab === 'upload' ? (
          <>
            <div className="bg-primary/10 border border-primary/20 rounded-[2.5rem] p-8 text-center space-y-4">
              <div className="size-20 bg-primary text-white rounded-3xl flex items-center justify-center mx-auto shadow-xl">
                <span className="material-symbols-outlined text-4xl">database</span>
              </div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white">Actualización Total</h2>
            </div>

            {uploadStatus && (
              <div className={`p-5 rounded-2xl flex items-start gap-4 border ${
                uploadStatus.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 
                uploadStatus.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' :
                'bg-blue-50 border-blue-200 text-blue-700'
              }`}>
                <span className="material-symbols-outlined mt-0.5">
                  {uploadStatus.type === 'success' ? 'verified' : 'report'}
                </span>
                <p className="text-sm font-bold leading-tight">{uploadStatus.text}</p>
              </div>
            )}

            <div 
              onClick={() => !isUploading && fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-[2.5rem] p-12 flex flex-col items-center justify-center gap-6 cursor-pointer ${file ? 'border-primary bg-primary/5' : 'border-slate-300 dark:border-white/10'}`}
            >
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv" className="hidden" />
              <span className={`material-symbols-outlined text-7xl ${file ? 'text-primary' : 'text-slate-300'}`}>upload_file</span>
              <p className="font-black text-lg">{file ? file.name : 'Adjuntar CSV'}</p>
            </div>

            {isUploading && (
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-primary transition-all" style={{ width: `${uploadProgress}%` }}></div>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-6 animate-in fade-in">
            <div className="bg-amber-500/10 border border-amber-500/20 p-6 rounded-3xl">
              <div className="flex items-center gap-3 mb-4 text-amber-500">
                <span className="material-symbols-outlined text-4xl">terminal</span>
                <h3 className="text-lg font-black leading-tight">Guía Técnica para Compilar APK</h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
                Si necesitas un archivo <span className="text-primary font-bold">.apk</span> físico para instalar de manera local sin usar la web, debes compilar el código fuente con estas herramientas:
              </p>

              <div className="space-y-4">
                <div className="p-4 bg-black/5 rounded-2xl border border-black/5">
                  <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Opción 1: Bubblewrap (Más fácil)</p>
                  <p className="text-xs font-mono text-primary bg-primary/5 p-2 rounded">npx @bubblewrap/cli init --manifest=manifest.json</p>
                  <p className="text-[10px] text-slate-400 mt-2">Esto genera el APK directamente desde el manifiesto de la web.</p>
                </div>

                <div className="p-4 bg-black/5 rounded-2xl border border-black/5">
                  <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Opción 2: Capacitor (Nativo total)</p>
                  <p className="text-xs font-mono text-primary bg-primary/5 p-2 rounded">npm install @capacitor/android && npx cap add android</p>
                  <p className="text-[10px] text-slate-400 mt-2">Usa el archivo <span className="font-bold">capacitor.config.json</span> que ya incluimos en el proyecto.</p>
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-100 dark:bg-surface-dark rounded-3xl">
              <h4 className="text-sm font-black mb-2">¿Por qué no hay un botón de descarga APK?</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Un APK es un archivo compilado para Android. Las aplicaciones modernas se instalan vía <span className="font-bold">PWA</span> (Web App Progresiva) para no ocupar espacio y actualizarse solas. Al pulsar "Instalar" en el Login, el sistema registra la app en tu celular como si fuera un APK instalado localmente.
              </p>
            </div>
          </div>
        )}
      </main>

      {parsedData.length > 0 && !isUploading && activeSubTab === 'upload' && (
        <div className="fixed bottom-[88px] left-0 right-0 px-6 max-w-md mx-auto z-40">
          <button 
            onClick={handleUploadToFirebase}
            className="w-full bg-primary text-white font-black py-5 rounded-2xl shadow-2xl flex items-center justify-center gap-3"
          >
            <span className="material-symbols-outlined">publish</span>
            Actualizar {parsedData.length} Productos
          </button>
        </div>
      )}

      <BottomNav />
    </div>
  );
};

export default DatabaseUploadScreen;
