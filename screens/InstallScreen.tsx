
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';

const InstallScreen: React.FC = () => {
  const navigate = useNavigate();
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isInIframe, setIsInIframe] = useState(window.self !== window.top);

  useEffect(() => {
    // Simulación de "preparación del paquete nativo"
    const timer = setInterval(() => {
      setDownloadProgress(prev => {
        if (prev >= 100) {
          clearInterval(timer);
          setIsReady(true);
          return 100;
        }
        return prev + 5;
      });
    }, 40);

    return () => clearInterval(timer);
  }, []);

  const handleCopyLink = () => {
    const currentUrl = window.location.href;
    navigator.clipboard.writeText(currentUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleOpenNewTab = () => {
    // Intentamos abrir la app fuera del frame de AI Studio
    window.open(window.location.href, '_blank');
  };

  return (
    <div className="relative flex h-full min-h-screen w-full flex-col overflow-x-hidden max-w-md mx-auto bg-background-light dark:bg-background-dark font-display pb-32">
      <header className="pt-12 px-6 pb-6 flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="size-10 rounded-full bg-white dark:bg-surface-dark shadow-sm flex items-center justify-center text-slate-700 dark:text-white">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-xl font-black tracking-tight">Centro de Instalación</h1>
      </header>

      <main className="px-6 space-y-6">
        {/* Progress Card */}
        <div className="bg-white dark:bg-surface-dark p-8 rounded-[2.5rem] shadow-xl border border-slate-100 dark:border-white/5 space-y-6">
          <div className="flex items-center gap-5">
            <div className={`size-16 rounded-2xl flex items-center justify-center text-white shadow-lg transition-colors ${isReady ? 'bg-emerald-500 shadow-emerald-500/30' : 'bg-primary shadow-primary/30'}`}>
              <span className="material-symbols-outlined text-4xl">{isReady ? 'verified' : 'downloading'}</span>
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-black">{isReady ? 'Software Preparado' : 'Generando Acceso...'}</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Abarrotes F1 Intelligence</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-[10px] font-black uppercase text-slate-500">
              <span>{isReady ? 'Optimización completa' : 'Sincronizando recursos'}</span>
              <span>{downloadProgress}%</span>
            </div>
            <div className="w-full h-3 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-300" 
                style={{ width: `${downloadProgress}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          {isInIframe ? (
            <button 
              disabled={!isReady}
              onClick={handleOpenNewTab}
              className={`w-full py-5 rounded-[2rem] font-black text-lg flex items-center justify-center gap-3 transition-all shadow-2xl ${
                isReady 
                  ? 'bg-primary text-white shadow-primary/30 active:scale-95' 
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <span className="material-symbols-outlined text-2xl">open_in_new</span>
              ABRIR EN PESTAÑA LIMPIA
            </button>
          ) : (
            <button 
              disabled={!isReady}
              onClick={() => alert("¡Paso Final!\n\n1. Pulsa los 3 PUNTOS (⋮) arriba a la derecha.\n2. Selecciona 'Instalar aplicación'.")}
              className={`w-full py-5 rounded-[2rem] font-black text-lg flex items-center justify-center gap-3 transition-all shadow-2xl ${
                isReady 
                  ? 'bg-primary text-white shadow-primary/30 active:scale-95' 
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <span className="material-symbols-outlined text-2xl">install_mobile</span>
              INSTALAR AHORA
            </button>
          )}

          <button 
            onClick={handleCopyLink}
            className={`w-full py-4 rounded-3xl font-bold text-xs flex items-center justify-center gap-3 transition-all uppercase tracking-widest ${
              copied ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-100 dark:bg-white/5 text-slate-500'
            }`}
          >
            <span className="material-symbols-outlined text-lg">{copied ? 'check_circle' : 'content_copy'}</span>
            {copied ? 'ENLACE COPIADO' : 'COPIAR ENLACE DIRECTO'}
          </button>
        </div>

        {/* Guía Visual Pasos */}
        <div className="space-y-4 pt-4">
          <div className="flex items-center gap-2 px-1">
            <span className="material-symbols-outlined text-primary">info</span>
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">¿Cómo completar la instalación?</h3>
          </div>
          
          <div className="space-y-3">
            <div className="flex gap-4 p-5 bg-white dark:bg-surface-dark rounded-3xl border border-slate-100 dark:border-white/5 shadow-sm">
              <div className="size-10 shrink-0 bg-primary/10 text-primary rounded-xl flex items-center justify-center font-black">1</div>
              <div>
                <h4 className="text-sm font-black text-slate-800 dark:text-white leading-tight">Abre en Chrome</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Usa el botón "Copiar Enlace" y pégalo en el navegador Google Chrome de tu Android.</p>
              </div>
            </div>

            <div className="flex gap-4 p-5 bg-white dark:bg-surface-dark rounded-3xl border border-slate-100 dark:border-white/5 shadow-sm">
              <div className="size-10 shrink-0 bg-primary/10 text-primary rounded-xl flex items-center justify-center font-black">2</div>
              <div>
                <h4 className="text-sm font-black text-slate-800 dark:text-white leading-tight">Menú de Chrome</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Pulsa los 3 puntos (⋮) en la esquina superior derecha del navegador.</p>
              </div>
            </div>

            <div className="flex gap-4 p-5 bg-white dark:bg-surface-dark rounded-3xl border border-slate-100 dark:border-white/5 shadow-sm">
              <div className="size-10 shrink-0 bg-primary/10 text-primary rounded-xl flex items-center justify-center font-black">3</div>
              <div>
                <h4 className="text-sm font-black text-slate-800 dark:text-white leading-tight">Instalar App</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Selecciona "Instalar aplicación" para integrarla en tu pantalla de inicio.</p>
              </div>
            </div>
          </div>
        </div>

        {isInIframe && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-3">
            <span className="material-symbols-outlined text-amber-500 text-xl">warning</span>
            <p className="text-[10px] font-bold text-amber-700 dark:text-amber-500 uppercase leading-tight">
              ESTÁS EN MODO PREVISUALIZACIÓN. LA INSTALACIÓN DIRECTA ESTÁ BLOQUEADA POR EL MARCO DE SEGURIDAD. SIGUE LOS PASOS DE ARRIBA.
            </p>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default InstallScreen;
