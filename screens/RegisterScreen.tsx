
import React from 'react';
import { useNavigate, Link } from 'react-router-dom';

const RegisterScreen: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="relative flex h-full min-h-screen w-full flex-col overflow-x-hidden max-w-md mx-auto shadow-2xl bg-background-light dark:bg-background-dark">
      <div className="flex items-center px-4 py-4 justify-between sticky top-0 z-10 bg-background-light/90 dark:bg-background-dark/90 backdrop-blur-sm">
        <button onClick={() => navigate('/')} className="text-gray-900 dark:text-white flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-surface-dark transition-colors">
          <span className="material-symbols-outlined text-2xl">arrow_back</span>
        </button>
        <h2 className="text-gray-900 dark:text-white text-lg font-bold flex-1 text-center pr-10">Crear Cuenta</h2>
      </div>

      <div className="flex-1 flex flex-col pb-8">
        <div className="px-4 py-2">
          <div className="w-full bg-center bg-no-repeat bg-cover flex flex-col justify-end overflow-hidden rounded-3xl min-h-[180px] shadow-lg relative group" style={{backgroundImage: 'url("https://picsum.photos/600/400?random=10")'}}>
            <div className="absolute inset-0 bg-gradient-to-t from-background-dark/90 via-background-dark/20 to-transparent"></div>
          </div>
        </div>

        <div className="px-6 pt-6 pb-2">
          <h1 className="text-gray-900 dark:text-white tracking-tight text-[28px] font-extrabold leading-tight text-center">Comenzar</h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm font-medium leading-relaxed pt-2 text-center">Automatiza tus tareas administrativas hoy con captura segura de datos.</p>
        </div>

        <div className="flex flex-col gap-5 px-6 py-6">
          <div className="flex flex-col gap-1.5">
            <label className="text-gray-900 dark:text-white text-sm font-semibold pl-3">Correo electrónico</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <span className="material-symbols-outlined text-gray-400 group-focus-within:text-primary transition-colors">mail</span>
              </div>
              <input className="flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-full text-gray-900 dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-gray-200 dark:border-border-dark bg-white dark:bg-surface-dark focus:border-primary h-14 placeholder:text-gray-400 dark:placeholder:text-[#a89ac1] pl-12 pr-4 text-base font-medium leading-normal transition-all shadow-sm" placeholder="ejemplo@correo.com" type="email"/>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-gray-900 dark:text-white text-sm font-semibold pl-3">Contraseña</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <span className="material-symbols-outlined text-gray-400 group-focus-within:text-primary transition-colors">lock</span>
              </div>
              <input className="flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-full text-gray-900 dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-gray-200 dark:border-border-dark bg-white dark:bg-surface-dark focus:border-primary h-14 placeholder:text-gray-400 dark:placeholder:text-[#a89ac1] pl-12 pr-12 text-base font-medium leading-normal transition-all shadow-sm" placeholder="Crea tu contraseña" type="password"/>
              <button className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-primary transition-colors" type="button">
                <span className="material-symbols-outlined">visibility</span>
              </button>
            </div>
          </div>

          <label className="flex items-center gap-3 px-2 cursor-pointer group">
            <input type="checkbox" className="h-5 w-5 rounded border-slate-300 text-primary focus:ring-primary" />
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300 select-none">Acepto los <a className="text-primary hover:underline" href="#">Términos y Condiciones</a></span>
          </label>
        </div>

        <div className="flex flex-col gap-4 px-6 pt-2">
          <button onClick={() => navigate('/dashboard')} className="flex w-full items-center justify-center rounded-full bg-primary py-4 text-base font-bold text-white shadow-lg shadow-primary/30 hover:bg-primary/90 transition-all active:scale-[0.98]">
            Registrarse
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
