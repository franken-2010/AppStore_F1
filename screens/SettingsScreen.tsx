
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
  
  const [name, setName] = useState('');
  const [photoURL, setPhotoURL] = useState('');
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
  const [isBiometricLinked, setIsBiometricLinked] = useState(!!localStorage.getItem('biometric_credential'));
  
  const isIframe = window.self !== window.top;
  const isSecure = window.isSecureContext;

  const [showInstallBtn, setShowInstallBtn] = useState(!!(window as any).deferredPrompt);
  const isPWA = (window as any).isPWA;

  useEffect(() => {
    if (profile) {
      setName(profile.displayName || '');
      setPhotoURL(profile.photoURL || '');
      setWebhookPriceUpdate(profile.webhookPriceUpdate || '');
      setWebhookAddProduct(profile.webhookAddProduct || '');
      setWebhookCortes(profile.webhookCortes || '');
      setWebhookNotifications(profile.webhookNotifications || '');
    }

    const handlePwaInstallable = () => setShowInstallBtn(true);
    window.addEventListener('pwa-installable', handlePwaInstallable);
    
    return () => window.removeEventListener('pwa-installable', handlePwaInstallable);
  }, [profile]);

  const handleLinkBiometrics = async () => {
    if (!user || !user.email) return;
    
    if (isIframe) {
      alert("⚠️ La biometría está bloqueada porque la app se ejecuta en un marco (iframe). Por favor, abre la app directamente en una pestaña nueva o instálala como PWA.");
      return;
    }

    if (!isSecure) {
      alert("❌ La biometría requiere una conexión segura (HTTPS).");
      return;
    }

    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: "Miscelánea F1 Intelligence" }, // Se eliminó ID explícito para mayor compatibilidad
          user: {
            id: new TextEncoder().encode(user.uid),
            name: user.email,
            displayName: user.displayName || user.email
          },
          pubKeyCredParams: [{ alg: -7, type: "public-key" }, { alg: -257, type: "public-key" }],
          timeout: 60000,
          authenticatorSelection: { userVerification: "required" }
        }
      });

      if (credential) {
        const credId = btoa(String.fromCharCode(...new Uint8Array((credential as any).rawId)));
        localStorage.setItem('biometric_credential', credId);
        localStorage.setItem('biometric_email', user.email);
        // Guardar password temporalmente para el login silencioso si es necesario
        // Nota: En un entorno real, esto se manejaría con tokens firmados en el servidor.
        setIsBiometricLinked(true);
        addNotification({ title: 'Biometría Vinculada', message: 'Ahora puedes entrar con tu huella.', type: 'system' });
      }
    } catch (err: any) {
      console.error("Link biometric error:", err);
      if (err.name === 'SecurityError' || err.message.includes('Permissions Policy')) {
        alert("🔒 Error de Seguridad: El navegador bloquea el acceso a la huella digital en este entorno. Intenta abrir la app en una pestaña nueva del navegador.");
      } else if (err.name === 'NotAllowedError') {
        alert("Operación cancelada o permiso denegado por el usuario.");
      } else {
        alert("No se pudo vincular la biometría: " + err.message);
      }
    }
  };

  const handleInstallApp = async () => {
    const prompt = (window as any).deferredPrompt;
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') {
      (window as any).deferredPrompt = null;
      setShowInstallBtn(false);
    }
  };

  const systemWebhookURL = user ? `https://ntfy.sh/dataflow_admin_${user.uid}` : 'Cargando...';

  const handleCopyWebhook = () => {
    if (systemWebhookURL.startsWith('http')) {
      navigator.clipboard.writeText(systemWebhookURL);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    }
  };

  const generateIAImage = async () => {
    setIsGeneratingIA(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `A professional 3D avatar of a retail store manager, wearing a polo shirt with a small 'F1' logo, modern business style, high quality, rounded profile, clean lighting.`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: prompt }] },
      });

      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const imageUrl = `data:image/png;base64,${part.inlineData.data}`;
          setPhotoURL(imageUrl);
          if (user) {
            await updateDoc(doc(db, "users", user.uid), { photoURL: imageUrl });
            addNotification({ title: 'Perfil Actualizado', message: 'Tu nueva imagen generada por IA ha sido guardada.', type: 'system' });
          }
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
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        setPhotoURL(base64);
        if (user) {
          await updateDoc(doc(db, "users", user.uid), { photoURL: base64 });
        }
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
      if (newPassword) await updatePassword(user, newPassword);
      
      await updateDoc(doc(db, "users", user.uid), { 
        displayName: name, 
        photoURL: photoURL 
      });
      
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
      setNewPassword('');
    } catch (err) {
      alert("Error al actualizar el perfil");
    } finally {
      setSaveStatus('idle');
    }
  };

  const handleSaveWebhooks = async () => {
    if (!user) return;
    setSaveStatus('saving');
    try {
      await updateDoc(doc(db, "users", user.uid), {
        webhookPriceUpdate,
        webhookAddProduct,
        webhookCortes,
        webhookNotifications
      });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      alert("Error al guardar webhooks en Firebase");
    } finally {
      setSaveStatus('idle');
    }
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
            className={`shrink-0 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'bg-slate-200 dark:bg-surface-dark text-slate-500'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      <main className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
        {activeTab === 'perfil' && (
          <section className="space-y-6 pb-12 animate-in fade-in">
            <div className="flex flex-col items-center gap-6 mb-4">
              <div className="relative group">
                <div className="size-28 rounded-[2rem] border-4 border-primary bg-cover bg-center overflow-hidden shadow-2xl transition-transform group-hover:scale-105 bg-slate-200 dark:bg-slate-800" style={{backgroundImage: photoURL ? `url('${photoURL}')` : 'none'}}>
                  {isGeneratingIA && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                      <span className="material-symbols-outlined animate-spin text-white text-3xl">sync</span>
                    </div>
                  )}
                  {!photoURL && !isGeneratingIA && (
                     <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                       <span className="material-symbols-outlined text-4xl">person</span>
                     </div>
                  )}
                </div>
                <div className="absolute -bottom-2 -right-2 flex gap-1">
                  <button onClick={() => fileInputRef.current?.click()} className="size-10 bg-white dark:bg-surface-dark text-primary rounded-2xl flex items-center justify-center border-2 border-primary shadow-lg hover:scale-110 transition-all">
                    <span className="material-symbols-outlined text-lg">add_a_photo</span>
                  </button>
                  <button onClick={generateIAImage} disabled={isGeneratingIA} className="size-10 bg-primary text-white rounded-2xl flex items-center justify-center border-2 border-primary shadow-lg hover:scale-110 transition-all disabled:opacity-50">
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

            <div className="p-5 rounded-3xl bg-white dark:bg-surface-dark border border-slate-100 dark:border-white/5 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className={`size-10 rounded-xl flex items-center justify-center ${isIframe ? 'bg-amber-500/10 text-amber-500' : 'bg-primary/10 text-primary'}`}>
                  <span className="material-symbols-outlined">{isIframe ? 'block' : 'fingerprint'}</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-black">Acceso Biométrico</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{isIframe ? 'Bloqueado por Marco' : 'Seguridad F1'}</p>
                </div>
              </div>
              
              {isIframe ? (
                <p className="text-[10px] font-bold text-amber-600 bg-amber-50 p-3 rounded-xl border border-amber-100">
                  ⚠️ Detectado entorno de marco (iframe). La biometría no funcionará aquí. Abre la URL en una pestaña nueva o instala la PWA.
                </p>
              ) : isBiometricLinked ? (
                <div className="flex items-center gap-2 p-3 bg-emerald-500/5 text-emerald-500 rounded-2xl border border-emerald-500/10">
                  <span className="material-symbols-outlined text-lg">verified</span>
                  <p className="text-xs font-bold uppercase tracking-wider">Dispositivo Vinculado</p>
                </div>
              ) : (
                <button 
                  onClick={handleLinkBiometrics} 
                  className="w-full py-3.5 bg-slate-50 dark:bg-white/5 text-primary font-black rounded-2xl border-2 border-dashed border-primary/30 active:scale-95 transition-all text-xs uppercase tracking-widest"
                >
                  Activar Huella Digital
                </button>
              )}
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
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nombre de Administrador</label>
                <div className="relative">
                  <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark py-4 px-4 pr-12 text-base font-bold outline-none focus:ring-2 focus:ring-primary shadow-sm" />
                  <VoiceInputButton onResult={setName} className="absolute right-2 top-1/2 -translate-y-1/2" />
                </div>
              </div>
            </div>

            <button onClick={() => signOut(auth).then(() => navigate('/'))} className="w-full py-4 text-red-500 font-black flex items-center justify-center gap-2 hover:bg-red-500/5 rounded-2xl transition-colors mt-8">
              <span className="material-symbols-outlined">logout</span> Cerrar Sesión F1
            </button>
          </section>
        )}

        {activeTab === 'webhooks' && (
          <section className="space-y-8 animate-in fade-in pb-12">
            <div className="bg-primary/5 dark:bg-primary/10 border border-primary/20 p-5 rounded-3xl relative overflow-hidden">
               <div className="flex items-center gap-2 mb-4">
                 <span className="text-[10px] font-black bg-primary text-white px-2 py-0.5 rounded-full uppercase tracking-widest">Push BDD</span>
                 <h3 className="text-sm font-black text-slate-900 dark:text-white">Endpoint de Entrada</h3>
               </div>
               <div className="space-y-3">
                 <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                   Usa este enlace en <strong>ntfy.sh</strong> para recibir actualizaciones en tiempo real.
                 </p>
                 <div className="flex items-center gap-2">
                   <input readOnly value={systemWebhookURL} className="flex-1 bg-white/50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-xl py-3 px-4 text-[10px] font-mono text-primary outline-none" />
                   <button onClick={handleCopyWebhook} className="size-11 bg-primary text-white rounded-xl flex items-center justify-center shadow-lg active:scale-90 transition-all relative">
                     <span className="material-symbols-outlined text-lg">{copyFeedback ? 'check' : 'content_copy'}</span>
                   </button>
                 </div>
               </div>
            </div>

            <div className="space-y-6">
              {[
                  { label: 'Actualizar Precios', val: webhookPriceUpdate, set: setWebhookPriceUpdate },
                  { label: 'Alta de Productos', val: webhookAddProduct, set: setWebhookAddProduct },
                  { label: 'Cortes de Caja', val: webhookCortes, set: setWebhookCortes },
                  { label: 'Notificaciones Poll', val: webhookNotifications, set: setWebhookNotifications }
                ].map((item) => (
                  <div key={item.label} className="flex flex-col gap-2 group">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 group-focus-within:text-primary transition-colors">{item.label}</label>
                    <input value={item.val} onChange={(e) => item.set(e.target.value)} className="w-full rounded-xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark py-4 px-4 text-xs font-mono focus:ring-2 focus:ring-primary outline-none transition-all shadow-sm" placeholder="https://hook.make.com/..." />
                  </div>
                ))}
            </div>
          </section>
        )}
      </main>

      <div className="fixed bottom-[88px] left-0 right-0 px-6 max-w-md mx-auto z-40">
        <button onClick={activeTab === 'perfil' ? handleSaveProfile : handleSaveWebhooks} disabled={saveStatus === 'saving'} className={`w-full py-4 rounded-xl text-white font-black shadow-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${saveStatus === 'saved' ? 'bg-emerald-500' : 'bg-primary shadow-primary/30'}`}>
          <span className="material-symbols-outlined animate-in zoom-in">{saveStatus === 'saving' ? 'sync' : saveStatus === 'saved' ? 'verified' : 'save_as'}</span>
          <span>{saveStatus === 'saved' ? '¡Éxito!' : saveStatus === 'saving' ? 'Guardando...' : 'Sincronizar con Firebase'}</span>
        </button>
      </div>
      <BottomNav />
    </div>
  );
};

export default SettingsScreen;
