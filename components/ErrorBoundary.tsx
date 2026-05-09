
import React, { useState, useEffect, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

const ErrorBoundary: React.FC<Props> = ({ children }) => {
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      let message = event.error?.message || event.message;
      try {
        const parsed = JSON.parse(message);
        if (parsed.error) {
          message = `Firestore Error: ${parsed.error} (Op: ${parsed.operationType}, Path: ${parsed.path})`;
        }
      } catch {
        // Not a JSON error message
      }
      setHasError(true);
      setErrorMessage(message);
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-center">
        <div className="bg-white/5 border border-white/10 p-8 rounded-[2.5rem] max-w-md w-full space-y-4">
          <span className="material-symbols-outlined text-red-400 text-5xl">error</span>
          <h2 className="text-xl font-black text-white uppercase tracking-tight">Algo salió mal</h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            {errorMessage || 'Se ha producido un error inesperado en la aplicación.'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-4 bg-primary text-white font-black rounded-2xl uppercase tracking-widest shadow-lg shadow-primary/20 active:scale-95 transition-all"
          >
            Recargar Aplicación
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ErrorBoundary;
