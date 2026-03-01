
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
    name: '',        // Empresa/Proveedor
    contactName: '', // Persona de contacto
    whatsapp: ''
  });

  const normalizeText = (text: string): string => {
    if (!text) return "";
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/ñ/g, "n")
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const handleSave = async () => {
    if (!user) return;
    
    if (!formData.contactName.trim() || !formData.name.trim()) {
      alert("Nombre de contacto y empresa son obligatorios.");
      return;
    }

    setSaving(true);

    try {
      const searchName = normalizeText(formData.name);
      
      // Normalización de Teléfono (Regla F1: 521 + 10 dígitos)
      let cleanDigits = formData.whatsapp.replace(/\D/g, '');
      let whatsappPhone = cleanDigits;
      
      if (cleanDigits.length === 10) {
        whatsappPhone = '521' + cleanDigits;
      } else if (whatsappPhone.length > 0 && !whatsappPhone.startsWith('521')) {
        // Si ya tiene algún formato pero no el ideal, intentamos corregir
        if (whatsappPhone.startsWith('52') && whatsappPhone.length === 12) {
          whatsappPhone = '521' + whatsappPhone.substring(2);
        }
      }

      const directoryRef = collection(db, "suppliers_directory");
      await addDoc(directoryRef, {
        uid: user.uid,
        contactName: formData.contactName.trim(),
        supplierName: formData.name.trim(),
        whatsappPhone: whatsappPhone,
        phoneRaw: formData.whatsapp.trim(),
        searchName: searchName,
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      addNotification({
        title: 'Proveedor Guardado',
        message: `${formData.contactName} (${formData.name}) añadido al directorio ✅`,
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
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Empresa / Distribuidora</label>
            <input 
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              placeholder="Ej: Sabritas, Coca-Cola, Local..."
              className="w-full bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/5 rounded-2xl py-4 px-6 text-sm font-bold outline-none focus:ring-2 focus:ring-primary shadow-sm dark:text-white"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">WhatsApp (10 dígitos)</label>
            <div className="relative">
              <input 
                type="tel"
                value={formData.whatsapp}
                onChange={(e) => setFormData({...formData, whatsapp: e.target.value})}
                placeholder="999 123 4567"
                className="w-full bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/5 rounded-2xl py-4 px-6 pl-12 text-sm font-bold outline-none focus:ring-2 focus:ring-primary shadow-sm dark:text-white"
              />
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500">chat</span>
            </div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter px-1">
              Se guardará automáticamente con prefijo México (521).
            </p>
          </div>
        </div>

        <div className="pt-10">
          <button 
            onClick={handleSave}
            disabled={saving}
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
