
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { auth, db } from '../services/firebase';
import { updatePassword, updateProfile, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { APP_VERSION } from '../constants';
import VoiceInputButton from '../components/VoiceInputButton';
import { GoogleGenAI } from "@google/genai";

const SettingsScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { addNotification } = useNotifications();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [name, setName] = useState(profile?.displayName || '');
  const [photoURL, setPhotoURL] = useState(profile?.photoURL || '');
  const [newPassword, setNewPassword] = useState('');
  
  const [webhookPriceUpdate, setWebhookPriceUpdate] = useState('');
  const [webhookAddProduct, setWebhookAddProduct] = useState('');
  const [webhookCortes, setWebhookCortes] = useState('');
  const [webhookNotifications, setWebhookNotifications] = useState('');
  
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [activeTab, setActiveTab] = useState<'perfil' | 'webhooks' | 'bdd'>('perfil');
  const [isDark, setIsDark] = useState(document.documentElement.classList.contains('dark'));
  const [isGeneratingIA, setIsGeneratingIA] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);

  // URL del Webhook Interno de Sistema
  const systemWebhookURL = `https://dataflow-api.io/hooks/v1/notify/${user?.uid || 'loading...'}`;

  useEffect(() => {
    if (profile) {
      setName(profile.displayName);
      setPhotoURL(profile.photoURL);
    }
    setWebhookPriceUpdate(localStorage.getItem('webhook_price_update') || '');
    setWebhookAddProduct(localStorage.getItem('webhook_add_product') || '');
    setWebhookCortes(localStorage.getItem('webhook_cortes') || '');
    setWebhookNotifications(localStorage.getItem('webhook_notifications') || '');
  }, [profile]);

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(systemWebhookURL);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const generateIAImage = async () => {
    setIsGeneratingIA(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `A modern, minimalist, high-quality 3D avatar of a business administrator person, professional style, rounded corners, vibrant primary blue and deep slate colors, soft lighting, profile view, tech dashboard theme background.`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: prompt }] },
      });

      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const imageUrl = `data:image/png;base64,${part.inlineData.data}`;
          setPhotoURL(imageUrl);
          break;
        }
      }
    } catch (err) {
      console.error("Error generating image:", err);
      alert("No se pudo generar la imagen con IA.");
    } finally {
      setIsGeneratingIA(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoURL(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleTheme = () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    document.documentElement.classList.toggle('dark', newIsDark);
    localStorage.setItem('theme', newIsDark ? 'dark' : 'light');
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaveStatus('saving');
    try {
      await updateProfile(user, { displayName: name, photoURL: photoURL });
      if (newPassword) await updatePassword(user, newPassword);
      await updateDoc(doc(db, "users", user.uid), { displayName: name, photoURL: photoURL });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
      setNewPassword('');
    } catch (err) {
      alert("Error al actualizar el perfil");
    } finally {
      setSaveStatus('idle');
    }
  };

  const handleSaveWebhooks = () => {
    setSaveStatus('saving');
    localStorage.setItem('webhook_price_update', webhookPriceUpdate);
    localStorage.setItem('webhook_add_product', webhookAddProduct);
    localStorage.setItem('webhook_cortes', webhookCortes);
    localStorage.setItem('webhook_notifications', webhookNotifications);
    setTimeout(() => {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 800);
  };

  return (
    <div className="relative flex flex-col h-screen w-full max-w-md mx-auto bg-background-light dark:bg-background-dark shadow-2xl overflow-hidden pb-32 font-display">
      <header className="flex items-center justify-between p-4 pb-2 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md shrink-0 z-30 pt-12">
        <button onClick={() => navigate(-1)} className="flex items-center justify-center size-10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-slate-900 dark:text-white">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-lg font-bold flex-1 text-center pr-10">Configuración</h1>
      </header>

      <div className="px-6 py-4 flex gap-2 overflow-x-auto no-scrollbar">
        {['perfil', 'webhooks', 'bdd'].map(tab => (
          <button 
            key={tab}
            onClick={() => tab === 'bdd' ? navigate('/settings/bdd') : setActiveTab(tab as any)}
            className={`shrink-0 px-6 py-3 rounded-2xl text-sm font-bold transition-all uppercase tracking-widest ${activeTab === tab ? 'bg-primary text-white shadow-lg' : 'bg-slate-200 dark:bg-surface-dark text-slate-500'}`}
          >
            {tab === 'bdd' ? 'BDD' : tab}
          </button>
        ))}
      </div>

      <main className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
        {activeTab === 'perfil' && (
          <section className="space-y-6">
            <div className="flex flex-col items-center gap-6 mb-4">
              <div className="relative group">
                <div className="size-28 rounded-[2rem] border-4 border-primary bg-cover bg-center overflow-hidden shadow-2xl transition-transform group-hover:scale-105" style={{backgroundImage: `url('${photoURL}')`}}>
                  {isGeneratingIA && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                      <span className="material-symbols-outlined animate-spin text-white text-3xl">sync</span>
                    </div>
                  )}
                </div>
                <div className="absolute -bottom-2 -right-2 flex gap-1">
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="size-10 bg-white dark:bg-surface-dark text-primary rounded-2xl flex items-center justify-center border-2 border-primary shadow-lg hover:scale-110 transition-all"
                  >
                    <span className="material-symbols-outlined text-lg">add_a_photo</span>
                  </button>
                  <button 
                    onClick={generateIAImage}
                    disabled={isGeneratingIA}
                    className="size-10 bg-primary text-white rounded-2xl flex items-center justify-center border-2 border-primary shadow-lg hover:scale-110 transition-all disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-lg">auto_awesome</span>
                  </button>
                </div>
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
              </div>
              
              <div className="text-center">
                <p className="font-black text-xl text-slate-900 dark:text-white">{profile?.displayName}</p>
                <p className="text-xs font-bold text-slate-500">{profile?.email}</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-100 dark:bg-surface-dark flex items-center justify-between border border-slate-200 dark:border-white/5">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${isDark ? 'bg-amber-400/20 text-amber-400' : 'bg-blue-500/10 text-blue-500'}`}>
                  <span className="material-symbols-outlined">{isDark ? 'dark_mode' : 'light_mode'}</span>
                </div>
                <p className="text-sm font-bold">{isDark ? 'Modo Oscuro' : 'Modo Claro'}</p>
              </div>
              <button onClick={toggleTheme} className="relative w-14 h-8 bg-slate-300 dark:bg-primary rounded-full transition-all">
                <div className={`absolute top-1 left-1 size-6 bg-white rounded-full transition-all shadow-md flex items-center justify-center ${isDark ? 'translate-x-6' : ''}`}>
                  <span className="material-symbols-outlined text-[14px] text-slate-400">{isDark ? 'nightlight' : 'sunny'}</span>
                </div>
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nombre Completo</label>
                <div className="relative">
                  <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark py-4 px-4 pr-12 text-base font-bold outline-none focus:ring-2 focus:ring-primary" />
                  <VoiceInputButton onResult={setName} className="absolute right-2 top-1/2 -translate-y-1/2" />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">URL de Foto (Opcional)</label>
                <input value={photoURL} onChange={(e) => setPhotoURL(e.target.value)} className="w-full rounded-xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark py-4 px-4 text-base font-bold outline-none" placeholder="https://..." />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nueva Contraseña</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full rounded-xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark py-4 px-4 text-base font-bold outline-none" placeholder="Dejar en blanco para no cambiar" />
              </div>
            </div>

            <button onClick={() => signOut(auth).then(() => navigate('/'))} className="w-full py-4 text-red-500 font-black flex items-center justify-center gap-2 hover:bg-red-500/5 rounded-xl transition-colors">
              <span className="material-symbols-outlined">logout</span> Cerrar Sesión
            </button>
          </section>
        )}

        {activeTab === 'webhooks' && (
          <section className="space-y-8 animate-in fade-in slide-in-from-bottom-5">
            {/* WEBHOOK DE SISTEMA (Solo lectura) */}
            <div className="bg-primary/5 dark:bg-primary/10 border border-primary/20 p-5 rounded-3xl relative overflow-hidden">
               <div className="absolute top-0 right-0 p-3 opacity-10">
                 <span className="material-symbols-outlined text-5xl">hub</span>
               </div>
               <div className="flex items-center gap-2 mb-4">
                 <span className="text-[10px] font-black bg-primary text-white px-2 py-0.5 rounded-full uppercase tracking-widest">Sistema</span>
                 <h3 className="text-sm font-black text-slate-900 dark:text-white">Webhook Interno de Notificaciones</h3>
               </div>
               <div className="space-y-3">
                 <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                   Usa este enlace en Make para enviar notificaciones directas a tu app. Las peticiones deben ser POST con formato JSON.
                 </p>
                 <div className="flex items-center gap-2">
                   <input 
                    readOnly 
                    value={systemWebhookURL} 
                    className="flex-1 bg-white/50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-xl py-3 px-4 text-[10px] font-mono text-primary outline-none"
                   />
                   <button 
                    onClick={handleCopyWebhook}
                    className="size-11 bg-primary text-white rounded-xl flex items-center justify-center shadow-lg active:scale-90 transition-all relative"
                   >
                     {copyFeedback ? (
                       <span className="material-symbols-outlined text-lg animate-in zoom-in">check</span>
                     ) : (
                       <span className="material-symbols-outlined text-lg">content_copy</span>
                     )}
                     {copyFeedback && (
                        <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] py-1 px-2 rounded-lg whitespace-nowrap animate-in fade-in slide-in-from-bottom-2">¡Copiado!</span>
                     )}
                   </button>
                 </div>
               </div>
            </div>

            <div className="h-px bg-slate-100 dark:bg-white/5 mx-2"></div>

            {/* WEBHOOKS DE USUARIO (Modificables) */}
            <div className="space-y-6">
              <div className="px-1">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Configuración Externa</h3>
              </div>
              {[['Price Update', webhookPriceUpdate, setWebhookPriceUpdate], ['Add Product', webhookAddProduct, setWebhookAddProduct], ['Cortes', webhookCortes, setWebhookCortes], ['Notifications Poll', webhookNotifications, setWebhookNotifications]].map(([label, val, set]: any) => (
                <div key={label} className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{label}</label>
                  <input value={val} onChange={(e) => set(e.target.value)} className="w-full rounded-xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark py-4 px-4 text-xs font-mono focus:ring-2 focus:ring-primary outline-none transition-all" placeholder="https://hook.make.com/..." />
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <div className="fixed bottom-[88px] left-0 right-0 px-6 max-w-md mx-auto z-40">
        <button onClick={activeTab === 'perfil' ? handleSaveProfile : handleSaveWebhooks} disabled={saveStatus === 'saving'} className={`w-full py-4 rounded-xl text-white font-black shadow-lg flex items-center justify-center gap-2 transition-all ${saveStatus === 'saved' ? 'bg-emerald-500' : 'bg-primary'}`}>
          <span className="material-symbols-outlined">{saveStatus === 'saving' ? 'sync' : saveStatus === 'saved' ? 'check' : 'save'}</span>
          <span>{saveStatus === 'saved' ? '¡Guardado!' : 'Guardar Cambios'}</span>
        </button>
      </div>
      <BottomNav />
    </div>
  );
};

export default SettingsScreen;
