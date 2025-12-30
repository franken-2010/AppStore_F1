
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
import { AccountingAccount, AccountType } from '../types';

const AccountUpsertScreen: React.FC = () => {
  const { accountId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(!!accountId);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    name: '',
    type: 'Activo' as AccountType,
    balance: 0,
    isVisible: true,
    code: ''
  });

  useEffect(() => {
    if (accountId && user) {
      const fetchAccount = async () => {
        try {
          const docRef = doc(db, "users", user.uid, "accounts", accountId);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            const data = snap.data() as AccountingAccount;
            setFormData({
              name: data.name,
              type: data.type,
              balance: data.balance || 0,
              isVisible: data.isVisible !== false,
              code: data.code || ''
            });
          }
        } catch (err) {
          console.error("Error fetching account:", err);
        } finally {
          setFetching(false);
        }
      };
      fetchAccount();
    }
  }, [accountId, user]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = 'El nombre es requerido';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!user || !validate()) return;
    setLoading(true);

    try {
      const accountsCol = collection(db, "users", user.uid, "accounts");
      
      const accountData: any = {
        name: formData.name.trim(),
        type: formData.type,
        balance: Number(formData.balance),
        isVisible: formData.isVisible,
        code: formData.code || (formData.name.substring(0, 3).toUpperCase() + Math.floor(100 + Math.random() * 900)),
        updatedAt: serverTimestamp()
      };

      if (accountId) {
        const docRef = doc(db, "users", user.uid, "accounts", accountId);
        await updateDoc(docRef, accountData);
      } else {
        // Obtener el último orden para asignar el siguiente
        const q = query(accountsCol, orderBy("order", "desc"));
        const snap = await getDocs(q);
        const lastOrder = snap.docs.length > 0 ? (snap.docs[0].data().order || 0) : -1;
        
        await addDoc(accountsCol, {
          ...accountData,
          order: lastOrder + 1,
          createdAt: serverTimestamp()
        });
      }
      navigate('/finance-accounts');
    } catch (err) {
      console.error("Error saving account:", err);
      setErrors({ global: 'Error al conectar con Firestore. Intente de nuevo.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!user || !accountId) return;
    if (!window.confirm('¿Estás seguro de que deseas eliminar esta cuenta permanentemente?')) return;
    
    setLoading(true);
    try {
      const docRef = doc(db, "users", user.uid, "accounts", accountId);
      await deleteDoc(docRef);
      navigate('/finance-accounts');
    } catch (err) {
      console.error("Error deleting account:", err);
      setErrors({ global: 'No se pudo eliminar la cuenta.' });
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center">
        <span className="material-symbols-outlined animate-spin text-primary text-4xl">sync</span>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col h-screen w-full max-w-md mx-auto bg-background-light dark:bg-background-dark font-display antialiased overflow-hidden">
      <header className="sticky top-0 z-50 bg-background-light dark:bg-background-dark pt-12 px-4 pb-4 border-b border-slate-100 dark:border-white/5 flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-slate-700 dark:text-white">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-xl font-bold tracking-tight">
          {accountId ? 'Editar Cuenta' : 'Nueva Cuenta'}
        </h1>
      </header>

      <main className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
        {errors.global && (
          <div className="p-4 bg-red-50 text-red-700 rounded-xl text-xs font-bold border border-red-100 animate-in fade-in">
            {errors.global}
          </div>
        )}

        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nombre de la cuenta</label>
          <input 
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className={`w-full rounded-2xl bg-white dark:bg-surface-dark border ${errors.name ? 'border-red-500' : 'border-slate-200 dark:border-white/5'} py-4 px-5 text-base font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all`}
            placeholder="Ej: Caja Fuerte, Banco Santander..."
          />
          {errors.name && <p className="text-red-500 text-[10px] font-bold ml-1">{errors.name}</p>}
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Clasificación</label>
          <div className="grid grid-cols-3 gap-2">
            {['Activo', 'Pasivo', 'Ahorro'].map((t) => (
              <button
                key={t}
                onClick={() => setFormData({ ...formData, type: t as any })}
                className={`py-3 rounded-xl text-xs font-black transition-all border ${
                  formData.type === t 
                    ? 'bg-primary border-primary text-white shadow-lg shadow-primary/30' 
                    : 'bg-white dark:bg-surface-dark border-slate-200 dark:border-white/5 text-slate-400'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Saldo Actual</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400">$</span>
            <input 
              type="number"
              step="0.01"
              value={formData.balance === 0 ? '' : formData.balance}
              onChange={(e) => setFormData({ ...formData, balance: parseFloat(e.target.value) || 0 })}
              className="w-full rounded-2xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/5 py-4 pl-10 pr-5 text-base font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              placeholder="0.00"
            />
          </div>
        </div>

        <div className="flex items-center justify-between p-4 bg-white dark:bg-surface-dark rounded-2xl border border-slate-100 dark:border-white/5">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-slate-400">
              {formData.isVisible ? 'visibility' : 'visibility_off'}
            </span>
            <span className="text-sm font-bold">Mostrar en Dashboard</span>
          </div>
          <button 
            onClick={() => setFormData({ ...formData, isVisible: !formData.isVisible })}
            className={`relative w-12 h-6 rounded-full transition-colors ${formData.isVisible ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'}`}
          >
            <div className={`absolute top-1 size-4 bg-white rounded-full shadow transition-transform ${formData.isVisible ? 'translate-x-7' : 'translate-x-1'}`} />
          </button>
        </div>

        <div className="pt-4 space-y-3">
          <button 
            onClick={handleSave}
            disabled={loading}
            className="w-full py-4.5 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/30 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            {loading ? <span className="material-symbols-outlined animate-spin">sync</span> : null}
            {accountId ? 'Actualizar Cuenta' : 'Crear Cuenta en BDD'}
          </button>

          {accountId && (
            <button 
              onClick={handleDelete}
              disabled={loading}
              className="w-full py-4 bg-red-50 dark:bg-red-500/10 text-red-500 font-bold rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-2 border border-red-100 dark:border-red-500/20"
            >
              <span className="material-symbols-outlined text-lg">delete</span>
              Eliminar Permanentemente
            </button>
          )}
        </div>
      </main>
    </div>
  );
};

export default AccountUpsertScreen;
