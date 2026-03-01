
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import BottomNav from '../components/BottomNav';

interface Provider {
  supplierName: string;
  contactName: string;
  whatsappPhone: string;
}

const ProviderDetailScreen: React.FC = () => {
  const { providerId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [provider, setProvider] = useState<Provider | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !providerId) return;

    const fetchProvider = async () => {
      try {
        const snap = await getDoc(doc(db, "suppliers_directory", providerId));
        if (snap.exists()) {
          setProvider(snap.data() as Provider);
        }
      } catch (err) {
        console.error("Error fetching provider:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProvider();
  }, [user, providerId]);

  const handleWhatsApp = () => {
    if (!provider?.whatsappPhone) return;
    const digits = provider.whatsappPhone.replace(/\D/g, '');
    const message = encodeURIComponent(`Hola ${provider.contactName.split(' ')[0]}, te escribo de Miscelánea F1.`);
    const url = `https://wa.me/${digits}?text=${message}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background-dark flex items-center justify-center">
        <span className="material-symbols-outlined animate-spin text-primary text-4xl">sync</span>
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="min-h-screen bg-background-dark flex flex-col items-center justify-center p-6 text-center">
        <span className="material-symbols-outlined text-6xl text-slate-700 mb-4">person_off</span>
        <h2 className="text-xl font-black text-white mb-2">Contacto no encontrado</h2>
        <button onClick={() => navigate('/directorio')} className="px-8 py-3 bg-primary text-white font-black rounded-2xl">Volver al Directorio</button>
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-screen w-full flex-col overflow-x-hidden max-w-md mx-auto shadow-2xl bg-background-light dark:bg-background-dark pb-32 font-display">
      <header className="pt-12 px-6 pb-6 flex items-center justify-between sticky top-0 z-30 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md">
        <div className="flex items-center gap-4 flex-1 truncate">
          <button 
            onClick={() => navigate('/directorio')} 
            className="size-10 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-700 dark:text-white shrink-0"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-white uppercase truncate">
            {provider.contactName}
          </h1>
        </div>
        
        <button 
          onClick={() => navigate(`/directorio/edit/${providerId}`)}
          className="size-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0"
        >
          <span className="material-symbols-outlined text-xl">edit</span>
        </button>
      </header>

      <main className="px-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="bg-white dark:bg-surface-dark p-8 rounded-[3rem] shadow-xl border border-slate-100 dark:border-white/5 relative overflow-hidden text-center">
          <div className="size-24 rounded-[2rem] bg-primary/10 text-primary flex items-center justify-center mx-auto mb-6">
            <span className="material-symbols-outlined text-5xl">person</span>
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase leading-tight mb-2">
            {provider.contactName}
          </h2>
          <div className="flex items-center justify-center gap-2 text-primary">
            <span className="material-symbols-outlined text-sm">store</span>
            <p className="text-xs font-black uppercase tracking-widest">{provider.supplierName}</p>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 px-2">Información Guardada</h3>
          
          <div className="bg-white dark:bg-surface-dark rounded-3xl border border-slate-100 dark:border-white/5 divide-y dark:divide-white/5">
            <div className="p-5 flex items-center gap-4">
              <div className="size-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <span className="material-symbols-outlined">chat</span>
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">WhatsApp F1</p>
                <p className="text-sm font-bold text-slate-900 dark:text-white">{provider.whatsappPhone || 'No registrado'}</p>
              </div>
            </div>
            
            <div className="p-5 flex items-center gap-4">
              <div className="size-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                <span className="material-symbols-outlined">store</span>
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Empresa</p>
                <p className="text-sm font-bold text-slate-900 dark:text-white">{provider.supplierName}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-4">
          <button 
            onClick={handleWhatsApp}
            disabled={!provider.whatsappPhone}
            className="w-full py-5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-30 disabled:grayscale text-white font-black rounded-3xl shadow-xl shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-3"
          >
            <span className="material-symbols-outlined text-2xl">send</span>
            ESCRIBIR POR WHATSAPP
          </button>
        </div>
      </main>

      <BottomNav />
    </div>
  );
};

export default ProviderDetailScreen;
