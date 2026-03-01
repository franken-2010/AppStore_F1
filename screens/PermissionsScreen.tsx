
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const PermissionsScreen: React.FC = () => {
  const navigate = useNavigate();
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleAllow = async () => {
    setLoading(true);
    try {
      if (cameraEnabled || micEnabled) {
        // Solicitar permisos reales al navegador
        await navigator.mediaDevices.getUserMedia({
          video: cameraEnabled,
          audio: micEnabled
        });
      }
      // Navegar de vuelta al Dashboard tras procesar
      navigate('/dashboard');
    } catch (err) {
      console.error("Error al solicitar permisos:", err);
      // Incluso si falla o el usuario cancela, procedemos al dashboard 
      // pero el disclaimer ya avisó que la app podría no funcionar bien.
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative h-screen w-full flex items-center justify-center overflow-hidden font-display max-w-md mx-auto">
      {/* Fondo imitando el dashboard desenfocado */}
      <div className="absolute inset-0 z-0 bg-slate-200 dark:bg-slate-900 opacity-50 blur-xl">
        <div className="p-8 space-y-8 opacity-20 grayscale">
          <div className="h-20 w-full bg-slate-300 dark:bg-slate-700 rounded-3xl"></div>
          <div className="h-40 w-full bg-slate-300 dark:bg-slate-700 rounded-3xl"></div>
          <div className="h-20 w-full bg-slate-300 dark:bg-slate-700 rounded-3xl"></div>
        </div>
      </div>

      {/* Backdrop oscuro suave */}
      <div className="absolute inset-0 z-10 bg-black/40 backdrop-blur-sm"></div>

      {/* Modal de Permisos */}
      <div className="relative z-20 w-[90%] max-w-xs bg-white dark:bg-surface-dark rounded-[2rem] p-8 shadow-2xl animate-in zoom-in duration-300">
        <h2 className="text-center text-slate-800 dark:text-white font-bold text-lg mb-8 leading-tight">
          Permite que esta app solicite acceso a:
        </h2>

        <div className="space-y-6 mb-10">
          {/* Cámara Switch */}
          <div className="flex items-center justify-between">
            <span className="text-slate-700 dark:text-slate-300 font-bold text-base">Cámara</span>
            <button 
              onClick={() => setCameraEnabled(!cameraEnabled)}
              className={`relative w-14 h-8 rounded-full transition-all duration-300 ${cameraEnabled ? 'bg-slate-900 dark:bg-slate-100' : 'bg-slate-200 dark:bg-slate-700'}`}
            >
              <div className={`absolute top-1 left-1 size-6 bg-white dark:bg-slate-900 rounded-full shadow-md transition-transform duration-300 ${cameraEnabled ? 'translate-x-6' : ''}`}></div>
            </button>
          </div>

          {/* Micrófono Switch */}
          <div className="flex items-center justify-between">
            <span className="text-slate-700 dark:text-slate-300 font-bold text-base">Micrófono</span>
            <button 
              onClick={() => setMicEnabled(!micEnabled)}
              className={`relative w-14 h-8 rounded-full transition-all duration-300 ${micEnabled ? 'bg-slate-900 dark:bg-slate-100' : 'bg-slate-200 dark:bg-slate-700'}`}
            >
              <div className={`absolute top-1 left-1 size-6 bg-white dark:bg-slate-900 rounded-full shadow-md transition-transform duration-300 ${micEnabled ? 'translate-x-6' : ''}`}></div>
            </button>
          </div>
        </div>

        <div className="flex flex-col items-center gap-6">
          <button 
            onClick={handleAllow}
            disabled={loading}
            className="px-10 py-3 bg-white dark:bg-white dark:text-slate-900 text-slate-900 border border-slate-200 dark:border-transparent font-bold rounded-2xl shadow-sm active:scale-95 transition-all disabled:opacity-50"
          >
            {loading ? 'Procesando...' : 'Permitir'}
          </button>

          <p className="text-center text-slate-600 dark:text-slate-400 text-xs font-medium leading-relaxed">
            Es posible que la aplicación no funcione correctamente sin estos permisos.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PermissionsScreen;
