
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { auth, db } from '../services/firebase';
import { 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail, 
  setPersistence, 
  browserLocalPersistence, 
  browserSessionPersistence,
  GoogleAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const LoginScreen: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string, code?: string }>({ message: '' });
  const [isForgotMode, setIsForgotMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  
  const isIframe = window.self !== window.top;
  const isPWA = (window as any).isPWA;

  useEffect(() => {
    const savedEmail = localStorage.getItem('f1_remembered_email');
    if (savedEmail) {
      setEmail(savedEmail);
    }

    if (window.PublicKeyCredential && !isIframe && window.isSecureContext) {
      (window.PublicKeyCredential as any).isUserVerifyingPlatformAuthenticatorAvailable()
        .then((available: boolean) => setIsBiometricSupported(available));
    }
  }, [isIframe]);

  const handleBiometricLogin = async () => {
    const biometricData = localStorage.getItem('biometric_credential');
    if (!biometricData) {
      setError({ message: 'Primero vincula tu huella en Ajustes > Perfil.' });
      return;
    }

    if (isIframe) {
      setError({ message: 'Biometría bloqueada en marcos (iframes). Abre la app directamente.' });
      return;
    }

    setLoading(true);
    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const credential = await navigator.credentials.get({
        publicKey: {
          challenge,
          timeout: 60000,
          userVerification: "required",
          allowCredentials: [{
            id: new Uint8Array([...atob(biometricData)].map(c => c.charCodeAt(0))),
            type: 'public-key'
          }]
        }
      });

      if (credential) {
        const savedEmail = localStorage.getItem('biometric_email');
        const savedPass = localStorage.getItem('biometric_key'); 
        
        if (savedEmail && savedPass) {
          await setPersistence(auth, browserLocalPersistence);
          await signInWithEmailAndPassword(auth, savedEmail, savedPass);
          navigate('/dashboard');
        } else {
          setError({ message: 'Huella válida pero falta sincronización de credenciales.' });
        }
      }
    } catch (err: any) {
      console.error("Biometric login error:", err);
      setError({ message: 'Error biométrico: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleInstallPWA = () => {
    // Siempre redirigimos a la guía de instalación para asegurar que el usuario
    // entienda cómo hacerlo fuera del iframe
    navigate('/install');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError({ message: '' });
    try {
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      await signInWithEmailAndPassword(auth, email, password);
      
      if (rememberMe) {
        localStorage.setItem('f1_remembered_email', email);
      } else {
        localStorage.removeItem('f1_remembered_email');
      }

      navigate('/dashboard');
    } catch (err: any) {
      setError({ message: 'Credenciales inválidas.' });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError({ message: '' });
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      navigate('/dashboard');
    } catch (err: any) {
      setError({ message: `Error: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-hidden max-w-md mx-auto shadow-2xl bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-white transition-colors duration-200 antialiased">
      
      {/* MODAL DE INSTALACIÓN */}
      {showInstallModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-full max-w-xs bg-white dark:bg-surface-dark rounded-[2.5rem] p-8 shadow-2xl border border-slate-100 dark:border-white/5 animate-in zoom-in duration-300">
            <div className="size-20 bg-primary/10 text-primary rounded-[1.5rem] flex items-center justify-center mx-auto mb-6">
              <span className="material-symbols-outlined text-4xl">install_mobile</span>
            </div>
            <h3 className="text-xl font-black text-center mb-2">Instalar F1 App</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 text-center mb-8 leading-relaxed font-medium">
              Para instalar la app como un APK nativo y activar la huella digital, pulsa el botón de abajo y sigue la guía.
            </p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={handleInstallPWA}
                className="w-full py-4 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined">rocket_launch</span>
                Comenzar Instalación
              </button>
              <button 
                onClick={() => setShowInstallModal(false)}
                className="w-full py-2 text-slate-400 font-bold text-[10px] uppercase tracking-tighter"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="absolute top-0 left-0 w-full h-[400px] bg-gradient-to-b from-primary/20 via-primary/5 to-transparent pointer-events-none opacity-50"></div>
      
      <div className="flex-1 flex flex-col px-6 pt-16 pb-8 relative z-10">
        {!isForgotMode ? (
          <>
            <div className="mb-8 text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 mb-4 rounded-[2.5rem] bg-gradient-to-tr from-primary to-emerald-500 shadow-xl border-4 border-white dark:border-slate-800">
                <span className="material-symbols-outlined text-white text-4xl">store</span>
              </div>
              <h1 className="text-3xl font-black tracking-tight mb-2">Miscelánea F1</h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-bold uppercase tracking-widest">Inteligencia de Negocio</p>
            </div>

            <form className="space-y-4" onSubmit={handleLogin}>
              {error.message && <div className="text-red-600 text-[11px] font-bold bg-red-50 p-4 rounded-xl border border-red-100">{error.message}</div>}
              
              <div className="group">
                <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 ml-1">Correo Electrónico</label>
                <div className="relative flex items-center">
                  <input 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    autoComplete="email"
                    className="w-full bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-xl px-5 py-4 pl-12 pr-5 text-base font-bold outline-none shadow-sm focus:ring-2 focus:ring-primary/20" 
                    placeholder="admin@f1.com" 
                    type="email" 
                  />
                  <span className="material-symbols-outlined absolute left-4 text-slate-400">mail</span>
                </div>
              </div>
              
              <div className="group">
                <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 ml-1">Contraseña</label>
                <div className="relative flex items-center">
                  <input 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    autoComplete="current-password"
                    className="w-full bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-xl px-5 py-4 pl-12 pr-12 text-base font-bold outline-none shadow-sm focus:ring-2 focus:ring-primary/20" 
                    placeholder="••••••••" 
                    type={showPassword ? "text" : "password"} 
                  />
                  <span className="material-symbols-outlined absolute left-4 text-slate-400">lock</span>
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 text-slate-400"><span className="material-symbols-outlined">{showPassword ? "visibility" : "visibility_off"}</span></button>
                </div>
              </div>

              <div className="flex items-center justify-between px-1 mb-2">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <div className="relative">
                    <input 
                      type="checkbox" 
                      checked={rememberMe} 
                      onChange={(e) => setRememberMe(e.target.checked)} 
                      className="peer sr-only"
                    />
                    <div className="size-5 rounded-md border-2 border-slate-300 dark:border-slate-600 peer-checked:bg-primary peer-checked:border-primary transition-all"></div>
                    <span className="material-symbols-outlined absolute inset-0 text-white text-[16px] flex items-center justify-center opacity-0 peer-checked:opacity-100 transition-opacity">check</span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 group-hover:text-primary transition-colors">Recordar usuario</span>
                </label>
                
                <button 
                  type="button" 
                  onClick={() => setIsForgotMode(true)}
                  className="text-[11px] font-bold text-primary hover:underline"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>

              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={loading} className="flex-1 bg-primary text-white font-black text-lg rounded-xl py-4 shadow-xl active:scale-95 disabled:opacity-50 transition-all">
                  {loading ? 'Entrando...' : 'Entrar al Sistema'}
                </button>
                {isBiometricSupported && (
                  <button 
                    type="button"
                    onClick={handleBiometricLogin}
                    className="size-16 bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 text-primary rounded-xl flex items-center justify-center shadow-lg active:scale-90 transition-all shrink-0"
                    title="Entrar con Huella"
                  >
                    <span className="material-symbols-outlined text-3xl">fingerprint</span>
                  </button>
                )}
              </div>
            </form>

            <div className="flex items-center gap-4 py-4 mt-2">
              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800"></div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">O con Google</span>
              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800"></div>
            </div>

            <button onClick={handleGoogleSignIn} disabled={loading} className="w-full bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-bold rounded-xl py-4 flex items-center justify-center gap-3 active:scale-95 shadow-sm transition-all">
              <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
              Acceder con Google
            </button>

            {!isPWA && (
              <div className="mt-8 p-6 bg-slate-900 rounded-3xl relative overflow-hidden shadow-2xl border border-white/10">
                <div className="absolute top-0 right-0 p-4 opacity-20">
                  <span className="material-symbols-outlined text-6xl text-white">store_mall_directory</span>
                </div>
                
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-primary">download</span>
                    <h3 className="text-white font-black uppercase text-[10px] tracking-widest">Instalación Nativa</h3>
                  </div>
                  <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                    Instala Abarrotes F1 para recibir notificaciones y acceso con huella.
                  </p>

                  <button 
                    onClick={() => setShowInstallModal(true)}
                    className="w-full bg-white text-slate-900 font-black rounded-2xl py-4 flex items-center justify-center gap-3 active:scale-95 shadow-lg transition-all"
                  >
                    <span className="material-symbols-outlined">install_mobile</span>
                    Instalar en Celular
                  </button>
                </div>
              </div>
            )}

            <p className="mt-8 text-center text-sm font-medium text-slate-500 dark:text-slate-400">¿Nuevo administrador? <Link to="/register" className="text-primary font-black hover:underline ml-1">Crea tu cuenta</Link></p>
          </>
        ) : (
          <div className="animate-in fade-in slide-in-from-right-10">
            <button onClick={() => setIsForgotMode(false)} className="mb-8 flex items-center gap-2 text-primary font-bold"><span className="material-symbols-outlined">arrow_back</span> Atrás</button>
            <h1 className="text-3xl font-extrabold tracking-tight mb-4">Recuperar Acceso</h1>
            <form onSubmit={(e) => {e.preventDefault(); sendPasswordResetEmail(auth, resetEmail); setIsForgotMode(false);}} className="space-y-6">
              <div className="group">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Tu Correo</label>
                <div className="relative">
                  <input value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} className="w-full bg-white dark:bg-surface-dark border border-slate-200 rounded-xl px-5 py-4 pr-12 text-base font-bold outline-none" placeholder="email@f1.com" type="email" required />
                </div>
              </div>
              <button type="submit" disabled={loading} className="w-full bg-primary text-white font-black py-4 rounded-xl shadow-lg">Enviar enlace</button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginScreen;
