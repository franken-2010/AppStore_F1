
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import BottomNav from '../components/BottomNav';
import { useNotifications } from '../context/NotificationContext';

const AddProviderScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',        // Empresa
    contactName: '', // Persona
    whatsapp: ''
  });

  const normalizeText = (text: string): string => {
    if (!text) return "";
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Quita diacríticos
      .replace(/ñ/g, "n")
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const handleSave = async () => {
    if (!user) return;
    
    if (!formData.contactName.trim()) {
      alert("El nombre del contacto es obligatorio");
      return;
    }

    if (!formData.name.trim()) {
      alert("El nombre de la empresa/proveedor es obligatorio");
      return;
    }

    setSaving(true);

    try {
      const contactNameNorm = normalizeText(formData.contactName);
      const nameNorm = normalizeText(formData.name);
      
      // Limpiar teléfono: solo números y el signo + al inicio si existe
      let cleanTel = formData.whatsapp.trim();
      const hasPlus = cleanTel.startsWith('+');
      cleanTel = cleanTel.replace(/\D/g, '');
      if (hasPlus) cleanTel = '+' + cleanTel;
      
      // Convención México si tiene 10 dígitos y no tiene prefijo
      if (!hasPlus && cleanTel.length === 10) {
        cleanTel = '52' + cleanTel;
      }

      const providersRef = collection(db, "users", user.uid, "providers");
      const docRef = await addDoc(providersRef, {
        name: formData.name.trim(),
        name_norm: nameNorm,
        contact_name: formData.contactName.trim(),
        contact_name_norm: contactNameNorm,
        whatsapp: cleanTel,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      console.log("PROVIDER_CREATE", docRef.id);

      addNotification({
        title: 'Proveedor Guardado',
        message: `${formData.contactName} ha sido agregado al directorio ✅`,
        type: 'system'
      });

      navigate('/directorio');
    } catch (err: any) {
      console.error("Error creating provider:", err);
      alert("Error al guardar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative flex h-full min-h-screen w-full flex-col overflow-x-hidden max-w-md mx-auto shadow-2xl bg-background-light dark:bg-background-dark pb-32 font-display">
      <header className="pt-12 px-6 pb-6 flex items-center gap-4 sticky top-0 z-30 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md border-b dark:border-white/5">
        <button 
          onClick={() => navigate(-1)} 
          className="size-10 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-700 dark:text-white active:scale-90 transition-transform"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-white uppercase truncate flex-1">Nuevo Contacto</h1>
      </header>

      <main className="px-6 py-8 space-y-6 animate-in fade-in duration-500">
        <div className="space-y-6 pt-2">
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nombre de la Persona</label>
            <input 
              type="text"
              value={formData.contactName}
              onChange={(e) => setFormData({...formData, contactName: e.target.value})}
              placeholder="Ej: Juan Pérez"
              className="w-full bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/5 rounded-2xl py-4 px-6 text-sm font-bold outline-none focus:ring-2 focus:ring-primary shadow-sm dark:text-white"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Empresa / Proveedor</label>
            <input 
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              placeholder="Ej: Bimbo, Coca-Cola..."
              className="w-full bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/5 rounded-2xl py-4 px-6 text-sm font-bold outline-none focus:ring-2 focus:ring-primary shadow-sm dark:text-white"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">WhatsApp / Teléfono</label>
            <div className="relative">
              <input 
                type="tel"
                value={formData.whatsapp}
                onChange={(e) => setFormData({...formData, whatsapp: e.target.value})}
                placeholder="Ej: 55 1234 5678"
                className="w-full bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/5 rounded-2xl py-4 px-6 pl-12 text-sm font-bold outline-none focus:ring-2 focus:ring-primary shadow-sm dark:text-white"
              />
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500">chat</span>
            </div>
          </div>
        </div>

        <div className="pt-10">
          <button 
            onClick={handleSave}
            disabled={saving || !formData.contactName.trim() || !formData.name.trim()}
            className="w-full py-5 bg-primary hover:bg-primary-dark text-white font-black rounded-3xl shadow-xl shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {saving ? <span className="material-symbols-outlined animate-spin">sync</span> : <span className="material-symbols-outlined">save</span>}
            GUARDAR EN DIRECTORIO
          </button>
        </div>
      </main>

      <BottomNav />
    </div>
  );
};

export default AddProviderScreen;
