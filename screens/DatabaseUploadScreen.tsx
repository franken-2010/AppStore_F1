
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { 
  collection, 
  writeBatch, 
  doc, 
  getDocs,
  serverTimestamp,
  addDoc,
  query,
  orderBy,
  where,
  collectionGroup,
  updateDoc,
  limit,
  setDoc,
  getDoc,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

type UploadContext = 'products' | 'providers' | 'costs';

const DatabaseUploadScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  
  const productsInputRef = useRef<HTMLInputElement>(null);
  const providersInputRef = useRef<HTMLInputElement>(null);
  const costsInputRef = useRef<HTMLInputElement>(null);
  
  const [activeSubTab, setActiveSubTab] = useState<'upload' | 'accounting' | 'apk' | 'diag'>('upload');
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [status, setStatus] = useState<{ text: string, type: 'success' | 'error' | 'info' | 'warning' } | null>(null);

  const [parsedProducts, setParsedProducts] = useState<any[]>([]);
  const [parsedProviders, setParsedProviders] = useState<any[]>([]);
  const [parsedCosts, setParsedCosts] = useState<any[]>([]);

  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [diagResults, setDiagResults] = useState<{ id: string, name: string, status: 'ok' | 'fail' | 'warn', docId?: string }[]>([]);

  // Operation States
  const [isReindexing, setIsReindexing] = useState(false);
  const [isNormalizing, setIsNormalizing] = useState(false);
  const [opStats, setOpStats] = useState({ processed: 0, total: 0, updated: 0, skipped: 0, errors: 0 });
  const [reindexSummary, setReindexSummary] = useState<any>(null);
  const [lastJob, setLastJob] = useState<{ id: string, totalRead: number, finishedAtMillis: number | null } | null>(null);

  const REQUIRED_STABLE_IDS = ['ventas', 'fiesta', 'recargas', 'estancias', 'cxc'];

  useEffect(() => {
    if (activeSubTab === 'diag') runDiagnostic();
  }, [activeSubTab]);

  const normalizeText = (text: string): string => {
    if (!text) return "";
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[-_.,/\\()]/g, ' ')
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const tokenize = (text: string): string[] => {
    const tokens = text.split(' ').filter(t => t.length >= 2 || !isNaN(Number(t)));
    return Array.from(new Set(tokens)); // Únicos
  };

  const handleNormalizePrices = async () => {
    if (!user) return;
    setIsNormalizing(true);
    setOpStats({ processed: 0, total: 0, updated: 0, skipped: 0, errors: 0 });
    
    try {
      const snap = await getDocs(collection(db, "costs_catalog"));
      const docs = snap.docs;
      const totalDocs = docs.length;
      setOpStats(prev => ({ ...prev, total: totalDocs }));

      let updatedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;
      let processedCount = 0;
      let batch = writeBatch(db);
      let batchCount = 0;

      for (const d of docs) {
        try {
          const data = d.data();
          const rawPrice = data.Precio_sug_red;

          if (typeof rawPrice === 'string') {
            const clean = rawPrice.replace(/\$/g, '').replace(/,/g, '').trim();
            const numericPrice = Number(clean);

            if (Number.isFinite(numericPrice)) {
              batch.update(d.ref, {
                Precio_sug_red: numericPrice,
                Precio_sug_red_raw: rawPrice,
                priceNormalizedAt: serverTimestamp()
              });
              updatedCount++;
              batchCount++;

              if (batchCount >= 400) {
                await batch.commit();
                batch = writeBatch(db);
                batchCount = 0;
              }
            } else {
              skippedCount++;
            }
          } else {
            skippedCount++;
          }
        } catch (e) {
          console.error("Error normalizing doc:", d.id, e);
          errorCount++;
        }

        processedCount++;
        if (processedCount % 50 === 0 || processedCount === totalDocs) {
          setOpStats({ processed: processedCount, total: totalDocs, updated: updatedCount, skipped: skippedCount, errors: errorCount });
        }
      }

      if (batchCount > 0) await batch.commit();
      setStatus({ 
        text: `✅ Normalización completa: ${updatedCount} precios corregidos.`, 
        type: 'success' 
      });
    } catch (err: any) {
      console.error(err);
      setStatus({ text: `Error en normalización: ${err.message}`, type: 'error' });
    } finally {
      setIsNormalizing(false);
    }
  };

  const handleReindexCosts = async () => {
    if (!user) return;
    setIsReindexing(true);
    setOpStats({ processed: 0, total: 0, updated: 0, skipped: 0, errors: 0 });
    setReindexSummary(null);

    const jobId = `job_${Date.now()}`;
    const jobRef = doc(db, "admin_jobs", jobId);
    const startTime = Date.now();

    try {
      await setDoc(jobRef, {
        type: "reindex_costs_catalog",
        startedAt: serverTimestamp(),
        status: "RUNNING",
        uid: user.uid,
        totalRead: 0,
        updated: 0,
        skipped: 0,
        errors: 0
      });

      const snap = await getDocs(collection(db, "costs_catalog"));
      const docs = snap.docs;
      const totalDocs = docs.length;
      setOpStats(prev => ({ ...prev, total: totalDocs }));

      let updatedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;
      let processedCount = 0;
      let batch = writeBatch(db);
      let batchCount = 0;
      const sampleUpdatedKeys: string[] = [];

      for (const d of docs) {
        try {
          const data = d.data();
          const nombre = data.Nombre_Completo;

          if (!nombre) {
            skippedCount++;
          } else {
            const sName = normalizeText(nombre);
            const sTokens = tokenize(sName);

            const oldTokensStr = Array.isArray(data.searchTokens) ? data.searchTokens.sort().join('|') : '';
            const newTokensStr = sTokens.sort().join('|');
            
            const needsUpdate = 
              data.searchName !== sName || 
              oldTokensStr !== newTokensStr;

            if (needsUpdate) {
              batch.update(d.ref, { 
                searchName: sName, 
                searchTokens: sTokens,
                searchIndexedAt: serverTimestamp() 
              });
              updatedCount++;
              batchCount++;
              if (sampleUpdatedKeys.length < 10) sampleUpdatedKeys.push(d.id);

              if (batchCount >= 400) {
                await batch.commit();
                batch = writeBatch(db);
                batchCount = 0;
              }
            } else {
              skippedCount++;
            }
          }
        } catch (e) {
          console.error("Error processing doc:", d.id, e);
          errorCount++;
        }

        processedCount++;
        if (processedCount % 25 === 0 || processedCount === totalDocs) {
          setOpStats({ processed: processedCount, total: totalDocs, updated: updatedCount, skipped: skippedCount, errors: errorCount });
          await updateDoc(jobRef, {
            totalRead: processedCount,
            updated: updatedCount,
            skipped: skippedCount,
            errors: errorCount
          });
        }
      }

      if (batchCount > 0) await batch.commit();
      const durationMs = Date.now() - startTime;

      let postCheckHits = 0;
      if (sampleUpdatedKeys.length > 0) {
        const firstDoc = await getDoc(doc(db, "costs_catalog", sampleUpdatedKeys[0]));
        const tokens = firstDoc.data()?.searchTokens || [];
        if (tokens.length > 0) {
          const qCheck = query(collection(db, "costs_catalog"), where("searchTokens", "array-contains", tokens[0]), limit(5));
          const snapCheck = await getDocs(qCheck);
          postCheckHits = snapCheck.size;
        }
      }

      const finalSummary = {
        totalRead: processedCount,
        updated: updatedCount,
        skipped: skippedCount,
        errors: errorCount,
        durationMs,
        postCheckHits,
        sampleUpdatedKeys
      };

      await updateDoc(jobRef, {
        status: "DONE",
        finishedAt: serverTimestamp(),
        durationMs,
        ...finalSummary
      });

      setReindexSummary(finalSummary);
      fetchLastJob();
    } catch (err: any) {
      console.error(err);
      await updateDoc(jobRef, {
        status: "ERROR",
        finishedAt: serverTimestamp(),
        errorMessage: err.message
      });
      alert(`Error crítico: ${err.message}`);
    } finally {
      setIsReindexing(false);
    }
  };

  /**
   * FIX: Simplificación de la consulta para evitar el error de falta de índice compuesto.
   * Filtramos por 'type' en memoria después de obtener los registros más recientes.
   */
  const fetchLastJob = async () => {
    if (!user) return;
    try {
      // Obtenemos los últimos 20 jobs globales para encontrar el de reindexación
      const q = query(
        collection(db, "admin_jobs"), 
        orderBy("startedAt", "desc"),
        limit(20)
      );
      
      const snap = await getDocs(q);
      if (!snap.empty) {
        // Filtrado en memoria
        const targetJobDoc = snap.docs.find(d => d.data().type === "reindex_costs_catalog");
        
        if (targetJobDoc) {
          const data = targetJobDoc.data();
          setLastJob({ 
            id: targetJobDoc.id, 
            totalRead: data.totalRead || 0, 
            finishedAtMillis: (data.finishedAt as Timestamp)?.toMillis() || null
          });
        }
      }
    } catch (e) {
      console.error("Error fetching last job:", e);
    }
  };

  useEffect(() => {
    if (user) fetchLastJob();
  }, [user]);

  const runDiagnostic = async () => {
    if (!user) return;
    setIsProcessing(true);
    try {
      const snap = await getDocs(collection(db, "users", user.uid, "accountIndex"));
      const indexMap = new Map();
      snap.docs.forEach(d => indexMap.set(d.id, d.data()));

      const results = REQUIRED_STABLE_IDS.map(id => {
        const data = indexMap.get(id);
        const exists = data && data.isActive === true;
        return {
          id,
          name: data?.name || id.toUpperCase(),
          status: exists ? 'ok' as const : 'fail' as const,
          docId: data?.accountDocId
        };
      });

      setDiagResults(results);
    } catch (e) {
      console.error(e);
      setStatus({ text: "Error al ejecutar diagnóstico.", type: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMigrateUIDs = async () => {
    if (!user) return;
    setIsProcessing(true);
    setStatus({ text: "Iniciando migración...", type: 'info' });
    
    try {
      const q = query(collectionGroup(db, "movements"));
      const snap = await getDocs(q);
      
      let batch = writeBatch(db);
      let opCount = 0;
      let totalFixed = 0;

      for (const mDoc of snap.docs) {
        const mData = mDoc.data();
        if (!mData.uid && mDoc.ref.path.includes(user.uid)) {
          batch.update(mDoc.ref, { uid: user.uid, updatedAt: serverTimestamp() });
          opCount++;
          totalFixed++;
          
          if (opCount >= 450) {
            await batch.commit();
            batch = writeBatch(db);
            opCount = 0;
          }
        }
      }

      if (opCount > 0) await batch.commit();
      setStatus({ text: `✅ Migración completada: ${totalFixed} actualizados.`, type: 'success' });
    } catch (err: any) {
      console.error(err);
      setStatus({ text: `Error: ${err.message}`, type: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResetMovements = async () => {
    if (!user || resetConfirmText !== 'RESET') return;
    setIsProcessing(true);
    setShowResetModal(false);
    setStatus({ text: "Reseteando...", type: 'info' });

    try {
      const q = query(collectionGroup(db, "movements"));
      const snapRaw = await getDocs(q);
      const snap = snapRaw.docs.filter(d => {
        const dUid = d.data().uid;
        return !dUid || dUid === user.uid;
      });
      
      let batch = writeBatch(db);
      let opCount = 0;

      const accountsSnap = await getDocs(collection(db, "users", user.uid, "accounts"));
      accountsSnap.docs.forEach(accountDoc => {
        const accData = accountDoc.data();
        batch.update(accountDoc.ref, { 
          balance: accData.initialBalance || 0, 
          updatedAt: serverTimestamp() 
        });
        opCount++;
      });

      for (const mDoc of snap) {
        batch.delete(mDoc.ref);
        opCount++;
        if (opCount >= 450) { 
          await batch.commit(); 
          batch = writeBatch(db); 
          opCount = 0; 
        }
      }

      if (opCount > 0) await batch.commit();
      setStatus({ text: "✅ Sistema reseteado.", type: 'success' });
    } catch (err: any) {
      console.error(err);
      setStatus({ text: `Error: ${err.message}`, type: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, context: UploadContext) => {
    const file = e.target.files?.[0];
    if (file && (file.type === "text/csv" || file.name.endsWith('.csv'))) {
      processCSV(file, context);
    }
  };

  const processCSV = (file: File, context: UploadContext) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
      if (lines.length < 2) return;
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      const dataLines = lines.slice(1);
      const result = dataLines.map(line => {
        const values = line.split(',').map(val => val.trim().replace(/^"|"$/g, ''));
        const entry: any = {};
        headers.forEach((header, index) => {
          let val: any = values[index] || "";
          if (val !== "" && !isNaN(val as any)) val = val.includes('.') ? parseFloat(val) : parseInt(val);
          entry[header] = val;
        });
        return entry;
      });
      if (context === 'products') setParsedProducts(result);
      else if (context === 'providers') setParsedProviders(result);
      else if (context === 'costs') setParsedCosts(result);
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
    
    setIsProcessing(true);
    setUploadProgress(0);
    const batchSize = 450; 
    
    try {
      const colRef = collection(db, collectionName);
      for (let i = 0; i < dataToUpload.length; i += batchSize) {
        const batch = writeBatch(db);
        const chunk = dataToUpload.slice(i, i + batchSize);
        chunk.forEach(item => {
          const docId = item.ProductKey ? item.ProductKey.toString() : Math.random().toString(36).substr(2, 9);
          const docRef = doc(colRef, docId);
          const sName = context === 'costs' ? normalizeText(item.Nombre_Completo || "") : null;
          const sTokens = sName ? tokenize(sName) : null;
          
          batch.set(docRef, { 
            ...item, 
            ...(sName ? { searchName: sName, searchTokens: sTokens } : {}),
            _importDate: serverTimestamp() 
          }, { merge: true });
        });
        await batch.commit();
        setUploadProgress(Math.round(((i + chunk.length) / dataToUpload.length) * 100));
      }
      setStatus({ text: `Importación exitosa.`, type: 'success' });
    } catch (err: any) {
      setStatus({ text: `Error: ${err.message}`, type: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  const CategoryCard = ({ title, icon, context, count, inputRef, onUpload }: { 
    title: string, icon: string, context: UploadContext, count: number, inputRef: React.RefObject<HTMLInputElement>, onUpload: () => void 
  }) => (
    <div className="bg-white dark:bg-surface-dark rounded-[2.5rem] p-6 shadow-sm border border-slate-100 dark:border-white/5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center"><span className="material-symbols-outlined text-2xl">{icon}</span></div>
          <div><h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">{title}</h3></div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => inputRef.current?.click()} className="py-3.5 bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-400 font-black text-[10px] rounded-xl uppercase tracking-widest border border-slate-100 dark:border-white/5 active:scale-95 transition-all flex items-center justify-center gap-2">CSV</button>
        <button disabled={count === 0 || isProcessing} onClick={onUpload} className="py-3.5 bg-primary text-white font-black text-[10px] rounded-xl uppercase tracking-widest shadow-lg shadow-primary/20 active:scale-95 transition-all disabled:opacity-30 flex items-center justify-center gap-2">Subir</button>
      </div>
      <input type="file" ref={inputRef} onChange={(e) => handleFileChange(e, context)} accept=".csv" className="hidden" />
    </div>
  );

  return (
    <div className="relative flex flex-col h-screen w-full max-w-md mx-auto bg-background-light dark:bg-background-dark shadow-2xl overflow-hidden pb-32 font-display text-slate-900 dark:text-white">
      {(isReindexing || isNormalizing) && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-xs bg-white dark:bg-surface-dark rounded-[2.5rem] p-8 shadow-2xl border border-slate-100 dark:border-white/10 animate-in zoom-in duration-300">
            <div className="flex flex-col items-center text-center">
              <span className="material-symbols-outlined text-5xl text-primary animate-spin mb-4">{isReindexing ? 'rebase_edit' : 'payments'}</span>
              <h3 className="text-xl font-black mb-2">{isReindexing ? 'Reindexando...' : 'Normalizando...'}</h3>
              <div className="w-full bg-slate-100 dark:bg-white/5 h-2.5 rounded-full overflow-hidden mb-6 shadow-inner">
                <div className="h-full bg-primary transition-all duration-300" style={{ width: `${(opStats.processed / (opStats.total || 1)) * 100}%` }}></div>
              </div>
              <div className="grid grid-cols-2 gap-4 w-full text-left">
                <div><p className="text-[8px] font-black text-slate-400 uppercase">Leídos</p><p className="text-lg font-black">{opStats.processed}/{opStats.total}</p></div>
                <div><p className="text-[8px] font-black text-slate-400 uppercase text-right">Editados</p><p className="text-lg font-black text-emerald-500 text-right">{opStats.updated}</p></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {reindexSummary && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white dark:bg-surface-dark rounded-[2.5rem] p-8 shadow-2xl border border-slate-100 dark:border-white/10 animate-in zoom-in duration-300">
            <h3 className="text-2xl font-black mb-1">Completado</h3>
            <div className="space-y-4 my-8">
               <div className="flex justify-between items-center pb-2 border-b border-slate-50 dark:border-white/5"><span className="text-xs font-bold text-slate-500">Procesados</span><span className="text-sm font-black">{reindexSummary.totalRead}</span></div>
               <div className="flex justify-between items-center pb-2 border-b border-slate-50 dark:border-white/5"><span className="text-xs font-bold text-slate-500">Actualizados</span><span className="text-sm font-black text-emerald-500">{reindexSummary.updated}</span></div>
               <div className="flex justify-between items-center pb-2 border-b border-slate-50 dark:border-white/5"><span className="text-xs font-bold text-slate-500">Hits post-check</span><span className="text-sm font-black text-blue-500">{reindexSummary.postCheckHits}</span></div>
            </div>
            <button onClick={() => setReindexSummary(null)} className="w-full py-4 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/20 active:scale-95">Cerrar</button>
          </div>
        </div>
      )}

      {showResetModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-xs bg-white dark:bg-surface-dark rounded-[2.5rem] p-8 shadow-2xl border border-slate-100 dark:border-white/10 animate-in zoom-in duration-300">
            <h3 className="text-lg font-black text-center mb-2">⚠️ Confirmar</h3>
            <input type="text" value={resetConfirmText} onChange={(e) => setResetConfirmText(e.target.value.toUpperCase())} className="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 py-3 px-4 rounded-xl text-center font-black text-primary outline-none" placeholder="Escribe RESET" />
            <div className="flex flex-col gap-3 mt-4">
              <button onClick={handleResetMovements} disabled={resetConfirmText !== 'RESET' || isProcessing} className="w-full py-4 bg-red-500 text-white font-black rounded-2xl">Confirmar</button>
              <button onClick={() => setShowResetModal(false)} className="w-full py-2 text-slate-400 font-bold text-[10px] uppercase">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      <header className="flex items-center justify-between p-4 pb-2 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md shrink-0 z-30 pt-12">
        <button onClick={() => navigate(-1)} className="flex items-center justify-center size-10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-slate-900 dark:text-white">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-lg font-bold flex-1 text-center pr-10">Base de Datos</h1>
      </header>

      <div className="flex px-6 pt-2 gap-4 overflow-x-auto no-scrollbar">
        <button onClick={() => setActiveSubTab('upload')} className={`pb-2 shrink-0 text-xs font-black uppercase tracking-widest border-b-2 ${activeSubTab === 'upload' ? 'border-primary text-primary' : 'border-transparent text-slate-400'}`}>Cargas CSV</button>
        <button onClick={() => setActiveSubTab('accounting')} className={`pb-2 shrink-0 text-xs font-black uppercase tracking-widest border-b-2 ${activeSubTab === 'accounting' ? 'border-primary text-primary' : 'border-transparent text-slate-400'}`}>Limpieza</button>
        <button onClick={() => setActiveSubTab('diag')} className={`pb-2 shrink-0 text-xs font-black uppercase tracking-widest border-b-2 ${activeSubTab === 'diag' ? 'border-primary text-primary' : 'border-transparent text-slate-400'}`}>Diagnóstico</button>
      </div>

      <main className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar pb-10">
        {status && (
          <div className={`p-4 rounded-2xl flex items-center gap-3 text-[11px] font-bold border ${status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
            <span className="material-symbols-outlined text-lg">{status.type === 'success' ? 'verified' : 'info'}</span>
            {status.text}
          </div>
        )}

        {activeSubTab === 'upload' && (
          <div className="space-y-6 animate-in fade-in">
            <CategoryCard title="Catálogo Productos" icon="inventory_2" context="products" count={parsedProducts.length} inputRef={productsInputRef} onUpload={() => syncWithFirestore('products')} />
            <CategoryCard title="Costos Proveedores" icon="local_shipping" context="providers" count={parsedProviders.length} inputRef={providersInputRef} onUpload={() => syncWithFirestore('providers')} />
            <CategoryCard title="Matriz de Precios" icon="payments" context="costs" count={parsedCosts.length} inputRef={costsInputRef} onUpload={() => syncWithFirestore('costs')} />
          </div>
        )}

        {activeSubTab === 'accounting' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="bg-white dark:bg-surface-dark p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-white/5 space-y-6">
              <button onClick={handleNormalizePrices} disabled={isNormalizing || isReindexing} className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-3 shadow-lg shadow-blue-600/20">
                <span className="material-symbols-outlined">payments</span>
                Normalizar Precios
              </button>
              <button onClick={handleReindexCosts} disabled={isReindexing || isNormalizing} className="w-full py-4 bg-emerald-600 text-white font-black rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-3 shadow-lg shadow-emerald-600/20">
                <span className="material-symbols-outlined">rebase_edit</span>
                Reindexar Catálogo
              </button>
              {lastJob && (
                 <p className="text-[8px] font-black text-center text-slate-400 uppercase">Último Index: {lastJob.totalRead} docs - {lastJob.finishedAtMillis ? new Date(lastJob.finishedAtMillis).toLocaleDateString() : '---'}</p>
              )}
              <div className="h-px bg-slate-100 dark:bg-white/5 w-full my-2"></div>
              <button onClick={handleMigrateUIDs} disabled={isProcessing} className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-3 shadow-lg shadow-indigo-600/20">
                <span className="material-symbols-outlined">person_add</span>
                Migrar UIDs
              </button>
              <button onClick={() => setShowResetModal(true)} disabled={isProcessing} className="w-full py-4 bg-red-500 text-white font-black rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-3 shadow-lg shadow-red-500/20">
                <span className="material-symbols-outlined">delete_sweep</span>
                Resetear Movimientos
              </button>
            </div>
          </div>
        )}

        {activeSubTab === 'diag' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="space-y-3">
              {diagResults.map(res => (
                <div key={res.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5">
                  <span className="text-sm font-bold text-slate-900 dark:text-white">{res.name}</span>
                  <span className={`px-3 py-1 rounded-lg text-[9px] font-black ${res.status === 'ok' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>{res.status}</span>
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

export default DatabaseUploadScreen;
