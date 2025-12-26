
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
import VoiceInputButton from '../components/VoiceInputButton';

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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError({ message: '' });
    try {
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      await signInWithEmailAndPassword(auth, email, password);
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
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);
      if (!userDoc.exists()) {
        await setDoc(userDocRef, {
          uid: user.uid,
          displayName: user.displayName || 'Usuario Google',
          email: user.email,
          photoURL: user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'U')}&background=2563eb&color=fff`,
          role: 'admin',
          createdAt: new Date().toISOString()
        });
      }
      navigate('/dashboard');
    } catch (err: any) {
      setError({ message: `Error: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-hidden max-w-md mx-auto shadow-2xl bg-background-light dark:bg-background-dark font-display">
      <div className="absolute top-0 left-0 w-full h-[400px] bg-gradient-to-b from-primary/20 via-primary/5 to-transparent pointer-events-none opacity-50"></div>
      <div className="flex-1 flex flex-col px-6 pt-20 pb-8 relative z-10">
        {!isForgotMode ? (
          <>
            <div className="mb-10 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-2xl bg-gradient-to-tr from-primary to-purple-600 shadow-lg">
                <span className="material-symbols-outlined text-white text-3xl">dataset</span>
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight mb-2">¡Hola de nuevo!</h1>
              <p className="text-slate-500 text-base font-medium">Inicia sesión para gestionar tu negocio.</p>
            </div>

            <form className="space-y-5" onSubmit={handleLogin}>
              {error.message && <div className="text-red-600 text-[11px] font-bold bg-red-50 p-4 rounded-xl border border-red-100">{error.message}</div>}
              
              <div className="group">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Correo Electrónico</label>
                <div className="relative flex items-center">
                  <input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-xl px-5 py-4 pl-12 pr-12 text-base font-bold outline-none" placeholder="admin@dataflow.com" type="email" />
                  <span className="material-symbols-outlined absolute left-4 text-slate-400">mail</span>
                  <VoiceInputButton onResult={setEmail} className="absolute right-2" />
                </div>
              </div>
              
              <div className="group">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Contraseña</label>
                <div className="relative flex items-center">
                  <input value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-xl px-5 py-4 pl-12 pr-12 text-base font-bold outline-none" placeholder="••••••••" type={showPassword ? "text" : "password"} />
                  <span className="material-symbols-outlined absolute left-4 text-slate-400">lock</span>
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 text-slate-400"><span className="material-symbols-outlined">{showPassword ? "visibility" : "visibility_off"}</span></button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="sr-only" />
                  <div className={`w-10 h-5 rounded-full relative transition-colors ${rememberMe ? 'bg-primary' : 'bg-slate-300'}`}>
                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${rememberMe ? 'translate-x-5' : ''}`}></div>
                  </div>
                  <span className="text-xs font-bold text-slate-500">Recordar</span>
                </label>
                <button type="button" onClick={() => setIsForgotMode(true)} className="text-xs font-bold text-primary hover:underline">¿Olvidaste tu contraseña?</button>
              </div>

              <button type="submit" disabled={loading} className="w-full bg-primary text-white font-black text-lg rounded-xl py-4 shadow-xl disabled:opacity-50">
                {loading ? 'Entrando...' : 'Iniciar Sesión'}
              </button>
            </form>

            <button onClick={handleGoogleSignIn} disabled={loading} className="mt-6 w-full bg-white dark:bg-surface-dark border border-slate-200 text-slate-900 dark:text-white font-bold rounded-xl py-4 flex items-center justify-center gap-3 active:scale-95 shadow-sm">
              <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
              Google
            </button>
            <p className="mt-8 text-center text-sm font-medium text-slate-500">¿No tienes cuenta? <Link to="/register" className="text-primary font-black hover:underline">Regístrate</Link></p>
          </>
        ) : (
          <div className="animate-in fade-in slide-in-from-right-10">
            <button onClick={() => setIsForgotMode(false)} className="mb-8 flex items-center gap-2 text-primary font-bold"><span className="material-symbols-outlined">arrow_back</span> Atrás</button>
            <h1 className="text-3xl font-extrabold tracking-tight mb-4">Recuperar Acceso</h1>
            <form onSubmit={(e) => {e.preventDefault(); sendPasswordResetEmail(auth, resetEmail); setIsForgotMode(false);}} className="space-y-6">
              <div className="group">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Tu Correo</label>
                <div className="relative">
                  <input value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} className="w-full bg-white dark:bg-surface-dark border border-slate-200 rounded-xl px-5 py-4 pr-12 text-base font-bold outline-none" placeholder="email@ejemplo.com" type="email" required />
                  <VoiceInputButton onResult={setResetEmail} className="absolute right-2 top-1/2 -translate-y-1/2" />
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
