
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { auth, db } from '../services/firebase';
import { 
  createUserWithEmailAndPassword, 
  updateProfile, 
  GoogleAuthProvider, 
  signInWithPopup 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, setDoc, getDoc, collection, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const RegisterScreen: React.FC = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const initializeDefaultData = async (uid: string) => {
    const batch = writeBatch(db);
    
    // 1. Categorías por defecto
    const categories = [
      { name: 'EFECTIVO', accountingType: 'Activo', order: 0 },
      { name: 'CUENTAS', accountingType: 'Pasivo', order: 1 },
      { name: 'AHORROS', accountingType: 'Ahorro', order: 2 }
    ];

    const categoryRefs: string[] = [];
    categories.forEach((cat) => {
      const catRef = doc(collection(db, "users", uid, "categories"));
      batch.set(catRef, { ...cat, createdAt: serverTimestamp() });
      categoryRefs.push(catRef.id);
    });

    // 2. Cuentas iniciales vinculadas a categorías
    const accounts = [
      { name: 'Caja Principal', code: 'CAJ01', type: 'Activo', categoryId: categoryRefs[0], balance: 0, order: 0, isVisible: true },
      { name: 'Banco Santander', code: 'BNK01', type: 'Activo', categoryId: categoryRefs[0], balance: 0, order: 1, isVisible: true },
      { name: 'Capital Social', code: 'CAP01', type: 'Capital', categoryId: null, balance: 0, order: 2, isVisible: true }
    ];

    accounts.forEach((acc) => {
      const newAccRef = doc(collection(db, "users", uid, "accounts"));
      batch.set(newAccRef, {
        ...acc,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    });

    await batch.commit();
  };

  const handleRegister = async () => {
    if (!name || !email || !password) {
      setError('Todos los campos son obligatorios');
      return;
    }
    
    setLoading(true);
    setError('');

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await updateProfile(user, { displayName: name });

      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        displayName: name,
        email: email,
        photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=2563eb&color=fff`,
        role: 'admin',
        createdAt: serverTimestamp()
      });

      await initializeDefaultData(user.uid);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Error al crear la cuenta');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    
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
          createdAt: serverTimestamp()
        });

        await initializeDefaultData(user.uid);
      }
      
      navigate('/dashboard');
    } catch (err: any) {
      setError(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex h-full min-h-screen w-full flex-col overflow-x-hidden max-w-md mx-auto shadow-2xl bg-background-light dark:bg-background-dark font-display">
      <div className="flex items-center px-4 py-4 justify-between sticky top-0 z-10 bg-background-light/90 dark:bg-background-dark/90 backdrop-blur-sm">
        <button onClick={() => navigate('/')} className="text-gray-900 dark:text-white flex size-10 items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-surface-dark">
          <span className="material-symbols-outlined text-2xl">arrow_back</span>
        </button>
        <h2 className="text-gray-900 dark:text-white text-lg font-bold flex-1 text-center pr-10">Crear Cuenta</h2>
      </div>

      <div className="flex-1 flex flex-col pb-8">
        <div className="px-6 pt-6 pb-2 text-center">
          <h1 className="text-gray-900 dark:text-white text-[28px] font-extrabold leading-tight">Únete a Miscelánea F1</h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-2">Gestiona tu negocio con inteligencia artificial.</p>
        </div>

        <div className="flex flex-col gap-5 px-6 py-6">
          {error && (
            <div className="text-red-500 text-xs font-bold bg-red-50 dark:bg-red-500/10 p-3 rounded-xl border border-red-100 dark:border-red-500/20">
              {error}
            </div>
          )}
          
          <div className="flex flex-col gap-1.5">
            <label className="text-gray-900 dark:text-white text-sm font-semibold pl-1">Nombre Completo</label>
            <input 
              value={name} onChange={(e) => setName(e.target.value)}
              className="w-full rounded-full border border-gray-200 dark:border-border-dark bg-white dark:bg-surface-dark h-14 px-6 text-base outline-none focus:ring-2 focus:ring-primary shadow-sm" 
              placeholder="Juan Pérez" type="text"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-gray-900 dark:text-white text-sm font-semibold pl-1">Correo electrónico</label>
            <input 
              value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-full border border-gray-200 dark:border-border-dark bg-white dark:bg-surface-dark h-14 px-6 text-base outline-none focus:ring-2 focus:ring-primary shadow-sm" 
              placeholder="ejemplo@correo.com" type="email"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-gray-900 dark:text-white text-sm font-semibold pl-1">Contraseña</label>
            <input 
              value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-full border border-gray-200 dark:border-border-dark bg-white dark:bg-surface-dark h-14 px-6 text-base outline-none focus:ring-2 focus:ring-primary shadow-sm" 
              placeholder="Mínimo 6 caracteres" type="password"
            />
          </div>
        </div>

        <div className="px-6 space-y-4">
          <button 
            onClick={handleRegister} disabled={loading}
            className="w-full rounded-full bg-primary py-4 text-base font-bold text-white shadow-lg active:scale-[0.98] disabled:opacity-70"
          >
            {loading ? 'Inicializando Sistema...' : 'Registrarse'}
          </button>

          <div className="flex items-center gap-4 py-2">
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800"></div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">O con Google</span>
            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800"></div>
          </div>

          <button 
            type="button" onClick={handleGoogleSignIn} disabled={loading}
            className="w-full bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-bold rounded-full py-4 flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Google
          </button>
        </div>

        <div className="mt-auto pt-8 text-center">
          <p className="text-sm font-medium text-gray-500">
            ¿Ya tienes cuenta?
            <Link to="/" className="text-primary font-bold hover:underline ml-1">Inicia Sesión</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterScreen;
