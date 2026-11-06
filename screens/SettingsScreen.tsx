
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { auth, db } from '../services/firebase';
import { updatePassword, signOut } from "firebase/auth";
import { 
  doc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  serverTimestamp 
} from "firebase/firestore";
import { handleFirestoreError, OperationType } from '../services/errorHandling';
import VoiceInputButton from '../components/VoiceInputButton';
import { GeminiService, GeminiDiagnosticReport, GeminiServerStatus } from '../services/geminiService';
import MoneyInputWithCalculator from '../components/MoneyInputWithCalculator';
import { sanitizeAvatarUrl } from '../components/ProfileMenu';

const SettingsScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { addNotification } = useNotifications();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [name, setName] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [newPassword, setNewPassword] = useState('');
  
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [activeTab, setActiveTab] = useState<'perfil' | 'ia' | 'inventarios' | 'bdd'>('perfil');
  const [isDark, setIsDark] = useState(document.documentElement.classList.contains('dark'));
  const [isGeneratingIA, setIsGeneratingIA] = useState(false);
  const [isBiometricLinked, setIsBiometricLinked] = useState(!!localStorage.getItem('biometric_credential'));
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnosticReport, setDiagnosticReport] = useState<GeminiDiagnosticReport | null>(null);
  const [serverStatus, setServerStatus] = useState<GeminiServerStatus | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [diagnosticDurationMs, setDiagnosticDurationMs] = useState<number | null>(null);
  
  const [invAccountDocId, setInvAccountDocId] = useState<string | null>(null);
  const [invMin, setInvMin] = useState<number | null>(null);
  const [invMax, setInvMax] = useState<number | null>(null);
  const [invBalance, setInvBalance] = useState<number | null>(null);
  const [isSavingInv, setIsSavingInv] = useState(false);

  const isIframe = window.self !== window.top;
  const isSecure = window.isSecureContext;

  useEffect(() => {
    if (profile) {
      setName(profile.displayName || '');
      setPhotoURL(profile.photoURL || '');
    }
  }, [profile]);

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
          setInvBalance(data.balance ?? 0);
        }
      };
      fetchInv();
    }
  }, [activeTab, user]);

  useEffect(() => {
    const loadGeminiStatus = async () => {
      setIsLoadingStatus(true);
      try {
        const res = await GeminiService.getStatus();
        setServerStatus(res);
      } catch {
        // Ignored
      } finally {
        setIsLoadingStatus(false);
      }
    };
    loadGeminiStatus();
  }, [activeTab]);

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
        balance: invBalance,
        isContable: false,
        updatedAt: serverTimestamp()
      });
      addNotification({ title: 'Cuenta Actualizada', message: 'Inventario y límites actualizados.', type: 'system' });
      alert("✅ Configuración de inventarios guardada.");
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `users/${user.uid}/accounts/${invAccountDocId}`);
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
      handleFirestoreError(e, OperationType.WRITE, `users/${user.uid}/accounts/${invAccountDocId}`);
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
        localStorage.removeItem('biometric_key');
        localStorage.setItem('biometric_credential', credId);
        localStorage.setItem('biometric_email', user.email);
        setIsBiometricLinked(true);
        addNotification({ title: 'Biometría Vinculada', message: 'Ahora puedes verificar tu identidad con huella.', type: 'system' });
      }
    } catch (err) { /* Biometric error is local */ }
  };

  const generateIAImage = async () => {
    setIsGeneratingIA(true);
    try {
      const imageUrl = await GeminiService.generateAvatar();
      const safeUrl = sanitizeAvatarUrl(imageUrl);
      if (!safeUrl) throw new Error('Formato de imagen no válido.');
      setPhotoURL(safeUrl);
      if (user) await updateDoc(doc(db, "users", user.uid), { photoURL: safeUrl });
      addNotification({ title: 'Avatar Generado', message: 'Tu nuevo avatar con IA ha sido actualizado.', type: 'system' });
    } catch (err: any) { 
      console.error("Avatar Gen Error:", err); 
      addNotification({ title: 'Error con IA', message: err?.message || 'No se pudo generar el avatar.', type: 'system' });
    } finally { 
      setIsGeneratingIA(false); 
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
      if (!allowedTypes.includes(file.type)) {
        addNotification({ title: 'Archivo no permitido', message: 'Solo se permiten imágenes PNG, JPG o WEBP.', type: 'system' });
        return;
      }
      if (file.size > 512 * 1024) {
        addNotification({ title: 'Imagen demasiado grande', message: 'Elige una imagen menor a 512 KB.', type: 'system' });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = async () => {
        const safeBase64 = sanitizeAvatarUrl(reader.result as string);
        if (!safeBase64) return;
        setPhotoURL(safeBase64);
        if (user) await updateDoc(doc(db, "users", user.uid), { photoURL: safeBase64 });
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

  const handleRunDiagnostic = async () => {
    setIsDiagnosing(true);
    setDiagnosticReport(null);
    const start = performance.now();
    try {
      const report = await GeminiService.runDiagnostic();
      setDiagnosticDurationMs(Math.round(performance.now() - start));
      setDiagnosticReport(report);
      GeminiService.getStatus().then(setServerStatus).catch(() => {});
      if (report.isPermissionDenied) {
        addNotification({
          title: 'Error 403 en Gemini API',
          message: 'La clave configurada no tiene permisos en Google Cloud o la API está deshabilitada.',
          type: 'system',
        });
      } else if (report.status === 200) {
        addNotification({
          title: 'Diagnóstico IA Exitoso',
          message: 'Conexión a Gemini API validada y funcionando correctamente.',
          type: 'system',
        });
      }
    } catch (err: any) {
      setDiagnosticDurationMs(Math.round(performance.now() - start));
      addNotification({
        title: 'Fallo en Diagnóstico',
        message: err?.message || 'Error al ejecutar diagnóstico.',
        type: 'system',
      });
    } finally {
      setIsDiagnosing(false);
    }
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
        <button onClick={() => setActiveTab('perfil')} className={`shrink-0 px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'perfil' ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'bg-slate-200 dark:bg-surface-dark text-slate-500'}`}>Perfil</button>
        <button onClick={() => setActiveTab('ia')} className={`shrink-0 px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${activeTab === 'ia' ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'bg-slate-200 dark:bg-surface-dark text-slate-500'}`}>
          <span className="material-symbols-outlined text-sm">auto_awesome</span>
          <span>Gemini IA</span>
        </button>
        <button onClick={() => setActiveTab('inventarios')} className={`shrink-0 px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'inventarios' ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'bg-slate-200 dark:bg-surface-dark text-slate-500'}`}>Inventarios</button>
        <button onClick={() => navigate('/settings/bdd')} className={`shrink-0 px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all bg-slate-200 dark:bg-surface-dark text-slate-500`}>BDD</button>
      </div>

      <main className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar pb-10">
        {activeTab === 'perfil' && (
          <section className="space-y-6 pb-12 animate-in fade-in">
            <div className="flex flex-col items-center gap-6 mb-4">
              <div className="relative group">
                <div className="relative size-28 rounded-[2rem] border-4 border-primary overflow-hidden shadow-2xl transition-transform group-hover:scale-105 bg-slate-200 dark:bg-slate-800">
                  {sanitizeAvatarUrl(photoURL) ? (
                    <img
                      src={sanitizeAvatarUrl(photoURL)!}
                      alt="Avatar"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : !isGeneratingIA ? (
                    <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                      <span className="material-symbols-outlined text-4xl">person</span>
                    </div>
                  ) : null}
                  {isGeneratingIA && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                      <span className="material-symbols-outlined animate-spin text-white text-3xl">sync</span>
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

            {/* Diagnóstico de Red Gemini F1-AI */}
            <div className="p-5 rounded-2xl bg-slate-100 dark:bg-surface-dark border border-slate-200 dark:border-white/5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-xl">troubleshoot</span>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">Diagnóstico de Red Gemini</h4>
                    <p className="text-[10px] text-slate-500">Verificar estado de clave y permisos en Google Cloud</p>
                  </div>
                </div>
                <button
                  onClick={handleRunDiagnostic}
                  disabled={isDiagnosing}
                  className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-black rounded-xl transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  <span className={`material-symbols-outlined text-sm ${isDiagnosing ? 'animate-spin' : ''}`}>
                    {isDiagnosing ? 'sync' : 'play_arrow'}
                  </span>
                  <span>{isDiagnosing ? 'Probando...' : 'Diagnosticar'}</span>
                </button>
              </div>

              {diagnosticReport && (
                <div className={`p-4 rounded-xl border text-xs space-y-2 animate-in fade-in duration-200 ${
                  diagnosticReport.isPermissionDenied
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200'
                    : diagnosticReport.status === 200
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200'
                    : 'bg-red-500/10 border-red-500/30 text-red-900 dark:text-red-200'
                }`}>
                  <div className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-base shrink-0 mt-0.5">
                      {diagnosticReport.isPermissionDenied ? 'warning' : diagnosticReport.status === 200 ? 'check_circle' : 'error'}
                    </span>
                    <div className="space-y-1">
                      <p className="font-bold">{diagnosticReport.userMessage}</p>
                      <p className="text-[10px] opacity-80">
                        Endpoint: <code className="font-mono">{diagnosticReport.endpoint}</code> | HTTP: {diagnosticReport.status} | Hora: {new Date(diagnosticReport.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>

                  {diagnosticReport.remediationGuide && diagnosticReport.remediationGuide.length > 0 && (
                    <div className="pt-2 border-t border-current/10 space-y-1 text-[11px]">
                      <p className="font-black uppercase text-[10px] tracking-wider">Pasos sugeridos de solución:</p>
                      <ul className="list-disc pl-4 space-y-0.5">
                        {diagnosticReport.remediationGuide.map((step, idx) => (
                          <li key={idx}>{step}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button onClick={() => signOut(auth).then(() => navigate('/'))} className="w-full py-4 text-red-500 font-black flex items-center justify-center gap-2 hover:bg-red-500/5 rounded-2xl transition-colors mt-8">
              <span className="material-symbols-outlined">logout</span> Cerrar Sesión F1
            </button>
          </section>
        )}

        {activeTab === 'ia' && (
          <section className="space-y-6 animate-in slide-in-from-right-4 duration-300 pb-20">
            {/* Header / Resumen del Servicio */}
            <div className="bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-6 rounded-[2rem] border border-primary/20 space-y-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="size-12 rounded-2xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/30 shrink-0">
                    <span className="material-symbols-outlined text-2xl">auto_awesome</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wide">
                      Inteligencia Artificial Gemini
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Auditoría contable y procesamiento de cortes
                    </p>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0 border ${
                  diagnosticReport?.isPermissionDenied
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                    : serverStatus?.configured
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                    : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30'
                }`}>
                  {diagnosticReport?.isPermissionDenied
                    ? 'Alerta 403'
                    : serverStatus?.configured
                    ? 'Conectada (200 OK)'
                    : 'Sin Clave'}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Supervisa el desglose de ingresos, ventas, retiros de efectivo, sobrantes y gastos en la pantalla de <strong>Cortes Diarios</strong> y los pedidos por texto.
              </p>
            </div>

            {/* Diagnóstico en Vivo */}
            <div className="p-5 rounded-2xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-primary text-xl">speed</span>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                      Diagnóstico de Conexión en Vivo
                    </h4>
                    <p className="text-[10px] text-slate-500">
                      Verificar comunicación y validar credencial activa
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleRunDiagnostic}
                  disabled={isDiagnosing}
                  className="px-4 py-2 bg-primary hover:bg-primary/90 text-white text-xs font-black rounded-xl transition-all shadow-md shadow-primary/20 active:scale-95 disabled:opacity-50 flex items-center gap-2"
                >
                  <span className={`material-symbols-outlined text-sm ${isDiagnosing ? 'animate-spin' : ''}`}>
                    {isDiagnosing ? 'sync' : 'network_check'}
                  </span>
                  <span>{isDiagnosing ? 'Probando...' : 'Diagnosticar'}</span>
                </button>
              </div>

              {diagnosticReport ? (
                <div className={`p-4 rounded-xl border text-xs space-y-3 animate-in fade-in duration-200 ${
                  diagnosticReport.isPermissionDenied
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200'
                    : diagnosticReport.status === 200
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200'
                    : 'bg-red-500/10 border-red-500/30 text-red-900 dark:text-red-200'
                }`}>
                  <div className="flex items-start gap-2.5">
                    <span className="material-symbols-outlined text-lg shrink-0 mt-0.5">
                      {diagnosticReport.isPermissionDenied ? 'warning' : diagnosticReport.status === 200 ? 'check_circle' : 'error'}
                    </span>
                    <div className="space-y-1 flex-1">
                      <p className="font-bold leading-snug">{diagnosticReport.userMessage}</p>
                      <div className="flex flex-wrap items-center gap-2 pt-1 text-[10px] opacity-80 font-mono">
                        <span className="bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded">HTTP {diagnosticReport.status}</span>
                        {diagnosticDurationMs !== null && (
                          <span className="bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded">Latencia: {diagnosticDurationMs} ms</span>
                        )}
                        <span className="bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded">
                          Modelo: {diagnosticReport.details?.model || serverStatus?.primaryModel || 'gemini-3.1-flash-lite'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {diagnosticReport.remediationGuide && diagnosticReport.remediationGuide.length > 0 && (
                    <div className="pt-2 border-t border-current/10 space-y-1.5 text-[11px]">
                      <p className="font-black uppercase text-[10px] tracking-wider">Pasos sugeridos de solución:</p>
                      <ul className="list-disc pl-4 space-y-1">
                        {diagnosticReport.remediationGuide.map((step, idx) => (
                          <li key={idx} className="leading-relaxed">{step}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-surface-dark/50 border border-slate-200/60 dark:border-white/5 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Presiona &ldquo;Diagnosticar&rdquo; para validar la API y medir la latencia.</span>
                  <span className="font-mono text-[10px] bg-slate-200 dark:bg-white/10 px-2 py-0.5 rounded">
                    {serverStatus?.primaryModel || 'gemini-3.1-flash-lite'}
                  </span>
                </div>
              )}
            </div>

            {/* Seguridad y Almacenamiento Seguro (Secrets) */}
            <div className="p-5 rounded-2xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/5 space-y-3.5 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-xl">shield_lock</span>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                    Seguridad y Custodia de la Clave
                  </h4>
                  <p className="text-[10px] text-slate-500">Protección del lado del servidor contra fugas de credenciales</p>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-surface-dark/60 p-3.5 rounded-xl border border-slate-200/60 dark:border-white/5 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 text-[11px]">Credencial en Servidor:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-[11px]">
                    {serverStatus?.keyPrefix || 'Detectada en Secrets'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 text-[11px]">Ubicación de Almacenamiento:</span>
                  <span className="font-semibold text-primary text-[11px]">Google AI Studio (Secrets)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 text-[11px]">Proxy de Seguridad:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400 text-[11px]">
                    Activo (/api/gemini/*)
                  </span>
                </div>
              </div>

              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-[11px] text-blue-900 dark:text-blue-200 leading-relaxed">
                <p className="font-bold flex items-center gap-1 mb-1">
                  <span className="material-symbols-outlined text-sm">lock</span>
                  ¿Por qué las claves no se ingresan en el navegador?
                </p>
                <p className="opacity-90">
                  Por estrictas normas de seguridad bancaria y de Google Cloud, las claves de API nunca se solicitan en formularios web ni se guardan en el navegador del usuario (para evitar robos por malware o extensiones). Se administran de manera cifrada en <strong>Settings &gt; Secrets</strong> del servidor.
                </p>
              </div>
            </div>

            {/* Guía Paso a Paso para Resolver el Error 403 y Configurar Clave Personal */}
            <div className="p-5 rounded-2xl bg-white dark:bg-surface-dark border border-slate-200 dark:border-white/5 space-y-4 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-xl">help_outline</span>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                    Guía para Resolver el Error 403
                  </h4>
                  <p className="text-[10px] text-slate-500">
                    Instrucciones para vincular tu propia clave de Google AI Studio
                  </p>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex gap-3 items-start p-3 rounded-xl bg-slate-50 dark:bg-surface-dark/60 border border-slate-200/60 dark:border-white/5">
                  <div className="size-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black text-xs shrink-0 mt-0.5">
                    1
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold text-slate-800 dark:text-slate-200">Genera tu Clave en Google AI Studio</p>
                    <p className="text-slate-500 text-[11px] leading-relaxed">
                      Entra a <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-primary font-bold underline">aistudio.google.com/app/apikey</a> con tu cuenta de Google y haz clic en &ldquo;Create API key&rdquo;.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 items-start p-3 rounded-xl bg-slate-50 dark:bg-surface-dark/60 border border-slate-200/60 dark:border-white/5">
                  <div className="size-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black text-xs shrink-0 mt-0.5">
                    2
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold text-slate-800 dark:text-slate-200">Abre Settings &gt; Secrets en AI Studio</p>
                    <p className="text-slate-500 text-[11px] leading-relaxed">
                      En la barra superior derecha de Google AI Studio Build, abre el panel <strong>Settings</strong> y selecciona <strong>Secrets</strong>.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 items-start p-3 rounded-xl bg-slate-50 dark:bg-surface-dark/60 border border-slate-200/60 dark:border-white/5">
                  <div className="size-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black text-xs shrink-0 mt-0.5">
                    3
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold text-slate-800 dark:text-slate-200">Guarda la variable GEMINI_API_KEY</p>
                    <p className="text-slate-500 text-[11px] leading-relaxed">
                      Pega tu clave en la variable llamada <code className="font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold">GEMINI_API_KEY</code>. El backend la detectará automáticamente.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 items-start p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200">
                  <div className="size-6 rounded-full bg-amber-500 text-white flex items-center justify-center font-black text-xs shrink-0 mt-0.5">
                    !
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold">¿Por qué ocurre el Error 403 (Permission Denied)?</p>
                    <ul className="list-disc pl-4 space-y-0.5 text-[11px] opacity-90">
                      <li>
                        <strong>Generative Language API deshabilitada:</strong> En Google Cloud Console, asegúrate de activar la &ldquo;Generative Language API&rdquo; para tu proyecto.
                      </li>
                      <li>
                        <strong>Restricciones de IP o HTTP:</strong> Verifica en Google Cloud Console que la clave no tenga restricciones de IP que bloqueen las peticiones del servidor.
                      </li>
                      <li>
                        <strong>Cuentas corporativas:</strong> Si tu correo de Workspace tiene restringido el uso de IA, crea un proyecto personal gratuito de Google Cloud.
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Motor de Respaldo Contable Local */}
            <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-2.5">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <span className="material-symbols-outlined text-xl">offline_pin</span>
                <h4 className="text-xs font-black uppercase tracking-wider">
                  Motor de Respaldo Contable Local Activo
                </h4>
              </div>
              <p className="text-xs text-emerald-950 dark:text-emerald-200 leading-relaxed">
                ¡Tu operación nunca se detiene! Si la API externa de Gemini experimenta saturación o un error 403, el sistema activa automáticamente un motor contable por reglas heurísticas locales. Los cortes de caja, cálculos de ventas, sueldos y faltantes se auditan y sincronizan sin interrupciones.
              </p>
            </div>
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
                  label="Inventario Actual / Inicial (MXN)" 
                  field="invBalance" 
                  value={invBalance || 0} 
                  onChange={(_, v) => setInvBalance(parseFloat(v) || 0)} 
                  placeholder="Monto de inventario"
                />

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
                    Guardar Inventario y Rangos
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
