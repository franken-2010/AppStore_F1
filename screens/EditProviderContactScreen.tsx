
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { doc, getDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import BottomNav from '../components/BottomNav';
import { useNotifications } from '../context/NotificationContext';

const EditProviderContactScreen: React.FC = () => {
  const { providerId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    contactName: '',
    whatsapp: ''
  });

  useEffect(() => {
    if (!user || !providerId) return;

    const fetchProvider = async () => {
      try {
        const snap = await getDoc(doc(db, "users", user.uid, "providers", providerId));
        if (snap.exists()) {
          const data = snap.data();
          setFormData({
            name: data.name ?? "",
            contactName: data.contact_name ?? data.contactName ?? "",
            whatsapp: data.whatsapp ?? ""
          });
        } else {
          setError("Proveedor no encontrado");
        }
      } catch (err) {
        console.error("Error fetching provider:", err);
        setError("Error al cargar datos");
      } finally {
        setLoading(false);
      }
    };

    fetchProvider();
  }, [user, providerId]);

  const handleSave = async () => {
    if (!user || !providerId) return;
    
    if (!formData.contactName.trim()) {
      alert("El nombre del contacto es obligatorio");
      return;
    }

    if (formData.whatsapp.trim().length > 0 && formData.whatsapp.trim().length < 8) {
      alert("El número de WhatsApp debe ser válido");
      return;
    }

    setSaving(true);

    try {
      const docRef = doc(db, "users", user.uid, "providers", providerId);
      await updateDoc(docRef, {
        contact_name: formData.contactName.trim(),
        whatsapp: formData.whatsapp.trim(),
        updatedAt: serverTimestamp()
      });

      addNotification({
        title: 'Contacto actualizado',
        message: `Los datos de ${formData.contactName} han sido guardados ✅`,
        type: 'system'
      });

      // Usamos replace: true para que esta pantalla de edición desaparezca del historial
      navigate(`/directorio/${providerId}`, { replace: true });
    } catch (err: any) {
      console.error("Error updating provider:", err);
      alert("Error al guardar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background-dark flex items-center justify-center">
        <span className="material-symbols-outlined animate-spin text-primary text-4xl">sync</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background-dark flex flex-col items-center justify-center p-6 text-center">
        <span className="material-symbols-outlined text-6xl text-red-500 mb-4">error</span>
        <h2 className="text-xl font-black text-white">{error}</h2>
        <button onClick={() => navigate('/directorio')} className="mt-6 px-10 py-4 bg-primary text-white font-black rounded-2xl">Volver al Directorio</button>
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-screen w-full flex-col overflow-x-hidden max-w-md mx-auto shadow-2xl bg-background-light dark:bg-background-dark pb-32 font-display">
      <header className="pt-12 px-6 pb-6 flex items-center gap-4 sticky top-0 z-30 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md border-b dark:border-white/5">
        <button 
          onClick={() => navigate(-1)} 
          className="size-10 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-700 dark:text-white active:scale-90 transition-transform"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-white uppercase truncate flex-1">Editar Contacto</h1>
      </header>

      <main className="px-6 py-8 space-y-6 animate-in fade-in duration-500">
        <div className="p-6 bg-primary/10 rounded-[2rem] border border-primary/20">
          <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Empresa</p>
          <p className="text-lg font-black text-slate-900 dark:text-white uppercase leading-tight">{formData.name || 'Sin empresa'}</p>
        </div>

        <div className="space-y-5">
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nombre del contacto</label>
            <input 
              type="text"
              value={formData.contactName}
              onChange={(e) => setFormData({...formData, contactName: e.target.value})}
              placeholder="Nombre de la persona..."
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
                placeholder="Ej: +52 999 123 4567"
                className="w-full bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/5 rounded-2xl py-4 px-6 pl-12 text-sm font-bold outline-none focus:ring-2 focus:ring-primary shadow-sm dark:text-white"
              />
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500">chat</span>
            </div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter px-1">
              Guarda el número con lada. Se normalizará automáticamente para WhatsApp.
            </p>
          </div>
        </div>

        <div className="pt-10">
          <button 
            onClick={handleSave}
            disabled={saving || !formData.contactName.trim()}
            className="w-full py-5 bg-primary hover:bg-primary-dark text-white font-black rounded-3xl shadow-xl shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {saving ? <span className="material-symbols-outlined animate-spin">sync</span> : <span className="material-symbols-outlined">save</span>}
            GUARDAR CAMBIOS
          </button>
        </div>
      </main>

      <BottomNav />
    </div>
  );
};

export default EditProviderContactScreen;
