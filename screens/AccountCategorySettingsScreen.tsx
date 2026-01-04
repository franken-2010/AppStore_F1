
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  orderBy,
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { AccountCategory, AccountType } from '../types';

const AccountCategorySettingsScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [categories, setCategories] = useState<AccountCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    accountingType: 'Activo' as AccountType
  });

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "users", user.uid, "categories"), orderBy("order", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() } as AccountCategory)));
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  const handleSave = async () => {
    if (!user || !formData.name.trim()) return;
    try {
      if (editingId) {
        await updateDoc(doc(db, "users", user.uid, "categories", editingId), {
          name: formData.name.trim(),
          accountingType: formData.accountingType,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, "users", user.uid, "categories"), {
          name: formData.name.trim(),
          accountingType: formData.accountingType,
          order: categories.length,
          createdAt: serverTimestamp()
        });
      }
      setFormData({ name: '', accountingType: 'Activo' });
      setEditingId(null);
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (id: string) => {
    if (!user || !window.confirm("¿Eliminar categoría? Las cuentas asociadas perderán su agrupación.")) return;
    await deleteDoc(doc(db, "users", user.uid, "categories", id));
  };

  return (
    <div className="relative flex flex-col h-screen w-full max-w-md mx-auto bg-[#0f172a] font-display text-white">
      <header className="pt-12 px-5 pb-4 flex items-center gap-4 border-b border-white/5">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2"><span className="material-symbols-outlined">arrow_back</span></button>
        <h1 className="text-xl font-bold">Categorías de Cuentas</h1>
      </header>

      <main className="flex-1 overflow-y-auto p-5 space-y-8 no-scrollbar">
        {/* Formulario */}
        <div className="bg-surface-dark p-6 rounded-3xl border border-white/5 space-y-4">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-primary">
            {editingId ? 'Editar Categoría' : 'Nueva Categoría'}
          </h3>
          <input 
            value={formData.name} 
            onChange={e => setFormData({...formData, name: e.target.value})}
            placeholder="Ej. EFECTIVO, AHORROS..."
            className="w-full bg-[#0f172a] border-none rounded-xl py-3 px-4 text-sm font-bold"
          />
          <div className="flex gap-2">
            {(['Activo', 'Pasivo', 'Capital'] as AccountType[]).map(t => (
              <button 
                key={t}
                onClick={() => setFormData({...formData, accountingType: t})}
                className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${formData.accountingType === t ? 'bg-primary text-white' : 'bg-white/5 text-slate-500'}`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={handleSave} className="flex-1 bg-primary py-3 rounded-xl font-black text-sm shadow-lg active:scale-95 transition-all">
              {editingId ? 'Actualizar' : 'Guardar'}
            </button>
            {editingId && (
              <button onClick={() => {setEditingId(null); setFormData({name:'', accountingType:'Activo'});}} className="px-4 bg-white/10 rounded-xl">
                <span className="material-symbols-outlined">close</span>
              </button>
            )}
          </div>
        </div>

        {/* Lista */}
        <div className="space-y-3">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Existentes</h3>
          {categories.map(cat => (
            <div key={cat.id} className="flex items-center justify-between p-4 bg-surface-dark rounded-2xl border border-white/5">
              <div className="flex flex-col">
                <span className="text-sm font-bold">{cat.name}</span>
                <span className="text-[9px] font-black uppercase text-slate-500 tracking-tighter">{cat.accountingType}</span>
              </div>
              <div className="flex gap-1">
                <button 
                  onClick={() => { setEditingId(cat.id!); setFormData({name: cat.name, accountingType: cat.accountingType}); }}
                  className="size-9 bg-white/5 rounded-xl flex items-center justify-center text-blue-400"
                >
                  <span className="material-symbols-outlined text-lg">edit</span>
                </button>
                <button 
                  onClick={() => handleDelete(cat.id!)}
                  className="size-9 bg-white/5 rounded-xl flex items-center justify-center text-red-400"
                >
                  <span className="material-symbols-outlined text-lg">delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default AccountCategorySettingsScreen;
