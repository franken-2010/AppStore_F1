
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
    supplierName: '',
    contactName: '',
    whatsappPhone: ''
  });

  useEffect(() => {
    if (!user || !providerId) return;

    const fetchProvider = async () => {
      try {
        const snap = await getDoc(doc(db, "suppliers_directory", providerId));
        if (snap.exists()) {
          const data = snap.data();
          setFormData({
            supplierName: data.supplierName || "",
            contactName: data.contactName || "",
            whatsappPhone: data.whatsappPhone || ""
          });
        } else {
          setError("Proveedor no encontrado");
        }
      } catch (err) {
        console.error(err);
        setError("Error al cargar datos");
      } finally {
        setLoading(false);
      }
    };

    fetchProvider();
  }, [user, providerId]);

  const handleSave = async () => {
    if (!user || !providerId) return;
    
    if (!formData.contactName.trim() || !formData.supplierName.trim()) {
      alert("Nombre de contacto y empresa son obligatorios.");
      return;
    }

    setSaving(true);

    try {
      const docRef = doc(db, "suppliers_directory", providerId);
      
      // Normalización rápida en edición
      let cleanDigits = formData.whatsappPhone.replace(/\D/g, '');
      let finalPhone = cleanDigits;
      if (cleanDigits.length === 10) finalPhone = '521' + cleanDigits;

      await updateDoc(docRef, {
        contactName: formData.contactName.trim(),
        supplierName: formData.supplierName.trim(),
        whatsappPhone: finalPhone,
        updatedAt: serverTimestamp()
      });

      addNotification({
        title: 'Contacto actualizado',
        message: `Los datos de ${formData.contactName} han sido sincronizados ✅`,
        type: 'system'
      });

      navigate(`/directorio/${providerId}`, { replace: true });
    } catch (err: any) {
      console.error("Error updating provider:", err);
      alert("Error al guardar.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-background-dark flex items-center justify-center"><span className="material-symbols-outlined animate-spin text-primary text-4xl">sync</span></div>;

  return (
    <div className="relative flex h-full min-h-screen w-full flex-col overflow-x-hidden max-w-md mx-auto shadow-2xl bg-background-light dark:bg-background-dark pb-32 font-display">
      <header className="pt-12 px-6 pb-6 flex items-center gap-4 sticky top-0 z-30 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md border-b dark:border-white/5">
        <button onClick={() => navigate(-1)} className="size-10 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-700 dark:text-white shrink-0">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-white uppercase truncate flex-1">Editar Contacto</h1>
      </header>

      <main className="px-6 py-8 space-y-6 animate-in fade-in duration-500">
        <div className="space-y-5">
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Persona</label>
            <input 
              type="text"
              value={formData.contactName}
              onChange={(e) => setFormData({...formData, contactName: e.target.value})}
              className="w-full bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/5 rounded-2xl py-4 px-6 text-sm font-bold outline-none focus:ring-2 focus:ring-primary dark:text-white"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Empresa</label>
            <input 
              type="text"
              value={formData.supplierName}
              onChange={(e) => setFormData({...formData, supplierName: e.target.value})}
              className="w-full bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/5 rounded-2xl py-4 px-6 text-sm font-bold outline-none focus:ring-2 focus:ring-primary dark:text-white"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">WhatsApp</label>
            <input 
              type="tel"
              value={formData.whatsappPhone}
              onChange={(e) => setFormData({...formData, whatsappPhone: e.target.value})}
              className="w-full bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/5 rounded-2xl py-4 px-6 text-sm font-bold outline-none focus:ring-2 focus:ring-primary dark:text-white"
            />
          </div>
        </div>

        <div className="pt-10">
          <button 
            onClick={handleSave}
            disabled={saving}
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
