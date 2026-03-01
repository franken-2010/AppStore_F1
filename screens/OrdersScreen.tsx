
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  limit, 
  addDoc,
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { GeminiService } from '../services/geminiService';
import BottomNav from '../components/BottomNav';
import VoiceInputButton from '../components/VoiceInputButton';

interface OrderItem {
  rawName: string;
  matchedName?: string;
  qty: number;
  unit: string;
  notes: string[];
  isFound: boolean;
}

interface SupplierContact {
  id: string;
  supplierName: string;
  contactName: string;
  whatsappPhone: string;
}

const OrdersScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [rawInput, setRawInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [finalItems, setFinalItems] = useState<OrderItem[]>([]);
  const [finalText, setFinalText] = useState('');
  
  // WhatsApp / Supplier Selection
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [suppliers, setSuppliers] = useState<SupplierContact[]>([]);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);

  const normalizeText = (text: string): string => {
    if (!text) return "";
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const tokenize = (text: string): string[] => {
    return text.split(' ').filter(t => t.length >= 2 || !isNaN(Number(t)));
  };

  const pluralizeUnit = (qty: number, unit: string) => {
    if (qty <= 1) return unit;
    if (unit.endsWith('s')) return unit;
    if (unit.endsWith('r') || unit.endsWith('l') || unit.endsWith('n')) return unit + 'es';
    return unit + 's';
  };

  const handleGenerate = async () => {
    if (!rawInput.trim() || !user) return;
    setIsProcessing(true);
    setFinalItems([]);
    setFinalText('');

    try {
      const { items: extractedItems } = await GeminiService.parseOrderText(rawInput);
      
      const processed: OrderItem[] = [];
      const costsRef = collection(db, "costs_catalog");

      for (const item of extractedItems) {
        const qNorm = normalizeText(item.rawName);
        const qTokens = tokenize(qNorm);
        const strongTokens = qTokens.filter(t => t.length > 3 || !isNaN(Number(t))).slice(0, 10);
        
        let match: any = null;
        let bestScore = 0;

        if (strongTokens.length > 0) {
          const qMain = query(costsRef, where("searchTokens", "array-contains-any", strongTokens), limit(30));
          const snap = await getDocs(qMain);
          
          snap.docs.forEach(doc => {
            const data = doc.data();
            const candNorm = data.searchName || normalizeText(data.Nombre_Completo || "");
            const candTokens = data.searchTokens || [];

            let score = 0;
            qTokens.forEach(qt => { if (candTokens.includes(qt)) score += 1; });
            const qNumbers = qTokens.filter(t => !isNaN(Number(t)));
            qNumbers.forEach(qn => { if (candTokens.includes(qn)) score += 2; });
            const longTokens = qTokens.filter(t => t.length > 3);
            if (longTokens.every(lt => candNorm.includes(lt))) score += 3;

            if (score > bestScore) {
              bestScore = score;
              match = data;
            }
          });
        }

        const threshold = 0.45;
        const normalizedScore = bestScore / (qTokens.length || 1);
        const isFound = match && normalizedScore > threshold;

        processed.push({
          rawName: item.rawName,
          matchedName: isFound ? match.Nombre_Completo : undefined,
          qty: item.qty,
          unit: item.unit,
          notes: item.notes,
          isFound: !!isFound
        });
      }

      setFinalItems(processed);
      
      const lines = processed.map(item => {
        const name = item.isFound ? item.matchedName : item.rawName;
        const unitStr = pluralizeUnit(item.qty, item.unit);
        let noteStr = '';
        if (item.notes.length > 0) {
          noteStr = item.notes.map(n => n.startsWith('NO ') ? ` ${n}` : ` (${n})`).join('');
        }
        const suffix = item.isFound ? '' : ', (no encontrado)';
        return `* ${name}, ${item.qty} ${unitStr}${noteStr}${suffix}`;
      });

      setFinalText(lines.join('\n'));

      await addDoc(collection(db, "users", user.uid, "orders_history"), {
        uid: user.uid,
        createdAt: serverTimestamp(),
        rawInput: rawInput,
        finalText: lines.join('\n'),
        notFoundCount: processed.filter(p => !p.isFound).length
      });

    } catch (err) {
      console.error(err);
      alert("Error al generar la lista. Intenta de nuevo.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(finalText);
    alert("Lista copiada al portapapeles ✅");
  };

  const handleClearView = () => {
    setFinalText('');
    setFinalItems([]);
  };

  const handleResetAll = () => {
    if (!window.confirm("¿Seguro que quieres borrar todo e iniciar un nuevo pedido?")) return;
    setRawInput('');
    setFinalText('');
    setFinalItems([]);
  };

  const fetchSuppliers = async () => {
    if (!user) return;
    setLoadingSuppliers(true);
    try {
      const q = query(
        collection(db, "suppliers_directory"),
        where("uid", "==", user.uid),
        where("isActive", "==", true)
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SupplierContact));
      setSuppliers(list.sort((a, b) => a.supplierName.localeCompare(b.supplierName)));
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSuppliers(false);
    }
  };

  const openWhatsApp = (supplier: SupplierContact) => {
    if (!supplier.whatsappPhone) {
      alert("Este proveedor no tiene WhatsApp registrado.");
      return;
    }
    const cleanPhone = supplier.whatsappPhone.replace(/\D/g, '');
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(finalText)}`;
    window.open(url, "_blank");
    setShowSupplierModal(false);
  };

  const filteredSuppliers = useMemo(() => {
    const q = normalizeText(supplierSearch);
    if (!q) return suppliers;
    return suppliers.filter(s => 
      normalizeText(s.supplierName).includes(q) || 
      normalizeText(s.contactName).includes(q)
    );
  }, [suppliers, supplierSearch]);

  return (
    <div className="relative flex h-full min-h-screen w-full flex-col overflow-x-hidden max-w-md mx-auto shadow-2xl bg-background-light dark:bg-background-dark pb-32 font-display">
      <header className="pt-12 px-6 pb-6 flex items-center gap-4 sticky top-0 z-30 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md border-b dark:border-white/5">
        <button onClick={() => navigate('/tools')} className="size-10 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-700 dark:text-white">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-white uppercase truncate flex-1">Generar Pedido</h1>
      </header>

      <main className="px-6 py-8 space-y-6">
        <div className="bg-amber-500 rounded-3xl p-6 text-white shadow-xl shadow-amber-500/20 relative overflow-hidden">
          <span className="material-symbols-outlined absolute right-[-10px] top-[-10px] text-8xl opacity-10">shopping_cart</span>
          <h2 className="text-xl font-black mb-1">Pedidos F1 IA</h2>
          <p className="text-[11px] font-bold text-amber-100 uppercase tracking-wider leading-tight max-w-[80%]">Pega tu lista dictada. Gemini la estructurará y validará con tu catálogo.</p>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col gap-2 relative">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Escribe o Dicta tu Pedido</label>
            <textarea 
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              placeholder="Ej: Tráeme 3 jabón roma de kilo, un cloralex grande, 2 paquetes de galletas..."
              className="w-full h-48 rounded-2xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/5 p-5 text-sm font-bold outline-none focus:ring-2 focus:ring-primary shadow-sm dark:text-white transition-all no-scrollbar"
            />
            <VoiceInputButton onResult={setRawInput} className="absolute right-3 bottom-3 bg-primary/10" />
          </div>

          <button 
            onClick={handleGenerate}
            disabled={isProcessing || !rawInput.trim()}
            className="w-full py-5 bg-primary hover:bg-primary-dark text-white font-black rounded-3xl shadow-xl shadow-primary/20 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {isProcessing ? <span className="material-symbols-outlined animate-spin">sync</span> : <span className="material-symbols-outlined">auto_awesome</span>}
            {isProcessing ? 'GENERANDO LISTA...' : 'GENERAR LISTA'}
          </button>
        </div>

        {finalText && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Vista Previa WhatsApp</h3>
              <div className="h-px flex-1 bg-slate-100 dark:bg-white/5 ml-4"></div>
            </div>

            <div className="bg-slate-50 dark:bg-black/20 p-6 rounded-3xl border border-slate-200 dark:border-white/5 shadow-inner">
              <pre className="text-xs font-bold text-slate-800 dark:text-slate-300 whitespace-pre-wrap leading-relaxed font-display">
                {finalText}
              </pre>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={handleCopy}
                  className="py-4 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white font-black rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all text-xs"
                >
                  <span className="material-symbols-outlined">content_copy</span>
                  COPIAR
                </button>
                <button 
                  onClick={() => { fetchSuppliers(); setShowSupplierModal(true); }}
                  className="py-4 bg-emerald-500 text-white font-black rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all text-xs"
                >
                  <span className="material-symbols-outlined">send</span>
                  WHATSAPP
                </button>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={handleClearView}
                  className="py-3 bg-slate-100 dark:bg-white/5 text-slate-500 font-black rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all text-[10px] uppercase tracking-widest"
                >
                  Cerrar Vista
                </button>
                <button 
                  onClick={handleResetAll}
                  className="py-3 bg-red-500/10 text-red-500 font-black rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all text-[10px] uppercase tracking-widest border border-red-500/20"
                >
                  Nuevo Pedido
                </button>
              </div>
            </div>

            {finalItems.some(i => !i.isFound) && (
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-3">
                <span className="material-symbols-outlined text-amber-500">warning</span>
                <p className="text-[9px] font-bold text-amber-700 dark:text-amber-400 uppercase leading-relaxed">
                  Hay items no encontrados en el catálogo. Se enviarán con el nombre dictado originalmente.
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Supplier Selection Modal */}
      {showSupplierModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300 overflow-hidden">
          <div className="w-full max-w-sm bg-white dark:bg-surface-dark rounded-t-[2.5rem] flex flex-col max-h-[85vh] shadow-2xl border-t border-x border-slate-100 dark:border-white/10 overflow-hidden">
            <header className="p-6 border-b border-slate-100 dark:border-white/5 flex flex-col gap-4 shrink-0">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Enviar a Proveedor</h3>
                <button onClick={() => setShowSupplierModal(false)} className="size-8 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center">
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>
              <div className="relative">
                <input 
                  type="text"
                  value={supplierSearch}
                  onChange={(e) => setSupplierSearch(e.target.value)}
                  placeholder="Buscar proveedor..."
                  className="w-full py-3 px-10 bg-slate-50 dark:bg-background-dark/50 border border-slate-200 dark:border-white/5 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-primary dark:text-white"
                />
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 space-y-2 no-scrollbar overscroll-contain">
              {loadingSuppliers ? (
                <div className="py-10 flex justify-center"><span className="material-symbols-outlined animate-spin text-primary">sync</span></div>
              ) : filteredSuppliers.length === 0 ? (
                <div className="py-10 text-center opacity-30">
                  <p className="text-xs font-black uppercase tracking-widest">Sin proveedores</p>
                </div>
              ) : (
                filteredSuppliers.map(s => (
                  <button 
                    key={s.id}
                    onClick={() => openWhatsApp(s)}
                    className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-white/5 rounded-2xl hover:bg-primary/5 transition-colors border border-transparent hover:border-primary/10 group"
                  >
                    <div className="text-left">
                      <p className="text-sm font-black text-slate-900 dark:text-white uppercase leading-tight group-hover:text-primary transition-colors">{s.supplierName}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">{s.contactName}</p>
                    </div>
                    <span className="material-symbols-outlined text-emerald-500">chat</span>
                  </button>
                ))
              )}
            </div>
            
            <div className="p-4 bg-slate-50 dark:bg-background-dark/40 shrink-0">
               <button 
                onClick={() => setShowSupplierModal(false)}
                className="w-full py-4 text-slate-500 font-black uppercase text-[10px] tracking-widest"
               >
                 Cancelar
               </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
};

export default OrdersScreen;
