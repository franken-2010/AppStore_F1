
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { auth, db } from '../services/firebase';
import { createUserWithEmailAndPassword, updateProfile } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const RegisterScreen: React.FC = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

      // Guardar en Firestore con el nuevo azul primario en el avatar
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        displayName: name,
        email: email,
        photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=2563eb&color=fff`,
        role: 'admin',
        createdAt: new Date().toISOString()
      });

      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Error al crear la cuenta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex h-full min-h-screen w-full flex-col overflow-x-hidden max-w-md mx-auto shadow-2xl bg-background-light dark:bg-background-dark">
      <div className="flex items-center px-4 py-4 justify-between sticky top-0 z-10 bg-background-light/90 dark:bg-background-dark/90 backdrop-blur-sm">
        <button onClick={() => navigate('/')} className="text-gray-900 dark:text-white flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-surface-dark transition-colors">
          <span className="material-symbols-outlined text-2xl">arrow_back</span>
        </button>
        <h2 className="text-gray-900 dark:text-white text-lg font-bold flex-1 text-center pr-10">Crear Cuenta</h2>
      </div>

      <div className="flex-1 flex flex-col pb-8">
        <div className="px-6 pt-6 pb-2">
          <h1 className="text-gray-900 dark:text-white tracking-tight text-[28px] font-extrabold leading-tight text-center">Comenzar</h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm font-medium leading-relaxed pt-2 text-center">Automatiza tus tareas administrativas hoy mismo.</p>
        </div>

        <div className="flex flex-col gap-5 px-6 py-6">
          {error && <p className="text-red-500 text-xs font-bold bg-red-50 dark:bg-red-500/10 p-3 rounded-lg border border-red-100 dark:border-red-500/20">{error}</p>}
          
          <div className="flex flex-col gap-1.5">
            <label className="text-gray-900 dark:text-white text-sm font-semibold pl-3">Nombre Completo</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <span className="material-symbols-outlined text-gray-400 group-focus-within:text-primary transition-colors">person</span>
              </div>
              <input 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex w-full rounded-full text-gray-900 dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-gray-200 dark:border-border-dark bg-white dark:bg-surface-dark h-14 pl-12 pr-4 text-base transition-all shadow-sm" 
                placeholder="Juan Pérez" type="text"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-gray-900 dark:text-white text-sm font-semibold pl-3">Correo electrónico</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <span className="material-symbols-outlined text-gray-400 group-focus-within:text-primary transition-colors">mail</span>
              </div>
              <input 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex w-full rounded-full text-gray-900 dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-gray-200 dark:border-border-dark bg-white dark:bg-surface-dark h-14 pl-12 pr-4 text-base transition-all shadow-sm" 
                placeholder="ejemplo@correo.com" type="email"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-gray-900 dark:text-white text-sm font-semibold pl-3">Contraseña</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <span className="material-symbols-outlined text-gray-400 group-focus-within:text-primary transition-colors">lock</span>
              </div>
              <input 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="flex w-full rounded-full text-gray-900 dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-gray-200 dark:border-border-dark bg-white dark:bg-surface-dark h-14 pl-12 pr-4 text-base transition-all shadow-sm" 
                placeholder="Mínimo 6 caracteres" type="password"
              />
            </div>
          </div>
        </div>

        <div className="px-6">
          <button 
            onClick={handleRegister}
            disabled={loading}
            className="flex w-full items-center justify-center rounded-full bg-primary py-4 text-base font-bold text-white shadow-lg shadow-primary/30 hover:bg-primary/90 transition-all active:scale-[0.98] disabled:opacity-70"
          >
            {loading ? <span className="material-symbols-outlined animate-spin">sync</span> : 'Registrarse'}
          </button>
        </div>

        <div className="mt-auto pt-8 text-center">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            ¿Ya tienes una cuenta?
            <Link to="/" className="text-primary font-bold hover:underline ml-1">Iniciar Sesión</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterScreen;
