
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { auth, db } from '../services/firebase';
import { updatePassword, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
  doc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import VoiceInputButton from '../components/VoiceInputButton';
import { GoogleGenAI } from "@google/genai";
import MoneyInputWithCalculator from '../components/MoneyInputWithCalculator';

const SettingsScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { addNotification } = useNotifications();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [name, setName] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [newPassword, setNewPassword] = useState('');
  
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [activeTab, setActiveTab] = useState<'perfil' | 'inventarios' | 'bdd'>('perfil');
  const [isDark, setIsDark] = useState(document.documentElement.classList.contains('dark'));
  const [isGeneratingIA, setIsGeneratingIA] = useState(false);
  const [isBiometricLinked, setIsBiometricLinked] = useState(!!localStorage.getItem('biometric_credential'));
  
  // Inventory Config State
  const [invAccountDocId, setInvAccountDocId] = useState<string | null>(null);
  const [invMin, setInvMin] = useState<number | null>(null);
  const [invMax, setInvMax] = useState<number | null>(null);
  const [isSavingInv, setIsSavingInv] = useState(false);

  const isIframe = window.self !== window.top;
  const isSecure = window.isSecureContext;

  useEffect(() => {
    if (profile) {
      setName(profile.displayName || '');
      setPhotoURL(profile.photoURL || '');
    }
  }, [profile]);

  // Cargar configuración de inventarios al entrar a la pestaña
  useEffect(() => {
    if (activeTab === 'inventarios' && user) {
      const fetchInv = async () => {
        const q = query(collection(db, "users", user.uid, "accounts"), where("accountId", "==", "inventarios"));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const data = snap.docs[0].data();
          setInvAccountDocId(snap.docs[0].id);
          setInvMin(data.inventoryMin ?? null);
          setInvMax(data.inventoryMax ?? null);
        }
      };
      fetchInv();
    }
  }, [activeTab, user]);

  const handleSaveInventory = async () => {
    if (!user || !invAccountDocId) return;
    
    if (invMin !== null && invMax !== null && invMin > invMax) {
      alert("⚠️ Error: El inventario mínimo no puede ser mayor al máximo.");
      return;
    }

    setIsSavingInv(true);
    try {
      await updateDoc(doc(db, "users", user.uid, "accounts", invAccountDocId), {
        inventoryMin: invMin,
        inventoryMax: invMax,
        isContable: false, // Asegurar que sea no contable
        updatedAt: serverTimestamp()
      });
      addNotification({ title: 'Rango Guardado', message: 'Límites de inventario actualizados.', type: 'system' });
      alert("✅ Configuración de inventarios guardada.");
    } catch (e) {
      console.error(e);
      alert("Error al guardar.");
    } finally {
      setIsSavingInv(false);
    }
  };

  const handleClearInventory = async () => {
    if (!user || !invAccountDocId) return;
    if (!window.confirm("¿Limpiar rangos de inventario?")) return;
    
    setIsSavingInv(true);
    try {
      await updateDoc(doc(db, "users", user.uid, "accounts", invAccountDocId), {
        inventoryMin: null,
        inventoryMax: null,
        updatedAt: serverTimestamp()
      });
      setInvMin(null);
      setInvMax(null);
      alert("✅ Rangos eliminados.");
    } catch (e) {
      console.error(e);
    } finally {
      setIsSavingInv(false);
    }
  };

  const handleLinkBiometrics = async () => {
    if (!user || !user.email) return;
    if (isIframe) { alert("⚠️ Biometría bloqueada en marcos."); return; }
    if (!isSecure) { alert("❌ Requiere HTTPS."); return; }

    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: "Miscelánea F1 Intelligence" },
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
        setIsBiometricLinked(true);
        addNotification({ title: 'Biometría Vinculada', message: 'Ahora puedes entrar con tu huella.', type: 'system' });
      }
    } catch (err) { console.error(err); }
  };

  const generateIAImage = async () => {
    setIsGeneratingIA(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `A professional 3D avatar of a retail store manager, wearing a polo shirt with a small 'F1' logo, modern business style, rounded profile, clean lighting.`;
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: prompt }] },
      });
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const imageUrl = `data:image/png;base64,${part.inlineData.data}`;
          setPhotoURL(imageUrl);
          if (user) await updateDoc(doc(db, "users", user.uid), { photoURL: imageUrl });
          break;
        }
      }
    } catch (err) { console.error(err); } finally { setIsGeneratingIA(false); }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        setPhotoURL(base64);
        if (user) await updateDoc(doc(db, "users", user.uid), { photoURL: base64 });
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
      await updateDoc(doc(db, "users", user.uid), { displayName: name, photoURL: photoURL });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) { alert("Error al actualizar"); } finally { setSaveStatus('idle'); }
  };

  return (
    <div className="relative flex flex-col h-screen w-full max-w-md mx-auto bg-background-light dark:bg-background-dark shadow-2xl overflow-hidden pb-32 font-display">
      <header className="flex items-center justify-between p-4 pb-2 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md shrink-0 z-30 pt-12">
        <button onClick={() => navigate('/dashboard')} className="flex items-center justify-center size-10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-slate-900 dark:text-white">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-lg font-bold flex-1 text-center pr-10">Configuración</h1>
      </header>

      <div className="px-6 py-4 flex gap-2 overflow-x-auto no-scrollbar">
        <button onClick={() => setActiveTab('perfil')} className={`shrink-0 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'perfil' ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'bg-slate-200 dark:bg-surface-dark text-slate-500'}`}>Perfil</button>
        <button onClick={() => setActiveTab('inventarios')} className={`shrink-0 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'inventarios' ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'bg-slate-200 dark:bg-surface-dark text-slate-500'}`}>Inventarios</button>
        <button onClick={() => navigate('/settings/bdd')} className={`shrink-0 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all bg-slate-200 dark:bg-surface-dark text-slate-500`}>BDD</button>
      </div>

      <main className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar pb-10">
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

        {activeTab === 'inventarios' && (
          <section className="space-y-6 animate-in slide-in-from-right-4 duration-300 pb-20">
            <div className="bg-primary/10 p-6 rounded-[2rem] border border-primary/20 space-y-2">
               <h3 className="text-sm font-black text-primary uppercase">Inventarios (Referencia)</h3>
               <p className="text-[10px] font-bold text-slate-500 leading-relaxed uppercase">
                 Estos límites son solo para alertas visuales de stock. No afectan reportes contables ni utilidad neta.
               </p>
            </div>

            {!invAccountDocId ? (
              <div className="py-20 text-center"><span className="material-symbols-outlined animate-spin text-primary">sync</span></div>
            ) : (
              <div className="space-y-6">
                <MoneyInputWithCalculator 
                  label="Inventario Mínimo (MXN)" 
                  field="invMin" 
                  value={invMin || 0} 
                  onChange={(_, v) => setInvMin(parseFloat(v) || null)} 
                  placeholder="Sin límite mínimo"
                />
                
                <MoneyInputWithCalculator 
                  label="Inventario Máximo (MXN)" 
                  field="invMax" 
                  value={invMax || 0} 
                  onChange={(_, v) => setInvMax(parseFloat(v) || null)} 
                  placeholder="Sin límite máximo"
                />

                <div className="pt-4 space-y-3">
                  <button 
                    onClick={handleSaveInventory}
                    disabled={isSavingInv}
                    className="w-full py-5 bg-primary text-white font-black rounded-3xl shadow-xl shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-3"
                  >
                    {isSavingInv ? <span className="material-symbols-outlined animate-spin">sync</span> : <span className="material-symbols-outlined">save</span>}
                    Guardar Rango Ideal
                  </button>
                  <button 
                    onClick={handleClearInventory}
                    className="w-full py-3 text-slate-400 font-bold text-[10px] uppercase tracking-widest active:opacity-50"
                  >
                    Limpiar Rango
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
      </main>

      {activeTab === 'perfil' && (
        <div className="fixed bottom-[88px] left-0 right-0 px-6 max-w-md mx-auto z-40">
          <button onClick={handleSaveProfile} disabled={saveStatus === 'saving'} className={`w-full py-4 rounded-xl text-white font-black shadow-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${saveStatus === 'saved' ? 'bg-emerald-500' : 'bg-primary shadow-primary/30'}`}>
            <span className="material-symbols-outlined animate-in zoom-in">{saveStatus === 'saving' ? 'sync' : saveStatus === 'saved' ? 'verified' : 'save_as'}</span>
            <span>{saveStatus === 'saved' ? '¡Éxito!' : saveStatus === 'saving' ? 'Guardando...' : 'Actualizar Perfil'}</span>
          </button>
        </div>
      )}
      <BottomNav />
    </div>
  );
};

export default SettingsScreen;
