
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { auth } from '../services/firebase';
import { 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail, 
  setPersistence, 
  browserLocalPersistence, 
  browserSessionPersistence 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const LoginScreen: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Estados para recuperación de contraseña
  const [isForgotMode, setIsForgotMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetStatus, setResetStatus] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  // Estado para PWA (Instalación)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    setError('');

    try {
      // Configurar persistencia según el checkbox
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/dashboard');
    } catch (err: any) {
      console.error(err);
      setError('Credenciales inválidas. Verifica tu correo y contraseña.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) return;

    setLoading(true);
    setResetStatus(null);

    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setResetStatus({ text: 'Se ha enviado un correo para restablecer tu contraseña.', type: 'success' });
      setTimeout(() => {
        setIsForgotMode(false);
        setResetStatus(null);
      }, 5000);
    } catch (err: any) {
      setResetStatus({ text: 'Error al enviar el correo. Verifica que sea válido.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      alert("Para instalar la app, usa la opción 'Instalar' o 'Agregar a la pantalla de inicio' en el menú de tu navegador.");
    }
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-hidden max-w-md mx-auto shadow-2xl bg-background-light dark:bg-background-dark font-display">
      <div className="absolute top-0 left-0 w-full h-[400px] bg-gradient-to-b from-primary/20 via-primary/5 to-transparent pointer-events-none opacity-50"></div>
      
      <div className="flex-1 flex flex-col px-6 pt-20 pb-8 relative z-10 overflow-y-auto no-scrollbar">
        {!isForgotMode ? (
          <>
            <div className="mb-10 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-2xl bg-gradient-to-tr from-primary to-purple-600 shadow-lg shadow-primary/30">
                <span className="material-symbols-outlined text-white text-3xl">dataset</span>
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight mb-2">¡Hola de nuevo!</h1>
              <p className="text-slate-500 dark:text-slate-400 text-base">Inicia sesión para gestionar tu panel.</p>
            </div>

            <form className="space-y-5" onSubmit={handleLogin}>
              {error && (
                <div className="text-red-500 text-xs font-bold bg-red-50 dark:bg-red-500/10 p-3 rounded-xl border border-red-100 dark:border-red-500/20 animate-in fade-in duration-300">
                  {error}
                </div>
              )}
              
              <div className="group">
                <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 ml-1">Correo o Usuario</label>
                <div className="relative flex items-center">
                  <input 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-xl px-5 py-4 pl-12 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-sm" 
                    placeholder="usuario@empresa.com" type="email"
                  />
                  <span className="material-symbols-outlined absolute left-4 text-slate-400 dark:text-slate-500 group-focus-within:text-primary transition-colors">mail</span>
                </div>
              </div>
              
              <div className="group">
                <div className="flex justify-between items-center mb-2 ml-1">
                  <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Contraseña</label>
                </div>
                <div className="relative flex items-center">
                  <input 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-xl px-5 py-4 pl-12 pr-12 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-sm" 
                    placeholder="••••••••" type={showPassword ? "text" : "password"}
                  />
                  <span className="material-symbols-outlined absolute left-4 text-slate-400 dark:text-slate-500 group-focus-within:text-primary transition-colors">lock</span>
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 text-slate-400 hover:text-primary transition-colors p-1 rounded-full hover:bg-slate-100 dark:hover:bg-white/5"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {showPassword ? "visibility" : "visibility_off"}
                    </span>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between px-1">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <div className="relative">
                    <input 
                      type="checkbox" 
                      checked={rememberMe} 
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="sr-only"
                    />
                    <div className={`w-10 h-5 rounded-full transition-colors ${rememberMe ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'}`}></div>
                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${rememberMe ? 'translate-x-5' : 'translate-x-0'}`}></div>
                  </div>
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 group-hover:text-primary transition-colors">Recordar usuario</span>
                </label>
                <button 
                  type="button"
                  onClick={() => setIsForgotMode(true)}
                  className="text-xs font-bold text-primary hover:underline transition-all"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>

              <button 
                type="submit"
                disabled={loading}
                className="w-full bg-primary hover:bg-primary-dark text-white font-black text-lg rounded-xl py-4 shadow-xl shadow-primary/30 transition-all active:scale-[0.98] mt-4 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? <span className="material-symbols-outlined animate-spin">sync</span> : 'Iniciar Sesión'}
              </button>
            </form>

            <div className="mt-8 text-center space-y-6">
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                ¿No tienes una cuenta? 
                <Link to="/register" className="text-primary font-black hover:underline ml-1">Registrarse</Link>
              </p>

              <div className="pt-6 border-t border-slate-100 dark:border-white/5">
                <button 
                  onClick={handleInstallApp}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 text-sm font-bold text-slate-600 dark:text-slate-300 shadow-sm hover:shadow-md hover:border-primary/30 transition-all active:scale-95"
                >
                  <span className="material-symbols-outlined text-[20px] text-primary">install_mobile</span>
                  Instalar App
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="animate-in slide-in-from-right-10 duration-500">
            <button 
              onClick={() => { setIsForgotMode(false); setResetStatus(null); }}
              className="mb-8 flex items-center gap-2 text-primary font-bold hover:gap-3 transition-all"
            >
              <span className="material-symbols-outlined">arrow_back</span>
              Volver al inicio
            </button>

            <div className="mb-10">
              <h1 className="text-3xl font-extrabold tracking-tight mb-2">Restablecer Contraseña</h1>
              <p className="text-slate-500 dark:text-slate-400 text-base leading-relaxed">
                Ingresa tu correo electrónico y te enviaremos las instrucciones para recuperar tu acceso.
              </p>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-6">
              {resetStatus && (
                <div className={`p-4 rounded-xl flex items-start gap-3 border animate-in fade-in ${
                  resetStatus.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400' : 'bg-red-50 border-red-100 text-red-700 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-400'
                }`}>
                  <span className="material-symbols-outlined shrink-0">{resetStatus.type === 'success' ? 'check_circle' : 'error'}</span>
                  <p className="text-xs font-bold leading-tight">{resetStatus.text}</p>
                </div>
              )}

              <div className="group">
                <label className="block text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 ml-1">Tu Correo Electrónico</label>
                <div className="relative flex items-center">
                  <input 
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="w-full bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-xl px-5 py-4 pl-12 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all shadow-sm" 
                    placeholder="email@ejemplo.com" type="email" required
                  />
                  <span className="material-symbols-outlined absolute left-4 text-slate-400 dark:text-slate-500 group-focus-within:text-primary">mail</span>
                </div>
              </div>

              <button 
                type="submit"
                disabled={loading || !resetEmail}
                className="w-full bg-primary hover:bg-primary-dark text-white font-black text-lg rounded-xl py-4 shadow-xl shadow-primary/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? <span className="material-symbols-outlined animate-spin">sync</span> : 'Enviar Instrucciones'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginScreen;
