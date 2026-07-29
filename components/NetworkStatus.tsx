import React, { useState, useEffect } from 'react';

const NetworkStatus: React.FC = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showRestored, setShowRestored] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      setShowRestored(true);
      const timer = setTimeout(() => {
        setShowRestored(false);
      }, 3000);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOffline(true);
      setShowRestored(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // También podemos usar un chequeo periódico leve para asegurar que la conexión no esté estancada
    const interval = setInterval(() => {
      if (navigator.onLine && isOffline) {
        handleOnline();
      } else if (!navigator.onLine && !isOffline) {
        handleOffline();
      }
    }, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [isOffline]);

  if (!isOffline && !showRestored) return null;

  return (
    <div 
      id="network-status-indicator"
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] max-w-sm w-11/12 md:w-auto flex items-center justify-center pointer-events-none transition-all duration-300"
    >
      {isOffline ? (
        <div 
          id="network-offline-pill"
          className="flex items-center gap-2 bg-amber-500/95 dark:bg-amber-600/95 text-white text-xs md:text-sm font-semibold px-4 py-2 rounded-full shadow-lg border border-amber-400/30 backdrop-blur-sm animate-bounce"
        >
          <span className="material-symbols-outlined text-base animate-pulse">cloud_off</span>
          <span>Modo Offline: Cambios se guardan localmente</span>
        </div>
      ) : showRestored ? (
        <div 
          id="network-online-pill"
          className="flex items-center gap-2 bg-emerald-500/95 dark:bg-emerald-600/95 text-white text-xs md:text-sm font-semibold px-4 py-2 rounded-full shadow-lg border border-emerald-400/30 backdrop-blur-sm"
        >
          <span className="material-symbols-outlined text-base">cloud_queue</span>
          <span>Conexión restablecida. Sincronizando...</span>
        </div>
      ) : null}
    </div>
  );
};

export default NetworkStatus;
