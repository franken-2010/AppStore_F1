
import React, { useState, useEffect, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

const ErrorBoundary: React.FC<Props> = ({ children }) => {
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      const rawMessage = event.error?.message || event.message || '';
      const lower = rawMessage.toLowerCase();

      // Ignorar errores benignos de desconexión, reintento offline o advertencias de renderizado
      if (
        lower.includes('unavailable') ||
        lower.includes('could not reach') ||
        lower.includes('offline') ||
        lower.includes('resizeobserver') ||
        lower.includes('network error') ||
        lower.includes('failed to fetch') ||
        lower.includes('gemini') ||
        lower.includes('denied access') ||
        lower.includes('permission_denied')
      ) {
        console.warn('Advertencia no fatal suprimida en ErrorBoundary:', rawMessage);
        return;
      }

      let message = rawMessage;
      try {
        const parsed = JSON.parse(rawMessage);
        if (parsed.error) {
          const parsedLower = String(parsed.error).toLowerCase();
          if (parsedLower.includes('unavailable') || parsedLower.includes('offline') || parsedLower.includes('could not reach')) {
            return;
          }
          message = `Firestore Error: ${parsed.error} (Op: ${parsed.operationType}, Path: ${parsed.path})`;
        }
      } catch {
        // Not a JSON error message
      }
      setHasError(true);
      setErrorMessage(message);
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const rawMessage = reason instanceof Error ? reason.message : String(reason || '');
      const lower = rawMessage.toLowerCase();

      if (
        lower.includes('unavailable') ||
        lower.includes('could not reach') ||
        lower.includes('offline') ||
        lower.includes('network error') ||
        lower.includes('failed to fetch') ||
        lower.includes('gemini') ||
        lower.includes('denied access') ||
        lower.includes('permission_denied') ||
        lower.includes('not valid json')
      ) {
        console.warn('Reintento o error de red/IA asíncrono gestionado:', rawMessage);
        event.preventDefault();
      }
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
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

