
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { 
  doc, 
  getDoc, 
  writeBatch,
  collection,
  getDocs,
  query,
  orderBy,
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { AccountingAccount, AccountType, AccountCategory } from '../types';
import MoneyInputWithCalculator from '../components/MoneyInputWithCalculator';

const AccountUpsertScreen: React.FC = () => {
  const { accountId: editDocId } = useParams(); // Document ID en 'accounts'
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [categories, setCategories] = useState<AccountCategory[]>([]);

  const [formData, setFormData] = useState({
    name: '',
    categoryId: '',
    accountingType: 'Activo' as AccountType,
    balance: 0,
    isVisible: true,
    isContable: true,
    inventoryMin: 0,
    inventoryMax: 0,
    code: '',
    accountId: '' // Stable ID (ventas, fiesta, etc.)
  });

  const normalizeToAccountId = (name: string): string => {
    return name
      .toLowerCase()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');
  };

  useEffect(() => {
    if (!user) return;
    const loadData = async () => {
      try {
        const qCat = query(collection(db, "users", user.uid, "categories"), orderBy("order", "asc"));
        const snapCat = await getDocs(qCat);
        const cats = snapCat.docs.map(d => ({ id: d.id, ...d.data() } as AccountCategory));
        setCategories(cats);

        if (editDocId) {
          const docRef = doc(db, "users", user.uid, "accounts", editDocId);
          const snapAcc = await getDoc(docRef);
          if (snapAcc.exists()) {
            const data = snapAcc.data() as AccountingAccount;
            setFormData({
              name: data.name,
              categoryId: data.categoryId || '',
              accountingType: data.type,
              balance: data.balance || 0,
              isVisible: data.isVisible !== false,
              isContable: data.isContable !== false,
              inventoryMin: data.inventoryMin || 0,
              inventoryMax: data.inventoryMax || 0,
              code: data.code || '',
              accountId: data.accountId || ''
            });
          }
        }
      } catch (e) { console.error(e); } finally { setFetching(false); }
    };
    loadData();
  }, [editDocId, user]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: ['balance', 'inventoryMin', 'inventoryMax'].includes(field) ? parseFloat(value) || 0 : value
    }));
  };

  const handleSave = async () => {
    if (!user || !formData.name.trim()) return;
    setLoading(true);

    try {
      const batch = writeBatch(db);
      const selectedCat = categories.find(c => c.id === formData.categoryId);
      
      const stableAccountId = formData.accountId || normalizeToAccountId(formData.name);
      
      const accountCol = collection(db, "users", user.uid, "accounts");
      const accountDocRef = editDocId 
        ? doc(db, "users", user.uid, "accounts", editDocId)
        : doc(accountCol);

      const indexDocRef = doc(db, "users", user.uid, "accountIndex", stableAccountId);

      const type = selectedCat ? selectedCat.accountingType : formData.accountingType;

      const isInv = stableAccountId === 'inventarios';

      const accountData: any = {
        name: formData.name.trim(),
        accountId: stableAccountId,
        categoryId: formData.categoryId || null,
        type: type,
        balance: Number(formData.balance),
        isVisible: formData.isVisible,
        isContable: isInv ? false : formData.isContable, // Inventarios nunca es contable
        inventoryMin: isInv ? Number(formData.inventoryMin) : null,
        inventoryMax: isInv ? Number(formData.inventoryMax) : null,
        code: formData.code || (formData.name.substring(0, 3).toUpperCase() + Math.floor(100 + Math.random() * 900)),
        updatedAt: serverTimestamp()
      };

      if (!editDocId) {
        const q = query(accountCol, orderBy("order", "desc"));
        const snap = await getDocs(q);
        const lastOrder = snap.docs.length > 0 ? (snap.docs[0].data().order || 0) : -1;
        accountData.order = lastOrder + 1;
        accountData.createdAt = serverTimestamp();
        batch.set(accountDocRef, accountData);
      } else {
        batch.update(accountDocRef, accountData);
      }

      batch.set(indexDocRef, {
        accountId: stableAccountId,
        accountDocId: accountDocRef.id,
        name: formData.name.trim(),
        type: type,
        categoryId: formData.categoryId || null,
        isActive: true,
        isContable: accountData.isContable,
        inventoryMin: accountData.inventoryMin,
        inventoryMax: accountData.inventoryMax,
        updatedAt: serverTimestamp(),
        createdAt: editDocId ? serverTimestamp() : serverTimestamp()
      }, { merge: true });

      await batch.commit();
      navigate('/finance-accounts');
    } catch (e) { 
      console.error(e); 
      alert("Error al sincronizar con el índice canónico.");
    } finally { 
      setLoading(false); 
    }
  };

  const isInventory = formData.accountId === 'inventarios' || normalizeToAccountId(formData.name) === 'inventarios';

  if (fetching) return <div className="min-h-screen bg-[#0f172a] flex items-center justify-center text-primary"><span className="material-symbols-outlined animate-spin text-4xl">sync</span></div>;

  return (
    <div className="relative flex flex-col h-screen w-full max-w-md mx-auto bg-[#0f172a] font-display text-white overflow-hidden">
      <header className="pt-12 px-5 pb-4 border-b border-white/5 flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-white"><span className="material-symbols-outlined">arrow_back</span></button>
        <h1 className="text-xl font-bold">{editDocId ? 'Editar Cuenta' : 'Alta de Cuenta'}</h1>
      </header>

      <main className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar pb-32">
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Nombre Comercial</label>
          <input 
            value={formData.name} onChange={e => handleInputChange('name', e.target.value)}
            className="w-full bg-surface-dark border-none rounded-xl py-4 px-5 font-bold focus:ring-2 focus:ring-primary outline-none"
            placeholder="Ej. Fiesta"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1 flex items-center gap-2">
            Identificador Interno (Fijo)
            <span className="material-symbols-outlined text-[12px] text-emerald-500">lock</span>
          </label>
          <input 
            value={formData.accountId || normalizeToAccountId(formData.name)} readOnly
            className="w-full bg-surface-dark/30 border border-white/5 rounded-xl py-4 px-5 font-mono text-xs text-slate-400 outline-none"
          />
        </div>

        {isInventory ? (
          <div className="p-6 bg-primary/10 border border-primary/20 rounded-3xl space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <span className="material-symbols-outlined text-primary">inventory_2</span>
              <p className="text-[11px] font-black uppercase tracking-widest text-primary">Configuración de Inventarios</p>
            </div>
            
            <p className="text-[10px] font-bold text-slate-400 leading-relaxed uppercase">
              ⚠️ Esta cuenta es Operativa (No Contable). No afecta totales de ingresos ni egresos contables.
            </p>

            <MoneyInputWithCalculator 
              label="Stock Mínimo (Alerta)" 
              field="inventoryMin" 
              value={formData.inventoryMin} 
              onChange={handleInputChange} 
              placeholder="Ej. 10000"
            />

            <MoneyInputWithCalculator 
              label="Stock Máximo (Alerta)" 
              field="inventoryMax" 
              value={formData.inventoryMax} 
              onChange={handleInputChange} 
              placeholder="Ej. 80000"
            />
          </div>
        ) : (
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Categoría</label>
            <select 
              value={formData.categoryId} onChange={e => handleInputChange('categoryId', e.target.value)}
              className="w-full bg-surface-dark border-none rounded-xl py-4 px-5 font-bold focus:ring-2 focus:ring-primary outline-none appearance-none"
            >
              <option value="">Sin Categoría</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
        )}

        <MoneyInputWithCalculator 
          label={isInventory ? "Valor Total Actual" : "Saldo Inicial / Actual"} 
          field="balance" 
          value={formData.balance} 
          onChange={handleInputChange} 
        />

        {!isInventory && (
          <div className="flex items-center justify-between p-4 bg-surface-dark rounded-2xl border border-white/5">
            <div className="flex flex-col">
              <span className="text-sm font-bold">Incluir en Contabilidad</span>
              <span className="text-[9px] font-bold text-slate-500 uppercase">Afecta reportes financieros</span>
            </div>
            <button 
              onClick={() => setFormData({...formData, isContable: !formData.isContable})}
              className={`relative w-12 h-7 rounded-full transition-all ${formData.isContable ? 'bg-emerald-500' : 'bg-slate-700'}`}
            >
              <div className={`absolute top-1 size-5 bg-white rounded-full transition-all ${formData.isContable ? 'left-6' : 'left-1'}`} />
            </button>
          </div>
        )}

        <div className="flex items-center justify-between p-4 bg-surface-dark rounded-2xl border border-white/5">
          <div className="flex flex-col">
            <span className="text-sm font-bold">Mostrar en Dashboard</span>
            <span className="text-[9px] font-bold text-slate-500 uppercase">Visible en resumen principal</span>
          </div>
          <button 
            onClick={() => setFormData({...formData, isVisible: !formData.isVisible})}
            className={`relative w-12 h-7 rounded-full transition-all ${formData.isVisible ? 'bg-primary' : 'bg-slate-700'}`}
          >
            <div className={`absolute top-1 size-5 bg-white rounded-full transition-all ${formData.isVisible ? 'left-6' : 'left-1'}`} />
          </button>
        </div>

        <div className="pt-4 space-y-4">
          <button 
            onClick={handleSave}
            disabled={loading}
            className="w-full py-5 bg-primary text-white font-black rounded-2xl shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3"
          >
            {loading ? <span className="material-symbols-outlined animate-spin">sync</span> : <span className="material-symbols-outlined">save</span>}
            Sincronizar Índice F1
          </button>
          
          <p className="text-[9px] text-center text-slate-500 font-bold uppercase tracking-widest px-4 leading-relaxed">
            Al guardar, el sistema asegura la vinculación vía accountId para reportes de IA y alertas de stock correctos.
          </p>
        </div>
      </main>
    </div>
  );
};

export default AccountUpsertScreen;
