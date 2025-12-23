
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import { useAuth } from '../context/AuthContext';
import { auth, db } from '../services/firebase';
import { updatePassword, updateProfile, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const SettingsScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  
  // Perfil del usuario
  const [name, setName] = useState(profile?.displayName || '');
  const [photoURL, setPhotoURL] = useState(profile?.photoURL || '');
  const [newPassword, setNewPassword] = useState('');
  
  // Webhooks
  const [webhookPriceUpdate, setWebhookPriceUpdate] = useState('');
  const [webhookAddProduct, setWebhookAddProduct] = useState('');
  const [webhookCortes, setWebhookCortes] = useState('');
  const [webhookNotifications, setWebhookNotifications] = useState('');
  
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [activeTab, setActiveTab] = useState<'perfil' | 'webhooks'>('perfil');

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

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaveStatus('saving');

    try {
      // Actualizar Auth
      await updateProfile(user, { displayName: name, photoURL: photoURL });
      
      // Si hay nueva contraseña
      if (newPassword) {
        await updatePassword(user, newPassword);
      }

      // Actualizar Firestore
      await updateDoc(doc(db, "users", user.uid), {
        displayName: name,
        photoURL: photoURL
      });

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
      setNewPassword('');
    } catch (err) {
      console.error(err);
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

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  return (
    <div className="relative flex flex-col h-screen w-full max-w-md mx-auto bg-background-light dark:bg-background-dark shadow-2xl overflow-hidden pb-32 font-display">
      {/* Header */}
      <header className="flex items-center justify-between p-4 pb-2 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md shrink-0 z-30 pt-12">
        <button onClick={() => navigate(-1)} className="flex items-center justify-center size-10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-slate-900 dark:text-white">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-lg font-bold flex-1 text-center pr-10">Configuración</h1>
      </header>

      {/* Tabs */}
      <div className="px-6 py-4 flex gap-2">
        <button 
          onClick={() => setActiveTab('perfil')}
          className={`flex-1 py-3 rounded-2xl text-sm font-bold transition-all ${activeTab === 'perfil' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-slate-200 dark:bg-surface-dark text-slate-500'}`}
        >
          Mi Perfil
        </button>
        <button 
          onClick={() => setActiveTab('webhooks')}
          className={`flex-1 py-3 rounded-2xl text-sm font-bold transition-all ${activeTab === 'webhooks' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-slate-200 dark:bg-surface-dark text-slate-500'}`}
        >
          Webhooks
        </button>
      </div>

      <main className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
        {activeTab === 'perfil' ? (
          <section className="space-y-6">
            <div className="flex flex-col items-center gap-4 mb-4">
              <div className="relative">
                <div className="size-24 rounded-full border-4 border-primary bg-cover bg-center overflow-hidden shadow-xl" style={{backgroundImage: `url('${photoURL}')`}}></div>
                <button className="absolute bottom-0 right-0 size-8 bg-primary text-white rounded-full flex items-center justify-center border-2 border-background-dark shadow-lg">
                  <span className="material-symbols-outlined text-sm">edit</span>
                </button>
              </div>
              <div className="text-center">
                <p className="font-bold text-lg text-slate-900 dark:text-white">{profile?.displayName}</p>
                <p className="text-xs text-slate-500">{profile?.email}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Nombre Completo</label>
                <input 
                  value={name} onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark py-4 px-4 text-base text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">URL de Foto</label>
                <input 
                  value={photoURL} onChange={(e) => setPhotoURL(e.target.value)}
                  className="w-full rounded-xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark py-4 px-4 text-base text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
                  placeholder="https://..."
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Nueva Contraseña</label>
                <input 
                  type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark py-4 px-4 text-base text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Dejar en blanco para no cambiar"
                />
              </div>
            </div>

            <button onClick={handleLogout} className="w-full py-4 text-red-500 font-bold flex items-center justify-center gap-2 hover:bg-red-500/5 rounded-xl transition-colors">
              <span className="material-symbols-outlined">logout</span>
              Cerrar Sesión
            </button>
          </section>
        ) : (
          <section className="space-y-6">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-500 uppercase ml-1">Actualización de Precios</label>
              <input value={webhookPriceUpdate} onChange={(e) => setWebhookPriceUpdate(e.target.value)} className="w-full rounded-xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark py-4 px-4 text-base" placeholder="https://hook.make.com/..." />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-500 uppercase ml-1">Agregar Producto</label>
              <input value={webhookAddProduct} onChange={(e) => setWebhookAddProduct(e.target.value)} className="w-full rounded-xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark py-4 px-4 text-base" placeholder="https://hook.make.com/..." />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-500 uppercase ml-1">Buzón Notificaciones</label>
              <input value={webhookNotifications} onChange={(e) => setWebhookNotifications(e.target.value)} className="w-full rounded-xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark py-4 px-4 text-base" placeholder="https://hook.make.com/..." />
            </div>
          </section>
        )}
      </main>

      {/* Floating Save Button */}
      <div className="fixed bottom-[88px] left-0 right-0 px-6 max-w-md mx-auto z-40">
        <button 
          onClick={activeTab === 'perfil' ? handleSaveProfile : handleSaveWebhooks}
          disabled={saveStatus === 'saving'}
          className={`w-full ${saveStatus === 'saved' ? 'bg-emerald-500' : 'bg-primary'} transition-all text-white font-bold py-4 rounded-xl shadow-lg flex items-center justify-center gap-2`}
        >
          {saveStatus === 'saving' ? <span className="material-symbols-outlined animate-spin">sync</span> : <span className="material-symbols-outlined">{saveStatus === 'saved' ? 'check' : 'save'}</span>}
          <span>{saveStatus === 'saved' ? '¡Guardado!' : 'Guardar Cambios'}</span>
        </button>
      </div>

      <BottomNav />
    </div>
  );
};

export default SettingsScreen;
