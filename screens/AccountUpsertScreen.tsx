
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { 
  doc, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  collection,
  getDocs,
  query,
  orderBy,
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { AccountingAccount, AccountType, AccountCategory } from '../types';

// Componente para crear o editar una cuenta contable vinculada a categorías dinámicas
const AccountUpsertScreen: React.FC = () => {
  const { accountId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [categories, setCategories] = useState<AccountCategory[]>([]);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    categoryId: '',
    accountingType: 'Activo' as AccountType,
    balance: 0,
    isVisible: true,
    code: ''
  });

  useEffect(() => {
    if (!user) return;
    const loadData = async () => {
      try {
        const qCat = query(collection(db, "users", user.uid, "categories"), orderBy("order", "asc"));
        const snapCat = await getDocs(qCat);
        const cats = snapCat.docs.map(d => ({ id: d.id, ...d.data() } as AccountCategory));
        setCategories(cats);

        if (accountId) {
          const docRef = doc(db, "users", user.uid, "accounts", accountId);
          const snapAcc = await getDoc(docRef);
          if (snapAcc.exists()) {
            const data = snapAcc.data() as AccountingAccount;
            setFormData({
              name: data.name,
              categoryId: data.categoryId || '',
              accountingType: data.type,
              balance: data.balance || 0,
              isVisible: data.isVisible !== false,
              code: data.code || ''
            });
          }
        }
      } catch (e) { console.error(e); } finally { setFetching(false); }
    };
    loadData();
  }, [accountId, user]);

  const handleSave = async () => {
    if (!user || !formData.name.trim()) return;
    setLoading(true);

    try {
      const selectedCat = categories.find(c => c.id === formData.categoryId);
      const accountsCol = collection(db, "users", user.uid, "accounts");
      
      const accountData: any = {
        name: formData.name.trim(),
        categoryId: formData.categoryId || null,
        type: selectedCat ? selectedCat.accountingType : formData.accountingType,
        balance: Number(formData.balance),
        isVisible: formData.isVisible,
        code: formData.code || (formData.name.substring(0, 3).toUpperCase() + Math.floor(100 + Math.random() * 900)),
        updatedAt: serverTimestamp()
      };

      if (accountId) {
        await updateDoc(doc(db, "users", user.uid, "accounts", accountId), accountData);
      } else {
        const q = query(accountsCol, orderBy("order", "desc"));
        const snap = await getDocs(q);
        const lastOrder = snap.docs.length > 0 ? (snap.docs[0].data().order || 0) : -1;
        await addDoc(accountsCol, { ...accountData, order: lastOrder + 1, createdAt: serverTimestamp() });
      }
      navigate('/finance-accounts');
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleDelete = async () => {
    if (!user || !accountId) return;
    setLoading(true);
    setShowConfirmDelete(false);
    try {
      await deleteDoc(doc(db, "users", user.uid, "accounts", accountId));
      navigate('/finance-accounts');
    } catch (e) { 
      console.error(e); 
      setLoading(false);
      alert("Error al eliminar la cuenta de Firebase.");
    }
  };

  if (fetching) return <div className="min-h-screen bg-[#0f172a] flex items-center justify-center text-primary"><span className="material-symbols-outlined animate-spin text-4xl">sync</span></div>;

  return (
    <div className="relative flex flex-col h-screen w-full max-w-md mx-auto bg-[#0f172a] font-display text-white overflow-hidden">
      {/* Diálogo de Confirmación Estilizado */}
      {showConfirmDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-xs bg-surface-dark rounded-[2.5rem] p-8 shadow-2xl border border-white/10 animate-in zoom-in duration-300">
            <div className="size-16 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <span className="material-symbols-outlined text-3xl">warning</span>
            </div>
            <h3 className="text-xl font-bold text-center text-white mb-2">¿Eliminar cuenta?</h3>
            <p className="text-sm text-slate-400 text-center mb-8 leading-relaxed">
              Esta acción eliminará permanentemente la cuenta <strong>{formData.name}</strong> y su saldo de la base de datos de Firebase.
            </p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={handleDelete}
                className="w-full py-4 bg-red-500 text-white font-bold rounded-2xl shadow-xl active:scale-95 transition-all"
              >
                Eliminar Permanentemente
              </button>
              <button 
                onClick={() => setShowConfirmDelete(false)}
                className="w-full py-3 text-slate-500 font-bold"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="pt-12 px-5 pb-4 border-b border-white/5 flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-white hover:bg-white/5 rounded-full transition-colors"><span className="material-symbols-outlined">arrow_back</span></button>
        <h1 className="text-xl font-bold">{accountId ? 'Editar Cuenta' : 'Nueva Cuenta'}</h1>
      </header>

      <main className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar pb-32">
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Nombre de la cuenta</label>
          <input 
            value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
            className="w-full bg-surface-dark border-none rounded-xl py-4 px-5 font-bold focus:ring-2 focus:ring-primary outline-none"
            placeholder="Ej. Caja 01, Inversiones..."
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Categoría</label>
          <select 
            value={formData.categoryId} onChange={e => setFormData({...formData, categoryId: e.target.value})}
            className="w-full bg-surface-dark border-none rounded-xl py-4 px-5 font-bold focus:ring-2 focus:ring-primary outline-none appearance-none"
          >
            <option value="">Sin Categoría</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Saldo inicial / Actual</label>
          <div className="relative">
            <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
            <input 
              type="number"
              value={formData.balance === 0 ? '' : formData.balance} onChange={e => setFormData({...formData, balance: parseFloat(e.target.value) || 0})}
              className="w-full bg-surface-dark border-none rounded-xl py-4 pl-10 pr-5 font-bold focus:ring-2 focus:ring-primary outline-none"
              placeholder="0.00"
            />
          </div>
        </div>

        <div className="flex items-center justify-between p-4 bg-surface-dark rounded-2xl border border-white/5">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-bold">Visible en Dashboard</span>
            <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Activar para sumar al balance total</span>
          </div>
          <button 
            onClick={() => setFormData({...formData, isVisible: !formData.isVisible})}
            className={`relative w-12 h-7 rounded-full transition-colors duration-200 ${formData.isVisible ? 'bg-primary' : 'bg-slate-700'}`}
          >
            <div className={`absolute top-1 size-5 bg-white rounded-full transition-all duration-200 shadow-sm ${formData.isVisible ? 'left-6' : 'left-1'}`} />
          </button>
        </div>

        <div className="pt-4 space-y-4">
          <button 
            onClick={handleSave}
            disabled={loading}
            className="w-full py-5 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {loading ? <span className="material-symbols-outlined animate-spin">sync</span> : <span className="material-symbols-outlined">save</span>}
            {accountId ? 'Guardar Cambios' : 'Crear Cuenta'}
          </button>

          {accountId && (
            <button 
              onClick={() => setShowConfirmDelete(true)}
              className="w-full py-4 text-red-500 font-bold flex items-center justify-center gap-2 hover:bg-red-500/5 rounded-2xl transition-colors"
            >
              <span className="material-symbols-outlined text-lg">delete</span>
              Eliminar Cuenta
            </button>
          )}
        </div>
      </main>
    </div>
  );
};

// Se agregó el export default para corregir el error en App.tsx
export default AccountUpsertScreen;
