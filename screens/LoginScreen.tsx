
import React from 'react';
import { useNavigate, Link } from 'react-router-dom';

const LoginScreen: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-hidden max-w-md mx-auto shadow-2xl bg-background-light dark:bg-background-dark">
      <div className="absolute top-0 left-0 w-full h-[400px] bg-gradient-to-b from-primary/20 via-primary/5 to-transparent pointer-events-none opacity-50"></div>
      <div className="flex items-center p-6 pt-12 pb-2 justify-between relative z-10">
        <button className="flex items-center justify-center w-10 h-10 rounded-full bg-surface-light dark:bg-surface-dark text-slate-500 dark:text-slate-400 hover:text-primary transition-colors shadow-sm">
          <span className="material-symbols-outlined text-2xl">arrow_back</span>
        </button>
        <div className="text-sm font-semibold text-primary uppercase tracking-wider">DataFlow Admin</div>
        <div className="w-10"></div> 
      </div>
      
      <div className="flex-1 flex flex-col px-6 pt-4 pb-8 relative z-10 overflow-y-auto no-scrollbar">
        <div className="mb-10 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-2xl bg-gradient-to-tr from-primary to-purple-600 shadow-lg shadow-primary/30">
            <span className="material-symbols-outlined text-white text-3xl">dataset</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight mb-2">¡Hola de nuevo!</h1>
          <p className="text-slate-500 dark:text-slate-400 text-base">Inicia sesión para gestionar tu panel de control.</p>
        </div>

        <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); navigate('/dashboard'); }}>
          <div className="group">
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2 ml-1">Correo o Usuario</label>
            <div className="relative flex items-center">
              <input className="w-full bg-surface-light dark:bg-surface-dark border border-slate-200 dark:border-slate-700 rounded-xl px-5 py-4 pl-12 text-base outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-sm" placeholder="usuario@empresa.com" type="text"/>
              <span className="material-symbols-outlined absolute left-4 text-slate-400 dark:text-slate-500 group-focus-within:text-primary transition-colors">mail</span>
            </div>
          </div>
          
          <div className="group">
            <div className="flex justify-between items-center mb-2 ml-1">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Contraseña</label>
              <a className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors" href="#">¿Olvidaste tu contraseña?</a>
            </div>
            <div className="relative flex items-center">
              <input className="w-full bg-surface-light dark:bg-surface-dark border border-slate-200 dark:border-slate-700 rounded-xl px-5 py-4 pl-12 pr-12 text-base outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-sm" placeholder="••••••••" type="password"/>
              <span className="material-symbols-outlined absolute left-4 text-slate-400 dark:text-slate-500 group-focus-within:text-primary transition-colors">lock</span>
              <button className="absolute right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors flex items-center" type="button">
                <span className="material-symbols-outlined">visibility_off</span>
              </button>
            </div>
          </div>

          <button className="w-full bg-primary hover:bg-primary/90 text-white font-bold text-lg rounded-xl py-4 shadow-lg shadow-primary/30 transition-all active:scale-[0.98] mt-4 flex items-center justify-center gap-2">
            Iniciar Sesión
            <span className="material-symbols-outlined text-xl">login</span>
          </button>
        </form>

        <div className="relative py-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200 dark:border-slate-800"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-background-light dark:bg-background-dark px-4 text-slate-500">O continuar con</span>
          </div>
        </div>

        <button className="w-full bg-surface-light dark:bg-surface-dark border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-900 dark:text-white font-semibold rounded-xl py-3.5 flex items-center justify-center gap-3 transition-colors shadow-sm">
          <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
          Iniciar sesión con Google
        </button>

        <div className="mt-auto text-center pt-8">
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            ¿No tienes una cuenta? 
            <Link to="/register" className="text-primary font-bold hover:underline decoration-2 underline-offset-4 ml-1">Registrarse</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
