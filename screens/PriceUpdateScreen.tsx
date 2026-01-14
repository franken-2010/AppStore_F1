
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  getDoc,
  setDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

interface ProcessResult {
  name: string;
  status: 'BAJÓ' | 'SIN CAMBIOS' | 'SUBIÓ' | 'NO ENCONTRADO' | 'ERROR' | 'REVISAR';
  newSuggestedPrice?: number;
  utility?: number;
  error?: string;
  matchScore?: number;
  matchedName?: string;
  matchedProductKey?: string;
  oldPrice?: number;
}

interface PriceJob {
  id: string;
  createdAt: any;
  status: "DONE" | "ERROR";
  inputLines: number;
  totalUpdated: number;
  totalUnchanged: number;
  totalNotFound: number;
  totalAmbiguous: number;
  durationMs: number;
  itemsPreview: any[];
}

const PriceUpdateScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'update' | 'history'>('update');
  const [productList, setProductList] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [report, setReport] = useState<ProcessResult[] | null>(null);
  const [history, setHistory] = useState<PriceJob[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedJob, setSelectedJob] = useState<PriceJob | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ text: string, type: 'success' | 'error' | 'info' } | null>(null);

  // Cargar historial cuando se cambia a la pestaña de historial
  useEffect(() => {
    if (activeTab === 'history' && user) {
      fetchHistory();
    }
  }, [activeTab, user]);

  const fetchHistory = async () => {
    if (!user) return;
    setLoadingHistory(true);
    try {
      const q = query(
        collection(db, "users", user.uid, "price_update_jobs"),
        orderBy("createdAt", "desc"),
        limit(20)
      );
      const snap = await getDocs(q);
      const jobs = snap.docs.map(d => ({ id: d.id, ...d.data() } as PriceJob));
      setHistory(jobs);
    } catch (e) {
      console.error("Error fetching history:", e);
    } finally {
      setLoadingHistory(false);
    }
  };

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

  const roundTo2 = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;

  const calculateMatchScore = (query: string, target: string): number => {
    const qTokens = query.split(' ').filter(t => t.length > 1);
    const tTokens = target.split(' ').filter(t => t.length > 1);
    if (qTokens.length === 0) return 0;
    let matches = 0;
    qTokens.forEach(qt => { if (tTokens.includes(qt)) matches++; });
    const score = matches / qTokens.length;
    if (target.includes(query)) return Math.min(1, score + 0.2);
    return score;
  };

  const parseLine = (line: string) => {
    const parts = line.split(/[,|\t]/).map(p => p.trim());
    if (parts.length < 2) return null;
    const name = parts[0];
    const priceStr = parts[parts.length - 1].replace(/[$,]/g, '');
    const price = parseFloat(priceStr);
    if (!name || isNaN(price)) return null;
    return { name, price: roundTo2(price) };
  };

  const handleProcessUpdates = async () => {
    if (!productList.trim() || !user) {
      setStatusMessage({ text: 'Por favor, ingresa la lista de productos.', type: 'error' });
      return;
    }

    setIsProcessing(true);
    setStatusMessage({ text: 'Iniciando procesamiento con F1 Fuzzy Search...', type: 'info' });
    const startTime = Date.now();
    const lines = productList.split('\n').filter(l => l.trim() !== '');
    const results: ProcessResult[] = [];

    try {
      const providersSnap = await getDocs(collection(db, "providers"));
      const allProviders = providersSnap.docs.map(d => {
        const data = d.data();
        return { 
          id: d.id, 
          data, 
          normName: data.Nombre_Completo_norm || normalizeText(data.Nombre_Completo || '')
        };
      });

      for (const line of lines) {
        const parsed = parseLine(line);
        if (!parsed) {
          results.push({ name: line, status: 'NO ENCONTRADO', error: 'Formato inválido' });
          continue;
        }

        const { name: inputName, price: newPrice } = parsed;
        const queryNorm = normalizeText(inputName);

        let bestMatch: any = null;
        let bestScore = 0;
        let secondBestScore = 0;

        bestMatch = allProviders.find(p => p.normName === queryNorm);
        if (bestMatch) {
          bestScore = 1.0;
        } else {
          allProviders.forEach(p => {
            const score = calculateMatchScore(queryNorm, p.normName);
            if (score > bestScore) {
              secondBestScore = bestScore;
              bestScore = score;
              bestMatch = p;
            } else if (score > secondBestScore) {
              secondBestScore = score;
            }
          });
        }

        const MIN_SCORE = 0.70;
        const AMBIGUITY_GAP = 0.05;

        if (!bestMatch || bestScore < MIN_SCORE) {
          results.push({ name: inputName, status: 'NO ENCONTRADO', matchScore: bestScore });
          continue;
        }

        const isAmbiguous = (bestScore - secondBestScore) < AMBIGUITY_GAP && bestScore < 0.95;
        if (isAmbiguous) {
          results.push({ 
            name: inputName, 
            status: 'REVISAR', 
            matchedName: bestMatch.data.Nombre_Completo,
            matchScore: bestScore 
          });
          continue;
        }

        const providerDoc = bestMatch.data;
        const providerId = bestMatch.id;
        const currentCost = roundTo2(providerDoc.Costo_actual || 0);
        const productKey = providerDoc.ProductKey;
        
        let priceStatus: 'BAJÓ' | 'SIN CAMBIOS' | 'SUBIÓ' = 'SIN CAMBIOS';
        if (newPrice < currentCost) priceStatus = 'BAJÓ';
        else if (newPrice > currentCost) priceStatus = 'SUBIÓ';

        const updateData: any = {
          Costo_actual: newPrice,
          Fecha_ult_actualización: serverTimestamp()
        };
        if (!providerDoc.Nombre_Completo_norm) {
          updateData.Nombre_Completo_norm = bestMatch.normName;
        }

        if (priceStatus !== 'SIN CAMBIOS' || !providerDoc.Nombre_Completo_norm) {
          await updateDoc(doc(db, "providers", providerId), updateData);
        }

        let suggestedPrice = 0;
        let utility = 0;
        let errorMsg = '';

        if (productKey) {
          const costDocRef = doc(db, "costs_catalog", productKey.toString());
          const costSnap = await getDoc(costDocRef);
          if (costSnap.exists()) {
            const costData = costSnap.data();
            const uniPorCaja = costData.Uni_por_caja || 0;
            const utilidadDecimal = costData["Utilidad_%"] !== undefined ? costData["Utilidad_%"] : 0;
            utility = utilidadDecimal;
            if (uniPorCaja <= 0) {
              errorMsg = 'Uni_por_caja inválido';
            } else {
              const costoUnidad = roundTo2(newPrice / uniPorCaja);
              const precioSugeridoRaw = roundTo2(costoUnidad * (1 + utilidadDecimal));
              const precioSugeridoRed = roundTo2(Math.ceil(precioSugeridoRaw));
              const margen = roundTo2(precioSugeridoRaw - costoUnidad);
              suggestedPrice = precioSugeridoRed;
              await updateDoc(costDocRef, {
                Costo_base_principal: newPrice,
                Costo_unidad: costoUnidad,
                Precio_sugerido: precioSugeridoRaw,
                Precio_sug_red: precioSugeridoRed,
                Margen: margen,
                last_update: serverTimestamp()
              });
            }
          } else { errorMsg = 'No en costs_catalog'; }
        }

        results.push({
          name: inputName,
          matchedName: providerDoc.Nombre_Completo,
          matchedProductKey: productKey?.toString(),
          status: errorMsg ? 'ERROR' : priceStatus,
          newSuggestedPrice: suggestedPrice,
          utility: utility,
          error: errorMsg,
          matchScore: bestScore,
          oldPrice: currentCost
        });
      }

      // GUARDADO DE INFORME Y NOTIFICACIÓN
      const durationMs = Date.now() - startTime;
      const totalUpdated = results.filter(r => r.status === 'SUBIÓ' || r.status === 'BAJÓ').length;
      const totalUnchanged = results.filter(r => r.status === 'SIN CAMBIOS').length;
      const totalNotFound = results.filter(r => r.status === 'NO ENCONTRADO').length;
      const totalAmbiguous = results.filter(r => r.status === 'REVISAR').length;

      const batch = writeBatch(db);
      const jobId = `job_${Date.now()}`;
      const jobRef = doc(db, "users", user.uid, "price_update_jobs", jobId);
      
      const jobData = {
        uid: user.uid,
        createdAt: serverTimestamp(),
        status: "DONE",
        source: "price_update_fuzzy",
        inputRaw: productList,
        inputLines: lines.length,
        totalUpdated,
        totalUnchanged,
        totalNotFound,
        totalAmbiguous,
        durationMs,
        itemsPreview: results.slice(0, 200).map(r => ({
          lineRaw: r.name,
          matchStatus: r.status,
          matchedName: r.matchedName || null,
          matchedProductKey: r.matchedProductKey || null,
          oldPrice: r.oldPrice || null,
          newPrice: r.newSuggestedPrice || null,
          score: r.matchScore || null
        }))
      };
      batch.set(jobRef, jobData);

      const notifRef = doc(collection(db, "users", user.uid, "notifications"));
      batch.set(notifRef, {
        uid: user.uid,
        type: "PRICE_UPDATE_REPORT",
        title: "Informe de actualización creado",
        message: `Se sincronizaron ${totalUpdated} productos correctamente.`,
        refType: "price_update_job",
        refId: jobId,
        timestamp: new Date().toISOString(), // Match existing NotificationContext format
        isRead: false
      });

      await batch.commit();

      setReport(results);
      setProductList('');
      setStatusMessage({ text: 'Sincronización finalizada y reporte guardado.', type: 'success' });
    } catch (err: any) {
      console.error(err);
      setStatusMessage({ text: `Error: ${err.message}`, type: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);

  return (
    <div className="relative flex flex-col h-screen w-full max-w-md mx-auto bg-background-light dark:bg-background-dark shadow-2xl overflow-hidden pb-32 font-display text-slate-900 dark:text-white">
      <header className="sticky top-0 z-40 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md pt-12 px-4 pb-2 border-b border-slate-100 dark:border-white/5">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => navigate(-1)} className="flex items-center justify-center size-10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-slate-900 dark:text-white">
            <span className="material-symbols-outlined text-[24px]">arrow_back</span>
          </button>
          <h1 className="text-lg font-bold flex-1 text-center pr-10">Actualización Precios</h1>
        </div>
        
        <div className="flex p-1 bg-slate-100 dark:bg-surface-dark rounded-2xl">
          <button 
            onClick={() => setActiveTab('update')} 
            className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'update' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-500'}`}
          >
            Actualizar
          </button>
          <button 
            onClick={() => setActiveTab('history')} 
            className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'history' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-500'}`}
          >
            Historial
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-6 no-scrollbar pb-40">
        {activeTab === 'update' ? (
          <div className="animate-in fade-in duration-300 space-y-6">
            <div className="relative rounded-[2rem] overflow-hidden bg-surface-dark shadow-lg h-40 flex items-end">
              <div className="absolute inset-0 bg-cover bg-center opacity-40 mix-blend-overlay" style={{backgroundImage: "url('https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&q=80&w=800')"}}></div>
              <div className="relative p-6 bg-gradient-to-t from-surface-dark via-surface-dark/80 to-transparent w-full">
                <h2 className="text-lg font-black text-white leading-tight">Sincronización Automática</h2>
                <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest mt-1">Match Score Confidence: 70%</p>
              </div>
            </div>

            {statusMessage && (
              <div className={`p-4 rounded-2xl flex items-start gap-3 border animate-in slide-in-from-top-2 ${
                statusMessage.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400' : 
                statusMessage.type === 'info' ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20 text-blue-700 dark:text-blue-400' :
                'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400'
              }`}>
                <span className="material-symbols-outlined shrink-0 text-xl">
                  {statusMessage.type === 'success' ? 'verified' : statusMessage.type === 'info' ? 'info' : 'error'}
                </span>
                <p className="text-xs font-bold leading-tight">{statusMessage.text}</p>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Carga de Datos</label>
              <textarea 
                value={productList}
                onChange={(e) => setProductList(e.target.value)}
                className="w-full rounded-2xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark text-slate-900 dark:text-white p-5 text-sm min-h-[260px] font-mono leading-relaxed transition-all outline-none resize-none shadow-inner focus:ring-2 focus:ring-primary/20" 
                placeholder="PRODUCTO, COSTO&#10;Ej: LECHE ALPURA 1L, 25.00"
              />
            </div>
            
            <button 
              onClick={handleProcessUpdates}
              disabled={isProcessing || !productList.trim()}
              className="w-full bg-primary hover:bg-primary-dark active:scale-[0.98] transition-all text-white font-black py-5 rounded-2xl shadow-xl flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {isProcessing ? <span className="material-symbols-outlined animate-spin">sync</span> : <><span className="material-symbols-outlined">auto_awesome</span> Ejecutar Sincronización</>}
            </button>
          </div>
        ) : (
          <div className="animate-in fade-in duration-300 space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 px-1">Informes Recientes</h3>
            {loadingHistory ? (
              <div className="py-20 flex justify-center"><span className="material-symbols-outlined animate-spin text-primary text-4xl">sync</span></div>
            ) : history.length === 0 ? (
              <div className="py-20 text-center flex flex-col items-center gap-3 opacity-30">
                <span className="material-symbols-outlined text-5xl">history</span>
                <p className="text-xs font-black uppercase tracking-widest">Sin informes generados</p>
              </div>
            ) : (
              history.map(job => (
                <div 
                  key={job.id} 
                  onClick={() => setSelectedJob(job)}
                  className="bg-white dark:bg-surface-dark p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-white/5 active:scale-[0.98] transition-all cursor-pointer group"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="size-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                      <span className="material-symbols-outlined text-xl">description</span>
                    </div>
                    <span className="text-[10px] font-black text-slate-400 uppercase">
                      {(job.createdAt as Timestamp)?.toDate().toLocaleDateString('es-MX', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'})}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <div className="text-center">
                      <p className="text-[8px] font-black text-slate-400 uppercase">Actualizados</p>
                      <p className="text-sm font-black text-emerald-500">{job.totalUpdated}</p>
                    </div>
                    <div className="text-center border-x border-slate-100 dark:border-white/5">
                      <p className="text-[8px] font-black text-slate-400 uppercase">Sin cambio</p>
                      <p className="text-sm font-black text-slate-500">{job.totalUnchanged}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[8px] font-black text-slate-400 uppercase">No enc.</p>
                      <p className="text-sm font-black text-red-500">{job.totalNotFound}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      {/* MODAL DETALLE DE INFORME (HISTORIAL) */}
      {selectedJob && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-full max-w-sm bg-white dark:bg-surface-dark rounded-[2.5rem] flex flex-col max-h-[85vh] shadow-2xl border border-slate-100 dark:border-white/5 overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-white/5 bg-primary/5 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">Detalle de Informe</h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                  {(selectedJob.createdAt as Timestamp)?.toDate().toLocaleString()}
                </p>
              </div>
              <button onClick={() => setSelectedJob(null)} className="size-10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 flex items-center justify-center">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
               <div className="bg-slate-50 dark:bg-white/5 rounded-2xl p-4 grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-[8px] font-black text-slate-400 uppercase">Líneas Entrada</p>
                    <p className="text-sm font-black">{selectedJob.inputLines}</p>
                  </div>
                  <div>
                    <p className="text-[8px] font-black text-slate-400 uppercase">Duración</p>
                    <p className="text-sm font-black">{selectedJob.durationMs}ms</p>
                  </div>
               </div>

              {selectedJob.itemsPreview?.map((res: any, i: number) => (
                <div key={i} className={`p-4 rounded-2xl border transition-colors ${
                  res.matchStatus === 'SUBIÓ' || res.matchStatus === 'UPDATED' ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20' :
                  res.matchStatus === 'BAJÓ' ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20' :
                  res.matchStatus === 'NO ENCONTRADO' || res.matchStatus === 'NOT_FOUND' ? 'bg-red-50 dark:bg-red-500/10 border-red-100 dark:border-red-500/20' :
                  'bg-white dark:bg-surface-dark border-slate-200 dark:border-white/10'
                }`}>
                  <p className="text-[8px] font-bold text-slate-400 uppercase">Input: {res.lineRaw}</p>
                  {res.matchedName && (
                    <p className="text-xs font-black text-slate-900 dark:text-white uppercase mt-0.5">{res.matchedName}</p>
                  )}
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/5 uppercase text-slate-500">
                      {res.matchStatus}
                    </span>
                    {res.newPrice && <span className="text-[10px] font-black text-primary">Venta: {formatCurrency(res.newPrice)}</span>}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 bg-slate-50 dark:bg-white/5">
              <button onClick={() => setSelectedJob(null)} className="w-full py-4 bg-primary text-white font-black rounded-2xl shadow-lg active:scale-95 transition-all">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL REPORTE INMEDIATO (Tras procesar) */}
      {report && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-full max-w-sm bg-white dark:bg-surface-dark rounded-[2.5rem] flex flex-col max-h-[85vh] shadow-2xl border border-slate-100 dark:border-white/5 overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-white/5 bg-primary/5">
              <h3 className="text-xl font-black text-slate-900 dark:text-white">Informe Generado</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Resultados de Sincronización Fuzzy</p>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
              {report?.map((res, i) => (
                <div key={i} className={`p-4 rounded-2xl border transition-colors ${
                  res.status === 'SUBIÓ' ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20' :
                  res.status === 'BAJÓ' ? 'bg-red-50 dark:bg-red-500/10 border-red-100 dark:border-red-500/20' :
                  res.status === 'SIN CAMBIOS' ? 'bg-slate-50 dark:bg-white/5 border-slate-100 dark:border-white/10' :
                  res.status === 'REVISAR' ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20' :
                  'bg-white dark:bg-surface-dark border-slate-200 dark:border-white/10'
                }`}>
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1">
                      <p className="text-[9px] font-bold text-slate-400 uppercase">Input: {res.name}</p>
                      {res.matchedName && (
                        <p className="text-xs font-black text-slate-900 dark:text-white uppercase mt-0.5">DB: {res.matchedName}</p>
                      )}
                    </div>
                    {res.matchScore !== undefined && (
                      <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 text-slate-500">
                        {Math.round(res.matchScore * 100)}%
                      </span>
                    )}
                  </div>
                  
                  <div className="flex justify-between items-center mt-3">
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${
                      res.status === 'SUBIÓ' ? 'bg-emerald-500 text-white' :
                      res.status === 'BAJÓ' ? 'bg-red-500 text-white' :
                      res.status === 'SIN CAMBIOS' ? 'bg-slate-300 text-slate-700' :
                      res.status === 'REVISAR' ? 'bg-amber-500 text-white' :
                      'bg-slate-100 text-slate-400'
                    }`}>
                      {res.status === 'REVISAR' ? 'AMBIGUO / REVISAR' : res.status}
                    </span>
                    {res.newSuggestedPrice !== undefined && res.status !== 'NO ENCONTRADO' && res.status !== 'REVISAR' && (
                      <span className="text-xs font-black text-primary">Venta: {formatCurrency(res.newSuggestedPrice)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 bg-slate-50 dark:bg-white/5">
              <button onClick={() => setReport(null)} className="w-full py-4 bg-primary text-white font-black rounded-2xl shadow-lg active:scale-95 transition-all">Cerrar Informe</button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
};

export default PriceUpdateScreen;
